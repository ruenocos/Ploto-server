import { describe, expect, it } from "vitest";
import { categoryOf, compareHands, evaluate, scoreCodes, scoreHand } from "../../src/game/holdem/evaluator.js";
import { cardToString, codeToCard, cryptoRandom, newDeck, parseCards, shuffle } from "../../src/game/holdem/cards.js";
import { Rng } from "../../src/game/matchmonsters/rng.js";

const ev = (text: string) => evaluate(parseCards(text));
const score = (text: string) => scoreHand(parseCards(text));

describe("cards", () => {
  it("builds a 52-card deck and shuffles it with the injected source", () => {
    const deck = newDeck();
    expect(new Set(deck.map(cardToString)).size).toBe(52);
    const a = new Rng(7), b = new Rng(7);
    const s1 = shuffle(newDeck(), () => a.next()).map(cardToString);
    const s2 = shuffle(newDeck(), () => b.next()).map(cardToString);
    expect(s1).toEqual(s2);
    expect(s1).not.toEqual(deck.map(cardToString));
    expect(new Set(s1).size).toBe(52);
  });

  it("cryptoRandom is a float in [0, 1)", () => {
    for (let i = 0; i < 1000; i++) {
      const x = cryptoRandom();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("round-trips card codes and strings", () => {
    for (let c = 0; c < 52; c++) expect(parseCards(cardToString(codeToCard(c)))[0]).toEqual(codeToCard(c));
    expect(parseCards("10d As")).toEqual([{ rank: 10, suit: "d" }, { rank: 14, suit: "s" }]);
  });
});

describe("evaluator", () => {
  it("counts every category over all 2,598,960 five-card hands", () => {
    const counts = new Array(9).fill(0);
    const hand = new Int32Array(5);
    let royals = 0;
    for (let a = 0; a < 48; a++) {
      hand[0] = a;
      for (let b = a + 1; b < 49; b++) {
        hand[1] = b;
        for (let c = b + 1; c < 50; c++) {
          hand[2] = c;
          for (let d = c + 1; d < 51; d++) {
            hand[3] = d;
            for (let e = d + 1; e < 52; e++) {
              hand[4] = e;
              const s = scoreCodes(hand, 5);
              const cat = s >> 20;
              counts[cat]++;
              if (cat === 8 && ((s >> 16) & 15) === 14) royals++;
            }
          }
        }
      }
    }
    expect(counts).toEqual([1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
    expect(royals).toBe(4);
    expect(counts.reduce((x, y) => x + y, 0)).toBe(2598960);
  });

  it("plays the ace low in the wheel, and only there", () => {
    const wheel = ev("As 2d 3c 4h 5s");
    expect(wheel.category).toBe(4);
    expect(wheel.ranks).toEqual([5]);
    expect(wheel.name).toBe("Straight, five high");
    expect(score("2d 3c 4h 5s 6s")).toBeGreaterThan(wheel.score);
    expect(ev("Ah 2h 3h 4h 5h").name).toBe("Straight flush, five high");
    expect(ev("Qs Ks As 2d 3c").category).toBe(0); // no wrap-around straight
    expect(ev("Ts Js Qs Ks As").name).toBe("Royal flush");
  });

  it("breaks ties on kickers", () => {
    expect(score("Ah Ad Kc 7s 2d")).toBeGreaterThan(score("As Ac Qh 7d 2c")); // pair, king kicker
    expect(score("Ah Ad Kc 7s 3d")).toBeGreaterThan(score("As Ac Kh 7d 2c")); // last kicker
    expect(score("Kh Kd 7c 7s Ad")).toBeGreaterThan(score("Ks Kc 7h 7d Qc")); // two pair kicker
    expect(score("Kh Kd 8c 8s 2d")).toBeGreaterThan(score("Ks Kc 7h 7d Ac")); // second pair before kicker
    expect(score("9h 9d 9c As 2d")).toBeGreaterThan(score("9h 9d 9c Ks Qd"));
    expect(score("Ah Jh 9h 6h 3h")).toBeGreaterThan(score("As Js 9s 6s 2s")); // flush 5th card
    expect(score("3h 3d 3c 2s 2d")).toBeGreaterThan(score("2h 2c 2s As Ad")); // full house: trips first
    expect(score("5h 5d 5c 5s Kd")).toBeGreaterThan(score("5h 5d 5c 5s Qd"));
    expect(compareHands(parseCards("Ah Kd Qc Js 9d"), parseCards("As Kc Qh Jd 9c"))).toBe(0); // split
    // Category order.
    const ladder = ["Ah Kd Qc Js 9d", "2h 2d 4c 5s 7d", "2h 2d 4c 4s 7d", "2h 2d 2c 4s 7d", "2h 3d 4c 5s 6d", "2h 4h 6h 8h Th", "2h 2d 2c 4s 4d", "2h 2d 2c 2s 4d", "2h 3h 4h 5h 6h"];
    for (let i = 1; i < ladder.length; i++) expect(score(ladder[i]!)).toBeGreaterThan(score(ladder[i - 1]!));
  });

  it("picks the best five of seven (and of six)", () => {
    const royal = ev("Ah Kh Qh Jh Th 2c 3d");
    expect(royal.name).toBe("Royal flush");
    expect(royal.cards.map(cardToString)).toEqual(["Ah", "Kh", "Qh", "Jh", "Th"]);

    const boardFlush = ev("2c 3d As Ks Qs Js 9s");
    expect(boardFlush.name).toBe("Flush, ace high");
    expect(boardFlush.cards.map(cardToString)).toEqual(["As", "Ks", "Qs", "Js", "9s"]);

    // A flush beats the straight in the same seven cards.
    expect(ev("9h 8h 7h 6c 5h 2h Kd").category).toBe(5);
    // Straight flush over a higher plain straight.
    const sf = ev("5d 6d 7d 8d 9d Ts Jc");
    expect(sf.name).toBe("Straight flush, nine high");
    expect(sf.cards.map(cardToString)).toEqual(["9d", "8d", "7d", "6d", "5d"]);
    // Two trips make a full house with the higher trips.
    const fh = ev("7h 7d 7c Ks Kd Kc 2s");
    expect(fh.name).toBe("Full house, kings full of sevens");
    expect(fh.cards.map((c) => c.rank)).toEqual([13, 13, 13, 7, 7]);
    // Three pairs: best two, the third pair's rank can be the kicker.
    const tp = ev("Ah Ad 8c 8s 6d 6h 2c");
    expect(tp.ranks).toEqual([14, 8, 6]);
    expect(tp.cards).toHaveLength(5);
    // Quads take the best kicker.
    const quads = ev("9h 9d 9c 9s 2d Kc Qd");
    expect(quads.ranks).toEqual([9, 13]);
    expect(quads.cards.map(cardToString)).toEqual(["9h", "9d", "9c", "9s", "Kc"]);
    // Six cards.
    expect(ev("Ah Kh 5h 3h 2c 4d").name).toBe("Straight, five high");
    // Pair with three kickers.
    const pair = ev("Jh Jd 2c 5s 9d Ac 3h");
    expect(pair.ranks).toEqual([11, 14, 9, 5]);
    expect(pair.cards.map((c) => c.rank)).toEqual([11, 11, 14, 9, 5]);
  });

  it("names hands", () => {
    expect(ev("Qh 9h 7h 4h 2h").name).toBe("Flush, queen high");
    expect(ev("Kh Kd 7c 7s 2d").name).toBe("Two pair, kings and sevens");
    expect(ev("Kh Kd Kc 7s 7d").name).toBe("Full house, kings full of sevens");
    expect(ev("6h 6d 6c 6s 2d").name).toBe("Four of a kind, sixes");
    expect(ev("7h 7d 7c As 2d").name).toBe("Three of a kind, sevens");
    expect(ev("Ah Ad 7c 5s 2d").name).toBe("Pair of aces");
    expect(ev("Ah Jd 7c 5s 2d").name).toBe("High card, ace");
    expect(ev("Th Jd Qc Ks Ad").name).toBe("Straight, ace high");
    expect(ev("9c Tc Jc Qc Kc").name).toBe("Straight flush, king high");
  });

  it("agrees with brute force over 21 subsets on random seven-card hands", () => {
    const rng = new Rng(99);
    for (let i = 0; i < 3000; i++) {
      const cards = shuffle(newDeck(), () => rng.next()).slice(0, 7);
      let best = 0;
      for (let a = 0; a < 7; a++)
        for (let b = a + 1; b < 7; b++) best = Math.max(best, scoreHand(cards.filter((_, k) => k !== a && k !== b)));
      const full = evaluate(cards);
      expect(full.score).toBe(best);
      expect(scoreHand([...full.cards])).toBe(best);
      expect(categoryOf(full.score)).toBe(full.category);
    }
  });
});
