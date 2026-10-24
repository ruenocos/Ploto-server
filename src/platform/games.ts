/**
 * What the platform knows about a game. The list itself is src/games.ts (one
 * entry per game); the launcher, the invite sheet and the profile read it.
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
  /** Profile tiles from recorded results: what a game is called ("Tables") and the best-of stats to show. */
  readonly profile?: ProfileSpec;
}

export interface ProfileSpec {
  readonly played?: string;
  readonly stats?: readonly { readonly key: string; readonly label: string }[];
}

/** Players currently in a room or queue, per game. Set by the signaling server once it's up. */
let onlineCounter: () => Record<string, number> = () => ({});
export function setOnlineCounter(fn: () => Record<string, number>): void {
  onlineCounter = fn;
}

/** The registry as the launcher gets it: each game with its live player count. */
export function gamesView(games: readonly (GameInfo & { card?: string })[]): (GameInfo & { online: number; card?: string })[] {
  const counts = onlineCounter();
  return games.map((g) => ({
    id: g.id, title: g.title, path: g.path, players: g.players, minSeats: g.minSeats, maxSeats: g.maxSeats,
    ...(g.badge ? { badge: g.badge } : {}),
    ...(g.card ? { card: `/play/card/${g.id}.js` } : {}), // the game's launcher art (served below)
    online: counts[g.id] ?? 0,
  }));
}
