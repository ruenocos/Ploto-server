import { describe, expect, it } from "vitest";
import { chenScore, chooseAction, monteCarloEquity } from "../../src/game/holdem/bot.js";
import { HoldemGame } from "../../src/game/holdem/engine.js";
import { parseCards } from "../../src/game/holdem/cards.js";
import { Rng } from "../../src/game/matchmonsters/rng.js";
import { play, raise, rig, start, table } from "./helpers.js";

const two = (t: string) => parseCards(t) as [ReturnType<typeof parseCards>[0], ReturnType<typeof parseCards>[0]];

describe("bot", () => {
  it("scores preflop hands with the Chen formula", () => {
    expect(chenScore(...two("As Ah"))).toBe(20);
    expect(chenScore(...two("Ks Kh"))).toBe(16);
    expect(chenScore(...two("2s 2h"))).toBe(5);
    expect(chenScore(...two("As Ks"))).toBe(12);
    expect(chenScore(...two("Ah Kd"))).toBe(10);
    expect(chenScore(...two("Th 9h"))).toBe(8); // 5 + 2 suited + 1 connector bonus
    expect(chenScore(...two("7c 2d"))).toBe(-1);
  });

  it("estimates equity by Monte Carlo", () => {
    const rng = new Rng(3);
    const r = () => rng.next();
    const aces = monteCarloEquity(parseCards("As Ah"), [], 1, 4000, r);
    expect(aces).toBeGreaterThan(0.82);
    expect(aces).toBeLessThan(0.88);
    expect(monteCarloEquity(parseCards("As Ah"), [], 5, 2000, r)).toBeLessThan(0.6);
    // The nuts on the river can't lose.
    expect(monteCarloEquity(parseCards("As Ks"), parseCards("Qs Js Ts 2d 3c"), 3, 300, r)).toBe(1);
    // A flush on the board plays for everyone: about a split.
    const boardFlush = monteCarloEquity(parseCards("7c 2d"), parseCards("As Ks Qs Js 9s"), 1, 2000, r);
    expect(boardFlush).toBeGreaterThan(0.4);
    expect(boardFlush).toBeLessThan(0.55);
    expect(monteCarloEquity(parseCards("7c 2d"), parseCards("As Kh Qd 8h 4c"), 1, 1000, r)).toBeLessThan(0.15);
  });

  it("is deterministic from its random source", () => {
    const deck = rig(["B", "C", "A"], { A: "Ah Kh", B: "Qc Jc", C: "9d 9s" }, "Kd 7h 2s 4c 8d");
    const make = () => {
      const g = table(3, { button: 0, decks: { 1: deck } });
      start(g);
      play(g, [["A", raise(60)], ["B", { type: "call" }], ["C", { type: "call" }]]);
      return g;
    };
    const a = new Rng(11), b = new Rng(11);
    expect(chooseAction(make(), "B", () => a.next())).toEqual(chooseAction(make(), "B", () => b.next()));
  });

  it("pushes or folds when short-stacked", () => {
    const deck = rig(["B", "C", "A"], { A: "As Kd", B: "7c 2d", C: "8h 3s" });
    const g = table(3, { button: 0, stacks: [150, 1425, 1425], decks: { 1: deck } }); // 7.5 big blinds
    start(g);
    const rng = new Rng(5);
    expect(chooseAction(g, "A", () => rng.next())).toEqual({ type: "raise", to: 150 });
  });

  it("returns a fold when it isn't the bot's turn", () => {
    const g = table(2, { button: 0 });
    start(g);
    expect(chooseAction(g, "B", Math.random)).toEqual({ type: "fold" });
  });

  it("decides in well under 15 ms on average", () => {
    const rng = new Rng(2024);
    const random = () => rng.next();
    let decisions = 0;
    let ms = 0;
    for (let i = 0; i < 40; i++) {
      const n = 2 + (i % 5);
      const game = new HoldemGame({ players: Array.from({ length: n }, (_, k) => ({ id: `p${k}`, name: `P${k}` })), startingChips: 1500, random });
      let hands = 0;
      while (game.phase !== "gameOver" && hands++ < 60) {
        game.startHand();
        while (game.toActId) {
          const id = game.toActId;
          const t0 = performance.now();
          const action = chooseAction(game, id, random, { level: i % 2 ? "easy" : "normal" });
          ms += performance.now() - t0;
          decisions++;
          expect(game.act(id, action).ok).toBe(true);
        }
      }
    }
    expect(decisions).toBeGreaterThan(500);
    expect(ms / decisions).toBeLessThan(15);
  });
});
