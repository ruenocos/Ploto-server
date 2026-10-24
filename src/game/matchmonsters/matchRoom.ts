/**
 * A Match Monsters room on the platform's lobby room (lobbyRoom.ts): two seats,
 * and it starts as soon as both are taken (by a player, or the bot in practice).
 * Seats, codes, invites, quick rooms and rematches are the platform's; this
 * room only turns two seated players into a match:
 *
 *   pick    each player sat down with their two monsters (blind picks)
 *   random  both teams are dealt at the start
 *   draft   a DraftRoom first (ban one each, then snake picks), then the game
 *
 * Once started, every request (`mm:*`) goes to the draft or the game, the same
 * connections and the same room id throughout.
 */
import { LobbyRoom, type LobbyRoomOptions, type LobbyRules, type Seat } from "../../platform/lobbyRoom.js";
import type { PeerLike } from "../../platform/peer.js";
import { DraftRoom } from "./draftRoom.js";
import { GameRoom, type RoomOptions } from "./gameRoom.js";
import type { GameConfig } from "./engine.js";
import { dealTeam, monsterById } from "./monsters.js";
import type { Monster } from "./types.js";

export const GAME_ID = "match_monsters";
/** Time per draft step in quick rooms (friends and practice have no timer). */
export const QUICK_DRAFT_STEP_MS = 20 * 1000;

export type TeamMode = "pick" | "draft" | "random";
export interface MmSettings {
  /** How teams are made: blind picks, a draft, or dealt at random. */
  readonly team: TeamMode;
  /** Practice: the open seat is the bot. */
  readonly vsBot: boolean;
}

export const DEFAULT_SETTINGS: MmSettings = { team: "pick", vsBot: false };

export function parseSettings(raw: unknown, base: MmSettings = DEFAULT_SETTINGS): MmSettings {
  const d = (raw ?? {}) as Record<string, unknown>;
  const team = (["pick", "draft", "random"] as const).find((t) => t === d["team"]) ?? base.team;
  return { team, vsBot: base.vsBot };
}

/** A player's two monsters, checked (blind picks need them; drafts and random teams don't). */
export function parsePicks(raw: unknown, settings: MmSettings): [string, string] | null {
  if (settings.team !== "pick") return null;
  const ids = Array.isArray(raw) ? raw.filter((m): m is string => typeof m === "string" && !!monsterById(m)) : [];
  if (ids.length < 2) throw new Error("this is a blind-pick match: pick your two monsters first");
  return [ids[0]!, ids[1]!];
}

const RULES: LobbyRules = { start: "full", minPlayers: 2, bots: true, invitesHoldSeats: false };

export class MatchRoom extends LobbyRoom<MmSettings> {
  readonly gameId = GAME_ID;
  /** The draft, then the game (null until the start). */
  inner: DraftRoom | GameRoom | null = null;

  constructor(options: LobbyRoomOptions<MmSettings>) {
    super(options, RULES);
  }

  /** The match itself, once the teams are in. */
  get game(): GameRoom | null {
    return this.inner instanceof GameRoom ? this.inner : null;
  }

  // ------------------------------------------------------------ the lobby's hooks

  protected capacity(): number {
    return 2;
  }

  protected emptySeat(): Seat {
    return { kind: "empty", peerId: null, accountId: null, name: "", inviteId: null, data: null };
  }

  protected fillsWithBots(settings: MmSettings): boolean {
    return settings.vsBot;
  }

  protected parseSettings(raw: unknown, base: MmSettings): MmSettings {
    return parseSettings(raw, base);
  }

  protected override botName(_seats?: readonly Seat[]): string {
    return "Bot";
  }

  protected startGame(): void {
    const seats = this.seats;
    const botIndex = seats.findIndex((s) => s.kind === "bot");
    const botSeat = botIndex === 0 || botIndex === 1 ? botIndex : undefined;
    const firstTurn = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
    const { team } = this.settings;
    const teamOf = (s: Seat): [Monster, Monster] => {
      const ids = s.data as [string, string] | null;
      if (team !== "pick" || s.kind === "bot" || !ids) return dealTeam();
      return [monsterById(ids[0])!, monsterById(ids[1])!];
    };
    const players = seats.map((s, i) => ({
      peerId: s.kind === "bot" ? `bot:${this.roomId}:${i}` : s.peerId!,
      displayName: s.name,
      monsters: teamOf(s),
    })) as [GameConfig["players"][0], GameConfig["players"][1]];
    const matchId = this.roomId;
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const config = (teams: readonly [[Monster, Monster], [Monster, Monster]]): GameConfig => ({
      matchId,
      seed,
      firstTurn,
      players: [
        { ...players[0], monsters: teams[0] },
        { ...players[1], monsters: teams[1] },
      ],
    });
    const options: RoomOptions = {
      mode: this.mode,
      accounts: [seats[0]!.accountId, seats[1]!.accountId],
      ...(botSeat !== undefined ? { botSeat } : {}),
      ...(team === "random" ? { randomTeams: true } : {}),
      onFinished: () => this.finish(),
    };
    if (team === "draft") {
      const stepMs = this.mode === "quick" ? QUICK_DRAFT_STEP_MS : null; // friends and the bot draft at their own pace
      this.inner = new DraftRoom([players[0], players[1]], {
        firstTurn,
        stepMs,
        ...(botSeat !== undefined ? { botSeat } : {}),
        onDone: (teams) => {
          const game = new GameRoom(config(teams), { ...options, draftStepMs: stepMs });
          this.inner = game;
          for (const p of this.peers.values()) game.join(p);
          for (const p of this.peers.values()) p.notify("mm:draftDone", {});
        },
        // A player left the draft: the match is off.
        onCancel: () => {
          this.inner = null;
          this.phase = "over";
          this.changed();
        },
      });
    } else {
      this.inner = new GameRoom(config([players[0].monsters, players[1].monsters]), options);
    }
    for (const p of this.peers.values()) this.inner.join(p);
  }

  /** The draft's and the game's own methods. */
  protected gameRequest(seat: number, method: string, d: Record<string, unknown>): unknown {
    if (!this.inner) throw new Error(this.phase === "lobby" ? "the match hasn't started yet" : "this match is over");
    return this.inner.handleRequest(this.seats[seat]!.peerId!, method, d);
  }

  // ------------------------------------------------------------ connections

  override join(peer: PeerLike): boolean {
    const before = this.inner;
    if (!super.join(peer)) return false;
    // A match that just started on this join already has everyone connected.
    if (before && before === this.inner) this.inner.join(peer);
    return true;
  }

  override leave(peer: PeerLike): void {
    if (this.peers.get(peer.id) !== peer) return;
    super.leave(peer);
    this.inner?.leave(peer);
  }

  override dispose(): void {
    this.inner?.dispose();
    super.dispose();
  }
}
