/**
 * A simple greedy opponent. It looks one swap ahead and scores the resulting
 * matches: tiles that charge its own monsters count most, then berries, then
 * anything else. Shared by the practice bot and the balance simulators.
 */
import { findMatches, isMovable } from "./board.js";
import type { MatchMonstersGame } from "./engine.js";
import type { Move } from "./types.js";
import { BERRIES_TO_EVOLVE, MAX_EVOLUTION } from "./types.js";

export interface BotOptions {
  /** 0..1 — chance of playing a random legal move instead of the best one. */
  readonly sloppiness?: number;
  /** Random source in [0, 1); defaults to Math.random. */
  readonly random?: () => number;
}

/** The bot's move for `seat`, or null if it has none (or it isn't its turn). */
export function chooseMove(game: MatchMonstersGame, seat: 0 | 1, opts: BotOptions = {}): Move | null {
  const s = game.state;
  if (s.phase === "finished" || s.turn !== seat) return null;
  const b = s.board;
  const mine = new Set(s.players[seat].monsters.map((m) => m.def.element));
  const legal: { move: Move; score: number }[] = [];
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx >= b.width || ny >= b.height) continue;
        if (!isMovable(b, x, y, s.ice) || !isMovable(b, nx, ny, s.ice)) continue;
        const t = b.grid[y]![x]!;
        b.grid[y]![x] = b.grid[ny]![nx]!;
        b.grid[ny]![nx] = t;
        const matches = findMatches(b);
        b.grid[ny]![nx] = b.grid[y]![x]!;
        b.grid[y]![x] = t;
        if (matches.length === 0) continue;
        let score = 0;
        for (const c of matches) score += mine.has(c.element as never) ? 3 : c.element === "berry" ? 2 : 1;
        legal.push({ move: { type: "swap", from: { x, y }, to: { x: nx, y: ny } }, score });
      }
    }
  }
  if (legal.length === 0) return null;
  const random = opts.random ?? Math.random;
  if (random() < (opts.sloppiness ?? 0)) return legal[Math.floor(random() * legal.length)]!.move;
  return legal.reduce((best, m) => (m.score > best.score ? m : best)).move;
}

/** Which monster the bot evolves when it can (its least-evolved), or null. */
export function chooseEvolution(game: MatchMonstersGame, seat: 0 | 1): string | null {
  const p = game.state.players[seat];
  if (p.berries < BERRIES_TO_EVOLVE) return null;
  const candidates = p.monsters.filter((m) => m.evolution < MAX_EVOLUTION);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, m) => (m.evolution < a.evolution ? m : a)).def.id;
}
