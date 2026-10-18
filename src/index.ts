/**
 * Entry point: one server, one port — web client, status, and WebSocket signaling.
 */
import { loadConfig } from "./config/env.js";
import { startServer } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = await startServer(config);

  // eslint-disable-next-line no-console
  console.log(`Ploto up on http://${config.host}:${server.port}  —  play at /play`);
  // eslint-disable-next-line no-console
  console.log(`data: ${server.services.db.describe}`);
  // eslint-disable-next-line no-console
  console.log(`monster lab: ${config.statsKey ? "open (STATS_KEY set)" : "closed (no STATS_KEY)"}`);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("fatal:", err);
  process.exit(1);
});
