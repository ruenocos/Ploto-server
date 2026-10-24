/**
 * Hold'em's lobby methods (`holdem:*` on the lobby socket), see docs/PLATFORM.md:
 *
 *   holdem:quick        a seat at the forming quick table (6 seats, 1,000 chips,
 *                       timer on); it starts when full, or 20 s after the first
 *                       player sits down, with bots in the empty seats
 *   holdem:host         a table you host, behind a 4-letter code
 *   holdem:practice     you and bots, no timer, dealt as soon as you sit down
 *   holdem:tableInfo    what a code leads to, before joining
 *   holdem:join         a seat at a table by code
 *   holdem:invite       hold a seat for an online friend and invite them
 *   holdem:acceptInvite take the seat an invite holds
 *   holdem:rematch      (table connection) a new table with the same settings
 *
 * Every call answers {roomId, code}; the client then connects to the room.
 */
import { randomUUID } from "node:crypto";
import { makeCode, normalizeCode } from "../../platform/codes.js";
import type { GameLobby, LobbyContext, Room } from "../../platform/lobby.js";
import type { PeerLike } from "../../platform/peer.js";
import { DEFAULT_SETTINGS, GAME_ID, parseSettings, TableRoom, type TableMode, type TableOptions, type TableSettings } from "./room.js";

export const QUICK_SETTINGS: TableSettings = { seats: 6, bots: true, chips: 1000, timer: true, blindsEvery: 10 };

interface InviteData {
  readonly roomId: string;
  readonly code: string;
}

export class HoldemLobby implements GameLobby {
  readonly gameId = GAME_ID;
  readonly prefix = "holdem:";
  /** Tables by code (only while their room lives). */
  private readonly tables = new Map<string, TableRoom>();
  /** The quick table currently filling up. */
  private quick: TableRoom | null = null;

  constructor(
    private readonly ctx: LobbyContext,
    /** Test hook: faster clocks, seeded shuffles. */
    private readonly tableDefaults: Partial<Pick<TableOptions, "timing" | "random">> = {},
  ) {}

  peerGone(): void {
    // Seats are kept: a player who drops can reconnect to their room until it's cleaned up.
  }

  roomRequest(_roomId: string, room: Room, peer: PeerLike, method: string): unknown {
    if (method !== "holdem:rematch") return undefined;
    if (!(room instanceof TableRoom)) return undefined;
    if (room.phase !== "over") throw new Error("the game isn't over yet");
    const me = room.seated().find((s) => s.peerId === peer.id);
    if (!me) throw new Error("you don't have a seat at this table");
    // The first player to ask hosts the new table; everyone after joins it.
    let next = room.rematch ? this.tables.get(room.rematch.code) : undefined;
    if (!next || next.phase !== "lobby") {
      // Practice deals again straight away; other tables gather in a lobby first.
      const practice = room.mode === "practice";
      // The first player to ask hosts it (even after a quick table, which had no host).
      next = this.open(practice ? "practice" : "rematch", room.settings, true, practice);
      room.rematch = { roomId: next.roomId, code: next.code, players: [] };
    }
    next.reserve(peer.id, me.name, me.accountId);
    if (room.rematch && !room.rematch.players.includes(me.name)) room.rematch.players.push(me.name);
    room.broadcast([]);
    return { roomId: next.roomId, code: next.code };
  }

  async handle(peer: PeerLike, method: string, data: unknown): Promise<unknown> {
    const { ctx } = this;
    const d = (data ?? {}) as Record<string, unknown>;
    const name = ctx.nameFor(peer, typeof d["displayName"] === "string" ? d["displayName"] : "Player");
    const accountId = ctx.accountOf(peer)?.id ?? null;
    switch (method) {
      case "holdem:quick": {
        if (!this.quick || this.quick.phase !== "lobby" || this.quick.freeSeats() === 0) {
          this.quick = this.open("quick", QUICK_SETTINGS, false);
        }
        const table = this.quick;
        table.reserve(peer.id, name, accountId);
        return { roomId: table.roomId, code: table.code };
      }

      case "holdem:host": {
        const table = this.open("private", parseSettings(d["settings"]), true);
        table.reserve(peer.id, name, accountId);
        return { roomId: table.roomId, code: table.code };
      }

      case "holdem:practice": {
        const settings = parseSettings(d["settings"], { ...DEFAULT_SETTINGS, seats: 4 });
        const table = this.open("practice", { ...settings, bots: true, timer: false }, true, true);
        table.reserve(peer.id, name, accountId);
        return { roomId: table.roomId, code: table.code };
      }

      case "holdem:tableInfo": {
        const table = this.byCode(d["code"]);
        return {
          roomId: table.roomId,
          code: table.code,
          host: table.hostName(),
          settings: table.settings,
          seatsFree: table.freeSeats(),
          started: table.phase !== "lobby",
        };
      }

      case "holdem:join": {
        const table = this.byCode(d["code"]);
        table.reserve(peer.id, name, accountId);
        return { roomId: table.roomId, code: table.code };
      }

      case "holdem:invite": {
        if (!ctx.accountOf(peer)) throw new Error("sign in to invite friends");
        const room = ctx.getRoom(typeof d["roomId"] === "string" ? d["roomId"] : "");
        if (!(room instanceof TableRoom) || !room.seated().some((s) => s.peerId === peer.id)) throw new Error("you're not at that table");
        const { me, friend } = await ctx.inviteTarget(peer, d["friendId"]);
        const friendId = friend.id;
        room.seatFor(friendId); // check there's a seat before the friend hears about it
        let seatHeld = false;
        const inv = ctx.invites.create<InviteData>({
          gameId: GAME_ID,
          label: "Hold'em table",
          from: { id: me.id, username: me.username },
          to: friendId,
          hostPeerId: peer.id,
          data: { roomId: room.roomId, code: room.code },
          extra: { code: room.code },
          onEnd: (reason) => {
            if (seatHeld && reason !== "accepted") room.release(inv.id);
          },
        });
        try {
          room.holdFor(friendId, friend.username, inv.id);
          seatHeld = true;
        } catch (err) {
          ctx.invites.drop(inv, "cancelled");
          throw err;
        }
        return { inviteId: inv.id };
      }

      case "holdem:acceptInvite": {
        const me = ctx.accountOf(peer);
        const inv = ctx.invites.get(d["inviteId"]);
        if (!me || !inv || inv.to !== me.id || inv.gameId !== GAME_ID) throw new Error("that invite has expired");
        const { code } = inv.data as InviteData;
        const table = this.byCode(code);
        table.reserve(peer.id, name, me.id); // takes the seat held for this account
        ctx.invites.drop(inv, "accepted");
        return { roomId: table.roomId, code: table.code };
      }

      default:
        throw new Error(`unknown lobby method: ${method}`);
    }
  }

  private byCode(raw: unknown): TableRoom {
    const table = this.tables.get(normalizeCode(raw));
    if (!table) throw new Error("that table doesn't exist anymore");
    return table;
  }

  /** Open a table and register its room (it's cleaned up if nobody connects). */
  private open(mode: TableMode, settings: TableSettings, hosted: boolean, autoStart = false): TableRoom {
    const roomId = randomUUID();
    const code = makeCode((c) => this.tables.has(c));
    const table = new TableRoom({
      roomId,
      code,
      mode,
      settings,
      hosted,
      autoStart,
      ...this.tableDefaults,
      onStarted: (t) => {
        // Seats still held by invites went to bots: those invites end.
        for (const id of t.openInvites()) {
          const inv = this.ctx.invites.get(id);
          if (inv) this.ctx.invites.drop(inv, "cancelled");
        }
        if (this.quick === t) this.quick = null;
      },
      onFinished: (t) => this.record(t),
      onDisposed: (t) => {
        if (this.tables.get(t.code) === t) this.tables.delete(t.code);
        if (this.quick === t) this.quick = null;
      },
    });
    this.tables.set(code, table);
    this.ctx.addRoom(roomId, table);
    this.ctx.scheduleCleanup(roomId); // cancelled as soon as someone connects
    return table;
  }

  private record(t: TableRoom): void {
    const results = t.results();
    this.ctx.services.results
      .record({
        gameId: GAME_ID,
        mode: t.mode,
        startedAt: t.startedAt ?? new Date(),
        players: results.map((r) => ({
          seat: r.seat,
          accountId: r.accountId,
          isBot: r.isBot,
          displayName: r.name,
          place: r.place,
          stats: { handsWon: r.handsWon, biggestPot: r.biggestPot },
        })),
        summary: { hands: t.game?.state.handNo ?? 0, settings: t.settings },
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("failed to record hold'em result:", err);
      });
  }

}
