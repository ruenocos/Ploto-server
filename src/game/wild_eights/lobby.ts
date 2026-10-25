/**
 * Wild Eights' lobby: the platform's game kit (src/platform/kit.ts) told which
 * settings each kind of room gets and how to record a finished game. The
 * standard `wildeights:quick/host/practice/info/join/invite/acceptInvite` lobby
 * methods and the room's `lobby:*` methods come from the platform.
 *
 *   quick     four seats, timer on; bots fill the empty seats 20 s after the first player sits
 *   host      a table for friends, behind a code, with your seats, bots and timer settings
 *   practice  you and bots (how many and how hard from the practice setup), no timer
 */
import { GameKit } from "../../platform/kit.js";
import type { LobbyContext } from "../../platform/lobby.js";
import { DEFAULT_SETTINGS, GAME_ID, WildEightsRoom, parseSettings, type EightsRoomOptions, type EightsSettings } from "./room.js";

export const QUICK_SETTINGS: EightsSettings = { ...DEFAULT_SETTINGS, bots: true };

export class WildEightsLobby extends GameKit<EightsSettings, WildEightsRoom> {
  constructor(
    ctx: LobbyContext,
    /** Test hook: faster clocks, seeded randomness. */
    roomDefaults: Partial<Pick<EightsRoomOptions, "timing" | "random">> = {},
  ) {
    super(ctx, {
      gameId: GAME_ID,
      prefix: "wildeights:",
      hostSettings: (raw) => parseSettings(raw),
      quickSettings: () => QUICK_SETTINGS,
      practiceSettings: (raw) => ({ ...parseSettings(raw, { ...DEFAULT_SETTINGS, bots: true }), bots: true, timer: false }),
      quickKey: () => "quick",
      createRoom: (options) => new WildEightsRoom({ ...options, ...roomDefaults }),
      inviteLabel: () => "Wild Eights",
      record: (room) => {
        ctx.services.results
          .record({
            gameId: GAME_ID,
            mode: room.mode,
            startedAt: room.startedAt ?? new Date(),
            players: room.results().map((r) => ({
              seat: r.seat,
              accountId: r.accountId,
              isBot: r.isBot,
              displayName: r.name,
              place: r.place,
              stats: { played: r.played, eights: r.eights, left: r.left, points: r.points },
            })),
            summary: { settings: room.settings, forfeit: room.game?.forfeit ?? false, players: room.order.length },
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("failed to record wild_eights result:", err);
          });
      },
    });
  }
}
