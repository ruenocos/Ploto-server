import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { startServer, type RunningServer } from "../src/app.js";
import type { ServerConfig } from "../src/config/env.js";
import { createRequest, parse, stringify, type ProtooMessage } from "../src/signaling/protoo.js";
import { GameRoom } from "../src/signaling/gameRoom.js";
import { MONSTERS } from "../src/game/matchmonsters/monsters.js";
import { chooseMove } from "../src/game/matchmonsters/bot.js";
import { effectiveCost } from "../src/game/matchmonsters/engine.js";
import { openDb } from "../src/db/db.js";
import { MatchHistory, type MatchRecord } from "../src/stats/history.js";

const LAB_KEY = "test-lab-key";
const config: ServerConfig = { host: "127.0.0.1", port: 0, downtime: 0, maintenanceReason: "", statsKey: LAB_KEY };

class Client {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (m: ProtooMessage) => void>();
  readonly notes: { method: string; data: any }[] = [];
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
  async req(method: string, data: unknown): Promise<any> {
    const id = this.nextId++;
    const m = await new Promise<ProtooMessage>((res) => {
      this.pending.set(id, res);
      this.ws.send(stringify(createRequest(id, method, data)));
    });
    if (!("ok" in m) || !m.ok) throw new Error((m as { errorReason?: string }).errorReason ?? "request failed");
    return (m as { data: unknown }).data;
  }
  note(method: string) { return this.notes.find((n) => n.method === method); }
  close() { this.ws.close(); }
}

let server: RunningServer;
let base: string;
beforeAll(async () => {
  server = await startServer(config);
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(method: string, path: string, opts: { key?: string; body?: unknown; lab?: string } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}),
      ...(opts.lab ? { "x-lab-key": opts.lab } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe("anonymous accounts", () => {
  it("claims a unique username and signs in with the returned key", async () => {
    const made = await api("POST", "/api/accounts", { body: { username: "Gobbo" } });
    expect(made.status).toBe(201);
    expect(made.body.key).toMatch(/^mm_/);
    const me = await api("GET", "/api/me", { key: made.body.key });
    expect(me.body).toMatchObject({ username: "Gobbo", record: { games: 0, wins: 0 } });
  });

  it("rejects taken (any case), invalid and reserved names, and bad keys", async () => {
    expect((await api("POST", "/api/accounts", { body: { username: "gobbo" } })).status).toBe(409);
    expect((await api("POST", "/api/accounts", { body: { username: "a b" } })).status).toBe(400);
    expect((await api("POST", "/api/accounts", { body: { username: "Admin" } })).status).toBe(400);
    expect((await api("GET", "/api/me", { key: "mm_nope" })).status).toBe(401);
  });

  it("renames, keeping names unique", async () => {
    const a = await api("POST", "/api/accounts", { body: { username: "Renamer" } });
    expect((await api("PATCH", "/api/me", { key: a.body.key, body: { username: "Gobbo" } })).status).toBe(409);
    const ok = await api("PATCH", "/api/me", { key: a.body.key, body: { username: "Renamed" } });
    expect(ok.body.username).toBe("Renamed");
  });
});

describe("friends, DMs and invites", () => {
  it("befriends, messages, and invites a friend into a match", async () => {
    const ann = (await api("POST", "/api/accounts", { body: { username: "Ann" } })).body;
    const ben = (await api("POST", "/api/accounts", { body: { username: "Ben" } })).body;

    // Ben is online in the lobby, so he hears about things live.
    const benLobby = new Client(server.port, "lobby", "ben-peer");
    await benLobby.open();
    await benLobby.req("mm:auth", { key: ben.key });

    const req = await api("POST", "/api/friends", { key: ann.key, body: { username: "ben" } });
    expect(req.body.status).toBe("pending");
    await delay(20);
    expect(benLobby.note("social:changed")?.data).toMatchObject({ reason: "request", from: "Ann" });
    expect((await api("GET", "/api/friends", { key: ben.key })).body.incoming).toEqual([{ id: ann.id, username: "Ann" }]);

    // Messages need friendship.
    expect((await api("POST", `/api/messages/${ben.id}`, { key: ann.key, body: { body: "hi" } })).status).toBe(403);
    await api("POST", `/api/friends/${ann.id}/accept`, { key: ben.key });
    const friends = (await api("GET", "/api/friends", { key: ann.key })).body.friends;
    expect(friends).toEqual([{ id: ben.id, username: "Ben", online: true, unread: 0 }]);

    const sent = await api("POST", `/api/messages/${ben.id}`, { key: ann.key, body: { body: "rematch tonight?" } });
    expect(sent.status).toBe(200);
    await delay(20);
    expect(benLobby.note("social:message")?.data).toMatchObject({ body: "rematch tonight?", fromUsername: "Ann" });
    expect((await api("GET", "/api/friends", { key: ben.key })).body.friends[0].unread).toBe(1);
    const convo = (await api("GET", `/api/messages/${ann.id}`, { key: ben.key })).body;
    expect(convo.map((m: { body: string }) => m.body)).toEqual(["rematch tonight?"]);
    expect((await api("GET", "/api/friends", { key: ben.key })).body.friends[0].unread).toBe(0); // read now

    // Ann invites Ben; Ben sees her team and accepts; both land in one room.
    const annLobby = new Client(server.port, "lobby", "ann-peer");
    await annLobby.open();
    await annLobby.req("mm:auth", { key: ann.key });
    const inv = await annLobby.req("mm:invite", { friendId: ben.id, monsters: ["ember_pup", "prism_owl"] });
    await delay(20);
    const invite = benLobby.note("social:invite")!.data;
    expect(invite).toMatchObject({ inviteId: inv.inviteId, from: { username: "Ann" }, monsters: ["ember_pup", "prism_owl"] });
    const accepted = await benLobby.req("mm:acceptInvite", { inviteId: inv.inviteId, monsters: ["stone_golem", "tide_serpent"] });
    await delay(20);
    expect(annLobby.note("mm:matched")?.data.roomId).toBe(accepted.roomId);

    // In the game, players appear under their usernames and never see each other's peer ids.
    const g = new Client(server.port, accepted.roomId, "ben-peer");
    await g.open();
    const state = await g.req("mm:getState", {});
    expect(state.players.map((p: { displayName: string }) => p.displayName)).toEqual(["Ann", "Ben"]);
    expect(JSON.stringify(state)).not.toContain("ann-peer");

    // Going offline tells friends.
    benLobby.close();
    await delay(50);
    expect(annLobby.notes.some((n) => n.method === "social:presence" && n.data.online === false)).toBe(true);
    for (const c of [annLobby, g]) c.close();
  });

  it("won't invite strangers or offline friends", async () => {
    const cat = (await api("POST", "/api/accounts", { body: { username: "Cat" } })).body;
    const dan = (await api("POST", "/api/accounts", { body: { username: "Dan" } })).body;
    const lobby = new Client(server.port, "lobby", "cat-peer");
    await lobby.open();
    await lobby.req("mm:auth", { key: cat.key });
    await expect(lobby.req("mm:invite", { friendId: dan.id, monsters: ["ember_pup", "prism_owl"] })).rejects.toThrow(/friends/);
    await api("POST", "/api/friends", { key: cat.key, body: { username: "Dan" } });
    await api("POST", "/api/friends", { key: dan.key, body: { username: "Cat" } }); // mutual request = accepted
    await expect(lobby.req("mm:invite", { friendId: dan.id, monsters: ["ember_pup", "prism_owl"] })).rejects.toThrow(/offline/);
    lobby.close();
  });
});

describe("match history and the monster lab", () => {
  it("records a finished match through the room hook", async () => {
    const recorded: unknown[] = [];
    const room = new GameRoom(
      {
        matchId: "m", seed: 7, firstTurn: 0,
        players: [
          { peerId: "p0", displayName: "A", monsters: [MONSTERS["ember_pup"]!, MONSTERS["tide_serpent"]!] },
          { peerId: "p1", displayName: "B", monsters: [MONSTERS["stone_golem"]!, MONSTERS["prism_owl"]!] },
        ],
      },
      { mode: "private", accounts: [null, null], onFinished: (r) => recorded.push(r.toRecord()) },
    );
    // Rig a one-hit finish: both of seat 0's monsters fully charged, seat 1 on 1 HP.
    for (const m of room.game.state.players[0].monsters) m.charge = effectiveCost(m.def, 0);
    room.game.state.players[1].hp = 1;
    room.game.state.players[1].shield = 0;
    const move = chooseMove(room.game, 0)!;
    room.handleRequest("p0", "mm:move", move);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ mode: "private", winner: 0, vsBot: false, players: [{ monsters: ["ember_pup", "tide_serpent"] }, { finalHp: 0 }] });
  });

  it("aggregates monsters, matchups and teams, gated by the lab key", async () => {
    const db = await openDb();
    const history = new MatchHistory(db);
    const rec = (winner: 0 | 1, a: [string, string], b: [string, string], vsBot = false): MatchRecord => ({
      mode: vsBot ? "practice" : "quick", vsBot, firstTurn: 0, winner, moves: 40, turns: 20, startedAt: new Date(),
      players: [
        { accountId: null, isBot: false, displayName: "x", monsters: a, evolutions: [1, 0], finalHp: winner === 0 ? 30 : 0 },
        { accountId: null, isBot: vsBot, displayName: "y", monsters: b, evolutions: [0, 0], finalHp: winner === 1 ? 30 : 0 },
      ],
    });
    await history.record(rec(0, ["ember_pup", "tide_serpent"], ["stone_golem", "prism_owl"]));
    await history.record(rec(0, ["ember_pup", "halo_moth"], ["stone_golem", "tide_serpent"]));
    await history.record(rec(1, ["ember_pup", "halo_moth"], ["frost_imp", "prism_owl"]));
    await history.record(rec(1, ["ember_pup", "halo_moth"], ["frost_imp", "prism_owl"], true)); // practice: excluded by default

    const monsters = await history.monsters();
    const pup = monsters.find((m) => m.monster === "ember_pup")!;
    expect(pup).toMatchObject({ games: 3, wins: 2, winRate: 0.667, avgEvolution: 1 });
    expect((await history.monsters({ includeBot: true })).find((m) => m.monster === "ember_pup")!.games).toBe(4);
    const mu = await history.matchups();
    expect(mu.find((m) => m.monster === "ember_pup" && m.opponent === "stone_golem")).toMatchObject({ games: 2, wins: 2 });
    const teams = await history.teams();
    expect(teams.find((t) => t.team.join() === "ember_pup,halo_moth")).toMatchObject({ games: 2, wins: 1 });
    expect(await history.summary()).toMatchObject({ matches: 3, firstPlayerWinRate: 0.667 });
    expect((await history.recent())[0]!.teams).toHaveLength(2);
    await db.close();

    // Over HTTP: wrong key bounces, right key gets in.
    expect((await api("GET", "/api/monster-lab/monsters", { lab: "nope" })).status).toBe(403);
    const lab = await api("GET", "/api/monster-lab", { lab: LAB_KEY });
    expect(lab.status).toBe(200);
    expect(lab.body.roster).toContain("ember_pup");
    expect((await api("GET", `/api/monster-lab/summary?key=${LAB_KEY}`)).body).toHaveProperty("matches");
  });
});
