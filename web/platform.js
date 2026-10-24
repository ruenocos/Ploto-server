/*
 * Ploto shared client toolkit (window.Ploto), loaded by every page: the
 * launcher, Match Monsters and Hold'em. The parts around the games live here
 * once: the server connection, your account and name, settings, sheets,
 * toasts, sounds, and the lobby socket that carries friends, presence and
 * invites. See docs/PLATFORM.md for the contract.
 *
 * Storage keys are shared with Match Monsters' page (mm.*), so your name,
 * account and settings carry from page to page.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const local = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  // Session storage is a convenience (resume after reload); never required.
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { sessionStorage.removeItem(k); } catch {} },
  };
  const newId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  const peerId = store.get("mm.peer") || (() => { const id = newId(); store.set("mm.peer", id); return id; })();
  const WS_BASE = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  const touch = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

  /* ------------------------------------------------------------ errors */
  const ERROR_TEXT = {
    "not connected": "Not connected. Check your connection and try again",
    "connection closed": "The connection dropped. Try again",
    "connection failed": "Couldn't reach the server",
    "timed out": "The server didn't answer. Try again",
  };
  /** A failure as players should read it: known connection errors in plain words, internal ones as a retry. */
  function errText(e) {
    const m = String(e?.message ?? e ?? "").trim();
    if (ERROR_TEXT[m]) return ERROR_TEXT[m];
    if (!m || /^parse\(\)|required$|payload|coordinate|unknown (lobby )?method|not seated|^HTTP \d|unsupported/.test(m)) return "Something went wrong. Try again";
    return m[0].toUpperCase() + m.slice(1);
  }

  /* ------------------------------------------------------------ settings */
  // Per device: sound, haptics, hints, text size and motion ("device" follows prefers-reduced-motion).
  const SETTINGS_KEY = "mm.settings";
  const settings = Object.assign({ sound: true, haptics: true, hints: true, text: 1, motion: "device" }, local.get(SETTINGS_KEY) || {});
  const systemReduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reduceMotion = () => settings.motion === "reduced" || !!systemReduce?.matches;
  /** Snap the Silkscreen sizes (--fl-*) so each font pixel is whole device pixels on this screen. */
  function sizeType() {
    const dpr = window.devicePixelRatio || 1;
    const root = document.documentElement.style;
    for (const [name, k] of [["--fl-1", 1.5], ["--fl-2", 2], ["--fl-3", 3], ["--fl-4", 4], ["--fl-6", 6]]) {
      root.setProperty(name, (8 * Math.max(1, Math.round(k * dpr))) / dpr + "px");
    }
  }
  const settingsHooks = [];
  function applySettings() {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion());
    document.documentElement.style.setProperty("--ts", String(settings.text));
    window.MM_FEEDBACK?.configure({ sound: settings.sound, haptics: settings.haptics });
    for (const fn of settingsHooks) fn(settings);
  }
  function saveSettings() {
    local.set(SETTINGS_KEY, settings);
    applySettings();
  }
  const cue = (name, opts) => window.MM_FEEDBACK?.cue(name, opts);

  /* ------------------------------------------------------------ toast + sheet */
  function toast(msg, ms = 1800) {
    let t = $("plToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "plToast";
      t.className = "pl-toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), ms);
  }

  let sheetClose = null;
  let sheetOpener = null;
  /**
   * Open a bottom sheet (a modal dialog) with trusted `html`. Focus moves to the
   * sheet itself, never to a text box on a touch screen, so the phone keyboard
   * only opens when you tap to type. Returns the sheet element.
   */
  function sheet(html, { onClose = null, label = "" } = {}) {
    closeSheet(true);
    let scrim = $("plScrim");
    if (!scrim) {
      scrim = document.createElement("div");
      scrim.id = "plScrim";
      scrim.className = "pl-scrim";
      document.body.appendChild(scrim);
    }
    sheetOpener = document.activeElement;
    scrim.innerHTML = `<div class="pl-sheet" role="dialog" aria-modal="true" tabindex="-1"${label ? ` aria-label="${esc(label)}"` : ""}>${html}</div>`;
    scrim.classList.remove("hidden");
    scrim.onclick = (e) => { if (e.target === scrim) closeSheet(); };
    sheetClose = onClose;
    const el = scrim.firstElementChild;
    const first = el.querySelector("input:not([type=hidden])");
    if (first && !touch()) first.focus();
    else el.focus({ preventScroll: true });
    return el;
  }
  function closeSheet(silent = false) {
    const scrim = $("plScrim");
    if (!scrim || scrim.classList.contains("hidden")) return;
    scrim.classList.add("hidden");
    scrim.innerHTML = "";
    const fn = sheetClose;
    sheetClose = null;
    if (!silent) fn?.();
    sheetOpener?.focus?.({ preventScroll: true });
    sheetOpener = null;
  }
  const sheetOpen = () => !!$("plScrim") && !$("plScrim").classList.contains("hidden");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheetOpen()) { e.preventDefault(); closeSheet(); }
    // Keep Tab inside an open sheet.
    if (e.key === "Tab" && sheetOpen()) {
      const box = $("plScrim").firstElementChild;
      const items = [...box.querySelectorAll("button:not([disabled]), input, a[href], [tabindex]:not([tabindex='-1'])")];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /** An in-app yes/no question (never the browser's confirm box). Resolves true for yes. */
  function confirm({ title, body = "", yes = "Yes", no = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      let answered = false;
      const answer = (v) => { if (!answered) { answered = true; resolve(v); } };
      const el = sheet(
        `<h2>${esc(title)}</h2>` + (body ? `<p class="muted" style="text-align:center;margin:0">${esc(body)}</p>` : "") +
        `<div class="pl-actions"><button class="${danger ? "danger" : ""}" data-a="yes">${esc(yes)}</button><button class="ghost" data-a="no">${esc(no)}</button></div>`,
        { onClose: () => answer(false), label: title },
      );
      el.onclick = (e) => {
        const b = e.target.closest("[data-a]");
        if (!b) return;
        answer(b.dataset.a === "yes");
        closeSheet(true);
      };
    });
  }

  const SETTING_ROWS = [
    { key: "sound", label: "Sound", options: [[true, "On"], [false, "Off"]] },
    { key: "haptics", label: "Vibration", options: [[true, "On"], [false, "Off"]] },
    { key: "text", label: "Text size", options: [[1, "Normal"], [1.15, "Large"], [1.3, "Larger"]] },
    { key: "motion", label: "Motion", options: [["device", "Device"], ["reduced", "Reduced"]] },
  ];
  function openSettings() {
    const el = sheet(
      `<h2>Settings</h2>` +
      SETTING_ROWS.map((r) =>
        `<div style="display:grid;gap:6px"><span class="pl-label">${r.label}</span><div class="pl-seg" role="group" aria-label="${r.label}">` +
        r.options.map(([v, l]) => `<button data-key="${r.key}" data-val='${JSON.stringify(v)}' aria-pressed="${settings[r.key] === v}">${l}</button>`).join("") +
        `</div></div>`).join("") +
      `<div class="pl-actions"><button class="ghost" data-close>Close</button></div>`,
      { label: "Settings" },
    );
    el.onclick = (e) => {
      if (e.target.closest("[data-close]")) return closeSheet();
      const b = e.target.closest("[data-key]");
      if (!b) return;
      settings[b.dataset.key] = JSON.parse(b.dataset.val);
      saveSettings();
      if (b.dataset.key === "sound" && settings.sound) cue("select");
      if (b.dataset.key === "haptics" && settings.haptics) window.MM_FEEDBACK?.testBuzz?.();
      for (const x of el.querySelectorAll(`[data-key="${b.dataset.key}"]`)) x.setAttribute("aria-pressed", String(x === b));
    };
  }

  /* ------------------------------------------------------------ protoo client */
  function connect(roomId) {
    const sock = new WebSocket(`${WS_BASE}/?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent(peerId)}`, "protoo");
    const pending = new Map();
    let nextId = 1;
    sock._handlers = {};
    sock.request = (method, data = {}) =>
      new Promise((resolve, reject) => {
        if (sock.readyState !== WebSocket.OPEN) return reject(new Error("not connected"));
        const id = nextId++;
        pending.set(id, { resolve, reject });
        sock.send(JSON.stringify({ request: true, id, method, data }));
      });
    sock.on = (method, fn) => { sock._handlers[method] = fn; };
    sock.addEventListener("message", (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.response) {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.errorReason || "error"));
      } else if (msg.notification) {
        sock._handlers[msg.method]?.(msg.data);
      }
    });
    sock.addEventListener("close", () => {
      for (const p of pending.values()) p.reject(new Error("connection closed"));
      pending.clear();
    });
    return sock;
  }
  const waitOpen = (sock) =>
    new Promise((res, rej) => {
      if (sock.readyState === WebSocket.OPEN) return res();
      sock.addEventListener("open", () => res(), { once: true });
      sock.addEventListener("error", () => rej(new Error("connection failed")), { once: true });
      sock.addEventListener("close", (ev) => rej(Object.assign(new Error("connection closed"), { code: ev.code })), { once: true });
    });

  /* ------------------------------------------------------------ account + name */
  let account = local.get("mm.account"); // { id, username }
  const accountHooks = [];
  function setAccount(a) {
    account = a;
    if (a) local.set("mm.account", a); else local.del("mm.account");
    for (const fn of accountHooks) fn(a);
  }
  async function api(method, path, body) {
    const key = local.get("mm.key");
    const res = await fetch(path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(key ? { authorization: `Bearer ${key}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
    return data;
  }
  async function restoreAccount() {
    if (!local.get("mm.key")) { setAccount(null); return null; }
    try {
      const me = await api("GET", "/api/me");
      setAccount({ id: me.id, username: me.username });
    } catch (e) {
      // 401: the key no longer exists (e.g. the server's data was reset).
      if (e.status === 401) { local.del("mm.key"); setAccount(null); toast("Your account wasn't found. Claim a name again", 3000); }
    }
    if (account) lobby().catch(() => {});
    return account;
  }
  async function claim(username) {
    const res = await api("POST", "/api/accounts", { username });
    local.set("mm.key", res.key);
    setAccount({ id: res.id, username: res.username });
    await lobby().catch(() => {});
    return account;
  }
  async function signInWithKey(key) {
    const before = local.get("mm.key");
    local.set("mm.key", String(key || "").trim());
    try {
      const me = await api("GET", "/api/me");
      setAccount({ id: me.id, username: me.username });
      await lobby().catch(() => {});
      return true;
    } catch {
      if (before) local.set("mm.key", before); else local.del("mm.key");
      toast("That key didn't work");
      return false;
    }
  }
  const guestName = () => { const n = local.get("mm.guestName"); return typeof n === "string" && n.trim() ? n.trim() : null; };
  const displayName = () => (account ? account.username : guestName() || "Player");
  /** Ask for a name (or change it). Resolves the name, or null if closed. */
  function askName({ title = "What should we call you?", body = "Other players see this name.", go = "Let's play" } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const el = sheet(
        `<h2>${esc(title)}</h2><p class="muted" style="text-align:center;margin:0">${esc(body)}</p>` +
        `<form class="pl-form" data-name><label class="sr-only" for="plName">Your name</label><input id="plName" type="text" placeholder="Your name" maxlength="16" autocomplete="nickname" required />` +
        `<button class="small" type="submit">${esc(go)}</button></form>` +
        `<p class="muted" style="font-size:var(--fs-s);margin:0;text-align:center">Want to keep your stats and add friends? <a href="#" data-claim>Claim a username</a></p>`,
        { onClose: () => finish(null), label: title },
      );
      const input = el.querySelector("#plName");
      input.value = guestName() || "";
      el.querySelector("[data-name]").onsubmit = (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return input.focus();
        local.set("mm.guestName", name);
        for (const fn of accountHooks) fn(account);
        closeSheet(true);
        finish(name);
      };
      el.querySelector("[data-claim]").onclick = (e) => { e.preventDefault(); closeSheet(true); finish(null); openClaim(); };
    });
  }
  /** True once there's a name to play under: an account, a guest name, or one just given. */
  async function ensureName(opts) {
    if (account || guestName()) return true;
    return (await askName(opts)) != null;
  }
  /** Claim a username (it keeps your stats and lets friends find you). Resolves the account or null. */
  function openClaim({ title = "Claim a username", body = "It keeps your stats and lets friends find you. No password: this device keeps a key." } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const el = sheet(
        `<h2>${esc(title)}</h2><p class="muted" style="text-align:center;margin:0">${esc(body)}</p>` +
        `<form class="pl-form" data-claim><label class="sr-only" for="plClaim">Username</label><input id="plClaim" type="text" placeholder="Username" maxlength="16" autocomplete="nickname" />` +
        `<button class="small" type="submit">Claim</button></form>` +
        `<p class="muted" style="font-size:var(--fs-s);margin:0;text-align:center">Played on another device? <a href="#" data-key>Sign in with your key</a></p>` +
        `<div class="pl-actions"><button class="ghost" data-close>Close</button></div>`,
        { onClose: () => finish(account), label: title },
      );
      const input = el.querySelector("#plClaim");
      input.value = guestName() || "";
      el.querySelector("[data-claim]").onsubmit = async (e) => {
        e.preventDefault();
        try {
          await claim(input.value.trim());
          toast(`Signed in as ${account.username} on this device`, 2600);
          closeSheet(true);
          finish(account);
        } catch (err) { toast(errText(err), 2600); }
      };
      el.querySelector("[data-close]").onclick = () => closeSheet();
      el.querySelector("[data-key]").onclick = (e) => {
        e.preventDefault();
        const k = sheet(
          `<h2>Sign in with a key</h2><p class="muted" style="text-align:center;margin:0">Paste the key from your profile on another device.</p>` +
          `<form class="pl-form" data-k><label class="sr-only" for="plKey">Key</label><input id="plKey" type="text" placeholder="mm_…" autocomplete="off" /><button class="small" type="submit">Sign in</button></form>` +
          `<div class="pl-actions"><button class="ghost" data-close>Close</button></div>`,
          { onClose: () => finish(account), label: "Sign in with a key" },
        );
        k.querySelector("[data-k]").onsubmit = async (ev) => {
          ev.preventDefault();
          if (await signInWithKey(k.querySelector("#plKey").value)) { closeSheet(true); finish(account); }
        };
        k.querySelector("[data-close]").onclick = () => closeSheet();
      };
    });
  }

  /* ------------------------------------------------------------ the lobby socket */
  let lobbySock = null;
  let lobbyOpening = null;
  let lobbyRetry = 0;
  const lobbyHandlers = new Map(); // method -> Set<fn>
  /** Listen for a lobby notification (survives reconnects). Returns an unsubscribe function. */
  function onLobby(method, fn) {
    if (!lobbyHandlers.has(method)) lobbyHandlers.set(method, new Set());
    lobbyHandlers.get(method).add(fn);
    if (lobbySock) lobbySock.on(method, (d) => { for (const h of lobbyHandlers.get(method) || []) h(d); });
    return () => lobbyHandlers.get(method)?.delete(fn);
  }
  let activity = null;
  /** The shared lobby connection, signed in when there's an account. */
  async function lobby() {
    if (!lobbySock || lobbySock.readyState > WebSocket.OPEN) {
      if (!lobbyOpening) {
        lobbyOpening = (async () => {
          const sock = connect("lobby");
          await waitOpen(sock);
          lobbySock = sock;
          lobbyRetry = 0;
          for (const method of lobbyHandlers.keys()) sock.on(method, (d) => { for (const h of lobbyHandlers.get(method) || []) h(d); });
          sock.addEventListener("close", () => {
            if (lobbySock !== sock) return;
            lobbySock = null;
            // Signed-in players stay reachable (friends, invites): reconnect with backoff.
            if (account) setTimeout(() => lobby().catch(() => {}), Math.min(15000, 1000 * 2 ** lobbyRetry++));
          });
        })().finally(() => { lobbyOpening = null; });
      }
      await lobbyOpening;
    }
    if (account && lobbySock._authed !== account.id) {
      await lobbySock.request("platform:auth", { key: local.get("mm.key") });
      lobbySock._authed = account.id;
      if (activity) lobbySock.request("platform:activity", activity).catch(() => {});
    }
    return lobbySock;
  }
  /** Tell friends what you're doing ("At a Hold'em table"); null clears it. */
  function setActivity(gameId, label) {
    activity = gameId ? { gameId, label } : {};
    if (account) lobby().then((s) => s.request("platform:activity", activity)).catch(() => {});
  }

  /* ------------------------------------------------------------ games registry */
  let gamesCache = null;
  const games = () => (gamesCache ??= fetch("/play/games").then((r) => r.json()).catch(() => { gamesCache = null; return []; }));

  // Boot: type sizes and settings now, again when the page finishes loading.
  sizeType();
  window.addEventListener("resize", sizeType);
  systemReduce?.addEventListener?.("change", applySettings);
  applySettings();
  window.addEventListener("load", applySettings);

  window.Ploto = {
    $, esc, sleep, local, store, newId, peerId, WS_BASE, errText,
    settings, saveSettings, applySettings, openSettings, onSettings: (fn) => settingsHooks.push(fn), reduceMotion, cue,
    toast, sheet, closeSheet, sheetOpen, confirm,
    connect, waitOpen, lobby, onLobby, setActivity,
    get account() { return account; }, onAccount: (fn) => accountHooks.push(fn), setAccount, api, restoreAccount, claim, signInWithKey, openClaim,
    guestName, displayName, askName, ensureName,
    games,
  };
})();
