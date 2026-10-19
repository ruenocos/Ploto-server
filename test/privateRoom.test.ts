import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { startServer, type RunningServer } from "../src/app.js";
import type { ServerConfig } from "../src/config/env.js";
import { createRequest, parse, stringify, type ProtooMessage } from "../src/signaling/protoo.js";

const config: ServerConfig = { host: "127.0.0.1", port: 0, downtime: 0, maintenanceReason: "" };

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
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("private rooms (shareable code)", () => {
  it("creates a code, a friend joins it, and both are matched into one room", async () => {
    const host = new Client(port, "lobby", "host");
    const friend = new Client(port, "lobby", "friend");
    await host.open();
    await friend.open();

    const created = (await host.req("mm:createRoom", {
      displayName: "Host",
      monsters: ["ember_pup", "prism_owl"],
    })) as { ok: boolean; data: { code: string } };
    expect(created.ok).toBe(true);
    expect(created.data.code).toMatch(/^[A-Z0-9]{4}$/);
    const code = created.data.code;

    const joined = (await friend.req("mm:joinRoom", {
      code,
      displayName: "Friend",
      monsters: ["stone_golem", "tide_serpent"],
    })) as { ok: boolean; data: { roomId: string; seat: number } };
    expect(joined.ok).toBe(true);
    expect(joined.data.seat).toBe(1);
    const roomId = joined.data.roomId;

    // Host is told to connect to the same room, as seat 0.
    await delay(20);
    const matched = host.notes.find((n) => n.method === "mm:matched");
    expect(matched).toBeDefined();
    const md = matched!.data as { roomId: string; seat: number };
    expect(md.roomId).toBe(roomId);
    expect(md.seat).toBe(0);

    // Both connect to the game room; player order is [host, friend].
    const gh = new Client(port, roomId, "host");
    const gf = new Client(port, roomId, "friend");
    await gh.open();
    await gf.open();
    const snap = (await gh.req("mm:getState", {})) as {
      data: { players: { displayName: string }[] };
    };
    expect(snap.data.players.map((p) => p.displayName)).toEqual(["Host", "Friend"]);

    host.close(); friend.close(); gh.close(); gf.close();
  });

  it("tells an invite link what it leads to before joining", async () => {
    const host = new Client(port, "lobby", "info-host");
    const guest = new Client(port, "lobby", "info-guest");
    await host.open();
    await guest.open();
    const created = (await host.req("mm:createRoom", { displayName: "Host", monsters: [], draft: true })) as { data: { code: string } };
    const info = (await guest.req("mm:roomInfo", { code: created.data.code.toLowerCase() })) as { ok: boolean; data: { draft: boolean; host: string } };
    expect(info.ok).toBe(true);
    expect(info.data).toMatchObject({ draft: true, host: "Host" });
    // a draft room needs no picks from the guest
    const joined = (await guest.req("mm:joinRoom", { code: created.data.code, displayName: "Guest", monsters: [] })) as { ok: boolean };
    expect(joined.ok).toBe(true);
    const gone = (await guest.req("mm:roomInfo", { code: created.data.code })) as { ok: boolean; errorReason?: string };
    expect(gone.ok).toBe(false);
    expect(gone.errorReason).toMatch(/expired/);
    host.close(); guest.close();
  });

  it("random rooms deal both teams: the guest joins without picking", async () => {
    const host = new Client(port, "lobby", "rnd-host");
    const guest = new Client(port, "lobby", "rnd-guest");
    await host.open();
    await guest.open();
    const created = (await host.req("mm:createRoom", { displayName: "Host", monsters: [], random: true })) as { data: { code: string; random: boolean } };
    expect(created.data.random).toBe(true);
    const info = (await guest.req("mm:roomInfo", { code: created.data.code })) as { data: { draft: boolean; random: boolean } };
    expect(info.data).toMatchObject({ draft: false, random: true });
    const joined = (await guest.req("mm:joinRoom", { code: created.data.code, displayName: "Guest", monsters: [] })) as { ok: boolean; data: { roomId: string } };
    expect(joined.ok).toBe(true);
    const g = new Client(port, joined.data.roomId, "rnd-guest");
    await g.open();
    const snap = (await g.req("mm:getState", {})) as { data: { randomTeams: boolean; players: { monsters: { id: string }[] }[] } };
    expect(snap.data.randomTeams).toBe(true);
    for (const p of snap.data.players) {
      expect(p.monsters).toHaveLength(2);
      expect(p.monsters[0]!.id).not.toBe(p.monsters[1]!.id);
    }
    host.close(); guest.close(); g.close();
  });

  it("rejects an unknown code", async () => {
    const c = new Client(port, "lobby", "x");
    await c.open();
    const res = (await c.req("mm:joinRoom", {
      code: "ZZZZ",
      displayName: "X",
      monsters: ["ember_pup", "prism_owl"],
    })) as { ok: boolean; errorReason?: string };
    expect(res.ok).toBe(false);
    expect(res.errorReason).toMatch(/not found/);
    c.close();
  });

  it("won't let the host join their own room", async () => {
    const c = new Client(port, "lobby", "solo");
    await c.open();
    const created = (await c.req("mm:createRoom", {
      displayName: "Solo",
      monsters: ["ember_pup", "prism_owl"],
    })) as { data: { code: string } };
    const res = (await c.req("mm:joinRoom", {
      code: created.data.code,
      displayName: "Solo",
      monsters: ["ember_pup", "prism_owl"],
    })) as { ok: boolean; errorReason?: string };
    expect(res.ok).toBe(false);
    expect(res.errorReason).toMatch(/your own room/);
    c.close();
  });
});
