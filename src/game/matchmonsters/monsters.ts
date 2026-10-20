/**
 * Monster roster.
 *
 * Our own creatures. Each element has an archetype. Every monster has ONE move
 * (damage plus exactly one twist; a pure-support move is its main effect plus one
 * twist) and ONE passive (an always-on rule that gives it its identity):
 *   🔥 fire   — Destroyer: big hits, burns, blasts that match board regions
 *   💧 water  — Controller: freeze tiles, sap rival charge, steal rival moves
 *   🪨 earth  — Guardian: stone blockers, quakes, shields and hides that blunt big hits
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
  passive: Passive,
): Monster {
  const ability: Ability = { name: moveName, effects };
  return { id, name, element, chargeCost, ability, passive };
}

export const MONSTERS: Record<string, Monster> = {
  // 🔥 fire — Destroyer
  // Ember Bite sets off every burn on the rival; Kindling keeps lighting new ones off its partner's hits.
  ember_pup: m("ember_pup", "Pyrup", "fire", 7, "Ember Bite",
    [{ kind: "ignite" }, dmg(11)],
    { kind: "kindling", amount: 3, turns: 2 }),
  cinder_hound: m("cinder_hound", "Scorchpaw", "fire", 8, "Scorch Line",
    [dmg(10), { kind: "match", shape: "row" }],
    { kind: "berserk", threshold: 16, hits: 4, amount: 4 }),
  // Overheat: charge banked past full (its own 3×3 blast often lands some) makes the next Eruption bigger.
  magma_titan: m("magma_titan", "Magmaul", "fire", 12, "Eruption",
    [dmg(22), { kind: "match", shape: "area" }],
    { kind: "overheat", amount: 3 }),
  // Afterburn: every burn the team lays lasts a turn longer (Pyrup's Kindling burns too).
  phoenix_chick: m("phoenix_chick", "Emberwing", "fire", 9, "Cinder Rain",
    [dmg(10), { kind: "dot", dot: "burn", amount: 4, turns: 3 }],
    { kind: "afterburn", turns: 1 }),

  // 💧 water — Controller
  // Undercurrent: the charge Undertow drains from the rival flows into its partner.
  tide_serpent: m("tide_serpent", "Tidecoil", "water", 8, "Undertow",
    [dmg(11), { kind: "sap", count: 1 }],
    { kind: "undercurrent" }),
  // Frost armor: its ice lands on the rival's turn, exactly when their hits come in.
  frost_imp: m("frost_imp", "Frostnip", "water", 7, "Frostbite",
    [dmg(14), { kind: "freeze", count: 3, turns: 1 }],
    { kind: "frostArmor", amount: 2 }),
  kraken_pup: m("kraken_pup", "Krakling", "water", 10, "Riptide",
    [dmg(16), { kind: "slow", count: 1 }],
    { kind: "lurk", count: 1 }),
  // Pearl Snatch pockets the rival's berries; Bubble shell answers every freeze, slow, seal,
  // burn or poison that gets through with a bubble that blocks the next one.
  bubble_jelly: m("bubble_jelly", "Bublob", "water", 8, "Pearl Snatch",
    [dmg(14), { kind: "pluck", count: 1 }],
    { kind: "bubbleShell", count: 1 }),

  // 🪨 earth — Guardian
  // Shield Bash: shield up, then hit with it. Other shields (Gemox's Crystal hide) make the bash bigger.
  stone_golem: m("stone_golem", "Craggol", "earth", 9, "Shield Bash",
    [shield(13), { kind: "damage", amount: 9, fromShield: 0.5 }],
    { kind: "bedrock", cap: 16 }),
  boulder_beetle: m("boulder_beetle", "Rubbug", "earth", 8, "Petrify",
    [dmg(15), { kind: "petrify", count: 3 }],
    { kind: "rockslide", amount: 3 }),
  // Fault line: stones in any of the team's blasts shatter into the rival (Rubbug's, or the rival's own).
  quake_mole: m("quake_mole", "Tremole", "earth", 9, "Tremor",
    [dmg(12), { kind: "match", shape: "col" }],
    { kind: "faultLine", amount: 4 }),
  // Crystallize grows earth gems, so it fuels itself (and any earth partner).
  crystal_ox: m("crystal_ox", "Gemox", "earth", 9, "Crystallize",
    [dmg(16), { kind: "convert", count: 2 }],
    { kind: "crystalHide", amount: 2 }),

  // 🌿 nature — Survivor
  // Poison halves the rival's healing while it lasts: the counter to sustain teams.
  thorn_sprite: m("thorn_sprite", "Thornkin", "nature", 7, "Thorn Prick",
    [dmg(5), { kind: "dot", dot: "poison", amount: 3, turns: 3 }],
    { kind: "thorns", amount: 1, turns: 2 }),
  // Feeds on pain: steals more the longer the rival burns or is poisoned (Thornkin, Emberwing, Pyrup).
  vine_lurker: m("vine_lurker", "Tanglet", "nature", 9, "Feeding Vine",
    [{ kind: "drain", amount: 14 }],
    { kind: "feedsOnPain", amount: 1, cap: 4 }),
  // Spore Cloud seals the rival monster closest to firing (an unsealed one first).
  shroom_knight: m("shroom_knight", "Myconite", "nature", 9, "Spore Cloud",
    [dmg(7), { kind: "seal", matches: 6 }],
    { kind: "mycelium", count: 1 }),
  // Harvest Bloom grows berries on the shared board (grab them before the rival does),
  // and Sweet tooth turns every berry you match into charge for it.
  petal_fawn: m("petal_fawn", "Petalope", "nature", 7, "Harvest Bloom",
    [dmg(12), { kind: "grow", count: 2 }],
    { kind: "sweetTooth", amount: 1 }),

  // ✨ light — Striker
  // Keen eye: the whole team's hits ignore shields, the counter to Earth.
  prism_owl: m("prism_owl", "Lumowl", "light", 9, "Smite",
    [dmg(17), { kind: "match", shape: "square" }],
    { kind: "keenEye" }),
  dawn_sprite: m("dawn_sprite", "Glintling", "light", 9, "Starstep",
    [dmg(8), { kind: "haste", count: 1 }],
    { kind: "daybreak" }),
  // Healing over time (the mirror of a burn); each turn it ticks, Glow charges Dawnhare back up.
  lumen_stag: m("lumen_stag", "Dawnhare", "light", 8, "Radiance",
    [dmg(10), { kind: "regen", amount: 3, turns: 3 }],
    { kind: "glow", count: 1 }),
  halo_moth: m("halo_moth", "Halomoth", "light", 7, "Kindred Glow",
    [dmg(9), { kind: "empower", count: 2 }],
    { kind: "followUp", amount: 3 }),
};

/** One-line identity per element, shown in the picker. */
export const ARCHETYPES: Record<Element, { title: string; blurb: string }> = {
  fire: { title: "Destroyer", blurb: "Big hits, burns, and blasts that clear the board" },
  water: { title: "Controller", blurb: "Freeze tiles, sap charge, steal moves and berries" },
  earth: { title: "Guardian", blurb: "Stone blockers, quakes, shields and hides that blunt big hits" },
  nature: { title: "Survivor", blurb: "Poison that halves healing, life-steal, sealing, berries" },
  light: { title: "Striker", blurb: "Piercing burst, extra moves, regeneration, teamwork" },
};

/** Two different monsters at random: a dealt team (Random mode, and the practice bot's team). */
export function dealTeam(rand: () => number = Math.random): [Monster, Monster] {
  const all = Object.values(MONSTERS);
  const a = all[Math.floor(rand() * all.length)]!;
  const rest = all.filter((m) => m !== a);
  return [a, rest[Math.floor(rand() * rest.length)]!];
}

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
