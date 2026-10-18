/**
 * Database schema (SQLite). Statements are idempotent and run on every boot;
 * add new ones at the end (never edit an existing table in place).
 *
 * Conventions: ids are UUID strings, timestamps ISO-8601 strings, booleans 0/1.
 */
const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

export const SCHEMA: readonly string[] = [
  // Anonymous accounts: a unique username plus a secret key the client keeps.
  // Only a SHA-256 of the key is stored.
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    last_seen TEXT NOT NULL DEFAULT ${NOW}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_ci ON accounts (lower(username))`,

  // Friendships: `requester` asked `addressee`; accepted rows are mutual.
  `CREATE TABLE IF NOT EXISTS friendships (
    requester TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    addressee TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TEXT NOT NULL DEFAULT ${NOW},
    PRIMARY KEY (requester, addressee),
    CHECK (requester <> addressee)
  )`,

  // Direct messages between friends.
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    read_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS messages_by_pair ON messages (min(sender, recipient), max(sender, recipient), id)`,
  `CREATE INDEX IF NOT EXISTS messages_unread ON messages (recipient, read_at)`,

  // Match history. `balance_version` fingerprints the roster numbers the match
  // was played with, so stats can be split across balance patches.
  `CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    vs_bot INTEGER NOT NULL,
    balance_version TEXT NOT NULL,
    first_turn INTEGER NOT NULL,
    winner INTEGER,
    moves INTEGER NOT NULL,
    turns INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL DEFAULT ${NOW},
    ended_by TEXT NOT NULL DEFAULT 'hp'
  )`,
  `CREATE INDEX IF NOT EXISTS matches_by_end ON matches (ended_at DESC)`,
  `CREATE TABLE IF NOT EXISTS match_players (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    seat INTEGER NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    is_bot INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    monster_a TEXT NOT NULL,
    monster_b TEXT NOT NULL,
    evo_a INTEGER NOT NULL,
    evo_b INTEGER NOT NULL,
    final_hp INTEGER NOT NULL,
    won INTEGER NOT NULL,
    PRIMARY KEY (match_id, seat)
  )`,
  `CREATE INDEX IF NOT EXISTS match_players_by_account ON match_players (account_id)`,
];

/**
 * Columns added after a table first shipped: [table, column, definition].
 * Added on boot when missing (SQLite has no ADD COLUMN IF NOT EXISTS).
 */
export const ADDED_COLUMNS: readonly (readonly [string, string, string])[] = [
  // How the match ended: 'hp' (knocked out / sudden death) or 'forfeit'.
  ["matches", "ended_by", "TEXT NOT NULL DEFAULT 'hp'"],
];
