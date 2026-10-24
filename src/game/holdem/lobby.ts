/**
 * Hold'em's lobby: the platform's game kit (src/platform/kit.ts, docs/PLATFORM.md)
 * with Hold'em's settings. The standard `holdem:quick/host/practice/info/join/
 * invite/acceptInvite` methods and the room's `lobby:*` methods all come from
 * the platform; Hold'em only says which settings each kind of table gets.
 *
 *   quick     6 seats, 1,000 chips, timer on; it starts when full, or 20 s after
 *             the first player sits down, with bots in the empty seats
 *   host      a table you host, behind a code, with your settings
 *   practice  you and bots, no timer, dealt as soon as you sit down
 */
import { GameKit } from "../../platform/kit.js";
import type { LobbyContext } from "../../platform/lobby.js";
import { DEFAULT_SETTINGS, GAME_ID, parseSettings, TableRoom, type TableOptions, type TableSettings } from "./room.js";

export const QUICK_SETTINGS: TableSettings = { seats: 6, bots: true, chips: 1000, timer: true, blindsEvery: 10, botStyle: "sharp" };

export class HoldemLobby extends GameKit<TableSettings, TableRoom> {
  constructor(
    ctx: LobbyContext,
    /** Test hook: faster clocks, seeded shuffles. */
    tableDefaults: Partial<Pick<TableOptions, "timing" | "random">> = {},
  ) {
    super(ctx, {
      gameId: GAME_ID,
      prefix: "holdem:",
      hostSettings: (raw) => parseSettings(raw),
      quickSettings: () => QUICK_SETTINGS,
      practiceSettings: (raw) => ({ ...parseSettings(raw, { ...DEFAULT_SETTINGS, seats: 4 }), bots: true, timer: false }),
      quickKey: () => "quick",
      createRoom: (options) => new TableRoom({ ...options, ...tableDefaults }),
      inviteLabel: () => "Hold'em table",
      record: (t) => {
        const results = t.results();
        ctx.services.results
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
      },
    });
  }
}
