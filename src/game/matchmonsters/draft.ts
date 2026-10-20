/**
 * Draft pick: ban 1 each, then a snake pick of two monsters each.
 *
 *   ban   both players ban one monster at the same time; neither sees the
 *         other's ban until both are in (or the step times out: no ban).
 *   pick  snake order P, Q, Q, P, where P is the player who moves second in
 *         the match (first pick makes up for moving second). Every pick is
 *         visible, so you can counter what the rival takes.
 *
 * Picks are unique (a monster taken by one player is gone for the other) and
 * banned monsters can't be picked. Steps can have a deadline (Quick Play);
 * `expire()` resolves a step that ran out: no ban, or a random pick.
 *
 * Pure and synchronous: the room drives time and notifications.
 */
import type { Monster } from "./types.js";

export type DraftPhase = "ban" | "pick" | "done";

export interface DraftOptions {
  /** Monster ids that can be drafted. */
  readonly pool: readonly string[];
  /** Who moves first in the match; the other player gets the first pick. */
  readonly firstTurn: 0 | 1;
  /** Time per step in ms, or null for no timer. */
  readonly stepMs: number | null;
  /** Random source in [0, 1), for timeout picks. */
  readonly random?: () => number;
  readonly now?: () => number;
}

/** What one player is allowed to see. */
export interface DraftView {
  readonly phase: DraftPhase;
  readonly you: 0 | 1;
  /** Bans per seat; the rival's stays hidden (null) until both are in. `false` = banned nothing. */
  readonly bans: readonly [string | false | null, string | false | null];
  readonly picks: readonly [readonly string[], readonly string[]];
  /** Whose pick it is (pick phase only). */
  readonly turn: 0 | 1 | null;
  /** Whether you still have to act in this step. */
  readonly yourMove: boolean;
  /** The snake order of the pick phase, by seat. */
  readonly order: readonly (0 | 1)[];
  /** When the current step times out (epoch ms), or null. */
  readonly deadline: number | null;
  readonly stepMs: number | null;
}

export class Draft {
  readonly order: (0 | 1)[];
  private phaseNow: DraftPhase = "ban";
  /** undefined = not banned yet; false = timed out / skipped; string = banned id. */
  private readonly bans: [string | false | undefined, string | false | undefined] = [undefined, undefined];
  private readonly picks: [string[], string[]] = [[], []];
  private step = 0;
  private deadlineAt: number | null = null;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(private readonly opts: DraftOptions) {
    const first: 0 | 1 = opts.firstTurn === 0 ? 1 : 0;
    const second: 0 | 1 = first === 0 ? 1 : 0;
    this.order = [first, second, second, first];
    this.random = opts.random ?? Math.random;
    this.now = opts.now ?? Date.now;
    this.armDeadline();
  }

  get phase(): DraftPhase {
    return this.phaseNow;
  }

  get deadline(): number | null {
    return this.deadlineAt;
  }

  /** Whose pick it is, in the pick phase. */
  get turn(): 0 | 1 | null {
    return this.phaseNow === "pick" ? this.order[this.step]! : null;
  }

  /** Monsters nobody has banned or picked. */
  available(): string[] {
    const gone = new Set<string>([...this.picks[0], ...this.picks[1]]);
    for (const b of this.bans) if (typeof b === "string") gone.add(b);
    return this.opts.pool.filter((id) => !gone.has(id));
  }

  /** Does `seat` still have to act in the current step? */
  needs(seat: 0 | 1): boolean {
    if (this.phaseNow === "ban") return this.bans[seat] === undefined;
    if (this.phaseNow === "pick") return this.turn === seat;
    return false;
  }

  ban(seat: 0 | 1, id: string): void {
    if (this.phaseNow !== "ban") throw new Error("the ban phase is over");
    if (this.bans[seat] !== undefined) throw new Error("you already banned");
    if (!this.opts.pool.includes(id)) throw new Error("unknown monster");
    this.bans[seat] = id; // both may ban the same monster; it's simply gone
    this.afterBan();
  }

  pick(seat: 0 | 1, id: string): void {
    if (this.phaseNow !== "pick") throw new Error(this.phaseNow === "ban" ? "ban first" : "the draft is over");
    if (this.turn !== seat) throw new Error("it's not your pick");
    if (!this.available().includes(id)) throw new Error("that monster isn't available");
    this.picks[seat].push(id);
    this.step += 1;
    if (this.step >= this.order.length) {
      this.phaseNow = "done";
      this.deadlineAt = null;
    } else this.armDeadline();
  }

  /**
   * Resolve a step whose deadline has passed: missing bans become "no ban",
   * a missing pick becomes a random available monster. Returns whether
   * anything changed.
   */
  expire(): boolean {
    if (this.deadlineAt === null || this.now() < this.deadlineAt) return false;
    if (this.phaseNow === "ban") {
      for (const s of [0, 1] as const) if (this.bans[s] === undefined) this.bans[s] = false;
      this.afterBan();
      return true;
    }
    if (this.phaseNow === "pick") {
      const seat = this.turn!;
      const pool = this.available();
      this.pick(seat, pool[Math.floor(this.random() * pool.length)]!);
      return true;
    }
    return false;
  }

  /** The two drafted teams, once done. */
  result(): [[string, string], [string, string]] {
    if (this.phaseNow !== "done") throw new Error("the draft isn't finished");
    return [this.picks[0] as [string, string], this.picks[1] as [string, string]];
  }

  view(seat: 0 | 1): DraftView {
    const bothBanned = this.bans[0] !== undefined && this.bans[1] !== undefined;
    const show = (s: 0 | 1): string | false | null => {
      const b = this.bans[s];
      if (b === undefined) return null;
      return s === seat || bothBanned ? b : null; // the rival's ban stays secret until both are in
    };
    return {
      phase: this.phaseNow,
      you: seat,
      bans: [show(0), show(1)],
      picks: [[...this.picks[0]], [...this.picks[1]]],
      turn: this.turn,
      yourMove: this.needs(seat),
      order: [...this.order],
      deadline: this.deadlineAt,
      stepMs: this.opts.stepMs,
    };
  }

  private afterBan(): void {
    if (this.bans[0] === undefined || this.bans[1] === undefined) return;
    this.phaseNow = "pick";
    this.armDeadline();
  }

  private armDeadline(): void {
    this.deadlineAt = this.opts.stepMs === null ? null : this.now() + this.opts.stepMs;
  }
}

// ---------------------------------------------------------------- counters

/**
 * What a kit does that other kits care about (derived from its effects). Only
 * the bot uses this: players discover counters and combos themselves.
 */
export interface KitTraits {
  readonly shields: boolean;
  readonly heals: boolean; // heal, life steal, regen
  readonly controls: boolean; // burn, poison, freeze, slow, seal
  readonly burns: boolean;
  readonly pierce: boolean;
  readonly poison: boolean;
  readonly bubble: boolean;
  readonly ignite: boolean;
}

export function kitTraits(def: Monster): KitTraits {
  const fx = def.ability.effects;
  const has = (k: string) => fx.some((e) => e.kind === k);
  const passive = def.passive?.kind;
  return {
    shields: has("shield") || passive === "crystalHide",
    heals: has("heal") || has("drain") || has("regen"),
    controls: fx.some((e) => e.kind === "dot" || e.kind === "freeze" || e.kind === "slow" || e.kind === "seal"),
    burns: fx.some((e) => e.kind === "dot" && e.dot === "burn") || passive === "kindling",
    pierce: fx.some((e) => e.kind === "damage" && e.pierce === true) || passive === "keenEye",
    poison: fx.some((e) => e.kind === "dot" && e.dot === "poison") || passive === "thorns",
    bubble: has("bubble") || passive === "bubbleShell",
    ignite: has("ignite"),
  };
}

/**
 * How good `candidate` is against the rival's team and with your own (for the
 * bot's draft): counters score high, being countered scores low, combos help.
 */
export function draftScore(candidate: Monster, mine: readonly Monster[], theirs: readonly Monster[]): number {
  const c = kitTraits(candidate);
  let score = 0;
  for (const m of theirs) {
    const r = kitTraits(m);
    if (c.pierce && r.shields) score += 2;
    if (c.poison && r.heals) score += 2;
    if (c.bubble && r.controls) score += 2;
    if (r.pierce && c.shields) score -= 1.5;
    if (r.poison && c.heals) score -= 1.5;
    if (r.bubble && c.controls) score -= 1.5;
  }
  for (const m of mine) {
    const p = kitTraits(m);
    if ((c.ignite && p.burns) || (c.burns && p.ignite)) score += 2;
  }
  return score;
}
