/**
 * Wild Eights' bots. They only use what a player could know: their own hand, the
 * pile, the suit to follow, how many cards each player holds, and the cards that
 * have been played.
 *
 *   hard    counts cards: it knows how many of each suit are still unseen (not
 *           on the pile, not in its hand) and steers to suits the others are
 *           likely out of. It holds its 8s until nothing else fits (an 8 is the
 *           one last card nobody can block), plays 2s and Jacks when the next
 *           player is close to going out, and otherwise plays the card that
 *           leaves its hand the most ways to follow; it names the suit it holds
 *           most of and the others hold least of, or one the next player has
 *           shown they're out of.
 *   medium  plays a random card that fits; plays 8s too early now and then,
 *           names its second-best suit or a random one now and then, keeps a
 *           drawn card a fifth of the time, and plays a 2 or Jack at the wrong
 *           moment as often as the right one: it can be beaten.
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
/** Cards of each suit nobody has shown yet: not on the pile, not in this hand (8s left out: they're wild). */
const unseen = (v: EightsView): Record<Suit, number> => {
  const n: Record<Suit, number> = { S: 12, H: 12, D: 12, C: 12 };
  for (const c of [...v.seen, ...v.hand]) if (rankOf(c) !== "8") n[suitOf(c)]--;
  return n;
};

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
    // Whatever fits, at random: a 2 or Jack goes out whenever, not when it would hurt.
    const card = random() < 0.2 && same.length ? same[0]! : pool[Math.floor(random() * pool.length)]!;
    const rest = hand.filter((c) => c !== card);
    const roll = random();
    const suit = rankOf(card) === "8" ? (roll < 0.15 ? SUITS[Math.floor(random() * 4)]! : roll < 0.5 ? secondSuit(rest, v.suit) : longSuit(rest, v.suit)) : undefined; // now and then its second-longest suit, or any
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
  if (plain.length) {
    // The card that leaves the most ways to follow: cards of the suit it sets, plus cards of its rank;
    // better still a suit the others are likely out of (few unseen), best of all one the next player lacks.
    const left = unseen(v), others = v.counts.reduce((a, n, s) => (s === v.you ? a : a + n), 0);
    const score = (c: Card) => {
      const rest = hand.filter((x) => x !== c);
      const follow = rest.filter((x) => rankOf(x) === "8" || suitOf(x) === suitOf(c) || rankOf(x) === rankOf(c)).length;
      const special = rankOf(c) === "2" || rankOf(c) === "J" ? -0.5 : 0; // save them for when they bite
      const steer = v.voids[next]?.includes(suitOf(c)) ? 1.5 : 0; // a suit the next player can't follow
      const scarce = others ? 1 - Math.min(1, left[suitOf(c)] / 12) : 0; // 0 to 1: how few of the suit are still out there
      return follow + special + steer + scarce + (rankOf(c) === "A" ? 0.1 : 0) + random() * 0.01;
    };
    const card = plain.reduce((a, b) => (score(b) > score(a) ? b : a));
    return { action: "play", card };
  }
  const card = eights[0] ?? playable[0]!;
  return { action: "play", card, ...(rankOf(card) === "8" ? { suit: pickSuit(v, hand.filter((c) => c !== card)) } : {}) };
}

/** Its long suit, or nearly as long a suit the next player has shown they're out of; ties go to the suit the others hold least of. */
function pickSuit(v: EightsView, rest: readonly Card[]): Suit {
  const n = suitCounts(rest), next = (v.you + 1) % v.counts.length, left = unseen(v);
  const best = Math.max(...SUITS.map((s) => n[s]));
  const steer = SUITS.find((s) => v.voids[next]?.includes(s) && n[s] >= Math.max(1, best - 1));
  if (steer) return steer;
  return SUITS.filter((s) => n[s] === best).reduce((a, b) => (left[b] < left[a] ? b : a));
}
