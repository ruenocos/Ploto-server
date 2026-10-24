/**
 * Sea Battle's room, on the platform's lobby room (src/platform/lobbyRoom.ts).
 * Seats, the host, invites, bots, quick rooms, starting and rematches are the
 * platform's. This file runs the game: placing, clocks, bots, what each seat
 * may see (docs/games/sea_battle.md; methods in docs/PLATFORM.md).
 *
 * Room methods (on the room socket, after the start):
 *   seabattle:getState                  the room as this seat sees it
 *   seabattle:draft    {fleet}          your fleet so far (the placing clock uses it)
 *   seabattle:ready    {fleet}          lock in your fleet
 *   seabattle:fire     {x, y}           fire at the rival's sea (your turn)
 *   seabattle:forfeit                   give up: the rival wins
 * Every change goes out as `seabattle:update` {view, events}.
 */
import { LobbyRoom, type LobbyRoomOptions, type LobbyRules, type Seat } from "../../platform/lobbyRoom.js";
import type { PeerLike } from "../../platform/peer.js";
import { BOARDS, SeaBattleGame, fleetProblem, randomFleet, type BoardKind, type Fleet, type RandomSource, type SeaEvent } from "./engine.js";
import { chooseShot, type BotLevel } from "./bot.js";

export const GAME_ID = "sea_battle";

export type BotStyle = "relaxed" | "sharp";
/** Players see the style as "Bot difficulty": Medium plays relaxed, Hard plays sharp (as in Hold'em). */
export const BOT_LEVEL: Record<BotStyle, BotLevel> = { relaxed: "medium", sharp: "hard" };

export interface SeaSettings {
  /** Classic 10×10 with five ships, or Quick 8×8 with four. */
  readonly board: BoardKind;
  /** 20 s a shot and 60 s to place; off: no clock (except for a disconnected player). */
  readonly timer: boolean;
  readonly botStyle: BotStyle;
  /** An open seat becomes a bot at the start (quick and practice rooms; a host adds one by hand). */
  readonly bots: boolean;
}

export const DEFAULT_SETTINGS: SeaSettings = { board: "classic", timer: true, botStyle: "relaxed", bots: false };

/** Clamp what a client sent to what the game offers (unknown values keep `base`). */
export function parseSettings(raw: unknown, base: SeaSettings = DEFAULT_SETTINGS): SeaSettings {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    board: d["board"] === "classic" || d["board"] === "quick" ? d["board"] : base.board,
    timer: typeof d["timer"] === "boolean" ? d["timer"] : base.timer,
    botStyle: d["botStyle"] === "relaxed" || d["botStyle"] === "sharp" ? d["botStyle"] : base.botStyle,
    bots: base.bots, // decided by the kind of room, not by the client
  };
}

/** 1v1: it starts as soon as both seats are taken; whoever comes first (code or invite) plays. */
const RULES: LobbyRules = { start: "full", minPlayers: 2, bots: true, invitesHoldSeats: false };

export interface SeaTiming {
  readonly placeMs: number;
  readonly turnMs: number;
  /** A disconnected player's clock (any timer setting). */
  readonly awayMs: number;
  readonly botMs: readonly [number, number];
  readonly botPlaceMs: readonly [number, number];
  readonly quickStartMs: number;
  /** Scale on the time given to clients to animate events (0 in tests). */
  readonly animScale: number;
}

export const DEFAULT_TIMING: SeaTiming = {
  placeMs: 60_000,
  turnMs: 20_000,
  awayMs: 30_000,
  botMs: [650, 1400],
  botPlaceMs: [2500, 6000],
  quickStartMs: 20_000,
  animScale: 1,
};

export interface SeaRoomOptions extends LobbyRoomOptions<SeaSettings> {
  readonly timing?: Partial<SeaTiming>;
  readonly random?: RandomSource;
}

export class SeaBattleRoom extends LobbyRoom<SeaSettings> {
  readonly gameId = GAME_ID;
  game: SeaBattleGame | null = null;
  private readonly timing: SeaTiming;
  private readonly random: RandomSource;
  /** Each seat's fleet while placing (starts random, follows the player's drafts). */
  private readonly drafts: (Fleet | null)[] = [null, null];
  private clock: { seat: number | null; deadline: number; timer: ReturnType<typeof setTimeout> } | null = null;
  private readonly botTimers = new Set<ReturnType<typeof setTimeout>>();
  /** Clock and bots wait this long for the last events' animation. */
  private animUntil = 0;
  /** When placing ends with the timer on (one deadline for the whole phase). */
  private placeEnds = 0;

  constructor(options: SeaRoomOptions) {
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

  protected fillsWithBots(settings: SeaSettings): boolean {
    return settings.bots;
  }

  protected parseSettings(raw: unknown, base: SeaSettings): SeaSettings {
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
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();
    super.dispose();
  }

  /** The platform filled the seats: deal out random fleets, start placing. */
  protected startGame(): void {
    const game = (this.game = new SeaBattleGame({ board: this.settings.board, random: this.random }));
    this.placeEnds = Date.now() + this.timing.placeMs;
    for (const seat of [0, 1]) {
      this.drafts[seat] = randomFleet(game.spec, this.random);
      if (this.seats[seat]!.kind === "bot") {
        const [lo, hi] = this.timing.botPlaceMs;
        this.later(lo + this.random() * (hi - lo), () => this.lockIn(seat, this.drafts[seat]!));
      }
    }
    this.rearm();
  }

  protected gameRequest(seat: number, method: string, d: Record<string, unknown>): unknown {
    switch (method) {
      case "seabattle:getState":
        return this.viewFor(seat);
      case "seabattle:draft": {
        const game = this.requireGame();
        if (game.phase !== "placing" || game.sides[seat]!.ready) return { ok: true };
        const problem = fleetProblem(game.spec, d["fleet"]);
        if (problem) throw new Error(problem);
        this.drafts[seat] = d["fleet"] as Fleet;
        return { ok: true };
      }
      case "seabattle:ready":
        this.lockIn(seat, (d["fleet"] as Fleet | undefined) ?? this.drafts[seat]!, true);
        return { ok: true };
      case "seabattle:fire": {
        const game = this.requireGame();
        const r = game.fire(seat, Number(d["x"]), Number(d["y"]));
        if (!r.ok) throw new Error(r.reason);
        this.after(r.events);
        return { ok: true };
      }
      case "seabattle:forfeit":
        if (this.phase !== "playing") throw new Error("the game isn't on");
        this.concede(seat);
        return { ok: true };
      default:
        throw new Error(`unknown method: ${method}`);
    }
  }

  // ------------------------------------------------------------ the game

  private lockIn(seat: number, fleet: Fleet, strict = false): void {
    const game = this.requireGame();
    if (game.phase !== "placing" || game.sides[seat]!.ready) {
      if (strict) throw new Error("the fleets are already placed");
      return;
    }
    const r = game.ready(seat, fleet);
    if (!r.ok) {
      if (strict) throw new Error(r.reason);
      return void this.lockIn(seat, randomFleet(game.spec, this.random)); // a stale draft: any legal fleet will do
    }
    this.after(r.events);
  }

  private concede(seat: number): void {
    const game = this.game;
    if (!game || game.phase === "over") return;
    const r = game.concede(seat);
    if (r.ok) this.after(r.events);
  }

  /** Send what happened, then line up what comes next (a clock, a bot's move, or the end). */
  private after(events: readonly SeaEvent[]): void {
    this.animUntil = Date.now() + this.animMs(events);
    this.clearClock();
    if (this.game?.phase !== "over") this.arm(); // first, so the update carries the new clock
    this.broadcast(events);
    if (this.game?.phase === "over") this.finish();
  }

  /** Start the right clock (and the bots) for the current phase. */
  private arm(): void {
    const game = this.game;
    if (!game || this.phase !== "playing" || this.clock) return;
    const wait = Math.max(0, this.animUntil - Date.now());
    if (game.phase === "placing") {
      // One clock for placing: the timer's, or the away clock for anyone disconnected.
      const humans = [0, 1].filter((s) => this.seats[s]!.kind === "player" && !game.sides[s]!.ready);
      if (!humans.length) return;
      const away = humans.some((s) => !this.connected(s));
      const ms = this.settings.timer ? Math.max(0, this.placeEnds - Date.now()) : away ? this.timing.awayMs : 0;
      if (!ms && !this.settings.timer) return;
      this.setClock(null, ms, () => {
        for (const s of humans) if (this.settings.timer || !this.connected(s)) this.lockIn(s, this.drafts[s]!);
      });
      return;
    }
    if (game.phase !== "firing" || game.turn === null) return;
    const seat = game.turn;
    if (this.seats[seat]!.kind === "bot") {
      const [lo, hi] = this.timing.botMs;
      this.setClock(seat, wait + lo + this.random() * (hi - lo), () => this.botFire(seat), false);
      return;
    }
    const ms = !this.connected(seat) ? this.timing.awayMs : this.settings.timer ? this.timing.turnMs : 0;
    if (ms) this.setClock(seat, wait + ms, () => this.autoFire(seat));
  }

  /** Re-time the clock after someone connects or disconnects. */
  private rearm(): void {
    if (this.phase !== "playing" || !this.game) return;
    const shown = this.clock?.deadline ?? null;
    if (this.clock && this.clock.seat !== null && this.seats[this.clock.seat]!.kind === "bot") return;
    this.clearClock();
    this.arm();
    if ((this.clock?.deadline ?? null) !== shown) this.broadcast([]);
  }

  private botFire(seat: number): void {
    const game = this.game;
    if (!game || game.turn !== seat) return;
    const [x, y] = chooseShot(game.viewFor(seat), BOT_LEVEL[this.settings.botStyle], this.random);
    const r = game.fire(seat, x, y);
    if (r.ok) this.after(r.events);
  }

  /** The clock ran out: it fires at a random open cell for the player. */
  private autoFire(seat: number): void {
    const game = this.game;
    if (!game || game.turn !== seat) return;
    const [x, y] = game.randomTarget(seat);
    const r = game.fire(seat, x, y, true);
    if (r.ok) this.after(r.events);
  }

  private connected(seat: number): boolean {
    const s = this.seats[seat]!;
    return s.kind === "bot" || this.peers.has(s.peerId ?? "");
  }

  /** Rough time the client needs to animate these events, so clocks and bots wait for it. */
  private animMs(events: readonly SeaEvent[]): number {
    let ms = 0;
    for (const e of events) {
      if (e.type === "start") ms += 1800; // the coin flip
      else if (e.type === "shot") ms += e.result === "sunk" ? 2600 : e.result === "hit" ? 1250 : 1100;
      else if (e.type === "turn") ms += 700; // the seas swap
    }
    return ms * this.timing.animScale;
  }

  // ------------------------------------------------------------ results and views

  /** Places and stats, once it's over. */
  results(): { seat: number; name: string; accountId: string | null; isBot: boolean; place: number; shots: number; hits: number; sunk: number; bestStreak: number; accuracy: number }[] {
    const game = this.requireGame();
    return [0, 1]
      .map((seat) => {
        const s = this.seats[seat]!;
        const st = game.sides[seat]!.stats;
        return {
          seat,
          name: s.name,
          accountId: s.accountId,
          isBot: s.kind === "bot",
          place: game.winner === seat ? 1 : 2,
          shots: st.shots,
          hits: st.hits,
          sunk: st.sunk,
          bestStreak: st.bestStreak,
          accuracy: st.shots ? Math.round((100 * st.hits) / st.shots) : 0,
        };
      })
      .sort((a, b) => a.place - b.place);
  }

  /** What `seat` sees: the lobby, its own sea, and only what it has found out about the rival's. */
  viewFor(seat: number): Record<string, unknown> {
    const game = this.game;
    return {
      ...this.lobbyView(seat),
      game: game ? game.viewFor(seat) : null,
      /** Your fleet while placing (the server dealt it at random; drafts update it). */
      draft: game && game.phase === "placing" && !game.sides[seat]!.ready ? this.drafts[seat] : null,
      clock: this.clock?.deadline ? { seat: this.clock.seat, deadline: this.clock.deadline } : null,
      results: this.phase === "over" && game ? this.results() : null,
    };
  }

  private broadcast(events: readonly SeaEvent[]): void {
    if (this.disposed) return;
    for (const [peerId, peer] of this.peers) {
      const seat = this.seatOfPeer(peerId);
      if (seat >= 0) peer.notify("seabattle:update", { view: this.viewFor(seat), events });
    }
  }

  // ------------------------------------------------------------ helpers

  private requireGame(): SeaBattleGame {
    if (!this.game) throw new Error("the game hasn't started yet");
    return this.game;
  }

  /** `shown`: a clock players see (a bot's thinking isn't one; its deadline stays 0). */
  private setClock(seat: number | null, ms: number, fn: () => void, shown = true): void {
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

  private later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.botTimers.delete(t);
      if (!this.disposed) fn();
    }, ms);
    t.unref?.();
    this.botTimers.add(t);
  }
}
