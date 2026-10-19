/**
 * Monster roster.
 *
 * Our own creatures. Each element has an archetype; every monster's move is a
 * stack of effects — usually damage plus a twist — and a few have passives:
 *   🔥 fire   — Destroyer: big hits, burns, blasts that match board regions
 *   💧 water  — Controller: freeze tiles, sap rival charge, steal rival moves
 *   🪨 earth  — Guardian: stone blockers, quakes, big shields and heals
 *   🌿 nature — Survivor: poison, life-steal, sealing rival charge, berries
 *   ✨ light  — Striker: burst, extra moves, regeneration, empowering your partner
 * Display text is generated from the effects (see describeEffects), so the
 * numbers here are the single source of truth. IDs are stable.
 */
import { createHash } from "node:crypto";
import type { Ability, Effect, Element, Monster, Passive } from "./types.js";

const dmg = (amount: number): Effect => ({ kind: "damage", amount });
const heal = (amount: number): Effect => ({ kind: "heal", amount });
const shield = (amount: number): Effect => ({ kind: "shield", amount });

function m(
  id: string,
  name: string,
  element: Element,
  chargeCost: number,
  moveName: string,
  effects: Effect[],
  passive?: Passive,
): Monster {
  const ability: Ability = { name: moveName, effects };
  return { id, name, element, chargeCost, ability, ...(passive ? { passive } : {}) };
}

export const MONSTERS: Record<string, Monster> = {
  // 🔥 fire — Destroyer
  // Each bite sets off the burns already on the rival, then leaves a small one for next time.
  // Alone it detonates its own leftovers; next to Emberwing it sets off a much bigger burn.
  ember_pup: m("ember_pup", "Pyrup", "fire", 7, "Ember Bite",
    [{ kind: "ignite" }, dmg(11), { kind: "dot", dot: "burn", amount: 3, turns: 2 }]),
  cinder_hound: m("cinder_hound", "Scorchpaw", "fire", 8, "Scorch Line",
    [dmg(6), { kind: "match", shape: "row" }],
    { berserk: { threshold: 16, hits: 4, amount: 4 } }),
  magma_titan: m("magma_titan", "Magmaul", "fire", 12, "Eruption",
    [dmg(19), { kind: "match", shape: "area" }]),
  // Afterburn: every burn the team lays lasts a turn longer (Pyrup's Ignite then sets off more).
  phoenix_chick: m("phoenix_chick", "Emberwing", "fire", 9, "Cinder Rain",
    [dmg(10), { kind: "dot", dot: "burn", amount: 4, turns: 3 }],
    { afterburn: 1 }),

  // 💧 water — Controller
  tide_serpent: m("tide_serpent", "Tidecoil", "water", 8, "Undertow",
    [dmg(10), { kind: "sap", count: 2 }]),
  frost_imp: m("frost_imp", "Frostnip", "water", 7, "Frostbite",
    [dmg(14), { kind: "freeze", count: 3, turns: 1 }]),
  kraken_pup: m("kraken_pup", "Krakling", "water", 10, "Riptide",
    [dmg(19), { kind: "slow", count: 1 }]),
  // Pearl Snatch: a clam that pockets the rival's berries (slowing their evolutions, speeding yours),
  // and its bubble still eats the next freeze, slow, seal, burn or poison.
  bubble_jelly: m("bubble_jelly", "Bublob", "water", 8, "Pearl Snatch",
    [dmg(12), { kind: "pluck", count: 1 }, { kind: "bubble", count: 1 }]),

  // 🪨 earth — Guardian
  // Shield Bash: shield up, then hit with it. Other shields (Bublob, Gemox) make the bash bigger.
  stone_golem: m("stone_golem", "Craggol", "earth", 9, "Shield Bash",
    [shield(14), { kind: "damage", amount: 9, fromShield: 0.5 }]),
  boulder_beetle: m("boulder_beetle", "Rubbug", "earth", 8, "Petrify",
    [dmg(14), { kind: "petrify", count: 3 }]),
  // Stones in the column shatter into the rival: great after Rubbug's Petrify, or the rival's.
  quake_mole: m("quake_mole", "Tremole", "earth", 9, "Tremor",
    [dmg(10), { kind: "match", shape: "col", shatter: 2 }]),
  // Crystallize: mends and grows earth gems, so it fuels itself (and any earth partner).
  crystal_ox: m("crystal_ox", "Gemox", "earth", 10, "Crystallize",
    [heal(14), shield(6), dmg(8), { kind: "convert", count: 3 }]),

  // 🌿 nature — Survivor
  thorn_sprite: m("thorn_sprite", "Thornkin", "nature", 7, "Thorn Prick",
    // Poison halves the rival's healing while it lasts: the counter to sustain teams.
    [dmg(4), { kind: "dot", dot: "poison", amount: 4, turns: 3 }]),
  // Feeding Vine: steals more the longer the rival burns or is poisoned (Thornkin, Emberwing, Pyrup).
  vine_lurker: m("vine_lurker", "Tanglet", "nature", 9, "Feeding Vine", [{ kind: "drain", amount: 12, perDotTurn: 2 }]),
  shroom_knight: m("shroom_knight", "Myconite", "nature", 9, "Spore Cloud",
    [dmg(8), { kind: "seal", turns: 2 }]), // seals the rival monster closest to firing (an unsealed one first)
  // Harvest Bloom: grows berries on the shared board (grab them before the rival does),
  // and Sweet tooth turns every berry you match into charge for it.
  petal_fawn: m("petal_fawn", "Petalope", "nature", 7, "Harvest Bloom",
    [dmg(5), heal(6), { kind: "grow", count: 2 }],
    { sweetTooth: 1 }),

  // ✨ light — Striker
  prism_owl: m("prism_owl", "Lumowl", "light", 10, "Smite",
    // Piercing: ignores shields, the counter to Earth.
    [{ kind: "damage", amount: 17, pierce: true }, { kind: "match", shape: "square" }]),
  dawn_sprite: m("dawn_sprite", "Glintling", "light", 8, "Starstep",
    [dmg(12), { kind: "haste", count: 1 }]),
  lumen_stag: m("lumen_stag", "Dawnhare", "light", 8, "Radiance",
    // Healing over time (the mirror of a burn): strong if you can outlast poison.
    [dmg(11), { kind: "regen", amount: 4, turns: 3 }]),
  halo_moth: m("halo_moth", "Halomoth", "light", 7, "Kindred Glow",
    [dmg(6), { kind: "empower", count: 2 }],
    { followUp: 3 }),
};

/** One-line identity per element, shown in the picker. */
export const ARCHETYPES: Record<Element, { title: string; blurb: string }> = {
  fire: { title: "Destroyer", blurb: "Big hits, burns, and blasts that clear the board" },
  water: { title: "Controller", blurb: "Freeze tiles, sap charge, steal moves and berries" },
  earth: { title: "Guardian", blurb: "Stone blockers, quakes, big shields and heals" },
  nature: { title: "Survivor", blurb: "Poison that halves healing, life-steal, sealing, berries" },
  light: { title: "Striker", blurb: "Piercing burst, extra moves, regeneration, teamwork" },
};

export function monsterById(id: string): Monster | undefined {
  return MONSTERS[id];
}

export function monstersByElement(element: Element): Monster[] {
  return Object.values(MONSTERS).filter((m) => m.element === element);
}

export function roster(): Monster[] {
  return Object.values(MONSTERS);
}

/**
 * Fingerprint of the roster's numbers. Match history stores it so balance stats
 * can be split by patch (it changes whenever any monster is retuned).
 */
export const BALANCE_VERSION = createHash("sha256").update(JSON.stringify(MONSTERS)).digest("hex").slice(0, 10);
