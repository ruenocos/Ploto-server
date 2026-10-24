import { describe, expect, it } from "vitest";
import { HoldemGame } from "../../src/game/holdem/engine.js";
import { chooseAction, type BotLevel } from "../../src/game/holdem/bot.js";
import type { Action, LegalActions } from "../../src/game/holdem/types.js";
import { Rng } from "../../src/game/matchmonsters/rng.js";

/** Plain assert: vitest's `expect` is too slow for millions of checks. */
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

/** Checks the engine's invariants at a decision point. */
function checkTurn(game: HoldemGame, legal: LegalActions): void {
  const p = game.seat(game.toActId!)!;
  const ctx = () => `${p.id} ${JSON.stringify(legal)}`;
  assert(p.inHand && !p.folded && !p.allIn && p.stack > 0, `can't act: ${ctx()}`);
  assert(legal.canFold, `no fold: ${ctx()}`);
  assert(legal.call <= p.stack, `call over stack: ${ctx()}`);
  assert(legal.canCheck === (legal.call === 0), `check/call mismatch: ${ctx()}`);
  if (legal.canRaise) {
    assert(legal.minRaiseTo > game.state.currentBet, `min raise not above bet: ${ctx()}`);
    assert(legal.minRaiseTo <= legal.maxRaiseTo, `min over max: ${ctx()}`);
    assert(legal.maxRaiseTo === p.bet + p.stack, `max isn't all-in: ${ctx()}`);
  }
}

/** Game-over checks: one winner with every chip, places 1..n each once. */
function checkEnd(game: HoldemGame, n: number): void {
  expect(game.phase).toBe("gameOver");
  const st = game.standings();
  expect(st.map((s) => s.place)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  expect(st[0]!.chips).toBe(game.totalChips);
  expect(st.slice(1).every((s) => s.chips === 0)).toBe(true);
}

/** A random legal (or occasionally illegal) action, to reach odd corners of the rules. */
function chaos(legal: LegalActions, rng: Rng, game: HoldemGame, id: string): Action {
  const roll = rng.next();
  if (roll < 0.03) {
    // Illegal on purpose: must be rejected without changing anything.
    const before = game.chipsTotal();
    const r = game.act(id, legal.canCheck ? { type: "raise", to: 1 } : { type: "check" });
    assert(!r.ok && game.chipsTotal() === before && game.toActId === id, "illegal action changed the game");
  }
  if (roll < 0.15 && !legal.canCheck) return { type: "fold" };
  if (roll < 0.45) return legal.canCheck ? { type: "check" } : { type: "call" };
  // All-in is legal whenever it's a call, or a raise that's allowed.
  if (roll < 0.55 && (legal.canRaise || legal.call > 0)) {
    const p = game.seat(id)!;
    if (legal.canRaise || p.stack <= legal.call) return { type: "allIn" };
  }
  if (legal.canRaise) {
    const span = legal.maxRaiseTo - legal.minRaiseTo;
    return { type: "raise", to: legal.minRaiseTo + Math.floor(span * rng.next() ** 3) };
  }
  return legal.canCheck ? { type: "check" } : { type: "call" };
}

interface Totals {
  games: number;
  hands: number;
  decisions: number;
  botDecisions: number;
}

function runGames(count: number, seed: number, chaosShare: number): Totals {
  const rng = new Rng(seed);
  const random = () => rng.next();
  const totals: Totals = { games: 0, hands: 0, decisions: 0, botDecisions: 0 };
  for (let g = 0; g < count; g++) {
    const n = 2 + rng.int(5);
    const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: true }));
    const kinds: (BotLevel | "chaos")[] = players.map(() => (rng.next() < chaosShare ? "chaos" : rng.next() < 0.5 ? "easy" : "normal"));
    const game = new HoldemGame({
      players,
      startingChips: rng.pick([200, 500, 1000, 1500]),
      blindsEveryHands: rng.pick([5, 10]),
      random,
    });
    let hands = 0;
    while (game.phase !== "gameOver") {
      if (++hands > 3000) throw new Error(`game ${g} did not end`);
      const s = game.startHand();
      assert(s.ok, "startHand rejected");
      assert(game.chipsTotal() === game.totalChips, "chips changed dealing");
      while (game.toActId !== null) {
        const id = game.toActId;
        const legal = game.legal(id);
        checkTurn(game, legal);
        const kind = kinds[game.seat(id)!.seat]!;
        const action = kind === "chaos" ? chaos(legal, rng, game, id) : chooseAction(game, id, random, { level: kind });
        const r = game.act(id, action);
        if (!r.ok) throw new Error(`${kind} ${id} ${JSON.stringify(action)} rejected (${r.reason}); legal ${JSON.stringify(legal)}`);
        totals.decisions++;
        if (kind !== "chaos") totals.botDecisions++;
        assert(game.chipsTotal() === game.totalChips, `chips not conserved after ${id} ${JSON.stringify(action)}`);
      }
      assert(game.phase === "handOver" || game.phase === "gameOver", `hand stuck in ${game.phase}`);
      assert(game.state.seats.every((p) => p.stack >= 0 && p.committed === 0 && p.bet === 0), "chips left in the middle");
    }
    checkEnd(game, n);
    totals.games++;
    totals.hands += hands;
  }
  return totals;
}

describe("random games", () => {
  it(
    "5,000 bot Sit & Gos with 2–6 seats: chips conserved after every action, every game ends, bots always legal",
    () => {
      const t = runGames(5000, 20261024, 0);
      expect(t.games).toBe(5000);
      expect(t.botDecisions).toBe(t.decisions);
    },
    300_000,
  );

  it(
    "1,000 games mixing bots with random-action players (odd raise sizes, short all-ins, rejected moves)",
    () => {
      const t = runGames(1000, 7, 0.5);
      expect(t.games).toBe(1000);
      expect(t.botDecisions).toBeGreaterThan(0);
    },
    300_000,
  );
});
