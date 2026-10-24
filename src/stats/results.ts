/**
 * Results for every game other than Match Monsters (whose matches keep their
 * own, richer tables in history.ts): who played, where they finished, and a
 * small per-player stats object the game defines. The Profile tab reads the
 * tiles built here.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "../db/db.js";
import type { ProfileSpec } from "../platform/games.js";

export interface ResultPlayer {
  readonly seat: number;
  readonly accountId: string | null;
  readonly isBot: boolean;
  readonly displayName: string;
  /** 1 = winner. */
  readonly place: number;
  /** Game-defined numbers, e.g. Hold'em's `{ biggestPot, handsWon }`. */
  readonly stats?: Record<string, number>;
}

export interface GameResult {
  readonly gameId: string;
  readonly mode: string;
  readonly startedAt: Date;
  readonly players: readonly ResultPlayer[];
  readonly summary?: Record<string, unknown>;
}

export interface ProfileGameStats {
  played: number;
  wins: number;
  tiles: { label: string; value: string }[];
  recent: { what: string; when: string }[];
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
const num = (n: number) => n.toLocaleString("en-US");

export class GameResults {
  constructor(private readonly db: Db) {}

  async record(r: GameResult): Promise<string> {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO game_results (id, game_id, mode, vs_bots, started_at, summary) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, r.gameId, r.mode, r.players.some((p) => p.isBot), r.startedAt.toISOString(), JSON.stringify(r.summary ?? {})],
    );
    for (const p of r.players) {
      await this.db.query(
        `INSERT INTO game_result_players (result_id, seat, account_id, is_bot, display_name, place, stats) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, p.seat, p.accountId, p.isBot, p.displayName, p.place, JSON.stringify(p.stats ?? {})],
      );
    }
    return id;
  }

  /** Profile tiles and recent games, per game the account has played. */
  async statsFor(accountId: string, profiles: Readonly<Record<string, ProfileSpec | undefined>> = {}): Promise<Record<string, ProfileGameStats>> {
    const rows = await this.db.query<{ gameId: string; place: number; stats: string; endedAt: string; seats: string; mode: string }>(
      `SELECT r.game_id AS "gameId", p.place, p.stats, r.ended_at AS "endedAt", r.mode,
              (SELECT count(*) FROM game_result_players q WHERE q.result_id = r.id) AS seats
         FROM game_result_players p JOIN game_results r ON r.id = p.result_id
        WHERE p.account_id = $1
        ORDER BY r.ended_at DESC`,
      [accountId],
    );
    const out: Record<string, ProfileGameStats> = {};
    const byGame = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!byGame.has(row.gameId)) byGame.set(row.gameId, []);
      byGame.get(row.gameId)!.push(row);
    }
    for (const [gameId, list] of byGame) {
      const played = list.length;
      const wins = list.filter((r) => Number(r.place) === 1).length;
      const avg = played ? list.reduce((s, r) => s + Number(r.place), 0) / played : 0;
      const stat = (key: string) => Math.max(0, ...list.map((r) => Number((JSON.parse(r.stats || "{}") as Record<string, number>)[key] ?? 0)));
      const spec = profiles[gameId];
      const tiles = [
        { label: spec?.played ?? "Games", value: String(played) },
        { label: "Wins", value: String(wins) },
        { label: "Avg finish", value: played ? avg.toFixed(1) : "—" },
        ...(spec?.stats ?? []).map((s) => ({ label: s.label, value: num(stat(s.key)) })),
      ];
      out[gameId] = {
        played,
        wins,
        tiles,
        recent: list.slice(0, 5).map((r) => ({ what: `${ordinal(Number(r.place))} of ${Number(r.seats)}${r.mode === "practice" ? " · practice" : ""}`, when: r.endedAt })),
      };
    }
    return out;
  }
}
