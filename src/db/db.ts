/**
 * Storage: a single SQLite file (Node's built-in `node:sqlite`, no native
 * modules). The file is `postgres.db` in the data directory: SQLite for now,
 * named for the database it'll grow into.
 *
 * Everything goes through the small async `Db` interface below, so swapping in
 * a real Postgres later only means writing another implementation of it.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from "node:sqlite";
import { SCHEMA } from "./schema.js";

// Loaded through require: some bundlers (vitest's) don't know `node:sqlite` yet.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export interface Db {
  /** Run a statement. Parameters are positional: `$1`, `$2`, … */
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  close(): Promise<void>;
  /** Where data lives, for the startup log. */
  readonly describe: string;
}

export const DB_FILE = "postgres.db";

export interface DbOptions {
  /** Directory holding the database file; omit for an in-memory database (tests). */
  readonly dataDir?: string | undefined;
}

export async function openDb(opts: DbOptions = {}): Promise<Db> {
  let path = ":memory:";
  if (opts.dataDir) {
    mkdirSync(opts.dataDir, { recursive: true });
    path = join(opts.dataDir, DB_FILE);
  }
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA foreign_keys = ON");
  if (path !== ":memory:") {
    sqlite.exec("PRAGMA journal_mode = WAL"); // readers don't block the writer
    sqlite.exec("PRAGMA busy_timeout = 5000");
  }
  for (const statement of SCHEMA) sqlite.exec(statement);

  const statements = new Map<string, ReturnType<DatabaseSyncType["prepare"]>>();
  const prepare = (sql: string) => {
    let st = statements.get(sql);
    if (!st) {
      // `$1` style placeholders -> SQLite's numbered `?1`.
      st = sqlite.prepare(sql.replace(/\$(\d+)/g, "?$1"));
      statements.set(sql, st);
    }
    return st;
  };

  return {
    describe: path === ":memory:" ? "sqlite (in memory)" : `sqlite (${path})`,
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const values = params.map(toSqlite);
      return prepare(sql).all(...values) as T[];
    },
    async close() {
      sqlite.close();
    },
  };
}

/** SQLite has no booleans or dates: store 1/0 and ISO strings. */
function toSqlite(v: unknown): SQLInputValue {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint") return v;
  return JSON.stringify(v);
}

/** True for a unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { errcode?: number; message?: string };
  // 2067 = SQLITE_CONSTRAINT_UNIQUE, 1555 = SQLITE_CONSTRAINT_PRIMARYKEY
  return e.errcode === 2067 || e.errcode === 1555 || /UNIQUE constraint failed/.test(e.message ?? "");
}

/** ISO-8601 "now", for SQL defaults. */
export const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
