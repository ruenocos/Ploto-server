/**
 * Anonymous accounts: no passwords, no email. Claiming a username returns a
 * secret key that the client keeps (localStorage); the key *is* the login.
 * Only its SHA-256 is stored, so a database leak doesn't leak logins.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isUniqueViolation, NOW, type Db } from "../db/db.js";

export interface Account {
  readonly id: string;
  readonly username: string;
}

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const RESERVED = new Set(["bot", "practicebot", "admin", "system", "plato", "ploto"]);

export function validateUsername(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!USERNAME.test(name)) throw new AccountError("usernames are 3–16 letters, numbers or _", 400);
  if (RESERVED.has(name.toLowerCase())) throw new AccountError("that username is reserved", 400);
  return name;
}

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export class Accounts {
  constructor(private readonly db: Db) {}

  /** Claim a username. Returns the account and its secret key (shown once). */
  async register(rawUsername: unknown): Promise<{ account: Account; key: string }> {
    const username = validateUsername(rawUsername);
    const id = randomUUID();
    const key = `mm_${randomBytes(24).toString("base64url")}`;
    try {
      await this.db.query("INSERT INTO accounts (id, username, key_hash) VALUES ($1, $2, $3)", [id, username, hashKey(key)]);
    } catch (err) {
      if (isUniqueViolation(err)) throw new AccountError("that username is taken", 409);
      throw err;
    }
    return { account: { id, username }, key };
  }

  /** Resolve a key to its account (and note that it was seen). */
  async authenticate(key: unknown): Promise<Account | null> {
    if (typeof key !== "string" || !key.startsWith("mm_") || key.length > 100) return null;
    const rows = await this.db.query<Account>(
      `UPDATE accounts SET last_seen = ${NOW} WHERE key_hash = $1 RETURNING id, username`,
      [hashKey(key)],
    );
    return rows[0] ?? null;
  }

  async rename(id: string, rawUsername: unknown): Promise<Account> {
    const username = validateUsername(rawUsername);
    try {
      const rows = await this.db.query<Account>("UPDATE accounts SET username = $2 WHERE id = $1 RETURNING id, username", [id, username]);
      if (!rows[0]) throw new AccountError("account not found", 404);
      return rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) throw new AccountError("that username is taken", 409);
      throw err;
    }
  }

  async byUsername(username: string): Promise<Account | null> {
    const rows = await this.db.query<Account>("SELECT id, username FROM accounts WHERE lower(username) = lower($1)", [username.trim()]);
    return rows[0] ?? null;
  }

  async byId(id: string): Promise<Account | null> {
    if (!isUuid(id)) return null;
    const rows = await this.db.query<Account>("SELECT id, username FROM accounts WHERE id = $1", [id]);
    return rows[0] ?? null;
  }
}
