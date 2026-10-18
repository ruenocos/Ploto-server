import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { SignalingServer } from "../src/signaling/server.js";
import { buildStatusServer } from "../src/status/server.js";
import type { ServerConfig } from "../src/config/env.js";
import {
  createRequest,
  parse,
  stringify,
  type ProtooMessage,
} from "../src/signaling/protoo.js";

const config: ServerConfig = {
  host: "127.0.0.1",
  statusPort: 0,
  signalingPort: 0,
  downtime: 0,
  maintenanceReason: "",
};

/** A minimal protoo client over ws: send requests, await responses, collect notifications. */
class TestClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (m: ProtooMessage) => void>();
  readonly notifications: { method: string; data: unknown }[] = [];
  private readonly ready: Promise<void>;

  constructor(port: number, roomId: string, peerId: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/?roomId=${roomId}&peerId=${peerId}`, "protoo");
    this.ready = new Promise((resolve, reject) => {
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
    });
    this.ws.on("message", (raw) => {
      const msg = parse(String(raw));
      if ("response" in msg) this.pending.get(msg.id)?.(msg);
      else if ("notification" in msg)
        this.notifications.push({ method: msg.method, data: msg.data });
    });
  }

  async open(): Promise<void> {
    await this.ready;
  }

  request(method: string, data: unknown): Promise<ProtooMessage> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(stringify(createRequest(id, method, data)));
    });
  }

  close(): void {
    this.ws.close();
  }
}

let signaling: SignalingServer;
let status: ReturnType<typeof buildStatusServer>;
let port: number;

beforeAll(async () => {
  signaling = new SignalingServer(config);
  await signaling.listen();
  port = signaling.port;
  status = buildStatusServer(config);
  await status.listen({ host: "127.0.0.1", port: 0 });
});

afterAll(async () => {
  await signaling.close();
  await status.close();
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("status service", () => {
  it("serves the exact maintenance document", async () => {
    const addr = status.server.address();
    const p = typeof addr === "object" && addr ? addr.port : 0;
    const res = await fetch(`http://127.0.0.1:${p}/`);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe('{"downtime":0,"reason":""}');
  });
});

describe("matchmaking + room over protoo", () => {
  it("pairs two players and hands them a playable room", async () => {
    const a = new TestClient(port, "lobby", "alice");
    const b = new TestClient(port, "lobby", "bob");
    await a.open();
    await b.open();

    const r1 = await a.request("mm:enqueue", {
      gameId: "match_monsters",
      mode: "casual",
      displayName: "Alice",
      monsters: ["ember_pup", "prism_owl"],
    });
    expect(r1).toMatchObject({ ok: true, data: { queued: true } });

    const r2 = (await b.request("mm:enqueue", {
      gameId: "match_monsters",
      mode: "casual",
      displayName: "Bob",
      monsters: ["stone_golem", "tide_serpent"],
    })) as { ok: boolean; data: { queued: boolean; roomId: string } };
    expect(r2.ok).toBe(true);
    expect(r2.data.queued).toBe(false);
    const roomId = r2.data.roomId;
    expect(roomId).toBeTruthy();

    // Alice is told about the match via notification.
    await delay(20);
    const matched = a.notifications.find((n) => n.method === "mm:matched");
    expect(matched).toBeDefined();
    expect((matched!.data as { roomId: string }).roomId).toBe(roomId);

    // Both reconnect to the game room and fetch state.
    const ga = new TestClient(port, roomId, "alice");
    const gb = new TestClient(port, roomId, "bob");
    await ga.open();
    await gb.open();

    const state = (await ga.request("mm:getState", {})) as {
      ok: boolean;
      data: { turn: number; players: { displayName: string }[] };
    };
    expect(state.ok).toBe(true);
    expect(state.data.turn).toBe(0);
    expect(state.data.players.map((p) => p.displayName)).toEqual(["Alice", "Bob"]);

    a.close();
    b.close();
    ga.close();
    gb.close();
  });
});
