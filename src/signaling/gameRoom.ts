/**
 * A game room hosting one Match Monsters match over protoo.
 *
 * This maps protoo requests to engine moves and broadcasts results as protoo
 * notifications. The method names below (`mm:*`) are OUR provisional vocabulary:
 * they let the engine run end-to-end over the real framing today. The exact
 * names/payloads the original Match Monsters `client.zip` uses still need to be
 * read off that bundle; when they are, only this adapter changes — the engine
 * and transport stay put. (Marked ⏳ in docs/PROTOCOL.md.)
 */
import { MatchMonstersGame, abilityView, type GameConfig } from "../game/matchmonsters/engine.js";
import type { Move, MonsterState, PlayerState } from "../game/matchmonsters/types.js";

/** Minimal view of a protoo peer, so rooms are testable without a live socket. */
export interface PeerLike {
  readonly id: string;
  notify(method: string, data: unknown): void;
}


export class GameRoom {
  private readonly game: MatchMonstersGame;
  /** peerId -> player index (0 | 1). */
  private readonly seats = new Map<string, 0 | 1>();
  private readonly peers: (PeerLike | undefined)[] = [undefined, undefined];

  constructor(config: GameConfig) {
    this.game = new MatchMonstersGame(config);
    this.seats.set(config.players[0].peerId, 0);
    this.seats.set(config.players[1].peerId, 1);
  }

  /** Attach a connected peer to its reserved seat. */
  join(peer: PeerLike): boolean {
    const seat = this.seats.get(peer.id);
    if (seat === undefined) return false;
    this.peers[seat] = peer;
    return true;
  }

  /**
   * Handle a protoo request addressed to this room. Returns the response `data`
   * (resolved) or throws with a message used as the protoo errorReason.
   */
  handleRequest(peerId: string, method: string, data: unknown): unknown {
    const seat = this.seats.get(peerId);
    if (seat === undefined) throw new Error("peer is not seated in this room");

    switch (method) {
      case "mm:getState":
        return this.snapshot();

      case "mm:move": {
        const move = parseMove(data);
        const result = this.game.applyMove(seat, move);
        if (!result.ok) throw new Error(result.reason);
        this.broadcast("mm:moveResult", result);
        if (result.finished) {
          this.broadcast("mm:gameOver", {
            winner: result.winner,
            matchId: this.game.state.matchId,
          });
        }
        return { accepted: true };
      }

      case "mm:evolve": {
        const d = (data ?? {}) as Record<string, unknown>;
        const monsterId = typeof d["monsterId"] === "string" ? d["monsterId"] : "";
        const result = this.game.evolve(seat, monsterId);
        if (!result.ok) throw new Error(result.reason);
        this.broadcast("mm:evolved", {
          by: seat,
          monsterId: result.monsterId,
          evolution: result.evolution,
        });
        return { ok: true, evolution: result.evolution, berries: result.berries };
      }

      default:
        throw new Error(`unknown method: ${method}`);
    }
  }

  private snapshot() {
    const s = this.game.state;
    return {
      matchId: s.matchId,
      board: s.board.grid,
      turn: s.turn,
      movesLeft: s.movesLeft,
      phase: s.phase,
      winner: s.winner,
      moveNumber: s.moveNumber,
      players: s.players.map(serializePlayer),
    };
  }

  private broadcast(method: string, payload: unknown): void {
    for (const peer of this.peers) peer?.notify(method, payload);
  }
}

function serializePlayer(p: PlayerState) {
  return {
    peerId: p.peerId,
    displayName: p.displayName,
    hp: p.hp,
    maxHp: p.maxHp,
    shield: p.shield,
    dots: p.dots,
    berries: p.berries,
    monsters: p.monsters.map(serializeMonster),
  };
}

function serializeMonster(m: MonsterState) {
  return {
    id: m.def.id,
    name: m.def.name,
    element: m.def.element,
    charge: m.charge,
    chargeCost: m.def.chargeCost,
    evolution: m.evolution,
    ability: abilityView(m.def, m.evolution),
  };
}

function parseMove(data: unknown): Move {
  if (typeof data !== "object" || data === null) throw new Error("invalid move payload");
  const d = data as Record<string, unknown>;
  const from = d["from"] as Record<string, unknown> | undefined;
  const to = d["to"] as Record<string, unknown> | undefined;
  if (!from || !to) throw new Error("move requires from and to");
  const coord = (c: Record<string, unknown>, label: string) => {
    const x = c["x"];
    const y = c["y"];
    if (typeof x !== "number" || typeof y !== "number") {
      throw new Error(`invalid ${label} coordinate`);
    }
    return { x, y };
  };
  return { type: "swap", from: coord(from, "from"), to: coord(to, "to") };
}
