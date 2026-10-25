/**
 * Drop Four's rules: pure and deterministic (randomness is injected), no timers
 * or sockets. docs/games/drop_four.md has the rules in plain words.
 *
 * A 7×6 grid; players take turns dropping a disc into a column (it falls to the
 * lowest free spot); four in a row wins. Each player may have one bomb: it lands
 * like a disc, then clears itself and the discs to its left, right and below;
 * discs above fall. After a bomb, the bomber wins with four in a row, otherwise
 * the other player does if they have four. A full grid is a draw. The game's
 * first disc can't go in the middle column (it would win the first player three
 * games in four).
 */

/** A float source in [0, 1). Production uses Math.random, tests a seeded `Rng`. */
export type RandomSource = () => number;

export const COLS = 7;
/** Discs you drop before your bomb is ready (an early bomb clears nothing worth clearing). */
export const BOMB_AFTER = 3;
export const ROWS = 6;
/** The middle column: closed to the game's first disc. */
export const MIDDLE = 3;
/** Whether column c is closed to the next disc (only the middle, only for the game's first disc). */
export const closedToOpening = (moves: readonly [number, number] | readonly number[], c: number): boolean => c === MIDDLE && moves[0]! + moves[1]! === 0;
/** 0 empty, 1 the first seat's disc, 2 the second's. Row 0 is the bottom. */
export type Cell = 0 | 1 | 2;
export type Grid = Cell[][]; // grid[col][row]

export type DropEvent =
  | { readonly type: "start"; readonly first: number; readonly rematch?: boolean } // sent by the room when play begins
  | { readonly type: "drop"; readonly by: number; readonly col: number; readonly row: number; readonly bomb?: boolean; readonly auto?: boolean; readonly ponder?: number } // ponder: a column a bot weighed first (the page shows its hand go there)
  | { readonly type: "blast"; readonly by: number; readonly col: number; readonly row: number; readonly cleared: readonly (readonly [number, number])[]; readonly falls: readonly { readonly col: number; readonly from: number; readonly to: number }[] }
  | { readonly type: "turn"; readonly seat: number }
  | { readonly type: "over"; readonly winner: number | null; readonly line?: readonly (readonly [number, number])[]; readonly forfeit?: boolean };

export type Result = { readonly ok: true; readonly events: readonly DropEvent[] } | { readonly ok: false; readonly reason: string };

export interface DropView {
  readonly phase: "playing" | "over";
  readonly grid: readonly (readonly Cell[])[];
  readonly you: number;
  readonly turn: number | null;
  readonly first: number;
  readonly winner: number | null;
  readonly draw: boolean;
  readonly forfeit: boolean;
  readonly line: readonly (readonly [number, number])[] | null;
  readonly bombs: readonly [boolean, boolean];
  readonly bombsOn: boolean;
  /** Discs a player drops before their bomb is ready. */
  readonly bombAfter: number;
  readonly last: { readonly col: number; readonly row: number } | null;
  readonly moves: readonly [number, number];
}

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;

export const emptyGrid = (): Grid => Array.from({ length: COLS }, () => new Array<Cell>(ROWS).fill(0));
export const height = (g: Grid, col: number): number => { let r = 0; while (r < ROWS && g[col]![r] !== 0) r++; return r; };
export const full = (g: Grid): boolean => g.every((col) => col[ROWS - 1] !== 0);

/** Four (or more) of `who` in a row through (c, r), or null. */
export function lineThrough(g: Grid, c: number, r: number, who: Cell): [number, number][] | null {
  if (!who) return null;
  for (const [dc, dr] of DIRS) {
    const cells: [number, number][] = [[c, r]];
    for (const s of [1, -1]) {
      let x = c + dc * s, y = r + dr * s;
      while (x >= 0 && x < COLS && y >= 0 && y < ROWS && g[x]![y] === who) { cells.push([x, y]); x += dc * s; y += dr * s; }
    }
    if (cells.length >= 4) return cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  return null;
}
/** Any four in a row of `who` on the grid. */
export function findLine(g: Grid, who: Cell): [number, number][] | null {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (g[c]![r] === who) { const l = lineThrough(g, c, r, who); if (l) return l; }
  return null;
}

export interface GameOptions {
  readonly random: RandomSource;
  readonly bombs: boolean;
  /** Who drops first; a coin flip when unset. */
  readonly first?: number;
}

export class DropFourGame {
  grid: Grid = emptyGrid();
  phase: "playing" | "over" = "playing";
  turn: number | null;
  readonly first: number;
  winner: number | null = null;
  draw = false;
  forfeit = false;
  line: [number, number][] | null = null;
  bombs: [boolean, boolean];
  readonly bombsOn: boolean;
  last: { col: number; row: number } | null = null;
  moves: [number, number] = [0, 0];
  private readonly random: RandomSource;

  constructor(opts: GameOptions) {
    this.random = opts.random;
    this.bombsOn = opts.bombs;
    this.bombs = [opts.bombs, opts.bombs];
    this.first = opts.first ?? (this.random() < 0.5 ? 0 : 1);
    this.turn = this.first;
  }

  /** Drop a disc (or your bomb) into `col`. */
  drop(seat: number, col: number, bomb = false, auto = false): Result {
    if (this.phase !== "playing") return { ok: false, reason: "the game is over" };
    if (this.turn !== seat) return { ok: false, reason: "it isn't your turn" };
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: "that column isn't on the grid" };
    const row = height(this.grid, col);
    if (row >= ROWS) return { ok: false, reason: "that column is full" };
    if (closedToOpening(this.moves, col)) return { ok: false, reason: "the first disc can't go in the middle column" };
    if (bomb && !this.bombs[seat]) return { ok: false, reason: "you've used your bomb" };
    if (bomb && this.moves[seat]! < BOMB_AFTER) return { ok: false, reason: "your bomb is ready after your third disc" };
    this.moves[seat]!++;
    this.last = { col, row };
    const me = (seat + 1) as Cell, them = (2 - seat) as Cell;
    if (!bomb) {
      this.grid[col]![row] = me;
      const events: DropEvent[] = [{ type: "drop", by: seat, col, row, ...(auto ? { auto } : {}) }];
      const line = lineThrough(this.grid, col, row, me);
      if (line) return { ok: true, events: [...events, this.end(seat, line)] };
      if (full(this.grid)) return { ok: true, events: [...events, this.end(null, null)] };
      this.turn = 1 - seat;
      return { ok: true, events: [...events, { type: "turn", seat: this.turn }] };
    }
    // The bomb: it lands, then clears itself and its neighbours left, right and below; discs above fall.
    this.bombs[seat] = false;
    const cleared: [number, number][] = [[col, row]];
    for (const [c, r] of [[col - 1, row], [col + 1, row], [col, row - 1]] as const) {
      if (c >= 0 && c < COLS && r >= 0 && this.grid[c]![r] !== 0) cleared.push([c, r]);
    }
    for (const [c, r] of cleared) if (c !== col || r !== row) this.grid[c]![r] = 0;
    const falls: { col: number; from: number; to: number }[] = [];
    for (const c of new Set(cleared.map(([x]) => x))) {
      let to = 0;
      for (let r = 0; r < ROWS; r++) {
        const v = this.grid[c]![r]!;
        if (!v) continue;
        if (r !== to) { this.grid[c]![to] = v; this.grid[c]![r] = 0; falls.push({ col: c, from: r, to }); }
        to++;
      }
    }
    const events: DropEvent[] = [{ type: "drop", by: seat, col, row, bomb: true, ...(auto ? { auto } : {}) }, { type: "blast", by: seat, col, row, cleared, falls }];
    if (!this.grid[col]![row]) this.last = null; // the bomb's slot is empty now: no disc to mark
    const mine = findLine(this.grid, me), theirs = findLine(this.grid, them);
    if (mine) return { ok: true, events: [...events, this.end(seat, mine)] };
    if (theirs) return { ok: true, events: [...events, this.end(1 - seat, theirs)] };
    this.turn = 1 - seat;
    return { ok: true, events: [...events, { type: "turn", seat: this.turn }] };
  }

  /** The clock's move: the most central column that isn't full (a slow move costs time, not a random blunder). */
  clockColumn(): number {
    const open = [3, 2, 4, 1, 5, 0, 6].filter((c) => height(this.grid, c) < ROWS && !closedToOpening(this.moves, c));
    return open[0]!;
  }

  concede(seat: number): Result {
    if (this.phase === "over") return { ok: false, reason: "the game is over" };
    this.forfeit = true;
    return { ok: true, events: [this.end(1 - seat, null, true)] };
  }

  private end(winner: number | null, line: [number, number][] | null, forfeit = false): DropEvent {
    this.phase = "over";
    this.winner = winner;
    this.draw = winner === null;
    this.line = line;
    this.turn = null;
    return { type: "over", winner, ...(line ? { line } : {}), ...(forfeit ? { forfeit } : {}) };
  }

  viewFor(seat: number): DropView {
    return {
      phase: this.phase,
      grid: this.grid.map((c) => [...c]),
      you: seat,
      turn: this.turn,
      first: this.first,
      winner: this.winner,
      draw: this.draw,
      forfeit: this.forfeit,
      line: this.line,
      bombs: [this.bombs[0], this.bombs[1]],
      bombsOn: this.bombsOn,
      bombAfter: BOMB_AFTER,
      last: this.last,
      moves: [this.moves[0], this.moves[1]],
    };
  }
}
