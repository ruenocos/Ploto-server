/**
 * Cards, decks and shuffling.
 *
 * Shuffles take an injected random source so the engine stays pure: tests pass
 * a seeded `Rng` (a game is then reproducible from its seed and action list)
 * and production passes `cryptoRandom`, because a predictable PRNG seed would
 * let anyone who learns it read every hole card.
 */
import { getRandomValues } from "node:crypto";
import type { Card, RandomSource, Rank, Suit } from "./types.js";
import { SUITS } from "./types.js";

const RANK_CHARS = "23456789TJQKA";

/** A fresh deck, ordered by rank then suit. */
export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (let r = 2; r <= 14; r++) for (const suit of SUITS) deck.push({ rank: r as Rank, suit });
  return deck;
}

/** Fisher–Yates, in place. Returns the same array. */
export function shuffle<T>(items: T[], random: RandomSource): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = items[i]!;
    items[i] = items[j]!;
    items[j] = t;
  }
  return items;
}

const pool = new Uint32Array(256);
let poolPos = pool.length;

/**
 * A uniform float in [0, 1) from the OS CSPRNG with 53 bits of resolution
 * (two 32-bit words, like `Math.random`'s full mantissa). Used for real games'
 * shuffles: at 53 bits the `floor(random() * n)` bias for n ≤ 52 is below
 * 2^-47, far beneath noise. Words are fetched 256 at a time to keep a shuffle
 * to one syscall-sized read.
 */
export function cryptoRandom(): number {
  if (poolPos + 2 > pool.length) {
    getRandomValues(pool);
    poolPos = 0;
  }
  const hi = pool[poolPos++]! >>> 5; // 27 bits
  const lo = pool[poolPos++]! >>> 6; // 26 bits
  return (hi * 67108864 + lo) / 9007199254740992;
}

/** Compact integer code 0..51: (rank - 2) * 4 + suit index. Used by the evaluator's hot path. */
export function cardCode(card: Card): number {
  return (card.rank - 2) * 4 + SUITS.indexOf(card.suit);
}

export function codeToCard(code: number): Card {
  return { rank: ((code >> 2) + 2) as Rank, suit: SUITS[code & 3]! };
}

/** "As", "Td", "2c". */
export function cardToString(card: Card): string {
  return RANK_CHARS[card.rank - 2]! + card.suit;
}

/** Parses "As" / "Td" / "10d" (case-insensitive rank). */
export function parseCard(text: string): Card {
  const t = text.trim();
  const suit = t.slice(-1).toLowerCase() as Suit;
  const r = t.slice(0, -1).toUpperCase();
  const idx = RANK_CHARS.indexOf(r === "10" ? "T" : r);
  if (idx < 0 || r.length === 0 || !(SUITS as readonly string[]).includes(suit)) throw new Error(`bad card "${text}"`);
  return { rank: (idx + 2) as Rank, suit };
}

/** Parses a space- or comma-separated list: "As Kd 7h". */
export function parseCards(text: string): Card[] {
  return text
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map(parseCard);
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}
