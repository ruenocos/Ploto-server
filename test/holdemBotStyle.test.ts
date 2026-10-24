import { describe, it, expect } from "vitest";
import { HoldemGame } from "../src/game/holdem/engine.js";
import { chooseAction, type BotLevel } from "../src/game/holdem/bot.js";
import { Rng } from "../src/game/matchmonsters/rng.js";

/**
 * How the bots play at a 4-seat table (fresh 50 big blind stacks every hand),
 * pinned to sensible short-handed ranges so the thresholds can't drift back to
 * full-ring ones, where bots folded ~90% of hands and a raise took the pot.
 */
function style(level: BotLevel, hands = 1500) {
  const rng = new Rng(2026);
  const random = () => rng.next();
  let dealt = 0, vpip = 0, pfr = 0, facedOpen = 0, foldedToOpen = 0, flops = 0;
  for (let h = 0; h < hands; h++) {
    const game = new HoldemGame({ players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}`, bot: true })), startingChips: 1000, blindsEveryHands: 0, random });
    game.startHand();
    dealt += 4;
    const played = new Set<string>(), raised = new Set<string>();
    let sawFlop = false;
    while (game.toActId !== null) {
      const id = game.toActId;
      const pre = game.viewFor(id).phase === "preflop";
      const facing = game.state.streetRaises;
      const action = chooseAction(game, id, random, { level });
      if (pre) {
        if (action.type === "call" || action.type === "raise" || action.type === "allIn") played.add(id);
        if (action.type === "raise" || action.type === "allIn") raised.add(id);
        if (facing === 1) { facedOpen++; if (action.type === "fold") foldedToOpen++; }
      } else sawFlop = true;
      expect(game.act(id, action).ok).toBe(true);
    }
    vpip += played.size;
    pfr += raised.size;
    if (sawFlop) flops++;
  }
  return { vpip: vpip / dealt, pfr: pfr / dealt, foldToOpen: foldedToOpen / facedOpen, flops: flops / hands };
}

describe("hold'em bot style at a 4-seat table", () => {
  const sharp = style("normal");
  const relaxed = style("easy");

  it("Sharp plays a short-handed range: about a third of hands, raising most of them", () => {
    expect(sharp.vpip).toBeGreaterThan(0.26);
    expect(sharp.vpip).toBeLessThan(0.42);
    expect(sharp.pfr).toBeGreaterThan(0.12);
    expect(sharp.pfr).toBeLessThan(0.26);
    expect(sharp.foldToOpen).toBeLessThan(0.78); // it was 86%: one raise took the pot
    expect(sharp.flops).toBeGreaterThan(0.35); // it was 7%
  });

  it("Relaxed plays looser and calls more than Sharp", () => {
    expect(relaxed.vpip).toBeGreaterThan(sharp.vpip + 0.1);
    expect(relaxed.foldToOpen).toBeLessThan(sharp.foldToOpen);
    expect(relaxed.flops).toBeGreaterThan(sharp.flops);
  });
});
