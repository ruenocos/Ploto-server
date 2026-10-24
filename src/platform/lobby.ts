/**
 * The seams between the shared base and each game.
 *
 * The signaling server owns connections, accounts, presence, invites and the
 * room table. Each game plugs in a {@link GameLobby} that handles its own lobby
 * methods (`mm:*`, `holdem:*`) and creates its own {@link Room}s; rooms then
 * get their own connections (`roomId=<id>`) and handle their own methods.
 */
import type { Account } from "../accounts/accounts.js";
import type { Services } from "../services.js";
import type { PeerLike } from "./peer.js";
import type { InviteBook } from "./invites.js";

/** A live game room: seats, connections and requests. */
export interface Room {
  /** Registry id of the game it belongs to (for live player counts). */
  readonly gameId: string;
  /** Attach a connection; false if this peer has no seat here. */
  join(peer: PeerLike): boolean;
  leave(peer: PeerLike): void;
  handleRequest(peerId: string, method: string, data: unknown): unknown;
  connectedCount(): number;
  dispose(): void;
}

/** What the shared base offers a game's lobby module. */
export interface LobbyContext {
  readonly services: Services;
  readonly invites: InviteBook;
  /** The lobby connection of a peer id, if it's still connected. */
  lobbyPeer(peerId: string): PeerLike | undefined;
  /** The signed-in account behind a lobby peer (id or connection), if any. */
  accountOf(peer: PeerLike | string): Account | undefined;
  /** Signed-in players play under their username; guests under the name they gave. */
  nameFor(peer: PeerLike, fallback: string): string;
  addRoom(roomId: string, room: Room): void;
  getRoom(roomId: string): Room | undefined;
  /** Remove a room (only if `room` is given and still the one registered). */
  removeRoom(roomId: string, room?: Room): void;
  /** Drop the room after a grace period if nobody is connected (cancelled when someone joins). */
  scheduleCleanup(roomId: string): void;
  /**
   * Check a peer may invite this friend (signed in, friends, friend online) and
   * return both accounts; throws the player-facing reason otherwise.
   */
  inviteTarget(peer: PeerLike, friendId: unknown): Promise<{ me: Account; friend: Account }>;
}

/** One game's lobby methods. */
export interface GameLobby {
  readonly gameId: string;
  /** Method prefix it owns, e.g. "mm:" or "holdem:". */
  readonly prefix: string;
  handle(peer: PeerLike, method: string, data: unknown): Promise<unknown> | unknown;
  /**
   * A request on a room connection the room itself doesn't handle (e.g. a
   * rematch that spawns a new room). Return undefined to let the room handle it.
   */
  roomRequest?(roomId: string, room: Room, peer: PeerLike, method: string, data: unknown): unknown;
  /** The peer's lobby connection closed for good (not replaced by a reload). */
  peerGone(peerId: string): void;
  /** Players waiting in this game's queues (counted as online). */
  waitingCount?(): number;
  dispose?(): void;
}
