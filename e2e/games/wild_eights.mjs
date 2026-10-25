/** Wild Eights in Ploto's browser tests (e2e/run.mjs): how to drive its lobby and game. */
const playing = (p, ms = 15000) => p.waitForSelector("#scrGame:not([hidden]), #scrResult:not([hidden])", { timeout: ms });
const myTurn = async (p) => (await p.locator("#call.mine #callTitle", { hasText: /your turn/i }).count()) > 0;
const over = async (p) => (await p.locator('[data-res="rematch"]').count()) > 0;
/** One legal move from the screen, if it's this page's turn: a card that fits (an eight names its first suit), else keep, else draw. */
async function moveIfMine(p) {
  if (!(await myTurn(p))) return false;
  if (await p.locator("#picker:not([hidden])").count()) { await p.locator("#pickGrid button").first().click(); return true; }
  const can = p.locator("#hand .card.can");
  if (await can.count()) {
    await can.first().click();
    if (await p.waitForSelector("#picker:not([hidden])", { timeout: 300 }).then(() => true, () => false)) await p.locator("#pickGrid button").first().click();
    return true;
  }
  if (await p.locator("#keepBtn:not([hidden])").count()) { await p.click("#keepBtn"); return true; }
  if (await p.locator("#drawBtn:not([hidden])").count()) { await p.click("#drawBtn"); return true; }
  return false;
}
/** A friends' table with two seats, no bots and no timer, both players in the game. */
async function friendsAt(B, home) {
  const a = await B.player({ name: "Ann" }), b = await B.player({ name: "Ben" });
  await home(a);
  await a.click('[data-mode="host"]');
  await a.click('[data-key="seats"][data-val="2"]'); await a.click('[data-key="timer"][data-val="false"]');
  if (await a.locator('[data-key="bots"][aria-checked="true"]').count()) await a.click('[data-key="bots"]');
  await a.click("#createBtn");
  await a.waitForSelector(".pl-codecard b");
  const code = (await a.locator(".pl-codecard b").first().innerText()).trim();
  await home(b); await b.fill("[data-code-form] input", code); await b.locator("[data-code-form] button").click();
  await a.locator('[data-do="start"]:not([disabled])').click({ timeout: 8000 });
  await Promise.all([playing(a), playing(b)]);
  return [a, b];
}

const adapter = {
  /** A hosted table, its lobby showing: two seats (a friend fills the other). */
  async host(p) {
    await p.click('[data-mode="host"]');
    await p.click('[data-key="seats"][data-val="2"]');
    await p.click("#createBtn");
    await p.waitForSelector("#scrLobby:not([hidden]) .pl-codecard b");
  },
  start: (p) => p.click('[data-do="start"]'),
  quick: (p) => p.click('[data-mode="quick"]'),
  quickMs: 40000,
  async practice(p) { await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); },
  inGame: playing,
  isInGame: async (p) => (await p.locator("#scrGame:not([hidden])").count()) > 0,
  async back(p) {
    await p.click("#barBack");
    await p.waitForSelector("#scrHome:not([hidden])");
  },
  /** One player forfeits from the menu (two players: the other wins). */
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
  ["a real game between friends: cards that fit stand up, a card that doesn't says why, the first out wins, both are placed", async ({ B, home, assert, sleep }) => {
    const [a, b] = await friendsAt(B, home);
    await a.waitForFunction(() => document.querySelectorAll("#hand .card").length === 7, null, { timeout: 10000 });
    let moves = 0, nopeSeen = false;
    const t0 = Date.now();
    while (!(await over(a)) && Date.now() - t0 < 150000) {
      for (const p of [a, b]) {
        if (!nopeSeen && (await myTurn(p)) && (await p.locator("#hand.mine .card:not(.can)").count())) {
          const before = await p.locator("#hand .card").count();
          await p.locator("#hand.mine .card:not(.can)").first().click();
          await sleep(200);
          assert(/needs|answer|play the card/i.test(await p.locator("#callText").innerText()), "a card that doesn't fit says why");
          assert((await p.locator("#hand .card").count()) === before, "a card that doesn't fit stays in hand");
          nopeSeen = true;
        }
        if (await moveIfMine(p)) moves++;
      }
      await sleep(120);
    }
    assert(await over(a), `the game should end (made ${moves} moves)`);
    await b.waitForSelector('[data-res="rematch"]', { timeout: 15000 });
    assert((await a.locator(".standings .row").count()) === 2, "both players are placed on the result");
    const titles = [await a.locator(".pl-res-head h2").innerText(), await b.locator(".pl-res-head h2").innerText()];
    assert(titles.some((t) => /victory/i.test(t)) && titles.some((t) => /2nd/i.test(t)), `one Victory, one 2nd place (${titles.join(", ")})`);
    await a.close2(); await b.close2();
  }],
  ["practice with three bots: four seats, five cards each, the bots play round to you", async ({ B, home, assert, sleep }) => {
    const p = await B.player({ name: "Bo" });
    await home(p);
    await p.click('[data-mode="practice"]'); await p.click('[data-key="seats"][data-val="4"]'); await p.click("#practiceBtn");
    await playing(p);
    await p.waitForFunction(() => document.querySelectorAll("#rivals .seat").length === 3, null, { timeout: 8000 });
    await p.waitForFunction(() => document.querySelectorAll("#hand .card").length === 5, null, { timeout: 10000 });
    const t0 = Date.now();
    let moved = false;
    while (Date.now() - t0 < 30000 && !moved) { if (await moveIfMine(p)) moved = true; else await sleep(150); }
    assert(moved, "your turn came round after the bots");
    await p.close2();
  }],
  ["no screen scrolls sideways at 360, 390 or 430 wide; the hand fits on screen", async ({ B, home, assert }) => {
    for (const width of [360, 390, 430]) {
      const p = await B.player({ width, height: 760 });
      await home(p);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `home scrolls sideways at ${width}`);
      await p.click('[data-mode="practice"]'); await p.click("#practiceBtn"); await playing(p);
      await p.waitForTimeout(3500);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `the game scrolls sideways at ${width}`);
      const fits = await p.evaluate(() => [...document.querySelectorAll("#hand .card")].every((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
      assert(fits, `the hand runs off screen at ${width}`);
      await p.close2();
    }
  }],
  ["keyboard only, reduced motion: arrows, Enter and D play against a bot", async ({ B, home, assert, sleep }) => {
    const p = await B.player({ reducedMotion: "reduce" });
    await home(p);
    await p.click('[data-mode="practice"]'); await p.click('[data-key="seats"][data-val="2"]'); await p.click("#practiceBtn"); await playing(p);
    let moves = 0;
    const t0 = Date.now();
    while (moves < 4 && Date.now() - t0 < 60000) {
      if (await over(p)) break;
      if (await myTurn(p)) {
        if (await p.locator("#picker:not([hidden])").count()) { await p.keyboard.press("1"); moves++; await sleep(300); continue; }
        const target = await p.evaluate(() => [...document.querySelectorAll("#hand .card")].findIndex((c) => c.classList.contains("can")));
        if (target < 0 && (await p.locator("#keepBtn:not([hidden])").count())) await p.keyboard.press("k");
        else if (target < 0) await p.keyboard.press("d");
        else {
          const cur = Math.max(0, await p.evaluate(() => [...document.querySelectorAll("#hand .card")].findIndex((c) => c.tabIndex === 0)));
          await p.locator("#hand .card").nth(cur).focus();
          for (let i = 0; i < Math.abs(target - cur); i++) await p.keyboard.press(target > cur ? "ArrowRight" : "ArrowLeft");
          await p.keyboard.press("Enter");
          if (await p.waitForSelector("#picker:not([hidden])", { timeout: 300 }).then(() => true, () => false)) await p.keyboard.press("1");
        }
        moves++;
        await p.waitForFunction(() => !document.querySelector("#call.mine"), null, { timeout: 5000 }).catch(() => {});
      }
      await sleep(150);
    }
    assert(moves >= 3 || (await over(p)), `made only ${moves} moves from the keyboard`);
    await p.close2();
  }],
];

export default adapter;
