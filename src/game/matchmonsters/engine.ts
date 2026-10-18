/**
 * Match Monsters turn engine.
 *
 * Rules (clean-room, from the public description):
 *  - Two players, each fielding two monsters. Each monster has an element.
 *  - On your turn you swap two adjacent tiles; the swap must create at least one
 *    match (3+ in a line), otherwise it is rejected.
 *  - Matched tiles clear, the board collapses and refills, which may cascade.
 *  - For each element cleared, if YOU field a monster of that element, that
 *    monster attacks: damage = tilesOfElement * monster.power * comboMultiplier,
 *    where the multiplier grows with each cascade step. Elements you don't field
 *    still clear the board but deal no damage.
 *  - Damage lands on the opponent's frontmost living monster. When both of an
 *    opponent's monsters are defeated, you win.
 *  - Turn then passes to the other player.
 */
import type {
  Board,
  CascadeStep,
  DamageEvent,
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
import { Rng } from "./rng.js";
import {
  collapseAndRefill,
  DEFAULT_BOARD,
  findMatches,
  generateBoard,
  type BoardOptions,
} from "./board.js";

export interface PlayerSetup {
  readonly peerId: string;
  readonly displayName: string;
  /** Exactly two monsters. */
  readonly monsters: [Monster, Monster];
}

export interface GameConfig {
  readonly matchId: string;
  readonly seed: number;
  readonly board?: BoardOptions;
  readonly players: [PlayerSetup, PlayerSetup];
  /** Which player moves first (default 0). */
  readonly firstTurn?: 0 | 1;
}

/** Combo multiplier for the Nth cascade step (0-based): 1x, 1.5x, 2x, 2.5x, … */
function comboMultiplier(step: number): number {
  return 1 + step * 0.5;
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

    const board = generateBoard(this.boardOpts, this.rng);
    const players = config.players.map(toPlayerState) as [PlayerState, PlayerState];

    this.state = {
      matchId: config.matchId,
      board,
      players,
      turn: config.firstTurn ?? 0,
      phase: "awaiting-move",
      winner: null,
      moveNumber: 0,
    };
  }

  /** Apply a move made by `by` (0 or 1). Pure w.r.t. the injected RNG stream. */
  applyMove(by: 0 | 1, move: Move): MoveResult | MoveRejection {
    const s = this.state;
    if (s.phase === "finished") return reject("game is finished");
    if (by !== s.turn) return reject("not your turn");
    if (move.type !== "swap") return reject("unsupported move type");

    const { from, to } = move;
    if (!isAdjacent(from, to)) return reject("tiles are not adjacent");
    if (!onBoard(s.board, from) || !onBoard(s.board, to))
      return reject("tile out of bounds");

    // Tentatively swap.
    swap(s.board, from, to);
    if (findMatches(s.board).length === 0) {
      swap(s.board, from, to); // revert — illegal move in match-3.
      return reject("swap does not create a match");
    }

    // Resolve cascades.
    const cascades: CascadeStep[] = [];
    const damageByKey = new Map<string, DamageEvent>();
    const attacker = s.players[by];

    for (let step = 0; ; step++) {
      const matches = findMatches(s.board);
      if (matches.length === 0) break;

      const countsByElement: Partial<Record<Element, number>> = {};
      for (const m of matches) {
        countsByElement[m.element] = (countsByElement[m.element] ?? 0) + 1;
      }
      cascades.push({
        cleared: matches.map((m) => ({ x: m.x, y: m.y, element: m.element })),
        countsByElement,
      });

      // Accumulate damage for elements the attacker fields.
      const mult = comboMultiplier(step);
      for (const el of Object.keys(countsByElement) as Element[]) {
        const monster = attacker.monsters.find((m) => m.def.element === el);
        if (!monster) continue;
        const amount = Math.round(countsByElement[el]! * monster.def.power * mult);
        const key = monster.def.id;
        const prev = damageByKey.get(key);
        if (prev) {
          damageByKey.set(key, { ...prev, amount: prev.amount + amount });
        } else {
          damageByKey.set(key, {
            targetPlayer: other(by),
            monsterId: monster.def.id,
            amount,
            element: el,
          });
        }
      }

      collapseAndRefill(
        s.board,
        matches.map((m) => ({ x: m.x, y: m.y })),
        this.palette,
        this.rng,
      );
    }

    // Apply damage to the opponent's frontmost living monster.
    const defender = s.players[other(by)];
    const damage: DamageEvent[] = [];
    const defeated: { player: 0 | 1; monsterId: string }[] = [];
    for (const dmg of damageByKey.values()) {
      const target = frontmostAlive(defender);
      if (!target) break;
      target.hp = Math.max(0, target.hp - dmg.amount);
      damage.push({ ...dmg, monsterId: dmg.monsterId });
      if (target.hp === 0) {
        defeated.push({ player: other(by), monsterId: target.def.id });
      }
    }

    // Win check.
    const finished = defender.monsters.every((m) => m.hp === 0);
    if (finished) {
      s.phase = "finished";
      s.winner = by;
    }
    s.turn = finished ? s.turn : other(by);
    s.moveNumber += 1;

    return {
      ok: true,
      move,
      by,
      cascades,
      damage,
      defeated,
      nextTurn: s.turn,
      finished,
      winner: s.winner,
      board: cloneGrid(s.board),
    };
  }
}

function toPlayerState(p: PlayerSetup): PlayerState {
  return {
    peerId: p.peerId,
    displayName: p.displayName,
    monsters: p.monsters.map(
      (def): MonsterState => ({ def, hp: def.maxHp }),
    ),
  };
}

function frontmostAlive(p: PlayerState): MonsterState | undefined {
  return p.monsters.find((m) => m.hp > 0);
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
