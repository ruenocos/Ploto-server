/**
 * No-Limit Texas Hold'em Sit & Go — domain types.
 *
 * Model: 2–6 players start with equal play-chip stacks (no real money) and play
 * hands until one player holds every chip. Blinds rise on a schedule so every
 * game ends. The server is authoritative: it shuffles, deals, validates every
 * action and decides showdowns; clients only ever see `HoldemView`s and
 * redacted event lists.
 */

export const SUITS = ["s", "h", "d", "c"] as const;
export type Suit = (typeof SUITS)[number];
/** 2..10, then 11 = jack, 12 = queen, 13 = king, 14 = ace. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

/**
 * What a player asks to do. `raise.to` is the player's total bet for the
 * street after the raise (not the increment), which is how a slider reads and
 * avoids ambiguity when the player already has chips in front of them. A
 * `raise` with nothing to call is a bet.
 */
export type Action =
  | { readonly type: "fold" }
  | { readonly type: "check" }
  | { readonly type: "call" }
  | { readonly type: "raise"; readonly to: number }
  | { readonly type: "allIn" };

/** A float source in [0, 1). Production uses `cryptoRandom`, tests a seeded `Rng`. */
export type RandomSource = () => number;

export interface BlindLevel {
  readonly sb: number;
  readonly bb: number;
}

/** Levels past the end of the schedule keep doubling the last one. */
export const DEFAULT_BLINDS: readonly BlindLevel[] = [
  { sb: 10, bb: 20 },
  { sb: 15, bb: 30 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 75, bb: 150 },
  { sb: 100, bb: 200 },
  { sb: 150, bb: 300 },
  { sb: 200, bb: 400 },
  { sb: 300, bb: 600 },
  { sb: 500, bb: 1000 },
  { sb: 750, bb: 1500 },
  { sb: 1000, bb: 2000 },
];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export interface PlayerConfig {
  readonly id: string;
  readonly name: string;
  readonly bot?: boolean;
}

export interface HoldemConfig {
  /** Seat order is the array order (seat 0, 1, …); play moves to the next seat ("left"). */
  readonly players: readonly PlayerConfig[];
  readonly startingChips: number;
  readonly blinds?: readonly BlindLevel[];
  /** Hands per blind level; 0 = blinds never go up. Default 10. */
  readonly blindsEveryHands?: number;
  /** Shuffle source. Default `cryptoRandom`. */
  readonly random?: RandomSource;
  /** Seat index of the first button. Default: drawn with `random`. */
  readonly firstButton?: number;
  /**
   * Stacked deck, for tests and replays only: returns the 52 cards to deal
   * from, top first, for hand `handNo` (1-based). Overrides the shuffle.
   */
  readonly deckFor?: (handNo: number) => readonly Card[];
}

/**
 * `showdown` is transient: it is only set while a hand's pots are being
 * resolved inside `act`/`startHand`, which then return in `handOver` or
 * `gameOver`. It exists so code observing the state mid-resolution reads true.
 */
export type Phase = "preflop" | "flop" | "turn" | "river" | "showdown" | "handOver" | "gameOver";
export type Street = "flop" | "turn" | "river";

export interface SeatState {
  readonly id: string;
  readonly name: string;
  readonly bot: boolean;
  readonly seat: number;
  stack: number;
  /** Chips put in on the current street. */
  bet: number;
  /** Chips put in this hand, including `bet`. Returned uncalled chips are taken back out. */
  committed: number;
  /** Stack when the current hand started (breaks ties between players busting together). */
  startStack: number;
  /** Hole cards; empty when not dealt in. */
  hole: Card[];
  /** Dealt into the current hand. */
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  /** Has voluntarily acted on this street (posting a blind doesn't count). */
  acted: boolean;
  /**
   * The street's highest bet when this player last acted. Betting is reopened
   * to them only if it has since grown by at least a full raise; this is what
   * makes a short all-in raise (or several adding up to less than a full raise)
   * not reopen the action.
   */
  actedAt: number;
  /** Hole cards are face up (shown at showdown) until the next hand starts. */
  revealed: boolean;
  /** Finishing place once busted, or the winner's 1; null while still playing. */
  place: number | null;
}

/** A pot and the players who can win it. Index 0 is the main pot. */
export interface Pot {
  readonly amount: number;
  readonly eligible: readonly string[];
}

export interface HoldemState {
  phase: Phase;
  /** 1-based; 0 before the first hand. */
  handNo: number;
  /** 0-based index into the blind schedule (levels past the end double the last). */
  levelIndex: number;
  /** Seat indices; -1 before the first hand. */
  button: number;
  sbSeat: number;
  bbSeat: number;
  board: Card[];
  /** Highest bet on the current street (preflop at least the big blind, even if the BB posted short). */
  currentBet: number;
  /** Size of the last full bet/raise on this street (the big blind at the start of each street). */
  minRaise: number;
  /** Bets and raises made on this street (the blinds don't count). */
  streetRaises: number;
  /** Seat to act, or -1. */
  toAct: number;
  /** Seat of the last bettor/raiser on this street (shows first at showdown), or -1. */
  lastAggressor: number;
  readonly seats: SeatState[];
}

export interface LegalActions {
  readonly canFold: boolean;
  readonly canCheck: boolean;
  /** Chips needed to call (capped at the stack: calling for less is an all-in call). 0 = nothing to call. */
  readonly call: number;
  readonly canRaise: boolean;
  /** Smallest legal `raise.to` (an all-in for less is the only smaller raise allowed). 0 if no raise. */
  readonly minRaiseTo: number;
  /** All-in total for this street (`bet + stack`). 0 if no raise. */
  readonly maxRaiseTo: number;
}

/** How an action read at the table. An all-in is a call/bet/raise with `allIn: true`. */
export type ActionKind = "fold" | "check" | "call" | "bet" | "raise";
export type BlindKind = "sb" | "bb";

export interface Reveal {
  readonly id: string;
  readonly cards: readonly Card[];
  readonly handName: string;
}

export interface PotWinner {
  readonly id: string;
  readonly amount: number;
  /** Null when the pot was won without a showdown. */
  readonly handName: string | null;
}

export interface Standing {
  readonly id: string;
  readonly name: string;
  /** Final place, or null while still playing. */
  readonly place: number | null;
  readonly chips: number;
}

/**
 * What happened, in order, for the client to animate. `act`/`startHand`
 * return the events they caused; the full list for the current hand is
 * `game.handEvents`. Always pass them through `redactEvents` before sending:
 * `holeDealt` carries everyone's cards.
 */
export type HoldemEvent =
  | { readonly type: "blindsUp"; readonly level: number; readonly sb: number; readonly bb: number }
  | {
      readonly type: "handStart";
      readonly handNo: number;
      readonly button: string;
      readonly level: number;
      readonly sb: number;
      readonly bb: number;
      /** Everyone dealt in, in seat order, with their stack before the blinds. */
      readonly stacks: readonly { readonly id: string; readonly chips: number }[];
    }
  | {
      readonly type: "blindsPosted";
      readonly posts: readonly { readonly id: string; readonly kind: BlindKind; readonly amount: number; readonly allIn: boolean }[];
    }
  | {
      readonly type: "holeDealt";
      /** In deal order (left of the button first). `cards` is null for hands the viewer can't see. */
      readonly hands: readonly { readonly id: string; readonly cards: readonly Card[] | null }[];
    }
  | {
      readonly type: "action";
      readonly id: string;
      readonly action: ActionKind;
      /** Chips put in by this action. */
      readonly amount: number;
      /** The player's total bet on this street afterwards. */
      readonly toTotal: number;
      readonly allIn: boolean;
      /** Made by `timeoutAction`. */
      readonly timedOut: boolean;
    }
  | { readonly type: "betReturned"; readonly id: string; readonly amount: number }
  | { readonly type: "street"; readonly name: Street; readonly cards: readonly Card[]; readonly board: readonly Card[] }
  | { readonly type: "showdown"; readonly reveals: readonly Reveal[] }
  | { readonly type: "potAwarded"; readonly potIndex: number; readonly amount: number; readonly winners: readonly PotWinner[] }
  | { readonly type: "eliminated"; readonly id: string; readonly place: number }
  | { readonly type: "gameOver"; readonly standings: readonly Standing[] };

export type HoldemEventType = HoldemEvent["type"];

export type RejectReason =
  | "game over"
  | "hand in progress"
  | "no hand in progress"
  | "unknown player"
  | "not your turn"
  | "cannot check facing a bet"
  | "raise not allowed"
  | "invalid amount"
  | "raise below minimum"
  | "raise above stack"
  | "unknown action";

export interface ActResult {
  readonly ok: true;
  readonly events: HoldemEvent[];
}

export interface ActRejection {
  readonly ok: false;
  readonly reason: RejectReason;
}

export interface SeatView {
  readonly id: string;
  readonly name: string;
  readonly seat: number;
  readonly bot: boolean;
  readonly stack: number;
  readonly bet: number;
  readonly inHand: boolean;
  readonly folded: boolean;
  readonly allIn: boolean;
  readonly busted: boolean;
  readonly place: number | null;
  /** The viewer's own cards, or anyone's shown at showdown; null otherwise (including face-down cards). */
  readonly cards: readonly Card[] | null;
  /** Dealt cards the viewer can't see (draw card backs). */
  readonly hasCards: boolean;
}

/** One player's (or a spectator's, `you: null`) picture of the table. */
export interface HoldemView {
  readonly you: string | null;
  readonly phase: Phase;
  readonly handNo: number;
  readonly level: number;
  readonly sb: number;
  readonly bb: number;
  /** The hand number at which the blinds next go up (null if they never do). */
  readonly nextLevelAtHand: number | null;
  readonly button: string | null;
  readonly toActId: string | null;
  readonly board: readonly Card[];
  /** Pots from chips collected on earlier streets (this street's bets are on `seats[].bet`). */
  readonly pots: readonly Pot[];
  /** Every chip in the middle, including this street's bets. */
  readonly totalPot: number;
  readonly currentBet: number;
  readonly seats: readonly SeatView[];
  /** The viewer's options when it's their turn, else null. */
  readonly legal: LegalActions | null;
}
