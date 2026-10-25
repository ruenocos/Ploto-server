/** Sea Battle in Ploto's browser tests (e2e/run.mjs): how to drive its lobby and game. */
const playing = (p, ms = 15000) => p.waitForSelector("#scrGame:not([hidden])", { timeout: ms });

export default {
  /** A game for a friend, its room lobby showing. `quickFinish`: the quick 8×8 board. */
  async host(p, { quickFinish = false } = {}) {
    await p.click('[data-mode="host"]');
    if (quickFinish) await p.click('[data-key="board"][data-val=\'"quick"\']');
    await p.click("#createBtn");
    await p.waitForSelector("#scrLobby:not([hidden]) .pl-codecard b");
  },
  // 1v1: it starts as soon as the friend joins (no start button).
  quick: (p) => p.click('[data-mode="quick"]'),
  quickMs: 30000,
  async practice(p) { await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); },
  inGame: playing,
  isInGame: async (p) => (await p.locator("#scrGame:not([hidden])").count()) > 0,
  async back(p) {
    await p.click("#barBack");
    await p.waitForSelector("#scrHome:not([hidden])");
  },
  /** One player gives up from the menu. */
  async finish(a) {
    await a.waitForSelector("#readyBtn", { timeout: 10000 });
    await a.click("#menuBtn");
    await a.locator(".pl-sheet button", { hasText: /forfeit/i }).click();
    await a.click('.pl-sheet [data-a="yes"]');
  },
  finishMs: 20000,
  screens: [
    ["host", (p) => p.click('[data-mode="host"]')],
    ["practice", (p) => p.click('[data-mode="practice"]')],
    ["placing", async (p) => { await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await playing(p); await p.waitForSelector("#readyBtn"); }],
    ["battle", async (p) => { await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await playing(p); await p.click("#readyBtn"); await p.waitForTimeout(9000); }],
  ],
};
