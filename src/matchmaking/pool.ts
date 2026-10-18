/**
 * Matchmaking waiting pools.
 *
 * The client exposes a "Quick Play" queue backed by waiting pools
 * (`WaitingMatchMakingItem(waitingPool=…)`). We model a pool as a FIFO queue
 * keyed by the match parameters; when two compatible players are waiting they are
 * paired and a match descriptor is produced (room id + server-chosen seed + who
 * goes first). Pairing is pure and synchronous so it is easy to test.
 */
import { randomUUID } from "node:crypto";

export interface QueueKey {
  readonly gameId: string;
  readonly mode: string;
  /** Entry stake / chip tier; 0 for casual. */
  readonly stake: number;
}

export interface Ticket {
  readonly peerId: string;
  readonly displayName: string;
  readonly key: QueueKey;
  readonly enqueuedAt: number;
}

export interface Match {
  readonly matchId: string;
  readonly roomId: string;
  readonly key: QueueKey;
  readonly seed: number;
  readonly players: [Ticket, Ticket];
  /** Index of the player who moves first. */
  readonly firstTurn: 0 | 1;
}

function keyString(k: QueueKey): string {
  return `${k.gameId}#${k.mode}#${k.stake}`;
}

export class Matchmaker {
  private readonly pools = new Map<string, Ticket[]>();
  private readonly seed: () => number;

  constructor(seed: () => number = () => (Math.random() * 0xffffffff) >>> 0) {
    this.seed = seed;
  }

  /**
   * Add a player to the queue. Returns a {@link Match} immediately if an opponent
   * was already waiting, otherwise `null` (the player stays queued).
   */
  enqueue(ticket: Ticket): Match | null {
    const ks = keyString(ticket.key);
    const pool = this.pools.get(ks) ?? [];

    // Guard against double-queueing the same peer.
    const existing = pool.findIndex((t) => t.peerId === ticket.peerId);
    if (existing !== -1) pool.splice(existing, 1);

    const opponent = pool.shift();
    if (opponent) {
      this.pools.set(ks, pool);
      return {
        matchId: randomUUID(),
        roomId: randomUUID(),
        key: ticket.key,
        seed: this.seed(),
        players: [opponent, ticket],
        firstTurn: (this.seed() & 1) as 0 | 1,
      };
    }

    pool.push(ticket);
    this.pools.set(ks, pool);
    return null;
  }

  /** Remove a peer from any pool it is waiting in (e.g. on disconnect/cancel). */
  cancel(peerId: string): void {
    for (const [ks, pool] of this.pools) {
      const i = pool.findIndex((t) => t.peerId === peerId);
      if (i !== -1) {
        pool.splice(i, 1);
        this.pools.set(ks, pool);
      }
    }
  }

  /** Number of players currently waiting in a given pool. */
  waiting(key: QueueKey): number {
    return this.pools.get(keyString(key))?.length ?? 0;
  }
}
