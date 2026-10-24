import { describe, it, expect } from "vitest";
import { __CLASS__Lobby } from "../src/game/__ID__/lobby.js";
import { parseSettings } from "../src/game/__ID__/room.js";

/** A lobby context with no server around it: rooms in a map, results captured. */
function fakeCtx() {
  const rooms = new Map<string, any>();
  const recorded: any[] = [];
  let n = 0;
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
    claimCode: () => `C${n++}`.padEnd(4, "X"),
    releaseCode: () => {},
  };
  return { ctx, rooms, recorded };
}
const peer = (id: string) => ({ id, notes: [] as { method: string; data: any }[], notify(method: string, data: unknown) { this.notes.push({ method, data }); } });

describe("__TITLE__", () => {
  it("clamps settings to what the game offers", () => {
    expect(parseSettings({ seats: 9, target: 7 })).toMatchObject({ seats: 4, target: 20 });
  });

  it("hosts a room, a friend joins by code, the host starts, and the result is recorded", async () => {
    const { ctx, rooms, recorded } = fakeCtx();
    const lobby = new __CLASS__Lobby(ctx);
    const a = peer("a"), b = peer("b");
    const hosted = (await lobby.handle(a, "__PREFIX__host", { displayName: "Ann", settings: { seats: 2, bots: false, target: 10 } })) as any;
    const joined = (await lobby.handle(b, "__PREFIX__join", { displayName: "Ben", code: hosted.code })) as any;
    expect(joined).toMatchObject({ roomId: hosted.roomId, seat: 1 });
    const room = rooms.get(hosted.roomId);
    room.join(a);
    room.join(b);
    expect(() => room.handleRequest("b", "lobby:start", {})).toThrow(/only the host/);
    room.handleRequest("a", "lobby:start", {});
    for (let i = 0; i < 10; i++) room.handleRequest("a", "__PREFIX__tap", {});
    expect(room.phase).toBe("over");
    expect(recorded[0]).toMatchObject({ gameId: "__ID__" });
    expect(recorded[0].players.map((p: any) => [p.displayName, p.place])).toEqual([["Ann", 1], ["Ben", 2]]);
    const next = room.handleRequest("b", "lobby:rematch", {});
    expect(rooms.get(next.roomId).seated()[0]).toMatchObject({ name: "Ben", kind: "player" });
    for (const r of rooms.values()) r.dispose();
  });

  it("practice fills the open seats with bots and starts when you connect", async () => {
    const { ctx, rooms } = fakeCtx();
    const lobby = new __CLASS__Lobby(ctx);
    const me = peer("me");
    const t = (await lobby.handle(me, "__PREFIX__practice", { displayName: "Mia" })) as any;
    const room = rooms.get(t.roomId);
    room.join(me);
    expect(room.phase).toBe("playing");
    expect(room.seated().filter((s: any) => s.kind === "bot").length).toBeGreaterThan(0);
    room.dispose();
  });
});
