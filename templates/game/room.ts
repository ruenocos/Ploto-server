/**
 * __TITLE__'s room, on the platform's lobby room (src/platform/lobbyRoom.ts).
 * Seats, the host, invites, bots in open seats, quick rooms, starting and
 * rematches are the platform's. This file is the game: its settings, what
 * starting means, its moves, and what each seat may see.
 *
 * TEMPLATE GAME: a tap race (first to `target` taps wins), so the scaffold runs
 * end to end on day one. Replace the rules with the real game; keep the shape.
 *
 * Room methods (on the room socket, after the start): `__PREFIX__getState`,
 * `__PREFIX__tap`. Every change goes out as `__PREFIX__update` {view}.
 */
import { LobbyRoom, type LobbyRoomOptions, type LobbyRules, type Seat } from "../../platform/lobbyRoom.js";

export const GAME_ID = "__ID__";

export interface __CLASS__Settings {
  readonly seats: number;
  readonly bots: boolean;
  readonly target: number;
}

export const DEFAULT_SETTINGS: __CLASS__Settings = { seats: 4, bots: true, target: 20 };

/** Clamp what a client sent to what the game offers (unknown values keep `base`). */
export function parseSettings(raw: unknown, base: __CLASS__Settings = DEFAULT_SETTINGS): __CLASS__Settings {
  const d = (raw ?? {}) as Record<string, unknown>;
  const seats = typeof d["seats"] === "number" ? Math.max(2, Math.min(4, Math.round(d["seats"]))) : base.seats;
  const bots = typeof d["bots"] === "boolean" ? d["bots"] : base.bots;
  const target = ([10, 20, 40] as const).find((t) => t === d["target"]) ?? base.target;
  return { seats, bots, target };
}

/** How the platform runs this game's lobby. */
const RULES: LobbyRules = { start: "host", minPlayers: 2, bots: true };

/** Bots tap this often (ms). */
const BOT_MS = 420;

export class __CLASS__Room extends LobbyRoom<__CLASS__Settings> {
  readonly gameId = GAME_ID;
  /** Taps per seat (the game state). */
  private taps: number[] = [];
  private winner: number | null = null;
  private botTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: LobbyRoomOptions<__CLASS__Settings>) {
    super(options, RULES);
  }

  // ------------------------------------------------------------ the lobby's hooks

  protected capacity(settings: __CLASS__Settings): number {
    return settings.seats;
  }

  protected emptySeat(): Seat {
    return { kind: "empty", peerId: null, accountId: null, name: "", inviteId: null, data: null };
  }

  protected fillsWithBots(settings: __CLASS__Settings): boolean {
    return settings.bots;
  }

  protected parseSettings(raw: unknown, base: __CLASS__Settings): __CLASS__Settings {
    return parseSettings(raw, base);
  }

  /** Every view change also reaches the game's own screen. */
  protected override onChange(): void {
    this.broadcast();
  }

  /** The platform filled the seats: the game begins. */
  protected startGame(): void {
    this.taps = this.seats.map(() => 0);
    this.botTimer = setInterval(() => {
      for (const [i, s] of this.seats.entries()) if (s.kind === "bot" && Math.random() < 0.7) this.tap(i);
    }, BOT_MS);
    this.botTimer.unref?.();
  }

  /** The game's own methods (the lobby's are lobby:*). */
  protected gameRequest(seat: number, method: string, _d: Record<string, unknown>): unknown {
    switch (method) {
      case "__PREFIX__getState":
        return this.viewFor(seat);
      case "__PREFIX__tap":
        if (this.phase !== "playing") throw new Error("the race hasn't started");
        this.tap(seat);
        return { ok: true };
      default:
        throw new Error(`unknown method: ${method}`);
    }
  }

  override dispose(): void {
    if (this.botTimer) clearInterval(this.botTimer);
    super.dispose();
  }

  // ------------------------------------------------------------ the game

  private tap(seat: number): void {
    if (this.phase !== "playing" || this.winner !== null) return;
    this.taps[seat] = (this.taps[seat] ?? 0) + 1;
    if (this.taps[seat]! >= this.settings.target) {
      this.winner = seat;
      if (this.botTimer) clearInterval(this.botTimer);
      this.finish(); // the platform records it (once) and offers the rematch
      return;
    }
    this.broadcast();
  }

  /** Final places, best first (for the result screen and the record). */
  results(): { seat: number; name: string; accountId: string | null; isBot: boolean; place: number; taps: number }[] {
    const order = this.seats.map((s, seat) => ({ s, seat, taps: this.taps[seat] ?? 0 })).filter((x) => x.s.kind === "player" || x.s.kind === "bot");
    order.sort((a, b) => b.taps - a.taps);
    return order.map((x, i) => ({ seat: x.seat, name: x.s.name, accountId: x.s.accountId, isBot: x.s.kind === "bot", place: i + 1, taps: x.taps }));
  }

  /** What `seat` sees. Redact anything a seat mustn't know here (hidden cards, picks…). */
  viewFor(seat: number): Record<string, unknown> {
    return {
      ...this.lobbyView(seat),
      taps: this.taps,
      target: this.settings.target,
      winner: this.winner,
      results: this.phase === "over" ? this.results() : null,
    };
  }

  private broadcast(): void {
    for (const [peerId, peer] of this.peers) {
      const seat = this.seatOfPeer(peerId);
      if (seat >= 0) peer.notify("__PREFIX__update", { view: this.viewFor(seat) });
    }
  }
}
