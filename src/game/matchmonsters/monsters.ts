/**
 * Monster roster.
 *
 * Our own creatures (not Plato's). Each has an element, a charge cost (tiles of
 * that element you must match to fire it), and an ability. Rough balance:
 * cheaper charge = weaker effect, pricier charge = bigger swing. Fire hits hard,
 * water/earth defend (shield/heal), nature leans healing/burn, light bursts.
 * IDs are stable so saved games and tests keep working.
 */
import type { Ability, Element, Monster } from "./types.js";

function atk(amount: number): Ability {
  return { type: "attack", amount, description: `Deal ${amount} damage` };
}
function heal(amount: number): Ability {
  return { type: "heal", amount, description: `Heal ${amount} HP` };
}
function shield(amount: number): Ability {
  return { type: "shield", amount, description: `Gain a ${amount} shield` };
}
function burn(amount: number, turns: number): Ability {
  return { type: "burn", amount, turns, description: `Burn ${amount}/turn for ${turns} turns` };
}
function poison(amount: number, turns: number): Ability {
  return { type: "poison", amount, turns, description: `Poison ${amount}/turn for ${turns} turns` };
}

function m(id: string, name: string, element: Element, chargeCost: number, ability: Ability): Monster {
  return { id, name, element, chargeCost, ability };
}

export const MONSTERS: Record<string, Monster> = {
  // 🔥 fire — aggressive attackers
  ember_pup: m("ember_pup", "Ember Pup", "fire", 8, atk(14)),
  cinder_hound: m("cinder_hound", "Cinder Hound", "fire", 10, atk(18)),
  magma_titan: m("magma_titan", "Magma Titan", "fire", 14, atk(30)),
  phoenix_chick: m("phoenix_chick", "Phoenix Chick", "fire", 10, burn(6, 4)),

  // 💧 water — control & shields
  tide_serpent: m("tide_serpent", "Tide Serpent", "water", 9, shield(16)),
  frost_imp: m("frost_imp", "Frost Imp", "water", 8, atk(12)),
  kraken_pup: m("kraken_pup", "Kraken Pup", "water", 13, atk(24)),
  bubble_jelly: m("bubble_jelly", "Bubble Jelly", "water", 10, shield(22)),

  // 🪨 earth — walls & sustain
  stone_golem: m("stone_golem", "Stone Golem", "earth", 11, shield(26)),
  boulder_beetle: m("boulder_beetle", "Boulder Beetle", "earth", 8, shield(16)),
  quake_mole: m("quake_mole", "Quake Mole", "earth", 10, atk(16)),
  crystal_ox: m("crystal_ox", "Crystal Ox", "earth", 12, heal(22)),

  // 🌿 nature — healing & poison
  thorn_sprite: m("thorn_sprite", "Thorn Sprite", "nature", 8, poison(5, 3)),
  vine_lurker: m("vine_lurker", "Vine Lurker", "nature", 10, poison(7, 3)),
  shroom_knight: m("shroom_knight", "Shroom Knight", "nature", 10, heal(18)),
  petal_fawn: m("petal_fawn", "Petal Fawn", "nature", 7, heal(12)),

  // ✨ light — burst
  prism_owl: m("prism_owl", "Prism Owl", "light", 9, atk(20)),
  dawn_sprite: m("dawn_sprite", "Dawn Sprite", "light", 9, heal(16)),
  lumen_stag: m("lumen_stag", "Lumen Stag", "light", 12, atk(26)),
  halo_moth: m("halo_moth", "Halo Moth", "light", 10, atk(22)),
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

export function roster(): Monster[] {
  return Object.values(MONSTERS);
}
