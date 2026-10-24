import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { startServer, type RunningServer } from "../src/app.js";
import type { ServerConfig } from "../src/config/env.js";
import {
  createRequest,
  parse,
  stringify,
  type ProtooMessage,
} from "../src/signaling/protoo.js";

const config: ServerConfig = {
  host: "127.0.0.1",
  port: 0,
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

let server: RunningServer;
let port: number;

beforeAll(async () => {
  server = await startServer(config);
  port = server.port;
});

afterAll(async () => {
  await server.close();
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("status service", () => {
  it("serves the exact maintenance document", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe('{"downtime":0,"reason":""}');
  });
});

describe("quick play + room over protoo", () => {
  it("seats two players in one quick room and hands them a playable match", async () => {
    const a = new TestClient(port, "lobby", "alice");
    const b = new TestClient(port, "lobby", "bob");
    await a.open();
    await b.open();

    const r1 = (await a.request("mm:quick", { displayName: "Alice", data: ["ember_pup", "prism_owl"] })) as { ok: boolean; data: { roomId: string; seat: number } };
    expect(r1).toMatchObject({ ok: true, data: { seat: 0 } });
    // Alice waits in the room for a rival.
    const ga = new TestClient(port, r1.data.roomId, "alice");
    await ga.open();

    const r2 = (await b.request("mm:quick", { displayName: "Bob", data: ["stone_golem", "tide_serpent"] })) as { ok: boolean; data: { roomId: string; seat: number } };
    expect(r2.ok).toBe(true);
    expect(r2.data).toMatchObject({ roomId: r1.data.roomId, seat: 1 });
    const roomId = r2.data.roomId;

    // Alice hears the start on the room connection.
    await delay(20);
    expect(ga.notifications.some((n) => n.method === "lobby:update" && (n.data as { view: { phase: string } }).view.phase === "playing")).toBe(true);

    const gb = new TestClient(port, roomId, "bob");
    await gb.open();

    const state = (await ga.request("mm:getState", {})) as {
      ok: boolean;
      data: { turn: number; players: { displayName: string }[] };
    };
    expect(state.ok).toBe(true);
    expect([0, 1]).toContain(state.data.turn);
    expect(state.data.players.map((p) => p.displayName)).toEqual(["Alice", "Bob"]);

    a.close();
    b.close();
    ga.close();
    gb.close();
  });
});
