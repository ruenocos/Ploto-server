import { describe, it, expect, vi, afterEach } from "vitest";
import { GameRoom, type PeerLike } from "../src/game/matchmonsters/gameRoom.js";
import type { GameConfig } from "../src/game/matchmonsters/engine.js";
import { MONSTERS } from "../src/game/matchmonsters/monsters.js";
import { ELEMENTS } from "../src/game/matchmonsters/types.js";

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

describe("GameRoom rematch", () => {
  function finishedRoom(winner: 0 | 1) {
    const room = new GameRoom(roomConfig());
    const a = new FakePeer("p0");
    const b = new FakePeer("p1");
    room.join(a);
    room.join(b);
    a.notifications.length = 0;
    b.notifications.length = 0;
    const s = room.game.state as { phase: string; winner: 0 | 1 | null };
    s.phase = "finished";
    s.winner = winner;
    return { room, a, b };
  }

  it("tells clients whether the teams were drafted (a drafted match re-drafts on rematch)", () => {
    const blind = new GameRoom(roomConfig());
    const drafted = new GameRoom(roomConfig(), { draftStepMs: null });
    const a = new FakePeer("p0");
    blind.join(a);
    drafted.join(a);
    expect((blind.handleRequest("p0", "mm:getState", {}) as { drafted: boolean }).drafted).toBe(false);
    expect((drafted.handleRequest("p0", "mm:getState", {}) as { drafted: boolean }).drafted).toBe(true);
  });

  it("refuses a rematch vote while the game is still running", () => {
    const room = new GameRoom(roomConfig());
    expect(() => room.voteRematch(0)).toThrow(/isn't over/);
  });

  it("asks the opponent on the first vote and agrees on the second", () => {
    const { room, a, b } = finishedRoom(0);
    expect(room.voteRematch(0)).toBe(false);
    expect(b.notifications).toEqual([{ method: "mm:rematchRequested", data: { seat: 0 } }]);
    expect(a.notifications).toHaveLength(0);
    expect(room.voteRematch(0)).toBe(false); // voting twice doesn't count double
    expect(room.voteRematch(1)).toBe(true);
    room.announceRematch("r2");
    expect(room.rematchRoomId).toBe("r2");
    expect(a.notifications.at(-1)).toEqual({ method: "mm:rematchReady", data: { roomId: "r2" } });
    expect(b.notifications.at(-1)).toEqual({ method: "mm:rematchReady", data: { roomId: "r2" } });
  });

  it("deals new teams for a random-teams rematch", () => {
    const room = new GameRoom(roomConfig(), { randomTeams: true });
    (room.game.state as { winner: 0 | 1 | null }).winner = 0;
    const teams = Array.from({ length: 12 }, (_, i) => room.rematchConfig(`m${i}`, i).players.map((p) => p.monsters.map((m) => m.id).join("+")).join(" vs "));
    expect(new Set(teams).size).toBeGreaterThan(1);
    for (const t of teams) for (const team of t.split(" vs ")) expect(new Set(team.split("+")).size).toBe(2);
  });

  it("keeps the teams and lets the loser open", () => {
    const { room } = finishedRoom(0);
    const cfg = room.rematchConfig("m2", 999);
    expect(cfg.firstTurn).toBe(1);
    expect(cfg.matchId).toBe("m2");
    expect(cfg.seed).toBe(999);
    expect(cfg.players.map((p) => p.monsters.map((m) => m.id))).toEqual([
      ["ember_pup", "prism_owl"],
      ["stone_golem", "tide_serpent"],
    ]);
    expect(finishedRoom(1).room.rematchConfig("m3", 1).firstTurn).toBe(0);
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

  it("shows the bot as connected and agrees to rematches", () => {
    const room = new GameRoom(roomConfig(), { botSeat: 1 });
    const snap = room.handleRequest("p0", "mm:getState", {}) as { connected: boolean[]; botSeat: number };
    expect(snap.connected).toEqual([false, true]);
    expect(snap.botSeat).toBe(1);
    (room.game.state as { phase: string }).phase = "finished";
    expect(room.voteRematch(0)).toBe(true);
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
    expect(room.voteRematch(0)).toBe(false); // rematch still possible afterwards
  });
});
