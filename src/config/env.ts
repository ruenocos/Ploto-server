/** Runtime configuration, read from the environment with sane defaults. */
export interface ServerConfig {
  readonly host: string;
  /** Single port for HTTP + WebSocket (hosting platforms inject PORT). */
  readonly port: number;
  /** Value served by the status endpoint: 0 = up, 1 = in maintenance. */
  readonly downtime: 0 | 1;
  readonly maintenanceReason: string;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(): ServerConfig {
  return {
    host: process.env.PLOTO_HOST ?? "0.0.0.0",
    // PORT is the convention on Fly/Railway/Render/Cloud Run; PLOTO_PORT overrides.
    port: intEnv("PLOTO_PORT", intEnv("PORT", 8080)),
    downtime: process.env.PLOTO_DOWNTIME === "1" ? 1 : 0,
    maintenanceReason: process.env.PLOTO_MAINTENANCE_REASON ?? "",
  };
}
