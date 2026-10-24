import { describe, it, expect, vi, afterEach } from "vitest";
import { GameRoom, type PeerLike } from "../src/game/matchmonsters/gameRoom.js";
import type { GameConfig } from "../src/game/matchmonsters/engine.js";
import { MONSTERS } from "../src/game/matchmonsters/monsters.js";
import { ELEMENTS } from "../src/game/matchmonsters/types.js";
import { MatchRoom, parsePicks, type MmSettings } from "../src/game/matchmonsters/matchRoom.js";

class FakePeer implements PeerLike {
  readonly notifications: { method: string; data: unknown }[] = [];
  constructor(readonly id: string) {}
  notify(method: string, data: unknown): void {
    this.notifications.push({ method, data });
  }
}

function roomConfig(): GameConfig {
  return {
    matchId: "m1",
    seed: 123,
    board: { width: 5, height: 5, palette: ELEMENTS },
    players: [
      { peerId: "p0", displayName: "Alice", monsters: [MONSTERS["ember_pup"]!, MONSTERS["prism_owl"]!] },
      { peerId: "p1", displayName: "Bob", monsters: [MONSTERS["stone_golem"]!, MONSTERS["tide_serpent"]!] },
    ],
  };
}

describe("GameRoom", () => {
  it("seats reserved peers and rejects strangers", () => {
    const room = new GameRoom(roomConfig());
    expect(room.join(new FakePeer("p0"))).toBe(true);
    expect(room.join(new FakePeer("intruder"))).toBe(false);
  });

  it("returns a state snapshot", () => {
    const room = new GameRoom(roomConfig());
    const snap = room.handleRequest("p0", "mm:getState", {}) as {
      turn: number;
      players: { monsters: unknown[] }[];
    };
    expect(snap.turn).toBe(0);
    expect(snap.players).toHaveLength(2);
    expect(snap.players[0]!.monsters).toHaveLength(2);
  });

  it("surfaces an illegal move as a thrown error and notifies no one", () => {
    const room = new GameRoom(roomConfig());
    const a = new FakePeer("p0");
    const b = new FakePeer("p1");
    room.join(a);
    room.join(b);
    a.notifications.length = 0; // ignore the "opponent connected" notice
    b.notifications.length = 0;
    // Non-adjacent tiles can never be swapped, whatever the board looks like.
    expect(() =>
      room.handleRequest("p0", "mm:move", { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }),
    ).toThrow(/adjacent/);
    expect(a.notifications).toHaveLength(0);
    expect(b.notifications).toHaveLength(0);
  });

  it("validates the move payload shape", () => {
    const room = new GameRoom(roomConfig());
    expect(() => room.handleRequest("p0", "mm:move", { from: { x: 0, y: 0 } })).toThrow(
      /from and to/,
    );
    expect(() => room.handleRequest("p0", "mm:move", {})).toThrow(/from and to/);
  });

  it("tells the opponent when a player disconnects and rejoins", () => {
    const room = new GameRoom(roomConfig());
    const a = new FakePeer("p0");
    const b1 = new FakePeer("p1");
    room.join(a);
    room.join(b1);
    expect(a.notifications.at(-1)).toEqual({ method: "mm:peerStatus", data: { seat: 1, connected: true } });

    // Page reload: the new connection joins before the old socket's close lands.
    const b2 = new FakePeer("p1");
    room.join(b2);
    room.leave(b1); // stale close — must be ignored
    expect(room.connectedCount()).toBe(2);

    room.leave(b2);
    expect(a.notifications.at(-1)).toEqual({ method: "mm:peerStatus", data: { seat: 1, connected: false } });
    expect(room.connectedCount()).toBe(1);
  });

  it("rejects an unknown method", () => {
    const room = new GameRoom(roomConfig());
    expect(() => room.handleRequest("p0", "bogus", {})).toThrow(/unknown method/);
  });

  it("rejects requests from an unseated peer", () => {
    const room = new GameRoom(roomConfig());
    expect(() => room.handleRequest("ghost", "mm:getState", {})).toThrow(/not seated/);
  });
});

describe("GameRoom drafted flag", () => {
  it("tells clients whether the teams were drafted", () => {
    const blind = new GameRoom(roomConfig());
    const drafted = new GameRoom(roomConfig(), { draftStepMs: null });
    const a = new FakePeer("p0");
    blind.join(a);
    drafted.join(a);
    expect((blind.handleRequest("p0", "mm:getState", {}) as { drafted: boolean }).drafted).toBe(false);
    expect((drafted.handleRequest("p0", "mm:getState", {}) as { drafted: boolean }).drafted).toBe(true);
  });
});

describe("MatchRoom (the platform's lobby room)", () => {
  const room = (settings: Partial<MmSettings> = {}, over: object = {}) =>
    new MatchRoom({ roomId: "r1", code: "ABCD", mode: "private", settings: { team: "pick", vsBot: false, ...settings }, hosted: true, ...over });
  const pick = (peerId: string, name: string, ids = ["ember_pup", "prism_owl"]) => ({ peerId, name, accountId: null, data: ids });

  it("checks blind picks, and starts the match as soon as both seats are taken", () => {
    expect(() => parsePicks(["ember_pup"], { team: "pick", vsBot: false })).toThrow(/pick your two/);
    expect(parsePicks(undefined, { team: "draft", vsBot: false })).toBeNull();
    const r = room();
    const a = new FakePeer("a"), b = new FakePeer("b");
    r.reserve(pick("a", "Ann"));
    r.join(a);
    expect(r.phase).toBe("lobby");
    r.reserve(pick("b", "Ben", ["stone_golem", "tide_serpent"]));
    r.join(b);
    expect(r.phase).toBe("playing");
    const snap = r.handleRequest("b", "mm:getState", {}) as { players: { displayName: string; monsters: { id: string }[] }[]; connected: boolean[] };
    expect(snap.players.map((p) => [p.displayName, p.monsters.map((m) => m.id)])).toEqual([["Ann", ["ember_pup", "prism_owl"]], ["Ben", ["stone_golem", "tide_serpent"]]]);
    expect(snap.connected).toEqual([true, true]);
    r.dispose();
  });

  it("deals random teams, and drafts first in a draft room", () => {
    const rnd = room({ team: "random" });
    rnd.reserve({ peerId: "a", name: "Ann", accountId: null });
    rnd.reserve({ peerId: "b", name: "Ben", accountId: null });
    expect((rnd.handleRequest("a", "mm:getState", {}) as { randomTeams: boolean }).randomTeams).toBe(true);
    rnd.dispose();
    const dr = room({ team: "draft" });
    dr.reserve({ peerId: "a", name: "Ann", accountId: null });
    dr.reserve({ peerId: "b", name: "Ben", accountId: null });
    expect(dr.handleRequest("a", "mm:getState", {})).toHaveProperty("draft");
    expect(() => dr.handleRequest("a", "mm:move", { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } })).toThrow(/draft isn't over/);
    dr.dispose();
  });

  it("practice seats the bot and starts when you connect", () => {
    const r = room({ vsBot: true }, { mode: "practice", autoStart: true });
    r.reserve(pick("a", "Ann"));
    expect(r.phase).toBe("lobby");
    r.join(new FakePeer("a"));
    expect(r.phase).toBe("playing");
    const snap = r.handleRequest("a", "mm:getState", {}) as { botSeat: number; players: { displayName: string }[] };
    expect(snap.botSeat).toBe(1);
    expect(snap.players[1]!.displayName).toBe("Bot");
    r.dispose();
  });

  it("a code joiner takes the seat an invite was holding, and the invite is withdrawn", () => {
    const bumped: string[] = [];
    const r = room({}, { onInviteBumped: (id: string) => bumped.push(id) });
    r.reserve({ ...pick("a", "Ann"), accountId: "acct-a" });
    r.holdFor("acct-f", "Fay", "inv1");
    r.reserve(pick("b", "Ben"));
    expect(bumped).toEqual(["inv1"]);
    expect(r.phase).toBe("playing");
    r.dispose();
  });

  it("reports the finished match once, through the platform", () => {
    let finished = 0;
    const r = room({}, { onFinished: () => finished++ });
    r.reserve(pick("a", "Ann"));
    r.reserve(pick("b", "Ben", ["stone_golem", "tide_serpent"]));
    r.handleRequest("b", "mm:forfeit", {});
    expect(finished).toBe(1);
    expect(r.phase).toBe("over");
    expect(r.game!.toRecord()).toMatchObject({ winner: 0, forfeitedBy: 1, mode: "private" });
    r.dispose();
  });
});

describe("GameRoom practice bot", () => {
  afterEach(() => vi.useRealTimers());

  it("plays its own turns once the human is connected", () => {
    vi.useFakeTimers();
    const room = new GameRoom({ ...roomConfig(), firstTurn: 1 }, { botSeat: 1 });
    vi.advanceTimersByTime(10_000);
    expect(room.game.state.moveNumber).toBe(0); // nobody watching yet
    const human = new FakePeer("p0");
    room.join(human);
    for (let i = 0; i < 10 && room.game.state.turn === 1; i++) vi.advanceTimersByTime(5_000);
    expect(room.game.state.moveNumber).toBeGreaterThan(0);
    expect(room.game.state.turn).toBe(0); // handed the turn back
    expect(human.notifications.some((n) => n.method === "mm:moveResult")).toBe(true);
    room.dispose();
  });

  it("sends each move with the room as of that move, not as of the latest one", () => {
    vi.useFakeTimers();
    const room = new GameRoom({ ...roomConfig(), firstTurn: 1 }, { botSeat: 1 });
    const human = new FakePeer("p0");
    room.join(human);
    for (let i = 0; i < 10 && room.game.state.turn === 1; i++) vi.advanceTimersByTime(5_000);
    const moves = human.notifications.filter((n) => n.method === "mm:moveResult")
      .map((n) => (n.data as { board: unknown; state: { board: unknown; moveNumber: number; turn: number } }));
    expect(moves.length).toBeGreaterThan(0);
    moves.forEach((m, i) => {
      expect(m.state.moveNumber).toBe(i + 1);
      expect(m.state.board).toEqual(m.board);
    });
    expect(moves.at(-1)!.state.turn).toBe(0); // the hand-back comes with the bot's last move
    room.dispose();
  });

  it("shows the bot as connected", () => {
    const room = new GameRoom(roomConfig(), { botSeat: 1 });
    const snap = room.handleRequest("p0", "mm:getState", {}) as { connected: boolean[]; botSeat: number };
    expect(snap.connected).toEqual([false, true]);
    expect(snap.botSeat).toBe(1);
  });

  it("allows debug shortcuts only in practice games", () => {
    const practice = new GameRoom(roomConfig(), { botSeat: 1 });
    practice.handleRequest("p0", "mm:debug", { action: "berries" });
    expect(practice.game.state.players[0].berries).toBe(4);
    practice.handleRequest("p0", "mm:debug", { action: "charge" });
    expect(practice.game.state.players[0].monsters.every((m) => m.charge > 0)).toBe(true);
    const real = new GameRoom(roomConfig());
    expect(() => real.handleRequest("p0", "mm:debug", { action: "berries" })).toThrow(/practice/);
  });
});

describe("GameRoom forfeit", () => {
  it("ends the match for either player at any time, rival wins, reported once", () => {
    const reports: unknown[] = [];
    const room = new GameRoom(roomConfig(), { onFinished: (r) => reports.push(r.toRecord()) });
    const a = new FakePeer("p0");
    const b = new FakePeer("p1");
    room.join(a);
    room.join(b);
    // p1 gives up while it's p0's turn.
    room.handleRequest("p1", "mm:forfeit", {});
    expect(room.finished).toBe(true);
    expect(a.notifications.at(-1)).toEqual({ method: "mm:gameOver", data: { winner: 0, matchId: "m1", forfeitedBy: 1 } });
    expect(reports).toEqual([expect.objectContaining({ winner: 0, forfeitedBy: 1 })]);
    expect(() => room.handleRequest("p0", "mm:forfeit", {})).toThrow(/finished/);
    expect(reports).toHaveLength(1);
    const snap = room.handleRequest("p0", "mm:getState", {}) as { forfeitedBy: number };
    expect(snap.forfeitedBy).toBe(1);
  });
});
