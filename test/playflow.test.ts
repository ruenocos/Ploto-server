import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { startServer, type RunningServer } from "../src/app.js";
import type { ServerConfig } from "../src/config/env.js";
import { createRequest, parse, stringify, type ProtooMessage } from "../src/signaling/protoo.js";

const config: ServerConfig = {
  host: "127.0.0.1",
  port: 0,
  downtime: 0,
  maintenanceReason: "",
};

class Client {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (m: ProtooMessage) => void>();
  readonly notes: { method: string; data: unknown }[] = [];
  private ready: Promise<void>;
  constructor(port: number, roomId: string, peerId: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/?roomId=${roomId}&peerId=${peerId}`, "protoo");
    this.ready = new Promise((res, rej) => {
      this.ws.on("open", () => res());
      this.ws.on("error", rej);
    });
    this.ws.on("message", (raw) => {
      const m = parse(String(raw));
      if ("response" in m) this.pending.get(m.id)?.(m);
      else if ("notification" in m) this.notes.push({ method: m.method, data: m.data });
    });
  }
  open() { return this.ready; }
  req(method: string, data: unknown): Promise<ProtooMessage> {
    const id = this.nextId++;
    return new Promise((res) => {
      this.pending.set(id, res);
      this.ws.send(stringify(createRequest(id, method, data)));
    });
  }
  close() { this.ws.close(); }
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

describe("web client routes", () => {
  it("serves the play page from the same origin as the WebSocket", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/play`);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("Match Monsters");
    // Client derives the WebSocket URL from its own origin — no port injection.
    expect(html).toContain("location.host");
    expect(html).not.toContain("__SIGNALING_PORT__");
  });

  it("serves the monster roster", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/play/monsters`);
    const list = (await res.json()) as { id: string; element: string }[];
    expect(list.length).toBeGreaterThanOrEqual(20);
    expect(list.find((m) => m.id === "ember_pup")).toBeTruthy();
  });
});

describe("a real move over the wire", () => {
  it("pairs two clients and plays a legal swap that both see", async () => {
    const a = new Client(port, "lobby", "pa");
    const b = new Client(port, "lobby", "pb");
    await a.open();
    await b.open();

    await a.req("mm:enqueue", { displayName: "A", monsters: ["ember_pup", "prism_owl"] });
    const r = (await b.req("mm:enqueue", {
      displayName: "B",
      monsters: ["stone_golem", "tide_serpent"],
    })) as { data: { roomId: string } };
    const roomId = r.data.roomId;

    const ga = new Client(port, roomId, "pa");
    const gb = new Client(port, roomId, "pb");
    await ga.open();
    await gb.open();

    const snap = (await ga.req("mm:getState", {})) as {
      data: { turn: 0 | 1; board: (string | null)[][] };
    };
    const mover = snap.data.turn === 0 ? ga : gb;
    const board = snap.data.board;
    const h = board.length;
    const w = board[0]!.length;

    // Find any legal swap by asking the server (it validates); stop on first accept.
    let played = false;
    outer: for (let y = 0; y < h && !played; y++) {
      for (let x = 0; x < w && !played; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= w || ny >= h) continue;
          const res = (await mover.req("mm:move", {
            from: { x, y },
            to: { x: nx, y: ny },
          })) as { ok: boolean };
          if (res.ok) { played = true; break outer; }
        }
      }
    }

    expect(played).toBe(true);
    // Both players received the moveResult broadcast.
    await new Promise((res) => setTimeout(res, 30));
    expect(ga.notes.some((n) => n.method === "mm:moveResult")).toBe(true);
    expect(gb.notes.some((n) => n.method === "mm:moveResult")).toBe(true);

    a.close(); b.close(); ga.close(); gb.close();
  });
});
