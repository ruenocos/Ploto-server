/**
 * Match Monsters' lobby methods (`mm:*` on the lobby socket): quick play,
 * private rooms by code, friend invites, practice against the bot, and
 * rematches. Rooms it opens are a DraftRoom while drafting, swapped for the
 * GameRoom once both teams are in.
 *
 *   mm:enqueue / mm:cancel                quick play (draft and random queues are separate)
 *   mm:createRoom / mm:roomInfo / mm:joinRoom / mm:cancelRoom
 *                                         a private room behind a 4-letter code
 *   mm:invite / mm:acceptInvite           a friend invite (declining/cancelling is platform:*)
 *   mm:practice                           a match against the built-in bot
 *   mm:rematch (room connection)          both players agree; a fresh room opens
 *
 * On a pair, both peers get an `mm:matched` notification carrying the game
 * roomId to connect to.
 */
import { randomUUID } from "node:crypto";
import { Matchmaker, type QueueKey, type Ticket } from "../../matchmaking/pool.js";
import type { GameLobby, LobbyContext, Room } from "../../platform/lobby.js";
import type { PeerLike } from "../../signaling/gameRoom.js";
import { GameRoom, type RoomOptions } from "../../signaling/gameRoom.js";
import { DraftRoom } from "../../signaling/draftRoom.js";
import type { MatchMode } from "../../stats/history.js";
import type { GameConfig } from "./engine.js";
import { dealTeam, monsterById, MONSTERS } from "./monsters.js";
import type { Monster } from "./types.js";

export const GAME_ID = "match_monsters";
/** Time per draft step in Quick Play (friend rooms and practice have no timer). */
const QUICK_DRAFT_STEP_MS = 20 * 1000;

interface PlayerDesc {
  readonly peerId: string;
  readonly displayName: string;
  readonly monsters: [Monster, Monster];
}

interface RoomSetup {
  readonly roomId: string;
  readonly matchId: string;
  readonly seed: number;
  readonly firstTurn: 0 | 1;
  readonly players: readonly [PlayerDesc, PlayerDesc];
  /** undefined = blind picks; a number or null = draft first (ms per step, null = no timer). */
  readonly stepMs: number | null | undefined;
  readonly options: RoomOptions;
}

/** What a Match Monsters invite carries: the host's choice of mode and how they're seated. */
interface MmInvite {
  readonly draft: boolean;
  readonly random: boolean;
  readonly host: PlayerDesc;
}

interface PendingRoom {
  readonly code: string;
  readonly draft: boolean;
  readonly random: boolean;
  readonly hostPeerId: string;
  readonly host: PlayerDesc;
}

export class MatchMonstersLobby implements GameLobby {
  readonly gameId = GAME_ID;
  readonly prefix = "mm:";
  private readonly matchmaker = new Matchmaker();
  private readonly picks = new Map<string, [Monster, Monster]>();
  /** Private rooms waiting on a friend, keyed by their share code. */
  private readonly pendingRooms = new Map<string, PendingRoom>();

  constructor(private readonly ctx: LobbyContext) {}

  waitingCount(): number {
    return this.matchmaker.waitingTotal();
  }

  peerGone(peerId: string): void {
    this.matchmaker.cancel(peerId);
    this.removePendingByHost(peerId);
    this.picks.delete(peerId);
  }

  roomRequest(_roomId: string, room: Room, peer: PeerLike, method: string): unknown {
    if (method !== "mm:rematch") return undefined;
    if (!(room instanceof GameRoom)) throw new Error("the game hasn't started yet");
    return this.handleRematch(room, peer);
  }

  async handle(peer: PeerLike, method: string, data: unknown): Promise<unknown> {
    const { ctx } = this;
    switch (method) {
      // --- Friend invites: a private match without sharing a code ---
      case "mm:invite": {
        const me = ctx.accountOf(peer);
        if (!me) throw new Error("sign in to invite friends");
        const d = (data ?? {}) as Record<string, unknown>;
        const friendId = typeof d["friendId"] === "string" ? d["friendId"] : "";
        if (!(await ctx.services.social.areFriends(me.id, friendId))) throw new Error("you can only invite friends");
        if (!ctx.services.presence.isOnline(friendId)) throw new Error("they're offline right now");
        const req = parseEnqueue(data);
        const host: PlayerDesc = { peerId: peer.id, displayName: me.username, monsters: req.monsters };
        const inv = ctx.invites.create<MmInvite>({
          gameId: GAME_ID,
          label: `Match Monsters · ${req.draft ? "Draft" : req.random ? "Random" : "Pick"}`,
          from: { id: me.id, username: me.username },
          to: friendId,
          hostPeerId: peer.id,
          exclusive: true, // one rival at a time
          data: { draft: req.draft, random: req.random, host },
          // The invite card shows the host's team for blind picks.
          extra: { monsters: req.draft || req.random ? [] : req.monsters.map((m) => m.id), draft: req.draft, random: req.random },
        });
        return { inviteId: inv.id, expiresInMs: inv.createdAt + 90_000 - Date.now() };
      }

      case "mm:acceptInvite": {
        const me = ctx.accountOf(peer);
        const d = (data ?? {}) as Record<string, unknown>;
        const inv = ctx.invites.get(d["inviteId"]);
        if (!me || !inv || inv.to !== me.id || inv.gameId !== GAME_ID) throw new Error("that invite has expired");
        if (!ctx.lobbyPeer(inv.hostPeerId)) {
          ctx.invites.drop(inv, "cancelled");
          throw new Error("they left the lobby");
        }
        const { draft, random, host } = inv.data as MmInvite;
        const req = parseEnqueue(data);
        if (!draft && !random && !req.picked) throw new Error("this is a blind-pick match: pick your two monsters first");
        ctx.invites.drop(inv, "accepted");
        const guest = { peerId: peer.id, displayName: me.username, monsters: random ? randomPicks() : req.monsters };
        const spawned = this.spawnRoom(host, guest, "invite", draft, random);
        return { roomId: spawned.roomId, matchId: spawned.matchId, seat: 1, firstTurn: spawned.firstTurn };
      }

      case "mm:enqueue": {
        const req = parseEnqueue(data);
        this.picks.set(peer.id, req.monsters);
        const ticket: Ticket = {
          peerId: peer.id,
          displayName: ctx.nameFor(peer, req.displayName),
          key: req.key,
          enqueuedAt: Date.now(),
        };
        const match = this.matchmaker.enqueue(ticket);
        if (!match) return { queued: true, waiting: this.matchmaker.waiting(req.key) };

        const [a, b] = match.players;
        this.openRoom({
          roomId: match.roomId,
          matchId: match.matchId,
          seed: match.seed,
          firstTurn: match.firstTurn,
          players: [
            { peerId: a.peerId, displayName: a.displayName, monsters: this.picksFor(a.peerId) },
            { peerId: b.peerId, displayName: b.displayName, monsters: this.picksFor(b.peerId) },
          ],
          // Both tickets share the queue key, and draft queues are separate, so both drafted.
          stepMs: req.draft ? QUICK_DRAFT_STEP_MS : undefined,
          options: this.roomOptions("quick", a.peerId, b.peerId, req.random ? { randomTeams: true } : {}),
        });

        this.notifyMatched(a.peerId, match.roomId, match.matchId, 0, match.firstTurn);
        this.notifyMatched(b.peerId, match.roomId, match.matchId, 1, match.firstTurn);
        return { queued: false, roomId: match.roomId, matchId: match.matchId, seat: 1 };
      }

      case "mm:cancel":
        this.matchmaker.cancel(peer.id);
        return { cancelled: true };

      // --- Private rooms: share a code / link instead of queueing ---
      case "mm:createRoom": {
        const req = parseEnqueue(data);
        const code = this.makeCode();
        this.pendingRooms.set(code, {
          code,
          hostPeerId: peer.id,
          draft: req.draft,
          random: req.random,
          host: { peerId: peer.id, displayName: ctx.nameFor(peer, req.displayName), monsters: req.monsters },
        });
        return { code, draft: req.draft, random: req.random };
      }

      // What an invite link leads to, before joining: draft rooms are joined straight
      // away, blind-pick rooms first need the guest's two monsters.
      case "mm:roomInfo": {
        const d = (data ?? {}) as Record<string, unknown>;
        const code = typeof d["code"] === "string" ? d["code"].trim().toUpperCase() : "";
        const pending = this.pendingRooms.get(code);
        if (!pending) throw new Error("that invite has expired");
        return { code, draft: pending.draft, random: pending.random, host: pending.host.displayName };
      }

      case "mm:joinRoom": {
        const req = parseEnqueue(data);
        const d = (data ?? {}) as Record<string, unknown>;
        const code = typeof d["code"] === "string" ? d["code"].trim().toUpperCase() : "";
        const pending = this.pendingRooms.get(code);
        if (!pending) throw new Error("room not found or expired");
        if (pending.hostPeerId === peer.id) throw new Error("cannot join your own room");
        if (!pending.draft && !pending.random && !req.picked) throw new Error("this room uses blind picks: pick your two monsters first");
        this.pendingRooms.delete(code);
        const joiner = {
          peerId: peer.id,
          displayName: ctx.nameFor(peer, req.displayName),
          monsters: pending.random ? randomPicks() : req.monsters, // the host's mode decides
        };
        const spawned = this.spawnRoom(pending.host, joiner, "private", pending.draft, pending.random);
        return { roomId: spawned.roomId, matchId: spawned.matchId, seat: 1, firstTurn: spawned.firstTurn };
      }

      // --- Practice: play the built-in bot (debug shortcuts allowed) ---
      case "mm:practice": {
        const req = parseEnqueue(data);
        const roomId = randomUUID();
        const matchId = randomUUID();
        const firstTurn = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
        this.openRoom({
          roomId,
          matchId,
          seed: (Math.random() * 0xffffffff) >>> 0,
          firstTurn,
          players: [
            { peerId: peer.id, displayName: ctx.nameFor(peer, req.displayName), monsters: req.monsters },
            { peerId: `bot:${randomUUID()}`, displayName: "Bot", monsters: randomPicks() },
          ],
          stepMs: req.draft ? null : undefined, // the bot drafts too; no timer
          options: this.roomOptions("practice", peer.id, null, { botSeat: 1, ...(req.random ? { randomTeams: true } : {}) }),
        });
        ctx.scheduleCleanup(roomId); // cancelled once the player connects
        this.notifyMatched(peer.id, roomId, matchId, 0, firstTurn);
        return { roomId, matchId, seat: 0, firstTurn };
      }

      case "mm:cancelRoom":
        this.removePendingByHost(peer.id);
        return { cancelled: true };

      default:
        throw new Error(`unknown lobby method: ${method}`);
    }
  }

  /**
   * A player asked for a rematch. Once both have, spin up a fresh room (the
   * loser opens) and send both players there: the same teams after blind
   * picks, a fresh draft (same timer rules) after a draft.
   */
  private handleRematch(room: GameRoom, peer: PeerLike): unknown {
    const seat = room.seatOf(peer.id);
    if (seat === undefined) throw new Error("peer is not seated in this room");
    if (room.rematchRoomId) return { roomId: room.rematchRoomId };
    if (!room.voteRematch(seat)) return { waiting: true };
    const roomId = randomUUID();
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const config = room.rematchConfig(randomUUID(), seed);
    const options: RoomOptions = { ...room.options, mode: "rematch" };
    if (room.options.draftStepMs !== undefined) {
      this.openRoom({
        roomId, matchId: config.matchId, seed, firstTurn: config.firstTurn ?? 0,
        players: config.players, stepMs: room.options.draftStepMs, options,
      });
    } else {
      this.ctx.addRoom(roomId, new GameRoom(config, options));
    }
    this.ctx.scheduleCleanup(roomId); // cancelled as soon as a player connects
    room.announceRematch(roomId);
    return { roomId };
  }

  /** Options every new room gets: who's who (for history) and the history hook. */
  private roomOptions(mode: MatchMode, a: string, b: string | null, extra: RoomOptions = {}): RoomOptions {
    return {
      ...extra,
      mode,
      accounts: [this.ctx.accountOf(a)?.id ?? null, b ? (this.ctx.accountOf(b)?.id ?? null) : null],
      onFinished: (room) => {
        this.ctx.services.history.record(room.toRecord()).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("failed to record match:", err);
        });
      },
    };
  }

  /**
   * Open a room for two seated players: straight into the game with their
   * blind picks, or (with `stepMs` set, null meaning no timer) a draft first,
   * which becomes the game room once both teams are in.
   */
  private openRoom(setup: RoomSetup): void {
    const { roomId, matchId, seed, firstTurn, players, stepMs, options } = setup;
    const config = (teams: readonly [[Monster, Monster], [Monster, Monster]]): GameConfig => ({
      matchId,
      seed,
      firstTurn,
      players: [
        { peerId: players[0].peerId, displayName: players[0].displayName, monsters: teams[0] },
        { peerId: players[1].peerId, displayName: players[1].displayName, monsters: teams[1] },
      ],
    });
    if (stepMs === undefined) {
      this.ctx.addRoom(roomId, new GameRoom(config([players[0].monsters, players[1].monsters]), options));
      return;
    }
    const draftRoom: DraftRoom = new DraftRoom([players[0], players[1]], {
      firstTurn,
      stepMs,
      ...(options.botSeat !== undefined ? { botSeat: options.botSeat } : {}),
      onDone: (teams, peers) => {
        const game = new GameRoom(config(teams), { ...options, draftStepMs: stepMs });
        this.ctx.addRoom(roomId, game);
        for (const p of peers) if (p) game.join(p);
        for (const p of peers) p?.notify("mm:draftDone", {});
      },
      onCancel: () => this.ctx.removeRoom(roomId, draftRoom),
    });
    this.ctx.addRoom(roomId, draftRoom);
  }

  /** Build a room for two described players (draft or blind) and tell both to connect. */
  private spawnRoom(
    a: PlayerDesc,
    b: PlayerDesc,
    mode: MatchMode,
    draft = false,
    random = false,
  ): { roomId: string; matchId: string; firstTurn: 0 | 1 } {
    const roomId = randomUUID();
    const matchId = randomUUID();
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const firstTurn = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
    this.openRoom({
      roomId, matchId, seed, firstTurn, players: [a, b],
      stepMs: draft ? null : undefined, // friends draft at their own pace
      options: this.roomOptions(mode, a.peerId, b.peerId, random ? { randomTeams: true } : {}),
    });
    this.notifyMatched(a.peerId, roomId, matchId, 0, firstTurn);
    this.notifyMatched(b.peerId, roomId, matchId, 1, firstTurn);
    return { roomId, matchId, firstTurn };
  }

  /** Generate a short, unambiguous, currently-unused room code. */
  private makeCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = "";
      for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!this.pendingRooms.has(code)) return code;
    }
    // Astronomically unlikely; fall back to a longer unique code.
    return randomUUID().slice(0, 8).toUpperCase();
  }

  private removePendingByHost(hostPeerId: string): void {
    for (const [code, pending] of this.pendingRooms) {
      if (pending.hostPeerId === hostPeerId) this.pendingRooms.delete(code);
    }
  }

  private notifyMatched(peerId: string, roomId: string, matchId: string, seat: 0 | 1, firstTurn: 0 | 1): void {
    this.ctx.lobbyPeer(peerId)?.notify("mm:matched", { roomId, matchId, seat, firstTurn });
  }

  private picksFor(peerId: string): [Monster, Monster] {
    return this.picks.get(peerId) ?? defaultPicks();
  }
}

interface EnqueueRequest {
  /** Draft mode (separate queues from blind picks). */
  readonly draft: boolean;
  /** Random teams (their own queue): `monsters` is already a dealt random pair. */
  readonly random: boolean;
  /** Whether the player actually sent two monsters (blind picks need them). */
  readonly picked: boolean;
  readonly displayName: string;
  readonly key: QueueKey;
  readonly monsters: [Monster, Monster];
}

function parseEnqueue(data: unknown): EnqueueRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  const gameId = typeof d["gameId"] === "string" ? d["gameId"] : GAME_ID;
  const mode = typeof d["mode"] === "string" ? d["mode"] : "casual";
  const stake = typeof d["stake"] === "number" ? d["stake"] : 0;
  const displayName = typeof d["displayName"] === "string" ? d["displayName"] : "Player";
  const monsters = resolveMonsters(d["monsters"]);
  const picked = Array.isArray(d["monsters"]) && d["monsters"].filter((m) => typeof m === "string" && monsterById(m)).length >= 2;
  const draft = d["draft"] === true;
  const random = !draft && d["random"] === true;
  // Drafting players only meet other drafting players, random-team players other random ones.
  const queue = draft ? `${mode}:draft` : random ? `${mode}:random` : mode;
  return { draft, random, picked: picked || random, displayName, key: { gameId, mode: queue, stake }, monsters: random ? randomPicks() : monsters };
}

function resolveMonsters(raw: unknown): [Monster, Monster] {
  if (Array.isArray(raw) && raw.length >= 2) {
    const a = typeof raw[0] === "string" ? monsterById(raw[0]) : undefined;
    const b = typeof raw[1] === "string" ? monsterById(raw[1]) : undefined;
    if (a && b) return [a, b];
  }
  return defaultPicks();
}

/** Two different random monsters (Random mode, and the practice bot's team). */
const randomPicks = (): [Monster, Monster] => dealTeam();

function defaultPicks(): [Monster, Monster] {
  return [MONSTERS["ember_pup"]!, MONSTERS["tide_serpent"]!];
}
