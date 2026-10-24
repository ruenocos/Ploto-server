/**
 * Ploto's motion kit, the same on every game page (docs/STYLE.md, Motion):
 *
 *   playPreset(el, preset, {speed, keep})  a stock Animate.css preset (our animation library)
 *   poses(map)                             a game's body language: moment -> preset, then pose(el, name)
 *   playQueue({run, onError})              play updates one after another, faster when behind
 *   banner(el, {draw, intro, beat, every}) a home banner: drawn to whole pixels, an intro, then a beat loop
 *   countUp(el, to, {steps, ms, format})   a number counting up to its value
 *
 * Every helper respects reduced motion (Ploto.reduceMotion()): the end state
 * shows, without the movement. Pages load /play/animate.min.css with this file.
 */
(() => {
  "use strict";
  const P = window.Ploto;
  const RM = () => P.reduceMotion();

  /**
   * Play a stock Animate.css preset on an element. Resolves when it ends, when
   * another preset replaces it, or after a timeout if the element left the page.
   * `keep` leaves the end state in place (exits like fadeOutDown).
   */
  function playPreset(el, preset, { speed = "", keep = false } = {}) {
    if (!el) return Promise.resolve();
    el._presetDone?.();
    el.classList.remove(...[...el.classList].filter((c) => c.startsWith("animate__")));
    void el.offsetWidth; // restart even when it's the same preset again
    const cls = ["animate__animated", `animate__${preset}`, ...(speed ? [`animate__${speed}`] : [])];
    el.classList.add(...cls);
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        el.removeEventListener("animationend", onEnd);
        el._presetDone = null;
        if (!keep) el.classList.remove(...cls);
        resolve();
      };
      const onEnd = (e) => { if (e.target === el) done(); };
      const timer = setTimeout(done, 3200);
      el._presetDone = done;
      el.addEventListener("animationend", onEnd);
    });
  }

  /**
   * A game's body language: which preset each moment plays. Returns
   * `pose(el, name)`, which plays it (or nothing with reduced motion).
   *   const pose = Ploto.poses({ win: { preset: "tada" }, hurt: { preset: "shakeX", speed: "faster" } });
   */
  function poses(map) {
    return (el, name) => {
      const p = map[name];
      if (!p || !el || RM()) return Promise.resolve();
      const { preset, ...opts } = p;
      return playPreset(el, preset, opts);
    };
  }

  /**
   * Play items (updates, or functions) strictly one after another: a game
   * animates each event from what's on screen, then settles on its state.
   * `speed()` tells an animation how far behind it is (1, then 0.45 with one
   * waiting, 0.3 with more), so a backlog catches up instead of piling up.
   * When the tab comes back, `onReturn(items)` may cut the backlog (keep only
   * the latest state).
   */
  function playQueue({ run = (item) => item(), onError = (err) => console.error(err), onReturn = null } = {}) {
    const items = [];
    let busy = false;
    async function pump() {
      if (busy) return;
      busy = true;
      try {
        while (items.length) {
          const { item, resolve } = items.shift();
          try { await run(item); } catch (err) { onError(err, item); }
          resolve();
        }
      } finally {
        busy = false;
      }
    }
    const q = {
      get backlog() { return items.length; },
      get busy() { return busy; },
      speed: () => (items.length > 1 ? 0.3 : items.length ? 0.45 : 1),
      /** Queue an item; resolves once it has played. */
      add(item) { return new Promise((resolve) => { items.push({ item, resolve }); pump(); }); },
      /** Drop everything waiting (a fresh state is coming). */
      clear() { for (const x of items.splice(0)) x.resolve(); },
      /** Keep only what `fn(waitingItems)` returns. */
      collapse(fn) {
        const old = items.splice(0);
        const kept = fn(old.map((x) => x.item));
        for (const x of old) x.resolve();
        for (const item of kept) items.push({ item, resolve: () => {} });
        pump();
      },
    };
    if (onReturn) document.addEventListener("visibilitychange", () => { if (!document.hidden && items.length > 1) q.collapse(onReturn); });
    return q;
  }

  /**
   * A game's home banner (docs/STYLE.md, Home banners): `draw(el, W, H)` paints
   * it for its size (again whenever the size changes), `intro(el)` plays once
   * when it first appears, `beat(el, n)` every `every` ms after that, but only
   * while it's on screen, the tab is visible and motion is allowed.
   */
  function banner(el, { draw, intro = null, beat = null, every = 3600 }) {
    let size = "", introduced = false, n = 0, timer = 0;
    const onScreen = () => el.isConnected && !el.closest("[hidden]") && el.getBoundingClientRect().width > 0 && !document.hidden;
    function paint() {
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H || `${W}x${H}` === size) return;
      size = `${W}x${H}`;
      if (draw(el, W, H) === false) { size = ""; return; } // not ready yet (art still loading): try again next time
      if (!introduced && onScreen()) {
        introduced = true;
        if (intro && !RM()) intro(el);
      }
    }
    if (window.ResizeObserver) new ResizeObserver(paint).observe(el);
    if (beat) timer = setInterval(() => { if (!RM() && onScreen()) beat(el, n++); }, every);
    paint();
    return { paint, stop: () => clearInterval(timer) };
  }

  /** Count a number up to `to` in a few stepped frames (or just show it with reduced motion). */
  function countUp(el, to, { steps = 12, ms = 40, format = (v) => String(v) } = {}) {
    clearInterval(el._countUp);
    if (RM() || !to) { el.textContent = format(to); return Promise.resolve(); }
    const n = Math.min(steps, Math.abs(to));
    let i = 0;
    return new Promise((resolve) => {
      el._countUp = setInterval(() => {
        i++;
        el.textContent = format(i >= n ? to : Math.round((to * i) / n));
        if (i >= n) { clearInterval(el._countUp); resolve(); }
      }, ms);
    });
  }

  Object.assign(P, { playPreset, poses, playQueue, banner, countUp });
})();
