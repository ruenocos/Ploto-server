/**
 * Every game on Ploto, in launcher order. Adding a game is one entry here plus
 * the game's own folder (src/game/<id>/) and page (web/<id>.html): see
 * docs/NEW_GAME.md (`node scripts/new-game.mjs <id> "<Title>"` writes all of it).
 *
 * The launcher, the invite sheet, the profile, page routing and the lobby
 * socket all read this one list.
 */
import type { GameInfo } from "./platform/games.js";
import type { GameLobby, LobbyContext } from "./platform/lobby.js";
import { MatchMonstersLobby } from "./game/matchmonsters/lobby.js";
import { HoldemLobby } from "./game/holdem/lobby.js";
import { SeaBattleLobby } from "./game/sea_battle/lobby.js";

export interface GameEntry extends GameInfo {
  /** The game's page in web/. */
  readonly page: string;
  /** Its launcher card and list icon in web/ (registers with Ploto.gameCard). */
  readonly card?: string;
  /** Its lobby on the lobby socket (usually a GameKit). */
  readonly lobby: (ctx: LobbyContext) => GameLobby;
}

export const GAMES: readonly GameEntry[] = [
  {
    id: "match_monsters", title: "Match Monsters", path: "/play/match-monsters", page: "index.html", card: "match-monsters.card.js",
    players: "1v1", minSeats: 2, maxSeats: 2,
    lobby: (ctx) => new MatchMonstersLobby(ctx),
  },
  {
    id: "holdem", title: "Hold'em", path: "/play/holdem", page: "holdem.html", card: "holdem.card.js",
    players: "2–6 players", minSeats: 2, maxSeats: 6, badge: "NEW",
    profile: { played: "Tables", stats: [{ key: "biggestPot", label: "Biggest pot" }] },
    lobby: (ctx) => new HoldemLobby(ctx),
  },
  {
    id: "sea_battle", title: "Sea Battle", path: "/play/sea-battle", page: "sea-battle.html", card: "sea-battle.card.js",
    players: "1v1", minSeats: 2, maxSeats: 2, badge: "NEW",
    profile: { played: "Battles", stats: [{ key: "accuracy", label: "Best accuracy %" }, { key: "bestStreak", label: "Longest streak" }] },
    lobby: (ctx) => new SeaBattleLobby(ctx),
  },
  // new games go above this line (scripts/new-game.mjs adds them here)
];
