import { describe, it, expect } from "vitest";
import { BOARDS, Mark, SHIPS, SeaBattleGame, cellsOf, fleetProblem, randomFleet, type Fleet, type SeaView } from "../src/game/sea_battle/engine.js";
import { botFleet, chooseShot, type BotLevel } from "../src/game/sea_battle/bot.js";
import { Rng } from "../src/game/matchmonsters/rng.js";

const rand = (seed: number) => { const r = new Rng(seed); return () => r.next(); };

/** A fixed classic fleet, ships in rows 0, 2, 4, 6, 8 from the left. */
const ROWS: Fleet = [
  { kind: "carrier", x: 0, y: 0, dir: "h" },
  { kind: "battleship", x: 0, y: 2, dir: "h" },
  { kind: "cruiser", x: 0, y: 4, dir: "h" },
  { kind: "submarine", x: 0, y: 6, dir: "h" },
  { kind: "destroyer", x: 0, y: 8, dir: "h" },
];

function started(seed = 1) {
  const g = new SeaBattleGame({ board: "classic", random: rand(seed) });
  expect(g.ready(0, ROWS).ok).toBe(true);
  expect(g.ready(1, ROWS).ok).toBe(true);
  return g;
}

describe("sea battle fleets", () => {
  it("accepts the board's fleet and refuses overlaps, touching, the wrong ships and the edge", () => {
    const spec = BOARDS.classic;
    expect(fleetProblem(spec, ROWS)).toBeNull();
    expect(fleetProblem(spec, ROWS.slice(1))).toMatch(/fleet/);
    expect(fleetProblem(spec, [...ROWS.slice(0, 4), { kind: "destroyer", x: 9, y: 9, dir: "h" }])).toMatch(/off the board/);
    expect(fleetProblem(spec, [...ROWS.slice(0, 4), { kind: "destroyer", x: 0, y: 7, dir: "h" }])).toMatch(/touch/); // right under the submarine
    expect(fleetProblem(spec, [...ROWS.slice(0, 4), { kind: "destroyer", x: 3, y: 7, dir: "h" }])).toMatch(/touch/); // the submarine's corner (2, 6)
    expect(fleetProblem(spec, [...ROWS.slice(0, 4), { kind: "destroyer", x: 4, y: 7, dir: "h" }])).toBeNull(); // one cell further: clear
  });

  it("random fleets are always legal, on both boards", () => {
    const r = rand(9);
    for (const board of ["classic", "quick"] as const) for (let i = 0; i < 500; i++) expect(fleetProblem(BOARDS[board], randomFleet(BOARDS[board], r))).toBeNull();
  });
});

describe("sea battle firing", () => {
  it("a coin flip picks the first shooter once both fleets are ready", () => {
    const g = new SeaBattleGame({ board: "classic", random: rand(3) });
    const r = g.ready(0, ROWS);
    expect(r.ok && r.events).toEqual([{ type: "ready", seat: 0 }]);
    expect(g.phase).toBe("placing");
    const r2 = g.ready(1, ROWS);
    expect(r2.ok && r2.events.at(-1)).toMatchObject({ type: "start" });
    expect(g.turn).toBe(g.first);
  });

  it("a miss passes the turn, a hit fires again, a sink shows the ship and marks the water around it", () => {
    const g = started();
    const a = g.turn!, b = 1 - a;
    expect(g.fire(b, 0, 0)).toMatchObject({ ok: false, reason: /turn/ });
    const miss = g.fire(a, 9, 9);
    expect(miss.ok && miss.events).toEqual([{ type: "shot", by: a, x: 9, y: 9, result: "miss" }, { type: "turn", seat: b }]);
    expect(g.fire(b, 9, 9).ok).toBe(true); // b misses too
    expect(g.fire(a, 9, 9)).toMatchObject({ ok: false, reason: /already/ });
    const hit = g.fire(a, 0, 8);
    expect(hit.ok && hit.events).toEqual([{ type: "shot", by: a, x: 0, y: 8, result: "hit" }]);
    expect(g.turn).toBe(a);
    const sink = g.fire(a, 1, 8);
    expect(sink.ok && sink.events[0]).toMatchObject({ type: "shot", result: "sunk", ship: { kind: "destroyer", x: 0, y: 8, dir: "h" } });
    const water = sink.ok && sink.events[0]!.type === "shot" ? sink.events[0]!.water! : [];
    expect(water).toHaveLength(7); // 3 above (row 7), 3 below (row 9), 1 to the right; the board's edge on the left
    expect(g.viewFor(a).outgoing[7 * 10 + 0]).toBe(Mark.Water);
    expect(g.turn).toBe(a);
  });

  it("sinking the whole fleet wins; the stats count shots, hits, sinks and the longest streak", () => {
    const g = started(5);
    const a = g.turn!;
    let last;
    for (const p of ROWS) for (const [x, y] of cellsOf(p)) last = g.fire(a, x, y);
    expect(last!.ok && last!.events.at(-1)).toEqual({ type: "over", winner: a });
    expect(g.phase).toBe("over");
    expect(g.viewFor(a).stats[a]).toEqual({ shots: 17, hits: 17, sunk: 5, streak: 17, bestStreak: 17 });
    expect(g.fire(a, 9, 9).ok).toBe(false);
  });

  it("views never show the rival's fleet until a ship is sunk (or the game is over)", () => {
    const g = started(7);
    const a = g.turn!;
    const before = g.viewFor(a);
    expect(before.rivalShips).toEqual([]);
    expect(before.outgoing.every((m) => m === Mark.Unknown)).toBe(true);
    g.fire(a, 0, 8);
    expect(g.viewFor(a).rivalShips).toEqual([]);
    g.fire(a, 1, 8);
    expect(g.viewFor(a).rivalShips.map((p) => p.kind)).toEqual(["destroyer"]);
    g.concede(1 - a);
    expect(g.viewFor(a).rivalShips).toHaveLength(5);
    expect(g.viewFor(a)).toMatchObject({ winner: a, forfeit: true });
  });

  it("the clock's shot is always a cell nobody has fired at", () => {
    const g = started(11);
    for (let i = 0; i < 100 && g.phase === "firing"; i++) {
      const seat = g.turn!;
      const [x, y] = g.randomTarget(seat);
      expect(g.viewFor(seat).outgoing[y * 10 + x]).toBe(Mark.Unknown);
      expect(g.fire(seat, x, y, true).ok).toBe(true);
    }
  });
});

/** Two bots play a whole game; checks every invariant on the way. */
function botGame(levels: [BotLevel, BotLevel], board: "classic" | "quick", seed: number) {
  const random = rand(seed);
  const g = new SeaBattleGame({ board, random });
  const spec = BOARDS[board];
  for (const s of [0, 1]) expect(g.ready(s, randomFleet(spec, random)).ok).toBe(true);
  const cells = spec.fleet.reduce((a, k) => a + SHIPS[k].length, 0);
  let shots = 0;
  while (g.phase === "firing") {
    const seat = g.turn!;
    const view = g.viewFor(seat);
    const [x, y] = chooseShot(view, levels[seat]!, random);
    const r = g.fire(seat, x, y);
    if (!r.ok) throw new Error(`bot fired an illegal shot: ${r.reason}`);
    shots++;
    if (shots > 2 * spec.size ** 2) throw new Error("game didn't end");
  }
  const w = g.winner!;
  expect(g.viewFor(w).stats[w]!.hits).toBe(cells);
  expect(g.viewFor(w).yourSunk.length).toBeLessThan(spec.fleet.length);
  return { winner: w, shots: g.viewFor(w).stats[w]!.shots, total: shots };
}

describe("sea battle simulation (bots)", () => {
  it("2,000 bot games all end legally; Hard beats Medium; Hard finishes in fewer shots", () => {
    let hardWins = 0, games = 0;
    const shotsBy: Record<BotLevel, number[]> = { medium: [], hard: [] };
    for (let i = 0; i < 2000; i++) {
      const board = i % 4 === 0 ? "quick" : "classic";
      const levels: [BotLevel, BotLevel] = i % 2 ? ["hard", "medium"] : ["medium", "hard"];
      const r = botGame(levels, board, 1000 + i);
      games++;
      if (levels[r.winner] === "hard") hardWins++;
      if (board === "classic") shotsBy[levels[r.winner]!].push(r.shots);
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(hardWins / games).toBeGreaterThan(0.6);
    expect(hardWins / games).toBeLessThan(0.95); // Medium still wins some
    expect(avg(shotsBy.hard)).toBeLessThan(avg(shotsBy.medium));
    expect(avg(shotsBy.hard)).toBeLessThan(55); // a classic game takes ~45 shots a side for Hard
  });
});

/** Open cells no ship still afloat fits through: the page dims them, so the stand-ins skip them as players would. */
function dimmed(v: SeaView): Set<number> {
  const n = v.size, out = new Set<number>();
  if (!v.rivalSunk.length) return out;
  const sunk = new Set(v.rivalShips.flatMap((p) => cellsOf(p).map(([x, y]) => y * n + x)));
  const left = [...v.fleetKinds];
  for (const k of v.rivalSunk) left.splice(left.indexOf(k), 1);
  const free = (x: number, y: number) => v.outgoing[y * n + x] === Mark.Unknown || (v.outgoing[y * n + x] === Mark.Hit && !sunk.has(y * n + x));
  const fits = new Set<number>();
  for (const L of new Set(left.map((k) => SHIPS[k].length))) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (x + dx * (L - 1) >= n || y + dy * (L - 1) >= n) continue;
    let ok = true;
    for (let i = 0; i < L && ok; i++) ok = free(x + dx * i, y + dy * i);
    if (ok) for (let i = 0; i < L; i++) fits.add((y + dy * i) * n + x + dx * i);
  }
  v.outgoing.forEach((m, c) => { if (m === Mark.Unknown && !fits.has(c)) out.add(c); });
  return out;
}

/**
 * A "good human" stand-in: hunts on a checkerboard, follows a line of hits to its ends,
 * otherwise tries the cells beside a hit. What a practised player does without counting.
 */
function goodHuman(v: SeaView, r: () => number): [number, number] {
  const dim = dimmed(v), n = v.size, open = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && v.outgoing[y * n + x] === Mark.Unknown && !dim.has(y * n + x);
  const sunk = new Set(v.rivalShips.flatMap((p) => cellsOf(p).map(([x, y]) => y * n + x)));
  const hits = v.outgoing.flatMap((m, c) => (m === Mark.Hit && !sunk.has(c) ? [[c % n, Math.floor(c / n)] as [number, number]] : []));
  const cand: [number, number][] = [];
  if (hits.length >= 2) {
    const across = hits.every((h) => h[1] === hits[0]![1]);
    const along = hits.map((h) => (across ? h[0] : h[1]));
    for (const q of [Math.min(...along) - 1, Math.max(...along) + 1]) { const [x, y] = across ? [q, hits[0]![1]] : [hits[0]![0], q]; if (open(x, y)) cand.push([x, y]); }
  }
  if (!cand.length) for (const [x, y] of hits) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(x + dx, y + dy)) cand.push([x + dx, y + dy]);
  if (cand.length) return cand[Math.floor(r() * cand.length)]!;
  const pool: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (open(x, y) && (x + y) % 2 === 0) pool.push([x, y]);
  if (!pool.length) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (open(x, y)) pool.push([x, y]);
  return pool[Math.floor(r() * pool.length)]!;
}

/** A casual player: random hunting (no checkerboard), but follows up hits. */
function casualHuman(v: SeaView, r: () => number): [number, number] {
  const dim = dimmed(v), n = v.size, open = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && v.outgoing[y * n + x] === Mark.Unknown && !dim.has(y * n + x);
  const sunk = new Set(v.rivalShips.flatMap((p) => cellsOf(p).map(([x, y]) => y * n + x)));
  const cand: [number, number][] = [];
  v.outgoing.forEach((m, c) => { if (m === Mark.Hit && !sunk.has(c)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = (c % n) + dx, y = Math.floor(c / n) + dy; if (open(x, y)) cand.push([x, y]); } });
  if (!cand.length) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (open(x, y)) cand.push([x, y]);
  return cand[Math.floor(r() * cand.length)]!;
}

describe("sea battle bot difficulty bands (against a good human stand-in)", () => {
  const rate = (level: BotLevel, board: "classic" | "quick", N: number, player = goodHuman) => {
    let humanWins = 0;
    for (let i = 0; i < N; i++) {
      const rng = new Rng(5000 + i), random = () => rng.next();
      const human = i % 2; // seats alternate
      const g = new SeaBattleGame({ board, random });
      for (const s of [0, 1]) g.ready(s, s === human ? randomFleet(BOARDS[board], random) : botFleet(board, level, random));
      while (g.phase === "firing") {
        const s = g.turn!, v = g.viewFor(s);
        const [x, y] = s === human ? player(v, random) : chooseShot(v, level, random);
        g.fire(s, x, y);
      }
      if (g.winner === human) humanWins++;
    }
    return humanWins / N;
  };
  it("a good player beats Medium more often than not, and Hard beats a good player most of the time", () => {
    for (const board of ["classic", "quick"] as const) {
      const vsMedium = rate("medium", board, 600), vsHard = rate("hard", board, 600);
      expect(vsMedium).toBeGreaterThan(0.5);
      expect(vsMedium).toBeLessThan(0.75);
      expect(vsHard).toBeGreaterThan(0.15);
      expect(vsHard).toBeLessThan(0.4);
    }
  });
  it("Medium never fires where the page shows no ship can be", () => {
    for (let i = 0; i < 200; i++) {
      const rng = new Rng(9000 + i), random = () => rng.next();
      const g = new SeaBattleGame({ board: i % 2 ? "quick" : "classic", random });
      for (const s of [0, 1]) g.ready(s, randomFleet(g.spec, random));
      while (g.phase === "firing") {
        const s = g.turn!, v = g.viewFor(s);
        const [x, y] = chooseShot(v, "medium", random);
        expect(dimmed(v).has(y * v.size + x)).toBe(false);
        g.fire(s, x, y);
      }
    }
  });
  it("a casual player still wins a fair share against Medium on the quick board", () => {
    expect(rate("medium", "quick", 600, casualHuman)).toBeGreaterThan(0.3); // about 1 in 3
  });
});
