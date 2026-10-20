/**
 * Match Monsters — domain types.
 *
 * Model (like the real game): a match-3 board of elemental tiles. Each player has
 * a single HP pool and fields two monsters. Matching tiles of a monster's element
 * charges it; at its charge cost it fires its move — a stack of effects (damage
 * plus a twist: board blasts, freezes, stone, charge tricks, …). Reduce the
 * opponent's HP to zero to win. Server-authoritative.
 */

export const ELEMENTS = ["fire", "water", "earth", "nature", "light"] as const;
export type Element = (typeof ELEMENTS)[number];

/**
 * A board piece: an element, a berry pickup, or a stone blocker. Stones never
 * match, can't be swapped, and crumble when a neighbouring tile is matched.
 */
export type Gem = Element | "berry" | "stone";

/** A board cell. `null` is a transient empty cell during resolution. */
export type Tile = Gem | null;

/** Berries needed to evolve a monster, and the evolution cap. */
export const BERRIES_TO_EVOLVE = 4;
export const MAX_EVOLUTION = 2; // three stages: base, ★, ★★

export interface Board {
  readonly width: number;
  readonly height: number;
  grid: Tile[][];
}

/** Starting / maximum HP for every player. */
export const STARTING_HP = 80;
/** Shields can't stack past this. */
export const MAX_SHIELD = 30;
/**
 * Sudden death: once this many turns have passed (both players combined), each
 * player takes growing damage at the start of their turn (ignores shields).
 * 38 passes = sudden death starts on each player's 20th turn (round 20).
 */
export const FATIGUE_AFTER = 38;
/** Sudden-death damage grows by this much per turn. */
export const FATIGUE_STEP = 3;

/** Shapes a "match" effect can clear (cleared tiles count as matched for you). */
export type MatchShape = "row" | "col" | "area" | "square";

/** One effect in a move. Moves are stacks of these, applied in order. */
export type Effect =
  /**
   * `pierce` damage ignores shields. `fromShield`: hit for this share of your
   * shield instead, if that's more (Craggol's Shield Bash).
   */
  | { readonly kind: "damage"; readonly amount: number; readonly pierce?: boolean; readonly fromShield?: number }
  | { readonly kind: "heal"; readonly amount: number }
  | { readonly kind: "shield"; readonly amount: number }
  /**
   * Damage the rival and heal yourself the same amount. `perDotTurn`: steal
   * this much more for every turn of burn or poison left on the rival.
   */
  | { readonly kind: "drain"; readonly amount: number; readonly perDotTurn?: number }
  /** Burn or poison the rival; poison also halves the healing they get while it lasts. */
  | { readonly kind: "dot"; readonly dot: "burn" | "poison"; readonly amount: number; readonly turns: number }
  /** The rival's burns go off at once for all the damage they had left (ignores shields). */
  | { readonly kind: "ignite" }
  /** Heal this much at the start of each of your next `turns` turns. */
  | { readonly kind: "regen"; readonly amount: number; readonly turns: number }
  /** Block the next `count` harmful effects aimed at you (burn, poison, freeze, slow, seal). */
  | { readonly kind: "bubble"; readonly count: number }
  /**
   * Clear a board region; the tiles count as matched for you (charge + berries).
   * `size` is lines for row/col (default 1) and the side for area/square (3/2).
   */
  /** `shatter`: stones in the region break for this much damage each. */
  | { readonly kind: "match"; readonly shape: MatchShape; readonly size?: number; readonly shatter?: number }
  /** Ice random tiles so they can't be swapped for the rival's next turn(s). */
  | { readonly kind: "freeze"; readonly count: number; readonly turns: number }
  /** Turn random tiles into stone blockers. */
  | { readonly kind: "petrify"; readonly count: number }
  /** Turn random tiles into your monster's element (or, with `partner`, your partner's). */
  | { readonly kind: "convert"; readonly count: number; readonly partner?: boolean }
  /** Remove charge from each rival monster. */
  | { readonly kind: "sap"; readonly count: number }
  /** Turn random tiles into berries (on the shared board: the rival can match them too). */
  | { readonly kind: "grow"; readonly count: number }
  /** Steal up to this many berries from the rival's stash. */
  | { readonly kind: "pluck"; readonly count: number }
  /** The rival gets this many fewer moves next turn. */
  | { readonly kind: "slow"; readonly count: number }
  /** The rival monster closest to firing can't gain charge for this many of the rival's matches (a 2× combo is 2). */
  | { readonly kind: "seal"; readonly matches: number }
  /** Extra moves this turn. */
  | { readonly kind: "haste"; readonly count: number }
  /** Remove your burns and poison. */
  | { readonly kind: "cleanse" }
  /** Give charge to your partner monster. */
  | { readonly kind: "empower"; readonly count: number }
  /** Gain charge yourself (passives like Lurk and Mycelium use it). */
  | { readonly kind: "charge"; readonly count: number };

export type EffectKind = Effect["kind"];

export interface Cell {
  readonly x: number;
  readonly y: number;
}

/**
 * What one effect actually did when it resolved, in order, so clients can
 * animate it. There is one variant per EffectKind (the engine's applyEffect
 * must return one for every kind, and the client's animator registry is typed
 * against this union, so adding an effect without an animation won't compile).
 */
export type EffectEvent =
  | { readonly kind: "damage"; readonly target: 0 | 1; readonly amount: number; readonly pierce?: boolean }
  /** `amount` is what was actually healed (poison halves it). */
  | { readonly kind: "heal"; readonly target: 0 | 1; readonly amount: number }
  | { readonly kind: "shield"; readonly target: 0 | 1; readonly amount: number }
  /** `amount` dealt to `target`; `healed` back to the caster (poison halves it). */
  | { readonly kind: "drain"; readonly target: 0 | 1; readonly amount: number; readonly healed: number }
  /** `blocked`: a bubble on the target stopped it. */
  | { readonly kind: "dot"; readonly target: 0 | 1; readonly dot: "burn" | "poison"; readonly amount: number; readonly turns: number; readonly blocked?: boolean }
  /** `amount` damage from `burns` detonated burns (0 if there were none). */
  | { readonly kind: "ignite"; readonly target: 0 | 1; readonly amount: number; readonly burns: number }
  | { readonly kind: "regen"; readonly target: 0 | 1; readonly amount: number; readonly turns: number }
  /** `count`: bubbles the target now has. */
  | { readonly kind: "bubble"; readonly target: 0 | 1; readonly count: number }
  /** `step` indexes the move result's effectSteps (-1 if nothing was there to clear). */
  /** `shatter`: stones the blast broke, and the damage they did to the rival. */
  | { readonly kind: "match"; readonly shape: MatchShape; readonly cells: readonly Cell[]; readonly step: number; readonly shatter?: { readonly target: 0 | 1; readonly stones: number; readonly amount: number } }
  /** Freezes land when the turn passes (see MoveResult.iceLanded). */
  | { readonly kind: "freeze"; readonly target: 0 | 1; readonly count: number; readonly turns: number; readonly blocked?: boolean }
  | { readonly kind: "petrify"; readonly cells: readonly Cell[] }
  | { readonly kind: "convert"; readonly cells: readonly Cell[]; readonly element: Element }
  | { readonly kind: "grow"; readonly cells: readonly Cell[] }
  /** `count` berries actually taken from `target`'s stash (0 if it was empty). */
  | { readonly kind: "pluck"; readonly target: 0 | 1; readonly count: number }
  /** Charge removed from each rival monster, by monster id. */
  | { readonly kind: "sap"; readonly target: 0 | 1; readonly drained: Readonly<Record<string, number>> }
  | { readonly kind: "slow"; readonly target: 0 | 1; readonly count: number; readonly blocked?: boolean }
  | { readonly kind: "seal"; readonly target: 0 | 1; readonly monsterId: string | null; readonly matches: number; readonly blocked?: boolean }
  | { readonly kind: "haste"; readonly count: number }
  | { readonly kind: "cleanse"; readonly removed: number }
  | { readonly kind: "empower"; readonly monsterIds: readonly string[]; readonly count: number }
  /** `count` charge `monsterId` (on `target`'s team) gained. */
  | { readonly kind: "charge"; readonly target: 0 | 1; readonly monsterId: string; readonly count: number };

export type EffectEventFor<K extends EffectKind> = Extract<EffectEvent, { kind: K }>;

export interface Ability {
  /** Move name shown to players, e.g. "Eruption". */
  readonly name: string;
  readonly effects: readonly Effect[];
}

/**
 * A monster's passive: one always-on rule. Every roster monster has exactly one.
 * Passives never fire moves themselves, so they can't chain into loops: a
 * triggered passive does one small thing (a burn, a shield, some charge) and
 * any charge it gives waits for that monster's next turn to act.
 */
export type Passive =
  /** At or below `threshold` HP, the move becomes `hits` strikes of `amount`. */
  | { readonly kind: "berserk"; readonly threshold: number; readonly hits: number; readonly amount: number }
  /** Whenever the partner's move deals damage, strike for `amount` too. */
  | { readonly kind: "followUp"; readonly amount: number }
  /** Burns from this team last `turns` turns longer. */
  | { readonly kind: "afterburn"; readonly turns: number }
  /** Every berry the team collects from the board gives this monster `amount` charge (up to full). */
  | { readonly kind: "sweetTooth"; readonly amount: number }
  /** Whenever the partner's move deals damage, the rival catches a burn. */
  | { readonly kind: "kindling"; readonly amount: number; readonly turns: number }
  /** When this monster fires, it spends all its charge beyond the cost for `amount` extra damage each. */
  | { readonly kind: "overheat"; readonly amount: number }
  /** Whenever a rival monster fires its move, this monster gains `count` charge. */
  | { readonly kind: "lurk"; readonly count: number }
  /** Charge this monster's move drains from the rival flows into its partner. */
  | { readonly kind: "undercurrent" }
  /** While any tile on the board is frozen, rival hits on this team deal `amount` less. */
  | { readonly kind: "frostArmor"; readonly amount: number }
  /** When a harmful effect lands on this team and it has no bubble, it gets `count` bubbles. */
  | { readonly kind: "bubbleShell"; readonly count: number }
  /** No single rival hit deals more than `cap` damage to this team. */
  | { readonly kind: "bedrock"; readonly cap: number }
  /** This monster's move deals `amount` more damage for every stone on the board. */
  | { readonly kind: "rockslide"; readonly amount: number }
  /** Stones cleared by this team's blasts shatter into the rival for `amount` damage each. */
  | { readonly kind: "faultLine"; readonly amount: number }
  /** When a rival move hits this team, it gains `amount` shield. */
  | { readonly kind: "crystalHide"; readonly amount: number }
  /** When a rival move hits this team, the rival is poisoned. */
  | { readonly kind: "thorns"; readonly amount: number; readonly turns: number }
  /** This monster's move deals (or steals) `amount` more for every turn of burn or poison left on the rival. */
  | { readonly kind: "feedsOnPain"; readonly amount: number }
  /** Whenever the partner fires its move, this monster gains `count` charge. */
  | { readonly kind: "mycelium"; readonly count: number }
  /** This team's hits ignore shields. */
  | { readonly kind: "keenEye" }
  /** Fully charged at the start of the match and whenever it evolves. */
  | { readonly kind: "daybreak" }
  /** Each regen tick on this team gives this monster `count` charge. */
  | { readonly kind: "glow"; readonly count: number };

export type PassiveKind = Passive["kind"];
export type PassiveOf<K extends PassiveKind> = Extract<Passive, { kind: K }>;

export interface Monster {
  readonly id: string;
  readonly name: string;
  readonly element: Element;
  /** Tiles of this monster's element that must be matched to fire its move. */
  readonly chargeCost: number;
  readonly ability: Ability;
  readonly passive?: Passive;
}

export interface MonsterState {
  readonly def: Monster;
  /** Accumulated matched tiles of the monster's element, spent when it fires. */
  charge: number;
  /** Evolution level (0 = base); each level strengthens the move. */
  evolution: number;
  /** Owner turns left during which this monster can't gain charge. */
  /** Matches its own player must make before it can charge again (0 = free; each combo step counts). */
  sealed: number;
}

/** A damage-over-time effect (burn or poison) on a player. */
export interface Dot {
  amount: number;
  turns: number;
  kind: "burn" | "poison";
  element: Element;
}

export interface PlayerState {
  readonly peerId: string;
  readonly displayName: string;
  hp: number;
  readonly maxHp: number;
  shield: number;
  dots: Dot[];
  /** Heals at the start of this player's turns. */
  regen: { amount: number; turns: number }[];
  /** Harmful effects this player will shrug off (each block uses one). */
  bubble: number;
  /** Berries collected, spent 4 at a time to evolve a monster. */
  berries: number;
  /** Moves this player loses at the start of their next turn. */
  slow: number;
  monsters: MonsterState[];
}

export type Phase = "awaiting-move" | "finished";

/** Moves a player gets per turn. */
export const MOVES_PER_TURN = 2;

export interface GameState {
  readonly matchId: string;
  board: Board;
  /** Per-cell ice: turn-passes left before it melts (0 = not frozen). */
  ice: number[][];
  players: [PlayerState, PlayerState];
  turn: 0 | 1;
  /** Moves the current player has left this turn. */
  movesLeft: number;
  /** Turns that have ended so far (both players), for sudden death. */
  turnPasses: number;
  /** Freezes cast this turn; they land on the board when the turn passes. */
  pendingFreeze: { count: number; turns: number }[];
  /** Set when the match ended because this player gave up. */
  forfeitedBy: 0 | 1 | null;
  phase: Phase;
  winner: 0 | 1 | null;
  moveNumber: number;
}

export interface SwapMove {
  readonly type: "swap";
  readonly from: { x: number; y: number };
  readonly to: { x: number; y: number };
}
export type Move = SwapMove;

export interface CascadeStep {
  cleared: { x: number; y: number; element: Gem }[];
  countsByElement: Partial<Record<Element, number>>;
  /** Board state where this step's cleared tiles are present (for animation). */
  board: Tile[][];
  /** Board after the gaps collapse and refill, so clients can animate the fall. */
  after: Tile[][];
}

export type NumericEventType =
  | "attack" | "heal" | "shield" | "burn" | "poison" | "burn-tick" | "poison-tick" | "regen-tick" | "fatigue";

/** A number to float over a player (damage, heal, shield, burn/poison). */
export interface AbilityEvent {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly element: Element;
  readonly type: NumericEventType;
  readonly amount: number;
  /** Player index the effect landed on. */
  readonly targetPlayer: 0 | 1;
}

/** A monster using its move, for the "X used Eruption!" callouts. */
export interface CastEvent {
  readonly by: 0 | 1;
  readonly monsterId: string;
  readonly monsterName: string;
  readonly element: Element;
  readonly moveName: string;
  readonly kinds: EffectKind[];
  /**
   * Fired via a follow-up, the berserk form, or another passive (then `moveName` is the
   * passive's name, and it spent no charge).
   */
  readonly via?: "followUp" | "berserk" | "passive";
  /** What each effect did, in order. */
  readonly effects: EffectEvent[];
}

export interface MoveResult {
  readonly ok: true;
  readonly move: Move;
  readonly by: 0 | 1;
  readonly cascades: CascadeStep[];
  /** Board changes from moves (blasts) and their fallout, for animation. */
  readonly effectSteps: CascadeStep[];
  /** Total tiles matched per element by the swap (what fed the charges). */
  readonly charged: Partial<Record<Element, number>>;
  /** Numbers to float (damage/heal/shield/burn/poison). */
  readonly abilities: AbilityEvent[];
  /** Moves used this turn, in firing order. */
  readonly casts: CastEvent[];
  /** Berries the mover collected this move. */
  readonly berriesGained: number;
  readonly nextTurn: 0 | 1;
  /** Moves the next player has after this move resolves. */
  readonly movesLeft: number;
  /** This move cleared a line of 4+, granting an extra move. */
  readonly extraTurn: boolean;
  readonly finished: boolean;
  readonly winner: 0 | 1 | null;
  readonly board: Tile[][];
  /** Ice on the board after this move resolves. */
  readonly ice: number[][];
  /** Cells that froze as the turn passed (freezes cast during the turn landing). */
  readonly iceLanded: Cell[];
  /** The board was reshuffled because it had no valid moves. */
  readonly reshuffled: boolean;
}

export interface MoveRejection {
  readonly ok: false;
  readonly reason: string;
}
