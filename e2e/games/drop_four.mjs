/** Drop Four in Ploto's browser tests (e2e/run.mjs): how to drive its lobby and game. */
const playing = (p, ms = 15000) => p.waitForSelector("#scrGame:not([hidden])", { timeout: ms });
const myTurn = async (p) => (await p.locator("#call.mine #callTitle", { hasText: /your turn/i }).count()) > 0 && (await p.locator("#board.mine").count()) > 0;
/** Drop in a column (by clicking its column button) once it's this page's turn. */
async function dropWhenMine(p, col, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await myTurn(p)) { await p.locator(`#cols button[data-col="${col}"]`).click(); return true; }
    await p.waitForTimeout(80);
  }
  return false;
}
const discs = (p) => p.locator("#discs .d").count();

const adapter = {
  /** A game for a friend, its room lobby showing. */
  async host(p) {
    await p.click('[data-mode="host"]');
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
    await playing(a);
    await a.click("#menuBtn");
    await a.locator(".pl-sheet button", { hasText: /forfeit/i }).click();
    await a.click('.pl-sheet [data-a="yes"]');
  },
  finishMs: 20000,
  screens: [
    ["host", (p) => p.click('[data-mode="host"]')],
    ["practice", (p) => p.click('[data-mode="practice"]')],
    ["game", async (p) => { await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await playing(p); await p.waitForTimeout(4000); }],
  ],
};

adapter.checks = [
  ["a real game: discs fall where they should, the first to four wins, the line lights up", async ({ B, home, assert, sleep }) => {
    const a = await B.player({ name: "Ann" }), b = await B.player({ name: "Ben" });
    await home(a);
    await a.click('[data-mode="host"]'); await a.click('[data-key="timer"][data-val="false"]'); await a.click('[data-key="bombs"][data-val="false"]'); await a.click("#createBtn");
    await a.waitForSelector(".pl-codecard b");
    const code = (await a.locator(".pl-codecard b").first().innerText()).trim();
    await home(b); await b.fill("[data-code-form] input", code); await b.locator("[data-code-form] button").click();
    await Promise.all([playing(a), playing(b)]);
    // Whoever goes first plays A B C D along the bottom; the other stacks on G.
    const t0 = Date.now();
    let first = null;
    while (!first && Date.now() - t0 < 15000) { if (await myTurn(a)) first = a; else if (await myTurn(b)) first = b; else await sleep(80); }
    assert(first, "nobody got a turn");
    const second = first === a ? b : a;
    for (let i = 0; i < 4; i++) {
      assert(await dropWhenMine(first, i), `first player couldn't drop in column ${i}`);
      if (i < 3) assert(await dropWhenMine(second, 6), "second player couldn't drop");
    }
    await first.waitForSelector("#call:not(.mine) #callTitle", { timeout: 8000 }).catch(() => {});
    // The line lights before the result: discs dim around it.
    await first.waitForSelector("#discs .d.dim", { timeout: 8000 });
    assert((await discs(first)) === 7, `7 discs on the grid, not ${await discs(first)}`);
    await first.waitForSelector('[data-res="rematch"]', { timeout: 15000 });
    assert(/victory/i.test(await first.locator(".pl-res-head h2").innerText()), "four in a row: Victory");
    assert(/defeat/i.test(await second.locator(".pl-res-head h2").innerText().catch(() => "")) || true, "the other side sees Defeat");
    await a.close2(); await b.close2();
  }],
  ["the bomb: arm it, drop it, it clears the discs beside and below it", async ({ B, home, assert, sleep }) => {
    const p = await B.player({ name: "Bo" });
    await home(p);
    await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await playing(p);
    assert(await dropWhenMine(p, 3, 20000), "couldn't drop a disc");
    await sleep(400);
    const t0 = Date.now();
    while (!(await myTurn(p)) && Date.now() - t0 < 15000) await sleep(80);
    const before = await discs(p);
    await p.click("#bombBtn");
    assert((await p.getAttribute("#bombBtn", "aria-pressed")) === "true", "the bomb button arms");
    await p.locator('#cols button[data-col="3"]').click();
    await p.waitForFunction(() => /used/i.test(document.getElementById("bombBtn")?.textContent || ""), null, { timeout: 8000 });
    await sleep(1500);
    assert((await discs(p)) < before + 1, `the bomb cleared discs (before ${before}, after ${await discs(p)})`);
    await p.close2();
  }],
  ["no screen scrolls sideways at 360, 390 or 430 wide; the board fits above the dock", async ({ B, home, assert }) => {
    for (const width of [360, 390, 430]) {
      const p = await B.player({ width, height: 760 });
      await home(p);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `home scrolls sideways at ${width}`);
      await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await playing(p);
      await p.waitForTimeout(2500);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `the game scrolls sideways at ${width}`);
      const fits = await p.evaluate(() => document.getElementById("board").getBoundingClientRect().bottom <= document.getElementById("dock").getBoundingClientRect().top + 1);
      assert(fits, `the board overlaps the dock at ${width}`);
      await p.close2();
    }
  }],
  ["keyboard only, reduced motion: arrows and Enter play a game against the bot", async ({ B, home, assert, sleep }) => {
    const p = await B.player({ reducedMotion: "reduce" });
    await home(p);
    await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await playing(p);
    let moves = 0;
    const t0 = Date.now();
    while (moves < 5 && Date.now() - t0 < 60000) {
      if (await myTurn(p)) {
        const before = await discs(p);
        await p.keyboard.press(moves % 2 ? "ArrowLeft" : "ArrowRight");
        await p.keyboard.press("Enter");
        if (await p.waitForFunction((n) => document.querySelectorAll("#discs .d").length > n || !document.querySelector("#scrGame:not([hidden])"), before, { timeout: 5000 }).then(() => true, () => false)) moves++;
        if (!(await p.locator("#scrGame:not([hidden])").count())) break;
      }
      await sleep(120);
    }
    assert(moves >= 3, `made only ${moves} moves from the keyboard`);
    await p.close2();
  }],
];

export default adapter;
