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
import { createServer, type Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { ServerConfig } from "../config/env.js";
import { Matchmaker, type QueueKey, type Ticket } from "../matchmaking/pool.js";
import { GameRoom } from "./gameRoom.js";
import { Peer } from "./peer.js";
import { monsterById, MONSTERS } from "../game/matchmonsters/monsters.js";
import type { Monster } from "../game/matchmonsters/types.js";

const LOBBY = "lobby";
const PROTOO_SUBPROTOCOL = "protoo";

export class SignalingServer {
  private readonly http: HttpServer;
  private readonly wss: WebSocketServer;
  private readonly matchmaker = new Matchmaker();
  private readonly rooms = new Map<string, GameRoom>();
  private readonly lobbyPeers = new Map<string, Peer>();
  private readonly picks = new Map<string, [Monster, Monster]>();

  constructor(private readonly config: ServerConfig) {
    this.http = createServer();
    this.wss = new WebSocketServer({
      server: this.http,
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

  listen(): Promise<void> {
    return new Promise((resolve) => {
      this.http.listen(this.config.signalingPort, this.config.host, () => resolve());
    });
  }

  async close(): Promise<void> {
    for (const peer of this.lobbyPeers.values()) peer.close();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }

  get port(): number {
    const addr = this.http.address();
    return typeof addr === "object" && addr ? addr.port : this.config.signalingPort;
  }

  private onConnection(socket: WebSocket, roomId: string, peerId: string): void {
    if (roomId === LOBBY) {
      const peer = new Peer(
        peerId,
        roomId,
        socket,
        (p, method, data) => this.handleLobby(p, method, data),
        (p) => {
          this.matchmaker.cancel(p.id);
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
      () => {
        /* keep the room; opponent may still be connected / reconnecting */
      },
    );
    if (!room.join(peer)) {
      peer.close();
    }
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

      default:
        throw new Error(`unknown lobby method: ${method}`);
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
