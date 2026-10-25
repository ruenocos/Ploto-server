/** Sea Battle in Ploto's browser tests (e2e/run.mjs): how to drive its lobby and game. */
const playing = (p, ms = 15000) => p.waitForSelector("#scrGame:not([hidden])", { timeout: ms });

const adapter = {
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

/** Ship cells from a page's own sea (while it shows your fleet). */
async function fleetCells(p) {
  return p.evaluate(() => {
    const k = parseFloat(getComputedStyle(document.getElementById("board")).getPropertyValue("--k"));
    return [...document.querySelectorAll("#sea .layer-ships .ship")].map((el) => {
      const x = Math.round(parseFloat(el.style.left) / (10 * k)), y = Math.round(parseFloat(el.style.top) / (10 * k));
      const w = Math.round(parseFloat(el.style.width) / (10 * k)), h = Math.round(parseFloat(el.style.height) / (10 * k));
      return Array.from({ length: Math.max(w, h) }, (_, i) => (w > h ? [x + i, y] : [x, y + i]));
    });
  });
}
const myTurn = async (p) => (await p.locator("#call.mine #callTitle", { hasText: /your turn/i }).count()) > 0;

adapter.checks = [
  ["a real game: the fleet stays up through the coin flip, every SUNK stays inside the sea, the last sink wins", async ({ B, home, assert, sleep }) => {
    const a = await B.player({ name: "Ann" }), b = await B.player({ name: "Ben" });
    await home(a);
    await a.click('[data-mode="host"]'); await a.click('[data-key="board"][data-val=\'"quick"\']'); await a.click('[data-key="timer"][data-val="false"]'); await a.click("#createBtn");
    await a.waitForSelector(".pl-codecard b");
    const code = (await a.locator(".pl-codecard b").first().innerText()).trim();
    await home(b); await b.fill("[data-code-form] input", code); await b.locator("[data-code-form] button").click();
    await Promise.all([a.waitForSelector("#readyBtn"), b.waitForSelector("#readyBtn")]);
    const target = await fleetCells(b); // Ben's fleet, read from Ben's own screen
    await b.click("#readyBtn"); await a.click("#readyBtn");
    await a.waitForSelector(".coin-wrap", { timeout: 5000 });
    assert((await a.locator("#sea .layer-ships .ship").count()) === 4, "your fleet should stay on screen during the coin flip");
    const water = []; const taken = new Set(target.flat().map(([x, y]) => y * 8 + x));
    for (let c = 0; c < 64; c++) if (!taken.has(c)) water.push(c);
    const shots = target.flat();
    let stampsChecked = 0;
    const t0 = Date.now();
    while (shots.length && Date.now() - t0 < 120000) {
      // Ann aims at Ben's ships; Ben misses on purpose.
      if (await myTurn(a)) {
        const [x, y] = shots[0];
        const cell = a.locator(`#sea.aiming .cells button[data-c="${y * 8 + x}"]`);
        if (await cell.count()) { await cell.click(); shots.shift(); }
      } else if (await myTurn(b)) {
        const c = water.shift();
        const cell = b.locator(`#sea.aiming .cells button[data-c="${c}"]`);
        if (await cell.count()) await cell.click();
      }
      if (await a.locator("#sea .stamp").count()) {
        const inside = await a.evaluate(() => {
          const s = document.querySelector("#sea .stamp")?.getBoundingClientRect(), sea = document.getElementById("sea").getBoundingClientRect();
          return !s || (s.left >= sea.left - 1 && s.right <= sea.right + 1 && s.top >= sea.top - 1 && s.bottom <= sea.bottom + 1);
        });
        assert(inside, "a SUNK stamp spilled outside the sea");
        stampsChecked++;
      }
      await sleep(120);
    }
    await a.waitForSelector('[data-res="rematch"]', { timeout: 20000 });
    assert(/victory/i.test(await a.locator(".pl-res-head h2").innerText()), "Ann sank the whole fleet: Victory");
    assert(stampsChecked > 0, "saw no SUNK stamp");
    await a.close2(); await b.close2();
  }],
];

export default adapter;
