import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { GAMES } from "../src/games.js";
import { gamesView } from "../src/platform/games.js";

describe("the game registry (src/games.ts)", () => {
  it("every game has its page and card in web/, a unique id, path and lobby prefix", () => {
    const ctx = {} as never; // lobbies only keep the context until they're used
    const prefixes = new Set<string>();
    for (const g of GAMES) {
      expect(fs.existsSync(`web/${g.page}`), g.page).toBe(true);
      if (g.card) expect(fs.existsSync(`web/${g.card}`), g.card).toBe(true);
      expect(g.path.startsWith("/play/")).toBe(true);
      const lobby = g.lobby(ctx);
      expect(lobby.gameId).toBe(g.id);
      expect(prefixes.has(lobby.prefix), lobby.prefix).toBe(false);
      prefixes.add(lobby.prefix);
    }
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    expect(new Set(GAMES.map((g) => g.path)).size).toBe(GAMES.length);
  });

  it("tells the launcher where each game's card is, never its server-side files", () => {
    const view = gamesView(GAMES);
    expect(view.find((g) => g.id === "holdem")).toMatchObject({ card: "/play/card/holdem.js", online: 0 });
    for (const g of view) expect(g).not.toHaveProperty("page");
  });
});
