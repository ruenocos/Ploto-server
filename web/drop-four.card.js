/**
 * Drop Four's pixel art, drawn in code on Ploto's grid: a 10×10 art-pixel cell per
 * slot. The launcher card (Ploto.gameCard), the home banner and the game itself
 * all draw from these sprites (`window.DROP_ART`), so the card is the poster and
 * the banner the trailer of the same grid (docs/STYLE.md).
 *
 * The grid is drawn as a cobalt frame with round holes cut through it: the page
 * puts the discs behind the frame, so they fall behind it like the real toy.
 *
 * The card follows the launcher card rule: still, the 80×50 grid, a collage of the
 * star (a gold disc mid-fall, close to the camera), what you play with (the frame
 * with discs in it) and the piece of interface only this game has (the bomb).
 */
(() => {
  "use strict";
  const C = 10; // art pixels per slot
  const COLS = 7, ROWS = 6, F = 2; // the frame's border, in art pixels

  const P = {
    ink: "#0a0c14", back: "#10142e", hole: "#0b0e22",
    frame: "#2d4fb8", frameHi: "#5578e0", frameLo: "#1c3487", frameDeep: "#142563",
    gold: "#ffcc33", goldHi: "#fff0a0", goldLo: "#d99a1a", goldRim: "#8a5a08",
    coral: "#ff6b6b", coralHi: "#ffb3a8", coralLo: "#c8424f", coralRim: "#7c1f2c",
    bomb: "#2c3046", bombHi: "#59607f", bombLo: "#171a28", fuse: "#c9a36b",
    cream: "#fff4d6", yellow: "#ffcc33", orange: "#ff9d3b", red: "#d8364b", white: "#eef0ff",
    dust: "#8a90a8", dustHi: "#c4c8dc",
  };
  /** The two discs: seat 0 gold, seat 1 coral. */
  const DISC = [
    { base: P.gold, hi: P.goldHi, lo: P.goldLo, rim: P.goldRim, name: "gold" },
    { base: P.coral, hi: P.coralHi, lo: P.coralLo, rim: P.coralRim, name: "coral" },
  ];
  const KEY = { k: P.ink, c: P.cream, y: P.yellow, o: P.orange, r: P.red, w: P.white, d: P.dust, D: P.dustHi, f: P.fuse, b: P.bomb, B: P.bombHi };

  function pen(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    return { c, g, px(x, y, col, ww = 1, hh = 1) { g.fillStyle = col; g.fillRect(x, y, ww, hh); } };
  }
  function ascii(p, rows, x = 0, y = 0) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (KEY[ch]) p.px(x + i, y + j, KEY[ch]); }));
  }
  const cache = new Map();
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

  /** A round 8×8 shape (the holes and the discs): row spans [x0, x1). */
  const ROUND = [[2, 6], [1, 7], [0, 8], [0, 8], [0, 8], [0, 8], [1, 7], [2, 6]];
  const inRound = (x, y) => y >= 0 && y < 8 && x >= ROUND[y][0] && x < ROUND[y][1];

  // ------------------------------------------------------------ discs

  /**
   * A disc, 8×8: a dark rim, the face, a lit arc top-left and a shade bottom-right; `lit` is the
   * winning line's flash (a cream face); `outline` adds an ink edge (10×10) for discs drawn over
   * the page rather than behind the frame.
   */
  function discCanvas(seat, { lit = false, outline = false } = {}) {
    return memo(`disc${seat}.${lit}.${outline}`, () => {
      const d = DISC[seat], o = outline ? 1 : 0;
      const p = pen(8 + 2 * o, 8 + 2 * o);
      if (outline) for (let y = -1; y <= 8; y++) for (let x = -1; x <= 8; x++) {
        if (inRound(x, y)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inRound(x + dx, y + dy))) p.px(x + o, y + o, P.ink);
      }
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if (!inRound(x, y)) continue;
        const edge = !inRound(x - 1, y) || !inRound(x + 1, y) || !inRound(x, y - 1) || !inRound(x, y + 1);
        let col = lit ? P.cream : d.base;
        if (edge) col = lit ? d.hi : d.rim;
        else if (!lit && (x + y >= 10)) col = d.lo;          // the shade, bottom right
        else if (!lit && (x + y <= 4)) col = d.hi;           // the light, top left
        p.px(x + o, y + o, col);
      }
      // The inner ring: a disc's groove (it reads as a game piece, not a coin).
      if (!lit) for (const [x, y] of [[3, 2], [4, 2], [2, 3], [5, 3], [2, 4], [5, 4], [3, 5], [4, 5]]) p.px(x + o, y + o, x + y >= 8 ? d.lo : d.base === P.gold ? P.goldLo : P.coralLo);
      return p.c;
    });
  }
  const disc = (seat, opts = {}) => memo(`discurl${seat}.${opts.lit}.${opts.outline}`, () => discCanvas(seat, opts).toDataURL());

  /** The bomb, 10×10: a dark round body, a lit spot, a fuse to the top right; `spark` 0/1 (two frames), -1 none. */
  function bombCanvas(spark = 0, outline = true) {
    return memo(`bomb${spark}.${outline}`, () => {
      const p = pen(10, 10);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if (!inRound(x, y)) continue;
        const X = x + 1, Y = y + 2 - 1;
        const edge = !inRound(x - 1, y) || !inRound(x + 1, y) || !inRound(x, y - 1) || !inRound(x, y + 1);
        p.px(X, Y + 1, edge && outline ? P.ink : x + y >= 9 ? P.bombLo : P.bomb);
      }
      p.px(3, 4, P.bombHi, 2, 1); p.px(3, 5, P.bombHi, 1, 1); // the shine
      p.px(6, 1, P.ink, 2, 2); p.px(7, 0, P.fuse, 1, 2);       // the cap and the fuse
      if (spark >= 0) {
        const s = spark ? [[8, 0, P.yellow], [9, 1, P.orange], [8, 1, P.cream]] : [[8, 0, P.cream], [9, 0, P.orange], [7, 0, P.yellow]];
        for (const [x, y, col] of s) p.px(x, y, col);
      }
      return p.c;
    });
  }
  const bomb = (spark = 0) => memo(`bombu${spark}`, () => bombCanvas(spark).toDataURL());

  // ------------------------------------------------------------ the frame

  /**
   * The frame for a 7×6 grid: cobalt with a lit top edge and a shaded bottom, round holes cut
   * through (transparent) with a dark lip on each hole's upper edge, an ink outline all round.
   * 74×64 art px. `holes: false` draws the holes filled (the card's back row).
   */
  function frameCanvas() {
    return memo("frame", () => {
      const W = COLS * C + 2 * F, H = ROWS * C + 2 * F;
      const p = pen(W, H);
      p.px(0, 0, P.ink, W, H);
      p.px(1, 1, P.frame, W - 2, H - 2);
      p.px(1, 1, P.frameHi, W - 2, 1);           // the lit top
      p.px(1, H - 2, P.frameLo, W - 2, 1);       // the shade underneath
      p.px(1, 2, P.frameHi, 1, H - 4);           // the lit left edge
      p.px(W - 2, 2, P.frameLo, 1, H - 4);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const ox = F + c * C + 1, oy = F + r * C + 1;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          if (inRound(x, y)) p.g.clearRect(ox + x, oy + y, 1, 1);
          else if (inRound(x, y + 1) || inRound(x + 1, y) || inRound(x - 1, y)) p.px(ox + x, oy + y, y < 4 ? P.frameDeep : P.frameHi); // the hole's lip: dark above, lit below
        }
      }
      return p.c;
    });
  }
  const frame = () => memo("frameurl", () => frameCanvas().toDataURL());
  /** The space behind the frame (seen through empty holes). */
  function backCanvas() {
    return memo("back", () => {
      const W = COLS * C + 2 * F, H = ROWS * C + 2 * F, p = pen(W, H);
      p.px(0, 0, P.hole, W, H);
      return p.c;
    });
  }

  // ------------------------------------------------------------ effects (frame sheets)

  function sheet(name, frames) {
    return memo(`sheet.${name}`, () => {
      const w = frames[0][0].length, h = frames[0].length;
      const p = pen(w * frames.length, h);
      frames.forEach((f, i) => ascii(p, f, i * w));
      return { url: p.c.toDataURL(), n: frames.length, w, h };
    });
  }
  /** Dust where a disc lands: two puffs that spread and fade (12×4, 3 frames). */
  const DUST = [
    ["............", "...D....D...", "..dd....dd..", "............"],
    ["............", "..D......D..", ".d.d....d.d.", "............"],
    [".D........D.", "............", "d..........d", "............"],
  ];
  /** The bomb going off: a flash, a ring of fire, smoke and flying bits (20×20, 6 frames). */
  function blastFrames() {
    const N = 6, S = 20, out = [];
    for (let f = 0; f < N; f++) {
      const g = Array.from({ length: S }, () => new Array(S).fill("."));
      const r = 2 + f * 1.6, cx = 9.5, cy = 9.5;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (f === 0 && d < 4) g[y][x] = "c";
        else if (f <= 3 && d < r && d > r - 2.2) g[y][x] = f < 2 ? "y" : "o";
        else if (f <= 2 && d < r - 2.2) g[y][x] = f === 0 ? "c" : "y";
        else if (f >= 3 && d < r - 1 && d > r - 3.5 && (x + y + f) % 2 === 0) g[y][x] = "d";
      }
      // Flying bits: a few pixels thrown out along the diagonals.
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, -1], [1, 0], [-1, 0]]) {
        const x = Math.round(cx + dx * (r + 1.5)), y = Math.round(cy + dy * (r + 1.5));
        if (f >= 1 && f <= 4 && x >= 0 && y >= 0 && x < S && y < S) g[y][x] = f < 3 ? "o" : "r";
      }
      out.push(g.map((row) => row.join("")));
    }
    return out;
  }
  /** A cleared disc bursting: a ring of four bits flying apart (10×10, 3 frames). */
  const POP = [
    ["..........", "..........", "...c..c...", "....cc....", "....cc....", "...c..c...", "..........", "..........", "..........", ".........."],
    ["..........", "..c....c..", "..........", "..........", "..........", "..........", "..c....c..", "..........", "..........", ".........."],
    [".c......c.", "..........", "..........", "..........", "..........", "..........", "..........", ".c......c.", "..........", ".........."],
  ];
  /** The column arrow (7×4), pointing down at where the disc goes. */
  const ARROW = ["ccccccc", ".ccccc.", "..ccc..", "...c..."];

  /** The coin flip, as a disc turning over: gold, edge-on, coral (10×10, 8 frames, outlined). */
  function coinSheet() {
    return memo("coin", () => {
      const widths = [8, 6, 4, 2, 2, 4, 6, 8];
      const p = pen(10 * widths.length, 10);
      widths.forEach((w, i) => {
        const seat = i < 4 ? 0 : 1, d = DISC[seat];
        const x0 = i * 10 + 5 - w / 2;
        for (let y = 0; y < 8; y++) {
          const [a, b] = ROUND[y];
          const span = Math.max(1, Math.round(((b - a) * w) / 8));
          const sx = Math.round(x0 + (w - span) / 2);
          p.px(sx - 1, y + 1, P.ink, span + 2, 1);
        }
        p.px(x0, 0, P.ink, w, 10);
        for (let y = 0; y < 8; y++) {
          const [a, b] = ROUND[y];
          const span = Math.max(1, Math.round(((b - a) * w) / 8));
          const sx = Math.round(x0 + (w - span) / 2);
          p.px(sx, y + 1, w <= 2 ? d.rim : d.base, span, 1);
          if (w > 2) { p.px(sx, y + 1, d.rim, 1, 1); p.px(sx + span - 1, y + 1, d.rim, 1, 1); }
        }
        if (w >= 6) p.px(x0 + 1, 2, d.hi, 2, 1);
      });
      return { url: p.c.toDataURL(), n: widths.length, w: 10, h: 10, c: p.c };
    });
  }

  const SHEETS = {
    dust: () => sheet("dust", DUST),
    blast: () => sheet("blast", blastFrames()),
    pop: () => sheet("pop", POP),
    coin: coinSheet,
    arrow: () => sheet("arrow", [ARROW]),
  };

  // ------------------------------------------------------------ a whole grid (the result, the card, the banner)

  /** A grid drawn whole: the back, the discs where they are, the frame over them. `lit`: cells of the winning line. */
  function gridCanvas(grid, lit = []) {
    const W = COLS * C + 2 * F, H = ROWS * C + 2 * F, p = pen(W, H);
    p.g.drawImage(backCanvas(), 0, 0);
    const litSet = new Set(lit.map(([c, r]) => `${c},${r}`));
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const v = grid[c]?.[r];
      if (v) p.g.drawImage(discCanvas(v - 1, { lit: litSet.has(`${c},${r}`) }), F + c * C + 1, F + (ROWS - 1 - r) * C + 1);
    }
    p.g.drawImage(frameCanvas(), 0, 0);
    return p.c;
  }

  // ------------------------------------------------------------ the launcher card

  function imgOf(c, k, crop) {
    let src = c;
    if (crop) {
      const q = pen(crop[2], crop[3]);
      q.g.drawImage(c, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
      src = q.c;
    }
    return `<img src="${src.toDataURL()}" alt="" width="${src.width * k}" height="${src.height * k}" style="image-rendering:pixelated;display:block">`;
  }
  function cardCanvas() {
    return memo("card", () => {
      const p = pen(80, 50);
      p.px(0, 0, P.back, 80, 50);
      // What you play with: the frame's lower-right corner with a game under way, cropped by the card's edge.
      const grid = Array.from({ length: COLS }, () => new Array(ROWS).fill(0));
      // Stacks tall enough to show in the card's crop (the top rows), with three golds lined up across.
      const stacks = [[2, 1, 2], [1, 2, 1, 2, 1], [2, 1, 2, 1], [1, 2, 2, 1, 1, 2], [2, 2, 1, 1]];
      stacks.forEach((col, c) => col.forEach((v, r) => { grid[c][r] = v; }));
      p.g.drawImage(gridCanvas(grid), 26, 16);
      // The piece of interface only it has: the bomb, its fuse lit, bottom left.
      p.g.drawImage(bombCanvas(1), 6, 38);
      // The star: a gold disc close to the camera (2×), falling into column B with motion lines above it.
      p.g.imageSmoothingEnabled = false;
      const star = discCanvas(0, { outline: true });
      p.g.globalAlpha = 0.2; p.g.filter = "brightness(0)"; p.g.drawImage(star, 9, 9, 20, 20); p.g.filter = "none"; p.g.globalAlpha = 1;
      p.g.drawImage(star, 7, 7, 20, 20);
      for (const [x, h] of [[11, 4], [16, 6], [21, 4]]) p.px(x, 1, P.goldHi, 1, h); // it's falling
      return p.c;
    });
  }

  /**
   * How long each moment takes on the page, in ms (web/drop-four.html plays them; the room's
   * animBudget in src/game/drop_four/room.ts covers them: test/drop_four.test.ts checks they agree).
   */
  const ANIM = { coin: 1700, hover: 220, fallPerRow: 55, land: 160, fuse: 360, blast: 420, fallAfter: 300, lineStep: 120, lineHold: 700, turn: 160 };

  window.DROP_ART = { P, C, COLS, ROWS, F, DISC, ANIM, disc, discCanvas, bomb, bombCanvas, frame, frameCanvas, backCanvas, gridCanvas, sheet: (name) => SHEETS[name](), card: cardCanvas, pen };

  const style = document.createElement("style");
  style.textContent = `.lc-art[data-art="drop_four"] { background: ${P.back}; }`;
  document.head?.appendChild(style);
  window.Ploto?.gameCard?.("drop_four", {
    art: (W, H) => imgOf(cardCanvas(), Math.max(1, Math.round(Math.max(W / 80, H / 50)))),
    icon: () => imgOf(cardCanvas(), 2, [2, 2, 26, 26]), // a crop on the star (the falling gold disc)
  });
})();
