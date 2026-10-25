/**
 * Wild Eights' bots. They only use what a player could know: their own hand, the
 * pile, the suit to follow, how many cards each player holds, and the cards that
 * have been played.
 *
 *   hard    holds its 8s back until they matter (nothing else fits, it's down to
 *           its last cards, or someone is about to go out); plays 2s and Jacks
 *           when the next player is close to going out; otherwise plays the card
 *           that leaves its hand the most ways to follow, changing to its long
 *           suit; names the suit it holds most of, and one the next player has
 *           shown they're out of when it can.
 *   medium  plays a card that fits, usually following the suit; plays 8s too
 *           early now and then, sometimes names its second-best suit, and keeps
 *           a drawn card a fifth of the time: it can be beaten.
 */
import { SUITS, points, rankOf, suitOf, type Card, type EightsView, type RandomSource, type Suit } from "./engine.js";

export type BotLevel = "medium" | "hard";
export type BotMove = { action: "play"; card: Card; suit?: Suit } | { action: "draw" } | { action: "pass" };

const fits = (v: EightsView, c: Card): boolean => {
  if (v.owed > 0) return rankOf(c) === "2";
  if (v.drawn && c !== v.drawn) return false;
  return rankOf(c) === "8" || suitOf(c) === v.suit || rankOf(c) === rankOf(v.top);
};
const suitCounts = (hand: readonly Card[]): Record<Suit, number> => {
  const n: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const c of hand) if (rankOf(c) !== "8") n[suitOf(c)]++;
  return n;
};
const secondSuit = (hand: readonly Card[], fallback: Suit): Suit => { const n = suitCounts(hand); const order = [...SUITS].sort((a, b) => n[b] - n[a]); return n[order[1]!] > 0 ? order[1]! : order[0] ?? fallback; };
const longSuit = (hand: readonly Card[], fallback: Suit): Suit => { const n = suitCounts(hand); return SUITS.reduce((a, b) => (n[b] > n[a] ? b : a), fallback); };

export function chooseMove(v: EightsView, level: BotLevel, random: RandomSource): BotMove {
  const hand = v.hand, playable = hand.filter((c) => fits(v, c));
  const next = (v.you + 1) % v.counts.length;
  const nextLow = v.counts[next]! <= 2;
  const anyoneLow = v.counts.some((n, s) => s !== v.you && n <= 2);
  if (!playable.length) return v.drawn ? { action: "pass" } : { action: "draw" };
  if (level === "medium") {
    if (v.drawn && random() < 0.2) return { action: "pass" }; // keeps the card it drew
    const plain = playable.filter((c) => rankOf(c) !== "8");
    const pool = plain.length && random() > 0.3 ? plain : playable; // an early 8 now and then
    const same = pool.filter((c) => suitOf(c) === v.suit); // people tend to follow the suit before changing it
    const card = random() < 0.2 && same.length ? same[0]! : pool[Math.floor(random() * pool.length)]!;
    const rest = hand.filter((c) => c !== card);
    const suit = rankOf(card) === "8" ? (random() < 0.4 ? secondSuit(rest, v.suit) : longSuit(rest, v.suit)) : undefined; // now and then its second-longest suit, never one it lacks
    return { action: "play", card, ...(suit ? { suit } : {}) };
  }
  // Hard.
  const eights = playable.filter((c) => rankOf(c) === "8");
  const plain = playable.filter((c) => rankOf(c) !== "8");
  if (v.drawn) {
    // A drawn 8 goes to hand for later unless it's needed now; anything else gets played.
    if (rankOf(v.drawn) === "8" && hand.length > 3 && !anyoneLow) return { action: "pass" };
    const rest = hand.filter((c) => c !== v.drawn);
    return { action: "play", card: v.drawn, ...(rankOf(v.drawn) === "8" ? { suit: pickSuit(v, rest) } : {}) };
  }
  if (v.owed > 0) return { action: "play", card: playable[0]! }; // answer the 2 with a 2
  // Two players: a jack is a free turn when another card of ours follows it.
  if (v.counts.length === 2) {
    const jack = plain.find((c) => rankOf(c) === "J" && hand.some((x) => x !== c && (suitOf(x) === suitOf(c) || rankOf(x) === "J" || rankOf(x) === "8")));
    if (jack && hand.length > 2) return { action: "play", card: jack };
  }
  // The next player is about to go out and has shown they lack a suit: an eight naming it.
  if (v.counts[next]! <= 2 && eights.length) {
    const lack = SUITS.find((x) => v.voids[next]?.includes(x));
    if (lack && !plain.some((c) => rankOf(c) === "2" || rankOf(c) === "J")) return { action: "play", card: eights[0]!, suit: lack };
  }
  // Punish a player about to go out: 2s, then Jacks.
  if (nextLow) {
    const hit = plain.find((c) => rankOf(c) === "2") ?? plain.find((c) => rankOf(c) === "J");
    if (hit) return { action: "play", card: hit };
  }
  // Someone is close to going out: shed the cards that cost most if they do (faces and tens first).
  if (anyoneLow && plain.length > 1) {
    const dear = plain.reduce((a, b) => (points(b) > points(a) ? b : a));
    if (points(dear) >= 9) return { action: "play", card: dear };
  }
  if (plain.length && !(hand.length <= 2 && eights.length)) {
    // The card that leaves the most ways to follow: cards of the suit it sets, plus cards of its rank.
    const score = (c: Card) => {
      const rest = hand.filter((x) => x !== c);
      const follow = rest.filter((x) => rankOf(x) === "8" || suitOf(x) === suitOf(c) || rankOf(x) === rankOf(c)).length;
      const special = rankOf(c) === "2" || rankOf(c) === "J" ? -0.5 : 0; // save them for when they bite
      const steer = v.voids[next]?.includes(suitOf(c)) ? 1.5 : 0; // a suit the next player can't follow
      return follow + special + steer + (rankOf(c) === "A" ? 0.1 : 0) + random() * 0.01;
    };
    const card = plain.reduce((a, b) => (score(b) > score(a) ? b : a));
    return { action: "play", card };
  }
  const card = eights[0] ?? playable[0]!;
  return { action: "play", card, ...(rankOf(card) === "8" ? { suit: pickSuit(v, hand.filter((c) => c !== card)) } : {}) };
}

/** Its long suit, or nearly as long a suit the next player has shown they're out of. */
function pickSuit(v: EightsView, rest: readonly Card[]): Suit {
  const n = suitCounts(rest), next = (v.you + 1) % v.counts.length;
  const best = Math.max(...SUITS.map((s) => n[s]));
  const steer = SUITS.find((s) => v.voids[next]?.includes(s) && n[s] >= Math.max(1, best - 1));
  if (steer) return steer;
  const ties = SUITS.filter((s) => n[s] === best);
  return ties.includes(v.suit) ? v.suit : ties[0]!;
}
