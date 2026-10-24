/**
 * Match Monsters' card in the launcher (and its icon in lists): the arena by
 * day with two monsters facing off. A game's own art, registered with Ploto
 * (docs/NEW_GAME.md, "Launcher card"). The sprites (pixelart.js) are big, so
 * they load after the page is up; the card repaints when they're in.
 */
(() => {
  "use strict";
  const P = window.Ploto;
  const style = document.createElement("style");
  style.textContent = `
  .lc-mm { position: absolute; inset: 0; background-color: #5aa6e0; background-repeat: repeat-x; background-position: 50% 100%; image-rendering: pixelated; }
  .lc-mm-f { position: absolute; bottom: calc(var(--u) * 6); width: calc(var(--u) * 48); height: calc(var(--u) * 54); }
  .lc-mm-f.l { left: 10%; } .lc-mm-f.r { right: 10%; }
  .lc-mm-f img { position: absolute; left: calc(var(--u) * 4); top: calc(var(--u) * 40); width: calc(var(--u) * 40); height: calc(var(--u) * 14); image-rendering: pixelated; }
  .lc-mm-spr { position: absolute; left: 0; top: 0; width: calc(var(--u) * 48); height: calc(var(--u) * 48); image-rendering: pixelated;
    background: 0 0 / calc(var(--u) * 48 * var(--n)) 100% no-repeat; }
  .lc-mm-f.r .lc-mm-spr { scale: -1 1; }
  .lc-mm-spr.idle { animation: lcMmIdle calc(var(--n) * 150ms) steps(var(--n)) infinite; }
  @keyframes lcMmIdle { to { background-position-x: calc(var(--u) * -48 * var(--n)); } }`;
  document.head.appendChild(style);

  const snapDown = (k) => { const d = window.devicePixelRatio || 1; return Math.max(1, Math.floor(k * d)) / d; };
  function art(W, H) {
    const PX = window.PIXELART;
    if (!PX) return "";
    const theme = PX.themes?.day || { arena: PX.arena, platform: PX.platform };
    // Whole CSS px per art pixel, the nearest that fits; any gap at the sides repeats, the sky fills the top.
    const k = Math.max(1, Math.round(Math.max(W / 160, H / 100)));
    const u = snapDown((H * 0.52) / 48);
    const still = P.reduceMotion();
    const fighter = (id, side) => {
      const s = PX.monsters[id]?.stages[1];
      if (!s) return "";
      const idle = s.idle && !still;
      return `<div class="lc-mm-f ${side}" style="--u:${u}px"><img src="${theme.platform}" alt="">` +
        `<div class="lc-mm-spr${idle ? " idle" : ""}" style="background-image:url(${idle ? s.idle : s.flat});--n:${idle ? s.n : 1}"></div></div>`;
    };
    return `<div class="lc-mm" style="background-image:url(${theme.arena});background-size:${160 * k}px ${100 * k}px">${fighter("ember_pup", "l")}${fighter("tide_serpent", "r")}</div>`;
  }
  function icon() {
    const m = window.PIXELART?.monsters.ember_pup;
    return m ? `<img class="px" src="${m.icon}" width="48" height="48" alt="">` : "";
  }
  P.gameCard("match_monsters", { art, icon });
  if (!window.PIXELART) {
    const s = document.createElement("script");
    s.src = "/play/pixelart.js";
    s.async = true;
    s.onload = () => P.gameCard("match_monsters", { art, icon }); // repaint with the sprites
    document.body.appendChild(s);
  }
})();
