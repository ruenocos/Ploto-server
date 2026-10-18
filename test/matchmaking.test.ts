import { describe, it, expect } from "vitest";
import { Matchmaker, type Ticket, type QueueKey } from "../src/matchmaking/pool.js";

const KEY: QueueKey = { gameId: "match_monsters", mode: "ranked", stake: 0 };

function ticket(peerId: string): Ticket {
  return { peerId, displayName: peerId, key: KEY, enqueuedAt: 0 };
}

describe("Matchmaker", () => {
  it("holds the first player and pairs the second", () => {
    const mm = new Matchmaker(seedSeq([111, 0]));
    expect(mm.enqueue(ticket("a"))).toBeNull();
    expect(mm.waiting(KEY)).toBe(1);

    const match = mm.enqueue(ticket("b"));
    expect(match).not.toBeNull();
    expect(match!.players.map((p) => p.peerId)).toEqual(["a", "b"]);
    expect(match!.seed).toBe(111);
    expect(match!.firstTurn).toBe(0);
    expect(mm.waiting(KEY)).toBe(0);
  });

  it("keeps separate pools per key", () => {
    const mm = new Matchmaker();
    mm.enqueue(ticket("a"));
    const other: Ticket = { ...ticket("b"), key: { ...KEY, stake: 100 } };
    expect(mm.enqueue(other)).toBeNull(); // different stake -> different pool
    expect(mm.waiting(KEY)).toBe(1);
    expect(mm.waiting({ ...KEY, stake: 100 })).toBe(1);
  });

  it("removes a waiting player on cancel", () => {
    const mm = new Matchmaker();
    mm.enqueue(ticket("a"));
    mm.cancel("a");
    expect(mm.waiting(KEY)).toBe(0);
    expect(mm.enqueue(ticket("b"))).toBeNull();
  });

  it("does not double-queue the same peer", () => {
    const mm = new Matchmaker();
    mm.enqueue(ticket("a"));
    mm.enqueue(ticket("a"));
    expect(mm.waiting(KEY)).toBe(1);
  });
});

/** Deterministic seed source returning the given values in order, then 0. */
function seedSeq(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}
