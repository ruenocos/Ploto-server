/**
 * Match Monsters turn engine.
 *
 * Rules (clean-room, like the real game):
 *  - Each player has one HP pool and fields two monsters. A monster has an
 *    element, a charge cost, a signature move and a passive (one always-on rule).
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
 *      earth  — stone blockers, quakes, shields and hides that blunt big hits
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
  Cell,
  Effect,
  EffectEvent,
  EffectEventFor,
  EffectKind,
  Element,
  GameState,
  MatchShape,
  Monster,
  MonsterState,
  Move,
  MoveRejection,
  MoveResult,
  NumericEventType,
  Passive,
  PassiveKind,
  PassiveOf,
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
  moveCells,
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
      pendingFreeze: [],
      forfeitedBy: null,
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

    // Any swap is legal. One that makes no match just repositions the tiles
    // (setting up a later move) and still costs a move.
    swap(s.board, from, to);

    // Resolve the swap's cascades: these charge monsters and collect berries.
    const cascades: CascadeStep[] = [];
    const tally: Tally = { charged: {}, berries: 0, bigMatch: false };
    this.resolveCascades(cascades, tally);

    const attacker = s.players[by];
    const defender = s.players[other(by)];
    attacker.berries += tally.berries;
    feedCharge(attacker, tally.charged);
    feedBerries(attacker, tally.berries);

    // Fire the monsters that are fully charged (see below).
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
    // Each monster acts at most once per move; charge beyond that waits for your next move.
    // Loop so a monster charged by its partner's move (blasts, empower) still fires this move.
    const acted = new Set<MonsterState>();
    for (let pass = 0; pass < 2 && defender.hp > 0; pass++) {
      let fired = false;
      for (const mon of attacker.monsters) {
        if (acted.has(mon) || mon.charge < effectiveCost(mon.def, mon.evolution) || defender.hp <= 0) continue;
        mon.charge -= effectiveCost(mon.def, mon.evolution);
        acted.add(mon);
        this.fire(mon, ctx);
        fired = true;
      }
      if (!fired) break;
    }
    attacker.berries += ctx.berries;

    // Board effects may have lined up matches; clear them (no charge).
    this.resolveCascades(ctx.effectSteps, null);

    // Seals count the sealed player's own matches, every combo step included (a 2× combo takes off 2);
    // the seal still blocked all of this move's charge. A swap that matched nothing doesn't count.
    for (const m of attacker.monsters) if (m.sealed > 0) m.sealed = Math.max(0, m.sealed - cascades.length);

    let finished = defender.hp <= 0;
    let nextTurn: 0 | 1 = by;
    let iceLanded: Cell[] = [];
    const extraTurn = !finished && tally.bigMatch;

    if (!finished) {
      const movesLeft = s.movesLeft - 1 + (extraTurn ? 1 : 0) + ctx.haste;
      if (movesLeft < 1) {
        // Turn passes: ice melts a step, and the incoming player's slow and burns/poison apply.
        nextTurn = other(by);
        s.turn = nextTurn;
        const incoming = s.players[nextTurn];
        s.movesLeft = Math.max(1, MOVES_PER_TURN - incoming.slow);
        incoming.slow = 0;
        meltIce(s.ice);
        iceLanded = this.landFreezes();
        tickDots(incoming, nextTurn, ctx.abilities);
        tickRegen(incoming, nextTurn, ctx.abilities);
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
      iceLanded = [];
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
      iceLanded,
      reshuffled,
    };
  }

  /** `by` gives up: the match ends at once and the other player wins. Any time, either turn. */
  forfeit(by: 0 | 1): { ok: true; winner: 0 | 1 } | MoveRejection {
    const s = this.state;
    if (s.phase === "finished") return reject("game is finished");
    s.phase = "finished";
    s.winner = other(by);
    s.forfeitedBy = by;
    return { ok: true, winner: s.winner };
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
    // Daybreak: evolving recharges it fully.
    if (mon.def.passive?.kind === "daybreak") mon.charge = Math.max(mon.charge, effectiveCost(mon.def, mon.evolution));
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
      const before = cloneGrid(s.board);
      const clearedInfo = cleared.map((c) => ({ x: c.x, y: c.y, element: s.board.grid[c.y]![c.x]! }));
      this.breakIce(cleared);
      collapseAndRefill(s.board, cleared, this.palette, this.rng);
      steps.push({ cleared: clearedInfo, countsByElement, board: before, after: cloneGrid(s.board) });
    }
  }

  private fire(mon: MonsterState, ctx: FireContext): void {
    const def = mon.def;
    const { attacker } = ctx;
    const passive = passiveOf(mon);
    const berserk = passive?.kind === "berserk" && attacker.hp <= passive.threshold ? passive : undefined;
    let effects: Effect[] = berserk
      ? Array.from({ length: berserk.hits }, () => ({ kind: "damage" as const, amount: berserk.amount }))
      : scaledEffects(def, mon.evolution);
    // Passives that make the move hit harder (Overheat, Rockslide, Feeds on pain) add to its first hit.
    const bonus = this.moveBonus(mon, ctx);
    const first = effects.findIndex((e) => e.kind === "damage" || e.kind === "drain");
    if (bonus > 0 && first >= 0) {
      effects = effects.map((e, i) => (i === first && (e.kind === "damage" || e.kind === "drain") ? { ...e, amount: e.amount + bonus } : e));
    }

    const cast: CastEvent = {
      by: ctx.by,
      monsterId: def.id,
      monsterName: def.name,
      element: def.element,
      moveName: berserk ? `${def.ability.name} (Berserk)` : def.ability.name,
      kinds: effects.map((e) => e.kind),
      ...(berserk ? { via: "berserk" as const } : {}),
      effects: [],
    };
    ctx.casts.push(cast);

    let dealtDamage = false;
    for (const e of effects) {
      if (ctx.defender.hp <= 0) break;
      const event = this.applyEffect(e, mon, ctx);
      cast.effects.push(event);
      if ((event.kind === "damage" || event.kind === "drain") && event.amount > 0) dealtDamage = true;
    }
    if (ctx.defender.hp > 0) this.afterMove(mon, ctx, dealtDamage);
  }

  /** Extra damage a monster's own passive adds to its move (spending Overheat's extra charge). */
  private moveBonus(mon: MonsterState, ctx: FireContext): number {
    const p = passiveOf(mon);
    switch (p?.kind) {
      case "overheat": {
        const extra = mon.charge; // the cost is already paid: what's left is extra
        mon.charge = 0;
        return extra * p.amount;
      }
      case "rockslide":
        return p.amount * this.cells((x, y) => this.state.board.grid[y]![x] === "stone").length;
      case "feedsOnPain":
        return p.amount * ctx.defender.dots.reduce((sum, d) => sum + d.turns, 0);
      default:
        return 0;
    }
  }

  /**
   * Passives that answer a move: the partner's (follow-up, Kindling, Mycelium) and the
   * rival's (Crystal hide, Thorns, Lurk). They react to moves only, never to each other,
   * so nothing here can chain.
   */
  private afterMove(mon: MonsterState, ctx: FireContext, hit: boolean): void {
    const { attacker, defender, by, foeIdx } = ctx;
    for (const partner of attacker.monsters) {
      const p = passiveOf(partner);
      if (partner === mon || !p || defender.hp <= 0) continue;
      if (hit && p.kind === "followUp") {
        const pierce = pierces(attacker);
        const amount = this.hit(ctx, partner.def, p.amount);
        if (amount <= 0) continue;
        ctx.casts.push({
          by,
          monsterId: partner.def.id,
          monsterName: partner.def.name,
          element: partner.def.element,
          moveName: "Follow-up",
          kinds: ["damage"],
          via: "followUp",
          effects: [{ kind: "damage", target: foeIdx, amount, ...(pierce ? { pierce: true } : {}) }],
        });
      } else if (hit && p.kind === "kindling") {
        this.passive(ctx, by, partner, () => this.applyDot(ctx, attacker, defender, foeIdx, partner.def, "burn", p.amount, p.turns));
      } else if (p.kind === "mycelium") {
        this.passive(ctx, by, partner, () => gainCharge(partner, by, p.count));
      }
    }
    for (const foe of defender.monsters) {
      const p = passiveOf(foe);
      if (hit && p?.kind === "crystalHide") {
        this.passive(ctx, foeIdx, foe, () => this.gainShield(ctx, defender, foeIdx, foe.def, p.amount));
      } else if (hit && p?.kind === "thorns") {
        this.passive(ctx, foeIdx, foe, () => this.applyDot(ctx, defender, attacker, by, foe.def, "poison", p.amount, p.turns));
      } else if (p?.kind === "lurk") {
        this.passive(ctx, foeIdx, foe, () => gainCharge(foe, foeIdx, p.count));
      }
    }
  }

  /**
   * A passive going off: reported as its own cast (`via: "passive"`, named after the passive)
   * with the one effect it had, so clients animate it like any move. The cast is listed before
   * `run` resolves, so anything `run` sets off in turn (a Bubble shell) comes after it.
   */
  private passive(ctx: FireContext, seat: 0 | 1, mon: MonsterState, run: () => EffectEvent | null): void {
    const p = passiveOf(mon);
    if (!p) return;
    const cast: CastEvent = {
      by: seat,
      monsterId: mon.def.id,
      monsterName: mon.def.name,
      element: mon.def.element,
      moveName: PASSIVE_NAME[p.kind],
      kinds: [],
      via: "passive",
      effects: [],
    };
    ctx.casts.push(cast);
    const event = run();
    if (!event) {
      ctx.casts.splice(ctx.casts.indexOf(cast), 1);
      return;
    }
    cast.effects.push(event);
    cast.kinds.push(event.kind);
  }

  /** Burn or poison `victim` (seat `victimIdx`) on behalf of `team`; a bubble blocks it. */
  private applyDot(
    ctx: FireContext, team: PlayerState, victim: PlayerState, victimIdx: 0 | 1, def: Monster,
    dot: "burn" | "poison", amount: number, baseTurns: number,
  ): EffectEventFor<"dot"> {
    // Afterburn (Emberwing): burns from this team last longer.
    const extra = dot === "burn" ? Math.max(0, ...teamPassive(team, "afterburn").map(({ p }) => p.turns)) : 0;
    const turns = baseTurns + extra;
    const ev = { kind: "dot" as const, target: victimIdx, dot, amount, turns };
    if (popBubble(victim)) return { ...ev, blocked: true };
    victim.dots.push({ amount, turns, kind: dot, element: def.element });
    ctx.abilities.push(evt(def, dot, amount, victimIdx));
    this.landed(ctx, victim, victimIdx);
    return ev;
  }

  /** A harmful effect got through to `victim`: Bubble shell blows a fresh bubble if they have none. */
  private landed(ctx: FireContext, victim: PlayerState, victimIdx: 0 | 1): void {
    if (victim.bubble > 0) return;
    const shell = teamPassive(victim, "bubbleShell")[0];
    if (!shell) return;
    this.passive(ctx, victimIdx, shell.mon, () => {
      victim.bubble = Math.min(MAX_BUBBLES, shell.p.count);
      return { kind: "bubble", target: victimIdx, count: victim.bubble };
    });
  }

  private gainShield(ctx: FireContext, player: PlayerState, idx: 0 | 1, def: Monster, amount: number): EffectEventFor<"shield"> {
    const gained = Math.max(0, Math.min(amount, MAX_SHIELD - player.shield));
    if (gained > 0) {
      player.shield += gained;
      ctx.abilities.push(evt(def, "shield", gained, idx));
    }
    return { kind: "shield", target: idx, amount: gained };
  }

  /**
   * Apply one effect and report what it did. The switch is exhaustive and must
   * return an event for every kind, so new effects can't skip their animation.
   */
  private applyEffect(e: Effect, mon: MonsterState, ctx: FireContext): EffectEvent {
    const def = mon.def;
    const { attacker, defender, by, foeIdx } = ctx;
    const b = this.state.board;
    switch (e.kind) {
      case "damage": {
        const amount = e.fromShield ? Math.max(e.amount, Math.floor(attacker.shield * e.fromShield)) : e.amount;
        const pierce = e.pierce || pierces(attacker);
        const dealt = this.hit(ctx, def, amount, pierce);
        return { kind: "damage", target: foeIdx, amount: dealt, ...(pierce ? { pierce: true } : {}) };
      }
      case "heal":
        return { kind: "heal", target: by, amount: this.heal(ctx, def, e.amount) };
      case "shield":
        return this.gainShield(ctx, attacker, by, def, e.amount);
      case "drain": {
        // It can feed on what's eating the rival: more for every burn or poison turn left.
        const dotTurns = defender.dots.reduce((sum, d) => sum + d.turns, 0);
        const amount = this.hit(ctx, def, e.amount + (e.perDotTurn ?? 0) * dotTurns);
        const healed = this.heal(ctx, def, amount);
        return { kind: "drain", target: foeIdx, amount, healed };
      }
      case "dot":
        return this.applyDot(ctx, attacker, defender, foeIdx, def, e.dot, e.amount, e.turns);
      case "ignite": {
        // Every burn on the rival goes off now for all the ticks it had left.
        const burns = defender.dots.filter((d) => d.kind === "burn");
        const total = burns.reduce((sum, d) => sum + d.amount * d.turns, 0);
        defender.dots = defender.dots.filter((d) => d.kind !== "burn");
        const amount = this.hit(ctx, def, total, true); // burns ignore shields
        return { kind: "ignite", target: foeIdx, amount, burns: burns.length };
      }
      case "regen":
        attacker.regen.push({ amount: e.amount, turns: e.turns });
        return { kind: "regen", target: by, amount: e.amount, turns: e.turns };
      case "bubble":
        attacker.bubble = Math.min(MAX_BUBBLES, attacker.bubble + e.count);
        return { kind: "bubble", target: by, count: attacker.bubble };
      case "match": {
        const cells = this.shapeCells(e.shape, e.size ?? defaultShapeSize(e.shape));
        // Stones in the blast shatter into the rival (the effect's own shatter, or the team's Fault line).
        const per = Math.max(e.shatter ?? 0, ...teamPassive(attacker, "faultLine").map(({ p }) => p.amount));
        const stones = per > 0 ? cells.filter((c) => b.grid[c.y]![c.x] === "stone").length : 0;
        const step = this.matchRegion(cells, ctx);
        if (!stones) return { kind: "match", shape: e.shape, cells, step };
        const amount = this.hit(ctx, def, stones * per);
        return { kind: "match", shape: e.shape, cells, step, shatter: { target: foeIdx, stones, amount } };
      }
      case "freeze":
        if (popBubble(defender)) return { kind: "freeze", target: foeIdx, count: e.count, turns: e.turns, blocked: true };
        // Lands when the turn passes, so it never blocks the caster's own moves.
        this.state.pendingFreeze.push({ count: e.count, turns: e.turns });
        this.landed(ctx, defender, foeIdx);
        return { kind: "freeze", target: foeIdx, count: e.count, turns: e.turns };
      case "petrify": {
        // Stone the rival's element tiles (live moves first) to starve their charge.
        const mine = new Set(attacker.monsters.map((m) => m.def.element));
        const theirs = new Set(defender.monsters.map((m) => m.def.element));
        const gem = (x: number, y: number) => b.grid[y]![x]!;
        const picks = this.pickTargets(e.count, [
          (x, y) => theirs.has(gem(x, y) as Element) && !mine.has(gem(x, y) as Element),
          (x, y) => isElement(gem(x, y)) && !mine.has(gem(x, y) as Element),
          (x, y) => isElement(gem(x, y)),
        ]);
        for (const c of picks) b.grid[c.y]![c.x] = "stone";
        return { kind: "petrify", cells: picks };
      }
      case "convert": {
        // Turn tiles into the caster's element (or its partner's), skipping any
        // that would match immediately (so the bonus tiles are there for your next move).
        const partner = attacker.monsters.find((m) => m !== mon);
        const target = e.partner && partner ? partner.def.element : def.element;
        const pool = this.cells((x, y) => {
          const t = b.grid[y]![x]!;
          return isElement(t) && t !== target;
        });
        const converted: Cell[] = [];
        for (const c of this.pick(pool, pool.length)) {
          if (converted.length >= e.count) break;
          const before = b.grid[c.y]![c.x]!;
          b.grid[c.y]![c.x] = target;
          if (findMatches(b).length > 0) b.grid[c.y]![c.x] = before;
          else converted.push(c);
        }
        return { kind: "convert", cells: converted, element: target };
      }
      case "grow": {
        // Berries on random tiles, skipping any that would match at once (they wait for a move)
        // and any next to a berry already there, so a bloom scatters berries instead of building
        // lines out of them. The board is shared: whoever matches them first gets them.
        const berryNear = (x: number, y: number) =>
          [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.grid[y + dy!]?.[x + dx!] === "berry");
        const pool = this.cells((x, y) => isElement(b.grid[y]![x]!) && !berryNear(x, y));
        const grown: Cell[] = [];
        for (const c of this.pick(pool, pool.length)) {
          if (grown.length >= e.count) break;
          const before = b.grid[c.y]![c.x]!;
          b.grid[c.y]![c.x] = "berry";
          if (findMatches(b).length > 0) b.grid[c.y]![c.x] = before;
          else grown.push(c);
        }
        return { kind: "grow", cells: grown };
      }
      case "pluck": {
        const taken = Math.min(defender.berries, e.count);
        defender.berries -= taken;
        ctx.berries += taken;
        return { kind: "pluck", target: foeIdx, count: taken };
      }
      case "sap": {
        const drained: Record<string, number> = {};
        let total = 0;
        for (const m of defender.monsters) {
          const lost = Math.min(m.charge, e.count);
          m.charge -= lost;
          total += lost;
          if (lost > 0) drained[m.def.id] = lost;
        }
        // Undercurrent (Tidecoil): what it drains flows into its partner.
        const partner = attacker.monsters.find((m) => m !== mon);
        if (passiveOf(mon)?.kind === "undercurrent" && partner && total > 0) {
          this.passive(ctx, by, mon, () => {
            if (partner.sealed > 0) return null;
            partner.charge += total;
            return { kind: "empower", monsterIds: [partner.def.id], count: total };
          });
        }
        return { kind: "sap", target: foeIdx, drained };
      }
      case "slow": {
        if (popBubble(defender)) return { kind: "slow", target: foeIdx, count: 0, blocked: true };
        const before = defender.slow;
        defender.slow = Math.min(MOVES_PER_TURN - 1, defender.slow + e.count);
        this.landed(ctx, defender, foeIdx);
        return { kind: "slow", target: foeIdx, count: defender.slow - before };
      }
      case "seal": {
        if (popBubble(defender)) return { kind: "seal", target: foeIdx, monsterId: null, matches: e.matches, blocked: true };
        // The rival monster closest to firing (most charge; a coin flip on ties), skipping one that's
        // already sealed: it can't charge anyway, so it would stay on top and soak up every seal.
        // Only when both are sealed does it top one up.
        const open = defender.monsters.filter((m) => m.sealed === 0);
        const pool = open.length ? open : defender.monsters;
        const most = Math.max(...pool.map((m) => m.charge));
        const target = this.pick(pool.filter((m) => m.charge === most), 1)[0];
        if (target) target.sealed = Math.max(target.sealed, e.matches);
        this.landed(ctx, defender, foeIdx);
        return { kind: "seal", target: foeIdx, monsterId: target?.def.id ?? null, matches: e.matches };
      }
      case "haste":
        ctx.haste += e.count;
        return { kind: "haste", count: e.count };
      case "cleanse": {
        const removed = attacker.dots.length;
        attacker.dots = [];
        return { kind: "cleanse", removed };
      }
      case "empower": {
        const boosted: string[] = [];
        for (const m of attacker.monsters) {
          if (m !== mon && m.sealed === 0) {
            m.charge += e.count;
            boosted.push(m.def.id);
          }
        }
        return { kind: "empower", monsterIds: boosted, count: e.count };
      }
      case "charge":
        return gainCharge(mon, by, e.count) ?? { kind: "charge", target: by, monsterId: def.id, count: 0 };
    }
  }

  /**
   * Strike the rival; returns the damage that landed (after the rival's Frost armor and
   * Bedrock). Keen eye on the attacking team makes every hit pierce shields.
   */
  private hit(ctx: FireContext, def: Monster, amount: number, pierce = false): number {
    if (amount <= 0) return 0;
    let dealt = amount;
    const armor = Math.max(0, ...teamPassive(ctx.defender, "frostArmor").map(({ p }) => p.amount));
    if (armor > 0 && this.state.ice.some((row) => row.some((v) => v > 0))) dealt -= armor;
    for (const { p } of teamPassive(ctx.defender, "bedrock")) dealt = Math.min(dealt, p.cap);
    if (dealt <= 0) return 0;
    dealDamage(ctx.defender, dealt, pierce || pierces(ctx.attacker));
    ctx.abilities.push(evt(def, "attack", dealt, ctx.foeIdx));
    return dealt;
  }

  /** Heal the caster; poison halves it. Returns what was actually healed. */
  private heal(ctx: FireContext, def: Monster, amount: number): number {
    const healed = healAmount(ctx.attacker, amount);
    if (healed <= 0) return 0;
    ctx.attacker.hp = Math.min(ctx.attacker.maxHp, ctx.attacker.hp + healed);
    ctx.abilities.push(evt(def, "heal", healed, ctx.by));
    return healed;
  }

  private shapeCells(shape: MatchShape, size: number): { x: number; y: number }[] {
    const b = this.state.board;
    const cells: { x: number; y: number }[] = [];
    if (shape === "row" || shape === "col") {
      // `size` different lines, each chosen at random (not a band of neighbours),
      // so every row/column is equally likely to be hit, edges included.
      const lines = this.pickDistinct(shape === "row" ? b.height : b.width, size);
      for (const i of lines) {
        if (shape === "row") for (let x = 0; x < b.width; x++) cells.push({ x, y: i });
        else for (let y = 0; y < b.height; y++) cells.push({ x: i, y });
      }
    } else {
      const x0 = this.rng.int(Math.max(1, b.width - size + 1));
      const y0 = this.rng.int(Math.max(1, b.height - size + 1));
      for (let dy = 0; dy < size; dy++)
        for (let dx = 0; dx < size; dx++) cells.push({ x: x0 + dx, y: y0 + dy });
    }
    return cells.filter((c) => onBoard(b, c));
  }

  /** `n` different integers from [0, count), uniformly at random (partial Fisher–Yates). */
  private pickDistinct(count: number, n: number): number[] {
    const pool = Array.from({ length: count }, (_, i) => i);
    const k = Math.min(n, count);
    for (let i = 0; i < k; i++) {
      const j = i + this.rng.int(count - i);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, k).sort((a, b) => a - b);
  }

  /**
   * Clear a region as if it were matched by the caster: element tiles charge the
   * caster's monsters, berries go to their stash. Recorded for animation.
   */
  private matchRegion(cells: { x: number; y: number }[], ctx: FireContext): number {
    const b = this.state.board;
    const present = cells.filter((c) => b.grid[c.y]![c.x] != null);
    if (present.length === 0) return -1;
    const counts: Partial<Record<Element, number>> = {};
    let berries = 0;
    for (const c of present) {
      const t = b.grid[c.y]![c.x]!;
      if (t === "berry") berries += 1;
      else if (isElement(t)) counts[t] = (counts[t] ?? 0) + 1;
    }
    const before = cloneGrid(b);
    const clearedInfo = present.map((c) => ({ x: c.x, y: c.y, element: b.grid[c.y]![c.x]! }));
    ctx.berries += berries;
    feedCharge(ctx.attacker, counts);
    feedBerries(ctx.attacker, berries);
    this.breakIce(present);
    collapseAndRefill(b, present, this.palette, this.rng);
    ctx.effectSteps.push({ cleared: clearedInfo, countsByElement: counts, board: before, after: cloneGrid(b) });
    return ctx.effectSteps.length - 1;
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

  /** Ice the incoming player's best tiles with every freeze cast last turn. */
  private landFreezes(): Cell[] {
    const s = this.state;
    const landed: Cell[] = [];
    for (const f of s.pendingFreeze) {
      const free = (x: number, y: number) => s.board.grid[y]![x] !== "stone" && s.ice[y]![x] === 0;
      // Walk every free cell, live ones first, until `count` are iced — skipping
      // any that would leave the rival no legal swap (that would reshuffle the ice away).
      let placed = 0;
      for (const c of this.pickTargets(Infinity, [free])) {
        if (placed >= f.count) break;
        s.ice[c.y]![c.x] = f.turns;
        if (hasAnyMove(s.board, s.ice)) {
          placed++;
          landed.push(c);
        } else s.ice[c.y]![c.x] = 0;
      }
    }
    s.pendingFreeze = [];
    return landed;
  }

  /**
   * Pick up to n distinct cells. Tiers are tried in order, and within each tier
   * cells that are part of a legal swap right now (the tiles a player would
   * reach for) come first.
   */
  private pickTargets(n: number, tiers: ((x: number, y: number) => boolean)[]): { x: number; y: number }[] {
    const w = this.state.board.width;
    const hot = moveCells(this.state.board, this.state.ice);
    const taken = new Set<number>();
    const out: { x: number; y: number }[] = [];
    for (const ok of tiers) {
      for (const live of [true, false]) {
        if (out.length >= n) return out;
        const pool = this.cells((x, y) => !taken.has(y * w + x) && ok(x, y) && hot.has(y * w + x) === live);
        for (const c of this.pick(pool, n - out.length)) {
          taken.add(c.y * w + c.x);
          out.push(c);
        }
      }
    }
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
//
// Monsters have three stages (base, ★, ★★). Every evolution makes the whole move
// better: numbers grow +25% (min +1), tile and charge counts +1, the charge cost
// drops by 1, and passives grow too. The "special" parts step up as well — ★
// widens blasts and lengthens seals and burns/poison; ★★ adds an extra haste
// move and longer ice.

/** Power after evolution: +25% (min +1) per level; 0 stays 0. */
export function scaleAmount(base: number, evolution: number): number {
  if (base <= 0) return base;
  return base + evolution * Math.max(1, Math.round(base * 0.25));
}

const atLeast = (evolution: number, level: number): number => (evolution >= level ? 1 : 0);

/** Default region size for a match shape (lines for row/col, side for areas). */
export function defaultShapeSize(shape: MatchShape): number {
  return shape === "area" ? 3 : shape === "square" ? 2 : 1;
}

/** Effects after evolution (see the section comment for the rules). */
export function scaledEffects(def: Monster, evolution: number): Effect[] {
  return def.ability.effects.map((e): Effect => {
    switch (e.kind) {
      case "damage":
      case "heal":
      case "shield":
      case "drain":
        return { ...e, amount: scaleAmount(e.amount, evolution) };
      case "dot":
      case "regen":
        return { ...e, amount: scaleAmount(e.amount, evolution), turns: e.turns + atLeast(evolution, 1) };
      case "bubble":
        return { ...e, count: e.count + atLeast(evolution, 2) };
      case "match":
        return { ...e, size: (e.size ?? defaultShapeSize(e.shape)) + atLeast(evolution, 1) };
      case "freeze":
        return { ...e, count: e.count + evolution, turns: e.turns + atLeast(evolution, 2) };
      case "petrify":
      case "convert":
      case "grow":
      case "sap":
      case "empower":
      case "charge":
        return { ...e, count: e.count + evolution };
      case "pluck":
        return { ...e, count: e.count + atLeast(evolution, 2) };
      case "seal":
        return { ...e, matches: e.matches + evolution };
      case "haste":
        return { ...e, count: e.count + atLeast(evolution, 2) };
      default:
        return e; // slow is capped at one move; cleanse and ignite are all-or-nothing
    }
  });
}

/**
 * Passives after evolution, by the same rules as moves: numbers +25% (min +1), charge
 * counts +1 per level, burns/poison a turn longer at ★★, berserk kicks in sooner, Bedrock's
 * cap drops 2 per level, and a second Bubble shell bubble at ★★★.
 */
export function scaledPassive(def: Monster, evolution: number): Passive | undefined {
  const p = def.passive;
  if (!p) return undefined;
  switch (p.kind) {
    case "berserk":
      return { ...p, threshold: p.threshold + 6 * evolution, amount: scaleAmount(p.amount, evolution) };
    case "followUp":
    case "overheat":
    case "frostArmor":
    case "rockslide":
    case "faultLine":
    case "crystalHide":
    case "feedsOnPain":
      return { ...p, amount: scaleAmount(p.amount, evolution) };
    case "kindling":
    case "thorns":
      return { ...p, amount: scaleAmount(p.amount, evolution), turns: p.turns + atLeast(evolution, 1) };
    case "afterburn":
      return { ...p, turns: p.turns + atLeast(evolution, 2) };
    case "lurk":
    case "mycelium":
      return { ...p, count: p.count + atLeast(evolution, 2) };
    case "bubbleShell":
      return { ...p, count: p.count + atLeast(evolution, 2) };
    case "bedrock":
      return { ...p, cap: p.cap - 2 * evolution };
    case "sweetTooth": // never grows: berries already pile up as Harvest Bloom grows more
    case "undercurrent":
    case "keenEye":
    case "daybreak":
    case "glow": // the regen that feeds it already lasts longer
      return p;
  }
}

/** Passive names, as shown to players (and as the move name when a passive goes off). */
export const PASSIVE_NAME: Record<Passive["kind"], string> = {
  berserk: "Berserk", followUp: "Follow-up", afterburn: "Afterburn", sweetTooth: "Sweet tooth",
  kindling: "Kindling", overheat: "Overheat", lurk: "Lurk", undercurrent: "Undercurrent",
  frostArmor: "Frost armor", bubbleShell: "Bubble shell", bedrock: "Bedrock", rockslide: "Rockslide",
  faultLine: "Fault line", crystalHide: "Crystal hide", thorns: "Thorns", feedsOnPain: "Feeds on pain",
  mycelium: "Mycelium", keenEye: "Keen eye", daybreak: "Daybreak", glow: "Glow",
};

/** Charge cost after evolution: -1 per level, never below the floor (or the base, if lower). */
export function effectiveCost(def: Monster, evolution: number): number {
  return Math.max(Math.min(def.chargeCost, MIN_CHARGE_COST), def.chargeCost - evolution);
}

function describeShape(shape: MatchShape, size: number): string {
  // "Clear", not "match": players match gems themselves; a blast clears them for you.
  const what = shape === "row" ? (size === 1 ? "a random row" : `${size} random rows`)
    : shape === "col" ? (size === 1 ? "a random column" : `${size} random columns`)
    : `a ${size}×${size} area`;
  return `clear ${what}`;
}

/** Human-readable text for a list of effects. */
export function describeEffects(effects: readonly Effect[], element: Element): string {
  const parts = effects.map((e) => {
    switch (e.kind) {
      case "damage": return e.fromShield
        ? `hit for ${e.fromShield === 0.5 ? "half" : `${Math.round(e.fromShield * 100)}% of`} your shield (at least ${e.amount})`
        : `deal ${e.amount} ${e.pierce ? "piercing damage (ignores shields)" : "damage"}`;
      case "heal": return `heal ${e.amount} HP`;
      case "shield": return `gain ${e.amount} shield`;
      case "drain": return `steal ${e.amount} HP` + (e.perDotTurn ? `, +${e.perDotTurn} for each turn of burn or poison left on the rival` : "");
      case "dot": return `${e.dot} the rival for ${e.amount} damage/turn over ${e.turns} turns` + (e.dot === "poison" ? " (halves their healing)" : "");
      case "ignite": return "detonate the rival's burns for all their remaining damage";
      case "regen": return `regenerate ${e.amount} HP/turn for ${e.turns} turns`;
      case "bubble": return e.count === 1 ? "block the next harmful effect on you" : `block the next ${e.count} harmful effects on you`;
      case "match": return describeShape(e.shape, e.size ?? defaultShapeSize(e.shape)) + (e.shatter ? `; stones in it shatter for ${e.shatter} damage each` : "");
      case "freeze": return `freeze ${e.count} tiles for the rival's ` + (e.turns > 1 ? `next ${e.turns} turns` : "turn");
      case "petrify": return `turn ${e.count} tiles to stone`;
      case "convert": return e.partner ? `turn ${e.count} tiles into your partner's element` : `turn ${e.count} tiles into ${element}`;
      case "sap": return `drain ${e.count} charge from each rival monster`;
      case "grow": return `grow ${e.count} ${e.count === 1 ? "berry" : "berries"} on the board`;
      case "pluck": return `steal ${e.count} ${e.count === 1 ? "berry" : "berries"} from the rival`;
      case "slow": return `the rival loses ${e.count} move${e.count === 1 ? "" : "s"} next turn`;
      case "seal": return `seal the rival monster closest to firing that isn't sealed yet: it can't charge for their next ${e.matches} matches`;
      case "haste": return `gain ${e.count} extra move${e.count === 1 ? "" : "s"}`;
      case "cleanse": return "cure burns and poison";
      case "empower": return `give ${e.count} charge to your partner`;
      case "charge": return `gain ${e.count} charge`;
    }
  });
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const turnsText = (n: number) => `${n} turn${n === 1 ? "" : "s"}`;

/** A passive's rule in one line (without its name). */
function passiveRule(p: Passive): string {
  switch (p.kind) {
    case "berserk": return `at ${p.threshold} HP or less, its move becomes ${p.hits} strikes of ${p.amount}`;
    case "followUp": return `when its partner's move hits, it follows up for ${p.amount}`;
    case "afterburn": return `your team's burns last ${turnsText(p.turns)} longer`;
    case "sweetTooth": return `every berry your team collects gives it ${p.amount} charge (up to full)`;
    case "kindling": return `when its partner's move hits, the rival catches a burn (${p.amount} damage/turn for ${turnsText(p.turns)})`;
    case "overheat": return `when it fires, any charge it has beyond full is spent too, for +${p.amount} damage each`;
    case "lurk": return `whenever a rival monster fires, it gains ${p.count} charge`;
    case "undercurrent": return "the charge its move drains flows into its partner";
    case "frostArmor": return `while any tile is frozen, rival hits on your team deal ${p.amount} less damage`;
    case "bubbleShell": return `when a harmful effect lands on your team, it blows ${p.count === 1 ? "a bubble that blocks the next one" : `${p.count} bubbles that block the next ${p.count}`}`;
    case "bedrock": return `no single rival hit deals more than ${p.cap} damage to your team`;
    case "rockslide": return `its move deals +${p.amount} damage for every stone on the board`;
    case "faultLine": return `stones caught in your team's blasts shatter into the rival for ${p.amount} damage each`;
    case "crystalHide": return `when a rival move hits your team, gain ${p.amount} shield`;
    case "thorns": return `when a rival move hits your team, poison the rival (${p.amount} damage/turn for ${turnsText(p.turns)})`;
    case "feedsOnPain": return `its move steals +${p.amount} HP for every turn of burn or poison left on the rival`;
    case "mycelium": return `whenever its partner fires, it gains ${p.count} charge`;
    case "keenEye": return "your team's hits ignore shields";
    case "daybreak": return "starts the match fully charged, and charges up fully whenever it evolves";
    case "glow": return `each turn your team's regen ticks, it gains ${p.count} charge`;
  }
}

/** Passive text ("Name: rule"), if any. */
export function describePassive(def: Monster, evolution = 0): string | undefined {
  const p = scaledPassive(def, evolution);
  return p ? `${PASSIVE_NAME[p.kind]}: ${passiveRule(p)}` : undefined;
}

/** "Before → after" lines for what an evolution changes in a passive. */
function passiveChanges(a: Passive, b: Passive): string[] {
  if (a.kind !== b.kind) return [];
  const name = PASSIVE_NAME[a.kind];
  const before = a as unknown as Record<string, unknown>, after = b as unknown as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(before)) {
    const x = before[key], y = after[key];
    if (typeof x !== "number" || typeof y !== "number" || x === y) continue;
    if (a.kind === "berserk") out.push(key === "threshold" ? `Berserk at ${x} → ${y} HP` : `Berserk strikes ${x} → ${y}`);
    else if (key === "turns") out.push(a.kind === "afterburn" ? `Afterburn ${x} → ${y} turns` : `${name} lasts ${x} → ${y} turns`);
    else if (key === "cap") out.push(`${name} cap ${x} → ${y}`);
    else if (a.kind === "bubbleShell") out.push(`${name} ${x} → ${y} bubbles`);
    else if (key === "count" || a.kind === "sweetTooth") out.push(`${name} ${x} → ${y} charge`);
    else out.push(`${name} ${x} → ${y}`);
  }
  return out;
}

const EFFECT_LABEL: Record<EffectKind, string> = {
  damage: "Damage", heal: "Heal", shield: "Shield", drain: "Life steal", dot: "", match: "Blast",
  freeze: "Frozen tiles", petrify: "Stone tiles", convert: "Converted tiles", grow: "Berries grown", pluck: "Berries stolen", sap: "Charge drained",
  slow: "Moves stolen", seal: "Seal", haste: "Extra moves", cleanse: "Cleanse", empower: "Partner charge",
  ignite: "Ignite", regen: "Regen", bubble: "Bubbles", charge: "Charge",
};

/**
 * What the next evolution changes, as short "before → after" lines for the
 * monster sheet, e.g. ["Damage 12 → 14", "Charge cost 8 → 7"]. Empty when maxed.
 */
export function evolutionChanges(def: Monster, evolution: number): string[] {
  if (evolution >= MAX_EVOLUTION) return [];
  const now = scaledEffects(def, evolution);
  const next = scaledEffects(def, evolution + 1);
  const out: string[] = [];
  now.forEach((a, i) => {
    const b = next[i]!;
    const label = EFFECT_LABEL[a.kind];
    if ((a.kind === "dot" && b.kind === "dot") || (a.kind === "regen" && b.kind === "regen")) {
      const name = a.kind === "regen" ? "Regen" : a.dot === "burn" ? "Burn" : "Poison";
      if (a.amount !== b.amount) out.push(`${name} ${a.amount} → ${b.amount}/turn`);
      if (a.turns !== b.turns) out.push(`${name} lasts ${a.turns} → ${b.turns} turns`);
    } else if (a.kind === "match" && b.kind === "match") {
      const sa = a.size ?? defaultShapeSize(a.shape), sb = b.size ?? defaultShapeSize(b.shape);
      if (sa !== sb) {
        const unit = a.shape === "row" ? " rows" : a.shape === "col" ? " columns" : "";
        out.push(unit ? `Blast ${sa} → ${sb}${unit}` : `Blast ${sa}×${sa} → ${sb}×${sb}`);
      }
    } else if (a.kind === "freeze" && b.kind === "freeze") {
      if (a.count !== b.count) out.push(`${label} ${a.count} → ${b.count}`);
      if (a.turns !== b.turns) out.push(`Ice lasts ${a.turns} → ${b.turns} turns`);
    } else if (a.kind === "seal" && b.kind === "seal") {
      if (a.matches !== b.matches) out.push(`${label} ${a.matches} → ${b.matches} matches`);
    } else if ("amount" in a && "amount" in b && a.amount !== b.amount) {
      const name = a.kind === "damage" && a.fromShield ? "Minimum hit" : label;
      out.push(`${name} ${a.amount} → ${b.amount}`);
    } else if ("count" in a && "count" in b && a.count !== b.count) {
      out.push(`${label} ${a.count} → ${b.count}`);
    }
  });
  const pa = scaledPassive(def, evolution), pb = scaledPassive(def, evolution + 1);
  if (pa && pb) out.push(...passiveChanges(pa, pb));
  const ca = effectiveCost(def, evolution), cb = effectiveCost(def, evolution + 1);
  if (ca !== cb) out.push(`Charge cost ${ca} → ${cb}`);
  return out;
}

/** Move as shown to players, reflecting the monster's evolution level. */
export function abilityView(def: Monster, evolution: number) {
  const effects = scaledEffects(def, evolution);
  const passive = describePassive(def, evolution);
  return {
    name: def.ability.name,
    description: describeEffects(effects, def.element),
    effects,
    ...(passive ? { passive } : {}),
    /** What the next evolution changes (empty when fully evolved). */
    nextEvolution: evolutionChanges(def, evolution),
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

/**
 * Berries a player collected from the board: Sweet tooth monsters charge on them (stolen ones
 * don't count), but only up to full, so a berry-heavy board can't bank casts for move after move.
 */
function feedBerries(player: PlayerState, berries: number): void {
  if (berries <= 0) return;
  for (const { mon, p } of teamPassive(player, "sweetTooth")) {
    if (p.amount <= 0 || mon.sealed > 0) continue;
    const full = effectiveCost(mon.def, mon.evolution);
    mon.charge = Math.max(mon.charge, Math.min(full, mon.charge + p.amount * berries));
  }
}

/** A monster's passive at its current evolution. */
function passiveOf(mon: MonsterState): Passive | undefined {
  return scaledPassive(mon.def, mon.evolution);
}

/** The monsters on a team with a given passive (at their current evolution). */
function teamPassive<K extends PassiveKind>(player: PlayerState, kind: K): { mon: MonsterState; p: PassiveOf<K> }[] {
  const out: { mon: MonsterState; p: PassiveOf<K> }[] = [];
  for (const mon of player.monsters) {
    const p = passiveOf(mon);
    if (p?.kind === kind) out.push({ mon, p: p as PassiveOf<K> });
  }
  return out;
}

/** Keen eye: this team's hits ignore shields. */
function pierces(player: PlayerState): boolean {
  return teamPassive(player, "keenEye").length > 0;
}

/** A monster gains charge from a passive (sealed monsters can't: then nothing happens). */
function gainCharge(mon: MonsterState, seat: 0 | 1, count: number): EffectEventFor<"charge"> | null {
  if (mon.sealed > 0 || count <= 0) return null;
  mon.charge += count;
  return { kind: "charge", target: seat, monsterId: mon.def.id, count };
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

/** Most bubbles a player can hold at once. */
const MAX_BUBBLES = 3;

/** If the player has a bubble, it blocks this harmful effect (and is used up). */
function popBubble(player: PlayerState): boolean {
  if (player.bubble <= 0) return false;
  player.bubble -= 1;
  return true;
}

/** Healing after poison: a poisoned player heals half (rounded up). */
function healAmount(player: PlayerState, amount: number): number {
  if (amount <= 0) return 0;
  return player.dots.some((d) => d.kind === "poison") ? Math.ceil(amount / 2) : amount;
}

function tickRegen(player: PlayerState, playerIdx: 0 | 1, events: AbilityEvent[]): void {
  if (player.regen.length === 0) return;
  for (const r of player.regen) {
    const healed = healAmount(player, r.amount);
    player.hp = Math.min(player.maxHp, player.hp + healed);
    events.push({ monsterId: "regen", monsterName: "Regen", element: "light", type: "regen-tick", amount: healed, targetPlayer: playerIdx });
  }
  // Glow (Dawnhare): a turn that starts with regen charges it (once, however many regens tick).
  for (const { mon, p } of teamPassive(player, "glow")) gainCharge(mon, playerIdx, p.count);
  player.regen = player.regen.map((r) => ({ ...r, turns: r.turns - 1 })).filter((r) => r.turns > 0);
}

function dealDamage(player: PlayerState, amount: number, pierce = false): void {
  let dmg = amount;
  if (player.shield > 0 && !pierce) {
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
    regen: [],
    bubble: 0,
    berries: 0,
    slow: 0,
    // Daybreak monsters start fully charged.
    monsters: p.monsters.map((def): MonsterState => ({ def, charge: def.passive?.kind === "daybreak" ? def.chargeCost : 0, evolution: 0, sealed: 0 })),
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
