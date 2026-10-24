/**
 * Match history and the stats built from it.
 *
 * Every finished match is recorded with both players (account or guest or bot),
 * their monsters and evolutions. Balance stats only ever look at monsters,
 * matchups and teams; per-human records are kept for profiles, never for tuning.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "../db/db.js";
import { BALANCE_VERSION, MONSTERS } from "../game/matchmonsters/monsters.js";

export type MatchMode = "quick" | "private" | "invite" | "practice" | "rematch";

export interface PlayerRecord {
  readonly accountId: string | null;
  readonly isBot: boolean;
  readonly displayName: string;
  readonly monsters: readonly [string, string];
  readonly evolutions: readonly [number, number];
  readonly finalHp: number;
}

export interface MatchRecord {
  readonly mode: MatchMode;
  readonly vsBot: boolean;
  readonly firstTurn: 0 | 1;
  readonly winner: 0 | 1 | null;
  /** Seat that gave up, if the match ended by forfeit. */
  readonly forfeitedBy?: 0 | 1 | null;
  readonly moves: number;
  readonly turns: number;
  readonly startedAt: Date;
  readonly players: readonly [PlayerRecord, PlayerRecord];
}

export interface StatsFilter {
  /** Include practice games against the bot (default: no). */
  readonly includeBot?: boolean;
  /** Balance fingerprint to filter by; "all" for every patch (default: current). */
  readonly version?: string;
  /** Include matches someone forfeited (default: no; they say little about balance). */
  readonly includeForfeits?: boolean;
}

const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 1000) / 1000 : null);

export class MatchHistory {
  constructor(private readonly db: Db) {}

  async record(m: MatchRecord): Promise<string> {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO matches (id, mode, vs_bot, balance_version, first_turn, winner, moves, turns, started_at, ended_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, m.mode, m.vsBot, BALANCE_VERSION, m.firstTurn, m.winner, m.moves, m.turns, m.startedAt.toISOString(), m.forfeitedBy != null ? "forfeit" : "hp"],
    );
    for (const [seat, p] of m.players.entries()) {
      await this.db.query(
        `INSERT INTO match_players (match_id, seat, account_id, is_bot, display_name, monster_a, monster_b, evo_a, evo_b, final_hp, won)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, seat, p.accountId, p.isBot, p.displayName, p.monsters[0], p.monsters[1], p.evolutions[0], p.evolutions[1], p.finalHp, m.winner === seat],
      );
    }
    return id;
  }

  /** A player's own win/loss record (for their profile, not for balancing). */
  async playerRecord(accountId: string): Promise<{ games: number; wins: number }> {
    const rows = await this.db.query<{ games: string; wins: string }>(
      "SELECT count(*) AS games, coalesce(sum(won), 0) AS wins FROM match_players WHERE account_id = $1",
      [accountId],
    );
    return { games: Number(rows[0]?.games ?? 0), wins: Number(rows[0]?.wins ?? 0) };
  }

  /** Match Monsters tiles and recent games for the Profile tab. */
  async statsFor(accountId: string) {
    const { games, wins } = await this.playerRecord(accountId);
    const fav = await this.db.query<{ monster: string; n: string }>(
      `SELECT monster, count(*) AS n FROM (
         SELECT monster_a AS monster FROM match_players WHERE account_id = $1
         UNION ALL SELECT monster_b FROM match_players WHERE account_id = $1) t
       GROUP BY monster ORDER BY n DESC, monster LIMIT 1`,
      [accountId],
    );
    const recent = await this.recentFor(accountId, 5);
    const name = (id: unknown) => MONSTERS[String(id)]?.name ?? String(id);
    return {
      played: games,
      wins,
      tiles: [
        { label: "Matches", value: String(games) },
        { label: "Wins", value: String(wins) },
        { label: "Win rate", value: games ? `${Math.round((wins / games) * 100)}%` : "—" },
        { label: "Favourite", value: fav[0] ? name(fav[0].monster) : "—" },
      ],
      recent: (recent as Record<string, unknown>[]).map((r) => ({
        what: `${r.won ? "Won" : "Lost"} vs ${String(r["opponent"])} · ${name(r["monsterA"])} + ${name(r["monsterB"])}`,
        when: String(r["endedAt"]),
      })),
    };
  }

  /** A player's recent matches, newest first. */
  async recentFor(accountId: string, limit = 20) {
    const rows = await this.db.query<Record<string, unknown> & { won: number; vsBot: number }>(
      `SELECT m.id, m.mode, m.vs_bot AS "vsBot", m.ended_at AS "endedAt", me.won,
              me.monster_a AS "monsterA", me.monster_b AS "monsterB",
              them.display_name AS "opponent", them.monster_a AS "opponentA", them.monster_b AS "opponentB"
         FROM match_players me
         JOIN matches m ON m.id = me.match_id
         JOIN match_players them ON them.match_id = me.match_id AND them.seat <> me.seat
        WHERE me.account_id = $1
        ORDER BY m.ended_at DESC
        LIMIT $2`,
      [accountId, Math.min(100, limit)],
    );
    return rows.map((r) => ({ ...r, won: Boolean(r.won), vsBot: Boolean(r.vsBot) }));
  }

  // ------------------------------------------------------------ balance stats

  /** Shared WHERE clause: which matches count. $1 = includeBot, $2 = version or null. */
  private scope(f: StatsFilter): [string, unknown[]] {
    const version = f.version === "all" ? null : (f.version ?? BALANCE_VERSION);
    return [
      "(m.vs_bot = 0 OR $1 = 1) AND ($2 IS NULL OR m.balance_version = $2) AND (m.ended_by = 'hp' OR $3 = 1)",
      [f.includeBot ? 1 : 0, version, f.includeForfeits ? 1 : 0],
    ];
  }

  async summary(f: StatsFilter = {}) {
    const [where, params] = this.scope(f);
    const rows = await this.db.query<{ matches: string; first_wins: string; avg_moves: string | null; avg_turns: string | null }>(
      `SELECT count(*) AS matches, coalesce(sum(m.winner = m.first_turn), 0) AS first_wins,
              avg(m.moves) AS avg_moves, avg(m.turns) AS avg_turns
         FROM matches m WHERE ${where}`,
      params,
    );
    const r = rows[0]!;
    const matches = Number(r.matches);
    return {
      balanceVersion: f.version === "all" ? "all" : (f.version ?? BALANCE_VERSION),
      includeBot: Boolean(f.includeBot),
      matches,
      firstPlayerWinRate: rate(Number(r.first_wins), matches),
      avgMoves: r.avg_moves === null ? null : Math.round(Number(r.avg_moves) * 10) / 10,
      avgTurns: r.avg_turns === null ? null : Math.round(Number(r.avg_turns) * 10) / 10,
    };
  }

  /** Per-monster games, wins, win rate and average evolution reached. */
  async monsters(f: StatsFilter = {}) {
    const [where, params] = this.scope(f);
    const rows = await this.db.query<{ monster: string; games: string; wins: string; avg_evo: string }>(
      `WITH players AS (
         SELECT p.* FROM match_players p JOIN matches m ON m.id = p.match_id WHERE ${where}
       ), picks AS (
         SELECT won, monster_a AS monster, evo_a AS evo FROM players
         UNION ALL
         SELECT won, monster_b, evo_b FROM players
       )
       SELECT monster, count(*) AS games, sum(won) AS wins, avg(evo) AS avg_evo
         FROM picks GROUP BY monster ORDER BY CAST(sum(won) AS REAL) / count(*) DESC, count(*) DESC`,
      params,
    );
    return rows.map((r) => ({
      monster: r.monster,
      games: Number(r.games),
      wins: Number(r.wins),
      winRate: rate(Number(r.wins), Number(r.games)),
      avgEvolution: Math.round(Number(r.avg_evo) * 100) / 100,
    }));
  }

  /** Head-to-head: how `monster` fares when `opponent` is on the other team. */
  async matchups(f: StatsFilter = {}, minGames = 1) {
    const [where, params] = this.scope(f);
    const rows = await this.db.query<{ monster: string; opponent: string; games: string; wins: string }>(
      `WITH players AS (
         SELECT p.* FROM match_players p JOIN matches m ON m.id = p.match_id WHERE ${where}
       ), picks AS (
         SELECT match_id, seat, won, monster_a AS monster FROM players
         UNION ALL
         SELECT match_id, seat, won, monster_b FROM players
       )
       SELECT a.monster, b.monster AS opponent, count(*) AS games, sum(a.won) AS wins
         FROM picks a JOIN picks b ON a.match_id = b.match_id AND a.seat <> b.seat
        GROUP BY a.monster, b.monster
       HAVING count(*) >= $4
        ORDER BY a.monster, b.monster`,
      [...params, minGames],
    );
    return rows.map((r) => ({ monster: r.monster, opponent: r.opponent, games: Number(r.games), wins: Number(r.wins), winRate: rate(Number(r.wins), Number(r.games)) }));
  }

  /** Two-monster teams (order-independent). */
  async teams(f: StatsFilter = {}, minGames = 1) {
    const [where, params] = this.scope(f);
    const rows = await this.db.query<{ a: string; b: string; games: string; wins: string }>(
      `SELECT min(p.monster_a, p.monster_b) AS a, max(p.monster_a, p.monster_b) AS b,
              count(*) AS games, sum(p.won) AS wins
         FROM match_players p JOIN matches m ON m.id = p.match_id
        WHERE ${where}
        GROUP BY 1, 2
       HAVING count(*) >= $4
        ORDER BY CAST(sum(p.won) AS REAL) / count(*) DESC, count(*) DESC`,
      [...params, minGames],
    );
    return rows.map((r) => ({ team: [r.a, r.b], games: Number(r.games), wins: Number(r.wins), winRate: rate(Number(r.wins), Number(r.games)) }));
  }

  /** Recent matches, anonymised: monsters and outcome only. */
  async recent(f: StatsFilter = {}, limit = 50) {
    const [where, params] = this.scope(f);
    const rows = await this.db.query<{
      id: string; ended_at: string; mode: string; vs_bot: number; winner: number | null; first_turn: number; moves: number; turns: number;
      seat: number; monster_a: string; monster_b: string; evo_a: number; evo_b: number; final_hp: number; is_bot: number;
    }>(
      `WITH recent AS (SELECT * FROM matches m WHERE ${where} ORDER BY m.ended_at DESC LIMIT $4)
       SELECT r.id, r.ended_at, r.mode, r.vs_bot, r.winner, r.first_turn, r.moves, r.turns,
              p.seat, p.monster_a, p.monster_b, p.evo_a, p.evo_b, p.final_hp, p.is_bot
         FROM recent r JOIN match_players p ON p.match_id = r.id
        ORDER BY r.ended_at DESC, p.seat`,
      [...params, Math.min(500, limit)],
    );
    const byId = new Map<string, Record<string, unknown> & { teams: unknown[] }>();
    for (const r of rows) {
      if (!byId.has(r.id)) {
        byId.set(r.id, { id: r.id, endedAt: r.ended_at, mode: r.mode, vsBot: Boolean(r.vs_bot), winner: r.winner, firstTurn: r.first_turn, moves: r.moves, turns: r.turns, teams: [] });
      }
      byId.get(r.id)!.teams.push({ seat: r.seat, monsters: [r.monster_a, r.monster_b], evolutions: [r.evo_a, r.evo_b], finalHp: r.final_hp, bot: Boolean(r.is_bot) });
    }
    return [...byId.values()];
  }
}
