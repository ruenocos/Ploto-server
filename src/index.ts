/**
 * Entry point: boots the status service and the signaling server.
 */
import { loadConfig } from "./config/env.js";
import { buildStatusServer } from "./status/server.js";
import { SignalingServer } from "./signaling/server.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const status = buildStatusServer(config);
  await status.listen({ host: config.host, port: config.statusPort });
  // eslint-disable-next-line no-console
  console.log(`[status]    http://${config.host}:${config.statusPort}/`);

  const signaling = new SignalingServer(config);
  await signaling.listen();
  // eslint-disable-next-line no-console
  console.log(`[signaling] ws://${config.host}:${config.signalingPort}/ (protoo)`);

  const shutdown = async () => {
    await Promise.allSettled([status.close(), signaling.close()]);
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
