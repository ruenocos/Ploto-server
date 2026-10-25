/**
 * Drop Four's lobby: the platform's game kit (src/platform/kit.ts) told which
 * settings each kind of room gets and how to record a finished game. The
 * standard `dropfour:quick/host/practice/info/join/invite/acceptInvite` lobby
 * methods and the room's `lobby:*` methods come from the platform.
 *
 *   quick     bombs on, timer on; a bot takes the seat if nobody comes in 20 s
 *   host      a game for a friend, behind a code, with your bombs and timer settings
 *   practice  you and a bot (bombs and difficulty from the practice setup), no timer
 */
import { GameKit } from "../../platform/kit.js";
import type { LobbyContext } from "../../platform/lobby.js";
import { DEFAULT_SETTINGS, DropFourRoom, GAME_ID, parseSettings, type DropRoomOptions, type DropSettings } from "./room.js";

export const QUICK_SETTINGS: DropSettings = { ...DEFAULT_SETTINGS, bots: true };

export class DropFourLobby extends GameKit<DropSettings, DropFourRoom> {
  constructor(
    ctx: LobbyContext,
    /** Test hook: faster clocks, seeded randomness. */
    roomDefaults: Partial<Pick<DropRoomOptions, "timing" | "random">> = {},
  ) {
    super(ctx, {
      gameId: GAME_ID,
      prefix: "dropfour:",
      hostSettings: (raw) => parseSettings(raw),
      quickSettings: () => QUICK_SETTINGS,
      practiceSettings: (raw) => ({ ...parseSettings(raw, { ...DEFAULT_SETTINGS, bots: true }), timer: false }),
      quickKey: () => "quick",
      createRoom: (options) => new DropFourRoom({ ...options, ...roomDefaults }),
      inviteLabel: () => "Drop Four",
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
              stats: { moves: r.moves, longestLine: r.longestLine, bombed: r.bombed ? 1 : 0, draw: r.draw ? 1 : 0 },
            })),
            summary: { settings: room.settings, forfeit: room.game?.forfeit ?? false, draw: room.game?.draw ?? false },
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("failed to record drop_four result:", err);
          });
      },
    });
  }
}
