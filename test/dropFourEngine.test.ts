import { describe, it, expect } from "vitest";
import { COLS, ROWS, DropFourGame, findLine, height, type Grid } from "../src/game/drop_four/engine.js";
import { LEVELS, chooseMove, type BotLevel, type Style } from "../src/game/drop_four/bot.js";
import { Rng } from "../src/game/matchmonsters/rng.js";

const seeded = (seed: number) => { const r = new Rng(seed); return () => r.next(); };
const empty = (): Grid => Array.from({ length: COLS }, () => new Array(ROWS).fill(0)) as Grid;
const game = (opts: { bombs?: boolean; first?: number } = {}) => new DropFourGame({ random: seeded(1), bombs: opts.bombs ?? true, first: opts.first ?? 0 });
/** Play columns alternately from seat 0 (no bombs). */
const play = (g: DropFourGame, cols: number[]) => { for (const c of cols) { const r = g.drop(g.turn!, c); if (!r.ok) throw new Error(r.reason); } };

describe("drop four rules", () => {
  it("discs fall to the lowest free spot and turns alternate", () => {
    const g = game();
    play(g, [3, 3, 3]);
    expect(g.grid[3]!.slice(0, 4)).toEqual([1, 2, 1, 0]);
    expect(g.turn).toBe(1);
    expect(g.drop(0, 2).ok).toBe(false); // not your turn
  });
  it("four in a row wins across, down and on both diagonals", () => {
    const across = game(); play(across, [0, 0, 1, 1, 2, 2, 3]);
    expect(across.winner).toBe(0);
    expect(across.line).toHaveLength(4);
    const down = game(); play(down, [0, 1, 0, 1, 0, 1, 0]);
    expect(down.winner).toBe(0);
    const diag = game(); play(diag, [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(diag.winner).toBe(0);
    const anti = game(); play(anti, [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
    expect(anti.winner).toBe(0);
  });
  it("a full column is refused; a full grid with no line is a draw", () => {
    const g = game({ bombs: false });
    play(g, [0, 0, 0, 0, 0, 0]);
    expect(g.drop(0, 0)).toMatchObject({ ok: false });
    // A known drawn fill: columns in an order that never makes four.
    const d = game({ bombs: false });
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    for (const c of order) { if (d.phase !== "playing") break; d.drop(d.turn!, c); }
    expect(d.phase).toBe("over");
    expect(d.draw).toBe(true);
    expect(d.winner).toBeNull();
  });
  it("a bomb clears itself and its left, right and lower neighbours; discs above fall", () => {
    const h = game();
    h.grid = empty();
    h.grid[2]![0] = 1; h.grid[2]![1] = 2; h.grid[2]![2] = 1; // column C: three discs
    h.grid[3]![0] = 2; h.grid[3]![1] = 1;                    // column D: two
    h.grid[4]![0] = 1;                                        // column E: one
    h.turn = 1;
    const r = h.drop(1, 3, true); // lands on D3: clears itself, C3 (left), D2 (below); E3 is empty
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.find((e) => e.type === "blast")).toMatchObject({ col: 3, row: 2 });
    expect(h.grid[3]!.slice(0, 3)).toEqual([2, 0, 0]);
    expect(h.grid[2]!.slice(0, 3)).toEqual([1, 2, 0]);
    expect(h.grid[4]!.slice(0, 2)).toEqual([1, 0]);
    expect(h.bombs).toEqual([true, false]);
    expect(h.drop(0, 0, true).ok).toBe(true); // seat 0 still has its own
    expect(h.drop(1, 0, true)).toMatchObject({ ok: false, reason: "you've used your bomb" });
  });
  it("a fall that makes four wins it: for the bomber, or else for the rival", () => {
    // Rival's line: seat 1 bombs E2, clearing D2; seat 0's disc on D3 falls into A2–D2.
    const a = game();
    a.grid = empty();
    a.grid[0]![0] = 2; a.grid[1]![0] = 1; a.grid[2]![0] = 2;
    a.grid[0]![1] = 1; a.grid[1]![1] = 1; a.grid[2]![1] = 1;
    a.grid[3]![0] = 2; a.grid[3]![1] = 2; a.grid[3]![2] = 1;
    a.grid[4]![0] = 2;
    a.turn = 1;
    expect(a.drop(1, 4, true).ok).toBe(true);
    expect(a).toMatchObject({ phase: "over", winner: 0 });
    // Bomber's line: the same, with seat 1's disc on D3 falling into its own A2–C2.
    const b = game();
    b.grid = empty();
    b.grid[0]![0] = 1; b.grid[1]![0] = 2; b.grid[2]![0] = 1;
    b.grid[0]![1] = 2; b.grid[1]![1] = 2; b.grid[2]![1] = 2;
    b.grid[3]![0] = 1; b.grid[3]![1] = 1; b.grid[3]![2] = 2;
    b.grid[4]![0] = 1;
    b.turn = 1;
    expect(b.drop(1, 4, true).ok).toBe(true);
    expect(b).toMatchObject({ phase: "over", winner: 1 });
    expect(b.line).toHaveLength(4);
  });
  it("conceding ends it for the other seat; the clock's column is never full", () => {
    const g = game();
    play(g, [0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < 50; i++) expect(height(g.grid, g.randomColumn())).toBeLessThan(ROWS);
    expect(g.concede(0)).toMatchObject({ ok: true });
    expect(g).toMatchObject({ winner: 1, forfeit: true, phase: "over" });
  });
});

/** Bot vs bot (or stand-in), returning the winner (null: draw) and checking invariants after every move. */
function botGame(levels: [BotLevel | Style, BotLevel | Style], seed: number, bombs = true): number | null {
  const random = seeded(seed);
  const g = new DropFourGame({ random, bombs });
  let moves = 0;
  while (g.phase === "playing") {
    const s = g.turn!;
    const m = chooseMove(g.viewFor(s), levels[s]!, random);
    const r = g.drop(s, m.col, m.bomb);
    if (!r.ok) throw new Error(`illegal bot move: ${r.reason}`);
    // Gravity holds: no gaps under a disc (checked plainly: an expect per cell is slow).
    for (let c = 0; c < COLS; c++) { const h = height(g.grid, c); for (let r2 = h; r2 < ROWS; r2++) if (g.grid[c]![r2] !== 0) throw new Error("a disc floats"); }
    if (++moves > 80) throw new Error("the game never ends");
  }
  return g.winner;
}

describe("drop four simulation (bots)", () => {
  it("1,000 bot games end legally, with gravity intact after every move; Hard beats Medium", () => {
    for (let i = 0; i < 1000; i++) botGame(["medium", "medium"], 100 + i, i % 5 !== 0); // a fifth with bombs off
    let hard = 0;
    for (let i = 0; i < 80; i++) {
      const levels: [BotLevel, BotLevel] = i % 2 ? ["hard", "medium"] : ["medium", "hard"];
      const w = botGame(levels, 5000 + i);
      if (w !== null && levels[w] === "hard") hard++;
    }
    expect(hard / 80).toBeGreaterThan(0.6);
  }, 120_000);
});

/** Stand-ins built on the same search: a good player reads 4 moves ahead and rarely slips; a casual one reads 1 and slips often. */
const GOOD: Style = { depth: 4, budget: 3000, win: 0.97, block: 0.92, slip: 0.15, bombSave: 0.6 };
const CASUAL: Style = { depth: 1, budget: 500, win: 0.85, block: 0.6, slip: 0.4, bombSave: 0.2 };

describe("drop four bot difficulty bands", () => {
  const rate = (who: Style, level: BotLevel, N: number) => {
    let w = 0;
    for (let i = 0; i < N; i++) { const human = i % 2; const lv: [BotLevel | Style, BotLevel | Style] = human ? [level, who] : [who, level]; if (botGame(lv, 7000 + i) === human) w++; }
    return w / N;
  };
  it("a good player beats Medium about half the time or more; Hard beats a good player most of the time; casual players can beat Medium", () => {
    const goodVsMedium = rate(GOOD, "medium", 200), goodVsHard = rate(GOOD, "hard", 80), casualVsMedium = rate(CASUAL, "medium", 200);
    expect(goodVsMedium).toBeGreaterThan(0.45);
    expect(goodVsHard).toBeLessThan(0.4);
    expect(casualVsMedium).toBeGreaterThan(0.25);
    void LEVELS;
  }, 120_000);
});
