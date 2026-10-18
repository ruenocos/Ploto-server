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
  Cell,
  Effect,
  EffectEvent,
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
    let iceLanded: Cell[] = [];
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
        iceLanded = this.landFreezes();
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
    const berserk = scaledPassive(def, mon.evolution)?.berserk;
    const raging = berserk !== undefined && attacker.hp <= berserk.threshold;
    const effects: Effect[] = raging
      ? Array.from({ length: berserk.hits }, () => ({ kind: "damage" as const, amount: berserk.amount }))
      : scaledEffects(def, mon.evolution);

    const cast: CastEvent = {
      by: ctx.by,
      monsterId: def.id,
      monsterName: def.name,
      element: def.element,
      moveName: raging ? `${def.ability.name} (Berserk)` : def.ability.name,
      kinds: effects.map((e) => e.kind),
      ...(raging ? { via: "berserk" as const } : {}),
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

    // Partner follow-up strikes (a follow-up never triggers another).
    if (dealtDamage && ctx.defender.hp > 0) {
      for (const partner of attacker.monsters) {
        const extra = scaledPassive(partner.def, partner.evolution)?.followUp;
        if (partner === mon || !extra) continue;
        this.hit(ctx, partner.def, extra);
        ctx.casts.push({
          by: ctx.by,
          monsterId: partner.def.id,
          monsterName: partner.def.name,
          element: partner.def.element,
          moveName: "Follow-up",
          kinds: ["damage"],
          via: "followUp",
          effects: [{ kind: "damage", target: ctx.foeIdx, amount: extra }],
        });
      }
    }
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
      case "damage":
        this.hit(ctx, def, e.amount);
        return { kind: "damage", target: foeIdx, amount: e.amount };
      case "heal":
        this.heal(ctx, def, e.amount);
        return { kind: "heal", target: by, amount: e.amount };
      case "shield": {
        const gained = Math.max(0, Math.min(e.amount, MAX_SHIELD - attacker.shield));
        if (gained > 0) {
          attacker.shield += gained;
          ctx.abilities.push(evt(def, "shield", gained, by));
        }
        return { kind: "shield", target: by, amount: gained };
      }
      case "drain":
        this.hit(ctx, def, e.amount);
        this.heal(ctx, def, e.amount);
        return { kind: "drain", target: foeIdx, amount: e.amount };
      case "dot":
        defender.dots.push({ amount: e.amount, turns: e.turns, kind: e.dot, element: def.element });
        ctx.abilities.push(evt(def, e.dot, e.amount, foeIdx));
        return { kind: "dot", target: foeIdx, dot: e.dot, amount: e.amount, turns: e.turns };
      case "match": {
        const cells = this.shapeCells(e.shape, e.size ?? defaultShapeSize(e.shape));
        const step = this.matchRegion(cells, ctx);
        return { kind: "match", shape: e.shape, cells, step };
      }
      case "freeze":
        // Lands when the turn passes, so it never blocks the caster's own moves.
        this.state.pendingFreeze.push({ count: e.count, turns: e.turns });
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
        // Turn tiles into the caster's element, skipping any that would match
        // immediately (so the bonus tiles are there for your next move).
        const target = def.element;
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
      case "sap": {
        const drained: Record<string, number> = {};
        for (const m of defender.monsters) {
          const lost = Math.min(m.charge, e.count);
          m.charge -= lost;
          if (lost > 0) drained[m.def.id] = lost;
        }
        return { kind: "sap", target: foeIdx, drained };
      }
      case "slow": {
        const before = defender.slow;
        defender.slow = Math.min(MOVES_PER_TURN - 1, defender.slow + e.count);
        return { kind: "slow", target: foeIdx, count: defender.slow - before };
      }
      case "seal": {
        const target = this.pick(defender.monsters, 1)[0];
        if (target) target.sealed = Math.max(target.sealed, e.turns);
        return { kind: "seal", target: foeIdx, monsterId: target?.def.id ?? null, turns: e.turns };
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
    for (const c of present) {
      const t = b.grid[c.y]![c.x]!;
      if (t === "berry") ctx.berries += 1;
      else if (isElement(t)) counts[t] = (counts[t] ?? 0) + 1;
    }
    const before = cloneGrid(b);
    const clearedInfo = present.map((c) => ({ x: c.x, y: c.y, element: b.grid[c.y]![c.x]! }));
    feedCharge(ctx.attacker, counts);
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
        return { ...e, amount: scaleAmount(e.amount, evolution), turns: e.turns + atLeast(evolution, 1) };
      case "match":
        return { ...e, size: (e.size ?? defaultShapeSize(e.shape)) + atLeast(evolution, 1) };
      case "freeze":
        return { ...e, count: e.count + evolution, turns: e.turns + atLeast(evolution, 2) };
      case "petrify":
      case "convert":
      case "sap":
      case "empower":
        return { ...e, count: e.count + evolution };
      case "seal":
        return { ...e, turns: e.turns + atLeast(evolution, 1) };
      case "haste":
        return { ...e, count: e.count + atLeast(evolution, 2) };
      default:
        return e; // slow is capped at one move; cleanse is all-or-nothing
    }
  });
}

/** Passives after evolution: follow-ups and berserk strikes hit harder, berserk kicks in sooner. */
export function scaledPassive(def: Monster, evolution: number): Passive | undefined {
  const p = def.passive;
  if (!p) return undefined;
  return {
    ...(p.berserk
      ? {
          berserk: {
            threshold: p.berserk.threshold + 6 * evolution,
            hits: p.berserk.hits,
            amount: scaleAmount(p.berserk.amount, evolution),
          },
        }
      : {}),
    ...(p.followUp ? { followUp: scaleAmount(p.followUp, evolution) } : {}),
  };
}

/** Charge cost after evolution: -1 per level, never below the floor (or the base, if lower). */
export function effectiveCost(def: Monster, evolution: number): number {
  return Math.max(Math.min(def.chargeCost, MIN_CHARGE_COST), def.chargeCost - evolution);
}

function describeShape(shape: MatchShape, size: number): string {
  if (shape === "row") return size === 1 ? "match a random row" : `match ${size} random rows`;
  if (shape === "col") return size === 1 ? "match a random column" : `match ${size} random columns`;
  return `match a ${size}×${size} area`;
}

/** Human-readable text for a list of effects. */
export function describeEffects(effects: readonly Effect[], element: Element): string {
  const parts = effects.map((e) => {
    switch (e.kind) {
      case "damage": return `deal ${e.amount} damage`;
      case "heal": return `heal ${e.amount} HP`;
      case "shield": return `gain a ${e.amount} shield`;
      case "drain": return `steal ${e.amount} HP`;
      case "dot": return `${e.dot} ${e.amount}/turn for ${e.turns} turns`;
      case "match": return describeShape(e.shape, e.size ?? defaultShapeSize(e.shape));
      case "freeze": return `freeze ${e.count} tiles for the rival's ` + (e.turns > 1 ? `next ${e.turns} turns` : "turn");
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
export function describePassive(def: Monster, evolution = 0): string | undefined {
  const p = scaledPassive(def, evolution);
  if (!p) return undefined;
  if (p.berserk) return `Berserk at ${p.berserk.threshold} HP or less: strike ${p.berserk.hits}× for ${p.berserk.amount}`;
  if (p.followUp) return `When its partner's move hits, follow up for ${p.followUp}`;
  return undefined;
}

const EFFECT_LABEL: Record<EffectKind, string> = {
  damage: "Damage", heal: "Heal", shield: "Shield", drain: "Life steal", dot: "", match: "Blast",
  freeze: "Frozen tiles", petrify: "Stone tiles", convert: "Converted tiles", sap: "Charge drained",
  slow: "Moves stolen", seal: "Seal", haste: "Extra moves", cleanse: "Cleanse", empower: "Partner charge",
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
    if (a.kind === "dot" && b.kind === "dot") {
      const name = a.dot === "burn" ? "Burn" : "Poison";
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
      if (a.turns !== b.turns) out.push(`${label} ${a.turns} → ${b.turns} turns`);
    } else if ("amount" in a && "amount" in b && a.amount !== b.amount) {
      out.push(`${label} ${a.amount} → ${b.amount}`);
    } else if ("count" in a && "count" in b && a.count !== b.count) {
      out.push(`${label} ${a.count} → ${b.count}`);
    }
  });
  const pa = scaledPassive(def, evolution), pb = scaledPassive(def, evolution + 1);
  if (pa?.followUp !== undefined && pb?.followUp !== undefined && pa.followUp !== pb.followUp) {
    out.push(`Follow-up ${pa.followUp} → ${pb.followUp}`);
  }
  if (pa?.berserk && pb?.berserk) {
    if (pa.berserk.amount !== pb.berserk.amount) out.push(`Berserk strikes ${pa.berserk.amount} → ${pb.berserk.amount}`);
    if (pa.berserk.threshold !== pb.berserk.threshold) out.push(`Berserk at ${pa.berserk.threshold} → ${pb.berserk.threshold} HP`);
  }
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
