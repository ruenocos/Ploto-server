/**
 * A room in its draft phase: both players ban and pick over protoo, then the
 * server swaps in a GameRoom with the drafted teams on the same connections.
 *
 * Requests: `mm:getState` (this player's draft view), `mm:ban`, `mm:pick`,
 * `mm:leaveDraft`. Notifications: `mm:draftUpdate` (each player gets their own
 * view: the rival's ban stays secret until both are in), `mm:draftCancelled`.
 * The `mm:draftDone` notification is sent by the server after the swap.
 */
import { Draft, draftScore, type DraftView } from "./draft.js";
import { MONSTERS, monsterById } from "./monsters.js";
import type { Monster } from "./types.js";
import type { PeerLike } from "../../platform/peer.js";

export interface DraftSeat {
  readonly peerId: string;
  readonly displayName: string;
}

export interface DraftRoomOptions {
  readonly firstTurn: 0 | 1;
  /** Time per draft step, or null for no timer (friends, practice). */
  readonly stepMs: number | null;
  /** Seat drafted by the practice bot. */
  readonly botSeat?: 0 | 1;
  /** Both teams are in: build the game and move the connected peers over. */
  readonly onDone: (teams: [[Monster, Monster], [Monster, Monster]], peers: readonly (PeerLike | undefined)[]) => void;
  /** A player left the draft: drop the room. */
  readonly onCancel: () => void;
}

/** The bot "thinks" this long before each ban or pick. */
const BOT_DRAFT_MS = 900;

export class DraftRoom {
  readonly gameId = "match_monsters";
  readonly draft: Draft;
  private readonly seats = new Map<string, 0 | 1>();
  private readonly peers: (PeerLike | undefined)[] = [undefined, undefined];
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    readonly players: readonly [DraftSeat, DraftSeat],
    private readonly opts: DraftRoomOptions,
  ) {
    this.draft = new Draft({ pool: Object.keys(MONSTERS), firstTurn: opts.firstTurn, stepMs: opts.stepMs });
    this.seats.set(players[0].peerId, 0);
    this.seats.set(players[1].peerId, 1);
    this.armStepTimer();
    this.scheduleBot();
  }

  seatOf(peerId: string): 0 | 1 | undefined {
    return this.seats.get(peerId);
  }

  join(peer: PeerLike): boolean {
    const seat = this.seats.get(peer.id);
    if (seat === undefined) return false;
    this.peers[seat] = peer;
    this.peers[seat === 0 ? 1 : 0]?.notify("mm:peerStatus", { seat, connected: true });
    return true;
  }

  leave(peer: PeerLike): void {
    const seat = this.seats.get(peer.id);
    if (seat === undefined || this.peers[seat] !== peer) return;
    this.peers[seat] = undefined;
    this.peers[seat === 0 ? 1 : 0]?.notify("mm:peerStatus", { seat, connected: false });
  }

  connectedCount(): number {
    return this.peers.filter(Boolean).length;
  }

  dispose(): void {
    this.closed = true;
    if (this.stepTimer) clearTimeout(this.stepTimer);
    if (this.botTimer) clearTimeout(this.botTimer);
    this.stepTimer = this.botTimer = null;
  }

  handleRequest(peerId: string, method: string, data: unknown): unknown {
    const seat = this.seats.get(peerId);
    if (seat === undefined) throw new Error("peer is not seated in this room");
    const id = () => {
      const v = (data as Record<string, unknown> | null)?.["monsterId"];
      if (typeof v !== "string") throw new Error("monsterId required");
      return v;
    };
    switch (method) {
      case "mm:getState":
        return this.stateFor(seat);
      case "mm:ban":
        this.draft.ban(seat, id());
        this.changed();
        return { ok: true };
      case "mm:pick":
        this.draft.pick(seat, id());
        this.changed();
        return { ok: true };
      case "mm:leaveDraft":
        this.broadcast("mm:draftCancelled", { by: seat });
        this.dispose();
        this.opts.onCancel();
        return { ok: true };
      default:
        throw new Error(method === "mm:move" ? "the draft isn't over yet" : `unknown method: ${method}`);
    }
  }

  /** What `seat` sees: its draft view plus who's playing. */
  stateFor(seat: 0 | 1): { draft: DraftView; remainingMs: number | null; names: [string, string]; botSeat: 0 | 1 | null; connected: boolean[] } {
    const deadline = this.draft.deadline;
    return {
      draft: this.draft.view(seat),
      /** Time left in this step (clients count down from this, not from their own clock). */
      remainingMs: deadline === null ? null : Math.max(0, deadline - Date.now()),
      names: [this.players[0].displayName, this.players[1].displayName],
      botSeat: this.opts.botSeat ?? null,
      connected: [0, 1].map((i) => i === this.opts.botSeat || Boolean(this.peers[i])),
    };
  }

  private changed(): void {
    if (this.closed) return;
    for (const s of [0, 1] as const) this.peers[s]?.notify("mm:draftUpdate", this.stateFor(s));
    if (this.draft.phase === "done") {
      this.dispose();
      const [a, b] = this.draft.result();
      const team = (ids: [string, string]) => ids.map((i) => monsterById(i)!) as [Monster, Monster];
      this.opts.onDone([team(a), team(b)], [...this.peers]);
      return;
    }
    this.armStepTimer();
    this.scheduleBot();
  }

  private armStepTimer(): void {
    if (this.stepTimer) clearTimeout(this.stepTimer);
    this.stepTimer = null;
    const at = this.draft.deadline;
    if (at === null || this.closed) return;
    this.stepTimer = setTimeout(() => {
      this.stepTimer = null;
      if (this.draft.expire()) this.changed();
    }, Math.max(0, at - Date.now()) + 30);
    this.stepTimer.unref?.();
  }

  /** The practice bot bans at random and picks counters (and combos) with a little jitter. */
  private scheduleBot(): void {
    const bot = this.opts.botSeat;
    if (bot === undefined || this.botTimer || this.closed || !this.draft.needs(bot)) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (this.closed || !this.draft.needs(bot)) return;
      const pool = this.draft.available();
      if (this.draft.phase === "ban") {
        this.draft.ban(bot, pool[Math.floor(Math.random() * pool.length)]!);
      } else {
        const view = this.draft.view(bot);
        const mine = view.picks[bot].map((i) => monsterById(i)!);
        const theirs = view.picks[bot === 0 ? 1 : 0].map((i) => monsterById(i)!);
        let best = pool[0]!, bestScore = -Infinity;
        for (const id of pool) {
          const s = draftScore(monsterById(id)!, mine, theirs) + Math.random() * 1.5;
          if (s > bestScore) { bestScore = s; best = id; }
        }
        this.draft.pick(bot, best);
      }
      this.changed();
    }, BOT_DRAFT_MS);
    this.botTimer.unref?.();
  }

  private broadcast(method: string, payload: unknown): void {
    for (const peer of this.peers) peer?.notify(method, payload);
  }
}
