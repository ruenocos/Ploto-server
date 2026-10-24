/**
 * A game room's lobby, the same for every game (docs/PLATFORM.md): seats, who
 * hosts, invites holding seats, bots, the quick-room countdown, starting,
 * leaving and rematches. A game extends it with its own rules and the game
 * itself (`startGame`, its in-game methods and views).
 *
 * Players connect to the room's own socket as soon as they have a seat, see
 * the lobby through `lobby:update` notifications, and use the standard room
 * methods below; once the game starts, the game's own methods take over.
 *
 *   lobby:getView                    the lobby as this seat sees it
 *   lobby:start                      (host) start the game
 *   lobby:addBot / lobby:removeBot   (host, before the start) {seat}
 *   lobby:settings                   (host, before the start) {settings}
 *   lobby:leave                      before the start, free your seat; during the game, the game decides
 *   lobby:rematch                    (after the game) a new room with the same settings
 */
import { randomUUID } from "node:crypto";
import type { Room } from "./lobby.js";
import type { PeerLike } from "./peer.js";

export type SeatKind = "player" | "bot" | "empty" | "invited";
/** How the room came about: a quick match, a hosted (private) room, practice against bots, a rematch. */
export type RoomMode = "quick" | "private" | "practice" | "rematch";
export type RoomPhase = "lobby" | "playing" | "over";

export interface Seat {
  kind: SeatKind;
  peerId: string | null;
  accountId: string | null;
  name: string;
  /** The invite holding this seat (kind "invited"). */
  inviteId: string | null;
  /** What the game keeps from the player's join (e.g. Match Monsters' two picks). */
  data: unknown;
}

/** Someone taking a seat. */
export interface Player {
  readonly peerId: string;
  readonly name: string;
  readonly accountId: string | null;
  readonly data?: unknown;
}

/** How a game's lobby behaves. */
export interface LobbyRules {
  /** "host": the host starts it (quick rooms start on their countdown); "full": it starts as soon as every seat is taken. */
  readonly start: "host" | "full";
  readonly minPlayers: number;
  /** Seats can be bots (the host adds them; practice and quick rooms fill with them when the settings allow). */
  readonly bots: boolean;
}

export interface LobbyRoomOptions<S> {
  readonly roomId: string;
  readonly code: string;
  readonly mode: RoomMode;
  readonly settings: S;
  /** Hosted rooms have a host (the first to sit); quick rooms start themselves. */
  readonly hosted: boolean;
  /** Start the moment the first player connects (practice). */
  readonly autoStart?: boolean;
  /** Quick rooms: start this long after the first player sits (bots fill in, if the game has them). Unset: wait until full. */
  readonly formingMs?: number;
  readonly onStarted?: (room: LobbyRoom<S>) => void;
  readonly onFinished?: (room: LobbyRoom<S>) => void;
  readonly onDisposed?: (room: LobbyRoom<S>) => void;
  /** The platform opens (or finds) the rematch room and seats this peer there. */
  readonly onRematch?: (room: LobbyRoom<S>, peerId: string) => { roomId: string; code: string };
}

const BOT_NAMES = ["Ace", "Lu", "Dot", "Bix", "Pip", "Rook", "Kit", "Moss"];

export abstract class LobbyRoom<S, T extends Seat = Seat> implements Room {
  abstract readonly gameId: string;
  readonly roomId: string;
  readonly code: string;
  readonly mode: RoomMode;
  readonly hosted: boolean;
  settings: S;
  phase: RoomPhase = "lobby";
  /** The host's seat (hosted rooms), or -1. */
  hostSeat = -1;
  /** When a quick room will start (epoch ms), once someone sits. */
  startsAt: number | null = null;
  /** The rematch room, once someone asked for one, and who has joined it so far. */
  rematch: { roomId: string; code: string; players: string[] } | null = null;
  startedAt: Date | null = null;

  protected seats: T[];
  protected readonly peers = new Map<string, PeerLike>();
  private formingTimer: ReturnType<typeof setTimeout> | null = null;
  private finishedReported = false;
  protected disposed = false;

  constructor(
    protected readonly opts: LobbyRoomOptions<S>,
    protected readonly rules: LobbyRules,
  ) {
    this.roomId = opts.roomId;
    this.code = opts.code;
    this.mode = opts.mode;
    this.hosted = opts.hosted;
    this.settings = opts.settings;
    this.seats = Array.from({ length: this.capacity(opts.settings) }, () => this.emptySeat());
  }

  // ------------------------------------------------------------ what the game provides

  /** Seats for these settings. */
  protected abstract capacity(settings: S): number;
  /** A fresh empty seat (with the game's own per-seat fields, if any). */
  protected abstract emptySeat(): T;
  /** Whether open seats get bots when the game starts. */
  protected abstract fillsWithBots(settings: S): boolean;
  /** Settings changed by the host, on top of the current ones (throws for bad values). */
  protected abstract parseSettings(raw: unknown, base: S): S;
  /** The game begins: seats are final, the phase is "playing". */
  protected abstract startGame(): void;
  /** A request the lobby doesn't handle (the game's own methods, any phase). */
  protected abstract gameRequest(seat: number, method: string, data: Record<string, unknown>): unknown;
  /** Something about the lobby changed: send the game's own view too, if it has one. */
  protected onChange(): void {}
  /** A seated player left during the game (sit out, forfeit…). */
  protected leaveDuringGame(_seat: number): void {}

  // ------------------------------------------------------------ seats

  /** Seat a player (or find their seat). Throws a readable reason when the room is full or started. */
  reserve(p: Player): number {
    const mine = this.seats.findIndex((s) => s.peerId === p.peerId);
    if (mine >= 0) return mine;
    if (this.phase !== "lobby") throw new Error("this game has already started");
    // An invited player takes the seat held for them; anyone else the first free seat, or a bot's (people beat bots).
    let seat = p.accountId ? this.seats.findIndex((s) => s.kind === "invited" && s.accountId === p.accountId) : -1;
    if (seat < 0) seat = this.seats.findIndex((s) => s.kind === "empty");
    if (seat < 0) seat = this.seats.map((s) => s.kind).lastIndexOf("bot");
    if (seat < 0) throw new Error("this room is full");
    this.seats[seat] = { ...this.emptySeat(), kind: "player", peerId: p.peerId, accountId: p.accountId, name: cleanName(p.name), data: p.data ?? null };
    if (this.hosted && this.hostSeat < 0) this.hostSeat = seat;
    if (this.opts.formingMs !== undefined && !this.formingTimer && this.startsAt === null) this.armForming();
    this.changed();
    if ((this.rules.start === "full" || this.mode === "quick") && this.openSeats() === 0) this.tryStart();
    return seat;
  }

  /** Hold a free seat for an invited friend. Returns the seat, or throws when there's none. */
  holdFor(accountId: string, name: string, inviteId: string): number {
    const seat = this.seatFor(accountId);
    this.seats[seat] = { ...this.emptySeat(), kind: "invited", accountId, name: cleanName(name), inviteId };
    this.changed();
    return seat;
  }

  /** The seat an invite for this account would hold; throws a readable reason when there's none. */
  seatFor(accountId: string): number {
    if (this.phase !== "lobby") throw new Error("this game has already started");
    if (this.seats.some((s) => s.accountId === accountId && (s.kind === "player" || s.kind === "invited"))) throw new Error("they already have a seat here");
    const seat = this.seats.findIndex((s) => s.kind === "empty");
    if (seat < 0) throw new Error("there's no free seat for them");
    return seat;
  }

  /** An invite ended without the friend sitting down: free its seat. */
  release(inviteId: string): void {
    const seat = this.seats.findIndex((s) => s.kind === "invited" && s.inviteId === inviteId);
    if (seat < 0 || this.phase !== "lobby") return;
    this.seats[seat] = this.emptySeat();
    this.changed();
  }

  /** Seats nobody has taken or been invited to. */
  freeSeats(): number {
    return this.seats.filter((s) => s.kind === "empty").length;
  }

  hostName(): string {
    return this.seats[this.hostSeat]?.name ?? "";
  }

  /** Who's seated, for invites, results and rematches. */
  seated(): { seat: number; kind: SeatKind; name: string; accountId: string | null; peerId: string | null; data: unknown }[] {
    return this.seats.map((s, seat) => ({ seat, kind: s.kind, name: s.name, accountId: s.accountId, peerId: s.peerId, data: s.data }));
  }

  /** Invite ids still holding seats (they end when the game starts). */
  openInvites(): string[] {
    return this.seats.filter((s) => s.kind === "invited" && s.inviteId).map((s) => s.inviteId!);
  }

  seatOfPeer(peerId: string): number {
    return this.seats.findIndex((s) => s.peerId === peerId);
  }

  // ------------------------------------------------------------ Room

  join(peer: PeerLike): boolean {
    const seat = this.seatOfPeer(peer.id);
    if (seat < 0) return false;
    this.peers.set(peer.id, peer);
    if (this.opts.autoStart && this.phase === "lobby") {
      if (!this.tryStart()) this.changed();
    } else this.changed();
    return true;
  }

  leave(peer: PeerLike): void {
    if (this.peers.get(peer.id) !== peer) return;
    this.peers.delete(peer.id);
    this.changed();
  }

  connectedCount(): number {
    return this.peers.size;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearForming();
    this.opts.onDisposed?.(this as unknown as LobbyRoom<S>);
  }

  handleRequest(peerId: string, method: string, data: unknown): unknown {
    const seat = this.seatOfPeer(peerId);
    if (seat < 0) throw new Error("you don't have a seat here");
    const d = (data ?? {}) as Record<string, unknown>;
    switch (method) {
      case "lobby:getView":
        return this.lobbyView(seat);

      case "lobby:start":
        this.requireHost(seat);
        this.start();
        return { ok: true };

      case "lobby:addBot": {
        this.requireHost(seat);
        if (!this.rules.bots) throw new Error("this game has no bots");
        const target = typeof d["seat"] === "number" ? d["seat"] : this.seats.findIndex((s) => s.kind === "empty");
        if (this.seats[target]?.kind !== "empty") throw new Error("that seat isn't free");
        this.seats[target] = { ...this.emptySeat(), kind: "bot", name: this.botName() };
        this.changed();
        return { ok: true };
      }

      case "lobby:removeBot": {
        this.requireHost(seat);
        const target = Number(d["seat"]);
        if (this.seats[target]?.kind !== "bot") throw new Error("that seat isn't a bot");
        this.seats[target] = this.emptySeat();
        this.changed();
        return { ok: true };
      }

      case "lobby:settings":
        this.requireHost(seat);
        this.applySettings(this.parseSettings(d["settings"], this.settings));
        return { ok: true };

      case "lobby:leave":
        this.leaveSeat(seat);
        return { ok: true };

      case "lobby:rematch": {
        if (this.phase !== "over") throw new Error("the game isn't over yet");
        if (!this.opts.onRematch) throw new Error("no rematches here");
        const r = this.opts.onRematch(this as unknown as LobbyRoom<S>, peerId);
        const name = this.seats[seat]!.name;
        if (!this.rematch || this.rematch.roomId !== r.roomId) this.rematch = { ...r, players: [] };
        if (!this.rematch.players.includes(name)) this.rematch.players.push(name);
        this.changed();
        return r;
      }

      default:
        return this.gameRequest(seat, method, d);
    }
  }

  // ------------------------------------------------------------ starting and ending

  /** Start the game: open seats get bots (when the settings allow), then the game begins. */
  start(): void {
    if (this.phase !== "lobby") throw new Error("the game has already started");
    const fill = this.rules.bots && this.fillsWithBots(this.settings);
    const seats = this.seats.map((s) => (s.kind === "empty" || s.kind === "invited" ? (fill ? { ...this.emptySeat(), kind: "bot" as const, name: this.botName() } : this.emptySeat()) : s));
    const playing = seats.filter((s) => s.kind === "player" || s.kind === "bot").length;
    if (playing < this.rules.minPlayers) throw new Error(this.rules.bots ? "you need at least 2 players: invite someone or add a bot" : "waiting for another player");
    // Bot names are only final once every seat is decided.
    this.seats = seats;
    this.clearForming();
    this.startsAt = null;
    this.phase = "playing";
    this.startedAt = new Date();
    this.opts.onStarted?.(this as unknown as LobbyRoom<S>);
    this.startGame();
    this.changed();
  }

  /** Start if the rules allow it now; false (and nothing changes) if not. */
  protected tryStart(): boolean {
    try {
      this.start();
      return true;
    } catch {
      return false;
    }
  }

  /** The game is over: record it (once) and tell everyone. */
  protected finish(): void {
    if (this.phase === "over") return;
    this.phase = "over";
    this.changed();
    if (!this.finishedReported) {
      this.finishedReported = true;
      this.opts.onFinished?.(this as unknown as LobbyRoom<S>);
    }
  }

  // ------------------------------------------------------------ the lobby view

  /** The room as one seat sees it (the LobbyView in docs/PLATFORM.md). */
  lobbyView(seat: number | null): Record<string, unknown> {
    return {
      roomId: this.roomId,
      code: this.code,
      gameId: this.gameId,
      mode: this.mode,
      phase: this.phase,
      you: seat,
      host: this.hostSeat,
      settings: this.settings,
      startsAt: this.startsAt,
      minPlayers: this.rules.minPlayers,
      /** The host can add bots. */
      bots: this.rules.bots,
      /** Open seats become bots at the start. */
      fillsWithBots: this.rules.bots && this.fillsWithBots(this.settings),
      startRule: this.rules.start,
      seats: this.seats.map((s, i) => ({
        seat: i,
        kind: s.kind,
        name: s.name,
        connected: s.kind === "bot" || this.peers.has(s.peerId ?? ""),
        // The invite holding the seat, so whoever sent it can withdraw it (only its sender can).
        ...(s.kind === "invited" ? { inviteId: s.inviteId } : {}),
      })),
      rematch: this.rematch,
    };
  }

  /** Tell every connected player about the lobby (and let the game send its own view). */
  protected changed(): void {
    if (this.disposed) return;
    for (const [peerId, peer] of this.peers) {
      const seat = this.seatOfPeer(peerId);
      if (seat >= 0) peer.notify("lobby:update", { view: this.lobbyView(seat) });
    }
    this.onChange();
  }

  // ------------------------------------------------------------ helpers

  private openSeats(): number {
    return this.seats.filter((s) => s.kind === "empty" || s.kind === "invited").length;
  }

  private requireHost(seat: number): void {
    if (!this.hosted || seat !== this.hostSeat) throw new Error("only the host can do that");
    if (this.phase !== "lobby") throw new Error("the game has already started");
  }

  private applySettings(next: S): void {
    const size = this.capacity(next);
    const occupied = this.seats.filter((s) => s.kind !== "empty");
    if (occupied.length > size) throw new Error("free up some seats first");
    // Keep everyone seated, in order; the host keeps their seat number if it still exists.
    const seats: T[] = Array.from({ length: size }, () => this.emptySeat());
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
    this.changed();
  }

  private leaveSeat(seat: number): void {
    const s = this.seats[seat]!;
    if (this.phase === "lobby") {
      this.seats[seat] = this.emptySeat();
      // The next player hosts; a room with no players left is cleaned up when empty.
      if (seat === this.hostSeat) this.hostSeat = this.seats.findIndex((x) => x.kind === "player");
      if (s.peerId) this.peers.delete(s.peerId);
      if (!this.seats.some((x) => x.kind === "player")) {
        this.clearForming();
        this.startsAt = null;
      }
      this.changed();
      return;
    }
    if (this.phase === "playing") this.leaveDuringGame(seat);
  }

  private armForming(): void {
    const ms = this.opts.formingMs ?? 0;
    this.startsAt = Date.now() + ms;
    this.formingTimer = setTimeout(() => {
      this.formingTimer = null;
      if (this.phase !== "lobby") return;
      // Everyone left before the start: the next player to sit starts a fresh countdown.
      if (!this.seats.some((s) => s.kind === "player") || !this.tryStart()) {
        this.startsAt = null;
        this.changed();
      }
    }, ms);
    this.formingTimer.unref?.();
  }

  private clearForming(): void {
    if (this.formingTimer) clearTimeout(this.formingTimer);
    this.formingTimer = null;
  }

  protected botName(): string {
    const taken = new Set(this.seats.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !taken.has(`Bot ${n}`)) ?? randomUUID().slice(0, 4);
    return `Bot ${name}`;
  }
}

export const cleanName = (name: string): string => String(name || "").trim().slice(0, 16) || "Player";
