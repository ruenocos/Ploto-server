/**
 * Friend invites, for any game. A signed-in player invites an online friend;
 * the friend sees it in the launcher (and on any page) until it's accepted,
 * declined, cancelled or expires. What accepting does is up to the game.
 */
import { randomUUID } from "node:crypto";
import type { PeerLike } from "../signaling/gameRoom.js";
import type { Presence } from "../social/presence.js";

/** How long an invite stays open. */
export const INVITE_MS = 90 * 1000;

export type InviteEnd = "expired" | "declined" | "cancelled" | "accepted";

export interface Invite<T = unknown> {
  readonly id: string;
  readonly gameId: string;
  /** Shown as is on the invite card ("Match Monsters · Draft", "Hold'em table"). */
  readonly label: string;
  readonly from: { readonly id: string; readonly username: string };
  /** Account invited. */
  readonly to: string;
  /** The inviter's lobby connection (their invites end when it closes). */
  readonly hostPeerId: string;
  readonly createdAt: number;
  /** The game's own data (who's seated where, the table code…). */
  readonly data: T;
  /** Extra public fields the game adds to the invite card. */
  readonly extra: Record<string, unknown>;
  timer: ReturnType<typeof setTimeout>;
}

export interface NewInvite<T> {
  readonly gameId: string;
  readonly label: string;
  readonly from: { readonly id: string; readonly username: string };
  readonly to: string;
  readonly hostPeerId: string;
  readonly data: T;
  readonly extra?: Record<string, unknown>;
}

export class InviteBook {
  private readonly invites = new Map<string, Invite>();

  constructor(
    private readonly presence: Presence,
    private readonly lobbyPeer: (peerId: string) => PeerLike | undefined,
  ) {}

  /** Open an invite (the host's earlier ones end) and tell the friend. */
  create<T>(n: NewInvite<T>): Invite<T> {
    for (const inv of [...this.invites.values()]) if (inv.hostPeerId === n.hostPeerId) this.drop(inv, "cancelled");
    const inv: Invite<T> = {
      id: randomUUID(),
      gameId: n.gameId,
      label: n.label,
      from: n.from,
      to: n.to,
      hostPeerId: n.hostPeerId,
      createdAt: Date.now(),
      data: n.data,
      extra: n.extra ?? {},
      timer: setTimeout(() => this.drop(inv, "expired"), INVITE_MS),
    };
    inv.timer.unref?.();
    this.invites.set(inv.id, inv);
    this.presence.notify(n.to, "social:invite", view(inv));
    return inv;
  }

  get(id: unknown): Invite | undefined {
    return typeof id === "string" ? this.invites.get(id) : undefined;
  }

  /** Invites waiting for an account. */
  pendingFor(accountId: string): Record<string, unknown>[] {
    return [...this.invites.values()].filter((i) => i.to === accountId).map(view);
  }

  /** End an invite and tell both sides. */
  drop(inv: Invite, reason: InviteEnd): void {
    if (!this.invites.delete(inv.id)) return;
    clearTimeout(inv.timer);
    const note = { inviteId: inv.id, reason };
    this.presence.notify(inv.to, "social:inviteGone", note);
    this.lobbyPeer(inv.hostPeerId)?.notify("social:inviteGone", note);
  }

  /** The host left: their open invites end. */
  dropByHost(peerId: string): void {
    for (const inv of [...this.invites.values()]) if (inv.hostPeerId === peerId) this.drop(inv, "cancelled");
  }

  dispose(): void {
    for (const inv of this.invites.values()) clearTimeout(inv.timer);
    this.invites.clear();
  }
}

/** An invite as the invited player sees it (`social:invite`, `platform:invites`). */
export function view(inv: Invite): Record<string, unknown> {
  return {
    ...inv.extra,
    inviteId: inv.id,
    gameId: inv.gameId,
    label: inv.label,
    from: inv.from,
    expiresInMs: Math.max(0, INVITE_MS - (Date.now() - inv.createdAt)),
  };
}
