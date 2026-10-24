import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { WebSocket } from "ws";
import { TableRoom, parseSettings, DEFAULT_SETTINGS, type TableOptions } from "../src/game/holdem/room.js";
import { Rng } from "../src/game/matchmonsters/rng.js";
import { startServer, type RunningServer } from "../src/app.js";
import { createRequest, parse, stringify, type ProtooMessage } from "../src/signaling/protoo.js";

/** A fake connection that records every notification. */
function peer(id: string) {
  const notes: { method: string; data: any }[] = [];
  return { id, notes, notify: (method: string, data: unknown) => notes.push({ method, data }), last: () => notes[notes.length - 1]?.data };
}

const FAST = { turnMs: 40, bankMs: 30, awayMs: 10, botMs: [1, 2] as const, nextHandMs: 1, showdownMs: 1, quickStartMs: 30, animScale: 0 };

function table(over: Partial<TableOptions> = {}) {
  const r = new Rng(7);
  return new TableRoom({
    roomId: "r1", code: "ABCD", mode: "private", settings: { ...DEFAULT_SETTINGS, seats: 4 }, hosted: true,
    timing: FAST, random: () => r.next(), ...over,
  });
}

const until = async (cond: () => boolean, ms = 8000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await new Promise((res) => setTimeout(res, 2));
  }
};

describe("hold'em table settings", () => {
  it("clamps client settings to what the game offers", () => {
    expect(parseSettings({ seats: 9, chips: 123, timer: false, blindsEvery: 7, bots: false, botStyle: "silly" })).toEqual({ seats: 6, chips: 1000, timer: false, blindsEvery: 10, bots: false, botStyle: "sharp" });
    expect(parseSettings({ seats: 1, chips: 5000, blindsEvery: 0, botStyle: "relaxed" })).toMatchObject({ seats: 2, chips: 5000, blindsEvery: 0, botStyle: "relaxed" });
  });

  it("lets a practice table switch how its bots play mid-game, and nobody else", () => {
    const practice = table({ mode: "practice", hosted: false, settings: { ...DEFAULT_SETTINGS, seats: 3 } });
    practice.reserve({ peerId: "a", name: "Ann", accountId: null });
    practice.join(peer("a"));
    practice.handleRequest("a", "holdem:botStyle", { style: "relaxed" });
    expect(practice.settings.botStyle).toBe("relaxed");
    expect(() => practice.handleRequest("a", "holdem:botStyle", { style: "wild" })).toThrow(/unknown bot style/);
    const hosted = table();
    hosted.reserve({ peerId: "a", name: "Ann", accountId: null });
    hosted.join(peer("a"));
    expect(() => hosted.handleRequest("a", "holdem:botStyle", { style: "relaxed" })).toThrow(/practice/);
  });
});

describe("hold'em table lobby", () => {
  it("seats players, keeps the host's controls to the host, and starts with bots in empty seats", () => {
    const t = table();
    const a = peer("a"), b = peer("b");
    expect(t.reserve({ peerId: "a", name: "Ann", accountId: null })).toBe(0);
    expect(t.reserve({ peerId: "b", name: "Ben", accountId: null })).toBe(1);
    expect(t.reserve({ peerId: "a", name: "Ann", accountId: null })).toBe(0); // same seat again
    t.join(a);
    t.join(b);
    expect(() => t.handleRequest("b", "lobby:start", {})).toThrow(/only the host/);
    t.handleRequest("a", "lobby:addBot", { seat: 3 });
    expect(t.handleRequest("a", "holdem:getState", {})).toMatchObject({ phase: "lobby", host: 0, seats: [{ kind: "player" }, { kind: "player" }, { kind: "empty" }, { kind: "bot" }] });
    expect(() => t.handleRequest("a", "lobby:settings", { settings: { seats: 2 } })).toThrow(/free up/);
    t.handleRequest("a", "lobby:removeBot", { seat: 3 });
    t.handleRequest("a", "lobby:settings", { settings: { seats: 3, chips: 500 } });
    expect(t.settings).toMatchObject({ seats: 3, chips: 500 });
    t.handleRequest("a", "lobby:start", {});
    const v = t.handleRequest("a", "holdem:getState", {}) as any;
    expect(v.phase).toBe("playing");
    expect(v.seats.map((s: any) => s.kind)).toEqual(["player", "player", "bot"]);
    const full = table({ settings: { ...DEFAULT_SETTINGS, seats: 6 } });
    full.reserve({ peerId: "a", name: "Ann", accountId: null });
    full.reserve({ peerId: "b", name: "Ben", accountId: null });
    full.start();
    const bots = full.seated().filter((s) => s.kind === "bot").map((s) => s.name);
    expect(bots).toHaveLength(4);
    expect(new Set(bots).size).toBe(4); // every bot has its own name
    full.dispose();
    expect(() => t.reserve({ peerId: "c", name: "Cat", accountId: null })).toThrow(/already started/);
    t.dispose();
  });

  it("sends the platform's lobby view to every seat on each change", () => {
    const t = table({ settings: { ...DEFAULT_SETTINGS, seats: 3 } });
    const a = peer("a"), b = peer("b");
    t.reserve({ peerId: "a", name: "Ann", accountId: null });
    t.reserve({ peerId: "b", name: "Ben", accountId: null });
    t.join(a);
    t.join(b);
    t.handleRequest("a", "lobby:addBot", {});
    const lobbyOf = (p: ReturnType<typeof peer>) => p.notes.filter((n) => n.method === "lobby:update").at(-1)!.data.view;
    expect(lobbyOf(b)).toMatchObject({ code: "ABCD", gameId: "holdem", mode: "private", phase: "lobby", you: 1, host: 0, minPlayers: 2, fillsWithBots: true, startRule: "host" });
    expect(lobbyOf(b).seats.map((s: any) => [s.kind, s.connected])).toEqual([["player", true], ["player", true], ["bot", true]]);
    expect(t.handleRequest("a", "lobby:getView", {})).toMatchObject({ you: 0 });
    t.handleRequest("a", "lobby:start", {});
    expect(lobbyOf(a).phase).toBe("playing");
    t.dispose();
  });

  it("holds a seat for an invited friend and frees it if the invite ends", () => {
    const t = table({ settings: { ...DEFAULT_SETTINGS, seats: 2 } });
    t.reserve({ peerId: "a", name: "Ann", accountId: "acct-a" });
    expect(t.holdFor("acct-b", "Ben", "inv1")).toBe(1);
    expect(() => t.reserve({ peerId: "c", name: "Cat", accountId: null })).toThrow(/full/);
    t.release("inv1");
    expect(t.freeSeats()).toBe(1);
    t.holdFor("acct-b", "Ben", "inv2");
    expect(t.reserve({ peerId: "b", name: "Ben", accountId: "acct-b" })).toBe(1); // the invited account takes its held seat
    t.dispose();
  });

  it("needs two players without bots", () => {
    const t = table({ settings: { ...DEFAULT_SETTINGS, seats: 3, bots: false } });
    t.reserve({ peerId: "a", name: "Ann", accountId: null });
    expect(() => t.start()).toThrow(/at least 2/);
    t.dispose();
  });
});

describe("hold'em table play", () => {
  it("plays a whole Sit & Go: bots act, the clock acts for a silent player, and nobody sees others' cards early", async () => {
    let finished = false;
    const t = table({ settings: { ...DEFAULT_SETTINGS, seats: 3, chips: 500, blindsEvery: 5 }, onFinished: () => { finished = true; } });
    const a = peer("a");
    t.reserve({ peerId: "a", name: "Ann", accountId: null });
    t.join(a);
    t.start();
    // Ann never acts: the timer and her time bank run out, then she's put away and auto-acted quickly.
    await until(() => finished, 20000);
    const v = t.viewFor(0) as any;
    expect(v.phase).toBe("over");
    expect(v.results.map((r: any) => r.place).sort()).toEqual([1, 2, 3]);
    // Redaction: before a showdown, Ann's updates never contain another seat's hole cards.
    const updates = a.notes.filter((n) => n.method === "holdem:update");
    for (const n of updates) {
      for (const e of n.data.events) {
        if (e.type === "deal") for (const h of e.hands) if (h.seat !== 0) expect(h.cards).toBeNull();
      }
      for (const s of n.data.view.seats) {
        if (s.seat !== 0 && s.cards && n.data.view.street !== "handOver" && n.data.view.phase === "playing") {
          // Cards shown mid-hand only after a showdown reveal (all-in run-outs), never before.
          expect(n.data.events.some((e: any) => e.type === "showdown") || n.data.view.street === "showdown").toBe(true);
        }
      }
    }
    expect(updates.some((n) => n.data.events.some((e: any) => e.type === "timeout" && e.seat === 0))).toBe(true);
    t.dispose();
  }, 30000);

  it("keeps a turn's clock running across a reconnect instead of restarting it", async () => {
    const t = table({ settings: { ...DEFAULT_SETTINGS, seats: 2 }, timing: { ...FAST, turnMs: 5_000, awayMs: 3_000, botMs: [60_000, 60_001] } });
    const a = peer("a"), b = peer("b");
    t.reserve({ peerId: "a", name: "Ann", accountId: null });
    t.reserve({ peerId: "b", name: "Ben", accountId: null });
    t.join(a);
    t.join(b);
    t.start();
    const v = t.viewFor(0) as any;
    const mover = v.toAct === 0 ? a : b;
    const end = v.deadline as number;
    expect(end).toBeGreaterThan(Date.now());
    await new Promise((r) => setTimeout(r, 30));
    t.leave(mover);
    expect((t.viewFor(0) as any).deadline).toBeLessThanOrEqual(Date.now() + 3_000); // disconnected: the short clock
    t.join(mover);
    expect((t.viewFor(0) as any).deadline).toBe(end); // back: the same turn deadline as before
    t.dispose();
  });

  it("rejects out-of-turn and illegal actions with readable reasons", async () => {
    const t = table({ settings: { ...DEFAULT_SETTINGS, seats: 2 }, timing: { ...FAST, turnMs: 60_000, botMs: [60_000, 60_001] } });
    const a = peer("a"), b = peer("b");
    t.reserve({ peerId: "a", name: "Ann", accountId: null });
    t.reserve({ peerId: "b", name: "Ben", accountId: null });
    t.join(a);
    t.join(b);
    t.start();
    const v = t.viewFor(0) as any;
    const toAct = v.toAct as number;
    const other = toAct === 0 ? "b" : "a";
    const mover = toAct === 0 ? "a" : "b";
    expect(() => t.handleRequest(other, "holdem:act", { action: { type: "call" } })).toThrow(/not your turn/);
    expect(() => t.handleRequest(mover, "holdem:act", { action: { type: "raise", to: 1 } })).toThrow(/minimum/);
    expect(() => t.handleRequest(mover, "holdem:act", { action: { type: "dance" } })).toThrow(/unknown action/);
    t.handleRequest(mover, "holdem:act", { action: { type: "call" } });
    expect((t.viewFor(0) as any).toAct).not.toBe(toAct);
    t.dispose();
  });
});

// ------------------------------------------------------------ over the wire

class Client {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, (m: ProtooMessage) => void>();
  readonly notes: { method: string; data: any }[] = [];
  private ready: Promise<void>;
  constructor(port: number, roomId: string, peerId: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/?roomId=${roomId}&peerId=${peerId}`, "protoo");
    this.ready = new Promise((res, rej) => { this.ws.on("open", () => res()); this.ws.on("error", rej); });
    this.ws.on("message", (raw) => {
      const m = parse(String(raw));
      if ("response" in m) this.pending.get(m.id)?.(m);
      else if ("notification" in m) this.notes.push({ method: m.method, data: m.data });
    });
  }
  open() { return this.ready; }
  async req(method: string, data: unknown = {}): Promise<any> {
    const id = this.nextId++;
    const m = await new Promise<ProtooMessage>((res) => { this.pending.set(id, res); this.ws.send(stringify(createRequest(id, method, data))); });
    if (!("ok" in m) || !m.ok) throw new Error((m as { errorReason?: string }).errorReason ?? "request failed");
    return (m as { data: unknown }).data;
  }
  close() { this.ws.close(); }
}

describe("hold'em over the wire", () => {
  let server: RunningServer;
  beforeAll(async () => { server = await startServer({ host: "127.0.0.1", port: 0, downtime: 0, maintenanceReason: "" }); });
  afterAll(async () => { await server.close(); });

  it("hosts a table, a friend joins by code, the host starts, and both get live updates", async () => {
    const hostLobby = new Client(server.port, "lobby", "h");
    const guestLobby = new Client(server.port, "lobby", "g");
    await Promise.all([hostLobby.open(), guestLobby.open()]);
    const hosted = await hostLobby.req("holdem:host", { displayName: "Hana", settings: { seats: 3, timer: false } });
    expect(hosted.code).toMatch(/^[A-Z2-9]{4}$/);
    const info = await guestLobby.req("holdem:info", { code: hosted.code.toLowerCase() });
    expect(info).toMatchObject({ host: "Hana", seatsFree: 2, started: false, settings: { seats: 3, timer: false } });
    const joined = await guestLobby.req("holdem:join", { code: hosted.code, displayName: "Gus" });
    expect(joined.roomId).toBe(hosted.roomId);

    const host = new Client(server.port, hosted.roomId, "h");
    const guest = new Client(server.port, hosted.roomId, "g");
    await Promise.all([host.open(), guest.open()]);
    const before = await guest.req("holdem:getState");
    expect(before).toMatchObject({ phase: "lobby", you: 1, host: 0 });
    expect(before.seats.map((s: any) => s.name)).toEqual(["Hana", "Gus", ""]);
    await expect(guest.req("lobby:start")).rejects.toThrow(/only the host/);
    await host.req("lobby:start");
    await until(() => guest.notes.some((n) => n.method === "holdem:update" && n.data.view.phase === "playing"));
    const live = await guest.req("holdem:getState");
    expect(live.seats[2].kind).toBe("bot");
    expect(live.seats[1].cards).toHaveLength(2);
    expect(live.seats[0].cards).toBeNull();
    const games = (await (await fetch(`http://127.0.0.1:${server.port}/play/games`)).json()) as { id: string; online: number }[];
    expect(games.find((g) => g.id === "holdem")!.online).toBe(2);
    for (const c of [hostLobby, guestLobby, host, guest]) c.close();
  });

  it("practice deals as soon as you sit down", async () => {
    const lobby = new Client(server.port, "lobby", "p");
    await lobby.open();
    const t = await lobby.req("holdem:practice", { displayName: "Pia" });
    const room = new Client(server.port, t.roomId, "p");
    await room.open();
    await until(() => room.notes.some((n) => n.method === "holdem:update" && n.data.view.phase === "playing"));
    const v = await room.req("holdem:getState");
    expect(v.mode).toBe("practice");
    expect(v.settings.timer).toBe(false);
    expect(v.seats.filter((s: any) => s.kind === "bot")).toHaveLength(3);
    for (const c of [lobby, room]) c.close();
  });

  it("invites a friend to a seat; declining frees it, accepting takes it", async () => {
    const api = async (method: string, path: string, key?: string, body?: unknown) => {
      const res = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
        headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(key ? { authorization: `Bearer ${key}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return (await res.json()) as any;
    };
    const ivy = await api("POST", "/api/accounts", undefined, { username: "Ivy" });
    const jo = await api("POST", "/api/accounts", undefined, { username: "Joey" });
    await api("POST", "/api/friends", ivy.key, { username: "Joey" });
    await api("POST", "/api/friends", jo.key, { username: "Ivy" });
    const ivyLobby = new Client(server.port, "lobby", "ivy");
    const joLobby = new Client(server.port, "lobby", "jo");
    await Promise.all([ivyLobby.open(), joLobby.open()]);
    await ivyLobby.req("platform:auth", { key: ivy.key });
    await joLobby.req("platform:auth", { key: jo.key });
    const t = await ivyLobby.req("holdem:host", { settings: { seats: 2, bots: false } });
    const ivyRoom = new Client(server.port, t.roomId, "ivy");
    await ivyRoom.open();

    const first = await ivyLobby.req("holdem:invite", { friendId: jo.id, roomId: t.roomId });
    await until(() => joLobby.notes.some((n) => n.method === "social:invite"));
    expect(joLobby.notes.find((n) => n.method === "social:invite")!.data).toMatchObject({ inviteId: first.inviteId, gameId: "holdem", label: "Hold'em table", code: t.code });
    expect((await ivyRoom.req("holdem:getState")).seats[1]).toMatchObject({ kind: "invited", name: "Joey" });
    await joLobby.req("platform:declineInvite", { inviteId: first.inviteId });
    expect((await ivyRoom.req("holdem:getState")).seats[1].kind).toBe("empty");

    const second = await ivyLobby.req("holdem:invite", { friendId: jo.id, roomId: t.roomId });
    const accepted = await joLobby.req("holdem:acceptInvite", { inviteId: second.inviteId });
    expect(accepted.roomId).toBe(t.roomId);
    const joRoom = new Client(server.port, t.roomId, "jo");
    await joRoom.open();
    expect((await joRoom.req("holdem:getState")).seats.map((s: any) => [s.kind, s.name])).toEqual([["player", "Ivy"], ["player", "Joey"]]);
    await expect(joLobby.req("holdem:acceptInvite", { inviteId: second.inviteId })).rejects.toThrow(/expired/);
    for (const c of [ivyLobby, joLobby, ivyRoom, joRoom]) c.close();
  });

  it("quick tables share seats until they start", async () => {
    vi.useRealTimers();
    const a = new Client(server.port, "lobby", "qa");
    const b = new Client(server.port, "lobby", "qb");
    await Promise.all([a.open(), b.open()]);
    const ta = await a.req("holdem:quick", { displayName: "Ari" });
    const tb = await b.req("holdem:quick", { displayName: "Bea" });
    expect(tb.roomId).toBe(ta.roomId);
    const room = new Client(server.port, ta.roomId, "qa");
    await room.open();
    const v = await room.req("holdem:getState");
    expect(v).toMatchObject({ mode: "quick", phase: "lobby", host: -1 });
    expect(typeof v.startsAt).toBe("number");
    for (const c of [a, b, room]) c.close();
  });
});

describe("hold'em rematch and results", () => {
  it("records the result and opens a rematch table the next players join", async () => {
    const rooms = new Map<string, any>();
    const recorded: any[] = [];
    const ctx: any = {
      services: { results: { record: async (r: unknown) => { recorded.push(r); return "id"; } } },
      invites: { get: () => undefined, drop: () => {} },
      lobbyPeer: () => undefined,
      accountOf: () => undefined,
      nameFor: (_p: unknown, fallback: string) => fallback,
      addRoom: (id: string, room: unknown) => rooms.set(id, room),
      getRoom: (id: string) => rooms.get(id),
      removeRoom: (id: string) => rooms.delete(id),
      scheduleCleanup: () => {},
      claimCode: () => `C${rooms.size}`,
      releaseCode: () => {},
    };
    const { HoldemLobby } = await import("../src/game/holdem/lobby.js");
    const r = new Rng(11);
    const lobby = new HoldemLobby(ctx, { timing: FAST, random: () => r.next() });
    const me = peer("me");
    const t = (await lobby.handle(me, "holdem:practice", { displayName: "Mia", settings: { seats: 3, chips: 500 } })) as any;
    const room = rooms.get(t.roomId);
    room.join(me); // practice deals right away (no clock)
    room.handleRequest("me", "lobby:leave", {}); // Mia sits out, so the server plays for her
    await until(() => room.phase === "over", 20000);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ gameId: "holdem", mode: "practice" });
    expect(recorded[0].players.map((p: any) => p.place).sort()).toEqual([1, 2, 3]);
    expect(() => room.handleRequest("stranger", "lobby:rematch", {})).toThrow(/seat/);
    const next = room.handleRequest("me", "lobby:rematch", {}) as any;
    expect(next.roomId).not.toBe(t.roomId);
    expect(room.rematch).toEqual({ roomId: next.roomId, code: next.code, players: ["Mia"] });
    const fresh = rooms.get(next.roomId);
    expect(fresh.phase).toBe("lobby");
    expect(fresh.seated()[0]).toMatchObject({ kind: "player", name: "Mia" });
    expect(room.handleRequest("me", "lobby:rematch", {})).toEqual(next); // asking again lands at the same table
    expect(fresh.hosted).toBe(true);
    for (const x of rooms.values()) x.dispose();
  }, 30000);
});

describe("hold'em review fixes", () => {
  it("a quick table everyone left counts down again for the next player", async () => {
    const t = table({ mode: "quick", hosted: false, settings: { ...DEFAULT_SETTINGS, seats: 6 }, timing: { ...FAST, quickStartMs: 40 } });
    t.reserve({ peerId: "a", name: "Ann", accountId: null });
    expect(t.startsAt).not.toBeNull();
    t.handleRequest("a", "lobby:leave", {});
    expect(t.startsAt).toBeNull(); // nobody left: the countdown stops
    await new Promise((r) => setTimeout(r, 60));
    t.reserve({ peerId: "b", name: "Ben", accountId: null });
    expect(t.startsAt).toBeGreaterThan(Date.now());
    await until(() => t.phase === "playing", 2000); // and it does deal, with bots
    t.dispose();
  });

  it("a rejected action doesn't refund the time bank", async () => {
    const t = table({ settings: { ...DEFAULT_SETTINGS, seats: 2 }, timing: { ...FAST, turnMs: 10, bankMs: 400, botMs: [60_000, 60_001] } });
    const a = peer("a"), b = peer("b");
    t.reserve({ peerId: "a", name: "Ann", accountId: null });
    t.reserve({ peerId: "b", name: "Ben", accountId: null });
    t.join(a);
    t.join(b);
    t.start();
    const mover = (t.viewFor(0) as any).toAct === 0 ? "a" : "b";
    const seat = mover === "a" ? 0 : 1;
    await until(() => (t.viewFor(seat) as any).inBank === true, 1000);
    await new Promise((r) => setTimeout(r, 150));
    expect(() => t.handleRequest(mover, "holdem:act", { action: { type: "raise", to: 1 } })).toThrow(/minimum/);
    expect((t.viewFor(seat) as any).inBank).toBe(true); // still in the bank, still counting
    await new Promise((r) => setTimeout(r, 100));
    t.handleRequest(mover, "holdem:act", { action: { type: "call" } });
    expect((t.viewFor(seat) as any).bank).toBeLessThanOrEqual(0.2 * 1000); // ~250 ms of 400 spent (shown in whole seconds)
    t.dispose();
  });
});
