/**
 * Match Monsters' lobby: the platform's game kit (src/platform/kit.ts,
 * docs/PLATFORM.md) with Match Monsters' settings. The standard `mm:quick/host/
 * practice/info/join/invite/acceptInvite` methods and the room's `lobby:*`
 * methods all come from the platform; Match Monsters says what a room's
 * settings are (how teams are made) and checks each player's two picks.
 *
 *   quick     a room with the same team mode that's filling up (pick, draft and
 *             random rooms fill separately); it starts when both seats are taken
 *   host      a room behind a code; a code joiner or an invited friend, whoever
 *             comes first, takes the second seat and the match starts
 *   practice  you and the bot, started as soon as you connect
 *
 * `data` on a seat-taking call is your two monsters (`["ember_pup", …]`), needed
 * for blind picks. Rematches keep the same picks (drafts draft again, random
 * teams are dealt again).
 */
import { GameKit } from "../../platform/kit.js";
import type { LobbyContext } from "../../platform/lobby.js";
import { GAME_ID, MatchRoom, parsePicks, parseSettings, type MmSettings } from "./matchRoom.js";

export { GAME_ID } from "./matchRoom.js";

const TEAM_LABEL = { pick: "Pick", draft: "Draft", random: "Random" } as const;

export class MatchMonstersLobby extends GameKit<MmSettings, MatchRoom> {
  constructor(ctx: LobbyContext) {
    super(ctx, {
      gameId: GAME_ID,
      prefix: "mm:",
      hostSettings: (raw) => parseSettings(raw),
      quickSettings: (raw) => parseSettings(raw),
      practiceSettings: (raw) => parseSettings(raw, { team: "pick", vsBot: true }),
      quickKey: (s) => s.team,
      seatData: (raw, settings) => parsePicks(raw, settings),
      createRoom: (options) => new MatchRoom(options),
      info: (room) => ({ team: room.settings.team }),
      inviteLabel: (room) => `Match Monsters · ${TEAM_LABEL[room.settings.team]}`,
      // The invite card shows the host's team for blind picks.
      inviteExtra: (room) => ({ team: room.settings.team, monsters: room.settings.team === "pick" ? (room.seated()[room.hostSeat]?.data ?? []) : [] }),
      record: (room) => {
        const game = room.game;
        if (!game) return;
        ctx.services.history.record(game.toRecord()).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("failed to record match:", err);
        });
      },
    });
  }
}
