#!/usr/bin/env node
/**
 * Ploto's browser tests: every registered game through the platform's lobby
 * paths, plus the launcher, in real Chromium against a fresh server.
 *
 *   npm run build && npm run e2e                     every game, every flow
 *   npm run e2e -- --game holdem                     one game
 *   npm run e2e -- --screens out/now                 also save screenshots (360 / 390 / 430 px)
 *   npm run e2e -- --screens out/now --compare out/before   and diff them against an earlier set
 *   npm run e2e -- --headed                          watch it
 *
 * A failing check saves a screenshot of every player's page (the path is printed),
 * then closes them so the next check starts clean.
 * A game takes part through its adapter, e2e/games/<id>.mjs (scaffolded with the
 * game): how to host a room, how to tell it's in the game, how to finish one.
 * The flows are the same for every game, and any console error fails the run.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assert, browser, checks, sleep, startServer } from "./lib.mjs";
import { compareScreens } from "./screens.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };

const server = await startServer();
const B = await browser(server.base, { headed: flag("headed") });
const failed = [];
const failDir = path.join(os.tmpdir(), `ploto-e2e-fails-${Date.now()}`);
const onFail = async (label) => {
  const files = await B.snap(failDir, label);
  if (files.length) console.log(`        screens: ${failDir}`);
  await B.closeAll();
};
try {
  const games = (await (await fetch(`${server.base}/play/games`)).json()).filter((g) => !opt("game") || g.id === opt("game"));
  assert(games.length, "no games registered (or --game didn't match)");

  for (const game of games) {
    const file = path.resolve("e2e/games", `${game.id}.mjs`);
    if (!fs.existsSync(file)) { console.log(`\n${game.title}: no adapter (e2e/games/${game.id}.mjs), skipped`); failed.push(`${game.title}: no e2e adapter`); continue; }
    const G = (await import(pathToFileURL(file).href)).default;
    const home = (p) => p.goHome(game.path);
    const code = async (p) => (await p.locator(".pl-codecard b").first().innerText()).trim();
    const joinByCode = async (p, c) => {
      await home(p);
      await p.fill("[data-code-form] input", c);
      await p.locator("[data-code-form] button").click();
    };
    /** Two players in one started game: A hosts, B joins by code, A starts if the game needs it. */
    async function twoInGame(opts = {}) {
      const a = await B.player({ name: "Ann" }), b = await B.player({ name: "Ben" });
      await home(a);
      await G.host(a, opts);
      await joinByCode(b, await code(a));
      await G.afterJoin?.(b);
      await G.start?.(a);
      await Promise.all([G.inGame(a), G.inGame(b)]);
      return [a, b];
    }
    const done = async (...pages) => { for (const p of pages) await p.close2(); };

    failed.push(...await checks(game.title, [
      ["home shows Ploto's lobby (modes, code form)", async () => {
        const p = await B.player();
        await home(p);
        assert(await p.locator("[data-mode]").count() >= 2, "fewer than 2 mode rows");
        assert(await p.locator("[data-code-form] input").count() === 1, "no code form");
        await done(p);
      }],
      ["host a room, a friend joins by code, the game starts", async () => done(...await twoInGame())],
      ["invite from the room: the card reaches the launcher, Join seats them", async () => {
        const [acA, acB] = [await B.account("Ivy"), await B.account("Jo")];
        await B.befriend(acA, acB);
        const a = await B.player({ account: acA }), b = await B.player({ account: acB });
        await b.goHome("/play");
        await home(a);
        await G.host(a, { forInvite: true });
        await a.locator('[data-do="invite"]').first().click();
        await a.locator(`[data-fid="${acB.id}"]`).click();
        await b.waitForSelector("#plInvite:not([hidden])", { timeout: 8000 });
        await b.locator('#plInvite [data-inv="yes"]').click();
        await b.waitForURL(new RegExp(game.path.replace(/[/-]/g, "\\$&")), { timeout: 8000 });
        await G.afterJoin?.(b);
        if (G.start) { // the host's picker says so once the friend sits down; they close it and start
          await a.waitForFunction((id) => document.querySelector(`[data-fid="${id}"]`)?.textContent.trim() === "Here", acB.id, { timeout: 8000 });
          await a.keyboard.press("Escape");
          await a.waitForSelector(".pl-sheet", { state: "detached", timeout: 4000 }).catch(() => {});
        }
        await G.start?.(a);
        await Promise.all([G.inGame(a), G.inGame(b)]);
        await done(a, b);
      }],
      ["quick play brings players together", async () => {
        const a = await B.player({ name: "Qia" }), b = await B.player({ name: "Qib" });
        await home(a); await home(b);
        await G.quick(a); await G.quick(b);
        await Promise.all([G.inGame(a, G.quickMs), G.inGame(b, G.quickMs)]);
        await done(a, b);
      }],
      ["practice starts against the bots", async () => {
        const p = await B.player({ name: "Pia" });
        await home(p);
        await G.practice(p);
        await G.inGame(p);
        await done(p);
      }],
      ["a reload brings you back to your room's lobby", async () => {
        const p = await B.player({ name: "Rae" });
        await home(p);
        await G.host(p);
        const c = await code(p);
        await p.reload({ waitUntil: "networkidle" });
        await p.waitForSelector(".pl-codecard b", { timeout: 8000 });
        assert((await code(p)) === c, "came back to a different room");
        await done(p);
      }],
      ["leaving a room's lobby gives the seat back", async () => {
        const a = await B.player({ name: "Lea" }), b = await B.player({ name: "Lou" });
        await home(a);
        await G.host(a);
        const c = await code(a);
        await G.back(a);
        await joinByCode(b, c);
        await G.afterJoin?.(b);
        await sleep(800);
        // b is now the only one in that room: it hasn't started without its host.
        assert(!(await G.isInGame(b)), "the room started with the host gone");
        await done(a, b);
      }],
      ...(G.finish ? [["play to the result, then rematch together", async () => {
        const [a, b] = await twoInGame({ quickFinish: true });
        await G.finish(a, b);
        await Promise.all([a.waitForSelector('[data-res="rematch"]', { timeout: G.finishMs || 60000 }), b.waitForSelector('[data-res="rematch"]', { timeout: G.finishMs || 60000 })]);
        await b.locator('[data-res="rematch"]').click();
        await a.waitForFunction(() => /join rematch/i.test(document.querySelector('[data-res="rematch"]')?.textContent || ""), null, { timeout: 8000 });
        await a.locator('[data-res="rematch"]').click();
        await G.start?.(b); // whoever asked first hosts the rematch
        await Promise.all([G.inGame(a), G.inGame(b)]);
        await done(a, b);
      }]] : []),
    ], { onFail }));

    if (opt("screens")) {
      const dir = path.resolve(opt("screens"));
      fs.mkdirSync(dir, { recursive: true });
      for (const width of [360, 390, 430]) {
        for (const [name, go] of [["home", async (p) => home(p)], ...(G.screens || [])]) {
          const p = await B.player({ name: "Vera", width, reducedMotion: "reduce" });
          try {
            await home(p);
            await go(p, { home });
            await sleep(400);
            await p.screenshot({ path: path.join(dir, `${game.id}-${name}-${width}.png`) });
          } catch (e) { failed.push(`${game.title}: screen ${name} at ${width}: ${e.message.split("\n")[0]}`); }
          await p.close2();
        }
      }
    }
  }

  failed.push(...await checks("Ploto", [
    ["the launcher has a card for every game", async () => {
      const p = await B.player();
      await p.goHome("/play");
      await sleep(800);
      for (const g of games) assert(await p.locator(`[data-game="${g.id}"]`).count() === 1, `no card for ${g.title}`);
      if (opt("screens")) await p.screenshot({ path: path.join(path.resolve(opt("screens")), "launcher-390.png") });
      await p.close2();
    }],
    ["Continue in the launcher takes you back to your room", async () => {
      const g = games[0];
      const G = (await import(pathToFileURL(path.resolve("e2e/games", `${g.id}.mjs`)).href)).default;
      const p = await B.player({ name: "Cat" });
      await p.goHome(g.path);
      await G.host(p);
      await p.goHome("/play");
      await p.waitForSelector("#continueBox:not([hidden])", { timeout: 8000 });
      await p.locator("#continueBox a").click();
      await p.waitForSelector(".pl-codecard b", { timeout: 8000 });
      await p.close2();
    }],
  ], { onFail }));

  // Screen diffs are a report, not a failure: codes, cards and teams are random, and some changes are meant.
  if (opt("screens") && opt("compare")) await compareScreens(B, path.resolve(opt("compare")), path.resolve(opt("screens")));
  if (B.errors.length) { console.log(`\nConsole errors:\n  ${[...new Set(B.errors)].join("\n  ")}`); failed.push(`${B.errors.length} console errors`); }
} catch (e) {
  console.error(e);
  failed.push(String(e.message || e));
} finally {
  await B.close();
  server.stop();
}
console.log(failed.length ? `\n${failed.length} failed:\n  ${failed.join("\n  ")}` : "\nAll passed, no console errors.");
process.exit(failed.length ? 1 : 0);
