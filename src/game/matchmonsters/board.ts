/**
 * Board mechanics for Match Monsters: generation, match detection, and the
 * clear → gravity → refill cascade. All randomness flows through an injected
 * {@link Rng} so results are deterministic and server-authoritative.
 */
import type { Board, Element, Gem, Tile } from "./types.js";
import { ELEMENTS } from "./types.js";
import type { Rng } from "./rng.js";

/** Chance a refilled/generated cell is a berry pickup instead of an element. */
export const BERRY_CHANCE = 0.08;

/** Pick a gem (weighted toward elements), avoiding any banned gems. */
function pickGem(palette: readonly Element[], rng: Rng, banned?: Set<Gem>): Gem {
  if (rng.next() < BERRY_CHANCE && !(banned && banned.has("berry"))) return "berry";
  const choices = palette.filter((e) => !(banned && banned.has(e)));
  return rng.pick(choices.length > 0 ? choices : palette);
}

export interface BoardOptions {
  readonly width: number;
  readonly height: number;
  /** Palette of elements that can appear on the board. */
  readonly palette: readonly Element[];
}

export const DEFAULT_BOARD: BoardOptions = {
  width: 7,
  height: 7,
  palette: ELEMENTS,
};

function inBounds(b: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.width && y < b.height;
}

/** Stones (and empty cells) never form part of a match. */
function matchable(t: Tile): boolean {
  return t != null && t !== "stone";
}

/**
 * Generate a full board with no pre-existing matches, so the opening position is
 * neutral and every clear is the result of a deliberate move.
 */
export function generateBoard(opts: BoardOptions, rng: Rng): Board {
  const { width, height, palette } = opts;
  const grid: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      // Reject any gem that would immediately complete a run of 3.
      const banned = new Set<Gem>();
      if (x >= 2 && row[x - 1] === row[x - 2] && row[x - 1] != null) {
        banned.add(row[x - 1] as Gem);
      }
      if (
        y >= 2 &&
        grid[y - 1]![x] === grid[y - 2]![x] &&
        grid[y - 1]![x] != null
      ) {
        banned.add(grid[y - 1]![x] as Gem);
      }
      row.push(pickGem(palette, rng, banned));
    }
    grid.push(row);
  }
  return { width, height, grid };
}

/** Coordinates of every tile that is part of a horizontal or vertical run of 3+. */
export function findMatches(b: Board): { x: number; y: number; element: Gem }[] {
  const matched = new Set<string>();

  const scan = (horizontal: boolean) => {
    const outer = horizontal ? b.height : b.width;
    const inner = horizontal ? b.width : b.height;
    for (let o = 0; o < outer; o++) {
      let runStart = 0;
      for (let i = 1; i <= inner; i++) {
        const cur = i < inner ? cell(b, horizontal, o, i) : null;
        const prev = cell(b, horizontal, o, i - 1);
        if (i < inner && matchable(cur) && cur === prev) continue;
        const runLen = i - runStart;
        if (matchable(prev) && runLen >= 3) {
          for (let k = runStart; k < i; k++) {
            const [x, y] = horizontal ? [k, o] : [o, k];
            matched.add(`${x},${y}`);
          }
        }
        runStart = i;
      }
    }
  };
  scan(true);
  scan(false);

  const out: { x: number; y: number; element: Gem }[] = [];
  for (const key of matched) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    out.push({ x, y, element: b.grid[y]![x] as Gem });
  }
  return out;
}

function cell(b: Board, horizontal: boolean, outer: number, inner: number): Tile {
  return horizontal ? b.grid[outer]![inner]! : b.grid[inner]![outer]!;
}

/** True if the board contains any single line-run of 4+ identical tiles. */
export function hasBigMatch(b: Board, minRun = 4): boolean {
  const scan = (horizontal: boolean): boolean => {
    const outer = horizontal ? b.height : b.width;
    const inner = horizontal ? b.width : b.height;
    for (let o = 0; o < outer; o++) {
      let run = 1;
      for (let i = 1; i < inner; i++) {
        const cur = cell(b, horizontal, o, i);
        const prev = cell(b, horizontal, o, i - 1);
        run = matchable(cur) && cur === prev ? run + 1 : 1;
        if (run >= minRun) return true;
      }
    }
    return false;
  };
  return scan(true) || scan(false);
}

/**
 * Clear the given cells, drop everything above into the gaps, and refill the top
 * with fresh random tiles. Mutates and returns the board.
 */
export function collapseAndRefill(
  b: Board,
  cleared: { x: number; y: number }[],
  palette: readonly Element[],
  rng: Rng,
): void {
  for (const { x, y } of cleared) b.grid[y]![x] = null;

  for (let x = 0; x < b.width; x++) {
    // Compact non-null tiles toward the bottom.
    const column: Gem[] = [];
    for (let y = b.height - 1; y >= 0; y--) {
      const t = b.grid[y]![x];
      if (t != null) column.push(t);
    }
    for (let y = b.height - 1, i = 0; y >= 0; y--, i++) {
      b.grid[y]![x] = i < column.length ? column[i]! : pickGem(palette, rng);
    }
  }
}

function swapCells(b: Board, x1: number, y1: number, x2: number, y2: number): void {
  const t = b.grid[y1]![x1]!;
  b.grid[y1]![x1] = b.grid[y2]![x2]!;
  b.grid[y2]![x2] = t;
}

/** True if a cell can be picked up and swapped (not stone, not frozen). */
export function isMovable(b: Board, x: number, y: number, ice?: number[][]): boolean {
  if (b.grid[y]![x] === "stone") return false;
  return !(ice && (ice[y]?.[x] ?? 0) > 0);
}

/** True if any single adjacent swap of movable tiles would create a match. */
export function hasAnyMove(b: Board, ice?: number[][]): boolean {
  const trySwap = (x1: number, y1: number, x2: number, y2: number): boolean => {
    if (!isMovable(b, x1, y1, ice) || !isMovable(b, x2, y2, ice)) return false;
    swapCells(b, x1, y1, x2, y2);
    const ok = findMatches(b).length > 0;
    swapCells(b, x1, y1, x2, y2);
    return ok;
  };
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      if (x + 1 < b.width && trySwap(x, y, x + 1, y)) return true;
      if (y + 1 < b.height && trySwap(x, y, x, y + 1)) return true;
    }
  }
  return false;
}

/** Replace the board with a fresh one that has no matches and at least one move. */
export function reshuffle(b: Board, opts: BoardOptions, rng: Rng): void {
  for (let attempt = 0; attempt < 50; attempt++) {
    const fresh = generateBoard(opts, rng);
    if (hasAnyMove(fresh)) {
      b.grid = fresh.grid;
      return;
    }
  }
  // Extremely unlikely; accept the last generated board.
  b.grid = generateBoard(opts, rng).grid;
}

/** Stones orthogonally next to any cleared cell (they crumble), excluding cleared cells. */
export function adjacentStones(
  b: Board,
  cleared: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  const taken = new Set(cleared.map((c) => `${c.x},${c.y}`));
  const out: { x: number; y: number }[] = [];
  for (const c of cleared) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = c.x + dx;
      const y = c.y + dy;
      const key = `${x},${y}`;
      if (!inBounds(b, x, y) || taken.has(key)) continue;
      if (b.grid[y]![x] === "stone") {
        taken.add(key);
        out.push({ x, y });
      }
    }
  }
  return out;
}

export { inBounds };
