/**
 * Hold'em bot for practice tables and the simulator.
 *
 * It only uses what a player at the table could know: its own `viewFor`, the
 * public betting state and `legal`. Preflop it buckets its hand with the Chen
 * formula, adjusted for position, players left to act and stack depth (push
 * or fold below 10 big blinds). The thresholds are short-handed ranges (Ploto
 * tables seat 2–6): about 28% of hands first to act at 4 seats, 45% on the
 * button, with some limps, and a big blind that defends about half the time.
 * test/holdemBotStyle.test.ts keeps those numbers from drifting. After the flop it estimates its equity by
 * Monte Carlo against the current number of opponents holding random hands
 * and compares it with the pot odds, with some bluffs, semi-bluffs and
 * half-to-full-pot sizing. Every random choice comes from the injected
 * source, so bot games are reproducible.
 *
 * `easy` (a table's "Relaxed" bots) adds mistakes: a noisy read of its own
 * equity, calling too much, folding sometimes when it shouldn't, and random
 * bet sizes. `normal` is "Sharp".
 */
import type { HoldemGame } from "./engine.js";
import type { Action, Card, HoldemView, LegalActions, RandomSource, SeatView } from "./types.js";
import { cardCode } from "./cards.js";
import { scoreCodes } from "./evaluator.js";

export type BotLevel = "easy" | "normal";

export interface BotOptions {
  readonly level?: BotLevel;
  /** Monte Carlo samples per postflop decision. Default 150 (60 for easy). */
  readonly samples?: number;
}

/**
 * Chen formula: a quick preflop hand score, from about -1 (72o) to 20 (AA).
 * Pairs and high, suited, connected cards score well.
 */
export function chenScore(a: Card, b: Card): number {
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  const value = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let score = value(hi);
  if (hi === lo) return Math.max(5, score * 2);
  if (a.suit === b.suit) score += 2;
  const gap = hi - lo - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 12) score += 1;
  return Math.ceil(score);
}

/**
 * Share of the pot `hole` wins on average against `opponents` random hands,
 * with the rest of the board dealt at random (ties split). Allocation-light:
 * card codes and a reusable partial Fisher–Yates over the unseen cards.
 */
export function monteCarloEquity(hole: readonly Card[], board: readonly Card[], opponents: number, samples: number, random: RandomSource): number {
  if (opponents <= 0) return 1;
  const known = new Set<number>([...hole, ...board].map(cardCode));
  const unseen: number[] = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) unseen.push(c);
  const boardNeed = 5 - board.length;
  const need = boardNeed + 2 * opponents;
  const mine = new Int32Array(7);
  const theirs = new Int32Array(7);
  mine[0] = cardCode(hole[0]!);
  mine[1] = cardCode(hole[1]!);
  for (let i = 0; i < board.length; i++) mine[2 + i] = theirs[2 + i] = cardCode(board[i]!);
  let won = 0;
  for (let s = 0; s < samples; s++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(random() * (unseen.length - i));
      const t = unseen[i]!;
      unseen[i] = unseen[j]!;
      unseen[j] = t;
    }
    for (let i = 0; i < boardNeed; i++) mine[2 + board.length + i] = theirs[2 + board.length + i] = unseen[i]!;
    const my = scoreCodes(mine, 7);
    let ties = 0;
    let lost = false;
    for (let o = 0; o < opponents; o++) {
      theirs[0] = unseen[boardNeed + 2 * o]!;
      theirs[1] = unseen[boardNeed + 2 * o + 1]!;
      const their = scoreCodes(theirs, 7);
      if (their > my) {
        lost = true;
        break;
      }
      if (their === my) ties++;
    }
    if (!lost) won += 1 / (1 + ties);
  }
  return won / samples;
}

/** What the bot wants, before being fitted to the legal options. */
type Intent = { kind: "passive" } | { kind: "call" } | { kind: "raise"; to: number } | { kind: "allIn" };

/** Turns an intent into an action that is always legal right now. */
function fit(intent: Intent, legal: LegalActions, stack: number): Action {
  const checkOrFold: Action = legal.canCheck ? { type: "check" } : { type: "fold" };
  const call: Action = legal.call > 0 ? { type: "call" } : { type: "check" };
  switch (intent.kind) {
    case "passive":
      return checkOrFold;
    case "call":
      return call;
    case "allIn":
      if (stack <= legal.call || !legal.canRaise) return call;
      return { type: "raise", to: legal.maxRaiseTo };
    case "raise": {
      if (!legal.canRaise) return call;
      const to = Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(intent.to)));
      return { type: "raise", to };
    }
  }
}

interface Table {
  readonly view: HoldemView;
  readonly me: SeatView;
  readonly hole: readonly Card[];
  readonly legal: LegalActions;
  readonly bb: number;
  readonly opponents: number;
  /** Opponents who can still put chips in after this action. */
  readonly activeOpponents: number;
  /** Chips I can still bet: my stack. */
  readonly stack: number;
  /** Effective stack in big blinds (mine vs the biggest opponent's, counting bets). */
  readonly effBB: number;
  readonly streetRaises: number;
  readonly bigBlind: boolean;
}

/**
 * The bot's action for `id`. Always legal when it's `id`'s turn; returns a
 * fold (which the engine rejects) when it isn't.
 */
export function chooseAction(game: HoldemGame, id: string, random: RandomSource, opts: BotOptions = {}): Action {
  const legal = game.legal(id);
  if (!legal.canFold) return { type: "fold" };
  const view = game.viewFor(id);
  const me = view.seats.find((s) => s.id === id)!;
  const hole = me.cards ?? [];
  const others = view.seats.filter((s) => s.id !== id && s.inHand && !s.folded);
  const biggest = Math.max(...others.map((s) => s.stack + s.bet));
  const t: Table = {
    view,
    me,
    hole,
    legal,
    bb: view.bb,
    opponents: others.length,
    activeOpponents: others.filter((s) => !s.allIn).length,
    stack: me.stack,
    effBB: Math.min(me.stack + me.bet, biggest) / view.bb,
    streetRaises: game.state.streetRaises,
    bigBlind: game.state.bbSeat === me.seat,
  };
  const level = opts.level ?? "normal";
  const intent = view.phase === "preflop" ? preflop(t, random, level) : postflop(t, random, level, opts.samples ?? (level === "easy" ? 60 : 150));
  return fit(intent, legal, t.stack);
}

/** Players who act after me before the betting gets back around (preflop order: UTG … button, SB, BB). */
function behindPreflop(t: Table): number {
  const seats = t.view.seats.filter((s) => s.inHand);
  const n = seats.length;
  const button = seats.findIndex((s) => s.id === t.view.button);
  // Preflop order starts left of the big blind; heads-up the button (SB) is first.
  const first = n === 2 ? button : (button + 3) % n;
  const mine = seats.findIndex((s) => s.id === t.me.id);
  const myTurn = (mine - first + n) % n;
  return n - 1 - myTurn;
}

function preflop(t: Table, random: RandomSource, level: BotLevel): Intent {
  const { legal, bb, view } = t;
  const easy = level === "easy";
  const chen = chenScore(t.hole[0]!, t.hole[1]!) + (random() - 0.5) * (easy ? 4 : 1.5);
  const behind = behindPreflop(t);
  const headsUp = view.seats.filter((s) => s.inHand).length === 2;
  const pot = view.totalPot;
  const odds = legal.call / (pot + legal.call);
  const facingRaise = t.streetRaises > 0;

  if (easy && random() < 0.08) return random() < 0.5 ? { kind: "call" } : { kind: "raise", to: view.currentBet + bb * (1 + Math.floor(random() * 4)) };

  // Short stack, or the price is a big part of the stack: push or fold.
  if (t.effBB < 10 || legal.call > t.stack * 0.35) {
    if (!facingRaise) {
      const pushAt = (headsUp ? 3.5 : 4.5 + behind * 0.5) - (10 - Math.min(10, t.effBB)) * 0.3;
      if (chen >= pushAt) return { kind: "allIn" };
      return { kind: "passive" };
    }
    const callAt = (easy ? 7 : headsUp ? 7 : 8.5) - (odds < 0.35 ? 2 : 0) - (t.effBB < 4 ? 2 : 0) + (t.streetRaises > 1 ? 1 : 0);
    if (chen >= callAt) return chen >= callAt + 2 ? { kind: "allIn" } : { kind: "call" };
    return { kind: "passive" };
  }

  if (!facingRaise) {
    const inBB = legal.canCheck;
    const limpers = Math.max(0, view.seats.filter((s) => s.inHand && !s.folded && s.bet >= bb).length - 1);
    // By players left to act behind me (the blinds count): short-handed ranges, not full-ring ones.
    const openAt = inBB ? 8 : headsUp ? 4 : [4, 4.5, 5, 6, 7, 7.5][Math.min(5, behind)]!;
    if (chen >= openAt + (easy ? 1 : 0)) {
      const size = (2.5 + limpers + (random() < 0.3 ? 0.5 : 0)) * bb;
      return { kind: "raise", to: size };
    }
    // Just below a raise: limp (or complete the small blind) some of the time, so pots go multiway.
    if (easy ? chen >= openAt - 3 : chen >= openAt - 1.5 && random() < 0.5) return { kind: "call" };
    return { kind: "passive" };
  }

  if (t.streetRaises === 1) {
    if (chen >= (easy ? 13 : headsUp ? 10 : 12)) return { kind: "raise", to: view.currentBet * (behind > 0 ? 3 : 3.5) };
    // Heads-up ranges are wide, so defend wide; the big blind already has chips in.
    const callAt = (easy ? 6 : headsUp ? 5.5 : 7.5) - (legal.call <= 3 * bb ? 1.5 : 0) - (t.bigBlind && !easy ? 1.5 : 0);
    if (chen >= callAt) return { kind: "call" };
    return { kind: "passive" };
  }
  // Facing a 3-bet or more.
  if (chen >= 13) return { kind: "allIn" };
  if (chen >= (easy ? 8 : 11)) return { kind: "call" };
  return { kind: "passive" };
}

function postflop(t: Table, random: RandomSource, level: BotLevel, samples: number): Intent {
  const { legal, view } = t;
  const easy = level === "easy";
  let equity = monteCarloEquity(t.hole, view.board, t.opponents, samples, random);
  if (easy) equity = Math.min(1, Math.max(0, equity + (random() - 0.5) * 0.4));
  // Equity is against random hands, but a bet or raise means a stronger range.
  else if (legal.call > 0) equity -= 0.07 + 0.04 * t.streetRaises;
  const k = t.opponents;
  const pot = view.totalPot;
  const toCall = legal.call;
  const odds = toCall / (pot + toCall);
  const river = view.phase === "river";
  // Easy misses thin value bets.
  const valueAt = (k === 1 ? 0.62 : k === 2 ? 0.5 : 0.42) + (easy ? 0.1 : 0);
  const strongAt = valueAt + 0.17;
  const sizing = (lo: number, hi: number) => (easy ? 0.3 + random() * 0.9 : lo + random() * (hi - lo));
  /** A bet/raise of `frac` of the pot (after calling); shove instead if it's most of the stack. */
  const bet = (frac: number): Intent => {
    const to = view.currentBet + (pot + toCall) * frac;
    if (to - t.me.bet >= t.stack * 0.45) return { kind: "allIn" };
    return { kind: "raise", to };
  };
  const nobodyToBet = t.activeOpponents === 0;

  if (toCall === 0) {
    if (nobodyToBet) return { kind: "passive" };
    if (equity >= strongAt) return bet(sizing(0.75, 1));
    if (equity >= valueAt) return bet(sizing(0.5, 0.7));
    if (!river && equity >= 0.3 && random() < (easy ? 0.1 : 0.3)) return bet(sizing(0.5, 0.66)); // semi-bluff
    if (k <= 2 && random() < (easy ? 0.04 : 0.12)) return bet(sizing(0.5, 0.6)); // bluff
    return { kind: "passive" };
  }

  if (equity >= strongAt && legal.canRaise && random() < (easy ? 0.4 : 0.75)) return bet(sizing(0.6, 1));
  if (!easy && !river && k === 1 && equity >= 0.3 && equity < 0.45 && legal.canRaise && random() < 0.08) return bet(0.6);
  const margin = easy ? -0.1 : 0.02 + 0.02 * (k - 1);
  if (equity >= odds + margin) {
    if (easy && random() < 0.05) return { kind: "passive" };
    return { kind: "call" };
  }
  if (easy && random() < 0.12) return { kind: "call" };
  return { kind: "passive" };
}
