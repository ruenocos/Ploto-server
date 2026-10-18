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
  ember_pup: m("ember_pup", "Pyrup", "fire", 7, "Ember Bite", [dmg(17)]),
  cinder_hound: m("cinder_hound", "Scorchpaw", "fire", 8, "Scorch Line",
    [dmg(6), { kind: "match", shape: "row" }],
    { berserk: { threshold: 16, hits: 4, amount: 4 } }),
  magma_titan: m("magma_titan", "Magmaul", "fire", 12, "Eruption",
    [dmg(19), { kind: "match", shape: "area" }]),
  phoenix_chick: m("phoenix_chick", "Emberwing", "fire", 9, "Cinder Rain",
    [dmg(10), { kind: "dot", dot: "burn", amount: 5, turns: 3 }]),

  // 💧 water — Controller
  tide_serpent: m("tide_serpent", "Tidecoil", "water", 8, "Undertow",
    [dmg(10), { kind: "sap", count: 2 }]),
  frost_imp: m("frost_imp", "Frostnip", "water", 7, "Frostbite",
    [dmg(13), { kind: "freeze", count: 3, turns: 1 }]),
  kraken_pup: m("kraken_pup", "Krakling", "water", 10, "Riptide",
    [dmg(19), { kind: "slow", count: 1 }]),
  bubble_jelly: m("bubble_jelly", "Bublob", "water", 8, "Bubble Barrier",
    [shield(10), dmg(10), { kind: "cleanse" }]),

  // 🪨 earth — Fortress
  stone_golem: m("stone_golem", "Craggol", "earth", 9, "Stone Skin", [shield(18), dmg(9)]),
  boulder_beetle: m("boulder_beetle", "Rubbug", "earth", 8, "Petrify",
    [dmg(14), { kind: "petrify", count: 3 }]),
  quake_mole: m("quake_mole", "Tremole", "earth", 9, "Tremor",
    [dmg(10), { kind: "match", shape: "col" }]),
  crystal_ox: m("crystal_ox", "Gemox", "earth", 10, "Crystal Mend", [heal(14), shield(6), dmg(9)]),

  // 🌿 nature — Sustain
  thorn_sprite: m("thorn_sprite", "Thornkin", "nature", 7, "Thorn Prick",
    [dmg(4), { kind: "dot", dot: "poison", amount: 4, turns: 3 }]),
  vine_lurker: m("vine_lurker", "Vinecoil", "nature", 10, "Leech Vine", [{ kind: "drain", amount: 13 }]),
  shroom_knight: m("shroom_knight", "Myconite", "nature", 9, "Spore Cloud",
    [dmg(6), { kind: "seal", turns: 2 }]),
  petal_fawn: m("petal_fawn", "Petalope", "nature", 7, "Overgrowth",
    [dmg(5), heal(10), { kind: "convert", count: 4 }]),

  // ✨ light — Tempo
  prism_owl: m("prism_owl", "Lumowl", "light", 10, "Smite",
    [dmg(18), { kind: "match", shape: "square" }]),
  dawn_sprite: m("dawn_sprite", "Glintling", "light", 8, "Starstep",
    [dmg(12), { kind: "haste", count: 1 }]),
  lumen_stag: m("lumen_stag", "Lumistag", "light", 8, "Radiance",
    [dmg(11), heal(10), { kind: "cleanse" }]),
  halo_moth: m("halo_moth", "Lumoth", "light", 7, "Kindred Glow",
    [dmg(6), { kind: "empower", count: 2 }],
    { followUp: 3 }),
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

/**
 * Fingerprint of the roster's numbers. Match history stores it so balance stats
 * can be split by patch (it changes whenever any monster is retuned).
 */
export const BALANCE_VERSION = createHash("sha256").update(JSON.stringify(MONSTERS)).digest("hex").slice(0, 10);
