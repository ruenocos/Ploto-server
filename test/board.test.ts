import { describe, it, expect } from "vitest";
import { Rng } from "../src/game/matchmonsters/rng.js";
import {
  generateBoard,
  findMatches,
  collapseAndRefill,
  hasAnyMove,
  reshuffle,
  DEFAULT_BOARD,
} from "../src/game/matchmonsters/board.js";
import type { Board, Element } from "../src/game/matchmonsters/types.js";

function boardFrom(rows: string[]): Board {
  const map: Record<string, Element> = {
    F: "fire",
    W: "water",
    E: "earth",
    N: "nature",
    L: "light",
  };
  const grid = rows.map((r) => r.split("").map((c) => map[c] ?? null));
  return { width: grid[0]!.length, height: grid.length, grid };
}

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 5 }, () => a.int(1000));
    const seqB = Array.from({ length: 5 }, () => b.int(1000));
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = Array.from({ length: 5 }, ((r) => () => r.int(1000))(new Rng(1)));
    const b = Array.from({ length: 5 }, ((r) => () => r.int(1000))(new Rng(2)));
    expect(a).not.toEqual(b);
  });
});

describe("generateBoard", () => {
  it("fills the board and contains no initial matches", () => {
    for (let seed = 0; seed < 25; seed++) {
      const board = generateBoard(DEFAULT_BOARD, new Rng(seed));
      expect(board.grid.flat().every((t) => t !== null)).toBe(true);
      expect(findMatches(board)).toHaveLength(0);
    }
  });
});

describe("findMatches", () => {
  it("finds a horizontal run of 3", () => {
    const b = boardFrom(["FFFWL", "WLWLW", "LWLWL", "WLWLW", "LWLWL"]);
    const m = findMatches(b);
    expect(m).toHaveLength(3);
    expect(m.every((c) => c.element === "fire" && c.y === 0)).toBe(true);
  });

  it("finds a vertical run of 4", () => {
    const b = boardFrom(["WLWLN", "WLNLW", "WNLNL", "WLWLN", "LWLWL"]);
    const m = findMatches(b);
    const col0 = m.filter((c) => c.x === 0);
    expect(col0).toHaveLength(4);
  });

  it("returns nothing for a board with no run of 3", () => {
    const b = boardFrom(["FWFWF", "WFWFW", "FWFWF", "WFWFW", "FWFWF"]);
    expect(findMatches(b)).toHaveLength(0);
  });
});

describe("hasAnyMove / reshuffle", () => {
  it("detects a board with a possible move and one without", () => {
    // A 2x2 board can never make a run of 3, so no move exists.
    const locked = boardFrom(["FW", "WF"]);
    expect(hasAnyMove(locked)).toBe(false);
    // Swapping (1,0)<->(1,1) turns row 0 into F F F.
    const movable = boardFrom(["FWFWL", "EFENW", "NLNEN", "LNLWE", "EWELW"]);
    expect(hasAnyMove(movable)).toBe(true);
  });

  it("reshuffles into a playable board with no immediate matches", () => {
    const b = boardFrom(["FWENL", "WFNLE", "NLWEF", "LENFW", "ENLWF"]);
    reshuffle(b, { width: 5, height: 5, palette: DEFAULT_BOARD.palette }, new Rng(3));
    expect(findMatches(b)).toHaveLength(0);
    expect(hasAnyMove(b)).toBe(true);
  });
});

describe("collapseAndRefill", () => {
  it("drops tiles above a gap and refills the top", () => {
    const b = boardFrom(["FWEN", "FWEN", "FWEN", "FWEN"]);
    // Clear the two bottom cells of column 0.
    collapseAndRefill(b, [{ x: 0, y: 3 }, { x: 0, y: 2 }], DEFAULT_BOARD.palette, new Rng(7));
    // Every cell is filled again.
    expect(b.grid.flat().every((t) => t !== null)).toBe(true);
    // The surviving original column-0 tiles (fire) sank to the bottom.
    expect(b.grid[3]![0]).toBe("fire");
    expect(b.grid[2]![0]).toBe("fire");
  });
});
