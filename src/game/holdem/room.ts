/**
 * A Hold'em table: the Sit & Go itself and its clock, on the platform's lobby
 * room (seats, host, invites, bots, starting and rematches: lobbyRoom.ts). The
 * engine (engine.ts) knows the rules; this room knows people: whose turn is
 * running out, who's sitting out, and what each viewer is allowed to see.
 *
 *   lobby   seats fill (the platform's lobby), then the host starts (quick tables
 *           start themselves; practice starts as soon as you sit down)
 *   playing hands are dealt one after another until one player has every chip
 *   over    standings, and the platform's rematch
 *
 * Every change goes out as `holdem:update` {view, events} to each connected
 * player, with events redacted per viewer (you never see others' hole cards
 * before showdown). Engine player ids are `s<seat>` and never leave the room:
 * clients see seat numbers.
 */
import { LobbyRoom, type LobbyRoomOptions, type LobbyRules, type RoomMode, type Seat as LobbySeat } from "../../platform/lobbyRoom.js";
import type { PeerLike } from "../../platform/peer.js";
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

export type TableMode = RoomMode;
export type TablePhase = "lobby" | "playing" | "over";

interface Seat extends LobbySeat {
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

export interface TableOptions extends LobbyRoomOptions<TableSettings> {
  readonly timing?: Partial<TableTiming>;
  /** Shuffle and bot randomness (tests pass a seeded source). */
  readonly random?: RandomSource;
}

/** Hold'em's lobby: the host starts it, 2 players or more, bots allowed. */
const RULES: LobbyRules = { start: "host", minPlayers: 2, bots: true };

export class TableRoom extends LobbyRoom<TableSettings, Seat> {
  readonly gameId = GAME_ID;
  game: HoldemGame | null = null;

  private readonly timing: TableTiming;
  private readonly random: RandomSource;
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

  constructor(options: TableOptions) {
    const timing = { ...DEFAULT_TIMING, ...options.timing };
    // Quick tables wait for players, then deal with bots in the empty seats.
    const { formingMs: _forming, ...rest } = options;
    super(options.mode === "quick" ? { ...rest, formingMs: timing.quickStartMs } : rest, RULES);
    this.timing = timing;
    this.random = options.random ?? cryptoRandom;
  }

  // ------------------------------------------------------------ the lobby's hooks

  protected capacity(settings: TableSettings): number {
    return settings.seats;
  }

  protected emptySeat(): Seat {
    return emptySeat();
  }

  protected fillsWithBots(settings: TableSettings): boolean {
    return settings.bots;
  }

  protected parseSettings(raw: unknown, base: TableSettings): TableSettings {
    return parseSettings(raw, base);
  }

  protected override onChange(): void {
    this.broadcast([]);
  }

  /** Leaving mid-game sits you out: the server checks or folds for you. */
  protected override leaveDuringGame(seat: number): void {
    this.seats[seat]!.away = true;
    this.broadcast([]);
    this.rearmTurn();
  }

  // ------------------------------------------------------------ Room

  override join(peer: PeerLike): boolean {
    const s = this.seats[this.seatOfPeer(peer.id)];
    if (!s) return false;
    if (s.away && this.phase === "playing") s.away = false; // back at the table
    s.timeouts = 0;
    super.join(peer);
    this.rearmTurn();
    return true;
  }

  override leave(peer: PeerLike): void {
    super.leave(peer);
    this.rearmTurn(); // a disconnected player to act gets the short clock
  }

  override dispose(): void {
    this.clearTimers();
    super.dispose();
  }

  /** The table's own methods (the lobby's are lobby:*). */
  protected gameRequest(seat: number, method: string, d: Record<string, unknown>): unknown {
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

      default:
        throw new Error(`unknown table method: ${method}`);
    }
  }

  // ------------------------------------------------------------ the game

  /** Deal the first hand (the platform has filled the seats); hands run until one player is left. */
  protected startGame(): void {
    const playing = this.seats.map((s, seat) => ({ s, seat })).filter(({ s }) => s.kind === "player" || s.kind === "bot");
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

  protected override finish(): void {
    if (this.phase === "over") return;
    this.clearTimers();
    super.finish();
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
  return { kind: "empty", peerId: null, accountId: null, name: "", inviteId: null, data: null, away: false, timeouts: 0 };
}

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
