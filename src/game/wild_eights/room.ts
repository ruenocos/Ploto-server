/**
 * Wild Eights' room, on the platform's lobby room (src/platform/lobbyRoom.ts).
 * Seats, the host, invites, bots, quick rooms, starting and rematches are the
 * platform's. This file runs the game: turns, clocks, bots, and what each seat
 * may see (its own hand only; docs/games/wild_eights.md; methods in docs/PLATFORM.md).
 *
 * Room methods (on the room socket, after the start):
 *   wildeights:getState                   the room as this seat sees it
 *   wildeights:play     {card, suit?}     play a card (an 8 names a suit)
 *   wildeights:draw                       draw (one card, or what a 2 left you owing)
 *   wildeights:pass                       keep the card you drew and end your turn
 *   wildeights:forfeit                    give up
 * Every change goes out as `wildeights:update` {view, events}, each seat's events redacted
 * (someone else's drawn cards show only as a count).
 */
import { LobbyRoom, type LobbyRoomOptions, type LobbyRules, type Seat } from "../../platform/lobbyRoom.js";
import type { PeerLike } from "../../platform/peer.js";
import { EightsGame, SUITS, type EightsEvent, type RandomSource, type Result, type Suit } from "./engine.js";
import { chooseMove, type BotLevel } from "./bot.js";

export const GAME_ID = "wild_eights";

export type BotStyle = "relaxed" | "sharp";
/** Players see the style as "Bot difficulty": Medium plays relaxed, Hard plays sharp (as in Ploto's other games). */
export const BOT_LEVEL: Record<BotStyle, BotLevel> = { relaxed: "medium", sharp: "hard" };

export interface EightsSettings {
  readonly seats: number;
  readonly timer: boolean;
  readonly botStyle: BotStyle;
  readonly bots: boolean;
}

export const DEFAULT_SETTINGS: EightsSettings = { seats: 4, timer: true, botStyle: "relaxed", bots: true };

export function parseSettings(raw: unknown, base: EightsSettings = DEFAULT_SETTINGS): EightsSettings {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    seats: d["seats"] === 2 || d["seats"] === 3 || d["seats"] === 4 ? d["seats"] : base.seats,
    timer: typeof d["timer"] === "boolean" ? d["timer"] : base.timer,
    botStyle: d["botStyle"] === "relaxed" || d["botStyle"] === "sharp" ? d["botStyle"] : base.botStyle,
    bots: typeof d["bots"] === "boolean" ? d["bots"] : base.bots,
  };
}

/** The host starts it (quick rooms start on their countdown); bots fill empty seats when the settings say so. */
const RULES: LobbyRules = { start: "host", minPlayers: 2, bots: true };

export interface EightsTiming {
  readonly turnMs: number;
  readonly awayMs: number;
  /** How long a leaver's (or a disconnected player's) turn waits before the clock plays it. */
  readonly goneMs: number;
  readonly botMs: readonly [number, number];
  readonly quickStartMs: number;
  readonly animScale: number;
}
export const DEFAULT_TIMING: EightsTiming = { turnMs: 20_000, awayMs: 30_000, goneMs: 1500, botMs: [700, 1500], quickStartMs: 20_000, animScale: 1 };

/** The page's timings (EIGHTS_ART.ANIM in web/wild-eights.card.js); test/wild_eights.test.ts checks they agree. */
export const ANIM = { deal: 90, play: 320, wild: 900, draw: 260, skip: 500, owed: 600, turn: 180, last: 500, win: 1400 } as const;

export function animBudget(events: readonly EightsEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.type === "deal") ms += ANIM.deal * e.counts.reduce((a, b) => a + b, 0) + 400;
    else if (e.type === "play") ms += ANIM.play + (e.suit ? ANIM.wild : 0) + 60;
    else if (e.type === "draw") ms += ANIM.draw * Math.min(e.n, 6) + (e.forced ? ANIM.owed : 0) + 60;
    else if (e.type === "skip") ms += ANIM.skip;
    else if (e.type === "lastCard") ms += ANIM.last;
    else if (e.type === "turn") ms += ANIM.turn;
    else if (e.type === "over") ms += ANIM.win;
  }
  return ms;
}

export interface EightsRoomOptions extends LobbyRoomOptions<EightsSettings> {
  readonly timing?: Partial<EightsTiming>;
  readonly random?: RandomSource;
}

export class WildEightsRoom extends LobbyRoom<EightsSettings> {
  readonly gameId = GAME_ID;
  game: EightsGame | null = null;
  /** The room seat of each player in the game (seats can be empty when the host starts short). */
  order: number[] = [];
  private readonly timing: EightsTiming;
  private readonly random: RandomSource;
  private clock: { player: number; deadline: number; timer: ReturnType<typeof setTimeout> } | null = null;
  private animUntil = 0;
  /** Players who left mid-game (3–4 players): the clock plays their turns. */
  private readonly gone = new Set<number>();

  constructor(options: EightsRoomOptions) {
    const timing = { ...DEFAULT_TIMING, ...options.timing };
    const { formingMs: _forming, ...rest } = options;
    super(options.mode === "quick" ? { ...rest, formingMs: timing.quickStartMs } : rest, RULES);
    this.timing = timing;
    this.random = options.random ?? Math.random;
  }

  // ------------------------------------------------------------ the lobby's hooks

  protected capacity(settings: EightsSettings): number { return settings.seats; }
  protected emptySeat(): Seat { return { kind: "empty", peerId: null, accountId: null, name: "", inviteId: null, data: null }; }
  protected fillsWithBots(settings: EightsSettings): boolean { return settings.bots; }
  protected parseSettings(raw: unknown, base: EightsSettings): EightsSettings { return parseSettings(raw, base); }
  protected override onChange(): void { this.broadcast([]); }

  /** Leaving mid-game: with two players it's a forfeit; with more, the clock plays your turns. */
  protected override leaveDuringGame(seat: number): void {
    const p = this.order.indexOf(seat);
    if (p < 0 || !this.game || this.game.phase === "over") return;
    if (this.order.filter((s, i) => i !== p && !this.gone.has(i)).length <= 1) return this.concede(p);
    this.gone.add(p);
    this.game.out.add(p); // placed after everyone still playing
    this.rearm();
    this.broadcast([]);
  }

  override join(peer: PeerLike): boolean { const ok = super.join(peer); this.rearm(); return ok; }
  override leave(peer: PeerLike): void { super.leave(peer); this.rearm(); }
  override dispose(): void { this.clearClock(); super.dispose(); }

  protected startGame(): void {
    this.order = this.seats.map((s, seat) => ({ s, seat })).filter(({ s }) => s.kind === "player" || s.kind === "bot").map(({ seat }) => seat);
    this.gone.clear();
    const game = (this.game = new EightsGame({ players: this.order.length, random: this.random }));
    this.after(game.openingEvents());
  }

  protected gameRequest(seat: number, method: string, d: Record<string, unknown>): unknown {
    const p = this.order.indexOf(seat);
    switch (method) {
      case "wildeights:getState":
        return this.viewFor(seat);
      case "wildeights:play": {
        const game = this.requireGame();
        if (p < 0) throw new Error("you're watching this game");
        const suit = SUITS.includes(d["suit"] as Suit) ? (d["suit"] as Suit) : undefined;
        return this.apply(game.play(p, String(d["card"] ?? ""), suit));
      }
      case "wildeights:draw":
        if (p < 0) throw new Error("you're watching this game");
        return this.apply(this.requireGame().draw(p));
      case "wildeights:pass":
        if (p < 0) throw new Error("you're watching this game");
        return this.apply(this.requireGame().pass(p));
      case "wildeights:forfeit":
        if (this.phase !== "playing" || p < 0) throw new Error("the game isn't on");
        this.leaveDuringGame(seat); // two players: a forfeit; more: you're out, placed last, and the others play on
        return { ok: true };
      default:
        throw new Error(`unknown method: ${method}`);
    }
  }

  // ------------------------------------------------------------ the game

  private apply(r: Result): { ok: true } {
    if (!r.ok) throw new Error(r.reason);
    this.after(r.events);
    return { ok: true };
  }

  private concede(p: number): void {
    const game = this.game;
    if (!game || game.phase === "over") return;
    const r = game.concede(p);
    if (r.ok) this.after(r.events);
  }

  private after(events: readonly EightsEvent[]): void {
    const game = this.requireGame();
    this.animUntil = Date.now() + animBudget(events) * this.timing.animScale;
    this.clearClock();
    if (game.phase !== "over") this.arm();
    this.broadcast(events);
    if (game.phase === "over") this.finish();
  }

  private arm(): void {
    const game = this.game;
    if (!game || this.phase !== "playing" || this.clock || game.phase !== "playing" || game.turn === null) return;
    const p = game.turn, seat = this.order[p]!, wait = Math.max(0, this.animUntil - Date.now());
    if (this.seats[seat]!.kind === "bot") {
      const [lo, hi] = this.timing.botMs;
      this.setClock(p, wait + lo + this.random() * (hi - lo), () => this.botMove(p), false);
      return;
    }
    if (this.gone.has(p)) { this.setClock(p, wait + this.timing.goneMs, () => this.autoMove(p), false); return; }
    const ms = !this.connected(seat) ? this.timing.awayMs : this.settings.timer ? this.timing.turnMs : 0;
    if (ms) this.setClock(p, wait + ms, () => this.autoMove(p));
  }

  private rearm(): void {
    if (this.phase !== "playing" || !this.game) return;
    const shown = this.clock?.deadline ?? null;
    if (this.clock && this.seats[this.order[this.clock.player]!]!.kind === "bot") return;
    this.clearClock();
    this.arm();
    if ((this.clock?.deadline ?? null) !== shown) this.broadcast([]);
  }

  private botMove(p: number): void {
    const game = this.game;
    if (!game || game.turn !== p) return;
    const m = chooseMove(game.viewFor(p), BOT_LEVEL[this.settings.botStyle], this.random);
    const r = m.action === "play" ? game.play(p, m.card, m.suit) : m.action === "draw" ? game.draw(p) : game.pass(p);
    if (r.ok) this.after(r.events);
    else { const a = game.autoMove(p); if (a.ok) this.after(a.events); }
  }

  private autoMove(p: number): void {
    const game = this.game;
    if (!game || game.turn !== p) return;
    const r = game.autoMove(p);
    if (r.ok) this.after(r.events);
  }

  private connected(seat: number): boolean {
    const s = this.seats[seat]!;
    return s.kind === "bot" || this.peers.has(s.peerId ?? "");
  }

  // ------------------------------------------------------------ results and views

  results(): { seat: number; name: string; accountId: string | null; isBot: boolean; place: number; left: number; points: number; played: number; eights: number }[] {
    const game = this.requireGame();
    const places = game.places();
    return this.order
      .map((seat, p) => {
        const s = this.seats[seat]!;
        return { seat, name: s.name, accountId: s.accountId, isBot: s.kind === "bot", place: places[p]!, left: game.hands[p]!.length, points: game.handPoints(p), played: game.stats[p]!.played, eights: game.stats[p]!.eights };
      })
      .sort((a, b) => a.place - b.place);
  }

  /** What `seat` sees: its own hand, everyone's counts, the pile; seats in room order. */
  viewFor(seat: number): Record<string, unknown> {
    const game = this.game, p = this.order.indexOf(seat);
    return {
      ...this.lobbyView(seat),
      game: game ? { ...game.viewFor(Math.max(0, p)), you: p, ...(p < 0 ? { hand: [], drawn: null } : {}) } : null,
      order: this.order,
      gone: [...this.gone],
      clock: this.clock?.deadline ? { seat: this.order[this.clock.player], deadline: this.clock.deadline } : null,
      results: this.phase === "over" && game ? this.results() : null,
    };
  }

  /** Each seat's events: someone else's drawn cards are only a count. */
  private redact(events: readonly EightsEvent[], p: number): EightsEvent[] {
    return events.map((e) => {
      if (e.type !== "draw" || e.by === p) return e;
      const { cards: _hidden, ...rest } = e;
      return rest;
    });
  }

  private broadcast(events: readonly EightsEvent[]): void {
    if (this.disposed) return;
    for (const [peerId, peer] of this.peers) {
      const seat = this.seatOfPeer(peerId);
      if (seat >= 0) peer.notify("wildeights:update", { view: this.viewFor(seat), events: this.redact(events, this.order.indexOf(seat)) });
    }
  }

  private requireGame(): EightsGame {
    if (!this.game) throw new Error("the game hasn't started yet");
    return this.game;
  }
  private setClock(player: number, ms: number, fn: () => void, shown = true): void {
    const timer = setTimeout(() => { this.clock = null; fn(); }, ms);
    timer.unref?.();
    this.clock = { player, deadline: shown ? Date.now() + ms : 0, timer };
  }
  private clearClock(): void {
    if (this.clock) clearTimeout(this.clock.timer);
    this.clock = null;
  }
}
