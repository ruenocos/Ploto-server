/**
 * Signaling server: protoo-over-WebSocket front door.
 *
 * Two kinds of connection, distinguished by the `roomId` query parameter the
 * client opens with (`wss://host/?roomId=…&peerId=…`):
 *
 *   roomId === "lobby"  -> matchmaking. Methods: `mm:enqueue`, `mm:cancel`,
 *                          private rooms (`mm:createRoom`/`mm:joinRoom`),
 *                          `mm:practice` (a game against the built-in bot), and
 *                          for signed-in players `mm:auth` (presence) plus
 *                          friend invites (`mm:invite`, `mm:acceptInvite`,
 *                          `mm:declineInvite`, `mm:cancelInvite`). The lobby
 *                          socket stays open all session, so it also carries
 *                          `social:*` notifications (messages, presence, invites).
 *                          On a pair, both peers get an `mm:matched` notification
 *                          carrying the game roomId to reconnect to.
 *   roomId === <uuid>   -> an active game room. Requests are routed to the
 *                          corresponding GameRoom (`mm:getState`, `mm:move`).
 *
 * The voice/mediasoup methods (`join`, `createWebRtcTransport`, `produce`, …)
 * attach here too, on the game room connection, once the SFU is wired in.
 */
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { Matchmaker, type QueueKey, type Ticket } from "../matchmaking/pool.js";
import type { Account } from "../accounts/accounts.js";
import type { Services } from "../services.js";
import type { MatchMode } from "../stats/history.js";
import { GameRoom, type RoomOptions } from "./gameRoom.js";
import { Peer } from "./peer.js";
import { monsterById, MONSTERS } from "../game/matchmonsters/monsters.js";
import type { Monster } from "../game/matchmonsters/types.js";

const LOBBY = "lobby";
const PROTOO_SUBPROTOCOL = "protoo";
/** How long an empty room survives so players can reload/reconnect. */
const ROOM_IDLE_MS = 10 * 60 * 1000;
/** How long a friend invite stays open. */
const INVITE_MS = 90 * 1000;

export class SignalingServer {
  private readonly wss: WebSocketServer;
  private readonly matchmaker = new Matchmaker();
  private readonly rooms = new Map<string, GameRoom>();
  private readonly lobbyPeers = new Map<string, Peer>();
  private readonly picks = new Map<string, [Monster, Monster]>();
  /** Private rooms waiting on a friend, keyed by their share code. */
  private readonly pendingRooms = new Map<string, PendingRoom>();
  /** Signed-in lobby connections. */
  private readonly lobbyAccounts = new Map<Peer, Account>();
  private readonly invites = new Map<string, Invite>();

  /** Attaches WebSocket handling onto an existing HTTP server (shared port). */
  constructor(
    httpServer: HttpServer,
    private readonly services: Services,
  ) {
    this.wss = new WebSocketServer({
      server: httpServer,
      handleProtocols: (protocols) =>
        protocols.has(PROTOO_SUBPROTOCOL) ? PROTOO_SUBPROTOCOL : false,
    });
    this.wss.on("connection", (socket, request) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const roomId = url.searchParams.get("roomId");
      const peerId = url.searchParams.get("peerId");
      if (!roomId || !peerId) {
        socket.close(4000, "missing roomId/peerId");
        return;
      }
      this.onConnection(socket, roomId, peerId);
    });
  }

  async close(): Promise<void> {
    for (const t of this.roomTimers.values()) clearTimeout(t);
    this.roomTimers.clear();
    for (const inv of this.invites.values()) clearTimeout(inv.timer);
    this.invites.clear();
    for (const room of this.rooms.values()) room.dispose();
    for (const peer of this.lobbyPeers.values()) peer.close();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  /** Rooms nobody is connected to, scheduled for cleanup. */
  private readonly roomTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private onConnection(socket: WebSocket, roomId: string, peerId: string): void {
    if (roomId === LOBBY) {
      const peer = new Peer(
        peerId,
        roomId,
        socket,
        (p, method, data) => this.handleLobby(p, method, data),
        (p) => {
          // A reload may already have replaced this peer with a new connection.
          this.signOut(p);
          for (const inv of [...this.invites.values()]) if (inv.host.peerId === p.id) this.dropInvite(inv, "cancelled");
          if (this.lobbyPeers.get(p.id) !== p) return;
          this.matchmaker.cancel(p.id);
          this.removePendingByHost(p.id);
          this.picks.delete(p.id);
          this.lobbyPeers.delete(p.id);
        },
      );
      this.lobbyPeers.set(peerId, peer);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      socket.close(4004, "no such room");
      return;
    }
    const peer = new Peer(
      peerId,
      roomId,
      socket,
      (p, method, data) =>
        method === "mm:rematch" ? this.handleRematch(room, p) : room.handleRequest(p.id, method, data),
      (p) => {
        room.leave(p);
        if (room.connectedCount() === 0) this.scheduleRoomCleanup(roomId);
      },
    );
    if (!room.join(peer)) {
      peer.close();
      return;
    }
    const pending = this.roomTimers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      this.roomTimers.delete(roomId);
    }
  }

  /**
   * A player asked for a rematch. Once both have, spin up a fresh room with the
   * same teams (loser opens) and send both players there.
   */
  private handleRematch(room: GameRoom, peer: Peer): unknown {
    const seat = room.seatOf(peer.id);
    if (seat === undefined) throw new Error("peer is not seated in this room");
    if (room.rematchRoomId) return { roomId: room.rematchRoomId };
    if (!room.voteRematch(seat)) return { waiting: true };
    const roomId = randomUUID();
    const seed = (Math.random() * 0xffffffff) >>> 0;
    this.rooms.set(roomId, new GameRoom(room.rematchConfig(randomUUID(), seed), { ...room.options, mode: "rematch" }));
    this.scheduleRoomCleanup(roomId); // cancelled as soon as a player connects
    room.announceRematch(roomId);
    return { roomId };
  }

  /** Drop an abandoned room after a grace period (long enough to reload a tab). */
  private scheduleRoomCleanup(roomId: string): void {
    if (this.roomTimers.has(roomId)) return;
    const timer = setTimeout(() => {
      this.roomTimers.delete(roomId);
      const room = this.rooms.get(roomId);
      if (room && room.connectedCount() === 0) {
        room.dispose();
        this.rooms.delete(roomId);
      }
    }, ROOM_IDLE_MS);
    timer.unref?.();
    this.roomTimers.set(roomId, timer);
  }

  /** Options every new room gets: who's who (for history) and the history hook. */
  private roomOptions(mode: MatchMode, a: string, b: string | null, extra: RoomOptions = {}): RoomOptions {
    return {
      ...extra,
      mode,
      accounts: [this.accountOf(a)?.id ?? null, b ? (this.accountOf(b)?.id ?? null) : null],
      onFinished: (room) => {
        this.services.history.record(room.toRecord()).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("failed to record match:", err);
        });
      },
    };
  }

  /** The signed-in account behind a lobby peer id, if any. */
  private accountOf(peerId: string): Account | undefined {
    const peer = this.lobbyPeers.get(peerId);
    return peer ? this.lobbyAccounts.get(peer) : undefined;
  }

  /** Signed-in players play under their username. */
  private nameFor(peer: Peer, fallback: string): string {
    return this.lobbyAccounts.get(peer)?.username ?? fallback;
  }

  private signOut(peer: Peer): void {
    const account = this.lobbyAccounts.get(peer);
    if (!account) return;
    this.lobbyAccounts.delete(peer);
    if (this.services.presence.remove(account.id, peer)) void this.announcePresence(account.id, false);
  }

  private async announcePresence(accountId: string, online: boolean): Promise<void> {
    try {
      for (const id of await this.services.social.friendIds(accountId)) {
        this.services.presence.notify(id, "social:presence", { id: accountId, online });
      }
    } catch {
      /* presence is best-effort */
    }
  }

  private dropInvite(inv: Invite, reason: "expired" | "declined" | "cancelled" | "accepted"): void {
    if (!this.invites.delete(inv.id)) return;
    clearTimeout(inv.timer);
    const note = { inviteId: inv.id, reason };
    this.services.presence.notify(inv.to, "social:inviteGone", note);
    this.lobbyPeers.get(inv.host.peerId)?.notify("social:inviteGone", note);
  }

  private async handleLobby(peer: Peer, method: string, data: unknown): Promise<unknown> {
    switch (method) {
      // --- Accounts: sign this connection in, for presence/invites ---
      case "mm:auth": {
        const key = (data as Record<string, unknown> | null)?.["key"];
        const account = await this.services.accounts.authenticate(key);
        if (!account) throw new Error("unknown account key");
        this.signOut(peer);
        this.lobbyAccounts.set(peer, account);
        if (this.services.presence.add(account.id, peer)) void this.announcePresence(account.id, true);
        return { account };
      }

      // --- Friend invites: a private match without sharing a code ---
      case "mm:invite": {
        const me = this.lobbyAccounts.get(peer);
        if (!me) throw new Error("sign in to invite friends");
        const d = (data ?? {}) as Record<string, unknown>;
        const friendId = typeof d["friendId"] === "string" ? d["friendId"] : "";
        if (!(await this.services.social.areFriends(me.id, friendId))) throw new Error("you can only invite friends");
        if (!this.services.presence.isOnline(friendId)) throw new Error("they're offline right now");
        const req = parseEnqueue(data);
        for (const inv of [...this.invites.values()]) if (inv.host.peerId === peer.id) this.dropInvite(inv, "cancelled");
        const inv: Invite = {
          id: randomUUID(),
          to: friendId,
          host: { peerId: peer.id, displayName: me.username, monsters: req.monsters },
          timer: setTimeout(() => this.dropInvite(inv, "expired"), INVITE_MS),
        };
        inv.timer.unref?.();
        this.invites.set(inv.id, inv);
        this.services.presence.notify(friendId, "social:invite", {
          inviteId: inv.id,
          from: { id: me.id, username: me.username },
          monsters: req.monsters.map((m) => m.id),
          expiresInMs: INVITE_MS,
        });
        return { inviteId: inv.id, expiresInMs: INVITE_MS };
      }

      case "mm:acceptInvite": {
        const me = this.lobbyAccounts.get(peer);
        const d = (data ?? {}) as Record<string, unknown>;
        const inv = this.invites.get(typeof d["inviteId"] === "string" ? d["inviteId"] : "");
        if (!me || !inv || inv.to !== me.id) throw new Error("that invite has expired");
        if (!this.lobbyPeers.get(inv.host.peerId)) {
          this.dropInvite(inv, "cancelled");
          throw new Error("they left the lobby");
        }
        const req = parseEnqueue(data);
        this.dropInvite(inv, "accepted");
        const spawned = this.spawnRoom(inv.host, { peerId: peer.id, displayName: me.username, monsters: req.monsters }, "invite");
        return { roomId: spawned.roomId, matchId: spawned.matchId, seat: 1, firstTurn: spawned.firstTurn };
      }

      case "mm:declineInvite":
      case "mm:cancelInvite": {
        const d = (data ?? {}) as Record<string, unknown>;
        const inv = this.invites.get(typeof d["inviteId"] === "string" ? d["inviteId"] : "");
        const me = this.lobbyAccounts.get(peer);
        if (inv && (inv.host.peerId === peer.id || (me && inv.to === me.id))) {
          this.dropInvite(inv, method === "mm:declineInvite" ? "declined" : "cancelled");
        }
        return { ok: true };
      }

      case "mm:enqueue": {
        const req = parseEnqueue(data);
        this.picks.set(peer.id, req.monsters);
        const ticket: Ticket = {
          peerId: peer.id,
          displayName: this.nameFor(peer, req.displayName),
          key: req.key,
          enqueuedAt: Date.now(),
        };
        const match = this.matchmaker.enqueue(ticket);
        if (!match) return { queued: true, waiting: this.matchmaker.waiting(req.key) };

        const [a, b] = match.players;
        const room = new GameRoom(
          {
            matchId: match.matchId,
            seed: match.seed,
            firstTurn: match.firstTurn,
            players: [
              { peerId: a.peerId, displayName: a.displayName, monsters: this.picksFor(a.peerId) },
              { peerId: b.peerId, displayName: b.displayName, monsters: this.picksFor(b.peerId) },
            ],
          },
          this.roomOptions("quick", a.peerId, b.peerId),
        );
        this.rooms.set(match.roomId, room);

        this.notifyMatched(a.peerId, match.roomId, match.matchId, 0, match.firstTurn);
        this.notifyMatched(b.peerId, match.roomId, match.matchId, 1, match.firstTurn);
        return { queued: false, roomId: match.roomId, matchId: match.matchId, seat: 1 };
      }

      case "mm:cancel":
        this.matchmaker.cancel(peer.id);
        return { cancelled: true };

      // --- Private rooms: share a code / link instead of queueing ---
      case "mm:createRoom": {
        const req = parseEnqueue(data);
        const code = this.makeCode();
        this.pendingRooms.set(code, {
          code,
          hostPeerId: peer.id,
          host: { peerId: peer.id, displayName: this.nameFor(peer, req.displayName), monsters: req.monsters },
        });
        return { code };
      }

      case "mm:joinRoom": {
        const req = parseEnqueue(data);
        const d = (data ?? {}) as Record<string, unknown>;
        const code = typeof d["code"] === "string" ? d["code"].trim().toUpperCase() : "";
        const pending = this.pendingRooms.get(code);
        if (!pending) throw new Error("room not found or expired");
        if (pending.hostPeerId === peer.id) throw new Error("cannot join your own room");
        this.pendingRooms.delete(code);
        const joiner = {
          peerId: peer.id,
          displayName: this.nameFor(peer, req.displayName),
          monsters: req.monsters,
        };
        const spawned = this.spawnRoom(pending.host, joiner, "private");
        return { roomId: spawned.roomId, matchId: spawned.matchId, seat: 1, firstTurn: spawned.firstTurn };
      }

      // --- Practice: play the built-in bot (debug shortcuts allowed) ---
      case "mm:practice": {
        const req = parseEnqueue(data);
        const roomId = randomUUID();
        const matchId = randomUUID();
        const firstTurn = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
        const room = new GameRoom(
          {
            matchId,
            seed: (Math.random() * 0xffffffff) >>> 0,
            firstTurn,
            players: [
              { peerId: peer.id, displayName: this.nameFor(peer, req.displayName), monsters: req.monsters },
              { peerId: `bot:${randomUUID()}`, displayName: "Practice Bot", monsters: randomPicks() },
            ],
          },
          this.roomOptions("practice", peer.id, null, { botSeat: 1 }),
        );
        this.rooms.set(roomId, room);
        this.scheduleRoomCleanup(roomId); // cancelled once the player connects
        this.notifyMatched(peer.id, roomId, matchId, 0, firstTurn);
        return { roomId, matchId, seat: 0, firstTurn };
      }

      case "mm:cancelRoom":
        this.removePendingByHost(peer.id);
        return { cancelled: true };

      default:
        throw new Error(`unknown lobby method: ${method}`);
    }
  }

  /** Build a game room for two described players and tell both to connect. */
  private spawnRoom(
    a: PlayerDesc,
    b: PlayerDesc,
    mode: MatchMode,
  ): { roomId: string; matchId: string; firstTurn: 0 | 1 } {
    const roomId = randomUUID();
    const matchId = randomUUID();
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const firstTurn = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
    this.rooms.set(
      roomId,
      new GameRoom({
        matchId,
        seed,
        firstTurn,
        players: [
          { peerId: a.peerId, displayName: a.displayName, monsters: a.monsters },
          { peerId: b.peerId, displayName: b.displayName, monsters: b.monsters },
        ],
      }, this.roomOptions(mode, a.peerId, b.peerId)),
    );
    this.notifyMatched(a.peerId, roomId, matchId, 0, firstTurn);
    this.notifyMatched(b.peerId, roomId, matchId, 1, firstTurn);
    return { roomId, matchId, firstTurn };
  }

  /** Generate a short, unambiguous, currently-unused room code. */
  private makeCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = "";
      for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!this.pendingRooms.has(code)) return code;
    }
    // Astronomically unlikely; fall back to a longer unique code.
    return randomUUID().slice(0, 8).toUpperCase();
  }

  private removePendingByHost(hostPeerId: string): void {
    for (const [code, pending] of this.pendingRooms) {
      if (pending.hostPeerId === hostPeerId) this.pendingRooms.delete(code);
    }
  }

  private notifyMatched(
    peerId: string,
    roomId: string,
    matchId: string,
    seat: 0 | 1,
    firstTurn: 0 | 1,
  ): void {
    this.lobbyPeers.get(peerId)?.notify("mm:matched", { roomId, matchId, seat, firstTurn });
  }

  private picksFor(peerId: string): [Monster, Monster] {
    return this.picks.get(peerId) ?? defaultPicks();
  }
}

interface PlayerDesc {
  readonly peerId: string;
  readonly displayName: string;
  readonly monsters: [Monster, Monster];
}

interface Invite {
  readonly id: string;
  /** Account invited. */
  readonly to: string;
  /** The inviter, as they'll be seated. */
  readonly host: PlayerDesc;
  readonly timer: ReturnType<typeof setTimeout>;
}

interface PendingRoom {
  readonly code: string;
  readonly hostPeerId: string;
  readonly host: PlayerDesc;
}

interface EnqueueRequest {
  readonly displayName: string;
  readonly key: QueueKey;
  readonly monsters: [Monster, Monster];
}

function parseEnqueue(data: unknown): EnqueueRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const gameId = typeof d["gameId"] === "string" ? d["gameId"] : "match_monsters";
  const mode = typeof d["mode"] === "string" ? d["mode"] : "casual";
  const stake = typeof d["stake"] === "number" ? d["stake"] : 0;
  const displayName = typeof d["displayName"] === "string" ? d["displayName"] : "Player";
  const monsters = resolveMonsters(d["monsters"]);
  return { displayName, key: { gameId, mode, stake }, monsters };
}

function resolveMonsters(raw: unknown): [Monster, Monster] {
  if (Array.isArray(raw) && raw.length >= 2) {
    const a = typeof raw[0] === "string" ? monsterById(raw[0]) : undefined;
    const b = typeof raw[1] === "string" ? monsterById(raw[1]) : undefined;
    if (a && b) return [a, b];
  }
  return defaultPicks();
}

/** Two different random monsters (the practice bot's team). */
function randomPicks(): [Monster, Monster] {
  const all = Object.values(MONSTERS);
  const a = all[Math.floor(Math.random() * all.length)]!;
  const rest = all.filter((m) => m !== a);
  return [a, rest[Math.floor(Math.random() * rest.length)]!];
}

function defaultPicks(): [Monster, Monster] {
  return [MONSTERS["ember_pup"]!, MONSTERS["tide_serpent"]!];
}
