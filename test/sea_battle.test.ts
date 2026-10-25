import { describe, it, expect } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import { SeaBattleLobby } from "../src/game/sea_battle/lobby.js";
import { parseSettings, DEFAULT_SETTINGS, animBudget } from "../src/game/sea_battle/room.js";
import { BOARDS, Mark, SHIPS, cellsOf, fits, fleetProblem, randomFleet, type Fleet } from "../src/game/sea_battle/engine.js";
import { hiding } from "../src/game/sea_battle/bot.js";
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
const peer = (id: string) => ({ id, notes: [] as { method: string; data: any }[], notify(method: string, data: unknown) { this.notes.push({ method, data }); }, last() { return this.notes.filter((x) => x.method === "seabattle:update").at(-1)?.data; } });
const FAST = { placeMs: 60, turnMs: 40, awayMs: 30, botMs: [1, 2] as const, botFollowMs: [1, 2] as const, botAfterSinkMs: [1, 2] as const, botPlaceMs: [1, 3] as const, quickStartMs: 30, animScale: 0 };
const until = async (cond: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await new Promise((res) => setTimeout(res, 2));
  }
};
const seeded = (seed: number) => { const r = new Rng(seed); return { random: () => r.next() }; };

const ROWS: Fleet = [
  { kind: "carrier", x: 0, y: 0, dir: "h" },
  { kind: "battleship", x: 0, y: 2, dir: "h" },
  { kind: "cruiser", x: 0, y: 4, dir: "h" },
  { kind: "submarine", x: 0, y: 6, dir: "h" },
  { kind: "destroyer", x: 0, y: 8, dir: "h" },
];

async function hostedPair(timing = FAST) {
  const { ctx, rooms, recorded } = fakeCtx();
  const lobby = new SeaBattleLobby(ctx, { timing, ...seeded(4) });
  const a = peer("a"), b = peer("b");
  const hosted = (await lobby.handle(a, "seabattle:host", { displayName: "Ann", settings: { board: "classic", timer: false } })) as any;
  const room = rooms.get(hosted.roomId);
  room.join(a);
  await lobby.handle(b, "seabattle:join", { displayName: "Ben", code: hosted.code });
  room.join(b);
  return { room, rooms, recorded, a, b };
}

describe("Sea Battle settings", () => {
  it("clamps settings to what the game offers; a client can't turn bots on", () => {
    expect(parseSettings({ board: "huge", timer: "yes", botStyle: "wild", bots: true })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ board: "quick", timer: false, botStyle: "sharp" })).toMatchObject({ board: "quick", timer: false, botStyle: "sharp", bots: false });
  });
});

describe("Sea Battle room", () => {
  it("starts when the friend joins, deals each a random fleet to place, and starts firing once both are ready", async () => {
    const { room, a, b } = await hostedPair();
    expect(room.phase).toBe("playing");
    const va = a.last().view;
    expect(va.game.phase).toBe("placing");
    expect(va.draft).toHaveLength(5);
    expect(JSON.stringify(va)).not.toContain(JSON.stringify(b.last().view.draft)); // never the rival's fleet
    room.handleRequest("a", "seabattle:ready", { fleet: ROWS });
    expect(() => room.handleRequest("a", "seabattle:ready", { fleet: ROWS })).toThrow(/already/);
    expect(() => room.handleRequest("b", "seabattle:ready", { fleet: ROWS.slice(1) })).toThrow(/fleet/);
    room.handleRequest("b", "seabattle:ready", {}); // the dealt fleet
    const v = a.last();
    expect(v.view.game.phase).toBe("firing");
    expect(v.events.map((e: any) => e.type)).toEqual(["ready", "start"]);
    room.dispose();
  });

  it("plays to the end: hits fire again, the winner is recorded with stats, and a rematch opens", async () => {
    const { room, rooms, recorded, a, b } = await hostedPair();
    room.handleRequest("a", "seabattle:ready", { fleet: ROWS });
    room.handleRequest("b", "seabattle:ready", { fleet: ROWS });
    const first = room.game.turn as number;
    const shooter = first === 0 ? "a" : "b";
    expect(() => room.handleRequest(first === 0 ? "b" : "a", "seabattle:fire", { x: 0, y: 0 })).toThrow(/turn/);
    for (const p of ROWS) for (const [x, y] of cellsOf(p)) room.handleRequest(shooter, "seabattle:fire", { x, y });
    expect(room.phase).toBe("over");
    expect(recorded[0]).toMatchObject({ gameId: "sea_battle", players: [{ place: 1, stats: { accuracy: 100, bestStreak: 17, sunk: 5, shots: 17 } }, { place: 2 }] });
    const loser = (shooter === "a" ? b : a).last().view;
    expect(loser.results[0]).toMatchObject({ name: shooter === "a" ? "Ann" : "Ben", place: 1 });
    expect(loser.game.rivalShips).toHaveLength(5); // the whole fleet shows once it's over
    const next = room.handleRequest("b", "lobby:rematch", {});
    expect(rooms.get(next.roomId).seated()[0]).toMatchObject({ name: "Ben", kind: "player" });
    for (const r of rooms.values()) r.dispose();
  });

  it("in the rematch the loser fires first, found by connection even when both players share a name", async () => {
    for (const seed of [4, 5, 6, 7, 8, 9]) { // several coin flips, so a lucky one can't pass it
      const { ctx, rooms } = fakeCtx();
      const lobby = new SeaBattleLobby(ctx, { timing: FAST, ...seeded(seed) });
      const a = peer("a"), b = peer("b");
      const hosted = (await lobby.handle(a, "seabattle:host", { displayName: "Player", settings: { board: "classic", timer: false } })) as any;
      const room = rooms.get(hosted.roomId);
      room.join(a);
      await lobby.handle(b, "seabattle:join", { displayName: "Player", code: hosted.code });
      room.join(b);
      room.handleRequest("a", "seabattle:ready", { fleet: ROWS });
      room.handleRequest("b", "seabattle:ready", { fleet: ROWS });
      const winner = room.game.turn as number, shooter = winner === 0 ? "a" : "b", loserPeer = winner === 0 ? "b" : "a";
      for (const p of ROWS) for (const [x, y] of cellsOf(p)) room.handleRequest(shooter, "seabattle:fire", { x, y });
      const next = room.handleRequest(shooter, "lobby:rematch", {});
      room.handleRequest(loserPeer, "lobby:rematch", {});
      const again = rooms.get(next.roomId);
      again.join(a); again.join(b);
      await until(() => again.game?.phase === "placing");
      again.handleRequest("a", "seabattle:ready", { fleet: ROWS });
      again.handleRequest("b", "seabattle:ready", { fleet: ROWS });
      const loserSeat = again.seated().findIndex((s: any) => s.peerId === loserPeer);
      expect(again.game.turn).toBe(loserSeat);
      for (const r of rooms.values()) r.dispose();
    }
  });

  it("nothing secret reaches the rival over the wire: no fleet, draft or unsunk ship of the other seat", async () => {
    const { room, b } = await hostedPair();
    // Any of Ann's ships, exactly as placed, in what Ben receives is a leak.
    const ann: Fleet = [
      { kind: "carrier", x: 0, y: 0, dir: "v" }, { kind: "battleship", x: 2, y: 0, dir: "v" }, { kind: "cruiser", x: 4, y: 0, dir: "v" },
      { kind: "submarine", x: 6, y: 0, dir: "v" }, { kind: "destroyer", x: 8, y: 0, dir: "v" },
    ];
    room.handleRequest("a", "seabattle:draft", { fleet: ann });
    room.handleRequest("a", "seabattle:ready", { fleet: ann });
    room.handleRequest("b", "seabattle:ready", { fleet: ROWS });
    // A few shots each way: Ben hits Ann's carrier (never sinking it), Ann misses.
    let benShots = 0;
    for (let i = 0; i < 12 && room.game.phase === "firing" && benShots < 3; i++) {
      if (room.game.turn === 1) { room.handleRequest("b", "seabattle:fire", { x: 0, y: benShots }); benShots++; }
      else room.handleRequest("a", "seabattle:fire", { x: 9, y: 9 - i });
    }
    expect(benShots).toBe(3);
    const updates = b.notes.filter((x) => x.method === "seabattle:update");
    expect(updates.length).toBeGreaterThan(3);
    for (const note of updates) {
      const text = JSON.stringify(note.data);
      for (const ship of ann) expect(text).not.toContain(JSON.stringify(ship));
      for (const e of note.data.events ?? []) if (e.type === "shot" && e.result === "hit") expect(e.ship).toBeUndefined(); // a hit never names the ship
    }
    room.dispose();
  });

  it("leaving mid-game is a forfeit", async () => {
    const { room, recorded, b } = await hostedPair();
    room.handleRequest("a", "seabattle:ready", { fleet: ROWS });
    room.handleRequest("a", "lobby:leave", {});
    expect(room.phase).toBe("over");
    expect(b.last().view.game).toMatchObject({ winner: 1, forfeit: true });
    expect(recorded[0].summary.forfeit).toBe(true);
    room.dispose();
  });

  it("with the timer on, clocks place your fleet and fire for you, so a silent game still ends", async () => {
    const { ctx, rooms } = fakeCtx();
    const lobby = new SeaBattleLobby(ctx, { timing: FAST, ...seeded(8) });
    const a = peer("a"), b = peer("b");
    const hosted = (await lobby.handle(a, "seabattle:host", { displayName: "Ann", settings: { board: "quick", timer: true } })) as any;
    const room = rooms.get(hosted.roomId);
    room.join(a);
    await lobby.handle(b, "seabattle:join", { displayName: "Ben", code: hosted.code });
    room.join(b);
    await until(() => room.game?.phase === "firing");
    expect(a.last().view.clock).toMatchObject({ seat: room.game.turn });
    await until(() => room.phase === "over", 15000);
    expect(a.notes.some((n) => n.data?.events?.some((e: any) => e.type === "shot" && e.auto))).toBe(true);
    room.dispose();
  });

  it("a player who drops gets the away clock (timer off): it fires for them, and they come back to the same game", async () => {
    const { room, a, b } = await hostedPair();
    room.handleRequest("a", "seabattle:ready", { fleet: ROWS });
    room.handleRequest("b", "seabattle:ready", { fleet: ROWS });
    const seat = room.game.turn as number;
    const [gone, stays] = seat === 0 ? [a, b] : [b, a];
    room.leave(gone); // the socket closed
    expect(stays.last().view.clock).toMatchObject({ seat }); // no timer, but a disconnected player gets the away clock
    await until(() => room.game.sides[seat].stats.shots > 0);
    expect(stays.notes.some((n) => n.data?.events?.some((e: any) => e.type === "shot" && e.auto && e.by === seat))).toBe(true);
    room.join(gone); // back
    const v = room.handleRequest(gone.id, "seabattle:getState", {}) as any;
    expect(v.game.phase).toBe("firing");
    expect(v.game.fleet).toHaveLength(5);
    expect(v.game.stats[seat].shots).toBeGreaterThan(0);
    room.dispose();
  });

  it("reconnecting while placing gives you back the fleet you were working on", async () => {
    const { room, a } = await hostedPair();
    const moved = [...ROWS.slice(0, 4), { kind: "destroyer", x: 5, y: 9, dir: "h" }];
    room.handleRequest("a", "seabattle:draft", { fleet: moved });
    expect(() => room.handleRequest("a", "seabattle:draft", { fleet: ROWS.slice(1) })).toThrow(/fleet/);
    room.leave(a);
    room.join(a);
    expect((room.handleRequest("a", "seabattle:getState", {}) as any).draft).toEqual(moved);
    room.dispose();
  });

  it("practice: you against a bot that places, aims and fires on its own (the setup's board and difficulty hold)", async () => {
    const { ctx, rooms } = fakeCtx();
    const lobby = new SeaBattleLobby(ctx, { timing: FAST, ...seeded(2) });
    const me = peer("me");
    const t = (await lobby.handle(me, "seabattle:practice", { displayName: "Mia", settings: { board: "quick", botStyle: "sharp", timer: true } })) as any;
    const room = rooms.get(t.roomId);
    expect(room.settings).toMatchObject({ board: "quick", botStyle: "sharp", timer: false, bots: true });
    room.join(me);
    expect(room.phase).toBe("playing");
    await until(() => room.game.sides[1].ready);
    room.handleRequest("me", "seabattle:ready", {});
    // Mia fires at every cell in order whenever it's her turn; the bot answers on its own.
    let cell = 0;
    await until(() => {
      if (room.phase === "over") return true;
      if (room.game.turn === 0) {
        while (room.game.viewFor(0).outgoing[cell] !== Mark.Unknown) cell++;
        room.handleRequest("me", "seabattle:fire", { x: cell % 8, y: Math.floor(cell / 8) });
      }
      return false;
    }, 20000);
    expect(room.game.viewFor(0).stats[1].shots).toBeGreaterThan(0);
    room.dispose();
  });

  it("quick play: a bot takes the seat when nobody comes", async () => {
    const { ctx, rooms } = fakeCtx();
    const lobby = new SeaBattleLobby(ctx, { timing: FAST, ...seeded(3) });
    const me = peer("me");
    const t = (await lobby.handle(me, "seabattle:quick", { displayName: "Qia" })) as any;
    const room = rooms.get(t.roomId);
    room.join(me);
    await until(() => room.phase === "playing");
    expect(room.seated().map((s: any) => s.kind)).toEqual(["player", "bot"]);
    room.dispose();
  });
});

/** web/sea-battle.card.js in a bare VM (no canvas needed for its rules and timings). */
function pageModule() {
  const win: any = {};
  const doc = { createElement: () => ({ style: {}, textContent: "" }), head: { appendChild: () => {} } };
  vm.runInNewContext(fs.readFileSync("web/sea-battle.card.js", "utf8"), { window: win, document: doc });
  return win;
}

describe("Sea Battle's page and server agree", () => {
  const { SEA_ART, SEA_RULES } = pageModule();

  it("the server waits at least as long as the page animates each event (so clocks and bots never start early)", () => {
    const T = SEA_ART.ANIM;
    const aim = T.aimHops * T.aimHop + T.aimLock + T.shell; // the longest path: an incoming shot
    const miss = aim + T.splash + T.missHold;
    const hit = aim + T.hitStop + T.hitHold;
    const sink = (len: number) => aim + T.sinkStopBase + T.sinkStopPerCell * len + T.burst + T.plate * len + T.crack + T.halves + T.halvesPerCell * len + T.stampHold + 4 * T.ring;
    expect(animBudget([{ type: "shot", by: 0, x: 0, y: 0, result: "miss" }])).toBeGreaterThanOrEqual(miss);
    expect(animBudget([{ type: "shot", by: 0, x: 0, y: 0, result: "hit" }])).toBeGreaterThanOrEqual(hit);
    for (const kind of ["destroyer", "cruiser", "battleship", "carrier"] as const) {
      expect(animBudget([{ type: "shot", by: 0, x: 0, y: 0, result: "sunk", ship: { kind, x: 0, y: 0, dir: "h" }, water: [] }])).toBeGreaterThanOrEqual(sink(SHIPS[kind].length));
    }
    expect(animBudget([{ type: "start", first: 0 }])).toBeGreaterThanOrEqual(T.coinSpin + T.coinLabel + T.swap);
    expect(animBudget([{ type: "turn", seat: 0 }])).toBeGreaterThanOrEqual(T.swap + T.turnHold);
  });

  it("the page's placement rules and hiding meter match the engine and the bots", () => {
    const r = new Rng(12);
    const random = () => r.next();
    for (const board of ["classic", "quick"] as const) {
      for (let i = 0; i < 200; i++) {
        const fleet = randomFleet(BOARDS[board], random);
        expect(SEA_RULES.hiding(board, fleet)).toBeCloseTo(hiding(BOARDS[board], fleet), 10);
        // Move one ship somewhere random: the page and the engine agree on whether it fits.
        const kind = fleet[i % fleet.length]!.kind;
        const p = { kind, x: Math.floor(random() * 10) - 1, y: Math.floor(random() * 10) - 1, dir: random() < 0.5 ? "h" : "v" } as const;
        expect(SEA_RULES.fits(BOARDS[board].size, fleet, p)).toBe(fits(BOARDS[board], fleet, p));
        const pageFleet = SEA_RULES.randomFleet(board, random);
        expect(fleetProblem(BOARDS[board], pageFleet)).toBeNull();
      }
    }
  });
});
