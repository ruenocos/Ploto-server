/**
 * Status / health service.
 *
 * Mirrors the observed behaviour of `status-prod.platocorp.com`:
 *   GET /  ->  text/plain  {"downtime":0,"reason":""}
 * The client checks this around connect time; `downtime: 1` with a `reason`
 * string puts the app into its maintenance screen.
 */
import Fastify, { type FastifyInstance } from "fastify";
import type { ServerConfig } from "../config/env.js";

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

  return app;
}
