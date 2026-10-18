import { describe, it, expect } from "vitest";
import { MatchMonstersGame, evolvedAmount, type GameConfig } from "../src/game/matchmonsters/engine.js";
import { ELEMENTS, type Ability, type Gem, type Monster, type Tile } from "../src/game/matchmonsters/types.js";

const MAP: Record<string, Gem> = { F: "fire", W: "water", E: "earth", N: "nature", L: "light", B: "berry" };
/** Swapping (1,2)<->(0,2) makes a vertical berry 3. */
const LAYOUT_BERRY = ["BWENL", "BENLW", "WBENL", "ENLWF", "NLWFE"];
/** No pre-existing matches; swapping (1,2)<->(0,2) makes a vertical fire 3. */
const LAYOUT = ["FWENL", "FENLW", "WFENL", "ENLWF", "NLWFE"];
/** Same swap makes a vertical fire run of 4 (extra-move trigger). */
const LAYOUT4 = ["FWENL", "FENLW", "WFENL", "FNLWE", "NLWFE"];
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
    // A plain 3-match keeps the turn (2 moves per turn) and uses one move.
    expect(r.nextTurn).toBe(0);
    expect(r.movesLeft).toBe(1);
  });

  it("passes the turn after both moves are used", () => {
    const g = newGame(fireMon("a", { type: "attack", amount: 10, description: "" }, 99));
    const r1 = g.applyMove(0, FIRE_SWAP);
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.nextTurn).toBe(0);
    g.state.board.grid = grid(LAYOUT); // reset to a known legal position
    const r2 = g.applyMove(0, FIRE_SWAP);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.nextTurn).toBe(1);
    expect(r2.movesLeft).toBe(2);
  });

  it("a line of 4+ grants an extra move", () => {
    const g = newGame(fireMon("a", { type: "attack", amount: 5, description: "" }, 99));
    g.state.board.grid = grid(LAYOUT4);
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extraTurn).toBe(true);
    expect(r.nextTurn).toBe(0);
    expect(r.movesLeft).toBe(2); // 2 - 1 + 1
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
    g.state.movesLeft = 1; // this move ends the turn, so it passes and burns tick
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

describe("berries + evolution", () => {
  it("collects berries from matched berry tiles", () => {
    const g = newGame(fireMon("a", { type: "attack", amount: 10, description: "" }, 99));
    g.state.board.grid = grid(LAYOUT_BERRY);
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.berriesGained).toBeGreaterThanOrEqual(3);
    expect(g.state.players[0].berries).toBeGreaterThanOrEqual(3);
  });

  it("evolves a monster for 4 berries and strengthens its ability", () => {
    const def: Monster = { id: "a", name: "A", element: "fire", chargeCost: 3, ability: { type: "attack", amount: 14, description: "" } };
    const g = newGame(def);
    g.state.players[0].berries = 4;
    const r = g.evolve(0, "a");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evolution).toBe(1);
    expect(r.berries).toBe(0);
    expect(evolvedAmount(def, 1)).toBe(17); // 14 + max(1, round(14*0.2)=3)
    expect(evolvedAmount(def, 1)).toBeGreaterThan(def.ability.amount);
  });

  it("rejects evolving without enough berries, out of turn, or past the cap", () => {
    const g = newGame(fireMon("a", { type: "attack", amount: 10, description: "" }, 3));
    expect(g.evolve(0, "a").ok).toBe(false); // 0 berries
    g.state.players[0].berries = 8;
    expect(g.evolve(1, "a").ok).toBe(false); // not your turn
    g.state.players[0].monsters[0]!.evolution = 3; // at cap
    expect(g.evolve(0, "a").ok).toBe(false);
  });
});
