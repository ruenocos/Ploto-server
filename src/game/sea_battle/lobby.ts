/**
 * Sea Battle's lobby: the platform's game kit (src/platform/kit.ts) told which
 * settings each kind of room gets and how to record a finished game. The
 * standard `seabattle:quick/host/practice/info/join/invite/acceptInvite` lobby
 * methods and the room's `lobby:*` methods come from the platform.
 *
 *   quick     classic board, timer on; a bot takes the seat if nobody comes in 20 s
 *   host      a game for a friend, behind a code, with your board and timer
 *   practice  you and a bot (board and difficulty from the practice setup), no timer
 */
import { GameKit } from "../../platform/kit.js";
import type { LobbyContext } from "../../platform/lobby.js";
import { DEFAULT_SETTINGS, GAME_ID, SeaBattleRoom, parseSettings, type SeaRoomOptions, type SeaSettings } from "./room.js";

export const QUICK_SETTINGS: SeaSettings = { ...DEFAULT_SETTINGS, bots: true };

export class SeaBattleLobby extends GameKit<SeaSettings, SeaBattleRoom> {
  constructor(
    ctx: LobbyContext,
    /** Test hook: faster clocks, seeded randomness. */
    roomDefaults: Partial<Pick<SeaRoomOptions, "timing" | "random">> = {},
  ) {
    super(ctx, {
      gameId: GAME_ID,
      prefix: "seabattle:",
      hostSettings: (raw) => parseSettings(raw),
      quickSettings: () => QUICK_SETTINGS,
      practiceSettings: (raw) => ({ ...parseSettings(raw, { ...DEFAULT_SETTINGS, bots: true }), timer: false }),
      quickKey: () => "quick",
      createRoom: (options) => new SeaBattleRoom({ ...options, ...roomDefaults }),
      inviteLabel: () => "Sea Battle",
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
              stats: { accuracy: r.accuracy, bestStreak: r.bestStreak, sunk: r.sunk, shots: r.shots },
            })),
            summary: { settings: room.settings, forfeit: room.game?.forfeit ?? false },
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("failed to record sea_battle result:", err);
          });
      },
    });
  }
}
