import { describe, it, expect } from "vitest";
import { MatchMonstersGame, type GameConfig } from "../src/game/matchmonsters/engine.js";
import { MONSTERS } from "../src/game/matchmonsters/monsters.js";
import { ELEMENTS, type Element, type Tile } from "../src/game/matchmonsters/types.js";

const MAP: Record<string, Element> = {
  F: "fire",
  W: "water",
  E: "earth",
  N: "nature",
  L: "light",
};

/** A 5x5 layout with no pre-existing matches; swapping (1,2)<->(0,2) makes fire 3. */
const LAYOUT = ["FWENL", "FENLW", "WFENL", "ENLWF", "NLWFE"];

function grid(rows: string[]): Tile[][] {
  return rows.map((r) => r.split("").map((c) => MAP[c]!));
}

function newGame(overrides: Partial<GameConfig> = {}): MatchMonstersGame {
  const config: GameConfig = {
    matchId: "test",
    seed: 123,
    board: { width: 5, height: 5, palette: ELEMENTS },
    players: [
      {
        peerId: "p0",
        displayName: "Alice",
        monsters: [MONSTERS["ember_pup"]!, MONSTERS["prism_owl"]!],
      },
      {
        peerId: "p1",
        displayName: "Bob",
        monsters: [MONSTERS["stone_golem"]!, MONSTERS["tide_serpent"]!],
      },
    ],
    ...overrides,
  };
  const g = new MatchMonstersGame(config);
  g.state.board.grid = grid(LAYOUT);
  return g;
}

const FIRE_SWAP = { type: "swap" as const, from: { x: 1, y: 2 }, to: { x: 0, y: 2 } };

describe("MatchMonstersGame.applyMove — validation", () => {
  it("rejects a move when it is not your turn", () => {
    const g = newGame();
    const r = g.applyMove(1, FIRE_SWAP);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not your turn/);
  });

  it("rejects non-adjacent swaps", () => {
    const g = newGame();
    const r = g.applyMove(0, { type: "swap", from: { x: 0, y: 0 }, to: { x: 4, y: 4 } });
    expect(r.ok).toBe(false);
  });

  it("rejects a swap that creates no match and leaves the board unchanged", () => {
    const g = newGame();
    const before = g.state.board.grid.map((r) => r.slice());
    const r = g.applyMove(0, { type: "swap", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(r.ok).toBe(false);
    expect(g.state.board.grid).toEqual(before);
  });
});

describe("MatchMonstersGame.applyMove — combat", () => {
  it("a matching swap damages the opponent and passes the turn", () => {
    const g = newGame();
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Attacker fields fire (ember_pup, power 6); a 3-match deals >= 18.
    const fire = r.damage.find((d) => d.element === "fire");
    expect(fire).toBeDefined();
    expect(fire!.amount).toBeGreaterThanOrEqual(18);
    // Opponent's frontmost monster took the hit.
    const golem = g.state.players[1].monsters[0]!;
    expect(golem.hp).toBeLessThan(golem.def.maxHp);
    // Turn passed to player 1.
    expect(r.nextTurn).toBe(1);
    expect(g.state.turn).toBe(1);
  });

  it("declares a winner when the opponent's last monster falls", () => {
    const g = newGame();
    // Bob's back monster already down; front monster on its last legs.
    g.state.players[1].monsters[0]!.hp = 1;
    g.state.players[1].monsters[1]!.hp = 0;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.finished).toBe(true);
    expect(r.winner).toBe(0);
    expect(g.state.phase).toBe("finished");
    // No further moves accepted.
    const after = g.applyMove(1, FIRE_SWAP);
    expect(after.ok).toBe(false);
  });

  it("is fully reproducible from (seed, moves)", () => {
    const a = newGame();
    const b = newGame();
    const ra = a.applyMove(0, FIRE_SWAP);
    const rb = b.applyMove(0, FIRE_SWAP);
    expect(ra).toEqual(rb);
    expect(a.state.board.grid).toEqual(b.state.board.grid);
  });
});
