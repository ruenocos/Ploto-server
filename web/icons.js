// @ts-check
/**
 * Pixel icons for the UI (status chips, buttons, floating numbers), drawn on
 * the same grid as everything else: one icon pixel = one UI pixel (--px) by
 * default, in the current text colour, so an icon takes its chip's or
 * button's colour. They replace emoji, which every phone draws in its own
 * style (and some can't draw at all).
 *
 * Grids: "X" is a solid pixel, "o" a faint one (35%), anything else empty.
 */

(() => {
/** @type {Record<string, string[]>} */
const GRIDS = {
  // Navigation (Sea Battle's bar and menu button; any page can use them).
  back: ["...X", "..XX", ".XXX", "XXXX", ".XXX", "..XX", "...X"],
  chev: ["X...", "XX..", "XXX.", "XXXX", "XXX.", "XX..", "X..."],
  menu: ["XXXXXXXX", "........", "........", "XXXXXXXX", "........", "........", "XXXXXXXX"],
  shield: [
    "XXXXXXX",
    "XoXXXXX",
    "XoXXXXX",
    "XXXXXXX",
    ".XXXXX.",
    "..XXX..",
    "...X...",
  ],
  burn: [
    "..X....",
    "..XX...",
    ".XXX.X.",
    ".XXXXX.",
    "XXXoXXX",
    "XXoooXX",
    ".XXXXX.",
  ],
  skull: [
    ".XXXXX.",
    "XXXXXXX",
    "X..X..X",
    "XXXXXXX",
    ".XX.XX.",
    ".XXXXX.",
    ".X.X.X.",
  ],
  slow: [
    "XXXXXXX",
    ".X...X.",
    "..X.X..",
    "...X...",
    "..X.X..",
    ".XXXXX.",
    "XXXXXXX",
  ],
  bubble: [
    "..XXX..",
    ".X...X.",
    "X.X...X",
    "X.....X",
    "X.....X",
    ".X...X.",
    "..XXX..",
  ],
  heal: [
    "..XXX..",
    "..XXX..",
    "XXXXXXX",
    "XXXXXXX",
    "XXXXXXX",
    "..XXX..",
    "..XXX..",
  ],
  /** Healing halved (poison): the right half of the cross is faint. */
  halfHeal: [
    "..XXo..",
    "..XXo..",
    "XXXXooo",
    "XXXXooo",
    "XXXXooo",
    "..XXo..",
    "..XXo..",
  ],
  seal: [
    "..XXX..",
    ".X...X.",
    ".X...X.",
    "XXXXXXX",
    "XXX.XXX",
    "XXX.XXX",
    "XXXXXXX",
  ],
  charge: [
    "....XX.",
    "...XX..",
    "..XX...",
    ".XXXXX.",
    "...XX..",
    "..XX...",
    ".XX....",
  ],
  passive: [
    "...X...",
    "...X...",
    "..XXX..",
    "XXXXXXX",
    "..XXX..",
    "...X...",
    "...X...",
  ],
  star: [
    "...X...",
    "..XXX..",
    "XXXXXXX",
    ".XXXXX.",
    "..XXX..",
    ".XX.XX.",
    ".X...X.",
  ],
  /** The small star for tight spots (charge badges, evolution labels). */
  starS: [
    "..X..",
    ".XXX.",
    "XXXXX",
    ".XXX.",
    ".X.X.",
  ],
  ban: [
    "XX...XX",
    "XXX.XXX",
    ".XXXXX.",
    "..XXX..",
    ".XXXXX.",
    "XXX.XXX",
    "XX...XX",
  ],
  pierce: [
    "...XXXX",
    ".....XX",
    "....X.X",
    "...X..X",
    "..X....",
    "XX.....",
    "XX.....",
  ],
  frozen: [
    "...X...",
    ".X.X.X.",
    "..XXX..",
    "XXX.XXX",
    "..XXX..",
    ".X.X.X.",
    "...X...",
  ],
  cleanse: [
    "X.....X",
    ".X.X.X.",
    "...X...",
    ".XXXXX.",
    "...X...",
    ".X.X.X.",
    "X.....X",
  ],
  battle: [
    "X.....X",
    ".X...X.",
    "..X.X..",
    "...X...",
    "..X.X..",
    "XX...XX",
    "XX...XX",
  ],
  chat: [
    "XXXXXXX",
    "XXXXXXX",
    "X.X.X.X",
    "XXXXXXX",
    "XXXXXXX",
    ".XX....",
    ".X.....",
  ],
  friends: [
    ".XX...XX.",
    ".XX...XX.",
    ".........",
    "XXXX.XXXX",
    "XXXX.XXXX",
    "XXXX.XXXX",
  ],
  games: [
    ".XXXXXXX.",
    "XX.XXXX.X",
    "X...XXXXX",
    "XX.XX.XXX",
    "XXXXXXXXX",
    "XX.....XX",
  ],
  person: [
    "..XXX..",
    "..XXX..",
    ".......",
    ".XXXXX.",
    "XXXXXXX",
    "XXXXXXX",
  ],
  forfeit: [
    "XXXXX..",
    "XXXXXXX",
    "XXXXXXX",
    "X..XXXX",
    "X......",
    "X......",
    "X......",
  ],
};

/** @typedef {keyof typeof GRIDS} IconName */

/** Each grid as SVG rects, merged into runs per row (built once). */
const cache = new Map();
function body(/** @type {string} */ name) {
  let svg = cache.get(name);
  if (svg) return svg;
  const grid = GRIDS[name];
  if (!grid) return "";
  let solid = "", faint = "";
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      if (c !== "X" && c !== "o") { x++; continue; }
      let end = x;
      while (row[end] === c) end++;
      const rect = `<rect x="${x}" y="${y}" width="${end - x}" height="1"/>`;
      if (c === "X") solid += rect; else faint += rect;
      x = end;
    }
  });
  svg = solid + (faint ? `<g opacity="0.35">${faint}</g>` : "");
  cache.set(name, svg);
  return svg;
}

/**
 * An icon as inline SVG markup.
 * @param {string} name an IconName
 * @param {number} [scale] CSS px per icon pixel (default 2, one UI pixel)
 */
function icon(name, scale = 2) {
  const grid = GRIDS[name];
  if (!grid) return "";
  const w = (grid[0] ?? "").length, h = grid.length;
  return `<svg class="px-icon ic" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" fill="currentColor" aria-hidden="true" focusable="false">${body(name)}</svg>`;
}

/** @type {any} */ (window).MM_ICONS = { icon, names: Object.keys(GRIDS) };
})();
