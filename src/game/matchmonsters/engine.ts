/**
 * Match Monsters turn engine.
 *
 * Rules (clean-room, like the real game):
 *  - Each player has one HP pool and fields two monsters. A monster has an
 *    element, a charge cost, and an ability.
 *  - On your turn you swap two adjacent tiles; the swap must create a match.
 *  - Matched tiles clear, the board collapses and refills (cascades). For each
 *    tile of a monster's element you matched, that monster gains 1 charge.
 *  - After the board settles, every monster that reached its charge cost fires
 *    its ability (and can fire repeatedly if it banked enough), spending the
 *    cost each time:
 *      attack → damage the opponent   heal → restore your HP
 *      shield → gain a damage buffer   burn → damage the opponent each turn
 *  - Shields soak damage before HP. Burns tick at the start of the victim's turn
 *    and ignore shields. Reduce the opponent to 0 HP to win.
 */
import type {
  AbilityEvent,
  Board,
  CascadeStep,
  Element,
  GameState,
  Monster,
  MonsterState,
  Move,
  MoveRejection,
  MoveResult,
  PlayerState,
  Tile,
} from "./types.js";
import { BERRIES_TO_EVOLVE, MAX_EVOLUTION, MOVES_PER_TURN, STARTING_HP } from "./types.js";
import { Rng } from "./rng.js";
import {
  collapseAndRefill,
  DEFAULT_BOARD,
  findMatches,
  generateBoard,
  hasBigMatch,
  type BoardOptions,
} from "./board.js";

/** Hard cap so chained match-4 bonuses can't stack a player's turn forever. */
const MAX_MOVES = 4;

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
    const players = config.players.map((p) => toPlayerState(p, hp)) as [PlayerState, PlayerState];

    this.state = {
      matchId: config.matchId,
      board,
      players,
      turn: config.firstTurn ?? 0,
      movesLeft: MOVES_PER_TURN,
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

    swap(s.board, from, to);
    if (findMatches(s.board).length === 0) {
      swap(s.board, from, to);
      return reject("swap does not create a match");
    }

    // Resolve cascades and tally matched tiles per element.
    const cascades: CascadeStep[] = [];
    const charged: Partial<Record<Element, number>> = {};
    let bigMatch = false;
    let berriesGained = 0;
    for (;;) {
      const matches = findMatches(s.board);
      if (matches.length === 0) break;
      if (hasBigMatch(s.board)) bigMatch = true; // a line of 4+ grants an extra move
      const countsByElement: Partial<Record<Element, number>> = {};
      for (const mtch of matches) {
        if (mtch.element === "berry") {
          berriesGained += 1;
          continue;
        }
        const el = mtch.element;
        countsByElement[el] = (countsByElement[el] ?? 0) + 1;
        charged[el] = (charged[el] ?? 0) + 1;
      }
      cascades.push({
        cleared: matches.map((mt) => ({ x: mt.x, y: mt.y, element: mt.element })),
        countsByElement,
      });
      collapseAndRefill(
        s.board,
        matches.map((mt) => ({ x: mt.x, y: mt.y })),
        this.palette,
        this.rng,
      );
    }

    const attacker = s.players[by];
    const defender = s.players[other(by)];
    const abilities: AbilityEvent[] = [];

    attacker.berries += berriesGained;

    // Feed charges to the attacker's monsters.
    for (const mon of attacker.monsters) {
      const gained = charged[mon.def.element] ?? 0;
      if (gained > 0) mon.charge += gained;
    }

    // Fire every ability that is now fully charged (repeatedly if over-charged).
    for (const mon of attacker.monsters) {
      while (mon.charge >= mon.def.chargeCost && defender.hp > 0) {
        mon.charge -= mon.def.chargeCost;
        fireAbility(mon, by, attacker, defender, other(by), abilities);
      }
    }

    let finished = defender.hp <= 0;
    let nextTurn: 0 | 1 = by;
    // A move of 4+ grants an extra move instead of consuming one.
    const extraTurn = !finished && bigMatch;

    if (!finished) {
      const movesLeft = s.movesLeft - 1 + (extraTurn ? 1 : 0);
      if (movesLeft < 1) {
        // Turn passes; the incoming player's burns tick as their turn begins.
        nextTurn = other(by);
        s.turn = nextTurn;
        s.movesLeft = MOVES_PER_TURN;
        const incoming = s.players[nextTurn];
        tickBurns(incoming, nextTurn, abilities);
        if (incoming.hp <= 0) finished = true; // attacker wins — opponent burned down
      } else {
        // Same player keeps the turn with a move remaining.
        s.movesLeft = Math.min(movesLeft, MAX_MOVES);
        nextTurn = by;
      }
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
      charged,
      abilities,
      berriesGained,
      nextTurn,
      movesLeft: s.movesLeft,
      extraTurn,
      finished,
      winner: s.winner,
      board: cloneGrid(s.board),
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
}

function fireAbility(
  mon: MonsterState,
  attackerIdx: 0 | 1,
  attacker: PlayerState,
  defender: PlayerState,
  defenderIdx: 0 | 1,
  events: AbilityEvent[],
): void {
  const ab = mon.def.ability;
  const amount = evolvedAmount(mon.def, mon.evolution);
  switch (ab.type) {
    case "attack":
      dealDamage(defender, amount);
      events.push(evt(mon.def, "attack", amount, defenderIdx));
      break;
    case "heal":
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount);
      events.push(evt(mon.def, "heal", amount, attackerIdx));
      break;
    case "shield":
      attacker.shield += amount;
      events.push(evt(mon.def, "shield", amount, attackerIdx));
      break;
    case "burn":
    case "poison":
      defender.dots.push({
        amount,
        turns: ab.turns ?? 3,
        kind: ab.type,
        element: mon.def.element,
      });
      events.push(evt(mon.def, ab.type, amount, defenderIdx));
      break;
  }
}

/** Ability amount after evolution: +20% (min +1) per level. */
export function evolvedAmount(def: Monster, evolution: number): number {
  const bonus = Math.max(1, Math.round(def.ability.amount * 0.2));
  return def.ability.amount + evolution * bonus;
}

/** Ability as shown to players, reflecting the monster's evolution level. */
export function abilityView(def: Monster, evolution: number) {
  const amount = evolvedAmount(def, evolution);
  const turns = def.ability.turns;
  const text: Record<string, string> = {
    attack: `Deal ${amount} damage`,
    heal: `Heal ${amount} HP`,
    shield: `Gain a ${amount} shield`,
    burn: `Burn ${amount}/turn for ${turns} turns`,
    poison: `Poison ${amount}/turn for ${turns} turns`,
  };
  return { type: def.ability.type, amount, turns, description: text[def.ability.type] ?? "" };
}

export interface EvolveResult {
  readonly ok: true;
  readonly monsterId: string;
  readonly evolution: number;
  readonly berries: number;
}

function tickBurns(player: PlayerState, playerIdx: 0 | 1, events: AbilityEvent[]): void {
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

function evt(
  def: Monster,
  type: AbilityEvent["type"],
  amount: number,
  targetPlayer: 0 | 1,
): AbilityEvent {
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
    monsters: p.monsters.map((def): MonsterState => ({ def, charge: 0, evolution: 0 })),
  };
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
