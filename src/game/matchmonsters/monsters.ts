/**
 * Sample monster catalogue (clean-room placeholder).
 *
 * These are our own stand-in creatures, one per element, so the engine and
 * matchmaking are fully playable today. The real Plato roster, art and exact
 * stat tuning live in the Match Monsters `client.zip`; swap these out once that
 * bundle's definitions are available. IDs are stable so saved games keep working.
 */
import type { Element, Monster } from "./types.js";

export const MONSTERS: Record<string, Monster> = {
  ember_pup: { id: "ember_pup", name: "Ember Pup", element: "fire", maxHp: 80, power: 6 },
  tide_serpent: { id: "tide_serpent", name: "Tide Serpent", element: "water", maxHp: 95, power: 5 },
  stone_golem: { id: "stone_golem", name: "Stone Golem", element: "earth", maxHp: 120, power: 4 },
  thorn_sprite: { id: "thorn_sprite", name: "Thorn Sprite", element: "nature", maxHp: 85, power: 5 },
  prism_owl: { id: "prism_owl", name: "Prism Owl", element: "light", maxHp: 75, power: 7 },
};

export function monsterById(id: string): Monster | undefined {
  return MONSTERS[id];
}

export function monstersByElement(element: Element): Monster[] {
  return Object.values(MONSTERS).filter((m) => m.element === element);
}
