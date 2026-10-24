/**
 * A Hold'em table: seats, the lobby before the deal, the Sit & Go itself, and
 * the clock. The engine (engine.ts) knows the rules; this room knows people:
 * who sits where, who's connected, whose turn is running out, which seats are
 * bots, and what each viewer is allowed to see.
 *
 *   lobby   seats fill (players join by code, link or invite; the host adds
 *           bots or changes settings), then the host starts (quick tables
 *           start themselves; practice starts as soon as you sit down)
 *   playing hands are dealt one after another until one player has every chip
 *   over    standings, and a rematch that opens a new table
 *
 * Every change goes out as `holdem:update` {view, events} to each connected
 * player, with events redacted per viewer (you never see others' hole cards
 * before showdown). Engine player ids are `s<seat>` and never leave the room:
 * clients see seat numbers.
 */
import { randomUUID } from "node:crypto";
import type { PeerLike } from "../../platform/peer.js";
import type { Room } from "../../platform/lobby.js";
import { chooseAction } from "./bot.js";
import { cryptoRandom } from "./cards.js";
import { HoldemGame, redactEvents } from "./engine.js";
import { evaluate } from "./evaluator.js";
import type { Action, HoldemEvent, HoldemView, RandomSource } from "./types.js";

export const GAME_ID = "holdem";

export interface TableSettings {
  /** 2–6 seats. */
  readonly seats: number;
  /** Fill empty seats with bots when the game starts. */
  readonly bots: boolean;
  readonly chips: 500 | 1000 | 2000 | 5000;
  /** 25 s per action plus a time bank; off = no clock (except for away players). */
  readonly timer: boolean;
  /** Hands per blind level: 10, 5, or 0 = never. */
  readonly blindsEvery: 0 | 5 | 10;
}

export const DEFAULT_SETTINGS: TableSettings = { seats: 6, bots: true, chips: 1000, timer: true, blindsEvery: 10 };

/** Settings from a client, clamped to what the game offers. */
export function parseSettings(raw: unknown, base: TableSettings = DEFAULT_SETTINGS): TableSettings {
  const d = (raw ?? {}) as Record<string, unknown>;
  const seats = typeof d["seats"] === "number" ? Math.max(2, Math.min(6, Math.round(d["seats"]))) : base.seats;
  const chips = ([500, 1000, 2000, 5000] as const).find((c) => c === d["chips"]) ?? base.chips;
  const blindsEvery = ([0, 5, 10] as const).find((b) => b === d["blindsEvery"]) ?? base.blindsEvery;
  return {
    seats,
    bots: typeof d["bots"] === "boolean" ? d["bots"] : base.bots,
    chips,
    timer: typeof d["timer"] === "boolean" ? d["timer"] : base.timer,
    blindsEvery,
  };
}

export type TableMode = "quick" | "private" | "practice" | "invite" | "rematch";
export type TablePhase = "lobby" | "playing" | "over";

interface Seat {
  kind: "player" | "bot" | "empty" | "invited";
  peerId: string | null;
  accountId: string | null;
  name: string;
  /** The invite holding this seat (kind "invited"). */
  inviteId: string | null;
  /** Sitting out: the server acts for them (check if free, else fold). */
  away: boolean;
  /** Timeouts in a row; two puts a connected player away. */
  timeouts: number;
}

/** What we remember per seat for the result screen and profile stats. */
interface SeatStats {
  handsWon: number;
  biggestPot: number;
  bestScore: number;
  bestHand: string | null;
}

export interface TableTiming {
  /** Time per action with the timer on. */
  readonly turnMs: number;
  /** Time bank per player for the whole game. */
  readonly bankMs: number;
  /** How long an away or disconnected player gets before the server acts for them. */
  readonly awayMs: number;
  /** Bots think for a random time in this range. */
  readonly botMs: readonly [number, number];
  /** Pause between hands (the client animates the end of the hand). */
  readonly nextHandMs: number;
  /** Extra pause after a showdown, to read the hands. */
  readonly showdownMs: number;
  /** Quick tables wait this long after the first player sits before bots fill in. */
  readonly quickStartMs: number;
  /** Scale on the time given to clients to animate events (0 in tests). */
  readonly animScale: number;
}

export const DEFAULT_TIMING: TableTiming = {
  turnMs: 25_000,
  bankMs: 60_000,
  awayMs: 5_000,
  botMs: [900, 1900],
  nextHandMs: 2_600,
  showdownMs: 2_400,
  quickStartMs: 20_000,
  animScale: 1,
};

export interface TableOptions {
  readonly roomId: string;
  readonly code: string;
  readonly mode: TableMode;
  readonly settings: TableSettings;
  /** Quick tables have no host: they start themselves. */
  readonly hosted: boolean;
  /** Practice: start as soon as the first player connects. */
  readonly autoStart?: boolean;
  readonly timing?: Partial<TableTiming>;
  /** Shuffle and bot randomness (tests pass a seeded source). */
  readonly random?: RandomSource;
  /** Called once when the game ends, with the standings to record. */
  readonly onFinished?: (room: TableRoom) => void;
  /** Called when the game starts: invites still open for seats here should end. */
  readonly onStarted?: (room: TableRoom) => void;
  /** Called when the room is disposed. */
  readonly onDisposed?: (room: TableRoom) => void;
}

const BOT_NAMES = ["Ace", "Lu", "Dot", "Bix", "Pip", "Rook", "Kit", "Moss"];

export class TableRoom implements Room {
  readonly gameId = GAME_ID;
  readonly roomId: string;
  readonly code: string;
  readonly mode: TableMode;
  readonly hosted: boolean;
  settings: TableSettings;
  phase: TablePhase = "lobby";
  /** The host's seat (hosted tables), or -1. */
  hostSeat = -1;
  /** When a quick table will start with bots (epoch ms), once someone sits. */
  startsAt: number | null = null;
  /** The rematch table, once someone asked for one, and who has joined it so far. */
  rematch: { roomId: string; code: string; players: string[] } | null = null;
  startedAt: Date | null = null;
  game: HoldemGame | null = null;

  private seats: Seat[];
  private readonly timing: TableTiming;
  private readonly random: RandomSource;
  private readonly peers = new Map<string, PeerLike>();
  private readonly stats = new Map<number, SeatStats>();
  /** Time bank left per seat (ms). */
  private readonly bank = new Map<number, number>();
  private deadline: number | null = null;
  /** When the current turn's clock started (after the animation allowance). */
  private turnStart = 0;
  /** When the current turn's time bank started (null: not in the bank). */
  private bankStartedAt: number | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private nextTimer: ReturnType<typeof setTimeout> | null = null;
  private quickTimer: ReturnType<typeof setTimeout> | null = null;
  private finishedReported = false;
  private disposed = false;

  constructor(private readonly options: TableOptions) {
    this.roomId = options.roomId;
    this.code = options.code;
    this.mode = options.mode;
    this.hosted = options.hosted;
    this.settings = options.settings;
    this.timing = { ...DEFAULT_TIMING, ...options.timing };
    this.random = options.random ?? cryptoRandom;
    this.seats = Array.from({ length: this.settings.seats }, () => emptySeat());
  }

  // ------------------------------------------------------------ seats (lobby)

  /** Seat a player (or find their seat). Throws when the table is full or started. */
  reserve(peerId: string, name: string, accountId: string | null): number {
    const mine = this.seats.findIndex((s) => s.peerId === peerId);
    if (mine >= 0) return mine;
    if (this.phase !== "lobby") throw new Error("this table has already started");
    // An invited player takes the seat held for them; anyone else the first free seat,
    // or a bot's seat (people beat bots).
    let seat = accountId ? this.seats.findIndex((s) => s.kind === "invited" && s.accountId === accountId) : -1;
    if (seat < 0) seat = this.seats.findIndex((s) => s.kind === "empty");
    if (seat < 0) seat = this.seats.map((s) => s.kind).lastIndexOf("bot");
    if (seat < 0) throw new Error("this table is full");
    this.seats[seat] = { ...emptySeat(), kind: "player", peerId, accountId, name: clean(name) };
    if (this.hosted && this.hostSeat < 0) this.hostSeat = seat;
    if (this.mode === "quick" && !this.quickTimer) this.armQuickStart();
    this.broadcast([]);
    if (this.mode === "quick" && this.freeSeats() === 0) this.start();
    return seat;
  }

  /** Hold a free seat for an invited friend. Returns the seat, or throws when there's none. */
  holdFor(accountId: string, name: string, inviteId: string): number {
    const seat = this.seatFor(accountId);
    this.seats[seat] = { ...emptySeat(), kind: "invited", accountId, name: clean(name), inviteId };
    this.broadcast([]);
    return seat;
  }

  /** The seat an invite for this account would hold; throws a readable reason when there's none. */
  seatFor(accountId: string): number {
    if (this.phase !== "lobby") throw new Error("this table has already started");
    if (this.seats.some((s) => s.accountId === accountId && (s.kind === "player" || s.kind === "invited"))) throw new Error("they already have a seat here");
    const seat = this.seats.findIndex((s) => s.kind === "empty");
    if (seat < 0) throw new Error("there's no free seat for them");
    return seat;
  }

  /** An invite ended without the friend sitting down: free its seat. */
  release(inviteId: string): void {
    const seat = this.seats.findIndex((s) => s.kind === "invited" && s.inviteId === inviteId);
    if (seat < 0 || this.phase !== "lobby") return;
    this.seats[seat] = emptySeat();
    this.broadcast([]);
  }

  freeSeats(): number {
    return this.seats.filter((s) => s.kind === "empty").length;
  }

  hostName(): string {
    return this.seats[this.hostSeat]?.name ?? "";
  }

  /** Who's seated, for results and rematches. */
  seated(): { seat: number; kind: Seat["kind"]; name: string; accountId: string | null; peerId: string | null }[] {
    return this.seats.map((s, seat) => ({ seat, kind: s.kind, name: s.name, accountId: s.accountId, peerId: s.peerId }));
  }

  /** Invite ids still holding seats (they end when the game starts). */
  openInvites(): string[] {
    return this.seats.filter((s) => s.kind === "invited" && s.inviteId).map((s) => s.inviteId!);
  }

  // ------------------------------------------------------------ Room

  join(peer: PeerLike): boolean {
    const seat = this.seats.findIndex((s) => s.peerId === peer.id);
    if (seat < 0) return false;
    this.peers.set(peer.id, peer);
    const s = this.seats[seat]!;
    if (s.away && this.phase === "playing") s.away = false; // back at the table
    s.timeouts = 0;
    if (this.options.autoStart && this.phase === "lobby") {
      try {
        this.start();
      } catch {
        this.broadcast([]);
      }
    } else this.broadcast([]);
    this.rearmTurn();
    return true;
  }

  leave(peer: PeerLike): void {
    if (this.peers.get(peer.id) !== peer) return;
    this.peers.delete(peer.id);
    this.broadcast([]);
    this.rearmTurn(); // a disconnected player to act gets the short clock
  }

  connectedCount(): number {
    return this.peers.size;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimers();
    if (this.quickTimer) clearTimeout(this.quickTimer);
    this.options.onDisposed?.(this);
  }

  handleRequest(peerId: string, method: string, data: unknown): unknown {
    const seat = this.seats.findIndex((s) => s.peerId === peerId);
    if (seat < 0) throw new Error("you don't have a seat at this table");
    const d = (data ?? {}) as Record<string, unknown>;
    switch (method) {
      case "holdem:getState":
        return this.viewFor(seat);

      case "holdem:act":
        this.act(seat, parseAction(d["action"]));
        return { ok: true };

      case "holdem:back": {
        const s = this.seats[seat]!;
        s.away = false;
        s.timeouts = 0;
        this.broadcast([]);
        this.rearmTurn();
        return { ok: true };
      }

      case "holdem:start":
        this.requireHost(seat);
        this.start();
        return { ok: true };

      case "holdem:addBot": {
        this.requireHost(seat);
        const target = typeof d["seat"] === "number" ? d["seat"] : this.seats.findIndex((s) => s.kind === "empty");
        if (this.seats[target]?.kind !== "empty") throw new Error("that seat isn't free");
        this.seats[target] = { ...emptySeat(), kind: "bot", name: this.botName() };
        this.broadcast([]);
        return { ok: true };
      }

      case "holdem:removeBot": {
        this.requireHost(seat);
        const target = Number(d["seat"]);
        if (this.seats[target]?.kind !== "bot") throw new Error("that seat isn't a bot");
        this.seats[target] = emptySeat();
        this.broadcast([]);
        return { ok: true };
      }

      case "holdem:settings": {
        this.requireHost(seat);
        this.applySettings(parseSettings(d["settings"], this.settings));
        return { ok: true };
      }

      case "holdem:leave":
        this.leaveSeat(seat);
        return { ok: true };

      default:
        throw new Error(`unknown table method: ${method}`);
    }
  }

  // ------------------------------------------------------------ the game

  /** Deal the first hand: empty seats get bots (if on), then hands run until one player is left. */
  start(): void {
    if (this.phase !== "lobby") throw new Error("this table has already started");
    if (this.quickTimer) clearTimeout(this.quickTimer);
    this.quickTimer = null;
    this.startsAt = null;
    for (const [i, s] of this.seats.entries()) {
      // Seats still held by invites, and empty ones, get bots, or stay empty.
      if (s.kind === "empty" || s.kind === "invited") this.seats[i] = this.settings.bots ? { ...emptySeat(), kind: "bot", name: this.botName() } : emptySeat();
    }
    const playing = this.seats.map((s, seat) => ({ s, seat })).filter(({ s }) => s.kind === "player" || s.kind === "bot");
    if (playing.length < 2) throw new Error("you need at least 2 players: invite someone or add a bot");
    this.game = new HoldemGame({
      players: playing.map(({ s, seat }) => ({ id: idOf(seat), name: s.name, bot: s.kind === "bot" })),
      startingChips: this.settings.chips,
      blindsEveryHands: this.settings.blindsEvery,
      random: this.random,
    });
    for (const { seat } of playing) {
      this.bank.set(seat, this.timing.bankMs);
      this.stats.set(seat, { handsWon: 0, biggestPot: 0, bestScore: -1, bestHand: null });
    }
    this.phase = "playing";
    this.startedAt = new Date();
    this.options.onStarted?.(this);
    this.dealNext();
  }

  /** A player's action (or the server's for them). Throws a readable reason when it's not allowed. */
  act(seat: number, action: Action): void {
    const game = this.requireGame();
    if (game.toActId !== idOf(seat)) throw new Error("it's not your turn");
    const s = this.seats[seat]!;
    const bankStart = this.bankStartedAt;
    const r = game.act(idOf(seat), action);
    if (!r.ok) throw new Error(REASON_TEXT[r.reason] ?? r.reason); // a rejected action changes nothing, clock included
    this.bankStartedAt = bankStart;
    this.spendBank(seat);
    s.timeouts = 0;
    s.away = false;
    this.afterEvents(r.events);
  }

  private dealNext(): void {
    this.nextTimer = null;
    const game = this.requireGame();
    if (game.phase === "gameOver") return this.finish();
    const r = game.startHand();
    if (!r.ok) return this.finish();
    this.afterEvents(r.events);
  }

  /** Send what happened, then line up whatever comes next: a turn, the next hand, or the end. */
  private afterEvents(events: HoldemEvent[]): void {
    const game = this.requireGame();
    this.track(events);
    this.clearTurn();
    if (game.phase === "handOver" || game.phase === "gameOver") {
      this.broadcast(events);
      if (game.phase === "gameOver") return this.finish();
      const showdown = events.some((e) => e.type === "showdown");
      const pause = this.botsOnly() ? 300 : this.timing.nextHandMs + (showdown ? this.timing.showdownMs : 0) + this.animMs(events);
      this.nextTimer = setTimeout(() => this.dealNext(), pause);
      this.nextTimer.unref?.();
      return;
    }
    this.turnStart = Date.now() + this.lastAnim; // a new turn: its clock starts after the animations
    this.armTurn();
    this.broadcast(events);
  }

  /** Once every person has busted, the bots finish the game quickly (nobody's waiting on them). */
  private botsOnly(): boolean {
    const game = this.game;
    if (!game) return false;
    return game.state.seats.every((s) => s.place !== null || this.seats[seatOf(s.id)]?.kind === "bot");
  }

  /** Start the clock (and the bots) for whoever is to act. */
  private armTurn(): void {
    const game = this.game;
    if (!game || this.phase !== "playing") return;
    const id = game.toActId;
    if (!id) return;
    const seat = seatOf(id);
    const s = this.seats[seat]!;
    const now = Date.now();
    const pause = Math.max(0, this.turnStart - now);
    if (s.kind === "bot") {
      const [lo, hi] = this.timing.botMs;
      const think = this.botsOnly() ? 120 : pause + lo + Math.floor(this.random() * (hi - lo));
      this.turnTimer = setTimeout(() => this.botAct(seat), think);
    } else if (s.away || !this.peers.has(s.peerId ?? "")) {
      this.deadline = now + pause + this.timing.awayMs;
      this.turnTimer = setTimeout(() => this.timeout(seat), pause + this.timing.awayMs);
    } else if (this.settings.timer) {
      // The turn's clock keeps running across reconnects: resume it rather than restart it.
      const end = this.turnStart + this.timing.turnMs;
      if (end > now) {
        this.deadline = end;
        this.turnTimer = setTimeout(() => this.enterBank(seat), end - now);
      } else {
        this.enterBank(seat);
        return;
      }
    }
    this.turnTimer?.unref?.();
  }

  /** Re-time the current turn after someone connects, disconnects, or comes back. */
  private rearmTurn(): void {
    if (this.phase !== "playing" || !this.game?.toActId || this.nextTimer) return;
    const seat = seatOf(this.game.toActId);
    if (this.seats[seat]?.kind === "bot") return;
    this.spendBank(seat); // time already used from the bank stays used
    this.clearTurn();
    this.armTurn();
    this.broadcast([]);
  }

  private enterBank(seat: number): void {
    const left = this.bank.get(seat) ?? 0;
    if (left <= 0) return this.timeout(seat);
    this.bankStartedAt = Date.now();
    this.deadline = Date.now() + left;
    this.turnTimer = setTimeout(() => {
      this.bank.set(seat, 0);
      this.bankStartedAt = null;
      this.timeout(seat);
    }, left);
    this.turnTimer.unref?.();
    this.broadcast([]);
  }

  private spendBank(seat: number): void {
    if (this.bankStartedAt === null) return;
    this.bank.set(seat, Math.max(0, (this.bank.get(seat) ?? 0) - (Date.now() - this.bankStartedAt)));
    this.bankStartedAt = null;
  }

  private timeout(seat: number): void {
    const game = this.game;
    if (!game || game.toActId !== idOf(seat)) return;
    const s = this.seats[seat]!;
    this.bankStartedAt = null;
    s.timeouts += 1;
    if (s.timeouts >= 2) s.away = true;
    const r = game.timeoutAction(idOf(seat));
    if (r.ok) this.afterEvents(r.events);
  }

  private botAct(seat: number): void {
    const game = this.game;
    if (!game || game.toActId !== idOf(seat)) return;
    const action = chooseAction(game, idOf(seat), this.random, { level: "normal" });
    let r = game.act(idOf(seat), action);
    if (!r.ok) r = game.timeoutAction(idOf(seat)); // never stall on a bot bug
    if (r.ok) this.afterEvents(r.events);
  }

  private finish(): void {
    if (this.phase === "over") return;
    this.phase = "over";
    this.clearTimers();
    this.broadcast([]);
    if (!this.finishedReported) {
      this.finishedReported = true;
      this.options.onFinished?.(this);
    }
  }

  /** Final places and per-seat stats (once the game is over). */
  results(): { seat: number; name: string; accountId: string | null; isBot: boolean; place: number; handsWon: number; biggestPot: number; bestHand: string | null }[] {
    const game = this.requireGame();
    return game.standings().map((st) => {
      const seat = seatOf(st.id);
      const s = this.seats[seat]!;
      const stats = this.stats.get(seat);
      return {
        seat,
        name: st.name,
        accountId: s.accountId,
        isBot: s.kind === "bot",
        place: st.place ?? 1,
        handsWon: stats?.handsWon ?? 0,
        biggestPot: stats?.biggestPot ?? 0,
        bestHand: stats?.bestHand ?? null,
      };
    });
  }

  // ------------------------------------------------------------ views

  /** Rough time the client needs to animate these events, so bots and clocks wait for it. */
  private lastAnim = 0;
  private animMs(events: readonly HoldemEvent[]): number {
    let ms = 0;
    for (const e of events) {
      if (e.type === "holeDealt") ms += 300 + e.hands.length * 120;
      else if (e.type === "street") ms += 500;
      else if (e.type === "showdown") ms += 700;
      else if (e.type === "potAwarded") ms += 500;
      else if (e.type === "action") ms += 150;
    }
    return Math.min(ms, 4000) * this.timing.animScale;
  }

  private track(events: readonly HoldemEvent[]): void {
    this.lastAnim = this.animMs(events);
    const game = this.requireGame();
    // What each seat won this hand, over every pot (a side pot is still the same hand).
    const won = new Map<number, number>();
    for (const e of events) {
      if (e.type === "potAwarded") {
        for (const w of e.winners) won.set(seatOf(w.id), (won.get(seatOf(w.id)) ?? 0) + w.amount);
      } else if (e.type === "showdown") {
        for (const r of e.reveals) {
          const st = this.stats.get(seatOf(r.id));
          if (!st || game.state.board.length < 3) continue;
          const result = evaluate([...r.cards, ...game.state.board]);
          if (result.score > st.bestScore) {
            st.bestScore = result.score;
            st.bestHand = result.name;
          }
        }
      }
    }
    for (const [seat, amount] of won) {
      const st = this.stats.get(seat);
      if (!st) continue;
      st.handsWon += 1;
      st.biggestPot = Math.max(st.biggestPot, amount);
    }
  }

  /** The table as one seat sees it (the TableView in docs/PLATFORM.md). */
  viewFor(seat: number | null): Record<string, unknown> {
    const game = this.game;
    const hv: HoldemView | null = game ? game.viewFor(seat === null ? null : idOf(seat)) : null;
    const byId = new Map((hv?.seats ?? []).map((sv) => [seatOf(sv.id), sv]));
    const toAct = hv?.toActId ? seatOf(hv.toActId) : null;
    const button = hv?.button ? seatOf(hv.button) : null;
    const st = game?.state;
    return {
      roomId: this.roomId,
      code: this.code,
      mode: this.mode,
      phase: this.phase,
      you: seat,
      host: this.hostSeat,
      settings: this.settings,
      startsAt: this.startsAt,
      seats: this.seats.map((s, i) => {
        const sv = byId.get(i);
        return {
          seat: i,
          kind: s.kind,
          name: s.name,
          connected: s.kind === "bot" || this.peers.has(s.peerId ?? ""),
          away: s.away,
          chips: sv ? sv.stack : this.phase === "lobby" && s.kind !== "empty" ? this.settings.chips : 0,
          bet: sv?.bet ?? 0,
          inHand: sv?.inHand ?? false,
          folded: sv?.folded ?? false,
          allIn: sv?.allIn ?? false,
          busted: sv?.busted ?? false,
          place: sv?.place ?? null,
          cards: sv?.cards ?? null,
          hasCards: sv?.hasCards ?? false,
          dealer: button === i,
          sb: st ? st.sbSeat >= 0 && seatOf(idOfIndex(st, st.sbSeat)) === i && hv?.phase !== "handOver" : false,
          bb: st ? st.bbSeat >= 0 && seatOf(idOfIndex(st, st.bbSeat)) === i && hv?.phase !== "handOver" : false,
        };
      }),
      board: hv?.board ?? [],
      pots: (hv?.pots ?? []).map((p) => ({ amount: p.amount })),
      totalPot: hv?.totalPot ?? 0,
      handNo: hv?.handNo ?? 0,
      street: hv?.phase ?? null,
      blinds: hv ? { sb: hv.sb, bb: hv.bb, level: hv.level, nextIn: hv.nextLevelAtHand === null ? null : Math.max(0, hv.nextLevelAtHand - hv.handNo) } : null,
      toAct,
      legal: toAct !== null && toAct === seat ? hv?.legal ?? null : null,
      deadline: this.deadline,
      inBank: this.bankStartedAt !== null,
      bank: seat === null ? 0 : Math.round((this.bank.get(seat) ?? this.timing.bankMs) / 1000),
      standings: game ? game.standings().filter((x) => x.place !== null).map((x) => ({ seat: seatOf(x.id), name: x.name, place: x.place })) : [],
      results: this.phase === "over" ? this.results().map(({ accountId: _account, ...r }) => r) : null,
      rematch: this.rematch,
    };
  }

  /** Send every connected player their view, with these events redacted for them. */
  broadcast(events: readonly HoldemEvent[]): void {
    for (const [peerId, peer] of this.peers) {
      const seat = this.seats.findIndex((s) => s.peerId === peerId);
      if (seat < 0) continue;
      peer.notify("holdem:update", { view: this.viewFor(seat), events: translate(redactEvents(events, idOf(seat))) });
    }
  }

  // ------------------------------------------------------------ helpers

  private requireGame(): HoldemGame {
    if (!this.game) throw new Error("the game hasn't started yet");
    return this.game;
  }

  private requireHost(seat: number): void {
    if (!this.hosted || seat !== this.hostSeat) throw new Error("only the host can do that");
    if (this.phase !== "lobby") throw new Error("the game has already started");
  }

  private applySettings(next: TableSettings): void {
    const occupied = this.seats.filter((s) => s.kind !== "empty");
    if (occupied.length > next.seats) throw new Error("free up some seats first");
    // Keep everyone seated, in order; the host keeps their seat number if it still exists.
    const seats: Seat[] = Array.from({ length: next.seats }, () => emptySeat());
    const host = this.seats[this.hostSeat];
    let i = 0;
    for (const s of this.seats) {
      if (s.kind === "empty") continue;
      while (seats[i]!.kind !== "empty") i++;
      seats[i] = s;
    }
    this.seats = seats;
    this.hostSeat = host ? seats.indexOf(host) : -1;
    this.settings = next;
    this.broadcast([]);
  }

  private leaveSeat(seat: number): void {
    const s = this.seats[seat]!;
    if (this.phase === "lobby") {
      this.seats[seat] = emptySeat();
      if (seat === this.hostSeat) {
        // The next player hosts; a table with no players left is cleaned up when empty.
        this.hostSeat = this.seats.findIndex((x) => x.kind === "player");
      }
      if (s.peerId) this.peers.delete(s.peerId);
      if (this.mode === "quick" && !this.seats.some((x) => x.kind === "player")) {
        if (this.quickTimer) clearTimeout(this.quickTimer);
        this.quickTimer = null;
        this.startsAt = null;
      }
      this.broadcast([]);
      return;
    }
    if (this.phase === "playing") {
      s.away = true;
      this.broadcast([]);
      this.rearmTurn();
    }
  }

  private armQuickStart(): void {
    this.startsAt = Date.now() + this.timing.quickStartMs;
    this.quickTimer = setTimeout(() => {
      this.quickTimer = null;
      if (this.phase !== "lobby") return;
      if (!this.seats.some((s) => s.kind === "player")) {
        // Everyone left before the deal: the next player to sit starts a fresh countdown.
        this.startsAt = null;
        return;
      }
      try {
        this.start();
      } catch {
        this.startsAt = null;
      }
    }, this.timing.quickStartMs);
    this.quickTimer.unref?.();
  }

  private botName(): string {
    const taken = new Set(this.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !taken.has(`Bot ${n}`)) ?? randomUUID().slice(0, 4);
    return `Bot ${name}`;
  }

  private clearTurn(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.deadline = null;
  }

  private clearTimers(): void {
    this.clearTurn();
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.nextTimer = null;
  }
}

function emptySeat(): Seat {
  return { kind: "empty", peerId: null, accountId: null, name: "", inviteId: null, away: false, timeouts: 0 };
}

const clean = (name: string) => (String(name || "").trim().slice(0, 16) || "Player");
const idOf = (seat: number) => `s${seat}`;
const seatOf = (id: string) => Number(id.slice(1));
/** The engine id at an engine seat index. */
const idOfIndex = (st: { seats: readonly { id: string }[] }, index: number) => st.seats[index]?.id ?? "s-1";

function parseAction(raw: unknown): Action {
  const a = (raw ?? {}) as Record<string, unknown>;
  switch (a["type"]) {
    case "fold":
    case "check":
    case "call":
    case "allIn":
      return { type: a["type"] };
    case "raise":
      return { type: "raise", to: Number(a["to"]) };
    default:
      throw new Error("unknown action");
  }
}

const REASON_TEXT: Record<string, string> = {
  "not your turn": "it's not your turn",
  "cannot check facing a bet": "you can't check: there's a bet to call",
  "raise not allowed": "you can't raise right now",
  "invalid amount": "that amount doesn't work",
  "raise below minimum": "that raise is below the minimum",
  "raise above stack": "you don't have that many chips",
  "no hand in progress": "wait for the next hand",
};

/** Engine events as clients see them: seat numbers instead of engine ids (docs/PLATFORM.md). */
export function translate(events: readonly HoldemEvent[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const e of events) {
    switch (e.type) {
      case "blindsUp":
        out.push({ type: "blindsUp", level: e.level, sb: e.sb, bb: e.bb });
        break;
      case "handStart":
        out.push({ type: "handStart", handNo: e.handNo, button: seatOf(e.button), sb: e.sb, bb: e.bb, stacks: e.stacks.map((s) => ({ seat: seatOf(s.id), chips: s.chips })) });
        break;
      case "blindsPosted":
        for (const p of e.posts) out.push({ type: "blinds", seat: seatOf(p.id), kind: p.kind, amount: p.amount, allIn: p.allIn });
        break;
      case "holeDealt":
        out.push({ type: "deal", hands: e.hands.map((h) => ({ seat: seatOf(h.id), cards: h.cards })) });
        break;
      case "action":
        if (e.timedOut) out.push({ type: "timeout", seat: seatOf(e.id), action: e.action });
        out.push({ type: "action", seat: seatOf(e.id), action: e.action, amount: e.amount, toTotal: e.toTotal, allIn: e.allIn });
        break;
      case "betReturned":
        out.push({ type: "returned", seat: seatOf(e.id), amount: e.amount });
        break;
      case "street":
        out.push({ type: "street", name: e.name, cards: e.cards, board: e.board });
        break;
      case "showdown":
        out.push({ type: "showdown", reveals: e.reveals.map((r) => ({ seat: seatOf(r.id), cards: r.cards, handName: r.handName })) });
        break;
      case "potAwarded":
        out.push({ type: "pot", index: e.potIndex, amount: e.amount, winners: e.winners.map((w) => ({ seat: seatOf(w.id), amount: w.amount, handName: w.handName })) });
        break;
      case "eliminated":
        out.push({ type: "eliminated", seat: seatOf(e.id), place: e.place });
        break;
      case "gameOver":
        out.push({ type: "gameOver", standings: e.standings.map((s) => ({ seat: seatOf(s.id), name: s.name, place: s.place, chips: s.chips })) });
        break;
    }
  }
  return out;
}
