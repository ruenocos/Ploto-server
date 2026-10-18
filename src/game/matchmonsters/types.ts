/**
 * Match Monsters — domain types.
 *
 * Model (like the real game): a match-3 board of elemental tiles. Each player has
 * a single HP pool and fields two monsters. Matching 3+ tiles of a monster's
 * element charges that monster; when its charge reaches the monster's cost, its
 * ability fires (damage / heal / shield / burn) and the charge is spent. Reduce
 * the opponent's HP to zero to win. Server-authoritative.
 */

export const ELEMENTS = ["fire", "water", "earth", "nature", "light"] as const;
export type Element = (typeof ELEMENTS)[number];

/** A board piece: an element, or a berry pickup. */
export type Gem = Element | "berry";

/** A board cell. `null` is a transient empty cell during resolution. */
export type Tile = Gem | null;

/** Berries needed to evolve a monster, and the evolution cap. */
export const BERRIES_TO_EVOLVE = 4;
export const MAX_EVOLUTION = 3;

export interface Board {
  readonly width: number;
  readonly height: number;
  grid: Tile[][];
}

/** Starting / maximum HP for every player. */
export const STARTING_HP = 100;

export type AbilityType = "attack" | "heal" | "shield" | "burn" | "poison";

export interface Ability {
  readonly type: AbilityType;
  /** Damage (attack / burn / poison per turn), HP restored (heal), or shield gained. */
  readonly amount: number;
  /** For `burn`/`poison`: how many of the victim's turns it ticks. */
  readonly turns?: number;
  readonly description: string;
}

export interface Monster {
  readonly id: string;
  readonly name: string;
  readonly element: Element;
  /** Tiles of this monster's element that must be matched to fire its ability. */
  readonly chargeCost: number;
  readonly ability: Ability;
}

export interface MonsterState {
  readonly def: Monster;
  /** Accumulated matched tiles of the monster's element, spent when it fires. */
  charge: number;
  /** Evolution level (0 = base); each level strengthens the ability. */
  evolution: number;
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
  /** Berries collected, spent 4 at a time to evolve a monster. */
  berries: number;
  monsters: MonsterState[];
}

export type Phase = "awaiting-move" | "finished";

/** Moves a player gets per turn. */
export const MOVES_PER_TURN = 2;

export interface GameState {
  readonly matchId: string;
  board: Board;
  players: [PlayerState, PlayerState];
  turn: 0 | 1;
  /** Moves the current player has left this turn. */
  movesLeft: number;
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
}

/** Something an ability did, for UI floats and logging. */
export interface AbilityEvent {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly element: Element;
  readonly type: AbilityType | "burn-tick" | "poison-tick";
  readonly amount: number;
  /** Player index the effect landed on (foe for attack/burn, self for heal/shield). */
  readonly targetPlayer: 0 | 1;
}

export interface MoveResult {
  readonly ok: true;
  readonly move: Move;
  readonly by: 0 | 1;
  readonly cascades: CascadeStep[];
  /** Total tiles matched per element this move (what fed the charges). */
  readonly charged: Partial<Record<Element, number>>;
  readonly abilities: AbilityEvent[];
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
}

export interface MoveRejection {
  readonly ok: false;
  readonly reason: string;
}
