import { describe, it, expect } from "vitest";
import {
  MatchMonstersGame,
  effectiveCost,
  evolutionChanges,
  fatigueDamage,
  scaleAmount,
  scaledEffects,
  scaledPassive,
  type GameConfig,
} from "../src/game/matchmonsters/engine.js";
import { findMatches } from "../src/game/matchmonsters/board.js";
import { MONSTERS } from "../src/game/matchmonsters/monsters.js";
import { chooseEvolution, chooseMove } from "../src/game/matchmonsters/bot.js";
import {
  ELEMENTS,
  FATIGUE_AFTER,
  FATIGUE_STEP,
  MAX_SHIELD,
  STARTING_HP,
  type Effect,
  type Gem,
  type Monster,
  type Passive,
  type Tile,
} from "../src/game/matchmonsters/types.js";

const MAP: Record<string, Gem> = {
  F: "fire", W: "water", E: "earth", N: "nature", L: "light", B: "berry", S: "stone",
};
/** No pre-existing matches; swapping (1,2)<->(0,2) makes a vertical fire 3. */
const LAYOUT = ["FWENL", "FENLW", "WFENL", "ENLWF", "NLWFE"];
/** Same swap makes a vertical fire run of 4 (extra-move trigger). */
const LAYOUT4 = ["FWENL", "FENLW", "WFENL", "FNLWE", "NLWFE"];
/** Same swap makes a vertical berry 3. */
const LAYOUT_BERRY = ["BWENL", "BENLW", "WBENL", "ENLWF", "NLWFE"];
const FIRE_SWAP = { type: "swap" as const, from: { x: 1, y: 2 }, to: { x: 0, y: 2 } };

function grid(rows: string[]): Tile[][] {
  return rows.map((r) => r.split("").map((c) => MAP[c]!));
}
/** A fire monster that fires `effects` after one 3-match (cost 3 by default). */
function fireMon(id: string, effects: Effect[], chargeCost = 3, passive?: Passive): Monster {
  return {
    id, name: id, element: "fire", chargeCost,
    ability: { name: `${id} move`, effects },
    ...(passive ? { passive } : {}),
  };
}
const filler: Monster = {
  id: "x", name: "x", element: "light", chargeCost: 99, ability: { name: "noop", effects: [] },
};

function newGame(p0: Monster, p1: Monster = filler, over: Partial<GameConfig> = {}, p0b: Monster = filler) {
  const g = new MatchMonstersGame({
    matchId: "t",
    seed: 123,
    board: { width: 5, height: 5, palette: ELEMENTS },
    players: [
      { peerId: "p0", displayName: "Alice", monsters: [p0, p0b] },
      { peerId: "p1", displayName: "Bob", monsters: [p1, filler] },
    ],
    ...over,
  });
  g.state.board.grid = grid(LAYOUT);
  g.state.movesLeft = 2; // most tests reason about a full 2-move turn
  return g;
}
const dmg = (amount: number): Effect => ({ kind: "damage", amount });

describe("game rules", () => {
  it("the opening player gets a single move on their first turn", () => {
    const g = new MatchMonstersGame({
      matchId: "o", seed: 1,
      players: [
        { peerId: "a", displayName: "A", monsters: [filler, filler] },
        { peerId: "b", displayName: "B", monsters: [filler, filler] },
      ],
    });
    expect(g.state.movesLeft).toBe(1);
  });

  it("shields cap at MAX_SHIELD", () => {
    const g = newGame(fireMon("sh", [{ kind: "shield", amount: 50 }]));
    g.applyMove(0, FIRE_SWAP);
    expect(g.state.players[0].shield).toBe(MAX_SHIELD);
  });

  it("sudden death damages the incoming player once enough turns pass", () => {
    expect(fatigueDamage(FATIGUE_AFTER)).toBe(0);
    expect(fatigueDamage(FATIGUE_AFTER + 1)).toBe(FATIGUE_STEP);
    expect(fatigueDamage(FATIGUE_AFTER + 3)).toBe(3 * FATIGUE_STEP);

    const g = newGame(fireMon("a", [], 99));
    g.state.turnPasses = FATIGUE_AFTER; // the next pass triggers sudden death
    g.state.movesLeft = 1;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.abilities.some((a) => a.type === "fatigue" && a.targetPlayer === 1)).toBe(true);
    expect(g.state.players[1].hp).toBe(STARTING_HP - FATIGUE_STEP);
  });
});

describe("validation", () => {
  it("rejects moves out of turn, non-adjacent, or off the board, leaving the board alone", () => {
    const g = newGame(fireMon("a", [dmg(14)]));
    const before = g.state.board.grid.map((r) => r.slice());
    expect(g.applyMove(1, FIRE_SWAP).ok).toBe(false);
    expect(g.applyMove(0, { type: "swap", from: { x: 0, y: 0 }, to: { x: 4, y: 4 } }).ok).toBe(false);
    expect(g.applyMove(0, { type: "swap", from: { x: 4, y: 0 }, to: { x: 5, y: 0 } }).ok).toBe(false);
    expect(g.state.board.grid).toEqual(before);
  });
});

describe("charging + turns", () => {
  it("charges a monster from matched tiles and fires its move", () => {
    const g = newGame(fireMon("atk", [dmg(14)]));
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.abilities.some((a) => a.type === "attack")).toBe(true);
    expect(r.casts[0]!.moveName).toBe("atk move");
    expect(g.state.players[1].hp).toBeLessThanOrEqual(86);
    // A plain 3-match keeps the turn (2 moves per turn) and uses one move.
    expect(r.nextTurn).toBe(0);
    expect(r.movesLeft).toBe(1);
  });

  it("does not fire until the charge cost is met", () => {
    const g = newGame(fireMon("slow", [dmg(50)], 99));
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.casts).toHaveLength(0);
    expect(g.state.players[1].hp).toBe(STARTING_HP);
  });

  it("passes the turn after both moves are used", () => {
    const g = newGame(fireMon("a", [dmg(10)], 99));
    g.applyMove(0, FIRE_SWAP);
    g.state.board.grid = grid(LAYOUT);
    const r2 = g.applyMove(0, FIRE_SWAP);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.nextTurn).toBe(1);
    expect(r2.movesLeft).toBe(2);
  });

  it("a line of 4+ grants an extra move", () => {
    const g = newGame(fireMon("a", [dmg(5)], 99));
    g.state.board.grid = grid(LAYOUT4);
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extraTurn).toBe(true);
    expect(r.movesLeft).toBe(2);
  });

  it("declares a winner when the opponent reaches 0 HP", () => {
    const g = newGame(fireMon("ko", [dmg(50)]));
    g.state.players[1].hp = 10;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.finished).toBe(true);
    expect(r.winner).toBe(0);
    expect(g.applyMove(1, FIRE_SWAP).ok).toBe(false);
  });

  it("is reproducible from (seed, move)", () => {
    const a = newGame(fireMon("r", [dmg(14), { kind: "match", shape: "row" }])).applyMove(0, FIRE_SWAP);
    const b = newGame(fireMon("r", [dmg(14), { kind: "match", shape: "row" }])).applyMove(0, FIRE_SWAP);
    expect(a).toEqual(b);
  });
});

describe("sustain effects", () => {
  it("shield soaks damage before HP; heal is capped", () => {
    const g = newGame(fireMon("sh", [{ kind: "shield", amount: 20 }]));
    g.applyMove(0, FIRE_SWAP);
    expect(g.state.players[0].shield).toBeGreaterThanOrEqual(20);

    const h = newGame(fireMon("hl", [{ kind: "heal", amount: 30 }]));
    h.state.players[0].hp = STARTING_HP - 10;
    h.applyMove(0, FIRE_SWAP);
    expect(h.state.players[0].hp).toBe(STARTING_HP);
  });

  it("burn ticks on the victim's turn and ignores shields", () => {
    const g = newGame(fireMon("bn", [{ kind: "dot", dot: "burn", amount: 7, turns: 2 }]));
    g.state.players[1].shield = 100;
    g.state.movesLeft = 1; // this move ends the turn, so it passes and burns tick
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.abilities.some((a) => a.type === "burn-tick")).toBe(true);
    expect(g.state.players[1].hp).toBeLessThan(100);
    expect(g.state.players[1].shield).toBe(100);
  });

  it("cleanse cures damage-over-time; drain steals HP", () => {
    const g = newGame(fireMon("c", [{ kind: "cleanse" }, { kind: "heal", amount: 10 }]));
    g.state.players[0].hp = 50;
    g.state.players[0].dots = [{ amount: 5, turns: 2, kind: "burn", element: "fire" }];
    g.applyMove(0, FIRE_SWAP);
    expect(g.state.players[0].dots).toHaveLength(0);
    expect(g.state.players[0].hp).toBe(60);

    const d = newGame(fireMon("d", [{ kind: "drain", amount: 10 }]));
    d.state.players[0].hp = 50;
    d.applyMove(0, FIRE_SWAP);
    expect(d.state.players[0].hp).toBe(60);
    expect(d.state.players[1].hp).toBeLessThanOrEqual(90);
  });
});

describe("board effects", () => {
  const iced = (g: MatchMonstersGame) => {
    const out: { x: number; y: number; v: number }[] = [];
    g.state.ice.forEach((row, y) => row.forEach((v, x) => v > 0 && out.push({ x, y, v })));
    return out;
  };

  it("match: clears a row (animated) and the tiles charge your monsters", () => {
    // Partner is a water monster: matched water tiles in the row charge it.
    const water: Monster = { id: "w", name: "w", element: "water", chargeCost: 99, ability: { name: "n", effects: [] } };
    const g = newGame(fireMon("a", [{ kind: "match", shape: "row" }]), filler, {}, water);
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const step = r.effectSteps[0]!;
    expect(step.cleared).toHaveLength(5); // 5-wide board
    const waterInRow = step.cleared.filter((c) => c.element === "water").length;
    expect(g.state.players[0].monsters[1]!.charge).toBeGreaterThanOrEqual(waterInRow);
  });

  it("match square/area clear 2×2 and 3×3 regions", () => {
    const sq = newGame(fireMon("s", [{ kind: "match", shape: "square" }])).applyMove(0, FIRE_SWAP);
    const ar = newGame(fireMon("a", [{ kind: "match", shape: "area" }])).applyMove(0, FIRE_SWAP);
    expect(sq.ok && sq.effectSteps[0]!.cleared.length).toBe(4);
    expect(ar.ok && ar.effectSteps[0]!.cleared.length).toBe(9);
  });

  it("freeze ices tiles that can't be swapped and lasts through the rival's turn", () => {
    const g = newGame(fireMon("a", [{ kind: "freeze", count: 3, turns: 1 }]));
    g.state.movesLeft = 1;
    g.applyMove(0, FIRE_SWAP);
    const ice = iced(g);
    expect(ice).toHaveLength(3);
    expect(ice.every((c) => c.v === 1)).toBe(true);
    const c = ice[0]!;
    const n = c.x + 1 < 5 ? { x: c.x + 1, y: c.y } : { x: c.x - 1, y: c.y };
    const blocked = g.applyMove(1, { type: "swap", from: { x: c.x, y: c.y }, to: n });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toMatch(/frozen/);
  });

  it("petrify turns tiles to stone, which can't be moved", () => {
    const g = newGame(fireMon("a", [{ kind: "petrify", count: 2 }]));
    g.applyMove(0, FIRE_SWAP);
    const stones: { x: number; y: number }[] = [];
    g.state.board.grid.forEach((row, y) => row.forEach((t, x) => t === "stone" && stones.push({ x, y })));
    expect(stones).toHaveLength(2);
    const s = stones[0]!;
    const n = s.y + 1 < 5 ? { x: s.x, y: s.y + 1 } : { x: s.x, y: s.y - 1 };
    const res = g.applyMove(0, { type: "swap", from: s, to: n });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/stone/);
  });

  it("stones crumble when a neighbouring tile is matched", () => {
    const g = newGame(fireMon("a", [], 99));
    g.state.board.grid = grid(["FWENL", "FSNLW", "WFENL", "ENLWF", "NLWFE"]);
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cascades[0]!.cleared.some((c) => c.element === "stone")).toBe(true);
  });

  it("convert adds the caster's element without creating instant matches", () => {
    const g = newGame(fireMon("a", [{ kind: "convert", count: 3 }]));
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    expect(findMatches(g.state.board)).toHaveLength(0);
  });
});

describe("tempo & charge effects", () => {
  const rival: Monster = { id: "r", name: "R", element: "water", chargeCost: 50, ability: { name: "n", effects: [] } };

  it("sap drains rival charge", () => {
    const g = newGame(fireMon("a", [{ kind: "sap", count: 3 }]), rival);
    g.state.players[1].monsters[0]!.charge = 5;
    g.applyMove(0, FIRE_SWAP);
    expect(g.state.players[1].monsters[0]!.charge).toBe(2);
  });

  it("slow makes the rival start their next turn with fewer moves", () => {
    const g = newGame(fireMon("a", [{ kind: "slow", count: 1 }]), rival);
    g.state.movesLeft = 1;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nextTurn).toBe(1);
    expect(r.movesLeft).toBe(1); // 2 - 1
  });

  it("seal stops a rival monster gaining charge", () => {
    const g = newGame(fireMon("a", [{ kind: "seal", turns: 2 }]), rival);
    g.applyMove(0, FIRE_SWAP);
    const sealed = g.state.players[1].monsters.filter((m) => m.sealed > 0);
    expect(sealed).toHaveLength(1);
  });

  it("haste grants an extra move this turn", () => {
    const g = newGame(fireMon("a", [{ kind: "haste", count: 1 }]));
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok && r.movesLeft).toBe(2); // 2 - 1 + 1
  });

  it("empower charges the partner monster", () => {
    const g = newGame(fireMon("a", [{ kind: "empower", count: 5 }]));
    g.applyMove(0, FIRE_SWAP);
    expect(g.state.players[0].monsters[1]!.charge).toBe(5); // filler (cost 99) doesn't fire
  });
});

describe("passives", () => {
  it("berserk turns the move into multiple strikes at low HP", () => {
    const g = newGame(fireMon("b", [dmg(30)], 3, { berserk: { threshold: 30, hits: 4, amount: 5 } }));
    g.state.players[0].hp = 25;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.casts[0]!.via).toBe("berserk");
    expect(r.abilities.filter((a) => a.type === "attack" && a.amount === 5).length).toBeGreaterThanOrEqual(4);
  });

  it("follow-up strikes when the partner's move deals damage", () => {
    const helper: Monster = {
      id: "h", name: "H", element: "light", chargeCost: 99,
      ability: { name: "n", effects: [] }, passive: { followUp: 5 },
    };
    const g = newGame(fireMon("a", [dmg(10)]), filler, {}, helper);
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.casts.some((c) => c.via === "followUp")).toBe(true);
    expect(g.state.players[1].hp).toBeLessThanOrEqual(85);
  });
});

describe("berries + evolution", () => {
  it("collects berries from matched berry tiles", () => {
    const g = newGame(fireMon("a", [dmg(10)], 99));
    g.state.board.grid = grid(LAYOUT_BERRY);
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.berriesGained).toBeGreaterThanOrEqual(3);
    expect(g.state.players[0].berries).toBeGreaterThanOrEqual(3);
  });

  it("evolves for 4 berries: stronger effects and cheaper charge", () => {
    const def = fireMon("a", [dmg(14), { kind: "freeze", count: 4, turns: 1 }], 10);
    const g = newGame(def);
    g.state.players[0].berries = 4;
    const r = g.evolve(0, "a");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evolution).toBe(1);
    expect(r.berries).toBe(0);
    expect(scaleAmount(14, 1)).toBe(18); // 14 + max(1, round(14*0.25))
    const scaled = scaledEffects(def, 1);
    expect(scaled[0]).toEqual({ kind: "damage", amount: 18 });
    expect(scaled[1]).toMatchObject({ kind: "freeze", count: 5 });
    expect(effectiveCost(def, 1)).toBe(9);
  });

  it("charge cost reduction has a floor", () => {
    expect(effectiveCost(fireMon("x", [], 10), 2)).toBe(8);
    expect(effectiveCost(fireMon("x", [], 5), 3)).toBe(4);
    expect(effectiveCost(fireMon("x", [], 3), 1)).toBe(3);
  });

  it("rejects evolving without enough berries, out of turn, or past the cap", () => {
    const g = newGame(fireMon("a", [dmg(10)]));
    expect(g.evolve(0, "a").ok).toBe(false);
    g.state.players[0].berries = 8;
    expect(g.evolve(1, "a").ok).toBe(false);
    g.state.players[0].monsters[0]!.evolution = 2; // fully evolved: base, ★, ★★
    expect(g.evolve(0, "a").ok).toBe(false);
  });
});

describe("evolution milestones", () => {
  it("every roster monster gets cheaper and upgrades its move at each level, and stops at ★★", () => {
    for (const def of Object.values(MONSTERS)) {
      for (let evo = 0; evo < 2; evo++) {
        const changes = evolutionChanges(def, evo);
        expect(changes.length, `${def.name} ★${evo}`).toBeGreaterThanOrEqual(2);
        expect(changes.some((c) => c.startsWith("Charge cost")), `${def.name} ★${evo} cost`).toBe(true);
      }
      expect(evolutionChanges(def, 2)).toEqual([]);
    }
  });

  it("widens blasts and lengthens seals and burns at ★; adds a haste move at ★★", () => {
    const def = fireMon("a", [
      { kind: "match", shape: "row" },
      { kind: "seal", turns: 2 },
      { kind: "dot", dot: "burn", amount: 5, turns: 3 },
      { kind: "haste", count: 1 },
    ]);
    expect(scaledEffects(def, 0)).toMatchObject([{ shape: "row" }, { turns: 2 }, { turns: 3 }, { count: 1 }]);
    expect(scaledEffects(def, 1)).toMatchObject([{ size: 2 }, { turns: 3 }, { turns: 4 }, { count: 1 }]);
    expect(scaledEffects(def, 2)).toMatchObject([{ size: 2 }, { turns: 3 }, { turns: 4 }, { count: 2 }]);
    expect(evolutionChanges(def, 0)).toContain("Blast 1 → 2 rows");
    expect(evolutionChanges(def, 0)).toContain("Seal 2 → 3 turns");
  });

  it("a ★ row blast clears two rows", () => {
    const g = newGame(fireMon("a", [{ kind: "match", shape: "row" }]));
    g.state.players[0].monsters[0]!.evolution = 1;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok && r.effectSteps[0]!.cleared.length).toBe(10);
  });

  it("a ★ row blast picks two different random rows, and every row gets its turn", () => {
    const hit = new Array(5).fill(0); // the test board is 5x5
    for (let seed = 1; seed <= 300; seed++) {
      const g = newGame(fireMon("a", [{ kind: "match", shape: "row" }]), undefined, { seed });
      g.state.players[0].monsters[0]!.evolution = 1;
      const r = g.applyMove(0, FIRE_SWAP);
      if (!r.ok) continue;
      const cast = r.casts[0]!.effects.find((e) => e.kind === "match");
      if (!cast || cast.kind !== "match") continue;
      const rows = [...new Set(cast.cells.map((c) => c.y))];
      expect(rows).toHaveLength(2);
      for (const y of rows) hit[y]++;
    }
    // 600 row-hits over 5 rows: ~120 each. With a 2-row band the edges got ~75; now none is far off.
    for (const n of hit) expect(n).toBeGreaterThan(95);
  });

  it("passives grow with evolution", () => {
    const def = fireMon("a", [], 3, { followUp: 3, berserk: { threshold: 20, hits: 4, amount: 5 } });
    expect(scaledPassive(def, 2)).toEqual({ followUp: 5, berserk: { threshold: 32, hits: 4, amount: 7 } });
    expect(evolutionChanges(def, 0)).toEqual(
      expect.arrayContaining(["Follow-up 3 → 4", "Berserk strikes 5 → 6", "Berserk at 20 → 26 HP"]),
    );
  });

  it("an evolved partner's follow-up hits harder in play", () => {
    const helper: Monster = { ...fireMon("h", [], 99, { followUp: 3 }), element: "light" };
    const g = newGame(fireMon("a", [dmg(10)]), filler, {}, helper);
    g.state.players[0].monsters[1]!.evolution = 2;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    expect(g.state.players[1].hp).toBe(STARTING_HP - 10 - 5);
  });
});

describe("control effects", () => {
  it("a freeze cast mid-turn waits for the turn to pass", () => {
    const g = newGame(fireMon("a", [{ kind: "freeze", count: 3, turns: 1 }]));
    g.applyMove(0, FIRE_SWAP); // first of two moves
    expect(g.state.turn).toBe(0);
    expect(g.state.ice.flat().every((v) => v === 0)).toBe(true);
    expect(g.state.pendingFreeze).toHaveLength(1);
  });

  it("petrify prefers the rival's element tiles", () => {
    const water: Monster = { id: "w", name: "w", element: "water", chargeCost: 99, ability: { name: "n", effects: [] } };
    const g = newGame(fireMon("a", [{ kind: "petrify", count: 2 }]), water);
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    const before = r.cascades.at(-1)!.after; // the board just before the move fired
    const stoned: Tile[] = [];
    g.state.board.grid.forEach((row, y) => row.forEach((t, x) => t === "stone" && stoned.push(before[y]![x]!)));
    expect(stoned).toHaveLength(2);
    // The rival's side is water (+ a light filler); fire is ours and never stoned.
    expect(stoned.every((t) => t !== "fire")).toBe(true);
  });
});

describe("kit mechanics: pierce, ignite, regen, bubble, anti-heal", () => {
  it("piercing damage ignores shields", () => {
    const g = newGame(fireMon("a", [{ kind: "damage", amount: 10, pierce: true }]));
    g.state.players[1].shield = 20;
    g.applyMove(0, FIRE_SWAP);
    expect(g.state.players[1].shield).toBe(20);
    expect(g.state.players[1].hp).toBe(STARTING_HP - 10);
  });

  it("ignite detonates every burn for all its remaining ticks, through shields, and clears them", () => {
    const g = newGame(fireMon("a", [{ kind: "ignite" }]));
    const foe = g.state.players[1];
    foe.shield = 15;
    foe.dots = [
      { kind: "burn", amount: 5, turns: 3, element: "fire" },
      { kind: "burn", amount: 3, turns: 1, element: "fire" },
      { kind: "poison", amount: 4, turns: 2, element: "nature" },
    ];
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "ignite", amount: 18, burns: 2 });
    expect(foe.hp).toBe(STARTING_HP - 18);
    expect(foe.shield).toBe(15);
    expect(foe.dots.map((d) => d.kind)).toEqual(["poison"]); // poison isn't fire
  });

  it("ignite with nothing burning does nothing", () => {
    const g = newGame(fireMon("a", [{ kind: "ignite" }]));
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "ignite", amount: 0, burns: 0 });
    expect(g.state.players[1].hp).toBe(STARTING_HP);
  });

  it("regen heals at the start of each of the caster's turns, then runs out", () => {
    const g = newGame(fireMon("a", [{ kind: "regen", amount: 5, turns: 2 }]));
    const me = g.state.players[0];
    me.hp = 50;
    g.applyMove(0, FIRE_SWAP);
    expect(me.regen).toEqual([{ amount: 5, turns: 2 }]);
    g.state.turn = 1; g.state.movesLeft = 1; // hand the turn to the rival...
    g.state.players[1].monsters.forEach((m) => (m.charge = 0));
    const mv = chooseMove(g, 1)!;
    g.applyMove(1, mv); // ...whose turn ends, so ours starts and regen ticks
    expect(me.hp).toBe(55);
    expect(me.regen).toEqual([{ amount: 5, turns: 1 }]);
  });

  it("poison halves healing (heals, life steal and regen), rounded up", () => {
    const g = newGame(fireMon("a", [{ kind: "heal", amount: 9 }, { kind: "drain", amount: 6 }]));
    const me = g.state.players[0];
    me.hp = 40;
    me.dots = [{ kind: "poison", amount: 2, turns: 3, element: "nature" }];
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "heal", amount: 5 });
    expect(r.casts[0]!.effects[1]).toMatchObject({ kind: "drain", amount: 6, healed: 3 });
    expect(me.hp).toBe(48);
  });

  it("a bubble blocks the next harmful effect, one per bubble", () => {
    const g = newGame(fireMon("a", [
      { kind: "dot", dot: "burn", amount: 5, turns: 2 },
      { kind: "slow", count: 1 },
      { kind: "seal", turns: 2 },
    ]));
    const foe = g.state.players[1];
    foe.bubble = 2;
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    const [burn, slow, seal] = r.casts[0]!.effects;
    expect(burn).toMatchObject({ kind: "dot", blocked: true });
    expect(slow).toMatchObject({ kind: "slow", blocked: true });
    expect(seal).not.toHaveProperty("blocked");
    expect(foe.dots).toHaveLength(0);
    expect(foe.slow).toBe(0);
    expect(foe.bubble).toBe(0);
    expect(foe.monsters.some((m) => m.sealed > 0)).toBe(true);
  });

  it("a bubble stops a freeze before it lands", () => {
    const g = newGame(fireMon("a", [{ kind: "freeze", count: 3, turns: 1 }]));
    g.state.players[1].bubble = 1;
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "freeze", blocked: true });
    expect(g.state.pendingFreeze).toHaveLength(0);
  });

  it("bubbles stack up to 3", () => {
    const g = newGame(fireMon("a", [{ kind: "bubble", count: 5 }]));
    g.applyMove(0, FIRE_SWAP);
    expect(g.state.players[0].bubble).toBe(3);
  });

  it("regen lasts longer at ★ and bubbles add one at ★★", () => {
    const def = fireMon("a", [{ kind: "regen", amount: 5, turns: 3 }, { kind: "bubble", count: 1 }]);
    expect(scaledEffects(def, 1)).toMatchObject([{ amount: scaleAmount(5, 1), turns: 4 }, { count: 1 }]);
    expect(scaledEffects(def, 2)).toMatchObject([{ amount: scaleAmount(5, 2), turns: 4 }, { count: 2 }]);
    expect(evolutionChanges(def, 0)).toContain("Regen lasts 3 → 4 turns");
  });
});

describe("kit mechanics: shield bash, feeding vine, shatter, bloom, targeted seal, afterburn", () => {
  it("shield bash hits for half your shield after it shields up, never less than its minimum", () => {
    const bash: Effect[] = [{ kind: "shield", amount: 14 }, { kind: "damage", amount: 9, fromShield: 0.5 }];
    const a = newGame(fireMon("a", bash));
    a.state.players[0].shield = 10; // 10 + 14 = 24 -> 12
    const r = a.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[1]).toMatchObject({ kind: "damage", amount: 12 });
    const b = newGame(fireMon("a", bash)); // 14 -> 7, so the minimum 9
    const r2 = b.applyMove(0, FIRE_SWAP);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.casts[0]!.effects[1]).toMatchObject({ kind: "damage", amount: 9 });
  });

  it("feeding vine steals more for every turn of burn or poison left on the rival", () => {
    const g = newGame(fireMon("a", [{ kind: "drain", amount: 10, perDotTurn: 2 }]));
    g.state.players[0].hp = 40;
    g.state.players[1].dots = [
      { kind: "burn", amount: 3, turns: 3, element: "fire" },
      { kind: "poison", amount: 2, turns: 2, element: "nature" },
    ];
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "drain", amount: 20 });
  });

  it("a blast with shatter breaks the stones in it into the rival", () => {
    const g = newGame(fireMon("a", [{ kind: "match", shape: "col", shatter: 2 }]));
    for (let x = 0; x < 5; x++) g.state.board.grid[4]![x] = "stone"; // one stone in every column
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    const ev = r.casts[0]!.effects[0]!;
    expect(ev).toMatchObject({ kind: "match", shatter: { target: 1, stones: 1, amount: 2 } });
    expect(g.state.players[1].hp).toBe(STARTING_HP - 2);
  });

  it("bloom grows the partner's element", () => {
    const water: Monster = { ...filler, id: "w", element: "water" };
    const g = newGame(fireMon("a", [{ kind: "convert", count: 3, partner: true }]), filler, {}, water);
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "convert", element: "water" });
  });

  it("a seal lands on the rival monster closest to firing", () => {
    const foeA: Monster = { ...filler, id: "fa" }, foeB: Monster = { ...filler, id: "fb" };
    const g = new MatchMonstersGame({
      matchId: "t", seed: 123, board: { width: 5, height: 5, palette: ELEMENTS },
      players: [
        { peerId: "p0", displayName: "A", monsters: [fireMon("a", [{ kind: "seal", turns: 2 }]), filler] },
        { peerId: "p1", displayName: "B", monsters: [foeA, foeB] },
      ],
    });
    g.state.board.grid = grid(LAYOUT);
    g.state.players[1].monsters[0]!.charge = 1;
    g.state.players[1].monsters[1]!.charge = 6;
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "seal", monsterId: "fb" });
  });

  it("afterburn makes the team's burns last longer (and grows at ★★)", () => {
    const wing = fireMon("w", [], 99, { afterburn: 1 });
    const g = newGame(fireMon("a", [{ kind: "dot", dot: "burn", amount: 3, turns: 2 }]), filler, {}, wing);
    const r = g.applyMove(0, FIRE_SWAP);
    if (!r.ok) throw new Error(r.reason);
    expect(r.casts[0]!.effects[0]).toMatchObject({ kind: "dot", dot: "burn", turns: 3 });
    expect(scaledPassive(wing, 2)?.afterburn).toBe(2);
  });
});

describe("bot", () => {
  it("only moves on its own turn, always legally, and evolves when it can", () => {
    const g = newGame(fireMon("a", [dmg(10)]));
    expect(chooseMove(g, 1)).toBeNull();
    for (let i = 0; i < 30 && g.state.phase !== "finished"; i++) {
      const mv = chooseMove(g, g.state.turn);
      expect(mv).not.toBeNull();
      expect(g.applyMove(g.state.turn, mv!).ok).toBe(true);
    }
    g.state.players[g.state.turn].berries = 4;
    expect(chooseEvolution(g, g.state.turn)).not.toBeNull();
  });
});

describe("free swaps", () => {
  it("a swap that makes no match still moves the tiles and costs a move", () => {
    const g = newGame(fireMon("a", [dmg(10)]));
    // Find an adjacent swap on the fixed layout that doesn't line anything up.
    let move: { type: "swap"; from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
    for (let y = 0; y < 5 && !move; y++) for (let x = 0; x < 4 && !move; x++) {
      const b = { ...g.state.board, grid: g.state.board.grid.map((r) => r.slice()) };
      const t = b.grid[y]![x]!; b.grid[y]![x] = b.grid[y]![x + 1]!; b.grid[y]![x + 1] = t;
      if (t !== b.grid[y]![x] && findMatches(b).length === 0) move = { type: "swap", from: { x, y }, to: { x: x + 1, y } };
    }
    expect(move).not.toBeNull();
    const before = g.state.board.grid.map((r) => r.slice());
    const r = g.applyMove(0, move!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cascades).toHaveLength(0);
    expect(g.state.board.grid[move!.from.y]![move!.from.x]).toBe(before[move!.to.y]![move!.to.x]);
    expect(g.state.board.grid[move!.to.y]![move!.to.x]).toBe(before[move!.from.y]![move!.from.x]);
    expect(g.state.movesLeft).toBe(1);
    expect(g.state.players[0].monsters[0]!.charge).toBe(0);
    expect(g.state.players[1].hp).toBe(STARTING_HP);
  });
});

describe("effect events", () => {
  it("every cast reports one event per effect, with what actually happened", () => {
    const water: Monster = { id: "w", name: "w", element: "water", chargeCost: 99, ability: { name: "n", effects: [] } };
    const g = newGame(
      fireMon("a", [
        dmg(5),
        { kind: "heal", amount: 3 },
        { kind: "petrify", count: 2 },
        { kind: "sap", count: 2 },
        { kind: "seal", turns: 1 },
        { kind: "freeze", count: 2, turns: 1 },
        { kind: "match", shape: "square" },
      ]),
      water,
    );
    g.state.players[1].monsters[0]!.charge = 1;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cast = r.casts[0]!;
    expect(cast.effects.map((e) => e.kind)).toEqual(["damage", "heal", "petrify", "sap", "seal", "freeze", "match"]);
    expect(cast.effects[0]).toEqual({ kind: "damage", target: 1, amount: 5 });
    const petrify = cast.effects[2] as { cells: { x: number; y: number }[] };
    expect(petrify.cells).toHaveLength(2);
    expect(cast.effects[3]).toEqual({ kind: "sap", target: 1, drained: { w: 1 } });
    expect(cast.effects[4]).toMatchObject({ kind: "seal", target: 1, turns: 1 });
    const match = cast.effects[6] as { step: number; cells: unknown[] };
    expect(match.cells).toHaveLength(4);
    expect(r.effectSteps[match.step]).toBeDefined();
    expect(r.iceLanded).toEqual([]); // still mid-turn; it lands when the turn passes
  });

  it("reports frozen cells when the freeze lands at the turn change", () => {
    const g = newGame(fireMon("a", [{ kind: "freeze", count: 2, turns: 1 }]));
    g.state.movesLeft = 1;
    const r = g.applyMove(0, FIRE_SWAP);
    expect(r.ok && r.iceLanded.length).toBe(2);
  });
});
