/**
 * Match Monsters — domain types.
 *
 * Clean-room model built from the publicly described rules: a match-3 board of
 * elemental tiles, each player fields two monsters, and matching 3+ tiles of a
 * monster's element powers an attack with that monster. Server-authoritative.
 */

/** Elemental types a tile/monster can belong to. Kept small for strategic play. */
export const ELEMENTS = ["fire", "water", "earth", "nature", "light"] as const;
export type Element = (typeof ELEMENTS)[number];

/** A board cell. `null` is a transient empty cell during resolution. */
export type Tile = Element | null;

/** A rectangular board, row-major: `grid[y][x]`. */
export interface Board {
  readonly width: number;
  readonly height: number;
  grid: Tile[][];
}

export interface Monster {
  readonly id: string;
  readonly name: string;
  readonly element: Element;
  /** Max/starting hit points. */
  readonly maxHp: number;
  /**
   * Damage dealt per matched tile of this monster's element, before bonuses.
   * A 3-match therefore deals `3 * power`; longer matches scale linearly plus a
   * combo bonus applied by the engine.
   */
  readonly power: number;
}

export interface MonsterState {
  readonly def: Monster;
  hp: number;
}

export interface PlayerState {
  readonly peerId: string;
  readonly displayName: string;
  monsters: MonsterState[];
}

export type Phase = "awaiting-move" | "finished";

export interface GameState {
  readonly matchId: string;
  board: Board;
  players: [PlayerState, PlayerState];
  /** Index (0 or 1) of the player whose turn it is. */
  turn: 0 | 1;
  phase: Phase;
  /** Index of the winning player once `phase === "finished"`, else null. */
  winner: 0 | 1 | null;
  /** Monotonic counter; increments once per resolved move. */
  moveNumber: number;
}

/** A player's move: swap two orthogonally-adjacent tiles. */
export interface SwapMove {
  readonly type: "swap";
  readonly from: { x: number; y: number };
  readonly to: { x: number; y: number };
}

export type Move = SwapMove;

/** One cascade step produced while resolving a move (for client animation/replay). */
export interface CascadeStep {
  /** Coordinates cleared in this step. */
  cleared: { x: number; y: number; element: Element }[];
  /** Per-element tile counts cleared in this step. */
  countsByElement: Partial<Record<Element, number>>;
}

/** Damage applied to one monster as a result of a move. */
export interface DamageEvent {
  readonly targetPlayer: 0 | 1;
  readonly monsterId: string;
  readonly amount: number;
  readonly element: Element;
}

/** Full, serialisable result of applying one move — the unit the server emits. */
export interface MoveResult {
  readonly ok: true;
  readonly move: Move;
  readonly by: 0 | 1;
  readonly cascades: CascadeStep[];
  readonly damage: DamageEvent[];
  readonly defeated: { player: 0 | 1; monsterId: string }[];
  readonly nextTurn: 0 | 1;
  readonly finished: boolean;
  readonly winner: 0 | 1 | null;
  /** Board after full resolution. */
  readonly board: Tile[][];
}

export interface MoveRejection {
  readonly ok: false;
  readonly reason: string;
}
