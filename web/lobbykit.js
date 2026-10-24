/**
 * The platform's lobby screens, shared by every game (docs/PLATFORM.md, "Lobby kit").
 *
 * The server side is the game kit (src/platform/kit.ts + lobbyRoom.ts): every
 * game has the same lobby methods (`<prefix>quick/host/practice/info/join/
 * invite/acceptInvite`) and every room the same `lobby:*` methods and
 * `lobby:update {view}` notification. This file is the matching client: a game
 * describes itself once and gets
 *
 *   home(root, …)        the game home: modes and "Have a code?" (your name lives in the launcher's Profile)
 *   seat(method, data)   take a seat from the lobby (backing out gives it back)
 *   join(code)           what a code leads to, a name, then the seat
 *   renderRoom(view, …)  the room lobby from a LobbyView: code card, settings line,
 *                        seats with invite / add bot / remove, start or "waiting for"
 *   invitePicker, share, editSettings, settings fields from the game's schema
 *   backGuard(…)         the phone's back button walks the game's screens
 *   menu, rules, renderResult  the in-game menu, How to play and the result screen, the same in every game
 *
 * What happens once the game starts is the game's own business.
 */
(() => {
  "use strict";
  const P = window.Ploto;
  const { esc, local, toast, cue } = P;

  const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const AV_COLORS = ["#6a4fe0", "#36b65b", "#d8364b", "#a8740e", "#4a5486", "#33267d"];

  /**
   * @param {object} def
   * @param {string} def.gameId
   * @param {string} def.prefix       lobby method prefix, e.g. "holdem:"
   * @param {string} def.path         the game's page, e.g. "/play/holdem"
   * @param {string} def.title        the game's name ("Hold'em")
   * @param {{code: string, room: string, quick: string, yours: string}} def.nouns
   *        "Table code", "table", "Quick table", "Your table"
   * @param {Array<object>} [def.schema]   hosted-room settings: {key, label, kind: "choice"|"toggle", options?, hint?, min?}
   * @param {object} [def.defaults]        default settings for a hosted room
   * @param {(settings: object) => string} [def.summary]  one line about a room's settings
   * @param {(code: string) => string} def.shareText
   * @param {string} [def.quickNote]       under the quick countdown ("Bots fill the empty seats")
   * @param {string} [def.fullText]        rooms that start when full: the waiting line ("Starts as soon as your friend joins")
   * @param {(seat: object, view: object) => string|null} [def.seatNote]  a seat's note instead of "Ready"
   * @param {{bot?: () => string, remove?: () => string, chev?: () => string}} [def.art]
   * @param {() => {steps: string[], extra?: string}} [def.rules]  how to play: short steps (trusted markup) and anything after them
   */
  function lobbyKit(def) {
    const settingsKey = `${def.gameId}.settings`;
    const art = Object.assign({
      bot: () => window.MM_ICONS?.icon("person") ?? "B",
      remove: () => "×",
      chev: () => "›",
    }, def.art || {});
    const kit = {
      def,
      /** The host's last settings, remembered on this device. */
      settings: Object.assign({}, def.defaults || {}, local.get(settingsKey) || {}),
      /** Invites sent from this tab (only their sender can withdraw them). */
      sent: new Set(),
      seatToken: 0,
    };
    const lobby = () => P.lobby();
    const m = (name) => def.prefix + name;
    kit.saveSettings = () => local.set(settingsKey, kit.settings);
    kit.link = (code) => `${location.origin}${def.path}?code=${encodeURIComponent(code)}`;
    kit.ordinal = ordinal; // 1st, 2nd, 3rd: places in the game's own screens
    kit.isHost = (v) => !!v && v.host >= 0 && v.host === v.you;
    const Room = def.nouns.room[0].toUpperCase() + def.nouns.room.slice(1);
    kit.title = (v) => (!v ? Room : v.mode === "quick" ? def.nouns.quick : kit.isHost(v) ? def.nouns.yours : Room);

    /* ------------------------------------------------------------ avatars */
    kit.avatar = (s, cls = "") => {
      if (s.kind === "bot") return `<span class="pl-av bot ${cls}" style="--av:#2f375c">${art.bot()}</span>`;
      const init = (String(s.name || "?").trim()[0] || "?").toUpperCase();
      return `<span class="pl-av ${cls}" style="--av:${AV_COLORS[s.seat % AV_COLORS.length]}">${esc(init)}</span>`;
    };

    /* ------------------------------------------------------------ settings fields */
    /** Settings controls from the game's schema (or another list, e.g. practice's own). */
    kit.fieldsHTML = (values, { minSeats = 2, schema = def.schema } = {}) =>
      (schema || []).map((f) => {
        if (f.kind === "toggle") {
          return `<button class="pl-switch" role="switch" data-key="${f.key}" aria-checked="${!!values[f.key]}">${esc(f.label)}<span class="pl-knob"></span></button>`;
        }
        const opts = f.options.map(([v, l]) => `<button type="button" data-key="${f.key}" data-val='${JSON.stringify(v)}' aria-pressed="${values[f.key] === v}"${f.key === "seats" && v < minSeats ? " disabled" : ""}>${esc(l)}</button>`).join("");
        const hint = f.hint ? `<p class="hint">${esc(f.hint)}</p>` : "";
        return `<div class="field"><span class="pl-label">${esc(f.label)}</span><div class="pl-seg" role="group" aria-label="${esc(f.label)}">${opts}</div>${hint}</div>`;
      }).join("");
    kit.wireFields = (root, values, onChange) => {
      root.onclick = (e) => {
        const b = e.target.closest("[data-key]");
        if (!b || b.disabled) return;
        const k = b.dataset.key;
        if (b.getAttribute("role") === "switch") {
          values[k] = !values[k];
          b.setAttribute("aria-checked", String(values[k]));
        } else {
          values[k] = JSON.parse(b.dataset.val);
          for (const x of root.querySelectorAll(`[data-key="${k}"]`)) x.setAttribute("aria-pressed", String(x === b));
        }
        cue("select", { vol: 0.6 });
        onChange?.();
      };
    };

    /* ------------------------------------------------------------ home */
    /**
     * Wire the game home: mode rows (`[data-mode]`), the code form (`[data-code-form]`)
     * The game draws its hero. Your name isn't here: it lives in the launcher's
     * Profile, and Ploto asks for one the first time you take a seat.
     */
    kit.home = (root, { onMode, onCode }) => {
      for (const s of root.querySelectorAll("[data-chev]")) if (!s.firstChild) s.innerHTML = art.chev();
      for (const b of root.querySelectorAll("[data-mode]")) {
        b.onclick = () => { cue("select"); onMode(b.dataset.mode); };
      }
      const form = root.querySelector("[data-code-form]");
      if (form) form.onsubmit = (e) => {
        e.preventDefault();
        const input = form.querySelector("input");
        const code = input.value.trim().toUpperCase();
        if (!code) return input.focus();
        (onCode || kit.join)(code);
      };
    };

    /* ------------------------------------------------------------ taking a seat */
    /**
     * Ask the lobby for a seat. If the player backs out (`cancelSeat()`) before the
     * answer comes, the seat is given straight back and this resolves to null.
     */
    kit.seat = async (method, data = {}) => {
      const token = ++kit.seatToken;
      const lob = await lobby();
      const r = await lob.request(m(method), { displayName: P.displayName(), ...data });
      if (token !== kit.seatToken) { kit.abandon(r); return null; }
      return r;
    };
    kit.cancelSeat = () => { kit.seatToken++; };
    /** Give a seat back without entering the room. */
    kit.abandon = async ({ roomId }) => {
      try {
        const s = P.connect(roomId);
        await P.waitOpen(s);
        await s.request("lobby:leave", {});
        s.close();
      } catch {}
    };
    kit.info = async (code) => (await lobby()).request(m("info"), { code });

    /* ------------------------------------------------------------ invites */
    kit.invite = async (friendId, roomId, name) => {
      const lob = await lobby();
      const r = await lob.request(m("invite"), { friendId, roomId });
      kit.sent.add(r.inviteId);
      redraw(); // the held seat arrived before the answer: now it can offer Cancel
      toast(name ? `Invite sent to ${name}` : "Invite sent");
      cue("ready");
      return r;
    };
    kit.cancelInvite = async (inviteId) => {
      const lob = await lobby();
      await lob.request("platform:cancelInvite", { inviteId });
      kit.sent.delete(inviteId);
    };
    /** Draw the last room lobby again (what this tab sent changed, not the room). */
    let last = null;
    function redraw() {
      if (last && last.opts.main.isConnected && !last.opts.main.closest("[hidden]")) kit.renderRoom(last.view, last.opts);
    }
    kit.share = async (code) => {
      const url = kit.link(code);
      const text = def.shareText(code);
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ title: def.title, text, url }); return; } catch (e) { if (e?.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(url); toast("Invite link copied"); }
      catch { toast(url, 4000); }
    };
    /** Pick an online friend for a seat in this room (or share the link instead). */
    let picker = null; // the open picker, so a friend who takes their seat reads "Here", not "Sent"
    const markSeated = (v) => {
      if (!picker || !picker.list.isConnected || picker.roomId !== v.roomId) return;
      const seated = new Set((v.seats || []).map((s) => s.name));
      for (const b of picker.list.querySelectorAll("[data-fn]")) if (seated.has(b.dataset.fn)) { b.disabled = true; b.textContent = "Here"; }
    };
    kit.invitePicker = async (view) => {
      if (!P.account) {
        const el = P.sheet(`<h2>Invite a friend</h2><p class="muted" style="text-align:center;margin:0">Claim a username to add friends and invite them. Or share the ${esc(def.nouns.room)} link.</p>` +
          `<div class="pl-actions"><button id="ipClaim">Claim a username</button><button class="ghost" id="ipShare">Share invite</button></div>`, { label: "Invite a friend" });
        el.querySelector("#ipClaim").onclick = async () => { P.closeSheet(true); const a = await P.openClaim(); if (a) kit.invitePicker(view); };
        el.querySelector("#ipShare").onclick = () => { P.closeSheet(); kit.share(view.code); };
        return;
      }
      const el = P.sheet(`<h2>Invite a friend</h2><div class="pl-seats" id="ipList"><div class="pl-empty">Loading friends</div></div><div class="pl-actions"><button class="ghost" id="ipShare">Share invite instead</button></div>`, { label: "Invite a friend" });
      el.querySelector("#ipShare").onclick = () => { P.closeSheet(); kit.share(view.code); };
      let friends = [];
      try { friends = (await P.api("GET", "/api/friends")).friends || []; } catch { friends = []; }
      const list = el.querySelector("#ipList");
      if (!list) return;
      const seated = new Set((view.seats || []).map((s) => s.name));
      const online = friends.filter((f) => f.online);
      if (!online.length) {
        list.innerHTML = `<div class="pl-empty">${friends.length ? "None of your friends are online right now" : "No friends yet. Add them from the Ploto launcher"}</div>`;
        return;
      }
      list.innerHTML = online.map((f) => {
        const here = seated.has(f.username);
        return `<div class="pl-seat pl-frame">${kit.avatar({ seat: f.username.length, name: f.username, kind: "player" })}<div class="pl-seat-t"><span class="nm ell">${esc(f.username)}</span><span class="note">${esc(f.activity?.label || "Online")}</span></div>` +
          `<button class="small" data-fid="${esc(f.id)}" data-fn="${esc(f.username)}"${here ? " disabled" : ""}>${here ? "Here" : "Invite"}</button></div>`;
      }).join("");
      picker = { list, roomId: view.roomId };
      list.onclick = async (e) => {
        const b = e.target.closest("[data-fid]");
        if (!b) return;
        b.disabled = true;
        try { await kit.invite(b.dataset.fid, view.roomId, b.dataset.fn); b.textContent = "Sent"; }
        catch (err) { toast(P.errText(err), 2600); b.disabled = false; }
      };
    };

    /* ------------------------------------------------------------ the room lobby */
    kit.editSettings = (view, req) => {
      const values = { ...view.settings };
      const occupied = view.seats.filter((s) => s.kind !== "empty").length;
      const el = P.sheet(`<h2>${esc(Room)} settings</h2><div class="fields" id="esFields">${kit.fieldsHTML(values, { minSeats: Math.max(2, occupied) })}</div>` +
        `<div class="pl-actions"><button id="esSave">Save</button><button class="ghost" data-close>Cancel</button></div>`, { label: `${Room} settings` });
      kit.wireFields(el.querySelector("#esFields"), values);
      el.querySelector("[data-close]").onclick = () => P.closeSheet();
      el.querySelector("#esSave").onclick = async () => {
        try {
          await req("lobby:settings", { settings: values });
          Object.assign(kit.settings, values);
          kit.saveSettings();
          P.closeSheet();
        } catch (e) { toast(P.errText(e), 2600); }
      };
    };
    kit.quickText = (v) => {
      if (!v.startsAt) return "Waiting for players";
      const s = Math.ceil((v.startsAt - Date.now()) / 1000);
      return s > 0 ? `Starting in ${s} s` : "Starting now";
    };
    function seatRow(s, v, host, first) {
      const you = s.seat === v.you;
      if (s.kind === "empty") {
        // Only the first open seat carries the buttons: the rest read as plain open seats.
        const btns = host && first ? `<button class="ghost small" data-do="invite" data-seat="${s.seat}">Invite</button>${v.bots ? `<button class="ghost small" data-do="bot" data-seat="${s.seat}">Add bot</button>` : ""}` : "";
        return `<div class="pl-seat open"><div class="pl-seat-t"><span class="nm">Open seat</span></div>${btns}</div>`;
      }
      if (s.kind === "invited") {
        const btn = s.inviteId && kit.sent.has(s.inviteId) ? `<button class="ghost small" data-do="cancel" data-invite="${esc(s.inviteId)}">Cancel</button>` : "";
        return `<div class="pl-seat open"><div class="pl-seat-t"><span class="nm ell">${esc(s.name)}</span><span class="note">Invite sent</span></div>${btn}</div>`;
      }
      const isH = s.seat === v.host;
      let note, ok = false;
      if (s.kind === "bot") note = "Bot";
      else if (!s.connected) note = "Away";
      else { note = isH ? "Host · ready" : "Ready"; ok = true; }
      if (you) { note = isH ? "Host" : "Ready"; ok = !isH; }
      const own = s.kind === "player" ? def.seatNote?.(s, v) : null;
      if (own) note = isH && !you ? `Host · ${own}` : own;
      const tag = you ? `<span class="pl-you">You</span>` : "";
      const rm = host && s.kind === "bot" ? `<button class="ghost small icon" data-do="unbot" data-seat="${s.seat}" aria-label="Remove ${esc(s.name)}" title="Remove bot">${art.remove()}</button>` : "";
      return `<div class="pl-seat pl-frame">${kit.avatar(s)}<div class="pl-seat-t"><span class="nm"><span class="ell">${esc(s.name)}</span>${tag}</span><span class="note${ok ? " ok" : ""}">${esc(note)}</span></div>${rm}</div>`;
    }
    /**
     * Draw a LobbyView into `main` (and its start button or waiting line into
     * `foot`), wired to the room through `req(method, data)`.
     */
    kit.renderRoom = (v, opts) => {
      markSeated(v);
      const { main, foot, req } = opts;
      last = { view: v, opts };
      const host = kit.isHost(v);
      const quick = v.mode === "quick";
      const seats = v.seats;
      const filled = seats.filter((s) => s.kind === "player" || s.kind === "bot").length;
      let top;
      if (quick) {
        top = `<div class="quickcard pl-frame"><b data-quick-count>${kit.quickText(v)}</b>${def.quickNote ? `<small>${esc(def.quickNote)}</small>` : ""}</div>`;
      } else {
        const sum = def.summary ? def.summary(v.settings) : "";
        top = `<div class="pl-codecard pl-frame"><div class="code"><small>${esc(def.nouns.code)}</small><b aria-label="${esc(def.nouns.code)} ${esc(v.code.split("").join(" "))}">${esc(v.code)}</b></div><button data-do="share">Share invite</button></div>` +
          (!sum ? "" : host && def.schema?.length ? `<button class="pl-sumline" data-do="settings"><span style="flex:1">${esc(sum)}</span><span class="edit">Edit</span></button>` : `<p class="pl-sumline">${esc(sum)}</p>`);
      }
      // Who's in, then one open seat with its actions; the rest of the open seats are one line, not a stack of identical rows.
      const firstEmpty = seats.find((s) => s.kind === "empty")?.seat;
      const moreOpen = seats.filter((s) => s.kind === "empty").length - 1;
      const rows = seats.filter((s) => s.kind !== "empty" || s.seat === firstEmpty).map((s) => seatRow(s, v, host, s.seat === firstEmpty)).join("") +
        (moreOpen > 0 ? `<div class="pl-seat open"><div class="pl-seat-t"><span class="nm">${moreOpen} more open seat${moreOpen > 1 ? "s" : ""}</span></div></div>` : "");
      main.innerHTML = top + `<p class="pl-label">Seats · ${filled}/${seats.length}</p><div class="pl-seats">${rows}</div>`;
      let f = "";
      if (quick) f = "";
      else if (v.startRule === "full") {
        f = `<div class="pl-waitline"><span class="pl-dots"><i></i><i></i><i></i></span>${esc(def.fullText || "Starts as soon as every seat is taken")}</div>`;
      } else if (host) {
        const open = seats.filter((s) => s.kind === "empty" || s.kind === "invited").length;
        const bots = v.fillsWithBots ? open : 0;
        const can = filled + bots >= v.minPlayers;
        const label = !can ? "Need one more player" : bots > 0 ? `Start · ${bots} bot${bots > 1 ? "s" : ""} join` : "Start";
        f = `<button class="big" data-do="start"${can ? "" : " disabled"}>${label}</button>`;
      } else {
        const hn = v.seats[v.host]?.name || "the host";
        f = `<div class="pl-waitline"><span class="pl-dots"><i></i><i></i><i></i></span>Waiting for ${esc(hn)} to start</div>`;
      }
      if (foot) {
        foot.innerHTML = f;
        foot.parentElement.hidden = !f;
      } else main.insertAdjacentHTML("beforeend", f); // no footer: the line goes under the seats
      const onClick = async (e) => {
        const b = e.target.closest("[data-do]");
        if (!b || b.disabled) return;
        const what = b.dataset.do;
        if (what === "share") return kit.share(v.code);
        if (what === "settings") return host && kit.editSettings(v, req);
        if (what === "invite") return kit.invitePicker(v);
        b.disabled = true;
        try {
          if (what === "start") { await req("lobby:start"); cue("ready"); return; }
          if (what === "bot") { await req("lobby:addBot", { seat: Number(b.dataset.seat) }); cue("select"); }
          if (what === "unbot") { await req("lobby:removeBot", { seat: Number(b.dataset.seat) }); cue("select", { pitch: 0.8 }); }
          if (what === "cancel") await kit.cancelInvite(b.dataset.invite);
        } catch (err) { toast(P.errText(err), 2600); }
        b.disabled = false;
      };
      main.onclick = onClick;
      if (foot) foot.onclick = onClick;
    };
    /** Tick a quick room's countdown without redrawing the seats. */
    kit.tickRoom = (v, main) => {
      const el = main.querySelector("[data-quick-count]");
      if (el && v) el.textContent = kit.quickText(v);
    };

    /* ------------------------------------------------------------ the game's own screens, drawn the same way */
    /** How to play, from the game's `rules` (steps, then anything extra like a hand ranking). */
    kit.rules = () => {
      const r = def.rules?.();
      if (!r) return;
      const el = P.sheet(`<h2>How to play</h2><div class="pl-rules"><div class="steps">${r.steps.map((x) => `<p>${x}</p>`).join("")}</div>${r.extra || ""}</div>` +
        `<div class="pl-actions"><button class="ghost" data-close>Close</button></div>`, { label: "How to play" });
      el.querySelector("[data-close]").onclick = () => P.closeSheet();
    };
    /**
     * The in-game menu, the same in every game: Share invite (in a room's lobby),
     * How to play, Settings, then the game's own rows (the last one is the way
     * out, e.g. Leave table or Forfeit match), and Close.
     *   items: [{ label, run, danger? }]
     */
    kit.menu = ({ view = null, items = [] } = {}) => {
      const rows = [
        ...(view?.phase === "lobby" && view.mode !== "quick" ? [{ label: "Share invite", run: () => kit.share(view.code) }] : []),
        ...(def.rules ? [{ label: "How to play", run: kit.rules }] : []),
        { label: "Settings", run: () => P.openSettings() },
        ...items,
      ];
      const el = P.sheet(`<h2>Menu</h2><div class="pl-actions">` +
        rows.map((r, i) => `<button class="${r.danger ? "danger" : "ghost"}" data-row="${i}">${esc(r.label)}</button>`).join("") +
        `<button class="ghost" data-row="close">Close</button></div>`, { label: "Menu" });
      el.onclick = (e) => {
        const b = e.target.closest("[data-row]");
        if (!b) return;
        if (b.dataset.row === "close") return P.closeSheet();
        P.closeSheet(true);
        rows[Number(b.dataset.row)].run();
      };
    };
    /** Who has asked for a rematch, as a line, from the room's lobby view. */
    const rematchState = (view) => {
      const me = view?.seats?.[view.you]?.name;
      const others = (view?.rematch?.players || []).filter((n) => n !== me);
      if (!others.length) return null;
      const names = others.length === 1 ? others[0] : `${others.slice(0, -1).join(", ")} and ${others.at(-1)}`;
      return others.length === 1 ? `${names} wants a rematch` : `${names} are in`;
    };
    /**
     * The result, the same in every game: the game's art (`hero`), a title and a
     * line, the standings, its stat tiles (numbers count up with countResult),
     * then Rematch and the way back. The rematch button follows the room: it
     * offers to join when someone has asked. `actions` puts the buttons in their
     * own element (a sticky footer); `key` (the room) marks a new game's result.
     */
    kit.renderResult = (root, { hero = "", title, sub = "", win = false, standings = null, tiles = null, view = null, rematchHint = "",
      blocked = "", extra = "", onRematch, onLeave, leaveLabel = "Back to lobby", actions = null, counted = false, key = "" }) => {
      const asked = rematchState(view);
      const head = `<div class="pl-res-head${win ? " win" : ""}">${hero ? `<div class="pl-res-hero">${hero}</div>` : ""}<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>`;
      const list = standings?.length ? `<ol class="pl-standings">${standings.map((r) =>
        `<li class="pl-frame${r.place === 1 ? " first" : ""}${r.you ? " me" : ""}"><span class="pl">${esc(ordinal(r.place).toUpperCase())}</span>` +
        `<span class="nm"><span class="ell">${esc(r.name)}</span>${r.you ? `<span class="pl-you">You</span>` : ""}${r.bot ? `<span class="pl-bot">Bot</span>` : ""}</span>` +
        `<span class="note">${esc(r.note || "")}</span></li>`).join("")}</ol>` : "";
      const tileHTML = tiles?.length ? `<div class="pl-tiles">${tiles.map((t) => {
        const n = typeof t.value === "number" ? t.value : null;
        return `<div class="pl-frame"><small>${esc(t.label)}</small><b${n !== null ? ` data-count="${n}"` : ""}>${esc(n !== null && !counted ? 0 : t.format ? t.format(t.value) : t.value)}</b></div>`;
      }).join("")}</div>` : "";
      const label = blocked ? "Rematch" : asked ? "Join rematch" : "Rematch";
      const note = blocked || asked || rematchHint;
      const acts = `<button class="big" data-res="rematch"${blocked ? " disabled" : ""}>${label}</button>` +
        `<p class="pl-res-note${asked && !blocked ? " hot" : ""}">${esc(note)}</p><button class="ghost" data-res="leave">${esc(leaveLabel)}</button>`;
      const html = `<div class="pl-result">${head}${list}${tileHTML}${actions ? "" : `<div class="pl-res-acts">${acts}</div>`}${extra}</div>`;
      // Redrawn on every room update: only touch the page when something changed (no replayed animations).
      if (root._resSig === html + acts) return;
      const fresh = root._resKey !== key || !root.querySelector(".pl-result"); // a new game's result (key: its room)
      root._resKey = key;
      root._resSig = html + acts;
      root.innerHTML = html;
      if (actions) actions.innerHTML = acts;
      // Numbers count up once (countResult); a later redraw shows them at their value.
      root._needsCount = fresh && !counted;
      if (!root._needsCount) for (const b of root.querySelectorAll("[data-count]")) b.textContent = Number(b.dataset.count).toLocaleString("en-US");
      const wire = (scope) => {
        scope.querySelector('[data-res="rematch"]').onclick = async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          try { await onRematch(); } finally { if (b.isConnected) b.disabled = !!blocked; }
        };
        scope.querySelector('[data-res="leave"]').onclick = () => onLeave();
      };
      wire(actions || root);
      if (asked && !blocked) P.playPreset((actions || root).querySelector('[data-res="rematch"]'), "pulse");
    };
    /** Count the result's numbers up, one tile after another. */
    kit.countResult = async (root) => {
      if (!root._needsCount) return;
      root._needsCount = false;
      for (const el of root.querySelectorAll("[data-count]")) {
        const to = Number(el.dataset.count);
        await P.countUp(el, to, { format: (v) => v.toLocaleString("en-US") });
        if (to > 0) P.playPreset(el, "pulse", { speed: "faster" });
        await P.sleep(P.reduceMotion() ? 0 : 120);
      }
    };

    /* ------------------------------------------------------------ joining by code */
    /** What a code leads to, a name, then the seat. Returns the seat, or null if they backed out. */
    kit.join = async (code, { wait } = {}) => {
      const info = await kit.info(code);
      if (info.started) throw new Error("that game has already started");
      if (!(await P.ensureName({ title: "Take a seat", body: `${info.host ? `${info.host} is hosting. ` : ""}Other players see this name.`, go: "Take a seat" }))) return null;
      wait?.(info);
      return kit.seat("join", { code });
    };

    // Sounds: this page's game set first, Ploto's own after (web/sounds.js).
    window.MM_FEEDBACK?.setGame?.(def.gameId);
    return kit;
  }

  /**
   * The phone's back button walks the game's own screens: one extra history
   * entry while there's somewhere to go back to (or a sheet is open).
   */
  function backGuard({ canGoBack, onBack }) {
    let ignore = 0;
    const can = () => P.sheetOpen() || canGoBack();
    function sync() {
      if (ignore) return;
      const has = history.state?.plBack === true;
      if (can() && !has) history.pushState({ plBack: true }, "");
      else if (!can() && has) { ignore++; history.back(); }
    }
    window.addEventListener("popstate", () => {
      if (ignore) { ignore--; return sync(); }
      if (P.sheetOpen()) P.closeSheet();
      else onBack();
      sync();
    });
    // Sheets opening and closing change whether there's somewhere to go back to.
    new MutationObserver(() => {
      const s = document.getElementById("plScrim");
      if (s && !s._watched) { s._watched = true; new MutationObserver(sync).observe(s, { attributes: true, attributeFilter: ["class"] }); }
      sync();
    }).observe(document.body, { childList: true });
    return sync;
  }

  Object.assign(P, { lobbyKit, backGuard });
})();
