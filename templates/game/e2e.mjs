/**
 * __TITLE__ in Ploto's browser tests (e2e/run.mjs): how to drive its lobby and
 * game. The flows (host, code, invite, quick, practice, reload, back out,
 * rematch) are the platform's; this file only says how this game does each step.
 * TEMPLATE: update the selectors when the game's screens change.
 */
const playing = (p, ms = 15000) => p.waitForSelector("#scrGame:not([hidden]), #scrResult:not([hidden])", { timeout: ms });

export default {
  /** A hosted room, its lobby showing. `quickFinish`: settings for a short game. */
  async host(p, { quickFinish = false } = {}) {
    await p.click('[data-mode="host"]');
    if (quickFinish) await p.click('[data-key="target"][data-val="10"]');
    await p.click("#createBtn");
    await p.waitForSelector("#scrLobby:not([hidden]) .pl-codecard b");
  },
  start: (p) => p.click('[data-do="start"]'), // remove if the game starts when seats fill
  quick: (p) => p.click('[data-mode="quick"]'),
  quickMs: 40000,
  practice: (p) => p.click('[data-mode="practice"]'),
  inGame: playing,
  isInGame: async (p) => (await p.locator("#scrGame:not([hidden])").count()) > 0,
  /** Back out of the room's lobby. */
  async back(p) {
    await p.click("#barBack");
    await p.waitForSelector("#scrHome:not([hidden])");
  },
  /** Play until the result shows. */
  async finish(a) {
    while (!(await a.locator('[data-res="rematch"]').count())) {
      await a.locator("#tapBtn").click().catch(() => {});
    }
  },
  finishMs: 30000,
  /** Checks of the game's own, after the shared flows: [[name, async ({ B, home, assert, sleep }) => …]]. */
  checks: [],
  /** Extra screens for the screenshot set (home is always taken). */
  screens: [
    ["host", (p) => p.click('[data-mode="host"]')],
    ["game", async (p) => { await p.click('[data-mode="practice"]'); await playing(p); }],
  ],
};
