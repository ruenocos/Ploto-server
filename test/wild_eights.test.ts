import { describe, it, expect } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import { WildEightsLobby } from "../src/game/wild_eights/lobby.js";
import { ANIM, animBudget, parseSettings, DEFAULT_SETTINGS } from "../src/game/wild_eights/room.js";
import { rankOf, suitOf } from "../src/game/wild_eights/engine.js";
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
const peer = (id: string) => ({ id, notes: [] as { method: string; data: any }[], notify(method: string, data: unknown) { this.notes.push({ method, data }); }, last() { return this.notes.filter((x) => x.method === "wildeights:update").at(-1)?.data; } });
const FAST = { turnMs: 40, awayMs: 30, goneMs: 1, botMs: [1, 2] as const, quickStartMs: 30, animScale: 0 };
const until = async (cond: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await new Promise((res) => setTimeout(res, 2));
  }
};
const seeded = (seed: number) => { const r = new Rng(seed); return { random: () => r.next() }; };

/** A hosted table with `n` friends seated, started by the host. */
async function hostedTable(n = 2, settings: Record<string, unknown> = { timer: false, bots: false }, seed = 4) {
  const { ctx, rooms, recorded } = fakeCtx();
  const lobby = new WildEightsLobby(ctx, { timing: FAST, ...seeded(seed) });
  const names = ["Ann", "Ben", "Cy", "Di"];
  const peers = names.slice(0, n).map((x) => peer(x.toLowerCase()));
  const hosted = (await lobby.handle(peers[0]!, "wildeights:host", { displayName: names[0], settings: { seats: n, ...settings } })) as any;
  const room = rooms.get(hosted.roomId);
  room.join(peers[0]);
  for (let i = 1; i < n; i++) { await lobby.handle(peers[i]!, "wildeights:join", { displayName: names[i], code: hosted.code }); room.join(peers[i]); }
  room.handleRequest("ann", "lobby:start", {});
  return { room, rooms, recorded, peers, lobby };
}
/** The peer id whose turn it is. */
const mover = (room: any) => room.seats[room.order[room.game.turn]].peerId as string;
/** A peer's player index in the game. */
const playerOf = (room: any, id: string) => room.order.indexOf(room.seatOfPeer(id));
/** One sensible move for whoever is up: a card that fits (8s name hearts), else draw, else pass. */
function step(room: any) {
  const g = room.game, p = g.turn, who = mover(room);
  const card = g.playable(p)[0];
  if (card) return room.handleRequest(who, "wildeights:play", { card, suit: rankOf(card) === "8" ? "H" : undefined });
  return room.handleRequest(who, g.drawn ? "wildeights:pass" : "wildeights:draw", {});
}

describe("Wild Eights room", () => {
  it("clamps settings to what the game offers", () => {
    expect(parseSettings({ seats: 9, timer: "no", botStyle: "evil" })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ seats: 3, bots: false, botStyle: "sharp" })).toMatchObject({ seats: 3, bots: false, botStyle: "sharp" });
  });

  it("the host deals; turns are enforced; wrong cards are refused with a reason", async () => {
    const { room, peers } = await hostedTable(3);
    expect(room.phase).toBe("playing");
    const dealt = peers[0]!.notes.find((x) => x.data?.events?.[0]?.type === "deal");
    expect(dealt?.data.events[0]).toMatchObject({ type: "deal", counts: [6, 6, 6] });
    const notUp = peers.find((x) => x.id !== mover(room))!;
    expect(() => room.handleRequest(notUp.id, "wildeights:draw", {})).toThrow(/turn/);
    const g = room.game, p = g.turn;
    g.hands[p].push(["KS", "KH", "KD", "KC"].find((c) => !g.canPlay(c) && !g.hands.flat().includes(c)) ?? "KS");
    const bad = g.hands[p].find((c: string) => !g.canPlay(c));
    expect(() => room.handleRequest(mover(room), "wildeights:play", { card: bad })).toThrow(/match/);
    room.dispose();
  });

  it("each seat sees only its own hand; someone else's drawn cards are only a count", async () => {
    const { room, peers } = await hostedTable(2);
    const g = room.game, up = mover(room), other = peers.find((x) => x.id !== up)!, me = peers.find((x) => x.id === up)!;
    g.hands[g.turn] = g.hands[g.turn].filter((c: string) => !g.canPlay(c)); // nothing to play: they must draw
    room.handleRequest(up, "wildeights:draw", {});
    const mine = me.last().events.find((e: any) => e.type === "draw"), theirs = other.last().events.find((e: any) => e.type === "draw");
    expect(mine.cards).toHaveLength(1);
    expect(theirs.cards).toBeUndefined();
    expect(theirs.n).toBe(1);
    expect(other.last().view.game.hand).toEqual(g.hands[playerOf(room, other.id)]);
    expect(other.last().view.game.hands).toBeNull();
    expect(other.last().view.game.drawn).toBeNull();
    room.dispose();
  });

  it("a game plays to the end: placed by points, recorded with stats", async () => {
    const { room, recorded } = await hostedTable(3);
    for (let i = 0; i < 2000 && room.phase === "playing"; i++) step(room);
    expect(room.phase).toBe("over");
    const res = recorded[0];
    expect(res).toMatchObject({ gameId: "wild_eights" });
    expect(res.players.map((p: any) => p.place).sort()).toEqual([1, 2, 3]);
    expect(res.players.find((p: any) => p.place === 1).stats.left).toBe(0);
    room.dispose();
  });

  it("an 8 names the suit; the next player must follow it", async () => {
    const { room } = await hostedTable(2);
    const g = room.game, p = g.turn;
    const eight = ["8S", "8H", "8D", "8C"].find((c) => !g.hands.flat().includes(c) && !g.pile.includes(c))!;
    g.hands[p].push(eight);
    room.handleRequest(mover(room), "wildeights:play", { card: eight, suit: "D" });
    expect(g.suit).toBe("D");
    expect(g.playable(g.turn).every((c: string) => rankOf(c) === "8" || suitOf(c) === "D" || rankOf(c) === rankOf(g.top))).toBe(true);
    room.dispose();
  });

  it("with two players, leaving is a forfeit; with three, the clock plays the leaver's turns", async () => {
    const two = await hostedTable(2);
    two.room.handleRequest("ann", "lobby:leave", {});
    expect(two.room.phase).toBe("over");
    expect(two.recorded[0].summary.forfeit).toBe(true);
    two.room.dispose();
    const three = await hostedTable(3);
    three.room.handleRequest("cy", "lobby:leave", {});
    expect(three.room.phase).toBe("playing");
    expect(three.peers[0]!.last().view.gone).toEqual([2]);
    for (let i = 0; i < 4000 && three.room.phase === "playing"; i++) {
      if (three.room.game.turn === 2) await until(() => three.room.game.turn !== 2 || three.room.phase !== "playing");
      else step(three.room);
    }
    expect(three.room.phase).toBe("over");
    three.room.dispose();
  });

  it("forfeiting a four-player game leaves the others playing; the forfeiter is placed last", async () => {
    const { room, recorded, peers } = await hostedTable(4, { timer: false, bots: false }, 6);
    room.handleRequest("ben", "wildeights:forfeit", {});
    expect(room.phase).toBe("playing");
    for (let i = 0; i < 6000 && room.phase === "playing"; i++) {
      if (room.game.turn === 1) await until(() => room.game.turn !== 1 || room.phase !== "playing");
      else step(room);
    }
    expect(room.phase).toBe("over");
    expect(recorded[0].players.find((p: any) => p.displayName === "Ben").place).toBe(4);
    void peers;
    room.dispose();
  });

  it("a player who left never wins: the clock only draws and passes for them", async () => {
    const { room } = await hostedTable(3);
    room.handleRequest("cy", "lobby:leave", {});
    const g = room.game;
    g.hands[2] = [g.top.slice(0, -1) === "K" ? "QS" : "KS"].filter((c: string) => !g.hands.flat().includes(c));
    for (let i = 0; i < 4000 && room.phase === "playing"; i++) {
      if (g.turn === 2) await until(() => g.turn !== 2 || room.phase !== "playing");
      else step(room);
    }
    expect(room.phase).toBe("over");
    expect(g.winner).not.toBe(2);
    room.dispose();
  });

  it("with the timer on, the clock plays for a silent player, so the game still ends", async () => {
    const { room, peers } = await hostedTable(2, { timer: true, bots: false }, 8);
    expect(peers[1]!.last().view.clock).toMatchObject({ seat: room.order[room.game.turn] });
    await until(() => room.phase === "over", 20000);
    expect(peers[1]!.notes.some((x) => x.data?.events?.some((e: any) => e.type === "play" && e.auto))).toBe(true);
    room.dispose();
  }, 25000);

  it("practice: bots take the other seats and play their turns", async () => {
    const { ctx, rooms } = fakeCtx();
    const lobby = new WildEightsLobby(ctx, { timing: FAST, ...seeded(3) });
    const me = peer("me");
    const t = (await lobby.handle(me, "wildeights:practice", { displayName: "Mia", settings: { seats: 3, botStyle: "sharp" } })) as any;
    const room = rooms.get(t.roomId);
    room.join(me);
    await until(() => room.phase === "playing");
    expect(room.settings).toMatchObject({ timer: false, botStyle: "sharp", seats: 3 });
    expect(room.seated().filter((s: any) => s.kind === "bot")).toHaveLength(2);
    const mine = playerOf(room, "me");
    await until(() => room.game.turn === mine || room.phase === "over");
    if (room.phase === "playing") { step(room); await until(() => room.game.turn === mine || room.phase === "over"); }
    expect(room.game.stats.reduce((a: number, s: any) => a + s.played + s.drawn, 0)).toBeGreaterThan(0);
    room.dispose();
  });

  it("the server waits at least as long as the page animates (EIGHTS_ART.ANIM in web/wild-eights.card.js)", () => {
    const w: any = {};
    vm.runInNewContext(fs.readFileSync("web/wild-eights.card.js", "utf8"), { window: w, document: { createElement: () => ({ getContext: () => null }) }, Ploto: { gameCard: () => {} } });
    expect(w.EIGHTS_ART.ANIM).toEqual(ANIM);
    expect(animBudget([{ type: "play", by: 0, card: "8S", suit: "H", left: 3 }])).toBeGreaterThanOrEqual(ANIM.play + ANIM.wild);
    expect(animBudget([{ type: "deal", counts: [5, 5, 5, 5], top: "4H", first: 0 }])).toBeGreaterThanOrEqual(20 * ANIM.deal);
  });
});
