/**
 * Match Monsters' card in the launcher (and its icon in lists), following the
 * launcher card rule (docs/STYLE.md, "Launcher cards"): a still collage of
 * what's inside, on the 80×50 art grid. A monster on its arena platform with
 * its HP bar, beside a corner of the gem board (fire gems, water, a berry).
 * All the game's own sprites, one sprite pixel per art pixel.
 */
(() => {
  "use strict";
  const P = window.Ploto;
  const style = document.createElement("style");
  style.textContent = `
  .lc-art[data-art="match_monsters"] { background: #346fae; }
  .lc-mm .bg { fill: #346fae; } /* the arena's day sky, a shade down: the card's own colour, as felt is Hold'em's */ .lc-mm .fr { fill: var(--c-edge); } .lc-mm .fh { fill: var(--c-mute); }
  .lc-mm .wl { fill: var(--c-well); } .lc-mm .cl { fill: var(--c-panel); } .lc-mm .ch { fill: var(--c-raise); }
  .lc-mm .ik { fill: var(--c-ink); } .lc-mm .gd { fill: var(--c-gold); } .lc-mm .cr { fill: var(--c-cream); }
  .lc-mm .sh { fill: var(--c-ink); opacity: 0.14; }
  .lc-mm .hp { fill: var(--c-good); } .lc-mm .hh { fill: var(--c-good-hi); }
  .lc-mm image { image-rendering: pixelated; }`;
  document.head.appendChild(style);

  const r = (x, y, w, h, cls) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  const gem = (el, x, y) => {
    const src = window.PIXELART?.gems[el];
    return src ? r(x + 1, y + 1, 16, 16, "sh") + `<image href="${src}" x="${x}" y="${y}" width="16" height="16"/>` : "";
  };
  /** A board cell: 16×16 with a top highlight row, like the game's tiles. */
  const cell = (x, y) => r(x, y, 16, 16, "cl") + r(x, y, 16, 1, "ch");
  const img = (src, x, y, w, h, flip = false) => src
    ? `<image href="${src}" x="${flip ? -(x + w) : x}" y="${y}" width="${w}" height="${h}"${flip ? ' transform="scale(-1 1)"' : ""}/>` : "";

  function svg(k, view = "0 0 80 50") {
    const [, , w, h] = view.split(" ").map(Number);
    const PX = window.PIXELART;
    const theme = PX.themes?.day || { platform: PX.platform };
    const mon = PX.monsters.ember_pup?.stages[1];
    const id = `lcmm${k}`;
    // The monster: its sprite box is x 8–40, y 13–48 (facing right), feet on the platform.
    const mx = -3, my = -2;
    return `<svg class="lc-mm" viewBox="${view}" width="${w * k}" height="${h * k}" aria-hidden="true">` +
      `<defs><clipPath id="${id}"><rect x="43" y="21" width="37" height="29"/></clipPath></defs>` +
      r(0, 0, 80, 50, "bg") +
      // the gem board's corner, in its frame (the right of the card)
      r(40, 18, 40, 32, "ik") + r(41, 19, 39, 31, "fr") + r(41, 19, 39, 1, "fh") + r(42, 20, 38, 30, "ik") + r(43, 21, 37, 29, "wl") +
      `<g clip-path="url(#${id})">${cell(44, 22)}${cell(62, 22)}${cell(44, 40)}${cell(62, 40)}` +
      gem("fire", 44, 22) + gem("fire", 62, 22) + gem("water", 44, 40) + gem("berry", 62, 40) + `</g>` +
      // the monster on its platform, in front of the board's edge, with its HP bar above (the battle HUD)
      img(theme.platform, mx + 4, my + 40, 40, 14) +
      img(mon?.flat, mx, my, 48, 48) +
      r(5, 3, 30, 6, "ik") + r(6, 4, 28, 4, "wl") + r(6, 4, 20, 4, "hp") + r(6, 4, 20, 1, "hh") +
      `</svg>`;
  }
  function art(W, H) {
    if (!window.PIXELART) return "";
    return svg(Math.max(1, Math.round(Math.max(W / 80, H / 50))));
  }
  /** The list icon: the monster's head, cropped from the card at k = 2. */
  const icon = () => (window.PIXELART ? svg(2, "17 10 24 24") : "");

  P.gameCard("match_monsters", { art, icon });
  if (!window.PIXELART) {
    const s = document.createElement("script");
    s.src = "/play/pixelart.js";
    s.async = true;
    s.onload = () => P.gameCard("match_monsters", { art, icon }); // repaint with the sprites
    document.body.appendChild(s);
  }
})();
