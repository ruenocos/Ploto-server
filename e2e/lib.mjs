/**
 * Helpers for Ploto's browser tests (e2e/run.mjs): a server on a free port with
 * its own data, Playwright's Chromium, players (guests or accounts), and checks.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

/** Playwright, from the project or wherever it's installed (it isn't a dependency: CI and devs bring their own). */
export function playwright() {
  for (const from of [import.meta.url, path.join(process.cwd(), "x.js"), ...(process.env.NODE_PATH || "").split(path.delimiter).filter(Boolean).map((p) => path.join(p, "x.js")), "/opt/node22/lib/node_modules/x.js"]) {
    try { return createRequire(from)("playwright"); } catch {}
  }
  throw new Error("Playwright isn't installed: npm i -D playwright && npx playwright install chromium");
}

const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

/** Start the built server (npm run build first) on a free port, with throwaway data. */
export async function startServer() {
  const port = await freePort();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "ploto-e2e-"));
  const proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "dist/index.js"], {
    env: { ...process.env, PLOTO_PORT: String(port), PLOTO_DATA_DIR: dataDir, PLOTO_HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return { base, log: () => log, stop: () => { proc.kill(); rmSync(dataDir, { recursive: true, force: true }); } };
}

/** A browser and its players; every console error or page error is collected. */
export async function browser(base, { headed = false } = {}) {
  const b = await playwright().chromium.launch({ headless: !headed });
  const errors = [];
  const open = new Map(); // pages not closed yet: what a failing check screenshots
  let n = 0;
  const api = async (method, p, key, body) => (await fetch(base + p, {
    method, headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })).json();
  return {
    errors,
    api,
    /** Screenshot every open page into `dir` (a failing check's evidence); returns the files. */
    async snap(dir, label) {
      mkdirSync(dir, { recursive: true });
      const files = [];
      let i = 0;
      for (const [page, who] of open) {
        const file = path.join(dir, `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${i++}-${who}.png`);
        try { await page.screenshot({ path: file }); files.push(file); } catch {}
      }
      return files;
    },
    /** An account with a unique name. */
    async account(name) { return api("POST", "/api/accounts", null, { username: `${name}${Date.now().toString(36).slice(-4)}${n++}` }); },
    /** Make two accounts friends. */
    async befriend(a, b2) {
      await api("POST", "/api/friends", a.key, { username: b2.username });
      await api("POST", "/api/friends", b2.key, { username: a.username });
    },
    /** A player: a guest with a name, or signed in as an account. */
    async player({ name = "Guest", account = null, width = 390, height = 844, reducedMotion = "no-preference", dpr = 1 } = {}) {
      const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion });
      await ctx.addInitScript(([nm, acct]) => {
        if (acct) { localStorage.setItem("mm.key", JSON.stringify(acct.key)); localStorage.setItem("mm.account", JSON.stringify({ id: acct.id, username: acct.username })); }
        else localStorage.setItem("mm.guestName", JSON.stringify(nm));
      }, [name, account]);
      const page = await ctx.newPage();
      const who = account?.username || name;
      page.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
      page.on("console", (m) => m.type() === "error" && errors.push(`${who}: ${m.text()}`));
      page.goHome = (p) => page.goto(base + p, { waitUntil: "networkidle" });
      open.set(page, who);
      page.close2 = () => { open.delete(page); return ctx.close(); };
      return page;
    },
    /** Close every page still open (after a failed check). */
    async closeAll() { for (const page of [...open.keys()]) await page.close2().catch(() => {}); },
    close: () => b.close(),
  };
}

/** Run named checks, reporting each; returns the failures. `onFail(name)` runs before a failed check moves on. */
export async function checks(title, list, { onFail = null } = {}) {
  const failed = [];
  console.log(`\n${title}`);
  for (const [name, fn] of list) {
    const t0 = Date.now();
    try {
      await fn();
      console.log(`  ok    ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (e) {
      console.log(`  FAIL  ${name}: ${String(e.message || e).split("\n")[0]}`);
      failed.push(`${title}: ${name}`);
      if (onFail) await onFail(`${title} ${name}`);
    }
  }
  return failed;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function assert(cond, msg) { if (!cond) throw new Error(msg); }
