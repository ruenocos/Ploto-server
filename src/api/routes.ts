/**
 * JSON API.
 *
 *   Accounts  POST /api/accounts {username} -> {id, username, key}   (key shown once)
 *             GET  /api/me                  -> profile + win/loss record
 *             PATCH /api/me {username}      -> rename
 *             GET  /api/me/matches          -> recent match history
 *   Friends   GET  /api/friends, POST /api/friends {username},
 *             POST /api/friends/:id/accept, DELETE /api/friends/:id
 *   DMs       GET  /api/messages/:friendId?before=, POST /api/messages/:friendId {body}
 *   Lab       GET  /api/monster-lab/...     balance stats, gated by STATS_KEY
 *
 * Signed-in calls send `Authorization: Bearer <key>`.
 */
import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AccountError, type Account } from "../accounts/accounts.js";
import { BALANCE_VERSION, MONSTERS } from "../game/matchmonsters/monsters.js";
import type { Services } from "../services.js";
import type { StatsFilter } from "../stats/history.js";

export function registerApi(app: FastifyInstance, s: Services): void {
  // Turn our domain errors into clean JSON responses.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AccountError) return reply.code(err.status).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? "server error" : (err as Error).message });
  });

  const auth = async (req: FastifyRequest): Promise<Account> => {
    const header = req.headers.authorization ?? "";
    const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const account = await s.accounts.authenticate(key);
    if (!account) throw new AccountError("not signed in", 401);
    return account;
  };
  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;
  const param = (req: FastifyRequest, name: string) => String((req.params as Record<string, unknown>)[name] ?? "");

  // ------------------------------------------------------------ accounts
  app.post("/api/accounts", async (req, reply) => {
    const { account, key } = await s.accounts.register(body(req)["username"]);
    return reply.code(201).send({ ...account, key });
  });

  app.get("/api/me", async (req) => {
    const me = await auth(req);
    return { ...me, record: await s.history.playerRecord(me.id) };
  });

  app.patch("/api/me", async (req) => {
    const me = await auth(req);
    const renamed = await s.accounts.rename(me.id, body(req)["username"]);
    for (const id of await s.social.friendIds(me.id)) s.presence.notify(id, "social:changed", { reason: "rename" });
    return renamed;
  });

  app.get("/api/me/matches", async (req) => {
    const me = await auth(req);
    return s.history.recentFor(me.id);
  });

  // ------------------------------------------------------------ friends
  app.get("/api/friends", async (req) => {
    const me = await auth(req);
    const [lists, unread] = await Promise.all([s.social.lists(me.id), s.social.unread(me.id)]);
    return {
      friends: lists.friends.map((f) => ({ ...f, online: s.presence.isOnline(f.id), unread: unread[f.id] ?? 0 })),
      incoming: lists.incoming,
      outgoing: lists.outgoing,
    };
  });

  app.post("/api/friends", async (req) => {
    const me = await auth(req);
    const name = String(body(req)["username"] ?? "");
    const target = await s.accounts.byUsername(name);
    if (!target) throw new AccountError(`no player called "${name.trim()}"`, 404);
    const status = await s.social.request(me.id, target);
    s.presence.notify(target.id, "social:changed", { reason: status === "accepted" ? "accepted" : "request", from: me.username });
    return { status, friend: target };
  });

  app.post("/api/friends/:id/accept", async (req) => {
    const me = await auth(req);
    const other = param(req, "id");
    if (!(await s.social.accept(me.id, other))) throw new AccountError("no pending request from them", 404);
    s.presence.notify(other, "social:changed", { reason: "accepted", from: me.username });
    return { status: "accepted" };
  });

  app.delete("/api/friends/:id", async (req) => {
    const me = await auth(req);
    const other = param(req, "id");
    await s.social.remove(me.id, other);
    s.presence.notify(other, "social:changed", { reason: "removed" });
    return { ok: true };
  });

  // ------------------------------------------------------------ DMs
  app.get("/api/messages/:id", async (req) => {
    const me = await auth(req);
    const other = param(req, "id");
    const before = Number((req.query as Record<string, unknown>)["before"]) || undefined;
    const messages = await s.social.conversation(me.id, other, before);
    await s.social.markRead(me.id, other);
    return messages;
  });

  app.post("/api/messages/:id", async (req) => {
    const me = await auth(req);
    const message = await s.social.send(me.id, param(req, "id"), body(req)["body"]);
    s.presence.notify(message.to, "social:message", { ...message, fromUsername: me.username });
    return message;
  });

  // ------------------------------------------------------------ monster lab
  // Balance data only: monsters, matchups, teams. No humans in here.
  const labGate = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!s.statsKey) {
      reply.code(503).send({ error: "🔒 the lab is closed (set STATS_KEY on the server)" });
      return false;
    }
    const given = String(req.headers["x-lab-key"] ?? (req.query as Record<string, unknown>)["key"] ?? "");
    const a = Buffer.from(given), b = Buffer.from(s.statsKey);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      reply.code(403).send({ error: "🧪 wrong lab key, no monsters for you" });
      return false;
    }
    return true;
  };
  const filter = (req: FastifyRequest): StatsFilter => {
    const q = req.query as Record<string, unknown>;
    return {
      includeBot: q["includeBot"] === "1" || q["includeBot"] === "true",
      includeForfeits: q["includeForfeits"] === "1" || q["includeForfeits"] === "true",
      ...(typeof q["version"] === "string" && q["version"] ? { version: q["version"] } : {}),
    };
  };
  const minGames = (req: FastifyRequest) => Math.max(1, Number((req.query as Record<string, unknown>)["min"]) || 1);

  app.get("/api/monster-lab", async (req, reply) => {
    if (!labGate(req, reply)) return;
    return {
      welcome: "🧪 Welcome to the Monster Lab. Only monsters were harmed in the making of these stats.",
      balanceVersion: BALANCE_VERSION,
      roster: Object.keys(MONSTERS),
      endpoints: {
        summary: "/api/monster-lab/summary",
        monsters: "/api/monster-lab/monsters",
        matchups: "/api/monster-lab/matchups?min=5",
        teams: "/api/monster-lab/teams?min=3",
        matches: "/api/monster-lab/matches?limit=50",
      },
      filters: {
        includeBot: "1 to include practice games vs the bot (default: PvP only)",
        includeForfeits: "1 to include matches someone gave up (default: no)",
        version: `"all", or a balance fingerprint (default: current, ${BALANCE_VERSION})`,
      },
      auth: "send the key as ?key=… or an x-lab-key header",
    };
  });
  app.get("/api/monster-lab/summary", async (req, reply) => (labGate(req, reply) ? s.history.summary(filter(req)) : undefined));
  app.get("/api/monster-lab/monsters", async (req, reply) => (labGate(req, reply) ? s.history.monsters(filter(req)) : undefined));
  app.get("/api/monster-lab/matchups", async (req, reply) => (labGate(req, reply) ? s.history.matchups(filter(req), minGames(req)) : undefined));
  app.get("/api/monster-lab/teams", async (req, reply) => (labGate(req, reply) ? s.history.teams(filter(req), minGames(req)) : undefined));
  app.get("/api/monster-lab/matches", async (req, reply) => {
    if (!labGate(req, reply)) return;
    const limit = Number((req.query as Record<string, unknown>)["limit"]) || 50;
    return s.history.recent(filter(req), limit);
  });
}
