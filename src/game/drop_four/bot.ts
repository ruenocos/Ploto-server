/**
 * Drop Four's bots: negamax with alpha-beta pruning on a flat board (centre columns
 * first), scoring leaves by the open windows of four each side has. A node budget
 * caps the work, so a move never takes long and is the same on every machine
 * (iterative deepening: the deepest search that finished within the budget wins).
 *
 *   hard    searches up to 8 moves ahead (40,000 positions at most: about 40 ms),
 *           never misses a win or a block, never leaves a move the rival's bomb
 *           can win from, and weighs its own bomb: it bombs to win, or to break
 *           a position it would otherwise lose.
 *   medium  looks one move ahead: it always takes a four it can see and blocks
 *           most threats, but misses setups, and often plays one of its next
 *           few moves instead of the best (never one that hands you a win).
 *           It bombs to win, and sometimes to stop a loss.
 */
import { COLS, DropFourGame, ROWS, type Cell, type DropView, type Grid, type RandomSource } from "./engine.js";

export type BotLevel = "medium" | "hard";
export type BotMove = { col: number; bomb: boolean };

const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;
const idx = (c: number, r: number) => c * ROWS + r;
/** Every window of four, as cell indices (for the leaf score). */
const WINDOWS: number[][] = [];
for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]] as const) {
    const ec = c + 3 * dc, er = r + 3 * dr;
    if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
    WINDOWS.push([0, 1, 2, 3].map((i) => idx(c + i * dc, r + i * dr)));
  }
}

const FLAT = Int32Array.from(WINDOWS.flat());

/** A search position: cells (0 / 1 / 2), column heights, discs played. */
class Board {
  cells: Uint8Array;
  h: Uint8Array;
  n: number;
  constructor(g: Grid) {
    this.cells = new Uint8Array(COLS * ROWS);
    this.h = new Uint8Array(COLS);
    this.n = 0;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const v = g[c]![r]!;
      this.cells[idx(c, r)] = v;
      if (v) { this.h[c] = r + 1; this.n++; }
    }
  }
  /** Would a disc of `who` in column c make four? */
  wins(c: number, who: number): boolean {
    const r = this.h[c]!;
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]] as const) {
      let k = 1;
      for (const s of [1, -1]) {
        let x = c + dc * s, y = r + dr * s;
        while (x >= 0 && x < COLS && y >= 0 && y < ROWS && this.cells[idx(x, y)] === who) { k++; x += dc * s; y += dr * s; }
      }
      if (k >= 4) return true;
    }
    return false;
  }
  play(c: number, who: number) { this.cells[idx(c, this.h[c]!)] = who; this.h[c]!++; this.n++; }
  undo(c: number) { this.h[c]!--; this.cells[idx(c, this.h[c]!)] = 0; this.n--; }
  score(me: number): number {
    const them = 3 - me;
    let s = 0;
    for (let r = 0; r < ROWS; r++) { const v = this.cells[idx(3, r)]; if (v === me) s += 3; else if (v === them) s -= 3; }
    const cells = this.cells;
    for (let j = 0; j < FLAT.length; j += 4) {
      let m = 0, t = 0;
      for (let q = j; q < j + 4; q++) { const v = cells[FLAT[q]!]; if (v === me) m++; else if (v === them) t++; }
      if (m && t) continue;
      if (m === 3) s += 50; else if (m === 2) s += 8;
      else if (t === 3) s -= 60; else if (t === 2) s -= 8;
    }
    return s;
  }
}

class Search {
  nodes = 0;
  constructor(readonly b: Board, readonly budget: number) {}
  /** Negamax for `who` to move. Throws "budget" when out of nodes. */
  negamax(who: number, depth: number, alpha: number, beta: number): number {
    if (++this.nodes > this.budget) throw new Error("budget");
    const b = this.b;
    if (b.n >= COLS * ROWS) return 0;
    for (const c of ORDER) if (b.h[c]! < ROWS && b.wins(c, who)) return WIN + depth;
    if (depth === 0) return b.score(who);
    let best = -Infinity;
    for (const c of ORDER) {
      if (b.h[c]! >= ROWS) continue;
      b.play(c, who);
      const v = -this.negamax(3 - who, depth - 1, -beta, -alpha);
      b.undo(c);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  /**
   * Each legal drop for `who`, scored at `depth`. `narrow`: share the best score found so far
   * across the root columns (a column that can't beat it scores at most that much): deeper in the
   * same budget, at the cost of exact scores for the also-rans (Hard doesn't slip, so it doesn't need them).
   */
  columns(who: number, depth: number, narrow = false): { col: number; v: number }[] {
    const out: { col: number; v: number }[] = [];
    let alpha = -Infinity;
    for (const c of ORDER) {
      if (this.b.h[c]! >= ROWS) continue;
      if (this.b.wins(c, who)) { out.push({ col: c, v: WIN * 2 }); alpha = WIN * 2; continue; }
      this.b.play(c, who);
      const v = -this.negamax(3 - who, depth - 1, -Infinity, narrow ? -(alpha - 1) : Infinity);
      this.b.undo(c);
      out.push({ col: c, v: narrow && v <= alpha - 1 && alpha > -Infinity ? Math.min(v, alpha - 1) : v });
      if (v > alpha) alpha = v;
    }
    return out;
  }
}

/** The deepest full scoring of the columns that fits one node budget, shared by every depth (depth 1 always fits). */
function scoreColumns(g: Grid, who: number, maxDepth: number, budget: number, narrow = false): { col: number; v: number }[] {
  const s = new Search(new Board(g), budget);
  let best = new Search(new Board(g), Infinity).columns(who, 1);
  for (let d = 2; d <= maxDepth; d++) {
    try { best = s.columns(who, d, narrow); } catch { break; }
  }
  return best;
}

/** What a bomb in `col` would leave and who'd win (without touching the view). */
function bombResult(view: DropView, col: number, seat: number): { grid: Grid; winner: number | null } | null {
  const game = new DropFourGame({ random: () => 0, bombs: true, first: seat });
  game.grid = view.grid.map((c) => [...c]) as Grid;
  game.moves = [view.moves[0], view.moves[1]];
  const r = game.drop(seat, col, true);
  if (!r.ok) return null;
  return { grid: game.grid, winner: game.winner };
}

/**
 * How each level plays: how far it looks (`depth`, within `budget` nodes), how often it takes a win
 * (`win`) or blocks one (`block`), how often it plays a safe move that isn't the best (`slip`), and
 * whether it weighs its bomb when losing (`bombSave`: the chance it does).
 */
export interface Style { readonly depth: number; readonly budget: number; readonly win: number; readonly block: number; readonly slip: number; readonly bombSave: number; readonly bombSee?: number; readonly rivalBomb?: boolean }
export const LEVELS: Record<BotLevel, Style> = {
  // Hard also never leaves a move the rival's bomb can win from.
  hard: { depth: 8, budget: 40_000, win: 1, block: 1, slip: 0, bombSave: 1, bombSee: 1, rivalBomb: true },
  // Medium sees a bomb win half the time (people miss them), blocks most threats, misses setups.
  medium: { depth: 1, budget: 2_000, win: 1, block: 0.85, slip: 0.45, bombSave: 0.5, bombSee: 0.5 },
};

export function chooseMove(view: DropView, level: BotLevel | Style, random: RandomSource): BotMove {
  const st = typeof level === "string" ? LEVELS[level] : level;
  const seat = view.you, me = (seat + 1) as Cell, them = (2 - seat) as Cell;
  const grid = view.grid as Grid;
  const depth = st.depth;
  const scored = scoreColumns(grid, me, depth, st.budget).sort((a, b) => b.v - a.v);
  const winNow = scored.find((s) => s.v >= WIN * 2);
  const board = new Board(grid);
  const threat = ORDER.find((c) => board.h[c]! < ROWS && board.wins(c, them));
  if (view.bombs[seat]) {
    if (!winNow && random() < (st.bombSee ?? 1)) for (const c of ORDER) { const b = bombResult(view, c, seat); if (b?.winner === seat) return { col: c, bomb: true }; }
    const losing = scored.length && scored[0]!.v <= -WIN;
    if (losing && random() < st.bombSave) {
      let best: { col: number; v: number } | null = null;
      for (const c of ORDER) {
        const b = bombResult(view, c, seat);
        if (!b || b.winner === 1 - seat) continue;
        // After the bomb it's the rival to move: score it from their side, a shallower look.
        let v: number;
        if (b.winner === seat) v = WIN * 2;
        else {
          const s = new Search(new Board(b.grid), st.budget / 4);
          try { v = -s.negamax(them, Math.min(depth, 6) - 1, -Infinity, Infinity); } catch { v = -new Board(b.grid).score(them); }
        }
        if (!best || v > best.v) best = { col: c, v };
      }
      if (best && best.v > scored[0]!.v) return { col: best.col, bomb: true };
    }
  }
  if (winNow && random() < st.win) return { col: winNow.col, bomb: false };
  if (threat !== undefined && random() < st.block) return { col: threat, bomb: false };
  if (random() < st.slip) {
    // A safe move that isn't the best: one of the next few by its score (weighted to the better ones),
    // never one that hands the rival a win next turn. People miss setups; they don't throw.
    const ok = scored.filter((s) => s.v > -WIN).slice(0, 3);
    if (ok.length) { const w = [0.6, 0.3, 0.1].slice(0, ok.length), t = random() * w.reduce((a, b) => a + b, 0); let acc = 0; for (let i = 0; i < ok.length; i++) { acc += w[i]!; if (t <= acc) return { col: ok[i]!.col, bomb: false }; } }
  }
  let top = scored.filter((s) => s.v === scored[0]!.v);
  if (st.rivalBomb && view.bombs[1 - seat] && view.moves[1 - seat]! >= 2) {
    // Don't hand the rival a bomb win: of the best moves (then the rest, best first), take one their bomb can't win from.
    const safe = (col: number) => {
      const after = view.grid.map((c) => [...c]) as Grid;
      after[col]![after[col]!.indexOf(0)] = me;
      const moves: [number, number] = [view.moves[0], view.moves[1]];
      moves[seat] = moves[seat]! + 1;
      const v2 = { ...view, grid: after, moves };
      return !ORDER.some((c) => bombResult(v2, c, 1 - seat)?.winner === 1 - seat);
    };
    const ok = top.filter((s) => safe(s.col));
    if (ok.length) top = ok;
    else { const alt = scored.find((s) => s.v > -WIN && safe(s.col)); if (alt) top = [alt]; }
  }
  return { col: top[Math.floor(random() * top.length)]!.col, bomb: false };
}
