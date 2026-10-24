import { describe, it, expect, vi, afterEach } from "vitest";
import { DraftRoom } from "../src/game/matchmonsters/draftRoom.js";
import type { Monster } from "../src/game/matchmonsters/types.js";

class FakePeer {
  readonly sent: { method: string; data: any }[] = [];
  constructor(readonly id: string) {}
  notify(method: string, data: unknown) { this.sent.push({ method, data }); }
  last(method: string) { return [...this.sent].reverse().find((m) => m.method === method)?.data; }
}

const seats = [{ peerId: "a", displayName: "Ann" }, { peerId: "b", displayName: "Bo" }] as const;

afterEach(() => vi.useRealTimers());

describe("DraftRoom", () => {
  it("runs ban + snake picks and hands both teams over", () => {
    let done: [[Monster, Monster], [Monster, Monster]] | null = null;
    const room = new DraftRoom(seats, { firstTurn: 0, stepMs: null, onDone: (t) => { done = t; }, onCancel: () => {} });
    const a = new FakePeer("a"), b = new FakePeer("b");
    room.join(a); room.join(b);
    room.handleRequest("a", "mm:ban", { monsterId: "ember_pup" });
    // b hasn't banned yet, so a's update shows a's own ban only, and b sees neither
    expect(b.last("mm:draftUpdate").draft.bans).toEqual([null, null]);
    room.handleRequest("b", "mm:ban", { monsterId: "prism_owl" });
    expect(() => room.handleRequest("a", "mm:pick", { monsterId: "tide_serpent" })).toThrow(/not your pick/);
    room.handleRequest("b", "mm:pick", { monsterId: "tide_serpent" }); // seat 1 moves second, picks first
    room.handleRequest("a", "mm:pick", { monsterId: "frost_imp" });
    room.handleRequest("a", "mm:pick", { monsterId: "kraken_pup" });
    expect(() => room.handleRequest("b", "mm:pick", { monsterId: "frost_imp" })).toThrow(/isn't available/);
    room.handleRequest("b", "mm:pick", { monsterId: "bubble_jelly" });
    expect(done).not.toBeNull();
    expect(done![0].map((m) => m.id)).toEqual(["frost_imp", "kraken_pup"]);
    expect(done![1].map((m) => m.id)).toEqual(["tide_serpent", "bubble_jelly"]);
  });

  it("refuses moves until the draft is over", () => {
    const room = new DraftRoom(seats, { firstTurn: 0, stepMs: null, onDone: () => {}, onCancel: () => {} });
    expect(() => room.handleRequest("a", "mm:move", {})).toThrow(/draft isn't over/);
  });

  it("the practice bot bans and picks on its own", () => {
    vi.useFakeTimers();
    let done: [[Monster, Monster], [Monster, Monster]] | null = null;
    const room = new DraftRoom(seats, { firstTurn: 0, stepMs: null, botSeat: 1, onDone: (t) => { done = t; }, onCancel: () => {} });
    room.join(new FakePeer("a"));
    room.handleRequest("a", "mm:ban", { monsterId: "ember_pup" });
    vi.advanceTimersByTime(1000); // bot bans
    vi.advanceTimersByTime(1000); // bot picks first (it moves second)
    // The bot bans and picks at random, so take whatever is still free.
    room.handleRequest("a", "mm:pick", { monsterId: room.draft.available()[0]! });
    room.handleRequest("a", "mm:pick", { monsterId: room.draft.available()[0]! });
    vi.advanceTimersByTime(1000); // bot's last pick
    expect(done).not.toBeNull();
    const all = [...done![0], ...done![1]].map((m) => m.id);
    expect(new Set(all).size).toBe(4); // unique
    expect(all).not.toContain("ember_pup"); // banned
  });

  it("Quick Play steps time out: no ban, then random picks", () => {
    vi.useFakeTimers();
    let done = false;
    const room = new DraftRoom(seats, { firstTurn: 0, stepMs: 20_000, onDone: () => { done = true; }, onCancel: () => {} });
    for (let i = 0; i < 5; i++) vi.advanceTimersByTime(20_100); // ban step + 4 picks
    expect(done).toBe(true);
    expect(room.draft.view(0).bans).toEqual([false, false]);
  });

  it("leaving cancels the draft for both", () => {
    let cancelled = false;
    const room = new DraftRoom(seats, { firstTurn: 0, stepMs: null, onDone: () => {}, onCancel: () => { cancelled = true; } });
    const b = new FakePeer("b");
    room.join(b);
    room.handleRequest("a", "mm:leaveDraft", {});
    expect(cancelled).toBe(true);
    expect(b.last("mm:draftCancelled")).toEqual({ by: 0 });
  });
});
