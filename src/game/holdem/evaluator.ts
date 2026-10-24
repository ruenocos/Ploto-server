/**
 * Poker hand evaluator: the best five-card hand out of 5, 6 or 7 cards.
 *
 * It works directly on rank counts and per-suit rank bitmasks instead of
 * trying all 21 five-card subsets of seven cards, which keeps it fast enough
 * for the bot's Monte Carlo (thousands of evaluations per decision) and for a
 * test that walks all 2,598,960 five-card hands.
 *
 * A hand's `score` is one comparable integer: category in bits 20+, then up
 * to five tie-break ranks, four bits each, most significant first. Higher
 * score = better hand; equal scores split the pot.
 */
import type { Card } from "./types.js";
import { SUITS } from "./types.js";
import { cardCode } from "./cards.js";

export const HAND_CATEGORIES = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const;
/** 0 = high card … 8 = straight flush (a royal flush is the ace-high straight flush). */
export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface HandResult {
  readonly category: HandCategory;
  /** Tie-break ranks, most significant first (a wheel straight's high card is 5). */
  readonly ranks: readonly number[];
  readonly score: number;
  /** The five cards that make the hand, in tie-break order. */
  readonly cards: readonly Card[];
  readonly name: string;
}

/** How many tie-break ranks each category uses. */
const RANKS_USED = [5, 4, 3, 3, 1, 5, 2, 2, 1] as const;

/**
 * Highest straight in a rank bitmask (bit r set = rank r present, r in 2..14),
 * or 0. The ace also plays low: A-2-3-4-5 is a straight with a high card of 5.
 */
const STRAIGHT_HIGH = new Uint8Array(1 << 15);
for (let mask = 0; mask < 1 << 15; mask++) {
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) {
      const bit = r === 1 ? 14 : r;
      if (!(mask & (1 << bit))) {
        ok = false;
        break;
      }
    }
    if (ok) {
      STRAIGHT_HIGH[mask] = high;
      break;
    }
  }
}

function popcount(x: number): number {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

/** The top `n` ranks of `mask` packed into nibbles from bit `shift` down. */
function packTop(mask: number, n: number, shift: number): number {
  let out = 0;
  for (let r = 14; r >= 2 && n > 0; r--) {
    if (mask & (1 << r)) {
      out |= r << shift;
      shift -= 4;
      n--;
    }
  }
  return out;
}

const counts = new Uint8Array(15);

/**
 * Score of the best five-card hand among `codes[0..n)` (card codes from
 * `cardCode`, 5 ≤ n ≤ 7, no duplicates). Allocation-free: this is the hot path.
 */
export function scoreCodes(codes: ArrayLike<number>, n: number = codes.length): number {
  counts.fill(0);
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, rankMask = 0;
  for (let i = 0; i < n; i++) {
    const c = codes[i]!;
    const r = (c >> 2) + 2;
    const bit = 1 << r;
    counts[r]!++;
    rankMask |= bit;
    switch (c & 3) {
      case 0: s0 |= bit; break;
      case 1: s1 |= bit; break;
      case 2: s2 |= bit; break;
      default: s3 |= bit;
    }
  }
  // With at most 7 cards a flush excludes quads and full houses (they'd need
  // more than two off-suit cards), so it can be settled first.
  const flushMask = popcount(s0) >= 5 ? s0 : popcount(s1) >= 5 ? s1 : popcount(s2) >= 5 ? s2 : popcount(s3) >= 5 ? s3 : 0;
  if (flushMask) {
    const sf = STRAIGHT_HIGH[flushMask]!;
    if (sf) return (8 << 20) | (sf << 16);
    return (5 << 20) | packTop(flushMask, 5, 16);
  }
  let quad = 0, t1 = 0, t2 = 0, p1 = 0, p2 = 0;
  for (let r = 14; r >= 2; r--) {
    const k = counts[r]!;
    if (k === 4) quad = r;
    else if (k === 3) {
      if (!t1) t1 = r;
      else if (!t2) t2 = r;
    } else if (k === 2) {
      if (!p1) p1 = r;
      else if (!p2) p2 = r;
    }
  }
  if (quad) return (7 << 20) | (quad << 16) | packTop(rankMask & ~(1 << quad), 1, 12);
  if (t1 && (t2 || p1)) return (6 << 20) | (t1 << 16) | (Math.max(t2, p1) << 12);
  const st = STRAIGHT_HIGH[rankMask]!;
  if (st) return (4 << 20) | (st << 16);
  if (t1) return (3 << 20) | (t1 << 16) | packTop(rankMask & ~(1 << t1), 2, 12);
  if (p2) return (2 << 20) | (p1 << 16) | (p2 << 12) | packTop(rankMask & ~(1 << p1) & ~(1 << p2), 1, 8);
  if (p1) return (1 << 20) | (p1 << 16) | packTop(rankMask & ~(1 << p1), 3, 12);
  return packTop(rankMask, 5, 16);
}

/** Score of the best hand in 5–7 cards. */
export function scoreHand(cards: readonly Card[]): number {
  return scoreCodes(cards.map(cardCode));
}

export function categoryOf(score: number): HandCategory {
  return (score >> 20) as HandCategory;
}

/** The tie-break ranks packed in a score. */
export function ranksOf(score: number): number[] {
  const out: number[] = [];
  const used = RANKS_USED[categoryOf(score)];
  for (let i = 0; i < used; i++) out.push((score >> (16 - 4 * i)) & 15);
  return out;
}

const RANK_NAMES = ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const RANK_PLURALS = ["", "", "twos", "threes", "fours", "fives", "sixes", "sevens", "eights", "nines", "tens", "jacks", "queens", "kings", "aces"];

/** Display name, e.g. "Flush, queen high", "Two pair, kings and sevens", "Straight, five high", "Royal flush". */
export function handName(score: number): string {
  const r = ranksOf(score);
  const one = (i: number) => RANK_NAMES[r[i]!]!;
  const many = (i: number) => RANK_PLURALS[r[i]!]!;
  switch (categoryOf(score)) {
    case 8:
      return r[0] === 14 ? "Royal flush" : `Straight flush, ${one(0)} high`;
    case 7:
      return `Four of a kind, ${many(0)}`;
    case 6:
      return `Full house, ${many(0)} full of ${many(1)}`;
    case 5:
      return `Flush, ${one(0)} high`;
    case 4:
      return `Straight, ${one(0)} high`;
    case 3:
      return `Three of a kind, ${many(0)}`;
    case 2:
      return `Two pair, ${many(0)} and ${many(1)}`;
    case 1:
      return `Pair of ${many(0)}`;
    default:
      return `High card, ${one(0)}`;
  }
}

/** Full evaluation with the five cards used and a name. Not for hot loops (allocates). */
export function evaluate(cards: readonly Card[]): HandResult {
  if (cards.length < 5 || cards.length > 7) throw new RangeError("evaluate needs 5 to 7 cards");
  const score = scoreHand(cards);
  const category = categoryOf(score);
  const ranks = ranksOf(score);
  // Which (rank, count) groups make up the five, in display order.
  let need: [number, number][];
  let suit: string | null = null;
  if (category === 5 || category === 8) {
    suit = SUITS.find((s) => cards.filter((c) => c.suit === s).length >= 5)!;
  }
  if (category === 4 || category === 8) {
    const high = ranks[0]!;
    need = [0, 1, 2, 3, 4].map((i) => [high - i === 1 ? 14 : high - i, 1]);
  } else {
    const groups: Record<number, number[]> = { 7: [4, 1], 6: [3, 2], 3: [3, 1, 1], 2: [2, 2, 1], 1: [2, 1, 1, 1] };
    const sizes = groups[category] ?? [1, 1, 1, 1, 1];
    need = sizes.map((size, i) => [ranks[i]!, size]);
  }
  const used = new Set<Card>();
  const five: Card[] = [];
  for (const [rank, size] of need) {
    let left = size;
    for (const c of cards) {
      if (left === 0) break;
      if (c.rank === rank && (suit === null || c.suit === suit) && !used.has(c)) {
        used.add(c);
        five.push(c);
        left--;
      }
    }
  }
  return { category, ranks, score, cards: five, name: handName(score) };
}

/** > 0 if `a` beats `b`, < 0 if it loses, 0 for a split. */
export function compareHands(a: readonly Card[], b: readonly Card[]): number {
  return scoreHand(a) - scoreHand(b);
}

