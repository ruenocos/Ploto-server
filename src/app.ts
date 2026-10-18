/**
 * App factory: one HTTP server that serves the web client, the status endpoint,
 * and the monster roster, with the protoo WebSocket signaling attached to the
 * same port. Single port = one public URL, same-origin `wss://`, trivial to host.
 */
import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "./config/env.js";
import { buildStatusServer } from "./status/server.js";
import { SignalingServer } from "./signaling/server.js";

export interface RunningServer {
  readonly app: FastifyInstance;
  readonly signaling: SignalingServer;
  readonly port: number;
  close(): Promise<void>;
}

/** Build everything, attach signaling, and start listening on `config.port`. */
export async function startServer(config: ServerConfig): Promise<RunningServer> {
  const app = buildStatusServer(config);
  // Materialise the underlying http.Server before attaching the WS server.
  await app.ready();
  const signaling = new SignalingServer(app.server);
  await app.listen({ host: config.host, port: config.port });

  const addr = app.server.address();
  const port = typeof addr === "object" && addr ? addr.port : config.port;

  return {
    app,
    signaling,
    port,
    async close() {
      await signaling.close();
      await app.close();
    },
  };
}
