import { describe, it, expect } from "vitest";
import { GameRoom, type PeerLike } from "../src/signaling/gameRoom.js";
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
