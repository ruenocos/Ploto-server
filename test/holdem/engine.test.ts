import { describe, expect, it } from "vitest";
import { blindsAt, buildPots, HoldemGame, redactEvents } from "../../src/game/holdem/engine.js";
import { DEFAULT_BLINDS } from "../../src/game/holdem/types.js";
import { allIn, call, check, fold, ofType, play, raise, rig, stacks, start, table } from "./helpers.js";

describe("acting order", () => {
  it("heads-up: the button posts the small blind, acts first preflop and last after", () => {
    const g = table(2, { button: 0 });
    const ev = start(g);
    expect(ofType(ev, "handStart")[0]).toMatchObject({ handNo: 1, button: "A", level: 1, sb: 10, bb: 20 });
    expect(ofType(ev, "blindsPosted")[0]!.posts).toEqual([
      { id: "A", kind: "sb", amount: 10, allIn: false },
      { id: "B", kind: "bb", amount: 20, allIn: false },
    ]);
    // Dealt starting left of the button.
    expect(ofType(ev, "holeDealt")[0]!.hands.map((h) => h.id)).toEqual(["B", "A"]);
    expect(g.toActId).toBe("A");
    expect(g.legal("A")).toEqual({ canFold: true, canCheck: false, call: 10, canRaise: true, minRaiseTo: 40, maxRaiseTo: 1000 });
    expect(g.legal("B")).toMatchObject({ canFold: false, canRaise: false });
    play(g, [["A", call]]);
    expect(g.legal("B")).toMatchObject({ canCheck: true, call: 0, canRaise: true, minRaiseTo: 40 });
    const flop = play(g, [["B", check]]);
    expect(ofType(flop, "street")[0]).toMatchObject({ name: "flop" });
    expect(g.phase).toBe("flop");
    expect(g.toActId).toBe("B");
    play(g, [["B", check], ["A", check]]);
    expect(g.phase).toBe("turn");
    play(g, [["B", check], ["A", check], ["B", check]]);
    const end = play(g, [["A", check]]);
    expect(ofType(end, "showdown")).toHaveLength(1);
    expect(g.phase).toBe("handOver");

    // The button moves: B posts the small blind and acts first.
    start(g);
    expect(g.state.button).toBe(1);
    expect(g.state.sbSeat).toBe(1);
    expect(g.state.bbSeat).toBe(0);
    expect(g.toActId).toBe("B");
  });

  it("3-handed: button first preflop, small blind first after the flop", () => {
    const g = table(3, { button: 0 });
    start(g);
    expect([g.state.sbSeat, g.state.bbSeat]).toEqual([1, 2]);
    play(g, [["A", call], ["B", call]]);
    // The big blind's option.
    expect(g.legal("C")).toMatchObject({ canCheck: true, canRaise: true, minRaiseTo: 40 });
    play(g, [["C", check]]);
    expect(g.toActId).toBe("B");
    play(g, [["B", check], ["C", check], ["A", check]]);
    expect(g.phase).toBe("turn");
    // Fold everything down to finish the hand.
    play(g, [["B", raise(20)], ["C", fold], ["A", fold]]);

    start(g);
    expect([g.state.button, g.state.sbSeat, g.state.bbSeat]).toEqual([1, 2, 0]);
    expect(g.toActId).toBe("B");
    // If the small blind folds, the big blind acts first after the flop.
    play(g, [["B", call], ["C", fold], ["A", check]]);
    expect(g.toActId).toBe("A");
  });

  it("6-handed: left of the big blind first preflop, around to the big blind", () => {
    const g = table(6, { button: 2 });
    start(g);
    expect([g.state.sbSeat, g.state.bbSeat]).toEqual([3, 4]);
    play(g, [["F", call], ["A", call], ["B", call], ["C", call], ["D", call], ["E", check]]);
    expect(g.phase).toBe("flop");
    play(g, [["D", check], ["E", check], ["F", check], ["A", check], ["B", check], ["C", check]]);
    expect(g.phase).toBe("turn");
    expect(g.toActId).toBe("D");
  });

  it("skips busted players when moving the button and blinds", () => {
    const g = table(3, {
      button: 0,
      stacks: [1000, 20, 1980],
      decks: { 1: rig(["B", "C", "A"], { B: "7c 2d", C: "As Ad", A: "8h 3s" }, "Ks Qd 9h 5c 4c") },
    });
    start(g);
    // B (small blind, 20 chips) is all-in calling the big blind: C, the only
    // player left with chips, has nothing to call and no one to bet against.
    const ev = play(g, [["A", fold], ["B", allIn]]);
    expect(g.toActId).toBe(null);
    expect(ofType(ev, "eliminated")).toEqual([{ type: "eliminated", id: "B", place: 3 }]);
    start(g);
    // Heads-up now: the button moves past the busted seat; the button posts the small blind.
    expect(g.state.button).toBe(2);
    expect(g.state.sbSeat).toBe(2);
    expect(g.state.bbSeat).toBe(0);
    expect(g.state.seats[1]!.inHand).toBe(false);
  });
});

describe("betting", () => {
  it("enforces the minimum bet and minimum raise", () => {
    const g = table(3, { button: 0 });
    start(g);
    expect(g.legal("A").minRaiseTo).toBe(40);
    play(g, [["A", raise(60)]]); // raise of 40
    expect(g.legal("B").minRaiseTo).toBe(100);
    expect(g.act("B", raise(99))).toEqual({ ok: false, reason: "raise below minimum" });
    expect(g.act("B", raise(5000))).toEqual({ ok: false, reason: "raise above stack" });
    expect(g.act("B", raise(100.5))).toEqual({ ok: false, reason: "invalid amount" });
    const ev = play(g, [["B", raise(100)]]);
    expect(ofType(ev, "action")[0]).toEqual({ type: "action", id: "B", action: "raise", amount: 90, toTotal: 100, allIn: false, timedOut: false });
    expect(g.legal("C").minRaiseTo).toBe(140);
    play(g, [["C", call], ["A", call]]);
    // After the flop the minimum bet is the big blind.
    expect(g.legal("B")).toMatchObject({ canCheck: true, minRaiseTo: 20, maxRaiseTo: 900 });
    const bet = play(g, [["B", raise(50)]]);
    expect(ofType(bet, "action")[0]).toMatchObject({ action: "bet", amount: 50, toTotal: 50 });
    expect(g.legal("C").minRaiseTo).toBe(100);
    play(g, [["C", raise(170)]]); // raise of 120 becomes the new minimum
    expect(g.legal("A").minRaiseTo).toBe(290);
    expect(g.chipsTotal()).toBe(3000);
  });

  it("a short all-in raise does not reopen the betting to players who already acted", () => {
    const g = table(3, { button: 0, stacks: [1000, 130, 1870] });
    start(g);
    play(g, [["A", raise(100)]]); // full raise: +80
    const ev = play(g, [["B", allIn]]); // 130: only +30
    expect(ofType(ev, "action")[0]).toEqual({ type: "action", id: "B", action: "raise", amount: 120, toTotal: 130, allIn: true, timedOut: false });
    // C hasn't acted yet, so may raise: at least the last full raise (80) on top.
    expect(g.legal("C")).toMatchObject({ call: 110, canRaise: true, minRaiseTo: 210 });
    play(g, [["C", call]]);
    // A only faces 30 more (less than a full raise): call or fold.
    expect(g.legal("A")).toEqual({ canFold: true, canCheck: false, call: 30, canRaise: false, minRaiseTo: 0, maxRaiseTo: 0 });
    expect(g.act("A", raise(300))).toEqual({ ok: false, reason: "raise not allowed" });
    expect(g.act("A", allIn)).toEqual({ ok: false, reason: "raise not allowed" });
    play(g, [["A", call]]);
    expect(g.phase).toBe("flop");
    expect(g.chipsTotal()).toBe(3000);
  });

  it("short all-ins that add up to a full raise do reopen the betting", () => {
    const g = table(4, { button: 0, stacks: [140, 180, 1840, 1840] });
    start(g); // SB B, BB C, UTG D
    play(g, [["D", raise(100)], ["A", allIn], ["B", allIn]]); // 140 (+40), then 180 (+40)
    expect(g.legal("C")).toMatchObject({ canRaise: true, minRaiseTo: 260 });
    play(g, [["C", call]]);
    // D raised to 100; it's now 180, a full 80 more: D may re-raise.
    expect(g.legal("D")).toMatchObject({ call: 80, canRaise: true, minRaiseTo: 260 });
  });

  it("the call price preflop is the full big blind even if the big blind posted short", () => {
    const g = table(3, { button: 0, stacks: [1000, 1995, 5] });
    const ev = start(g);
    expect(ofType(ev, "blindsPosted")[0]!.posts[1]).toEqual({ id: "C", kind: "bb", amount: 5, allIn: true });
    expect(g.legal("A").call).toBe(20);
    play(g, [["A", call], ["B", call]]);
    expect(g.phase).toBe("flop");
    expect(g.viewFor(null).pots).toEqual([
      { amount: 15, eligible: ["A", "B", "C"] },
      { amount: 30, eligible: ["A", "B"] },
    ]);
  });

  it("heads-up big blind all-in for less than the small blind: no action, excess returned, board runs out", () => {
    const g = table(2, { button: 0, stacks: [1995, 5] });
    const ev = start(g);
    expect(g.toActId).toBe(null);
    expect(ofType(ev, "betReturned")).toEqual([{ type: "betReturned", id: "A", amount: 5 }]);
    expect(ofType(ev, "street")).toHaveLength(3);
    expect(ofType(ev, "potAwarded")[0]!.amount).toBe(10);
    expect(g.chipsTotal()).toBe(2000);
  });

  it("a player facing an all-in from the only other player can't raise", () => {
    const g = table(2, { button: 0 });
    start(g);
    play(g, [["A", allIn]]);
    expect(g.legal("B")).toEqual({ canFold: true, canCheck: false, call: 980, canRaise: false, minRaiseTo: 0, maxRaiseTo: 0 });
  });

  it("returns the part of a shove nobody can call", () => {
    const g = table(2, { button: 0, stacks: [1500, 500] });
    start(g);
    play(g, [["A", allIn]]);
    expect(g.legal("B").call).toBe(480);
    const ev = play(g, [["B", call]]);
    expect(ofType(ev, "betReturned")).toEqual([{ type: "betReturned", id: "A", amount: 1000 }]);
    expect(ofType(ev, "potAwarded")[0]!.amount).toBe(1000);
  });
});

describe("pots and showdown", () => {
  it("builds exact side pots from three all-ins of different sizes", () => {
    // Button D: dealt A, B, C, D. SB A, BB B, UTG C.
    const deck = rig(["A", "B", "C", "D"], { A: "As Ad", B: "Ks Kd", C: "Qs Qd", D: "8c 6c" }, "2c 7d 9h Js 3s");
    const g = table(4, { button: 3, stacks: [100, 300, 600, 3000], decks: { 1: deck } });
    start(g);
    const ev = play(g, [["C", allIn], ["D", allIn], ["A", allIn], ["B", allIn]]);
    expect(ofType(ev, "betReturned")).toEqual([{ type: "betReturned", id: "D", amount: 2400 }]);
    expect(ofType(ev, "potAwarded")).toEqual([
      { type: "potAwarded", potIndex: 0, amount: 400, winners: [{ id: "A", amount: 400, handName: "Pair of aces" }] },
      { type: "potAwarded", potIndex: 1, amount: 600, winners: [{ id: "B", amount: 600, handName: "Pair of kings" }] },
      { type: "potAwarded", potIndex: 2, amount: 600, winners: [{ id: "C", amount: 600, handName: "Pair of queens" }] },
    ]);
    expect(stacks(g)).toEqual({ A: 400, B: 600, C: 600, D: 2400 });
    // Event order: actions, returned bet, the run-out, reveals, pots.
    const types = ev.map((e) => e.type);
    expect(types).toEqual(["action", "action", "action", "action", "betReturned", "street", "street", "street", "showdown", "potAwarded", "potAwarded", "potAwarded"]);
    expect(ofType(ev, "showdown")[0]!.reveals.map((r) => r.id)).toEqual(["A", "B", "C", "D"]);
    expect(g.chipsTotal()).toBe(4000);
  });

  it("keeps folded players' chips in the pots they paid into", () => {
    expect(
      buildPots([
        { id: "A", amount: 100, live: true },
        { id: "B", amount: 300, live: true },
        { id: "C", amount: 600, live: true },
        { id: "D", amount: 600, live: true },
        { id: "E", amount: 200, live: false },
      ]),
    ).toEqual([
      { amount: 500, eligible: ["A", "B", "C", "D"] },
      { amount: 700, eligible: ["B", "C", "D"] },
      { amount: 600, eligible: ["C", "D"] },
    ]);
    expect(buildPots([{ id: "A", amount: 0, live: true }])).toEqual([]);
  });

  it("a folded player who paid into a side pot can't win it", () => {
    // 3-handed, button A: dealt B, C, A. C (short) is all-in; A bets the flop and B folds.
    const deck = rig(["B", "C", "A"], { B: "As Ad", C: "Ks Kd", A: "7h 2c" }, "Kc 9d 5s 4h 3c");
    const g = table(3, { button: 0, stacks: [1400, 1400, 200], decks: { 1: deck } });
    start(g);
    play(g, [["A", raise(200)], ["B", call], ["C", call]]); // C all-in for 200
    play(g, [["B", check], ["A", raise(300)]]);
    const ev = play(g, [["B", fold]]);
    // Main pot 600: C wins with trips (B, with the aces, folded). A's flop bet is returned.
    expect(ofType(ev, "betReturned")).toEqual([{ type: "betReturned", id: "A", amount: 300 }]);
    expect(ofType(ev, "potAwarded")).toEqual([{ type: "potAwarded", potIndex: 0, amount: 600, winners: [{ id: "C", amount: 600, handName: "Three of a kind, kings" }] }]);
    expect(ofType(ev, "showdown")[0]!.reveals.map((r) => r.id)).toEqual(["C", "A"]);
  });

  it("splits a pot and gives the odd chip to the first winner left of the button", () => {
    const deck = rig(["B", "C", "A"], { A: "2c 3d", B: "4h 5h", C: "6c 7d" }, "As Ks Qs Js Ts");
    const g = table(3, { button: 0, blinds: [{ sb: 5, bb: 10 }], decks: { 1: deck } });
    start(g);
    play(g, [["A", call], ["B", fold], ["C", check]]);
    play(g, [["C", check], ["A", check], ["C", check], ["A", check], ["C", check]]);
    const ev = play(g, [["A", check]]);
    expect(ofType(ev, "potAwarded")).toEqual([
      {
        type: "potAwarded",
        potIndex: 0,
        amount: 25,
        winners: [
          { id: "C", amount: 13, handName: "Royal flush" },
          { id: "A", amount: 12, handName: "Royal flush" },
        ],
      },
    ]);
    expect(stacks(g)).toEqual({ A: 1002, B: 995, C: 1003 });
  });

  it("a player everyone folds to wins without showing", () => {
    const g = table(3, { button: 0 });
    start(g);
    const ev = play(g, [["A", fold], ["B", fold]]);
    expect(ev.map((e) => e.type)).toEqual(["action", "action", "betReturned", "potAwarded"]);
    expect(ofType(ev, "potAwarded")[0]).toEqual({ type: "potAwarded", potIndex: 0, amount: 20, winners: [{ id: "C", amount: 20, handName: null }] });
    expect(g.viewFor("A").seats[2]!.cards).toBe(null);
    expect(g.viewFor(null).seats[2]!.hasCards).toBe(true);
    expect(stacks(g)).toEqual({ A: 1000, B: 990, C: 1010 });
  });

  it("runs the board out when everyone is all-in", () => {
    const deck = rig(["B", "A"], { A: "As Ad", B: "Ks Kd" }, "2c 7d 9h Jc 3h");
    const g = table(2, { button: 0, decks: { 1: deck } });
    start(g);
    play(g, [["A", allIn]]);
    const ev = play(g, [["B", call]]);
    expect(ev.map((e) => e.type)).toEqual(["action", "street", "street", "street", "showdown", "potAwarded", "eliminated", "gameOver"]);
    expect(ofType(ev, "street").map((s) => s.name)).toEqual(["flop", "turn", "river"]);
    expect(ofType(ev, "street")[2]!.board).toHaveLength(5);
    expect(ofType(ev, "gameOver")[0]!.standings).toEqual([
      { id: "A", name: "Player A", place: 1, chips: 2000 },
      { id: "B", name: "Player B", place: 2, chips: 0 },
    ]);
    expect(g.phase).toBe("gameOver");
    expect(g.startHand()).toEqual({ ok: false, reason: "game over" });
    expect(g.act("A", check)).toEqual({ ok: false, reason: "game over" });
  });

  it("shows first the river's last aggressor", () => {
    const deck = rig(["B", "A"], { A: "As Ad", B: "Ks Kd" }, "2c 7d 9h Jc 3h");
    const g = table(2, { button: 0, decks: { 1: deck } });
    start(g);
    play(g, [["A", call], ["B", check], ["B", check], ["A", check], ["B", check], ["A", check], ["B", check], ["A", raise(40)]]);
    const ev = play(g, [["B", call]]);
    expect(ofType(ev, "showdown")[0]!.reveals.map((r) => [r.id, r.handName])).toEqual([
      ["A", "Pair of aces"],
      ["B", "Pair of kings"],
    ]);
  });
});

describe("eliminations", () => {
  it("places two players busting on the same hand by their starting stacks, and ends the game", () => {
    // Button C: dealt A, B, C. SB A, BB B, UTG C.
    const deck = rig(["A", "B", "C"], { A: "Ks Kd", B: "Qs Qd", C: "As Ad" }, "2c 8d 9h Jc 3h");
    const g = table(3, { button: 2, stacks: [100, 300, 2600], decks: { 1: deck } });
    start(g);
    const ev = play(g, [["C", allIn], ["A", call], ["B", call]]);
    expect(ofType(ev, "eliminated")).toEqual([
      { type: "eliminated", id: "A", place: 3 },
      { type: "eliminated", id: "B", place: 2 },
    ]);
    expect(g.standings().map((s) => [s.id, s.place, s.chips])).toEqual([
      ["C", 1, 3000],
      ["B", 2, 0],
      ["A", 3, 0],
    ]);
    expect(g.phase).toBe("gameOver");
  });

  it("breaks equal starting stacks by seat order", () => {
    const deck = rig(["A", "B", "C", "D"], { A: "Ks Kd", B: "Qs Qd", C: "7c 2d", D: "As Ad" }, "2c 8d 9h Jc 3h");
    const g = table(4, { button: 3, stacks: [200, 200, 200, 3400], decks: { 1: deck } });
    start(g);
    const ev = play(g, [["C", fold], ["D", allIn], ["A", call], ["B", call]]);
    expect(ofType(ev, "eliminated")).toEqual([
      { type: "eliminated", id: "B", place: 4 },
      { type: "eliminated", id: "A", place: 3 },
    ]);
    expect(g.phase).toBe("handOver");
    expect(g.standings().map((s) => [s.id, s.place])).toEqual([
      ["D", null],
      ["C", null],
      ["A", 3],
      ["B", 4],
    ]);
    expect(g.viewFor(null).seats[0]).toMatchObject({ busted: true, place: 3 });
  });
});

describe("blinds", () => {
  /** Folds every hand to the big blind. */
  function foldAround(g: HoldemGame): void {
    while (g.toActId) expect(g.act(g.toActId, fold).ok).toBe(true);
  }

  it("go up on schedule, then keep doubling", () => {
    const g = table(3, { chips: 1_000_000, every: 5 });
    const seen: { handNo: number; sb: number; bb: number; up: boolean }[] = [];
    for (let h = 1; h <= 61; h++) {
      const ev = start(g);
      const hs = ofType(ev, "handStart")[0]!;
      seen.push({ handNo: hs.handNo, sb: hs.sb, bb: hs.bb, up: ev[0]!.type === "blindsUp" });
      if (h === 5) expect(g.viewFor(null).nextLevelAtHand).toBe(6);
      if (h === 6) {
        expect(ev[0]).toEqual({ type: "blindsUp", level: 2, sb: 15, bb: 30 });
        expect(hs.level).toBe(2);
        expect(g.viewFor(null).nextLevelAtHand).toBe(11);
      }
      foldAround(g);
    }
    expect(seen.slice(0, 5).every((s) => s.bb === 20 && !s.up)).toBe(true);
    expect(seen[5]).toEqual({ handNo: 6, sb: 15, bb: 30, up: true });
    expect(seen[55]).toMatchObject({ sb: 1000, bb: 2000 });
    expect(seen[60]).toEqual({ handNo: 61, sb: 2000, bb: 4000, up: true });
    expect(blindsAt(DEFAULT_BLINDS, 13)).toEqual({ sb: 4000, bb: 8000 });
    expect(g.chipsTotal()).toBe(3_000_000);
  });

  it("never go up with blindsEveryHands 0", () => {
    const g = table(3, { chips: 100_000, every: 0 });
    for (let h = 1; h <= 30; h++) {
      const ev = start(g);
      expect(ofType(ev, "blindsUp")).toHaveLength(0);
      expect(ofType(ev, "handStart")[0]).toMatchObject({ level: 1, sb: 10, bb: 20 });
      foldAround(g);
    }
    expect(g.viewFor(null).nextLevelAtHand).toBe(null);
  });

  it("a short stack posts its blind all-in", () => {
    const g = table(3, { button: 0, stacks: [1000, 6, 1994] });
    const ev = start(g);
    expect(ofType(ev, "blindsPosted")[0]!.posts[0]).toEqual({ id: "B", kind: "sb", amount: 6, allIn: true });
  });
});

describe("commands", () => {
  it("timeoutAction checks when it can and folds otherwise", () => {
    const g = table(2, { button: 0 });
    start(g);
    expect(g.timeoutAction("B")).toEqual({ ok: false, reason: "not your turn" });
    const r1 = g.timeoutAction("A");
    expect(r1.ok && ofType(r1.events, "action")[0]).toMatchObject({ id: "A", action: "fold", timedOut: true });
    start(g); // button B
    play(g, [["B", call]]);
    const r2 = g.timeoutAction("A");
    expect(r2.ok && ofType(r2.events, "action")[0]).toMatchObject({ id: "A", action: "check", timedOut: true });
    expect(g.phase).toBe("flop");
  });

  it("rejects actions out of turn, out of a hand and against the rules", () => {
    const g = table(3, { button: 0 });
    expect(g.act("A", fold)).toEqual({ ok: false, reason: "no hand in progress" });
    start(g);
    expect(g.startHand()).toEqual({ ok: false, reason: "hand in progress" });
    expect(g.act("Z", fold)).toEqual({ ok: false, reason: "unknown player" });
    expect(g.act("B", fold)).toEqual({ ok: false, reason: "not your turn" });
    expect(g.act("A", check)).toEqual({ ok: false, reason: "cannot check facing a bet" });
    expect(g.act("A", { type: "bogus" } as never)).toEqual({ ok: false, reason: "unknown action" });
    expect(g.act("A", null as never)).toEqual({ ok: false, reason: "unknown action" });
    expect(g.act("A", { type: "raise" } as never)).toEqual({ ok: false, reason: "invalid amount" });
    // A rejected action changes nothing.
    expect(g.toActId).toBe("A");
    expect(g.chipsTotal()).toBe(3000);
    // Calling with nothing to call is a check.
    play(g, [["A", call], ["B", call]]);
    const ev = play(g, [["C", call]]);
    expect(ofType(ev, "action")[0]).toMatchObject({ action: "check", amount: 0 });
  });

  it("validates its config", () => {
    const p = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    expect(() => new HoldemGame({ players: p(1), startingChips: 100 })).toThrow();
    expect(() => new HoldemGame({ players: p(7), startingChips: 100 })).toThrow();
    expect(() => new HoldemGame({ players: [...p(1), ...p(1)], startingChips: 100 })).toThrow();
    expect(() => new HoldemGame({ players: p(2), startingChips: 0 })).toThrow();
    expect(() => new HoldemGame({ players: p(2), startingChips: 100, firstButton: 2 })).toThrow();
    expect(new HoldemGame({ players: p(2), startingChips: 100 }).phase).toBe("handOver");
  });
});

describe("views", () => {
  it("hide other players' hole cards until they are shown down", () => {
    const deck = rig(["B", "C", "A"], { A: "As Ad", B: "Ks Kd", C: "7c 2d" }, "2c 8d 9h Jc 3h");
    const g = table(3, { button: 0, decks: { 1: deck } });
    start(g);
    const a = g.viewFor("A");
    expect(a.you).toBe("A");
    expect(a.seats.map((s) => s.cards?.length ?? null)).toEqual([2, null, null]);
    expect(a.seats.every((s) => s.hasCards)).toBe(true);
    expect(a.legal).toMatchObject({ call: 20 });
    expect(g.viewFor("B").legal).toBe(null);
    const spectator = g.viewFor(null);
    expect(spectator.you).toBe(null);
    expect(spectator.seats.every((s) => s.cards === null)).toBe(true);
    expect(spectator.legal).toBe(null);
    expect(spectator.totalPot).toBe(30);

    const dealt = redactEvents(g.handEvents, "B");
    const hands = ofType(dealt, "holeDealt")[0]!.hands;
    expect(hands.map((h) => h.cards?.length ?? null)).toEqual([2, null, null]);
    expect(ofType(redactEvents(g.handEvents, null), "holeDealt")[0]!.hands.every((h) => h.cards === null)).toBe(true);
    // The unredacted log still has them (server side only).
    expect(ofType(g.handEvents, "holeDealt")[0]!.hands.every((h) => h.cards?.length === 2)).toBe(true);

    play(g, [["A", call], ["B", call], ["C", fold]]);
    for (let i = 0; i < 6; i++) play(g, [[g.toActId!, check]]);
    expect(g.phase).toBe("handOver");
    const after = g.viewFor(null);
    expect(after.seats[0]!.cards?.length).toBe(2); // shown down
    expect(after.seats[1]!.cards?.length).toBe(2);
    expect(after.seats[2]!.cards).toBe(null); // folded, never shown
    expect(after.board).toHaveLength(5);
    expect(g.handEvents.length).toBeGreaterThan(10);

    start(g);
    expect(g.viewFor(null).seats.every((s) => s.cards === null)).toBe(true);
    expect(g.viewFor(null).board).toEqual([]);
  });
});
