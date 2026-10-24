/**
 * Match Monsters' card in the launcher (and its icon in lists), following the
 * launcher card rule (docs/STYLE.md, "Launcher cards"): a still close-up on the
 * 80×50 art grid. The surface is the board; the heroes are three fire gems lined
 * up for a match (the game's signature moment), with one gem on each side. The
 * gems are the game's own 16 px sprites, one sprite pixel per art pixel.
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
  .lc-mm image { image-rendering: pixelated; }`;
  document.head.appendChild(style);

  const r = (x, y, w, h, cls) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  const gem = (el, x, y) => {
    const src = window.PIXELART?.gems[el];
    return src ? r(x + 1, y + 1, 16, 16, "sh") + `<image href="${src}" x="${x}" y="${y}" width="16" height="16"/>` : "";
  };
  /** A board cell: 16×16 with a top highlight row, like the game's tiles. */
  const cell = (x, y) => r(x, y, 16, 16, "cl") + r(x, y, 16, 1, "ch");
  /** A four-point sparkle (the match about to pop). */
  const spark = (x, y) => r(x, y - 1, 1, 3, "cr") + r(x - 1, y, 3, 1, "cr");

  function svg(k, view = "0 0 80 50") {
    const [, , w, h] = view.split(" ").map(Number);
    // The board in its frame (as Hold'em's table sits in its rail): cells on an 18 px pitch, clipped to the frame.
    let cells = "";
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) cells += cell(-4 + col * 18, -1 + row * 18);
    const id = `lcmm${k}`;
    return `<svg class="lc-mm" viewBox="${view}" width="${w * k}" height="${h * k}" aria-hidden="true">` +
      `<defs><clipPath id="${id}"><rect x="6" y="8" width="68" height="42"/></clipPath></defs>` +
      r(0, 0, 80, 50, "bg") +
      r(3, 5, 74, 45, "ik") + r(4, 6, 72, 44, "fr") + r(4, 6, 72, 1, "fh") + r(5, 7, 70, 43, "ik") + // the frame: 2 px, its top lit
      r(6, 8, 68, 42, "wl") + `<g clip-path="url(#${id})">${cells}` +
      // supporting gems a row lower, at the sides (like the chips beside the cards)
      gem("water", 14, 35) + gem("nature", 50, 35) + `</g>` +
      // the heroes: three fire gems lined up, in the gold bracket of a match
      r(13, 16, 54, 1, "gd") + r(13, 33, 54, 1, "gd") + r(13, 16, 1, 18, "gd") + r(66, 16, 1, 18, "gd") +
      gem("fire", 14, 17) + gem("fire", 32, 17) + gem("fire", 50, 17) +
      spark(13, 14) + spark(67, 36) +
      `</svg>`;
  }
  function art(W, H) {
    if (!window.PIXELART) return "";
    return svg(Math.max(1, Math.round(Math.max(W / 80, H / 50))));
  }
  /** The list icon: the hero object, cropped from the card at k = 2. */
  const icon = () => (window.PIXELART ? svg(2, "11 12 24 24") : "");

  P.gameCard("match_monsters", { art, icon });
  if (!window.PIXELART) {
    const s = document.createElement("script");
    s.src = "/play/pixelart.js";
    s.async = true;
    s.onload = () => P.gameCard("match_monsters", { art, icon }); // repaint with the gems
    document.body.appendChild(s);
  }
})();
