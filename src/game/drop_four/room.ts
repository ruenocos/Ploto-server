/**
 * Drop Four's room, on the platform's lobby room (src/platform/lobbyRoom.ts).
 * Seats, the host, invites, bots, quick rooms, starting and rematches are the
 * platform's. This file runs the game: turns, clocks, bots, the views
 * (docs/games/drop_four.md; methods in docs/PLATFORM.md).
 *
 * Room methods (on the room socket, after the start):
 *   dropfour:getState                   the room as this seat sees it
 *   dropfour:drop      {col, bomb?}     drop a disc (or your bomb) into a column (your turn)
 *   dropfour:forfeit                    give up: the rival wins
 * Every change goes out as `dropfour:update` {view, events}.
 */
import { LobbyRoom, type LobbyRoomOptions, type LobbyRules, type Seat } from "../../platform/lobbyRoom.js";
import type { PeerLike } from "../../platform/peer.js";
import { DropFourGame, type DropEvent, type RandomSource } from "./engine.js";
import { chooseMove, type BotLevel } from "./bot.js";

export const GAME_ID = "drop_four";

export type BotStyle = "relaxed" | "sharp";
/** Players see the style as "Bot difficulty": Medium plays relaxed, Hard plays sharp (as in Hold'em and Sea Battle). */
export const BOT_LEVEL: Record<BotStyle, BotLevel> = { relaxed: "medium", sharp: "hard" };

export interface DropSettings {
  /** One bomb each per game. */
  readonly bombs: boolean;
  /** 15 s a move; off: no clock (except for a disconnected player). */
  readonly timer: boolean;
  readonly botStyle: BotStyle;
  /** An open seat becomes a bot at the start (quick and practice rooms; a host adds one by hand). */
  readonly bots: boolean;
  /** Set by the server when a game ends: who drops first in the rematch (the loser; after a draw, the one who went second). */
  readonly opener?: string;
}

export const DEFAULT_SETTINGS: DropSettings = { bombs: true, timer: true, botStyle: "relaxed", bots: false };

/** Clamp what a client sent to what the game offers (unknown values keep `base`). */
export function parseSettings(raw: unknown, base: DropSettings = DEFAULT_SETTINGS): DropSettings {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    bombs: typeof d["bombs"] === "boolean" ? d["bombs"] : base.bombs,
    timer: typeof d["timer"] === "boolean" ? d["timer"] : base.timer,
    botStyle: d["botStyle"] === "relaxed" || d["botStyle"] === "sharp" ? d["botStyle"] : base.botStyle,
    bots: base.bots, // decided by the kind of room, not by the client
    ...(base.opener ? { opener: base.opener } : {}), // set by the server only
  };
}

/** 1v1: it starts as soon as both seats are taken; whoever comes first (code or invite) plays. */
const RULES: LobbyRules = { start: "full", minPlayers: 2, bots: true, invitesHoldSeats: false };

export interface DropTiming {
  readonly turnMs: number;
  /** A disconnected player's clock (any timer setting). */
  readonly awayMs: number;
  /** A bot's thinking (longer when the grid is busy). */
  readonly botMs: readonly [number, number];
  readonly quickStartMs: number;
  /** Scale on the time given to clients to animate events (0 in tests). */
  readonly animScale: number;
}

export const DEFAULT_TIMING: DropTiming = { turnMs: 15_000, awayMs: 30_000, botMs: [700, 1500], quickStartMs: 20_000, animScale: 1 };

/** The page's timings (DROP_ART.ANIM in web/drop-four.card.js); test/drop_four.test.ts checks they agree. */
export const ANIM = { coin: 1700, hover: 220, fallPerRow: 45, land: 160, fuse: 360, blast: 420, fallAfter: 300, lineStep: 120, lineHold: 700, turn: 160 } as const;

/** How long the page takes to play these events, in ms, with some room to spare. */
export function animBudget(events: readonly DropEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.type === "start") ms += ANIM.coin + 300;
    else if (e.type === "drop") ms += ANIM.hover + ANIM.fallPerRow * (7 - e.row) + ANIM.land + (e.bomb ? ANIM.fuse : 0) + (e.ponder !== undefined ? 2 * ANIM.hover : 0) + 60;
    else if (e.type === "blast") ms += ANIM.blast + (e.falls.length ? ANIM.fallAfter : 0) + 100;
    else if (e.type === "over") ms += e.line ? ANIM.lineStep * e.line.length + ANIM.lineHold : 300;
    else if (e.type === "turn") ms += ANIM.turn + 40;
  }
  return ms;
}

export interface DropRoomOptions extends LobbyRoomOptions<DropSettings> {
  readonly timing?: Partial<DropTiming>;
  readonly random?: RandomSource;
}

export class DropFourRoom extends LobbyRoom<DropSettings> {
  readonly gameId = GAME_ID;
  game: DropFourGame | null = null;
  private readonly timing: DropTiming;
  private readonly random: RandomSource;
  private clock: { seat: number; deadline: number; timer: ReturnType<typeof setTimeout> } | null = null;
  /** Clock and bots wait this long for the last events' animation. */
  private animUntil = 0;

  constructor(options: DropRoomOptions) {
    const timing = { ...DEFAULT_TIMING, ...options.timing };
    const { formingMs: _forming, ...rest } = options;
    super(options.mode === "quick" ? { ...rest, formingMs: timing.quickStartMs } : rest, RULES);
    this.timing = timing;
    this.random = options.random ?? Math.random;
  }

  // ------------------------------------------------------------ the lobby's hooks

  protected capacity(): number {
    return 2;
  }

  protected emptySeat(): Seat {
    return { kind: "empty", peerId: null, accountId: null, name: "", inviteId: null, data: null };
  }

  protected fillsWithBots(settings: DropSettings): boolean {
    return settings.bots;
  }

  protected parseSettings(raw: unknown, base: DropSettings): DropSettings {
    return parseSettings(raw, base);
  }

  protected override onChange(): void {
    this.broadcast([]);
  }

  /** Leaving mid-game is a forfeit. */
  protected override leaveDuringGame(seat: number): void {
    this.concede(seat);
  }

  override join(peer: PeerLike): boolean {
    const ok = super.join(peer);
    this.rearm();
    return ok;
  }

  override leave(peer: PeerLike): void {
    super.leave(peer);
    this.rearm(); // a disconnected player gets the away clock
  }

  override dispose(): void {
    this.clearClock();
    super.dispose();
  }

  /** The platform filled the seats: the coin flip (or the rematch's opener) and the first turn. */
  protected startGame(): void {
    const opener = this.openerSeat();
    const game = (this.game = new DropFourGame({ random: this.random, bombs: this.settings.bombs, ...(opener >= 0 ? { first: opener } : {}) }));
    this.after([{ type: "start", first: game.first, ...(opener >= 0 ? { rematch: true } : {}) }, { type: "turn", seat: game.turn! }]);
  }

  protected gameRequest(seat: number, method: string, d: Record<string, unknown>): unknown {
    switch (method) {
      case "dropfour:getState":
        return this.viewFor(seat);
      case "dropfour:drop": {
        const game = this.requireGame();
        const r = game.drop(seat, Number(d["col"]), d["bomb"] === true);
        if (!r.ok) throw new Error(r.reason);
        this.after(r.events);
        return { ok: true };
      }
      case "dropfour:forfeit":
        if (this.phase !== "playing") throw new Error("the game isn't on");
        this.concede(seat);
        return { ok: true };
      default:
        throw new Error(`unknown method: ${method}`);
    }
  }

  // ------------------------------------------------------------ the game

  private concede(seat: number): void {
    const game = this.game;
    if (!game || game.phase === "over") return;
    const r = game.concede(seat);
    if (r.ok) this.after(r.events);
  }

  /**
   * The seat that opens a rematch, found by connection, then account, then by name only
   * when no one else shares it.
   */
  private openerSeat(): number {
    if (!this.settings.opener) return -1;
    const [peerId, accountId, name] = this.settings.opener.split("|");
    const by = (f: (s: Seat) => boolean) => { const i = this.seats.findIndex(f); return i >= 0 && this.seats.filter(f).length === 1 ? i : -1; };
    const i = peerId ? by((s) => s.peerId === peerId) : -1;
    if (i >= 0) return i;
    const j = accountId ? by((s) => s.accountId === accountId) : -1;
    return j >= 0 ? j : by((s) => s.name === name);
  }

  /** Send what happened, then line up what comes next (a clock, a bot's move, or the end). */
  private after(events: readonly DropEvent[]): void {
    const game = this.requireGame();
    this.animUntil = Date.now() + animBudget(events) * this.timing.animScale;
    this.clearClock();
    if (game.phase !== "over") this.arm(); // first, so the update carries the new clock
    else {
      // The rematch opens with the loser (after a draw, whoever went second).
      const opens = this.seats[game.winner === null ? 1 - game.first : 1 - game.winner];
      if (opens) this.settings = { ...this.settings, opener: [opens.peerId ?? "", opens.accountId ?? "", opens.name].join("|") };
    }
    this.broadcast(events);
    if (game.phase === "over") this.finish();
  }

  /** The turn's clock: a bot's think, the timer, or the away clock. */
  private arm(): void {
    const game = this.game;
    if (!game || this.phase !== "playing" || this.clock || game.phase !== "playing" || game.turn === null) return;
    const seat = game.turn, wait = Math.max(0, this.animUntil - Date.now());
    if (this.seats[seat]!.kind === "bot") {
      // A human rhythm: a quick first move, longer as the grid fills.
      const [lo, hi] = this.timing.botMs, busy = game.moves[0] + game.moves[1];
      const ms = (busy < 2 ? lo * 0.7 : lo + (hi - lo) * Math.min(1, busy / 20)) * (0.8 + 0.4 * this.random());
      this.setClock(seat, wait + ms, () => this.botMove(seat), false);
      return;
    }
    const ms = !this.connected(seat) ? this.timing.awayMs : this.settings.timer ? this.timing.turnMs : 0;
    if (ms) this.setClock(seat, wait + ms, () => this.autoDrop(seat));
  }

  /** Re-time the clock after someone connects or disconnects. */
  private rearm(): void {
    if (this.phase !== "playing" || !this.game) return;
    const shown = this.clock?.deadline ?? null;
    if (this.clock && this.seats[this.clock.seat]!.kind === "bot") return;
    this.clearClock();
    this.arm();
    if ((this.clock?.deadline ?? null) !== shown) this.broadcast([]);
  }

  private botMove(seat: number): void {
    const game = this.game;
    if (!game || game.turn !== seat) return;
    const m = chooseMove(game.viewFor(seat), BOT_LEVEL[this.settings.botStyle], this.random);
    // Now and then, once the grid is busy, its hand weighs a neighbouring column first (a person deciding).
    const busy = game.moves[0] + game.moves[1];
    const open = [m.col - 1, m.col + 1].filter((c) => c >= 0 && c < 7 && game.grid[c]![5] === 0);
    const ponder = busy > 6 && open.length && this.random() < 0.3 ? open[Math.floor(this.random() * open.length)] : undefined;
    const r = game.drop(seat, m.col, m.bomb);
    if (r.ok) this.after(ponder === undefined ? r.events : r.events.map((e, i) => (i === 0 && e.type === "drop" ? { ...e, ponder } : e)));
  }

  /** The clock ran out: a disc in a random open column for the player. */
  private autoDrop(seat: number): void {
    const game = this.game;
    if (!game || game.turn !== seat) return;
    const r = game.drop(seat, game.randomColumn(), false, true);
    if (r.ok) this.after(r.events);
  }

  private connected(seat: number): boolean {
    const s = this.seats[seat]!;
    return s.kind === "bot" || this.peers.has(s.peerId ?? "");
  }

  // ------------------------------------------------------------ results and views

  /** Places and stats, once it's over (a draw: both second). */
  results(): { seat: number; name: string; accountId: string | null; isBot: boolean; place: number; moves: number; longestLine: number; bombed: boolean; draw: boolean }[] {
    const game = this.requireGame();
    return [0, 1]
      .map((seat) => {
        const s = this.seats[seat]!;
        const longestLine = game.winner === seat && game.line ? game.line.length : 0;
        return { seat, name: s.name, accountId: s.accountId, isBot: s.kind === "bot", place: game.winner === seat ? 1 : 2, moves: game.moves[seat]!, longestLine, bombed: game.bombsOn && !game.bombs[seat], draw: game.draw };
      })
      .sort((a, b) => a.place - b.place);
  }

  viewFor(seat: number): Record<string, unknown> {
    const game = this.game;
    return {
      ...this.lobbyView(seat),
      game: game ? game.viewFor(seat) : null,
      clock: this.clock?.deadline ? { seat: this.clock.seat, deadline: this.clock.deadline } : null,
      results: this.phase === "over" && game ? this.results() : null,
    };
  }

  private broadcast(events: readonly DropEvent[]): void {
    if (this.disposed) return;
    for (const [peerId, peer] of this.peers) {
      const seat = this.seatOfPeer(peerId);
      if (seat >= 0) peer.notify("dropfour:update", { view: this.viewFor(seat), events });
    }
  }

  // ------------------------------------------------------------ helpers

  private requireGame(): DropFourGame {
    if (!this.game) throw new Error("the game hasn't started yet");
    return this.game;
  }

  /** `shown`: a clock players see (a bot's thinking isn't one; its deadline stays 0). */
  private setClock(seat: number, ms: number, fn: () => void, shown = true): void {
    const timer = setTimeout(() => {
      this.clock = null;
      fn();
    }, ms);
    timer.unref?.();
    this.clock = { seat, deadline: shown ? Date.now() + ms : 0, timer };
  }

  private clearClock(): void {
    if (this.clock) clearTimeout(this.clock.timer);
    this.clock = null;
  }
}
