/**
 * Who is online, and a way to reach them. An account is online while it has at
 * least one authenticated lobby connection (a phone and a laptop count once).
 */
import type { PeerLike } from "../signaling/gameRoom.js";

/** What a signed-in player is doing, for their friends ("At a Hold'em table"). */
export interface Activity {
  readonly gameId: string;
  readonly label: string;
}

export class Presence {
  private readonly peers = new Map<string, Set<PeerLike>>();
  private readonly activities = new Map<string, Activity>();

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
    this.activities.delete(accountId);
    return true;
  }

  /** Set (or with null, clear) what an online account is doing. Returns true if it changed. */
  setActivity(accountId: string, activity: Activity | null): boolean {
    const before = this.activities.get(accountId);
    if (!activity) return this.activities.delete(accountId);
    if (before && before.gameId === activity.gameId && before.label === activity.label) return false;
    this.activities.set(accountId, activity);
    return true;
  }

  activityOf(accountId: string): Activity | null {
    return this.activities.get(accountId) ?? null;
  }

  isOnline(accountId: string): boolean {
    return (this.peers.get(accountId)?.size ?? 0) > 0;
  }

  notify(accountId: string, method: string, data: unknown): void {
    for (const peer of this.peers.get(accountId) ?? []) peer.notify(method, data);
  }
}
