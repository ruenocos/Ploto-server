/**
 * Monster roster.
 *
 * Our own creatures. Each element has an archetype; every monster's move is a
 * stack of effects — usually damage plus a twist — and a few have passives:
 *   🔥 fire   — Destroyer: big hits, burns, blasts that match board regions
 *   💧 water  — Controller: freeze tiles, sap rival charge, steal rival moves
 *   🪨 earth  — Fortress: stone blockers, quakes, big shields and heals
 *   🌿 nature — Sustain: poison, life-steal, sealing rival charge, overgrowth
 *   ✨ light  — Tempo: burst, extra moves, cleansing, empowering your partner
 * Display text is generated from the effects (see describeEffects), so the
 * numbers here are the single source of truth. IDs are stable.
 */
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
  ember_pup: m("ember_pup", "Pyrup", "fire", 6, "Ember Bite", [dmg(12)]),
  cinder_hound: m("cinder_hound", "Scorchpaw", "fire", 8, "Scorch Line",
    [dmg(12), { kind: "match", shape: "row" }],
    { berserk: { threshold: 30, hits: 4, amount: 6 } }),
  magma_titan: m("magma_titan", "Magmaul", "fire", 12, "Eruption",
    [dmg(18), { kind: "match", shape: "area" }]),
  phoenix_chick: m("phoenix_chick", "Emberwing", "fire", 9, "Cinder Rain",
    [dmg(6), { kind: "dot", dot: "burn", amount: 5, turns: 3 }]),

  // 💧 water — Controller
  tide_serpent: m("tide_serpent", "Tidecoil", "water", 8, "Undertow",
    [dmg(10), { kind: "sap", count: 3 }]),
  frost_imp: m("frost_imp", "Frostnip", "water", 7, "Frostbite",
    [dmg(8), { kind: "freeze", count: 4, turns: 1 }]),
  kraken_pup: m("kraken_pup", "Krakling", "water", 10, "Riptide",
    [dmg(16), { kind: "slow", count: 1 }]),
  bubble_jelly: m("bubble_jelly", "Bublob", "water", 8, "Bubble Barrier",
    [shield(14), dmg(6), { kind: "cleanse" }]),

  // 🪨 earth — Fortress
  stone_golem: m("stone_golem", "Craggol", "earth", 9, "Stone Skin", [shield(18), dmg(8)]),
  boulder_beetle: m("boulder_beetle", "Rubbug", "earth", 8, "Petrify",
    [dmg(10), { kind: "petrify", count: 4 }]),
  quake_mole: m("quake_mole", "Tremole", "earth", 9, "Tremor",
    [dmg(12), { kind: "match", shape: "col" }]),
  crystal_ox: m("crystal_ox", "Gemox", "earth", 10, "Crystal Mend", [heal(14), shield(6), dmg(6)]),

  // 🌿 nature — Sustain
  thorn_sprite: m("thorn_sprite", "Thornkin", "nature", 7, "Thorn Prick",
    [dmg(3), { kind: "dot", dot: "poison", amount: 4, turns: 3 }]),
  vine_lurker: m("vine_lurker", "Vinecoil", "nature", 10, "Leech Vine", [{ kind: "drain", amount: 12 }]),
  shroom_knight: m("shroom_knight", "Myconite", "nature", 8, "Spore Cloud",
    [dmg(8), { kind: "seal", turns: 2 }]),
  petal_fawn: m("petal_fawn", "Petalope", "nature", 8, "Overgrowth",
    [heal(10), { kind: "convert", count: 4 }]),

  // ✨ light — Tempo
  prism_owl: m("prism_owl", "Lumowl", "light", 10, "Smite",
    [dmg(18), { kind: "match", shape: "square" }]),
  dawn_sprite: m("dawn_sprite", "Glintling", "light", 8, "Starstep",
    [dmg(10), { kind: "haste", count: 1 }]),
  lumen_stag: m("lumen_stag", "Lumistag", "light", 9, "Radiance",
    [dmg(6), heal(12), { kind: "cleanse" }]),
  halo_moth: m("halo_moth", "Lumoth", "light", 7, "Kindred Glow",
    [dmg(8), { kind: "empower", count: 3 }],
    { followUp: 5 }),
};

export const ELEMENT_EMOJI: Record<Element, string> = {
  fire: "🔥",
  water: "💧",
  earth: "🪨",
  nature: "🌿",
  light: "✨",
};

/** One-line identity per element, shown in the picker. */
export const ARCHETYPES: Record<Element, { title: string; blurb: string }> = {
  fire: { title: "Destroyer", blurb: "Big hits, burns, and blasts that clear the board" },
  water: { title: "Controller", blurb: "Freeze tiles, sap charge, steal rival moves" },
  earth: { title: "Fortress", blurb: "Stone blockers, quakes, big shields and heals" },
  nature: { title: "Sustain", blurb: "Poison, life-steal, sealing, overgrowth" },
  light: { title: "Tempo", blurb: "Burst, extra moves, cleansing, teamwork" },
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
