import { describe, it, expect } from "vitest";
import { MatchMonstersGame, type GameConfig } from "../src/game/matchmonsters/engine.js";
import { ELEMENTS, type Ability, type Element, type Monster, type Tile } from "../src/game/matchmonsters/types.js";

const MAP: Record<string, Element> = { F: "fire", W: "water", E: "earth", N: "nature", L: "light" };
/** No pre-existing matches; swapping (1,2)<->(0,2) makes a vertical fire 3. */
const LAYOUT = ["FWENL", "FENLW", "WFENL", "ENLWF", "NLWFE"];
const FIRE_SWAP = { type: "swap" as const, from: { x: 1, y: 2 }, to: { x: 0, y: 2 } };

function grid(rows: string[]): Tile[][] {
  return rows.map((r) => r.split("").map((c) => MAP[c]!));
}
function fireMon(id: string, ability: Ability, chargeCost = 3): Monster {
  return { id, name: id, element: "fire", chargeCost, ability };
}
const filler: Monster = { id: "x", name: "x", element: "light", chargeCost: 99, ability: { type: "heal", amount: 0, description: "" } };

function newGame(p0: Monster, p1: Monster = filler, over: Partial<GameConfig> = {}): MatchMonstersGame {
  const g = new MatchMonstersGame({
    matchId: "t",
    seed: 123,
    board: { width: 5, height: 5, palette: ELEMENTS },
    players: [
      { peerId: "p0", displayName: "Alice", monsters: [p0, filler] },
      { peerId: "p1", displayName: "Bob", monsters: [p1, filler] },
    ],
    ...over,
  });
  g.state.board.grid = grid(LAYOUT);
  return g;
}

describe("validation", () => {
  it("rejects moves out of turn, non-adjacent, and non-matching", () => {
    const g = newGame(fireMon("a", { type: "attack", amount: 14, description: "" }));
    expect(g.applyMove(1, FIRE_SWAP).ok).toBe(false);
    expect(g.applyMove(0, { type: "swap", from: { x: 0, y: 0 }, to: { x: 4, y: 4 } }).ok).toBe(false);
    const before = g.state.board.grid.map((r) => r.slice());
    expect(g.applyMove(0, { type: "swap", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }).ok).toBe(false);
    expect(g.state.board.grid).toEqual(before);
  });
});

describe("charging + abilities", () => {
  it("charges a monster from matched tiles and fires its attack at the opponent", () => {
    const g = newGame(fireMon("atk", { type: "attack", amount: 14, description: "" }, 3));
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.abilities.some((a) => a.type === "attack")).toBe(true);
    expect(g.state.players[1].hp).toBeLessThanOrEqual(86); // 100 - 14 (maybe more from cascades)
    expect(r.nextTurn).toBe(1);
  });

  it("does not fire until the charge cost is met", () => {
    // Needs 99 fire tiles — a single 3-match can never charge it.
    const g = newGame(fireMon("slow", { type: "attack", amount: 50, description: "" }, 99));
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.abilities).toHaveLength(0);
    expect(g.state.players[1].hp).toBe(100);
  });

  it("shield soaks damage before HP", () => {
    const g = newGame(fireMon("sh", { type: "shield", amount: 20, description: "" }, 3));
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    expect(g.state.players[0].shield).toBeGreaterThanOrEqual(20);
  });

  it("heal is capped at max HP", () => {
    const g = newGame(fireMon("hl", { type: "heal", amount: 30, description: "" }, 3));
    g.state.players[0].hp = 90;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    expect(g.state.players[0].hp).toBe(100);
  });

  it("burn ticks on the victim's turn and ignores shields", () => {
    const g = newGame(fireMon("bn", { type: "burn", amount: 7, turns: 2, description: "" }, 3));
    g.state.players[1].shield = 100;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.abilities.some((a) => a.type === "burn-tick")).toBe(true);
    expect(g.state.players[1].hp).toBeLessThan(100); // burn bypassed the 100 shield
    expect(g.state.players[1].shield).toBe(100);
  });

  it("declares a winner when the opponent reaches 0 HP", () => {
    const g = newGame(fireMon("ko", { type: "attack", amount: 50, description: "" }, 3));
    g.state.players[1].hp = 10;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.finished).toBe(true);
    expect(r.winner).toBe(0);
    expect(g.state.phase).toBe("finished");
    expect(g.applyMove(1, FIRE_SWAP).ok).toBe(false);
  });

  it("is reproducible from (seed, move)", () => {
    const ab: Ability = { type: "attack", amount: 14, description: "" };
    const a = newGame(fireMon("r", ab)).applyMove(0, FIRE_SWAP);
    const b = newGame(fireMon("r", ab)).applyMove(0, FIRE_SWAP);
    expect(a).toEqual(b);
  });
});
