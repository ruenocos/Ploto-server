import { describe, it, expect } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import { DropFourLobby } from "../src/game/drop_four/lobby.js";
import { ANIM, animBudget, parseSettings, DEFAULT_SETTINGS } from "../src/game/drop_four/room.js";
import { Rng } from "../src/game/matchmonsters/rng.js";

/** A lobby context with no server around it: rooms in a map, results captured. */
function fakeCtx() {
  const rooms = new Map<string, any>();
  const recorded: any[] = [];
  let n = 0;
  const ctx: any = {
    services: { results: { record: async (r: unknown) => { recorded.push(r); return "id"; } } },
    invites: { get: () => undefined, drop: () => {} },
    lobbyPeer: () => undefined,
    accountOf: () => undefined,
    nameFor: (_p: unknown, fallback: string) => fallback,
    addRoom: (id: string, room: unknown) => rooms.set(id, room),
    getRoom: (id: string) => rooms.get(id),
    removeRoom: (id: string) => rooms.delete(id),
    scheduleCleanup: () => {},
    claimCode: () => `C${n++}`.padEnd(4, "X"),
    releaseCode: () => {},
  };
  return { ctx, rooms, recorded };
}
const peer = (id: string) => ({ id, notes: [] as { method: string; data: any }[], notify(method: string, data: unknown) { this.notes.push({ method, data }); }, last() { return this.notes.filter((x) => x.method === "dropfour:update").at(-1)?.data; } });
const FAST = { turnMs: 40, awayMs: 30, botMs: [1, 2] as const, quickStartMs: 30, animScale: 0 };
const until = async (cond: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await new Promise((res) => setTimeout(res, 2));
  }
};
const seeded = (seed: number) => { const r = new Rng(seed); return { random: () => r.next() }; };

async function hostedPair(settings: Record<string, unknown> = { timer: false }, seed = 4, names = ["Ann", "Ben"]) {
  const { ctx, rooms, recorded } = fakeCtx();
  const lobby = new DropFourLobby(ctx, { timing: FAST, ...seeded(seed) });
  const a = peer("a"), b = peer("b");
  const hosted = (await lobby.handle(a, "dropfour:host", { displayName: names[0], settings })) as any;
  const room = rooms.get(hosted.roomId);
  room.join(a);
  await lobby.handle(b, "dropfour:join", { displayName: names[1], code: hosted.code });
  room.join(b);
  return { room, rooms, recorded, a, b, lobby };
}
/** The peer whose turn it is. */
const mover = (room: any) => (room.game.turn === 0 ? "a" : "b");

describe("Drop Four room", () => {
  it("clamps settings to what the game offers", () => {
    expect(parseSettings({ bombs: "yes", timer: false, botStyle: "evil", bots: true })).toEqual({ ...DEFAULT_SETTINGS, timer: false });
    expect(parseSettings({ bombs: false, botStyle: "sharp" })).toMatchObject({ bombs: false, botStyle: "sharp", bots: false });
  });

  it("starts when the friend joins: a coin flip, then turns; out-of-turn and full-column drops are refused", async () => {
    const { room, a } = await hostedPair();
    expect(room.phase).toBe("playing");
    const first = a.notes.find((x) => x.method === "dropfour:update" && x.data.events.some((e: any) => e.type === "start"));
    expect(first.data.events[0]).toMatchObject({ type: "start" });
    const other = mover(room) === "a" ? "b" : "a";
    expect(() => room.handleRequest(other, "dropfour:drop", { col: 3 })).toThrow(/turn/);
    for (let i = 0; i < 6; i++) room.handleRequest(mover(room), "dropfour:drop", { col: 0 });
    expect(() => room.handleRequest(mover(room), "dropfour:drop", { col: 0 })).toThrow(/full/);
    room.dispose();
  });

  it("four in a row wins: recorded with stats; the loser opens the rematch, found by connection even with the same name", async () => {
    for (const seed of [4, 5, 6, 7]) {
      const { room, rooms, recorded } = await hostedPair({ timer: false }, seed, ["Player", "Player"]);
      const winnerPeer = mover(room), loserPeer = winnerPeer === "a" ? "b" : "a";
      for (const [who, col] of [[winnerPeer, 0], [loserPeer, 6], [winnerPeer, 1], [loserPeer, 6], [winnerPeer, 2], [loserPeer, 5], [winnerPeer, 3]] as const) room.handleRequest(who, "dropfour:drop", { col });
      expect(room.phase).toBe("over");
      expect(recorded[0]).toMatchObject({ gameId: "drop_four", players: [{ place: 1, stats: { moves: 4, longestLine: 4 } }, { place: 2 }] });
      const next = room.handleRequest(winnerPeer, "lobby:rematch", {});
      room.handleRequest(loserPeer, "lobby:rematch", {});
      const again = rooms.get(next.roomId);
      again.join({ ...peerFor(room, "a") }); again.join({ ...peerFor(room, "b") });
      await until(() => again.game?.phase === "playing");
      expect(again.seated()[again.game.turn].peerId).toBe(loserPeer);
      for (const r of rooms.values()) r.dispose();
    }
  });

  it("a bomb blasts, recorded in the events; bombs off refuses it", async () => {
    const { room, a } = await hostedPair({ timer: false });
    for (const col of [0, 6, 0, 6, 1, 5]) room.handleRequest(mover(room), "dropfour:drop", { col }); // three discs each: bombs ready
    expect(() => room.handleRequest(mover(room), "dropfour:drop", { col: 3, bomb: true })).not.toThrow();
    const ev = a.last().events;
    expect(ev.map((e: any) => e.type)).toEqual(["drop", "blast", "turn"]);
    expect(a.last().view.game.bombs.filter(Boolean)).toHaveLength(1);
    room.dispose();
    const off = await hostedPair({ timer: false, bombs: false });
    expect(() => off.room.handleRequest(mover(off.room), "dropfour:drop", { col: 2, bomb: true })).toThrow(/bomb/);
    off.room.dispose();
  });

  it("leaving mid-game is a forfeit", async () => {
    const { room, recorded, b } = await hostedPair();
    room.handleRequest("a", "lobby:leave", {});
    expect(room.phase).toBe("over");
    expect(b.last().view.game).toMatchObject({ winner: 1, forfeit: true });
    expect(recorded[0].summary.forfeit).toBe(true);
    room.dispose();
  });

  it("with the timer on, the clock drops for you, so a silent game still ends", async () => {
    const { room, b } = await hostedPair({ timer: true }, 8);
    const clock = b.last().view.clock;
    expect(clock).toMatchObject({ seat: room.game.turn });
    expect(clock.deadline - clock.startsAt).toBe(40); // the turn's own length; the wait for the animation is apart
    await until(() => room.phase === "over", 10000);
    expect(b.notes.some((x) => x.data?.events?.some((e: any) => e.type === "drop" && e.auto))).toBe(true);
    room.dispose();
  });

  it("practice: a bot takes the other seat and plays its turns", async () => {
    const { ctx, rooms } = fakeCtx();
    const lobby = new DropFourLobby(ctx, { timing: FAST, ...seeded(3) });
    const me = peer("me");
    const t = (await lobby.handle(me, "dropfour:practice", { displayName: "Mia", settings: { botStyle: "sharp" } })) as any;
    const room = rooms.get(t.roomId);
    room.join(me);
    expect(room.phase).toBe("playing");
    expect(room.settings).toMatchObject({ timer: false, botStyle: "sharp" });
    const mine = room.seated().findIndex((s: any) => s.peerId === "me");
    await until(() => room.game.turn === mine || room.phase === "over");
    expect(room.game.moves[1 - mine] + room.game.moves[mine]).toBeLessThanOrEqual(1);
    room.handleRequest("me", "dropfour:drop", { col: 3 });
    await until(() => room.game.turn === mine || room.phase === "over");
    expect(room.game.moves[1 - mine]).toBeGreaterThanOrEqual(1);
    room.dispose();
  });

  it("a disconnected player gets the away clock even with the timer off", async () => {
    const { room, a, b } = await hostedPair({ timer: false }, 9);
    const away = mover(room) === "a" ? a : b;
    room.leave(away);
    expect((mover(room) === "a" ? b : a).last().view.clock).toMatchObject({ seat: room.game.turn });
    await until(() => room.game.moves[0] + room.game.moves[1] >= 1);
    room.dispose();
  });

  it("the server waits at least as long as the page animates (DROP_ART.ANIM in web/drop-four.card.js)", () => {
    const w: any = {};
    vm.runInNewContext(fs.readFileSync("web/drop-four.card.js", "utf8"), { window: w, document: { createElement: () => ({ getContext: () => null }) }, Ploto: { gameCard: () => {} } });
    expect(w.DROP_ART.ANIM).toEqual(ANIM);
    expect(animBudget([{ type: "drop", by: 0, col: 0, row: 0 }])).toBeGreaterThanOrEqual(ANIM.hover + 6 * ANIM.fallPerRow + ANIM.land);
    expect(animBudget([{ type: "over", winner: 0, line: [[0, 0], [1, 0], [2, 0], [3, 0]] }])).toBeGreaterThanOrEqual(4 * ANIM.lineStep + ANIM.lineHold);
  });
});

/** The peer object a room knows for an id (rematch rooms take the same connection). */
function peerFor(room: any, id: string) { return room.peers.get(id); }
