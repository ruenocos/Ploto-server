/**
 * Signaling server: protoo-over-WebSocket front door, and the shared base the
 * games plug into (docs/PLATFORM.md).
 *
 * Two kinds of connection, distinguished by the `roomId` query parameter the
 * client opens with (`wss://host/?roomId=…&peerId=…`):
 *
 *   roomId === "lobby"  -> the lobby. Platform methods live here (`platform:auth`
 *                          for presence, `platform:activity`, `platform:invites`,
 *                          `platform:declineInvite`, `platform:cancelInvite`);
 *                          every other method goes to the game lobby that owns
 *                          its prefix (`mm:*` Match Monsters, `holdem:*` Hold'em).
 *                          The lobby socket stays open all session, so it also
 *                          carries `social:*` notifications (messages, presence,
 *                          invites) and each game's "your room is ready" notices.
 *   roomId === <uuid>   -> a live game room, created by a game lobby. Requests
 *                          are routed to whichever room is registered under the
 *                          id at the time (a Match Monsters draft room is
 *                          replaced by its game room on the same connections).
 *
 * The voice/mediasoup methods (`join`, `createWebRtcTransport`, `produce`, …)
 * attach here too, on the game room connection, once the SFU is wired in.
 */
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { Account } from "../accounts/accounts.js";
import type { Services } from "../services.js";
import { makeCode, normalizeCode } from "../platform/codes.js";
import { setOnlineCounter } from "../platform/games.js";
import { GAMES } from "../games.js";
import { InviteBook } from "../platform/invites.js";
import { LobbyRoom } from "../platform/lobbyRoom.js";
import type { GameLobby, LobbyContext, Room } from "../platform/lobby.js";
import type { PeerLike } from "../platform/peer.js";
import { Peer } from "./peer.js";

const LOBBY = "lobby";
const PROTOO_SUBPROTOCOL = "protoo";
/** How long an empty room survives so players can reload/reconnect. */
const ROOM_IDLE_MS = 10 * 60 * 1000;

/** Game lobbies to plug in, given the shared context (Hold'em adds itself here). */
export type LobbyFactory = (ctx: LobbyContext) => GameLobby;
export const LOBBY_FACTORIES: LobbyFactory[] = GAMES.map((g) => g.lobby);

export class SignalingServer {
  private readonly wss: WebSocketServer;
  private readonly rooms = new Map<string, Room>();
  private readonly lobbyPeers = new Map<string, Peer>();
  /** Signed-in lobby connections. */
  private readonly lobbyAccounts = new Map<Peer, Account>();
  private readonly invites: InviteBook;
  private readonly lobbies: GameLobby[];
  /** Room codes in use, across every game: code -> its game and room. */
  private readonly codes = new Map<string, { gameId: string; roomId: string }>();
  /** Rooms nobody is connected to, scheduled for cleanup. */
  private readonly roomTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Attaches WebSocket handling onto an existing HTTP server (shared port). */
  constructor(
    httpServer: HttpServer,
    private readonly services: Services,
  ) {
    this.invites = new InviteBook(services.presence, (id) => this.lobbyPeers.get(id));
    const ctx: LobbyContext = {
      services,
      invites: this.invites,
      lobbyPeer: (id) => this.lobbyPeers.get(id),
      accountOf: (peer) => this.accountOf(peer),
      nameFor: (peer, fallback) => this.accountOf(peer)?.username ?? fallback,
      addRoom: (roomId, room) => { this.rooms.set(roomId, room); },
      getRoom: (roomId) => this.rooms.get(roomId),
      removeRoom: (roomId, room) => {
        if (room && this.rooms.get(roomId) !== room) return;
        this.rooms.delete(roomId);
      },
      scheduleCleanup: (roomId) => this.scheduleRoomCleanup(roomId),
      inviteTarget: async (peer, friendId) => {
        const me = this.accountOf(peer);
        if (!me) throw new Error("sign in to invite friends");
        const id = typeof friendId === "string" ? friendId : "";
        if (!(await services.social.areFriends(me.id, id))) throw new Error("you can only invite friends");
        if (!services.presence.isOnline(id)) throw new Error("they're offline right now");
        const friend = await services.accounts.byId(id);
        if (!friend) throw new Error("you can only invite friends");
        return { me, friend };
      },
      claimCode: (gameId, roomId) => {
        const code = makeCode((c) => this.codes.has(c));
        this.codes.set(code, { gameId, roomId });
        return code;
      },
      releaseCode: (code) => { this.codes.delete(code); },
    };
    this.lobbies = LOBBY_FACTORIES.map((make) => make(ctx));
    setOnlineCounter(() => this.onlineCounts());

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
    this.invites.dispose();
    for (const lobby of this.lobbies) lobby.dispose?.();
    for (const room of this.rooms.values()) room.dispose();
    for (const peer of this.lobbyPeers.values()) peer.close();
    // Drop game connections too, so clients notice right away and reconnect
    // (ws's close() alone leaves existing sockets open).
    for (const client of this.wss.clients) client.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  /** Players in a room or queue, per game (the launcher's "12 online"). */
  private onlineCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const room of this.rooms.values()) counts[room.gameId] = (counts[room.gameId] ?? 0) + room.connectedCount();
    for (const lobby of this.lobbies) counts[lobby.gameId] = (counts[lobby.gameId] ?? 0) + (lobby.waitingCount?.() ?? 0);
    return counts;
  }

  private onConnection(socket: WebSocket, roomId: string, peerId: string): void {
    if (roomId === LOBBY) {
      const peer = new Peer(
        peerId,
        roomId,
        socket,
        (p, method, data) => this.handleLobby(p, method, data),
        (p) => {
          // A reload (or moving between the launcher and a game page, same peer id) may
          // already have replaced this peer with a new connection: then its invites,
          // queue tickets and rooms belong to the new one and stay.
          this.signOut(p);
          if (this.lobbyPeers.get(p.id) !== p) return;
          this.invites.dropByHost(p.id);
          for (const lobby of this.lobbies) lobby.peerGone(p.id);
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
    // Look the room up per request (a room that ended is gone).
    const peer = new Peer(
      peerId,
      roomId,
      socket,
      (p, method, data) => {
        const live = this.rooms.get(roomId);
        if (!live) throw new Error("that game has ended");
        return live.handleRequest(p.id, method, data);
      },
      (p) => {
        const live = this.rooms.get(roomId);
        if (!live) return;
        live.leave(p);
        if (live.connectedCount() === 0) this.scheduleRoomCleanup(roomId);
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
      if (room && room.connectedCount() === 0) {
        room.dispose();
        this.rooms.delete(roomId);
      }
    }, ROOM_IDLE_MS);
    timer.unref?.();
    this.roomTimers.set(roomId, timer);
  }

  /** The signed-in account behind a lobby peer (connection or id), if any. */
  private accountOf(peer: PeerLike | string): Account | undefined {
    const conn = typeof peer === "string" ? this.lobbyPeers.get(peer) : peer instanceof Peer ? peer : this.lobbyPeers.get(peer.id);
    return conn ? this.lobbyAccounts.get(conn) : undefined;
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
        this.services.presence.notify(id, "social:presence", { id: accountId, online, activity: this.services.presence.activityOf(accountId) });
      }
    } catch {
      /* presence is best-effort */
    }
  }

  private async handleLobby(peer: Peer, method: string, data: unknown): Promise<unknown> {
    switch (method) {
      // --- Accounts: sign this connection in, for presence/invites ---
      case "mm:auth":
      case "platform:auth": {
        const key = (data as Record<string, unknown> | null)?.["key"];
        const account = await this.services.accounts.authenticate(key);
        if (!account) throw new Error("unknown account key");
        this.signOut(peer);
        this.lobbyAccounts.set(peer, account);
        if (this.services.presence.add(account.id, peer)) void this.announcePresence(account.id, true);
        return { account };
      }

      // --- What you're doing, for your friends' lists ("At a Hold'em table") ---
      case "platform:activity": {
        const me = this.lobbyAccounts.get(peer);
        if (!me) return { ok: true };
        const d = (data ?? {}) as Record<string, unknown>;
        const gameId = typeof d["gameId"] === "string" ? d["gameId"].slice(0, 40) : "";
        const label = typeof d["label"] === "string" ? d["label"].slice(0, 60) : "";
        if (this.services.presence.setActivity(me.id, gameId ? { gameId, label } : null)) void this.announcePresence(me.id, true);
        return { ok: true };
      }

      // --- Where a room code leads, in any game (the launcher's "Have a code?") ---
      case "platform:findCode": {
        const code = normalizeCode((data as Record<string, unknown> | null)?.["code"]);
        const hit = this.codes.get(code);
        if (!hit || !this.rooms.has(hit.roomId)) throw new Error("that code doesn't lead anywhere any more");
        const game = GAMES.find((g) => g.id === hit.gameId);
        return { code, gameId: hit.gameId, path: game?.path ?? null };
      }

      // --- The room this tab saved: still there, and still yours? (the launcher's Continue) ---
      case "platform:room": {
        const d = (data ?? {}) as Record<string, unknown>;
        const room = this.rooms.get(typeof d["roomId"] === "string" ? d["roomId"] : "");
        if (!(room instanceof LobbyRoom) || room.seatOfPeer(peer.id) < 0 || room.phase === "over") throw new Error("that game has ended");
        return { gameId: room.gameId, phase: room.phase, code: room.code };
      }

      // --- Invites waiting for me (the launcher lists them; any game) ---
      case "platform:invites": {
        const me = this.lobbyAccounts.get(peer);
        return { invites: me ? this.invites.pendingFor(me.id) : [] };
      }

      case "mm:declineInvite":
      case "mm:cancelInvite":
      case "platform:declineInvite":
      case "platform:cancelInvite": {
        const d = (data ?? {}) as Record<string, unknown>;
        const inv = this.invites.get(d["inviteId"]);
        const me = this.lobbyAccounts.get(peer);
        if (inv && (inv.hostPeerId === peer.id || (me && inv.to === me.id))) {
          this.invites.drop(inv, method.endsWith("declineInvite") ? "declined" : "cancelled");
        }
        return { ok: true };
      }

      default: {
        const lobby = this.lobbies.find((l) => method.startsWith(l.prefix));
        if (!lobby) throw new Error(`unknown lobby method: ${method}`);
        return lobby.handle(peer, method, data);
      }
    }
  }
}
