/**
 * Status / health service.
 *
 * Mirrors the observed behaviour of `status-prod.platocorp.com`:
 *   GET /  ->  text/plain  {"downtime":0,"reason":""}
 * The client checks this around connect time; `downtime: 1` with a `reason`
 * string puts the app into its maintenance screen.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import type { ServerConfig } from "../config/env.js";
import { roster } from "../game/matchmonsters/monsters.js";

export interface StatusBody {
  downtime: 0 | 1;
  reason: string;
}

export function buildStatusServer(config: ServerConfig): FastifyInstance {
  const app = Fastify({ logger: false });

  const body = (): StatusBody => ({
    downtime: config.downtime,
    reason: config.maintenanceReason,
  });

  // The real endpoint replies with a JSON document under a text/plain content
  // type, so we serialise by hand and set the header to match exactly.
  app.get("/", async (_req, reply) => {
    reply.header("content-type", "text/plain; charset=utf-8");
    return JSON.stringify(body());
  });

  // Convenience alias for load balancers / uptime checks.
  app.get("/healthz", async () => ({ status: "ok" }));

  // Playable web client: open /play on two devices to battle a friend.
  app.get("/play", async (_req, reply) => {
    const html = loadClientHtml().replace("__SIGNALING_PORT__", String(config.signalingPort));
    reply.header("content-type", "text/html; charset=utf-8");
    return html;
  });

  // Monster roster for the client's picker.
  app.get("/play/monsters", async () => roster());

  return app;
}

let cachedHtml: string | null = null;
function loadClientHtml(): string {
  if (cachedHtml === null) {
    const path = fileURLToPath(new URL("../../web/index.html", import.meta.url));
    cachedHtml = readFileSync(path, "utf8");
  }
  return cachedHtml;
}
