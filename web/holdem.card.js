/**
 * Hold'em's card in the launcher (and its icon in lists), following the launcher
 * card rule (docs/STYLE.md, "Launcher cards"): a still close-up on the 80×50 art
 * grid, a collage of what's inside: the felt in its rail, A♠ K♥, chip stacks,
 * the dealer button and the turn timer.
 */
(() => {
  "use strict";
  const style = document.createElement("style");
  style.textContent = `
  .lc-art[data-art="holdem"] { background: var(--c-felt-lo); }
  .lc-he .ft { fill: var(--c-felt-lo); } .lc-he .fm { fill: var(--c-felt); } .lc-he .fh { fill: var(--c-felt-hi); }
  .lc-he .rl { fill: var(--c-rail); } .lc-he .rh { fill: var(--c-rail-hi); } .lc-he .ik { fill: var(--c-ink); } .lc-he .cr { fill: var(--c-cream); }
  .lc-he .rd { fill: var(--c-bad); } .lc-he .gd { fill: var(--c-gold); } .lc-he .ac { fill: var(--c-accent); }
  .lc-he .sh { fill: var(--c-ink); opacity: 0.14; } .lc-he .wl { fill: var(--c-well); }`;
  document.head.appendChild(style);

  /** Pixel rects from ASCII rows ("X" = filled) at (x, y), `s` art pixels per cell. */
  const grid = (rows, x, y, cls, s = 1) => rows.map((row, j) => [...row].map((c, i) => c === "X" ? `<rect class="${cls}" x="${x + i * s}" y="${y + j * s}" width="${s}" height="${s}"/>` : "").join("")).join("");
  const GLYPH = {
    A: [".X.", "X.X", "XXX", "X.X", "X.X"],
    K: ["X.X", "X.X", "XX.", "X.X", "X.X"],
    spade: ["..X..", ".XXX.", "XXXXX", "XXXXX", "..X.."],
    heart: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."],
  };
  const r = (x, y, w, h, cls) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  function card(x, y, rank, suit) {
    const ink = suit === "heart" ? "rd" : "ik";
    return r(x + 1, y + 1, 16, 22, "sh") + // hard shadow
      r(x + 1, y, 14, 22, "ik") + r(x, y + 1, 16, 20, "ik") + r(x + 1, y + 1, 14, 20, "cr") + r(x + 1, y + 19, 14, 2, "sh") +
      grid(GLYPH[rank], x + 2, y + 2, ink) + grid(GLYPH[suit], x + 3, y + 8, ink, 2);
  }
  function chips(x, y, n, cls, hi) {
    let out = "";
    for (let i = 0; i < n; i++) {
      const cy = y - i * 3;
      out += r(x, cy, 10, 3, "ik") + r(x + 1, cy, 8, 2, cls) + r(x + 2, cy, 2, 2, "cr") + r(x + 6, cy, 2, 2, "cr");
    }
    return out + r(x + 1, y - (n - 1) * 3 - 1, 8, 1, hi);
  }
  /** The dealer button: a cream disc with a D, outlined and shadowed. */
  function button(x, y) {
    return r(x + 1, y + 1, 9, 9, "sh") + r(x + 2, y, 5, 9, "ik") + r(x, y + 2, 9, 5, "ik") + r(x + 1, y + 1, 7, 7, "ik") +
      r(x + 2, y + 1, 5, 7, "cr") + r(x + 1, y + 2, 7, 5, "cr") + grid(["XX.", "X.X", "X.X", "X.X", "XX."], x + 3, y + 2, "ik");
  }
  function svg(k, view = "0 0 80 50") {
    const [, , w, h] = view.split(" ").map(Number);
    return `<svg class="lc-he" viewBox="${view}" width="${w * k}" height="${h * k}" aria-hidden="true">` +
      r(0, 0, 80, 50, "ft") +
      r(6, 6, 68, 44, "rl") + r(4, 8, 72, 42, "rl") + r(6, 6, 68, 1, "rh") + r(4, 8, 2, 1, "rh") + r(74, 8, 2, 1, "rh") +
      r(8, 9, 64, 41, "fm") + r(7, 10, 66, 40, "fm") + r(9, 10, 62, 1, "fh") +
      card(25, 15, "A", "spade") + card(37, 18, "K", "heart") +
      chips(57, 38, 4, "gd", "cr") + chips(13, 40, 2, "ac", "cr") + chips(14, 37, 1, "rd", "cr") +
      button(56, 13) + // the dealer button
      r(5, 3, 30, 6, "ik") + r(6, 4, 28, 4, "wl") + r(6, 4, 19, 4, "gd") + r(6, 4, 19, 1, "cr") + // the turn timer (the table's HUD)
      `</svg>`;
  }
  window.Ploto.gameCard("holdem", {
    art: (W, H) => svg(Math.max(1, Math.round(Math.max(W / 80, H / 50)))),
    icon: () => svg(2, "24 14 24 24"),
  });
})();
