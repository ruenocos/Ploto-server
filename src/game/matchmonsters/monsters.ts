/**
 * Monster roster.
 *
 * Our own creatures (not Plato's), one playable set across the five elements so
 * Match Monsters is fun to play right now. Stats are balanced by a simple rule:
 * tankier monsters hit softer (high maxHp / low power), glass cannons the reverse.
 * IDs are stable so saved games and tests keep working.
 */
import type { Element, Monster } from "./types.js";

function m(id: string, name: string, element: Element, maxHp: number, power: number): Monster {
  return { id, name, element, maxHp, power };
}

export const MONSTERS: Record<string, Monster> = {
  // 🔥 fire — aggressive, hits hard, runs hot
  ember_pup: m("ember_pup", "Ember Pup", "fire", 80, 6),
  cinder_hound: m("cinder_hound", "Cinder Hound", "fire", 90, 6),
  magma_titan: m("magma_titan", "Magma Titan", "fire", 130, 5),
  phoenix_chick: m("phoenix_chick", "Phoenix Chick", "fire", 70, 8),

  // 💧 water — steady, resilient
  tide_serpent: m("tide_serpent", "Tide Serpent", "water", 95, 5),
  frost_imp: m("frost_imp", "Frost Imp", "water", 75, 7),
  kraken_pup: m("kraken_pup", "Kraken Pup", "water", 110, 5),
  bubble_jelly: m("bubble_jelly", "Bubble Jelly", "water", 100, 4),

  // 🪨 earth — walls, big HP
  stone_golem: m("stone_golem", "Stone Golem", "earth", 120, 4),
  boulder_beetle: m("boulder_beetle", "Boulder Beetle", "earth", 105, 5),
  quake_mole: m("quake_mole", "Quake Mole", "earth", 95, 6),
  crystal_ox: m("crystal_ox", "Crystal Ox", "earth", 140, 4),

  // 🌿 nature — balanced, versatile
  thorn_sprite: m("thorn_sprite", "Thorn Sprite", "nature", 85, 5),
  vine_lurker: m("vine_lurker", "Vine Lurker", "nature", 100, 5),
  shroom_knight: m("shroom_knight", "Shroom Knight", "nature", 115, 5),
  petal_fawn: m("petal_fawn", "Petal Fawn", "nature", 80, 6),

  // ✨ light — glass cannons, precise
  prism_owl: m("prism_owl", "Prism Owl", "light", 75, 7),
  dawn_sprite: m("dawn_sprite", "Dawn Sprite", "light", 70, 8),
  lumen_stag: m("lumen_stag", "Lumen Stag", "light", 90, 6),
  halo_moth: m("halo_moth", "Halo Moth", "light", 65, 9),
};

export const ELEMENT_EMOJI: Record<Element, string> = {
  fire: "🔥",
  water: "💧",
  earth: "🪨",
  nature: "🌿",
  light: "✨",
};

export function monsterById(id: string): Monster | undefined {
  return MONSTERS[id];
}

export function monstersByElement(element: Element): Monster[] {
  return Object.values(MONSTERS).filter((m) => m.element === element);
}

/** Full roster as an array, for pickers and APIs. */
export function roster(): Monster[] {
  return Object.values(MONSTERS);
}
