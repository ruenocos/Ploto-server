import { describe, it, expect } from "vitest";
import { Draft, draftScore } from "../src/game/matchmonsters/draft.js";
import { MONSTERS } from "../src/game/matchmonsters/monsters.js";

const POOL = Object.keys(MONSTERS);
const mk = (firstTurn: 0 | 1 = 0, stepMs: number | null = null, now = () => 0) =>
  new Draft({ pool: POOL, firstTurn, stepMs, random: () => 0, now });

describe("draft", () => {
  it("bans are simultaneous and secret until both are in", () => {
    const d = mk();
    d.ban(0, "ember_pup");
    expect(d.view(0).bans).toEqual(["ember_pup", null]);
    expect(d.view(1).bans).toEqual([null, null]); // can't see the rival's ban yet
    expect(d.phase).toBe("ban");
    d.ban(1, "prism_owl");
    expect(d.view(1).bans).toEqual(["ember_pup", "prism_owl"]);
    expect(d.phase).toBe("pick");
  });

  it("snake order: the player moving second picks first, then 2, then 1", () => {
    const d = mk(0); // seat 0 moves first in the match, so seat 1 picks first
    d.ban(0, "ember_pup");
    d.ban(1, "prism_owl");
    expect(d.order).toEqual([1, 0, 0, 1]);
    expect(d.turn).toBe(1);
    expect(() => d.pick(0, "tide_serpent")).toThrow(/not your pick/);
    d.pick(1, "tide_serpent");
    d.pick(0, "frost_imp");
    d.pick(0, "kraken_pup");
    d.pick(1, "bubble_jelly");
    expect(d.phase).toBe("done");
    expect(d.result()).toEqual([["frost_imp", "kraken_pup"], ["tide_serpent", "bubble_jelly"]]);
  });

  it("picks are unique and banned monsters can't be picked", () => {
    const d = mk(1);
    d.ban(0, "ember_pup");
    d.ban(1, "ember_pup"); // banning the same one is allowed
    expect(() => d.pick(0, "ember_pup")).toThrow(/isn't available/);
    d.pick(0, "tide_serpent");
    expect(() => d.pick(1, "tide_serpent")).toThrow(/isn't available/);
    expect(d.available()).not.toContain("tide_serpent");
  });

  it("timeouts: a missing ban becomes no ban, a missing pick a random one", () => {
    let t = 0;
    const d = mk(0, 20_000, () => t);
    d.ban(0, "ember_pup");
    t = 19_999;
    expect(d.expire()).toBe(false);
    t = 20_000;
    expect(d.expire()).toBe(true);
    expect(d.view(0).bans).toEqual(["ember_pup", false]);
    expect(d.phase).toBe("pick");
    expect(d.deadline).toBe(40_000);
    t = 40_000;
    d.expire(); // seat 1's first pick: random (first available)
    expect(d.view(0).picks[1]).toHaveLength(1);
    expect(d.turn).toBe(0);
  });

  it("no timer means no deadline and nothing expires", () => {
    const d = mk(0, null, () => 1e12);
    expect(d.deadline).toBeNull();
    expect(d.expire()).toBe(false);
  });
});

describe("counters", () => {
  it("the bot's score rewards counters and combos", () => {
    const owl = MONSTERS["prism_owl"]!, golem = MONSTERS["stone_golem"]!, pup = MONSTERS["ember_pup"]!, wing = MONSTERS["phoenix_chick"]!;
    expect(draftScore(owl, [], [golem])).toBeGreaterThan(draftScore(owl, [], [pup]));
    expect(draftScore(pup, [wing], [])).toBeGreaterThan(draftScore(pup, [], []));
  });
});
