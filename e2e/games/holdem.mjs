/** Hold'em in Ploto's browser tests (e2e/run.mjs): how to drive its lobby and table. */
const inTable = (p, ms = 15000) => p.waitForSelector("#scrTable:not([hidden])", { timeout: ms });

export default {
  /** A hosted table, its room lobby showing. `quickFinish`: heads-up, no bots, short stacks. */
  async host(p, { quickFinish = false } = {}) {
    await p.click('[data-mode="host"]');
    if (quickFinish) {
      await p.click('[data-key="seats"][data-val="2"]');
      if ((await p.getAttribute('[role="switch"][data-key="bots"]', "aria-checked")) === "true") await p.click('[role="switch"][data-key="bots"]');
      await p.click('[data-key="chips"][data-val="500"]');
      await p.click('[data-key="blindsEvery"][data-val="5"]');
    }
    await p.click("#createBtn");
    await p.waitForSelector("#scrLobby:not([hidden]) .pl-codecard b");
  },
  start: (p) => p.click('[data-do="start"]'),
  quick: (p) => p.click('[data-mode="quick"]'),
  quickMs: 40000, // a quick table waits 20 s for players, then bots fill in
  async practice(p) { await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); },
  inGame: inTable,
  isInGame: async (p) => (await p.locator("#scrTable:not([hidden])").count()) > 0,
  /** Back out of the room's lobby (it asks first). */
  async back(p) {
    await p.click("#barBack");
    await p.click('.pl-sheet [data-a="yes"]');
    await p.waitForSelector("#scrHome:not([hidden])");
  },
  /** Heads-up: A shoves every hand, B calls, until someone has every chip. */
  async finish(a, b) {
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      if ((await a.locator('[data-res="rematch"]').count()) && (await b.locator('[data-res="rematch"]').count())) return;
      for (const [p, shove] of [[a, true], [b, false]]) {
        const watch = p.locator('[data-o="watch"]:visible');
        if (await watch.count()) await watch.click().catch(() => {});
        const go = shove
          ? p.locator('#acts button[data-a="allIn"]:enabled, #acts button[data-a="raise"]:enabled, #acts button[data-a="call"]:enabled')
          : p.locator('#acts button[data-a="call"]:enabled, #acts button[data-a="check"]:enabled');
        if (!(await go.count())) continue;
        const btn = go.first();
        const raise = (await btn.getAttribute("data-a")) === "raise";
        await btn.click().catch(() => {});
        if (raise) { // the raise sheet: All-in preset, then go
          await p.locator('.pl-sheet [data-p="3"]').click({ timeout: 2000 }).catch(() => {});
          await p.locator(".pl-sheet #rsGo").click({ timeout: 2000 }).catch(() => {});
        }
      }
      await a.waitForTimeout(250);
    }
  },
  finishMs: 90000,
  screens: [
    ["host", (p) => p.click('[data-mode="host"]')],
    ["lobby", async (p) => { await p.click('[data-mode="host"]'); await p.click("#createBtn"); await p.waitForSelector("#scrLobby:not([hidden])"); }],
    ["practice", (p) => p.click('[data-mode="practice"]')],
    ["table", async (p) => { await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await inTable(p); await p.waitForTimeout(2500); }],
  ],
};
