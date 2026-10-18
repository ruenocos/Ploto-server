/**
 * Friends and direct messages.
 *
 * A friend request is a pending row (requester -> addressee); accepting flips it
 * to accepted, which is mutual. If both people request each other, the second
 * request just accepts the first. DMs are only allowed between friends.
 */
import type { Account } from "../accounts/accounts.js";
import { AccountError, isUuid } from "../accounts/accounts.js";
import { NOW, type Db } from "../db/db.js";

export interface Message {
  readonly id: number;
  readonly from: string;
  readonly to: string;
  readonly body: string;
  readonly at: string;
}

export interface FriendLists {
  readonly friends: Account[];
  readonly incoming: Account[];
  readonly outgoing: Account[];
}

export const MAX_MESSAGE = 500;

export class Social {
  constructor(private readonly db: Db) {}

  async lists(me: string): Promise<FriendLists> {
    const rows = await this.db.query<{ id: string; username: string; status: string; requester: string }>(
      `SELECT a.id, a.username, f.status, f.requester
         FROM friendships f
         JOIN accounts a ON a.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
        WHERE f.requester = $1 OR f.addressee = $1
        ORDER BY lower(a.username)`,
      [me],
    );
    const pick = (r: { id: string; username: string }): Account => ({ id: r.id, username: r.username });
    return {
      friends: rows.filter((r) => r.status === "accepted").map(pick),
      incoming: rows.filter((r) => r.status === "pending" && r.requester !== me).map(pick),
      outgoing: rows.filter((r) => r.status === "pending" && r.requester === me).map(pick),
    };
  }

  async friendIds(me: string): Promise<string[]> {
    return (await this.lists(me)).friends.map((f) => f.id);
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    if (!isUuid(a) || !isUuid(b)) return false;
    const rows = await this.db.query(
      `SELECT 1 FROM friendships WHERE status = 'accepted'
          AND ((requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1))`,
      [a, b],
    );
    return rows.length > 0;
  }

  /** Ask `target` to be friends. Returns "pending", or "accepted" if they'd already asked. */
  async request(me: string, target: Account): Promise<"pending" | "accepted"> {
    if (target.id === me) throw new AccountError("you can't friend yourself", 400);
    const theirs = await this.db.query<{ status: string }>(
      "SELECT status FROM friendships WHERE requester = $1 AND addressee = $2",
      [target.id, me],
    );
    if (theirs[0]) {
      if (theirs[0].status === "pending") {
        await this.db.query("UPDATE friendships SET status = 'accepted' WHERE requester = $1 AND addressee = $2", [target.id, me]);
      }
      return "accepted";
    }
    const mine = await this.db.query<{ status: string }>(
      `INSERT INTO friendships (requester, addressee, status) VALUES ($1, $2, 'pending')
       ON CONFLICT (requester, addressee) DO UPDATE SET status = friendships.status
       RETURNING status`,
      [me, target.id],
    );
    return mine[0]?.status === "accepted" ? "accepted" : "pending";
  }

  /** Accept a pending request from `other`. */
  async accept(me: string, other: string): Promise<boolean> {
    if (!isUuid(other)) return false;
    const rows = await this.db.query(
      "UPDATE friendships SET status = 'accepted' WHERE requester = $1 AND addressee = $2 AND status = 'pending' RETURNING 1",
      [other, me],
    );
    return rows.length > 0;
  }

  /** Decline, cancel or unfriend: whatever links the two goes away. */
  async remove(me: string, other: string): Promise<void> {
    if (!isUuid(other)) return;
    await this.db.query(
      "DELETE FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)",
      [me, other],
    );
  }

  async send(me: string, to: string, rawBody: unknown): Promise<Message> {
    const body = typeof rawBody === "string" ? rawBody.trim() : "";
    if (!body) throw new AccountError("message is empty", 400);
    if (body.length > MAX_MESSAGE) throw new AccountError(`messages are at most ${MAX_MESSAGE} characters`, 400);
    if (!(await this.areFriends(me, to))) throw new AccountError("you can only message friends", 403);
    const rows = await this.db.query<{ id: number; created_at: string }>(
      "INSERT INTO messages (sender, recipient, body) VALUES ($1, $2, $3) RETURNING id, created_at",
      [me, to, body],
    );
    return { id: Number(rows[0]!.id), from: me, to, body, at: new Date(rows[0]!.created_at).toISOString() };
  }

  /** A conversation, oldest first; `before` pages back by message id. */
  async conversation(me: string, other: string, before?: number, limit = 50): Promise<Message[]> {
    if (!isUuid(other)) return [];
    const rows = await this.db.query<{ id: number; sender: string; recipient: string; body: string; created_at: string }>(
      `SELECT id, sender, recipient, body, created_at FROM messages
        WHERE min(sender, recipient) = min($1, $2) AND max(sender, recipient) = max($1, $2)
          AND ($3 IS NULL OR id < $3)
        ORDER BY id DESC LIMIT $4`,
      [me, other, before ?? null, Math.min(100, limit)],
    );
    return rows.reverse().map((r) => ({ id: Number(r.id), from: r.sender, to: r.recipient, body: r.body, at: new Date(r.created_at).toISOString() }));
  }

  async markRead(me: string, other: string): Promise<void> {
    if (!isUuid(other)) return;
    await this.db.query(`UPDATE messages SET read_at = ${NOW} WHERE recipient = $1 AND sender = $2 AND read_at IS NULL`, [me, other]);
  }

  /** Unread message counts per friend. */
  async unread(me: string): Promise<Record<string, number>> {
    const rows = await this.db.query<{ sender: string; n: number }>(
      "SELECT sender, count(*) AS n FROM messages WHERE recipient = $1 AND read_at IS NULL GROUP BY sender",
      [me],
    );
    return Object.fromEntries(rows.map((r) => [r.sender, Number(r.n)]));
  }
}
