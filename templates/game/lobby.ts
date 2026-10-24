/**
 * __TITLE__'s lobby: the platform's game kit (src/platform/kit.ts) told which
 * settings each kind of room gets and how to record a finished game. The
 * standard `__PREFIX__quick/host/practice/info/join/invite/acceptInvite` lobby
 * methods and the room's `lobby:*` methods come from the platform.
 */
import { GameKit } from "../../platform/kit.js";
import type { LobbyContext } from "../../platform/lobby.js";
import { __CLASS__Room, DEFAULT_SETTINGS, GAME_ID, parseSettings, type __CLASS__Settings } from "./room.js";

export class __CLASS__Lobby extends GameKit<__CLASS__Settings, __CLASS__Room> {
  constructor(ctx: LobbyContext) {
    super(ctx, {
      gameId: GAME_ID,
      prefix: "__PREFIX__",
      hostSettings: (raw) => parseSettings(raw),
      quickSettings: () => DEFAULT_SETTINGS,
      practiceSettings: (raw) => ({ ...parseSettings(raw), bots: true }),
      quickKey: () => "quick",
      formingMs: 20_000, // quick rooms deal 20 s after the first player sits (bots fill in)
      createRoom: (options) => new __CLASS__Room(options),
      inviteLabel: () => "__TITLE__",
      record: (room) => {
        ctx.services.results
          .record({
            gameId: GAME_ID,
            mode: room.mode,
            startedAt: room.startedAt ?? new Date(),
            players: room.results().map((r) => ({ seat: r.seat, accountId: r.accountId, isBot: r.isBot, displayName: r.name, place: r.place, stats: { taps: r.taps } })),
            summary: { settings: room.settings },
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("failed to record __ID__ result:", err);
          });
      },
    });
  }
}
