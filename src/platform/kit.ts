/**
 * The platform's lobby for one game (docs/PLATFORM.md): every game gets the
 * same lobby methods on the lobby socket, under its prefix:
 *
 *   <p>quick         {settings?, displayName, data?}  a seat in a quick room with these settings (one that's
 *                                                     filling up, or a new one)
 *   <p>host          {settings, displayName, data?}   a room you host, behind a code
 *   <p>practice      {settings?, displayName, data?}  you and bots, started as soon as you connect
 *   <p>info          {code}                           what a code leads to, before joining
 *   <p>join          {code, displayName, data?}       a seat in a room by its code
 *   <p>invite        {friendId, roomId}               hold a seat for an online friend and invite them
 *   <p>acceptInvite  {inviteId, displayName, data?}   take the seat an invite holds
 *
 * Every seat-taking call answers {roomId, code, seat}; the client then connects
 * to the room and follows its lobby (`lobby:*`, see lobbyRoom.ts). `data` is
 * what the game keeps per seat (e.g. Match Monsters' two picks); the game
 * checks it. Rematches come from the room (`lobby:rematch`) and land here.
 */
import { randomUUID } from "node:crypto";
import type { GameLobby, LobbyContext } from "./lobby.js";
import type { LobbyRoom, LobbyRoomOptions, RoomMode } from "./lobbyRoom.js";
import type { PeerLike } from "./peer.js";

/** What a game tells the kit. */
export interface GameDef<S, R extends LobbyRoom<S>> {
  readonly gameId: string;
  /** Lobby method prefix, e.g. "holdem:". */
  readonly prefix: string;
  /** Settings for a hosted room from what the client sent (throws for bad values). */
  hostSettings(raw: unknown): S;
  /** Settings for a quick room (the game decides what players may choose). */
  quickSettings(raw: unknown): S;
  /** Settings for practice. */
  practiceSettings(raw: unknown): S;
  /** Quick rooms with the same key fill up together. */
  quickKey(settings: S): string;
  /** How long a quick room waits for players once someone sits (unset: until it's full). */
  readonly formingMs?: number;
  /** A player's per-seat data for this room, checked (throws a readable reason when it's missing or wrong). */
  seatData?(raw: unknown, settings: S): unknown;
  /** The room itself. The kit registers it and handles codes, invites and rematches. */
  createRoom(options: LobbyRoomOptions<S>): R;
  /** What a code shows before joining, besides the host and free seats (e.g. whether you need to pick first). */
  info?(room: R): Record<string, unknown>;
  /** The invite card's line ("Hold'em table", "Match Monsters · Draft"). */
  inviteLabel(room: R): string;
  /** More for the invite card (e.g. the host's team), besides the code. */
  inviteExtra?(room: R): Record<string, unknown>;
  /** The rematch seat's data from the old room (e.g. the same two picks). */
  rematchData?(room: R, seat: number): unknown;
  /** A game ended: record it (results, the game's own history). */
  record?(room: R): void;
}

interface InviteData {
  readonly roomId: string;
  readonly code: string;
}

export class GameKit<S, R extends LobbyRoom<S>> implements GameLobby {
  readonly gameId: string;
  readonly prefix: string;
  private readonly rooms = new Map<string, R>(); // by code, while the room lives
  private readonly quick = new Map<string, R>(); // quick rooms filling up, by quick key

  constructor(
    private readonly ctx: LobbyContext,
    private readonly def: GameDef<S, R>,
  ) {
    this.gameId = def.gameId;
    this.prefix = def.prefix;
  }

  peerGone(): void {
    // Seats are kept: a player who drops can reconnect to their room until it's cleaned up.
  }

  /** A room by its code (the platform's cross-game lookup uses this too). */
  byCode(code: string): R | undefined {
    return this.rooms.get(code);
  }

  async handle(peer: PeerLike, method: string, data: unknown): Promise<unknown> {
    const { ctx, def } = this;
    const d = (data ?? {}) as Record<string, unknown>;
    const name = ctx.nameFor(peer, typeof d["displayName"] === "string" ? d["displayName"] : "Player");
    const accountId = ctx.accountOf(peer)?.id ?? null;
    const player = (room: R) => ({ peerId: peer.id, name, accountId, data: def.seatData ? def.seatData(d["data"], room.settings) : null });
    const seatIn = (room: R) => ({ roomId: room.roomId, code: room.code, seat: room.reserve(player(room)) });
    switch (method.slice(this.prefix.length)) {
      case "quick": {
        const settings = def.quickSettings(d["settings"]);
        const key = def.quickKey(settings);
        let room = this.quick.get(key);
        if (!room || room.phase !== "lobby" || room.freeSeats() === 0) {
          room = this.open("quick", settings, false);
          this.quick.set(key, room);
        }
        return seatIn(room);
      }

      case "host":
        return seatIn(this.open("private", def.hostSettings(d["settings"]), true));

      case "practice":
        return seatIn(this.open("practice", def.practiceSettings(d["settings"]), true, true));

      case "info": {
        const room = this.find(d["code"]);
        return {
          roomId: room.roomId,
          code: room.code,
          host: room.hostName(),
          settings: room.settings,
          seatsFree: room.freeSeats(),
          started: room.phase !== "lobby",
          ...(def.info?.(room) ?? {}),
        };
      }

      case "join":
        return seatIn(this.find(d["code"]));

      case "invite": {
        if (!ctx.accountOf(peer)) throw new Error("sign in to invite friends");
        const room = this.ownRoom(d["roomId"]);
        if (!room || room.seatOfPeer(peer.id) < 0) throw new Error("you're not in that room");
        const { me, friend } = await ctx.inviteTarget(peer, d["friendId"]);
        room.seatFor(friend.id); // check there's a seat before the friend hears about it
        let seatHeld = false;
        const inv = ctx.invites.create<InviteData>({
          gameId: def.gameId,
          label: def.inviteLabel(room),
          from: { id: me.id, username: me.username },
          to: friend.id,
          hostPeerId: peer.id,
          data: { roomId: room.roomId, code: room.code },
          extra: { code: room.code, ...(def.inviteExtra?.(room) ?? {}) },
          onEnd: (reason) => {
            if (seatHeld && reason !== "accepted") room.release(inv.id);
          },
        });
        try {
          room.holdFor(friend.id, friend.username, inv.id);
          seatHeld = true;
        } catch (err) {
          ctx.invites.drop(inv, "cancelled");
          throw err;
        }
        return { inviteId: inv.id };
      }

      case "acceptInvite": {
        const me = ctx.accountOf(peer);
        const inv = ctx.invites.get(d["inviteId"]);
        if (!me || !inv || inv.to !== me.id || inv.gameId !== def.gameId) throw new Error("that invite has expired");
        const room = this.find((inv.data as InviteData).code);
        const r = seatIn(room); // takes the seat held for this account
        ctx.invites.drop(inv, "accepted");
        return r;
      }

      default:
        throw new Error(`unknown lobby method: ${method}`);
    }
  }

  /** One of this game's live rooms, by room id. */
  private ownRoom(roomId: unknown): R | undefined {
    const live = this.ctx.getRoom(typeof roomId === "string" ? roomId : "") as R | undefined;
    return live && this.rooms.get(live.code) === live ? live : undefined;
  }

  private find(raw: unknown): R {
    const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    const room = this.rooms.get(code);
    if (!room) throw new Error("that code doesn't lead anywhere any more");
    return room;
  }

  /** Open a room and register it (it's cleaned up if nobody connects). */
  private open(mode: RoomMode, settings: S, hosted: boolean, autoStart = false): R {
    const roomId = randomUUID();
    const code = this.ctx.claimCode(this.gameId, roomId);
    const room = this.def.createRoom({
      roomId,
      code,
      mode,
      settings,
      hosted,
      autoStart,
      ...(mode === "quick" && this.def.formingMs !== undefined ? { formingMs: this.def.formingMs } : {}),
      onStarted: (r) => {
        // Seats still held by invites are gone now (bots or nobody): those invites end.
        for (const id of r.openInvites()) {
          const inv = this.ctx.invites.get(id);
          if (inv) this.ctx.invites.drop(inv, "cancelled");
        }
        for (const [key, q] of this.quick) if (q === (r as unknown)) this.quick.delete(key);
      },
      onFinished: (r) => this.def.record?.(r as R),
      onLeft: (r, peerId) => {
        for (const id of r.openInvites()) {
          const inv = this.ctx.invites.get(id);
          if (inv && inv.hostPeerId === peerId) this.ctx.invites.drop(inv, "cancelled");
        }
      },
      onInviteBumped: (id) => {
        const inv = this.ctx.invites.get(id);
        if (inv) this.ctx.invites.drop(inv, "cancelled");
      },
      onDisposed: (r) => {
        if (this.rooms.get(r.code) === (r as unknown)) this.rooms.delete(r.code);
        this.ctx.releaseCode(r.code);
        for (const [key, q] of this.quick) if (q === (r as unknown)) this.quick.delete(key);
      },
      onRematch: (r, peerId) => this.rematch(r as R, peerId),
    });
    this.rooms.set(code, room);
    this.ctx.addRoom(roomId, room);
    this.ctx.scheduleCleanup(roomId); // cancelled as soon as someone connects
    return room;
  }

  /**
   * A rematch: the first to ask opens a new room with the same settings (and
   * hosts it, even after a quick room); everyone after joins it. Practice deals
   * again straight away.
   */
  private rematch(old: R, peerId: string): { roomId: string; code: string } {
    const seat = old.seatOfPeer(peerId);
    const me = old.seated()[seat];
    if (!me) throw new Error("you don't have a seat here");
    let next = old.rematch ? this.rooms.get(old.rematch.code) : undefined;
    if (!next || next.phase !== "lobby") {
      const practice = old.mode === "practice";
      next = this.open(practice ? "practice" : "rematch", old.settings, true, practice);
    }
    next.reserve({ peerId, name: me.name, accountId: me.accountId, data: this.def.rematchData ? this.def.rematchData(old, seat) : me.data });
    return { roomId: next.roomId, code: next.code };
  }
}
