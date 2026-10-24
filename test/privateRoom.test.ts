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

type Res<T = any> = { ok: boolean; data: T; errorReason?: string };

describe("private rooms (shareable code)", () => {
  it("hosts a room behind a code; a friend joins and the match starts in the same room", async () => {
    const host = new Client(port, "lobby", "host");
    const friend = new Client(port, "lobby", "friend");
    await host.open();
    await friend.open();

    const created = (await host.req("mm:host", { displayName: "Host", settings: { team: "pick" }, data: ["ember_pup", "prism_owl"] })) as Res<{ roomId: string; code: string; seat: number }>;
    expect(created.ok).toBe(true);
    expect(created.data.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(created.data.seat).toBe(0);
    const { code, roomId } = created.data;
    const gh = new Client(port, roomId, "host");
    await gh.open();
    const lobby = (await gh.req("lobby:getView", {})) as Res;
    expect(lobby.data).toMatchObject({ code, phase: "lobby", you: 0, host: 0, startRule: "full", settings: { team: "pick" } });

    const joined = (await friend.req("mm:join", { code, displayName: "Friend", data: ["stone_golem", "tide_serpent"] })) as Res<{ roomId: string; seat: number }>;
    expect(joined.ok).toBe(true);
    expect(joined.data).toMatchObject({ roomId, seat: 1 });

    // The host's room connection hears the start.
    await delay(20);
    expect(gh.notes.some((n) => n.method === "lobby:update" && (n.data as any).view.phase === "playing")).toBe(true);
    const gf = new Client(port, roomId, "friend");
    await gf.open();
    const snap = (await gh.req("mm:getState", {})) as Res<{ players: { displayName: string }[] }>;
    expect(snap.data.players.map((p) => p.displayName)).toEqual(["Host", "Friend"]);

    host.close(); friend.close(); gh.close(); gf.close();
  });

  it("tells a code what it leads to before joining; blind picks need the guest's two", async () => {
    const host = new Client(port, "lobby", "info-host");
    const guest = new Client(port, "lobby", "info-guest");
    await host.open();
    await guest.open();
    const created = (await host.req("mm:host", { displayName: "Host", settings: { team: "pick" }, data: ["ember_pup", "prism_owl"] })) as Res<{ code: string }>;
    const info = (await guest.req("mm:info", { code: created.data.code.toLowerCase() })) as Res;
    expect(info.ok).toBe(true);
    expect(info.data).toMatchObject({ team: "pick", host: "Host", seatsFree: 1, started: false });
    const noPicks = (await guest.req("mm:join", { code: created.data.code, displayName: "Guest" })) as Res;
    expect(noPicks.ok).toBe(false);
    expect(noPicks.errorReason).toMatch(/pick your two/);
    // a draft room needs no picks
    const draft = (await host.req("mm:host", { displayName: "Host", settings: { team: "draft" } })) as Res<{ code: string }>;
    const joined = (await guest.req("mm:join", { code: draft.data.code, displayName: "Guest" })) as Res;
    expect(joined.ok).toBe(true);
    const started = (await guest.req("mm:info", { code: draft.data.code })) as Res;
    expect(started.data.started).toBe(true);
    host.close(); guest.close();
  });

  it("random rooms deal both teams: the guest joins without picking", async () => {
    const host = new Client(port, "lobby", "rnd-host");
    const guest = new Client(port, "lobby", "rnd-guest");
    await host.open();
    await guest.open();
    const created = (await host.req("mm:host", { displayName: "Host", settings: { team: "random" } })) as Res<{ code: string }>;
    const joined = (await guest.req("mm:join", { code: created.data.code, displayName: "Guest" })) as Res<{ roomId: string }>;
    expect(joined.ok).toBe(true);
    const g = new Client(port, joined.data.roomId, "rnd-guest");
    await g.open();
    const snap = (await g.req("mm:getState", {})) as Res<{ randomTeams: boolean; players: { monsters: { id: string }[] }[] }>;
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
    const res = (await c.req("mm:join", { code: "ZZZZ", displayName: "X", data: ["ember_pup", "prism_owl"] })) as Res;
    expect(res.ok).toBe(false);
    expect(res.errorReason).toMatch(/doesn't lead anywhere/);
    c.close();
  });

  it("joining your own code keeps your seat (the match waits for someone else)", async () => {
    const c = new Client(port, "lobby", "solo");
    await c.open();
    const created = (await c.req("mm:host", { displayName: "Solo", settings: { team: "pick" }, data: ["ember_pup", "prism_owl"] })) as Res<{ code: string; roomId: string }>;
    const res = (await c.req("mm:join", { code: created.data.code, displayName: "Solo", data: ["ember_pup", "prism_owl"] })) as Res<{ seat: number }>;
    expect(res.ok).toBe(true);
    expect(res.data.seat).toBe(0);
    const info = (await c.req("mm:info", { code: created.data.code })) as Res;
    expect(info.data).toMatchObject({ seatsFree: 1, started: false });
    c.close();
  });

  it("quick rooms with the same team mode fill up together; a rematch keeps the picks", async () => {
    const a = new Client(port, "lobby", "qa");
    const b = new Client(port, "lobby", "qb");
    await a.open();
    await b.open();
    const ra = (await a.req("mm:quick", { displayName: "Ari", settings: { team: "pick" }, data: ["ember_pup", "prism_owl"] })) as Res<{ roomId: string; seat: number }>;
    const other = (await b.req("mm:quick", { displayName: "Bea", settings: { team: "draft" } })) as Res<{ roomId: string }>;
    expect(other.data.roomId).not.toBe(ra.data.roomId); // a draft queue of its own
    await b.req("lobby:leave", {}).catch(() => {});
    const rb = (await b.req("mm:quick", { displayName: "Bea", settings: { team: "pick" }, data: ["stone_golem", "tide_serpent"] })) as Res<{ roomId: string; seat: number }>;
    expect(rb.data).toMatchObject({ roomId: ra.data.roomId, seat: 1 });
    const ga = new Client(port, ra.data.roomId, "qa");
    const gb = new Client(port, ra.data.roomId, "qb");
    await ga.open();
    await gb.open();
    expect(((await ga.req("lobby:getView", {})) as Res).data).toMatchObject({ mode: "quick", phase: "playing" });
    await ga.req("mm:forfeit", {});
    const next = (await gb.req("lobby:rematch", {})) as Res<{ roomId: string; code: string }>;
    expect(next.ok).toBe(true);
    await delay(20);
    expect(ga.notes.some((n) => n.method === "lobby:update" && (n.data as any).view.rematch?.players?.includes("Bea"))).toBe(true);
    const same = (await ga.req("lobby:rematch", {})) as Res<{ roomId: string }>;
    expect(same.data.roomId).toBe(next.data.roomId);
    const g2 = new Client(port, next.data.roomId, "qa");
    await g2.open();
    const snap = (await g2.req("mm:getState", {})) as Res<{ players: { displayName: string; monsters: { id: string }[] }[] }>;
    expect(snap.data.players.map((p) => [p.displayName, p.monsters.map((m) => m.id)])).toEqual([["Bea", ["stone_golem", "tide_serpent"]], ["Ari", ["ember_pup", "prism_owl"]]]);
    for (const c of [a, b, ga, gb, g2]) c.close();
  });
});
