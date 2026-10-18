/**
 * Signaling server: protoo-over-WebSocket front door.
 *
 * Two kinds of connection, distinguished by the `roomId` query parameter the
 * client opens with (`wss://host/?roomId=…&peerId=…`):
 *
 *   roomId === "lobby"  -> matchmaking. Methods: `mm:enqueue`, `mm:cancel`.
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
import { GameRoom } from "./gameRoom.js";
import { Peer } from "./peer.js";
import { monsterById, MONSTERS } from "../game/matchmonsters/monsters.js";
import type { Monster } from "../game/matchmonsters/types.js";

const LOBBY = "lobby";
const PROTOO_SUBPROTOCOL = "protoo";
/** How long an empty room survives so players can reload/reconnect. */
const ROOM_IDLE_MS = 10 * 60 * 1000;

export class SignalingServer {
  private readonly wss: WebSocketServer;
  private readonly matchmaker = new Matchmaker();
  private readonly rooms = new Map<string, GameRoom>();
  private readonly lobbyPeers = new Map<string, Peer>();
  private readonly picks = new Map<string, [Monster, Monster]>();
  /** Private rooms waiting on a friend, keyed by their share code. */
  private readonly pendingRooms = new Map<string, PendingRoom>();

  /** Attaches WebSocket handling onto an existing HTTP server (shared port). */
  constructor(httpServer: HttpServer) {
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
      (p, method, data) => room.handleRequest(p.id, method, data),
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

  /** Drop an abandoned room after a grace period (long enough to reload a tab). */
  private scheduleRoomCleanup(roomId: string): void {
    if (this.roomTimers.has(roomId)) return;
    const timer = setTimeout(() => {
      this.roomTimers.delete(roomId);
      const room = this.rooms.get(roomId);
      if (room && room.connectedCount() === 0) this.rooms.delete(roomId);
    }, ROOM_IDLE_MS);
    timer.unref?.();
    this.roomTimers.set(roomId, timer);
  }

  private handleLobby(peer: Peer, method: string, data: unknown): unknown {
    switch (method) {
      case "mm:enqueue": {
        const req = parseEnqueue(data);
        this.picks.set(peer.id, req.monsters);
        const ticket: Ticket = {
          peerId: peer.id,
          displayName: req.displayName,
          key: req.key,
          enqueuedAt: Date.now(),
        };
        const match = this.matchmaker.enqueue(ticket);
        if (!match) return { queued: true, waiting: this.matchmaker.waiting(req.key) };

        const [a, b] = match.players;
        const room = new GameRoom({
          matchId: match.matchId,
          seed: match.seed,
          firstTurn: match.firstTurn,
          players: [
            { peerId: a.peerId, displayName: a.displayName, monsters: this.picksFor(a.peerId) },
            { peerId: b.peerId, displayName: b.displayName, monsters: this.picksFor(b.peerId) },
          ],
        });
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
          host: { peerId: peer.id, displayName: req.displayName, monsters: req.monsters },
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
          displayName: req.displayName,
          monsters: req.monsters,
        };
        const spawned = this.spawnRoom(pending.host, joiner);
        return { roomId: spawned.roomId, matchId: spawned.matchId, seat: 1, firstTurn: spawned.firstTurn };
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
      }),
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

function defaultPicks(): [Monster, Monster] {
  return [MONSTERS["ember_pup"]!, MONSTERS["tide_serpent"]!];
}
