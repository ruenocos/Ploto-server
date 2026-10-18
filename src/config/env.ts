/** Runtime configuration, read from the environment with sane defaults. */
export interface ServerConfig {
  readonly host: string;
  readonly statusPort: number;
  readonly signalingPort: number;
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
    statusPort: intEnv("PLOTO_STATUS_PORT", 8080),
    signalingPort: intEnv("PLOTO_SIGNALING_PORT", 8443),
    downtime: process.env.PLOTO_DOWNTIME === "1" ? 1 : 0,
    maintenanceReason: process.env.PLOTO_MAINTENANCE_REASON ?? "",
  };
}
