/**
 * The game registry: every game the launcher shows. A new game is one entry
 * here, its lobby module (src/game/<game>/lobby.ts) and its page (web/).
 * The launcher, the invite sheet and the profile all read this one list.
 */
export interface GameInfo {
  readonly id: string;
  readonly title: string;
  /** Page the launcher opens. */
  readonly path: string;
  /** Short player line for cards and lists ("1v1", "2–6 players"). */
  readonly players: string;
  readonly minSeats: number;
  readonly maxSeats: number;
  /** Optional corner tag on the card ("NEW"). */
  readonly badge?: string;
}

export const GAMES: readonly GameInfo[] = [
  { id: "match_monsters", title: "Match Monsters", path: "/play/match-monsters", players: "1v1", minSeats: 2, maxSeats: 2 },
  { id: "holdem", title: "Hold'em", path: "/play/holdem", players: "2–6 players", minSeats: 2, maxSeats: 6, badge: "NEW" },
];

export const gameById = (id: string): GameInfo | undefined => GAMES.find((g) => g.id === id);

/** Players currently in a room or queue, per game. Set by the signaling server once it's up. */
let onlineCounter: () => Record<string, number> = () => ({});
export function setOnlineCounter(fn: () => Record<string, number>): void {
  onlineCounter = fn;
}

/** The registry as the launcher gets it: each game with its live player count. */
export function gamesView(): (GameInfo & { online: number })[] {
  const counts = onlineCounter();
  return GAMES.map((g) => ({ ...g, online: counts[g.id] ?? 0 }));
}
