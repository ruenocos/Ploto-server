import { describe, it, expect } from "vitest";
import { EightsGame, fullDeck, points, rankOf, suitOf, type Card, type EightsView } from "../src/game/wild_eights/engine.js";
import { chooseMove, type BotLevel } from "../src/game/wild_eights/bot.js";
import { Rng } from "../src/game/matchmonsters/rng.js";

const seeded = (seed: number) => { const r = new Rng(seed); return () => r.next(); };
/** A game with chosen hands and pile (the rest of the deck in order). */
function rigged(hands: Card[][], top: Card, first = 0): EightsGame {
  const g = new EightsGame({ players: hands.length, random: seeded(1), first });
  const used = new Set([...hands.flat(), top]);
  g.hands = hands.map((h) => [...h]);
  g.pile = [top];
  g.suit = suitOf(top);
  g.deck = fullDeck().filter((c) => !used.has(c));
  return g;
}
const total = (g: EightsGame) => g.hands.flat().length + g.deck.length + g.pile.length;

/** A casual player: plays a random card that fits, keeps no 8s back, names a random suit. */
function casual(v: EightsView, r: () => number) {
  const fitsNow = (c: Card) => v.owed ? rankOf(c) === "2" : (!v.drawn || c === v.drawn) && (rankOf(c) === "8" || suitOf(c) === v.suit || rankOf(c) === rankOf(v.top));
  const p = v.hand.filter(fitsNow);
  if (!p.length) return v.drawn ? { action: "pass" as const } : { action: "draw" as const };
  const card = p[Math.floor(r() * p.length)]!;
  return { action: "play" as const, card, ...(rankOf(card) === "8" ? { suit: (["S", "H", "D", "C"] as const)[Math.floor(r() * 4)]! } : {}) };
}
type Who = BotLevel | "casual";
function playOut(players: Who[], seed: number): EightsGame {
  const random = seeded(seed);
  const g = new EightsGame({ players: players.length, random });
  let t = 0;
  while (g.phase === "playing") {
    const s = g.turn!, v = g.viewFor(s);
    const m = players[s] === "casual" ? casual(v, random) : chooseMove(v, players[s] as BotLevel, random);
    const r = m.action === "play" ? g.play(s, m.card, m.suit) : m.action === "draw" ? g.draw(s) : g.pass(s);
    if (!r.ok) throw new Error(`${players[s]} ${JSON.stringify(m)}: ${r.reason}`);
    expect(total(g)).toBe(52);
    if (++t > 3000) throw new Error("the game never ended");
  }
  return g;
}

describe("Wild Eights rules", () => {
  it("deals 7 each to two players, 6 to three or four; the first card up is never an 8, 2 or Jack", () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const players of [2, 3, 4]) {
        const g = new EightsGame({ players, random: seeded(seed) });
        expect(g.hands.every((h) => h.length === (players === 2 ? 7 : 6))).toBe(true);
        expect(["8", "2", "J"]).not.toContain(rankOf(g.top));
        expect(total(g)).toBe(52);
      }
    }
  });

  it("a card must match the suit or the number; an 8 goes on anything and names the suit", () => {
    const g = rigged([["5H", "9C", "8S", "KD"], ["3S", "4S"]], "5C");
    expect(g.play(0, "KD")).toMatchObject({ ok: false, reason: /match/ });
    expect(g.play(0, "5H").ok).toBe(true); // the number
    expect(g.play(1, "3S")).toMatchObject({ ok: false, reason: /match/ });
    g.turn = 0;
    expect(g.play(0, "8S")).toMatchObject({ ok: false, reason: /name a suit/ });
    const r = g.play(0, "8S", "D");
    expect(r.ok && r.events[0]).toMatchObject({ type: "play", card: "8S", suit: "D" });
    expect(g.suit).toBe("D");
    expect(g.canPlay("4S")).toBe(false); // spades no longer: diamonds were named
  });

  it("a 2 makes the next player draw two, unless they answer with a 2 (then the next draws four)", () => {
    const g = rigged([["2H", "QH", "KC"], ["2S", "QS", "JD"], ["3C", "4C", "5C"]], "7H");
    g.play(0, "2H");
    expect(g.owed).toBe(2);
    expect(g.canPlay("QS")).toBe(false);
    g.play(1, "2S");
    expect(g.owed).toBe(4);
    const r = g.draw(2);
    expect(r.ok && r.events.map((e) => e.type)).toEqual(["draw", "pass", "turn"]);
    expect(g.hands[2]).toHaveLength(7);
    expect(g.owed).toBe(0);
    expect(g.turn).toBe(0);
  });

  it("a Jack skips the next player (with two players, you go again)", () => {
    const three = rigged([["JH", "4H"], ["5H"], ["6H"]], "9H");
    const r = three.play(0, "JH");
    expect(r.ok && r.events.find((e) => e.type === "skip")).toMatchObject({ seat: 1 });
    expect(three.turn).toBe(2);
    const two = rigged([["JH", "4H"], ["5H"]], "9H");
    two.play(0, "JH");
    expect(two.turn).toBe(0);
  });

  it("drawing: one card; if it fits you may play only it, or pass; if not, the turn passes", () => {
    const g = rigged([["KC"], ["2D"]], "5H");
    g.deck = ["9H", ...g.deck.filter((c) => c !== "9H")];
    const r = g.draw(0);
    expect(r.ok && r.events.map((e) => e.type)).toEqual(["draw", "turn"]);
    expect(g.drawn).toBe("9H");
    expect(g.play(0, "KC")).toMatchObject({ ok: false, reason: /card you drew/ });
    expect(g.draw(0)).toMatchObject({ ok: false });
    expect(g.pass(0).ok).toBe(true);
    expect(g.turn).toBe(1);
    expect(g.voids[0]).toEqual(new Set()); // they kept the heart they drew: no "no hearts" mark
    g.deck = ["3S", ...g.deck.filter((c) => c !== "3S")];
    const miss = g.draw(1);
    expect(miss.ok && miss.events.map((e) => e.type)).toEqual(["draw", "pass", "turn"]);
    expect(g.voids[1]).toContain("H"); // stuck, and the new card didn't fit either: everyone knows
  });

  it("the pile is shuffled back in when the deck runs out", () => {
    const g = rigged([["KC"], ["QC"]], "5H");
    g.pile = [...g.deck.slice(0, 40), "5H"];
    g.deck = g.deck.slice(40);
    const before = g.deck.length;
    for (let i = 0; i < before; i++) { g.turn = 0; g.drawn = null; g.draw(0); }
    g.turn = 0; g.drawn = null;
    const r = g.draw(0);
    expect(r.ok && r.events[0]).toMatchObject({ type: "draw", reshuffled: true });
    expect(g.pile).toEqual(["5H"]);
    expect(total(g)).toBe(52);
  });

  it("the first to empty their hand wins; the rest are placed by points left (8s 50, faces 10, aces 1)", () => {
    expect([points("8S"), points("KD"), points("AH"), points("7C"), points("10S")]).toEqual([50, 10, 1, 7, 10]);
    const g = rigged([["4H"], ["8C", "2D"], ["KS", "QS"]], "9H");
    const r = g.play(0, "4H");
    expect(r.ok && r.events.at(-1)).toMatchObject({ type: "over", winner: 0, scores: [0, 52, 20] });
    expect(g.places()).toEqual([1, 3, 2]);
  });

  it("last card is announced; nobody else's hand is in a view until the end", () => {
    const g = rigged([["4H", "5H"], ["KS", "QS"]], "9H");
    const r = g.play(0, "4H");
    expect(r.ok && r.events.some((e) => e.type === "lastCard" && e.seat === 0)).toBe(true);
    const v = g.viewFor(1);
    expect(v.hand).toEqual(["KS", "QS"]);
    expect(v.hands).toBeNull();
    expect(v.counts).toEqual([1, 2]);
  });

  it("the clock's move plays the first card that fits (keeping 8s), else draws", () => {
    const g = rigged([["8D", "KH", "3C"], ["4S"]], "9H");
    const r = g.autoMove(0);
    expect(r.ok && r.events[0]).toMatchObject({ type: "play", card: "KH", auto: true });
    const h = rigged([["8D", "3C"], ["4S"]], "9H");
    const e = h.autoMove(0);
    expect(e.ok && e.events[0]).toMatchObject({ type: "play", card: "8D", suit: "C" });
  });

  it("1,000 games between bots (2 to 4 players) all end, keep every card, and never make an illegal move", () => {
    for (let i = 0; i < 1000; i++) {
      const players = 2 + (i % 3);
      const lineup: Who[] = Array.from({ length: players }, (_, s) => (["medium", "hard", "casual"] as const)[(s + i) % 3]!);
      const g = playOut(lineup, 100 + i);
      expect(g.winner).not.toBeNull();
      expect(g.hands[g.winner!]).toHaveLength(0);
    }
  });

  it("difficulty bands (two players): Hard beats a casual player most games, Medium a little over half", () => {
    const rate = (me: Who, them: Who, n = 1500) => {
      let wins = 0;
      for (let i = 0; i < n; i++) {
        const meFirst = i % 2 === 0;
        const g = playOut(meFirst ? [me, them] : [them, me], 5000 + i);
        if (g.winner === (meFirst ? 0 : 1)) wins++;
      }
      return wins / n;
    };
    const hard = rate("hard", "casual"), medium = rate("medium", "casual"), hardVsMedium = rate("hard", "medium");
    expect(hard).toBeGreaterThan(0.56);
    expect(hard).toBeLessThan(0.75); // luck still counts: a casual player wins some
    expect(medium).toBeGreaterThan(0.48);
    expect(medium).toBeLessThan(hard);
    expect(hardVsMedium).toBeGreaterThan(0.52);
  });
});
