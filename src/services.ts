/** Everything stateful the HTTP API and the signaling server share. */
import { Accounts } from "./accounts/accounts.js";
import { openDb, type Db } from "./db/db.js";
import { Presence } from "./social/presence.js";
import { Social } from "./social/social.js";
import { MatchHistory } from "./stats/history.js";
import { GameResults } from "./stats/results.js";

export interface Services {
  readonly db: Db;
  readonly accounts: Accounts;
  readonly social: Social;
  readonly history: MatchHistory;
  /** Results of every other game (Hold'em, …): places and per-player stats. */
  readonly results: GameResults;
  readonly presence: Presence;
  /** Key for the stats API; the API is closed when unset. */
  readonly statsKey: string | undefined;
}

export interface ServiceOptions {
  /** Where postgres.db (SQLite) lives; omit for in-memory (tests). */
  readonly dataDir?: string | undefined;
  readonly statsKey?: string | undefined;
}

export async function createServices(opts: ServiceOptions = {}): Promise<Services> {
  const db = await openDb({ dataDir: opts.dataDir });
  return {
    db,
    accounts: new Accounts(db),
    social: new Social(db),
    history: new MatchHistory(db),
    results: new GameResults(db),
    presence: new Presence(),
    statsKey: opts.statsKey || undefined,
  };
}
