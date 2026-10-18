/**
 * Match Monsters turn engine.
 *
 * Rules (clean-room, like the real game):
 *  - Each player has one HP pool and fields two monsters. A monster has an
 *    element, a charge cost, a signature move, and sometimes a passive.
 *  - On your turn you get 2 moves. A move swaps two adjacent tiles and must
 *    create a match; a line of 4+ grants an extra move.
 *  - Matched tiles clear, the board collapses and refills (cascades). Each tile
 *    of a monster's element you matched gives it 1 charge; berries go to your
 *    stash (4 berries evolve a monster).
 *  - Every monster that reaches its charge cost fires its move — a stack of
 *    effects, usually damage plus a twist — spending the cost (and firing again
 *    if it banked enough). Element archetypes:
 *      fire   — big hits, burns, and blasts that match whole board regions
 *      water  — freeze tiles, sap rival charge, steal rival moves
 *      earth  — stone blockers, quakes, big shields and heals
 *      nature — poison, life-steal, sealing rival charge, overgrowth
 *      light  — burst, extra moves, cleansing, empowering your partner
 *  - Shields soak damage before HP. Burns/poison tick at the start of the
 *    victim's turn and ignore shields. Frozen tiles and stones can't be swapped;
 *    stones crumble when a neighbour is matched. Reduce the rival to 0 HP to win.
 */
import type {
  AbilityEvent,
  Board,
  CascadeStep,
  CastEvent,
  Effect,
  Element,
  GameState,
  MatchShape,
  Monster,
  MonsterState,
  Move,
  MoveRejection,
  MoveResult,
  NumericEventType,
  PlayerState,
  Tile,
} from "./types.js";
import {
  BERRIES_TO_EVOLVE,
  FATIGUE_AFTER,
  FATIGUE_STEP,
  MAX_EVOLUTION,
  MAX_SHIELD,
  MOVES_PER_TURN,
  STARTING_HP,
} from "./types.js";
import { Rng } from "./rng.js";
import {
  adjacentStones,
  collapseAndRefill,
  DEFAULT_BOARD,
  findMatches,
  generateBoard,
  hasAnyMove,
  hasBigMatch,
  isMovable,
  reshuffle,
  type BoardOptions,
} from "./board.js";

/** Hard cap so chained bonuses can't stack a player's turn forever. */
const MAX_MOVES = 4;
/** Evolution lowers charge cost, but never below this. */
const MIN_CHARGE_COST = 4;

export interface PlayerSetup {
  readonly peerId: string;
  readonly displayName: string;
  readonly monsters: [Monster, Monster];
}

export interface GameConfig {
  readonly matchId: string;
  readonly seed: number;
  readonly board?: BoardOptions;
  readonly players: [PlayerSetup, PlayerSetup];
  readonly firstTurn?: 0 | 1;
  readonly startingHp?: number;
}

interface Tally {
  charged: Partial<Record<Element, number>>;
  berries: number;
  bigMatch: boolean;
}

/** Everything moves touch while one swap resolves. */
interface FireContext {
  readonly by: 0 | 1;
  readonly foeIdx: 0 | 1;
  readonly attacker: PlayerState;
  readonly defender: PlayerState;
  readonly abilities: AbilityEvent[];
  readonly casts: CastEvent[];
  readonly effectSteps: CascadeStep[];
  haste: number;
  berries: number;
}

export class MatchMonstersGame {
  readonly state: GameState;
  private readonly rng: Rng;
  private readonly palette: readonly Element[];
  private readonly boardOpts: BoardOptions;

  constructor(config: GameConfig) {
    this.rng = new Rng(config.seed);
    this.boardOpts = config.board ?? DEFAULT_BOARD;
    this.palette = this.boardOpts.palette;
    const hp = config.startingHp ?? STARTING_HP;

    const board = generateBoard(this.boardOpts, this.rng);
    if (!hasAnyMove(board)) reshuffle(board, this.boardOpts, this.rng);
    const players = config.players.map((p) => toPlayerState(p, hp)) as [PlayerState, PlayerState];

    this.state = {
      matchId: config.matchId,
      board,
      ice: emptyIce(board),
      players,
      turn: config.firstTurn ?? 0,
      // Whoever opens gets a single move, offsetting the first-mover advantage.
      movesLeft: MOVES_PER_TURN - 1,
      turnPasses: 0,
      phase: "awaiting-move",
      winner: null,
      moveNumber: 0,
    };
  }

  applyMove(by: 0 | 1, move: Move): MoveResult | MoveRejection {
    const s = this.state;
    if (s.phase === "finished") return reject("game is finished");
    if (by !== s.turn) return reject("not your turn");
    if (move.type !== "swap") return reject("unsupported move type");

    const { from, to } = move;
    if (!isAdjacent(from, to)) return reject("tiles are not adjacent");
    if (!onBoard(s.board, from) || !onBoard(s.board, to)) return reject("tile out of bounds");
    for (const c of [from, to]) {
      if (s.board.grid[c.y]![c.x] === "stone") return reject("stone tiles can't be moved");
      if (!isMovable(s.board, c.x, c.y, s.ice)) return reject("that tile is frozen");
    }

    swap(s.board, from, to);
    if (findMatches(s.board).length === 0) {
      swap(s.board, from, to);
      return reject("swap does not create a match");
    }

    // Resolve the swap's cascades: these charge monsters and collect berries.
    const cascades: CascadeStep[] = [];
    const tally: Tally = { charged: {}, berries: 0, bigMatch: false };
    this.resolveCascades(cascades, tally);

    const attacker = s.players[by];
    const defender = s.players[other(by)];
    attacker.berries += tally.berries;
    feedCharge(attacker, tally.charged);

    // Fire every move that is fully charged. Loop so monsters charged by a move
    // (blasts, empower) can still fire this turn; capped for safety.
    const ctx: FireContext = {
      by,
      foeIdx: other(by),
      attacker,
      defender,
      abilities: [],
      casts: [],
      effectSteps: [],
      haste: 0,
      berries: 0,
    };
    for (let pass = 0; pass < 6 && defender.hp > 0; pass++) {
      let fired = false;
      for (const mon of attacker.monsters) {
        const cost = effectiveCost(mon.def, mon.evolution);
        while (mon.charge >= cost && defender.hp > 0) {
          mon.charge -= cost;
          this.fire(mon, ctx);
          fired = true;
        }
      }
      if (!fired) break;
    }
    attacker.berries += ctx.berries;

    // Board effects may have lined up matches; clear them (no charge).
    this.resolveCascades(ctx.effectSteps, null);

    let finished = defender.hp <= 0;
    let nextTurn: 0 | 1 = by;
    const extraTurn = !finished && tally.bigMatch;

    if (!finished) {
      const movesLeft = s.movesLeft - 1 + (extraTurn ? 1 : 0) + ctx.haste;
      if (movesLeft < 1) {
        // Turn passes: the mover's seals wear off a step, ice melts a step,
        // and the incoming player's slow and burns/poison apply.
        for (const m of attacker.monsters) if (m.sealed > 0) m.sealed -= 1;
        nextTurn = other(by);
        s.turn = nextTurn;
        const incoming = s.players[nextTurn];
        s.movesLeft = Math.max(1, MOVES_PER_TURN - incoming.slow);
        incoming.slow = 0;
        meltIce(s.ice);
        tickDots(incoming, nextTurn, ctx.abilities);
        s.turnPasses += 1;
        const fatigue = fatigueDamage(s.turnPasses);
        if (fatigue > 0) {
          incoming.hp = Math.max(0, incoming.hp - fatigue);
          ctx.abilities.push({
            monsterId: "fatigue",
            monsterName: "Sudden death",
            element: "light",
            type: "fatigue",
            amount: fatigue,
            targetPlayer: nextTurn,
          });
        }
        if (incoming.hp <= 0) finished = true; // attacker wins — rival worn down
      } else {
        s.movesLeft = Math.min(movesLeft, MAX_MOVES);
        nextTurn = by;
      }
    }

    // Never leave the player to move with no legal swap.
    let reshuffled = false;
    if (!finished && !hasAnyMove(s.board, s.ice)) {
      reshuffle(s.board, this.boardOpts, this.rng);
      s.ice = emptyIce(s.board);
      reshuffled = true;
    }

    if (finished) {
      s.phase = "finished";
      s.winner = by;
    }
    s.moveNumber += 1;

    return {
      ok: true,
      move,
      by,
      cascades,
      effectSteps: ctx.effectSteps,
      charged: tally.charged,
      abilities: ctx.abilities,
      casts: ctx.casts,
      berriesGained: tally.berries + ctx.berries,
      nextTurn,
      movesLeft: s.movesLeft,
      extraTurn,
      finished,
      winner: s.winner,
      board: cloneGrid(s.board),
      ice: s.ice.map((row) => row.slice()),
      reshuffled,
    };
  }

  /** Spend 4 berries to evolve one of a player's monsters, on that player's turn. */
  evolve(by: 0 | 1, monsterId: string): EvolveResult | MoveRejection {
    const s = this.state;
    if (s.phase === "finished") return reject("game is finished");
    if (by !== s.turn) return reject("not your turn");
    const player = s.players[by];
    if (player.berries < BERRIES_TO_EVOLVE) return reject("need 4 berries to evolve");
    const mon = player.monsters.find((m) => m.def.id === monsterId);
    if (!mon) return reject("no such monster");
    if (mon.evolution >= MAX_EVOLUTION) return reject("monster is fully evolved");
    player.berries -= BERRIES_TO_EVOLVE;
    mon.evolution += 1;
    return { ok: true, monsterId, evolution: mon.evolution, berries: player.berries };
  }

  // ------------------------------------------------------------------ internals

  /**
   * Clear matches until the board is stable. Stones next to a match crumble and
   * matching through ice breaks it. With a tally, matched tiles count toward
   * charge/berries; without one (move fallout) they're just cleared.
   */
  private resolveCascades(steps: CascadeStep[], tally: Tally | null): void {
    const s = this.state;
    for (let guard = 0; guard < 60; guard++) {
      const matches = findMatches(s.board);
      if (matches.length === 0) return;
      const countsByElement: Partial<Record<Element, number>> = {};
      if (tally) {
        if (hasBigMatch(s.board)) tally.bigMatch = true;
        for (const m of matches) {
          if (m.element === "berry") tally.berries += 1;
          else if (m.element !== "stone") {
            countsByElement[m.element] = (countsByElement[m.element] ?? 0) + 1;
            tally.charged[m.element] = (tally.charged[m.element] ?? 0) + 1;
          }
        }
      }
      const cleared = [...matches.map((m) => ({ x: m.x, y: m.y })), ...adjacentStones(s.board, matches)];
      steps.push({
        cleared: cleared.map((c) => ({ x: c.x, y: c.y, element: s.board.grid[c.y]![c.x]! })),
        countsByElement,
        board: cloneGrid(s.board),
      });
      this.breakIce(cleared);
      collapseAndRefill(s.board, cleared, this.palette, this.rng);
    }
  }

  private fire(mon: MonsterState, ctx: FireContext): void {
    const def = mon.def;
    const { attacker } = ctx;
    const berserk = def.passive?.berserk;
    const raging = berserk !== undefined && attacker.hp <= berserk.threshold;
    const effects: Effect[] = raging
      ? Array.from({ length: berserk.hits }, () => ({ kind: "damage" as const, amount: berserk.amount }))
      : scaledEffects(def, mon.evolution);

    ctx.casts.push({
      by: ctx.by,
      monsterId: def.id,
      monsterName: def.name,
      element: def.element,
      moveName: raging ? `${def.ability.name} (Berserk)` : def.ability.name,
      kinds: effects.map((e) => e.kind),
      ...(raging ? { via: "berserk" as const } : {}),
    });

    let dealtDamage = false;
    for (const e of effects) {
      if (ctx.defender.hp <= 0) break;
      if (this.applyEffect(e, mon, ctx)) dealtDamage = true;
    }

    // Partner follow-up strikes (a follow-up never triggers another).
    if (dealtDamage && ctx.defender.hp > 0) {
      for (const partner of attacker.monsters) {
        const extra = partner.def.passive?.followUp;
        if (partner === mon || !extra) continue;
        ctx.casts.push({
          by: ctx.by,
          monsterId: partner.def.id,
          monsterName: partner.def.name,
          element: partner.def.element,
          moveName: "Follow-up",
          kinds: ["damage"],
          via: "followUp",
        });
        this.hit(ctx, partner.def, extra);
      }
    }
  }

  /** Apply one effect; returns true if it damaged the rival. */
  private applyEffect(e: Effect, mon: MonsterState, ctx: FireContext): boolean {
    const def = mon.def;
    const { attacker, defender, by } = ctx;
    const b = this.state.board;
    switch (e.kind) {
      case "damage":
        return this.hit(ctx, def, e.amount);
      case "heal":
        this.heal(ctx, def, e.amount);
        return false;
      case "shield": {
        const gained = Math.min(e.amount, MAX_SHIELD - attacker.shield);
        if (gained > 0) {
          attacker.shield += gained;
          ctx.abilities.push(evt(def, "shield", gained, by));
        }
        return false;
      }
      case "drain": {
        const hit = this.hit(ctx, def, e.amount);
        this.heal(ctx, def, e.amount);
        return hit;
      }
      case "dot":
        defender.dots.push({ amount: e.amount, turns: e.turns, kind: e.dot, element: def.element });
        ctx.abilities.push(evt(def, e.dot, e.amount, ctx.foeIdx));
        return false;
      case "match":
        this.matchRegion(this.shapeCells(e.shape), ctx);
        return false;
      case "freeze": {
        const turns = e.turns + 1; // survives the pass to the rival
        const free = this.cells((x, y) => b.grid[y]![x] !== "stone" && this.state.ice[y]![x] === 0);
        for (const c of this.pick(free, e.count)) this.state.ice[c.y]![c.x] = turns;
        return false;
      }
      case "petrify": {
        const gems = this.cells((x, y) => isElement(b.grid[y]![x]!));
        for (const c of this.pick(gems, e.count)) b.grid[c.y]![c.x] = "stone";
        return false;
      }
      case "convert": {
        // Turn tiles into the caster's element, skipping any that would match
        // immediately (so the bonus tiles are there for your next move).
        const target = def.element;
        const pool = this.cells((x, y) => {
          const t = b.grid[y]![x]!;
          return isElement(t) && t !== target;
        });
        let done = 0;
        for (const c of this.pick(pool, pool.length)) {
          if (done >= e.count) break;
          const before = b.grid[c.y]![c.x]!;
          b.grid[c.y]![c.x] = target;
          if (findMatches(b).length > 0) b.grid[c.y]![c.x] = before;
          else done++;
        }
        return false;
      }
      case "sap":
        for (const m of defender.monsters) m.charge = Math.max(0, m.charge - e.count);
        return false;
      case "slow":
        defender.slow = Math.min(MOVES_PER_TURN - 1, defender.slow + e.count);
        return false;
      case "seal": {
        const target = this.pick(defender.monsters, 1)[0];
        if (target) target.sealed = Math.max(target.sealed, e.turns);
        return false;
      }
      case "haste":
        ctx.haste += e.count;
        return false;
      case "cleanse":
        attacker.dots = [];
        return false;
      case "empower":
        for (const m of attacker.monsters) if (m !== mon && m.sealed === 0) m.charge += e.count;
        return false;
    }
  }

  private hit(ctx: FireContext, def: Monster, amount: number): boolean {
    if (amount <= 0) return false;
    dealDamage(ctx.defender, amount);
    ctx.abilities.push(evt(def, "attack", amount, ctx.foeIdx));
    return true;
  }

  private heal(ctx: FireContext, def: Monster, amount: number): void {
    if (amount <= 0) return;
    ctx.attacker.hp = Math.min(ctx.attacker.maxHp, ctx.attacker.hp + amount);
    ctx.abilities.push(evt(def, "heal", amount, ctx.by));
  }

  private shapeCells(shape: MatchShape): { x: number; y: number }[] {
    const b = this.state.board;
    const cells: { x: number; y: number }[] = [];
    if (shape === "row") {
      const y = this.rng.int(b.height);
      for (let x = 0; x < b.width; x++) cells.push({ x, y });
    } else if (shape === "col") {
      const x = this.rng.int(b.width);
      for (let y = 0; y < b.height; y++) cells.push({ x, y });
    } else {
      const size = shape === "area" ? 3 : 2;
      const x0 = this.rng.int(Math.max(1, b.width - size + 1));
      const y0 = this.rng.int(Math.max(1, b.height - size + 1));
      for (let dy = 0; dy < size; dy++)
        for (let dx = 0; dx < size; dx++) cells.push({ x: x0 + dx, y: y0 + dy });
    }
    return cells.filter((c) => onBoard(b, c));
  }

  /**
   * Clear a region as if it were matched by the caster: element tiles charge the
   * caster's monsters, berries go to their stash. Recorded for animation.
   */
  private matchRegion(cells: { x: number; y: number }[], ctx: FireContext): void {
    const b = this.state.board;
    const present = cells.filter((c) => b.grid[c.y]![c.x] != null);
    if (present.length === 0) return;
    const counts: Partial<Record<Element, number>> = {};
    for (const c of present) {
      const t = b.grid[c.y]![c.x]!;
      if (t === "berry") ctx.berries += 1;
      else if (isElement(t)) counts[t] = (counts[t] ?? 0) + 1;
    }
    ctx.effectSteps.push({
      cleared: present.map((c) => ({ x: c.x, y: c.y, element: b.grid[c.y]![c.x]! })),
      countsByElement: counts,
      board: cloneGrid(b),
    });
    feedCharge(ctx.attacker, counts);
    this.breakIce(present);
    collapseAndRefill(b, present, this.palette, this.rng);
  }

  private breakIce(cells: readonly { x: number; y: number }[]): void {
    for (const c of cells) this.state.ice[c.y]![c.x] = 0;
  }

  private cells(pred: (x: number, y: number) => boolean): { x: number; y: number }[] {
    const b = this.state.board;
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) if (pred(x, y)) out.push({ x, y });
    return out;
  }

  /** Deterministically pick up to n distinct items. */
  private pick<T>(items: readonly T[], n: number): T[] {
    const pool = items.slice();
    const out: T[] = [];
    while (out.length < n && pool.length > 0) out.push(pool.splice(this.rng.int(pool.length), 1)[0]!);
    return out;
  }
}

// ---------------------------------------------------------------- evolution

/** Power after evolution: +20% (min +1) per level; 0 stays 0. */
export function scaleAmount(base: number, evolution: number): number {
  if (base <= 0) return base;
  return base + evolution * Math.max(1, Math.round(base * 0.2));
}

/** Effects after evolution: power +20%/level, tile/charge counts +1/level. */
export function scaledEffects(def: Monster, evolution: number): Effect[] {
  return def.ability.effects.map((e): Effect => {
    switch (e.kind) {
      case "damage":
      case "heal":
      case "shield":
      case "drain":
        return { ...e, amount: scaleAmount(e.amount, evolution) };
      case "dot":
        return { ...e, amount: scaleAmount(e.amount, evolution) };
      case "freeze":
      case "petrify":
      case "convert":
      case "sap":
      case "empower":
        return { ...e, count: e.count + evolution };
      default:
        return e; // match shape, slow, seal, haste, cleanse don't scale
    }
  });
}

/** Charge cost after evolution: -1 per level, never below the floor (or the base, if lower). */
export function effectiveCost(def: Monster, evolution: number): number {
  return Math.max(Math.min(def.chargeCost, MIN_CHARGE_COST), def.chargeCost - evolution);
}

/** Human-readable text for a list of effects. */
export function describeEffects(effects: readonly Effect[], element: Element): string {
  const parts = effects.map((e) => {
    switch (e.kind) {
      case "damage": return `Deal ${e.amount} damage`;
      case "heal": return `Heal ${e.amount} HP`;
      case "shield": return `Gain a ${e.amount} shield`;
      case "drain": return `Steal ${e.amount} HP`;
      case "dot": return `${e.dot === "burn" ? "Burn" : "Poison"} ${e.amount}/turn for ${e.turns} turns`;
      case "match":
        return { row: "match a random row", col: "match a random column", area: "match a 3×3 area", square: "match a 2×2 area" }[e.shape];
      case "freeze": return `freeze ${e.count} tiles`;
      case "petrify": return `turn ${e.count} tiles to stone`;
      case "convert": return `turn ${e.count} tiles into ${element}`;
      case "sap": return `drain ${e.count} charge from each rival`;
      case "slow": return `rival loses ${e.count} move${e.count === 1 ? "" : "s"} next turn`;
      case "seal": return `a rival monster can't charge for ${e.turns} turns`;
      case "haste": return `gain ${e.count} extra move${e.count === 1 ? "" : "s"}`;
      case "cleanse": return "cure burns & poison";
      case "empower": return `give ${e.count} charge to your partner`;
    }
  });
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Passive text, if any. */
export function describePassive(def: Monster): string | undefined {
  const p = def.passive;
  if (!p) return undefined;
  if (p.berserk) return `Berserk at ${p.berserk.threshold} HP or less: strike ${p.berserk.hits}× for ${p.berserk.amount}`;
  if (p.followUp) return `When its partner's move hits, follow up for ${p.followUp}`;
  return undefined;
}

/** Move as shown to players, reflecting the monster's evolution level. */
export function abilityView(def: Monster, evolution: number) {
  const effects = scaledEffects(def, evolution);
  const passive = describePassive(def);
  return {
    name: def.ability.name,
    description: describeEffects(effects, def.element),
    effects,
    ...(passive ? { passive } : {}),
  };
}

export interface EvolveResult {
  readonly ok: true;
  readonly monsterId: string;
  readonly evolution: number;
  readonly berries: number;
}

// ---------------------------------------------------------------- helpers

/** Sudden-death damage at the start of a turn, given turns passed so far. */
export function fatigueDamage(turnPasses: number): number {
  return turnPasses > FATIGUE_AFTER ? FATIGUE_STEP * (turnPasses - FATIGUE_AFTER) : 0;
}

/** Add matched-tile charge to a player's monsters (sealed monsters gain none). */
function feedCharge(player: PlayerState, counts: Partial<Record<Element, number>>): void {
  for (const mon of player.monsters) {
    const gained = counts[mon.def.element] ?? 0;
    if (gained > 0 && mon.sealed === 0) mon.charge += gained;
  }
}

function tickDots(player: PlayerState, playerIdx: 0 | 1, events: AbilityEvent[]): void {
  if (player.dots.length === 0) return;
  const remaining: typeof player.dots = [];
  for (const d of player.dots) {
    player.hp = Math.max(0, player.hp - d.amount); // DoTs ignore shields
    events.push({
      monsterId: d.kind,
      monsterName: d.kind === "poison" ? "Poison" : "Burn",
      element: d.element,
      type: d.kind === "poison" ? "poison-tick" : "burn-tick",
      amount: d.amount,
      targetPlayer: playerIdx,
    });
    if (d.turns - 1 > 0) remaining.push({ ...d, turns: d.turns - 1 });
  }
  player.dots = remaining;
}

function dealDamage(player: PlayerState, amount: number): void {
  let dmg = amount;
  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, dmg);
    player.shield -= absorbed;
    dmg -= absorbed;
  }
  player.hp = Math.max(0, player.hp - dmg);
}

function evt(def: Monster, type: NumericEventType, amount: number, targetPlayer: 0 | 1): AbilityEvent {
  return { monsterId: def.id, monsterName: def.name, element: def.element, type, amount, targetPlayer };
}

function toPlayerState(p: PlayerSetup, hp: number): PlayerState {
  return {
    peerId: p.peerId,
    displayName: p.displayName,
    hp,
    maxHp: hp,
    shield: 0,
    dots: [],
    berries: 0,
    slow: 0,
    monsters: p.monsters.map((def): MonsterState => ({ def, charge: 0, evolution: 0, sealed: 0 })),
  };
}

function isElement(t: Tile): t is Element {
  return t != null && t !== "berry" && t !== "stone";
}
function emptyIce(b: Board): number[][] {
  return Array.from({ length: b.height }, () => new Array<number>(b.width).fill(0));
}
function meltIce(ice: number[][]): void {
  for (const row of ice) for (let x = 0; x < row.length; x++) if (row[x]! > 0) row[x]! -= 1;
}
function isAdjacent(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}
function onBoard(b: Board, p: { x: number; y: number }): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;
}
function swap(b: Board, a: { x: number; y: number }, c: { x: number; y: number }): void {
  const tmp = b.grid[a.y]![a.x]!;
  b.grid[a.y]![a.x] = b.grid[c.y]![c.x]!;
  b.grid[c.y]![c.x] = tmp;
}
function cloneGrid(b: Board): Tile[][] {
  return b.grid.map((row) => row.slice());
}
function other(i: 0 | 1): 0 | 1 {
  return i === 0 ? 1 : 0;
}
function reject(reason: string): MoveRejection {
  return { ok: false, reason };
}
