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
import {
  MatchMonstersGame,
  abilityView,
  effectiveCost,
  fatigueDamage,
  type GameConfig,
} from "../game/matchmonsters/engine.js";
import { chooseEvolution, chooseMove } from "../game/matchmonsters/bot.js";
import type { Move, MoveResult, MonsterState, PlayerState } from "../game/matchmonsters/types.js";
import { BERRIES_TO_EVOLVE, FATIGUE_AFTER } from "../game/matchmonsters/types.js";
import type { MatchMode, MatchRecord } from "../stats/history.js";

/** Minimal view of a protoo peer, so rooms are testable without a live socket. */
export interface PeerLike {
  readonly id: string;
  notify(method: string, data: unknown): void;
}

export interface RoomOptions {
  /** Seat played by the built-in practice bot. Practice rooms also allow debug actions. */
  readonly botSeat?: 0 | 1;
  /** How the match came about, for match history. */
  readonly mode?: MatchMode;
  /** Signed-in account per seat (null = guest or bot), for match history. */
  readonly accounts?: readonly [string | null, string | null];
  /** Called once when the match ends. */
  readonly onFinished?: (room: GameRoom) => void;
  /** Set when the teams were drafted: the draft's time per step (null = no timer). A rematch drafts again. */
  readonly draftStepMs?: number | null;
}

/** Bot pacing: wait for the client's animations, then "think" a moment. */
const BOT_BASE_MS = 1100;
const BOT_PER_STEP_MS = 420;
/** Chance the bot plays a random legal move, so it's beatable. */
const BOT_SLOPPINESS = 0.25;

export class GameRoom {
  readonly game: MatchMonstersGame;
  readonly options: RoomOptions;
  readonly createdAt = new Date();
  private readonly config: GameConfig;
  private reported = false;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  /** How long the last move's animation runs on clients, roughly. */
  private lastAnimMs = 0;
  /** peerId -> player index (0 | 1). */
  private readonly seats = new Map<string, 0 | 1>();
  private readonly peers: (PeerLike | undefined)[] = [undefined, undefined];
  private readonly rematchVotes = new Set<0 | 1>();
  /** Room id of the rematch, once both players agreed. */
  rematchRoomId: string | null = null;

  constructor(config: GameConfig, options: RoomOptions = {}) {
    this.config = config;
    this.options = options;
    this.game = new MatchMonstersGame(config);
    this.seats.set(config.players[0].peerId, 0);
    this.seats.set(config.players[1].peerId, 1);
  }

  seatOf(peerId: string): 0 | 1 | undefined {
    return this.seats.get(peerId);
  }

  /**
   * Record a rematch vote after the game ends. The first vote notifies the
   * opponent; returns true once both players want a rematch.
   */
  voteRematch(seat: 0 | 1): boolean {
    if (!this.finished) throw new Error("the game isn't over yet");
    this.rematchVotes.add(seat);
    if (this.options.botSeat !== undefined) this.rematchVotes.add(this.options.botSeat); // always up for more
    if (this.rematchVotes.size < 2) {
      this.peers[seat === 0 ? 1 : 0]?.notify("mm:rematchRequested", { seat });
      return false;
    }
    return true;
  }

  /** Same players and monsters; the loser of this game opens the next one. */
  rematchConfig(matchId: string, seed: number): GameConfig {
    const loser: 0 | 1 = this.game.state.winner === 0 ? 1 : 0;
    return { ...this.config, matchId, seed, firstTurn: loser };
  }

  /** Point both players at the new room. */
  announceRematch(roomId: string): void {
    this.rematchRoomId = roomId;
    this.broadcast("mm:rematchReady", { roomId });
  }

  /**
   * Attach a connected peer to its reserved seat. Re-joining (e.g. after a page
   * reload) replaces the old connection and tells the opponent they're back.
   */
  join(peer: PeerLike): boolean {
    const seat = this.seats.get(peer.id);
    if (seat === undefined) return false;
    this.peers[seat] = peer;
    this.peers[seat === 0 ? 1 : 0]?.notify("mm:peerStatus", { seat, connected: true });
    this.scheduleBot();
    return true;
  }

  /** Hand the finished match to the history hook, once. */
  private report(): void {
    if (this.reported) return;
    this.reported = true;
    this.options.onFinished?.(this);
  }

  /** This match as a history row (call once it's finished). */
  toRecord(): MatchRecord {
    const s = this.game.state;
    const player = (i: 0 | 1) => {
      const p = s.players[i];
      const [a, b] = p.monsters as unknown as [MonsterState, MonsterState];
      return {
        accountId: this.options.accounts?.[i] ?? null,
        isBot: this.options.botSeat === i,
        displayName: p.displayName,
        monsters: [a.def.id, b.def.id] as const,
        evolutions: [a.evolution, b.evolution] as const,
        finalHp: p.hp,
      };
    };
    return {
      mode: this.options.mode ?? "quick",
      vsBot: this.options.botSeat !== undefined,
      firstTurn: this.config.firstTurn ?? 0,
      winner: s.winner,
      forfeitedBy: s.forfeitedBy,
      moves: s.moveNumber,
      turns: s.turnPasses,
      startedAt: this.createdAt,
      players: [player(0), player(1)],
    };
  }

  /** Stop any pending bot move (the room is being dropped). */
  dispose(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
  }

  /**
   * A peer's socket closed. Only counts if it's still the live connection for
   * that seat (a reload may already have replaced it).
   */
  leave(peer: PeerLike): void {
    const seat = this.seats.get(peer.id);
    if (seat === undefined || this.peers[seat] !== peer) return;
    this.peers[seat] = undefined;
    this.peers[seat === 0 ? 1 : 0]?.notify("mm:peerStatus", { seat, connected: false });
  }

  /** How many seats currently have a live connection. */
  connectedCount(): number {
    return this.peers.filter(Boolean).length;
  }

  get finished(): boolean {
    return this.game.state.phase === "finished";
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
        this.publishMove(result);
        return { accepted: true };
      }

      case "mm:forfeit": {
        const result = this.game.forfeit(seat);
        if (!result.ok) throw new Error(result.reason);
        this.dispose();
        this.broadcast("mm:gameOver", { winner: result.winner, matchId: this.game.state.matchId, forfeitedBy: seat });
        this.report();
        return { ok: true };
      }

      // Practice rooms only: shortcuts for trying things out.
      case "mm:debug": {
        if (this.options.botSeat === undefined) throw new Error("debug actions are only for practice games");
        const d = (data ?? {}) as Record<string, unknown>;
        const me = this.game.state.players[seat];
        if (d["action"] === "berries") me.berries += BERRIES_TO_EVOLVE;
        else if (d["action"] === "charge") {
          for (const m of me.monsters) m.charge = Math.max(m.charge, effectiveCost(m.def, m.evolution));
        } else throw new Error("unknown debug action");
        this.broadcast("mm:debug", { by: seat, action: d["action"] });
        return { ok: true };
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

  private publishMove(result: MoveResult): void {
    this.broadcast("mm:moveResult", result);
    if (result.finished) {
      this.broadcast("mm:gameOver", { winner: result.winner, matchId: this.game.state.matchId });
      this.report();
    }
    const steps = result.cascades.length + result.effectSteps.length;
    // Cast cards run ~1.1s each and every number lands with its own beat.
    this.lastAnimMs = steps * BOT_PER_STEP_MS + result.casts.length * 1100 + result.abilities.length * 400;
    this.scheduleBot();
  }

  /** If it's the bot's turn (and someone's watching), play after a human-ish pause. */
  private scheduleBot(): void {
    const botSeat = this.options.botSeat;
    if (botSeat === undefined || this.botTimer || this.finished) return;
    if (this.game.state.turn !== botSeat || this.connectedCount() === 0) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.botStep(botSeat);
    }, BOT_BASE_MS + this.lastAnimMs);
    this.botTimer.unref?.();
  }

  private botStep(seat: 0 | 1): void {
    if (this.finished || this.game.state.turn !== seat) return;
    const evolveId = chooseEvolution(this.game, seat);
    if (evolveId) {
      const evolved = this.game.evolve(seat, evolveId);
      if (evolved.ok) {
        this.broadcast("mm:evolved", { by: seat, monsterId: evolved.monsterId, evolution: evolved.evolution });
      }
    }
    const move = chooseMove(this.game, seat, { sloppiness: BOT_SLOPPINESS });
    if (!move) return;
    const result = this.game.applyMove(seat, move);
    if (result.ok) this.publishMove(result);
  }

  private snapshot() {
    const s = this.game.state;
    return {
      matchId: s.matchId,
      board: s.board.grid,
      ice: s.ice,
      turn: s.turn,
      movesLeft: s.movesLeft,
      turnPasses: s.turnPasses,
      /** Sudden-death damage the next player to start a turn will take (0 = not yet). */
      fatigueNext: fatigueDamage(s.turnPasses + 1),
      /** Turns until sudden death begins (0 once it has). */
      suddenDeathIn: Math.max(0, FATIGUE_AFTER - s.turnPasses),
      phase: s.phase,
      winner: s.winner,
      forfeitedBy: s.forfeitedBy,
      moveNumber: s.moveNumber,
      players: s.players.map(serializePlayer),
      connected: [0, 1].map((i) => i === this.options.botSeat || Boolean(this.peers[i])),
      /** Seat the practice bot plays, if this is a practice game. */
      botSeat: this.options.botSeat ?? null,
      /** Whether the teams were drafted (a rematch then drafts again). */
      drafted: this.options.draftStepMs !== undefined,
    };
  }

  private broadcast(method: string, payload: unknown): void {
    for (const peer of this.peers) peer?.notify(method, payload);
  }
}

function serializePlayer(p: PlayerState) {
  // No peerId here: it's the seat credential, and the opponent sees this.
  return {
    displayName: p.displayName,
    hp: p.hp,
    maxHp: p.maxHp,
    shield: p.shield,
    dots: p.dots,
    regen: p.regen,
    bubble: p.bubble,
    berries: p.berries,
    slow: p.slow,
    monsters: p.monsters.map(serializeMonster),
  };
}

function serializeMonster(m: MonsterState) {
  return {
    id: m.def.id,
    name: m.def.name,
    element: m.def.element,
    charge: m.charge,
    chargeCost: effectiveCost(m.def, m.evolution),
    evolution: m.evolution,
    sealed: m.sealed,
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
