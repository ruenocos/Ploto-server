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
        if (i < inner && cur != null && cur === prev) continue;
        const runLen = i - runStart;
        if (prev != null && runLen >= 3) {
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
        run = cur != null && cur === prev ? run + 1 : 1;
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

export { inBounds };
