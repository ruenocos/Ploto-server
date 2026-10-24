/** Match Monsters in Ploto's browser tests (e2e/run.mjs): how to drive its lobby and arena. */
const playing = (p, ms = 15000) => p.waitForSelector("#game:not(.hidden), #draft:not(.hidden)", { timeout: ms });

export default {
  /** Play a friend with random teams (no picking): the room lobby with its code. */
  async host(p) {
    await p.click('[data-mode="friend"]');
    await p.click('[data-team="random"]');
    await p.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.querySelector(".pl-codecard b")?.textContent.trim() || ""), null, { timeout: 8000 });
  },
  // A 1v1 room starts as soon as the second seat is taken: no start button.
  async quick(p) { await p.click('[data-mode="quick"]'); await p.click('[data-team="random"]'); },
  quickMs: 15000,
  async practice(p) { await p.click('[data-mode="bot"]'); await p.click('[data-team="random"]'); },
  inGame: playing,
  isInGame: async (p) => (await p.locator("#game:not(.hidden), #draft:not(.hidden)").count()) > 0,
  async back(p) {
    await p.click("#lbBack");
    await p.waitForFunction(() => document.querySelector("#lobby")?.dataset.at !== "room");
  },
  /** One player forfeits (after the random-teams reveal). */
  async finish(a) {
    await a.waitForTimeout(9500);
    await a.click("#gameMenuBtn");
    await a.locator(".pl-sheet button", { hasText: /forfeit/i }).click();
    await a.click('.pl-sheet [data-a="yes"]');
  },
  finishMs: 15000,
  screens: [
    ["teams", (p) => p.click('[data-mode="friend"]')],
    ["room", async (p) => { await p.click('[data-mode="friend"]'); await p.click('[data-team="random"]'); await p.waitForTimeout(800); }],
    ["game", async (p) => { await p.click('[data-mode="bot"]'); await p.click('[data-team="random"]'); await playing(p); await p.waitForTimeout(3000); }],
  ],
};
