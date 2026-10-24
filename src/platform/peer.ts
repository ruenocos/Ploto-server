/**
 * A connection as rooms and lobbies see it: an id and a way to notify. The
 * protoo peer (src/signaling/peer.ts) is one; tests use plain objects.
 */
export interface PeerLike {
  readonly id: string;
  notify(method: string, data: unknown): void;
}
