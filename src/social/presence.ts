/**
 * Who is online, and a way to reach them. An account is online while it has at
 * least one authenticated lobby connection (a phone and a laptop count once).
 */
import type { PeerLike } from "../signaling/gameRoom.js";

export class Presence {
  private readonly peers = new Map<string, Set<PeerLike>>();

  /** Returns true if this made the account come online. */
  add(accountId: string, peer: PeerLike): boolean {
    let set = this.peers.get(accountId);
    const fresh = !set || set.size === 0;
    if (!set) this.peers.set(accountId, (set = new Set()));
    set.add(peer);
    return fresh;
  }

  /** Returns true if this took the account offline. */
  remove(accountId: string, peer: PeerLike): boolean {
    const set = this.peers.get(accountId);
    if (!set || !set.delete(peer)) return false;
    if (set.size > 0) return false;
    this.peers.delete(accountId);
    return true;
  }

  isOnline(accountId: string): boolean {
    return (this.peers.get(accountId)?.size ?? 0) > 0;
  }

  notify(accountId: string, method: string, data: unknown): void {
    for (const peer of this.peers.get(accountId) ?? []) peer.notify(method, data);
  }
}
