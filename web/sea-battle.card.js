/**
 * Sea Battle's pixel art, drawn in code on Ploto's grid: one 10×10 art-pixel
 * tile per cell. The launcher card (Ploto.gameCard), the home banner and the
 * game itself all draw from these sprites (`window.SEA_ART`), so the card is
 * the poster and the banner the trailer of the same sea (docs/STYLE.md).
 *
 * Every sprite is a 1× canvas turned into a data URL once; pages scale it by a
 * whole number with `image-rendering: pixelated`.
 *
 * The card follows the launcher card rule: still, the 80×50 grid, a collage of
 * the star (a battleship), what you play with (the sea, a splash, a burning
 * hit) and the piece of interface only this game has (the crosshair).
 */
(() => {
  "use strict";
  const C = 10; // art pixels per cell

  const P = {
    ink: "#0a0c14", deep: "#0a2a3d", sea: "#114560", sea2: "#13506e", lite: "#2a7f9e", foam: "#bfe8f2", white: "#eef0ff",
    hull: "#7c86ad", hullHi: "#b3bbdc", hullLo: "#4a5486", deck: "#5d678f", red: "#d8364b", redHi: "#ff8080",
    orange: "#ff9d3b", yellow: "#ffcc33", cream: "#fff4d6", smoke: "#4b5170", smokeHi: "#8a90a8",
    wreck: "#6b6f8a", wreckHi: "#8d91ab", rust: "#7a3b2e", back: "#0c3346",
  };
  /** ASCII palette for the hand-drawn sprites. */
  const KEY = { k: P.ink, w: P.white, f: P.foam, l: P.lite, d: P.deep, s: P.sea, r: P.red, R: P.redHi, o: P.orange, y: P.yellow, c: P.cream, m: P.smoke, M: P.smokeHi, u: P.rust, h: P.hullHi, g: P.hull };

  function pen(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    return { c, g, px(x, y, col, ww = 1, hh = 1) { g.fillStyle = col; g.fillRect(x, y, ww, hh); } };
  }
  /** Draw ASCII rows at (x, y). */
  function ascii(p, rows, x = 0, y = 0) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (KEY[ch]) p.px(x + i, y + j, KEY[ch]); }));
  }
  const cache = new Map();
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  /** A seeded hash for stable "random" details (waves per cell). */
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 4294967296; };

  // ------------------------------------------------------------ the sea

  /** The sea for an n×n board: water, a grid line between cells, wave dashes (two frames for the swell). */
  const water = (n, frame = 0) => memo(`waterurl${n}.${frame}`, () => waterCanvas(n, frame).toDataURL());
  function waterCanvas(n, frame = 0) {
    return memo(`water${n}.${frame}`, () => {
      const p = pen(n * C + 1, n * C + 1);
      p.px(0, 0, P.sea, n * C + 1, n * C + 1);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if ((x + y) % 2) p.px(x * C + 1, y * C + 1, P.sea2, C - 1, C - 1);
        // One or two short wave dashes per cell, nudged a pixel on the other frame.
        for (let k = 0; k < 2; k++) {
          if (hash(x * 7 + k, y * 13) < (k ? 0.75 : 0.2)) continue;
          const wx = x * C + 2 + Math.floor(hash(x, y + k * 31) * 4) + (frame ? 1 : 0), wy = y * C + 2 + Math.floor(hash(y, x + k * 17) * 6);
          p.px(wx, wy, P.lite, 3, 1);
          p.px(wx + 1, wy - 1, P.lite, 1, 1);
        }
      }
      for (let i = 0; i <= n; i++) { p.px(i * C, 0, P.deep, 1, n * C + 1); p.px(0, i * C, P.deep, n * C + 1, 1); }
      return p.c;
    });
  }

  // ------------------------------------------------------------ ships

  const LEN = { carrier: 5, battleship: 4, cruiser: 3, submarine: 3, destroyer: 2 };

  /** Rows of the hull in column x (bow on the right), or null. */
  function hullRows(kind, W, x) {
    if (x < 1 || x > W - 2) return null;
    let t = kind === "submarine" ? 3 : 2, b = kind === "submarine" ? 6 : 7;
    const d = W - 2 - x; // distance from the bow's tip
    if (d < 1) { t = 4; b = 5; } else if (d < 3) { t = Math.max(t, 3); b = Math.min(b, 6); }
    if (x === 1) { t = Math.max(t, 3); b = Math.min(b, 6); }
    return [t, b];
  }

  function turret(p, x, col, hi) {
    p.px(x, 3, P.ink, 4, 4); p.px(x + 1, 4, hi, 2, 2); p.px(x + 1, 3, col, 2, 1);
    p.px(x + 4, 4, P.ink, 3, 1); // the barrel, towards the bow
  }

  /** A ship seen from above, bow to the right, on a (L·10)×10 canvas. `wreck`: dark, cracked. */
  function drawShip(p, kind, ox = 0, oy = 0, wreck = false) {
    const L = LEN[kind], W = L * C;
    const body = wreck ? P.wreck : P.hull, hi = wreck ? P.wreckHi : P.hullHi, lo = wreck ? P.ink : P.hullLo, deck = wreck ? P.wreck : P.deck;
    const q = { px: (x, y, c, w, h) => p.px(ox + x, oy + y, c, w, h) };
    // Outline first (the hull grown by a pixel), then the hull.
    for (let x = 0; x < W; x++) for (const dx of [-1, 0, 1]) {
      const r = hullRows(kind, W, x + dx);
      if (r) q.px(x, r[0] - 1, P.ink, 1, r[1] - r[0] + 3);
    }
    for (let x = 0; x < W; x++) {
      const r = hullRows(kind, W, x);
      if (!r) continue;
      q.px(x, r[0], body, 1, r[1] - r[0] + 1);
      q.px(x, r[0], hi, 1, 1);
      q.px(x, r[1], lo, 1, 1);
    }
    if (kind === "carrier") {
      q.px(3, 3, deck, W - 9, 4);
      for (let x = 5; x < W - 12; x += 4) q.px(x, 5, wreck ? P.wreckHi : P.white, 2, 1);
      q.px(W - 19, 1, P.ink, 6, 4); q.px(W - 18, 2, hi, 4, 2);
    } else if (kind === "battleship") {
      for (const x of [6, 15, 25]) turret(q, x, body, hi);
    } else if (kind === "cruiser") {
      turret(q, 5, body, hi); q.px(13, 3, P.ink, 3, 3); q.px(14, 4, wreck ? P.ink : P.smoke, 1, 1); turret(q, 18, body, hi);
    } else if (kind === "submarine") {
      q.px(12, 1, P.ink, 6, 4); q.px(13, 2, hi, 4, 2); q.px(15, 0, P.ink, 1, 1);
      q.px(4, 4, deck, 6, 2); q.px(20, 4, deck, 5, 2);
    } else if (kind === "destroyer") {
      q.px(4, 3, P.ink, 3, 3); q.px(5, 4, wreck ? P.ink : P.smoke, 1, 1); turret(q, 10, body, hi);
    }
    if (wreck) {
      // A crack down the middle and rust where it burned.
      const m = Math.floor(W / 2);
      [[m, 2], [m + 1, 3], [m, 4], [m - 1, 5], [m, 6], [m + 1, 7]].forEach(([x, y]) => { q.px(x, y, P.ink, 1, 1); q.px(x + 1, y, P.redHi, 1, 1); });
      q.px(3, 5, P.rust, 2, 1); q.px(W - 7, 3, P.rust, 2, 1); q.px(m - 4, 6, P.rust, 1, 1);
    }
  }

  /** A ship's canvas ("h": bow right; "v": bow down), 1× art pixels. */
  function shipCanvas(kind, dir = "h", wreck = false) {
    return memo(`shipc.${kind}.${dir}.${wreck}`, () => {
      const L = LEN[kind];
      const h = pen(L * C, C);
      drawShip(h, kind, 0, 0, wreck);
      if (dir === "h") return h.c;
      const v = pen(C, L * C);
      v.g.translate(C, 0); v.g.rotate(Math.PI / 2); v.g.drawImage(h.c, 0, 0);
      return v.c;
    });
  }
  /** Data URL of a ship. */
  const ship = (kind, dir = "h", wreck = false) => memo(`ship.${kind}.${dir}.${wreck}`, () => shipCanvas(kind, dir, wreck).toDataURL());
  /** The fleet tracker's icon: the ship itself; sunk, its wreck struck through in red. */
  function shipIcon(kind, sunk = false) {
    return memo(`icon.${kind}.${sunk}`, () => {
      const L = LEN[kind];
      const p = pen(L * C, C);
      drawShip(p, kind, 0, 0, sunk);
      if (sunk) { p.px(1, 4, P.red, L * C - 2, 2); p.px(1, 4, P.redHi, L * C - 2, 1); }
      return p.c.toDataURL();
    });
  }

  /** A small fleet-tracker icon: the ship's silhouette, 2 art px tall per 5 of length. */
  function mini(kind, sunk = false) {
    return memo(`mini.${kind}.${sunk}`, () => {
      const L = LEN[kind], W = L * 4 + 1;
      const p = pen(W, 5);
      p.px(1, 0, P.ink, W - 3, 5); p.px(0, 1, P.ink, W, 3);
      p.px(1, 1, sunk ? P.wreckHi : P.hullHi, W - 3, 2); p.px(1, 3, sunk ? P.wreck : P.hull, W - 3, 1); p.px(W - 2, 2, sunk ? P.wreckHi : P.hullHi, 1, 1);
      if (sunk) for (let x = 1; x < W - 1; x += 2) p.px(x, 2, P.red, 1, 1);
      return p.c.toDataURL();
    });
  }

  // ------------------------------------------------------------ markers and effects (frame sheets)

  /** A horizontal strip of frames from ASCII (each frame the same size). */
  function sheet(name, frames) {
    return memo(`sheet.${name}`, () => {
      const w = frames[0][0].length, h = frames[0].length;
      const p = pen(w * frames.length, h);
      frames.forEach((f, i) => ascii(p, f, i * w));
      return { url: p.c.toDataURL(), n: frames.length, w, h, c: p.c };
    });
  }

  const MISS = [
    "..........", "..........", "...ffff...", "..f....f..", "..f.dd.f..", "..f.dd.f..", "..f....f..", "...ffff...", "..........", "..........",
  ];
  const WATER_MARK = [
    "..........", "..........", "..........", "....f.....", "...fff....", "....f.....", "....k.....", "..........", "..........", "..........",
  ];
  /** The foam ring that ripples out before a "nothing here" mark settles. */
  const RIPPLE = [
    ["..........", "..........", "..........", "....ff....", "...f..f...", "...f..f...", "....ff....", "..........", "..........", ".........."],
    ["..........", "..........", "...ffff...", "..f....f..", "..f....f..", "..f....f..", "..f....f..", "...ffff...", "..........", ".........."],
    ["..........", ".f......f.", "f........f", "..........", "..........", "..........", "..........", "f........f", ".f......f.", ".........."],
  ];
  /** A splash, still: the ring on the water and droplets around it (the card's). */
  const SPLASH_STILL = [
    "................", "......f...f.....", "..f..........f..", "................", ".....fwwwwf.....", "....fwffffwf....", "..f.wf....fw.f..", "....wf....fw....", ".....wffffw.....", "..f...wwww...f..", "......f..f......", "................",
  ];
  const FIRE = [
    [
      "..........", "....y.....", "....yo....", "...oyy....", "...oyyo...", "..royyor..", "..rooyor..", "..urrrru..", "...uuuu...", "..........",
    ],
    [
      "..........", ".....y....", "....oy....", "....yyo...", "...oyyo...", "..royyor..", "..royoor..", "..urrrru..", "...uuuu...", "..........",
    ],
    [
      "....y.....", "....yo....", "...oyy....", "...oyyo...", "..royyyo..", "..royyor..", "..rooyor..", "..urrrru..", "...uuuu...", "..........",
    ],
  ];
  const SPLASH = [
    ["................", "................", "................", "................", "................", "................", "................", "......ffff......", ".....f....f.....", "......ffff......", "................", "................", "................", "................", "................", "................"],
    ["................", "................", "................", "................", ".......ff.......", "......fwwf......", "......fwwf......", ".....ffwwff.....", "....f.ffff.f....", ".....f....f.....", "......ffff......", "................", "................", "................", "................", "................"],
    ["................", "....f......f....", ".....f.ff.f.....", "......fwwf......", ".....fwwwwf.....", ".....fwwwwf.....", "......fwwf......", "....ffwwwwff....", "...f..ffff..f...", "....f......f....", ".....ffffff.....", "................", "................", "................", "................", "................"],
    ["..f..........f..", "................", "...f........f...", "................", "....f.ffff.f....", ".....fwwwwf.....", "......ffff......", ".....f....f.....", "...f.ffffff.f...", "..f..........f..", "...f........f...", "....ffffffff....", "................", "................", "................", "................"],
    ["................", "................", "................", "................", "................", "................", "................", "................", "..ff........ff..", ".f............f.", "f..............f", ".f............f.", "..ffffffffffff..", "................", "................", "................"],
  ];
  const BOOM = [
    ["................", "................", "................", "................", "................", "......wwww......", ".....wwwwww.....", ".....wwccww.....", ".....wwccww.....", ".....wwwwww.....", "......wwww......", "................", "................", "................", "................", "................"],
    ["................", "................", "................", ".....y....y.....", "....yyyccyyy....", "...yycccccccy...", "...ycccwwccyy...", "..yyccwwwwccyy..", "..yyccwwwwccyy..", "...ycccwwcccy...", "...yycccccccy...", "....yyyccyyy....", ".....y....y.....", "................", "................", "................"],
    ["................", "...o..o..o..o...", "....ooooyooo....", "..oooyyyyyyooo..", "..ooyyyccyyyoo..", ".ooyyycccyyyyoo.", ".oyyyccwwccyyyo.", "ooyyccwwwwccyyoo", "ooyyccwwwwccyyoo", ".oyyycccccyyyyo.", ".ooyyyyccyyyyoo.", "..oooyyyyyyooo..", "....oooooooo....", "...o..o..o..o...", "................", "................"],
    ["..r...r..r...r..", "...rrroooorrr...", ".rrooooyyoooorr.", ".rooyyyyyyyyoor.", "rrooyyooooyyoorr", "rooyyo....oyyoor", "rooyo......oyoor", "rooyo......oyoor", "rooyo......oyoor", "rooyyo....oyyoor", "rrooyyooooyyoorr", ".rooyyyyyyyyoor.", ".rrooooyyoooorr.", "...rrroooorrr...", "..r...r..r...r..", "................"],
    ["................", "....mm....mm....", "...mMMm..mMMm...", "..mMMMMmmMMMMm..", "..mMr........m..", ".mMr..........m.", ".mr............m", "mr..............", "m...............", ".m............m.", "..m..........m..", "...mm......mm...", ".....mmmmmm.....", "................", "................", "................"],
    ["................", "................", ".....mm..mm.....", "....mMMmmMMm....", "...mM......Mm...", "...m........m...", "..m..........m..", "................", "................", "..m..........m..", "...m........m...", "....mm....mm....", "................", "................", "................", "................"],
  ];
  const SMOKE = [
    ["............", "............", "............", "............", "............", "............", "............", "............", "............", "............", "....mm......", "...mMMm.....", "...mMMm.....", "....mm......", "............", "............"],
    ["............", "............", "............", "............", "............", "............", "......mm....", ".....mMMm...", ".....mMMm...", "......mm....", "...mmm......", "..mMMMm.....", "..mMMMm.....", "...mmm......", "............", "............"],
    ["............", "............", "............", ".......mm...", "......mMMm..", "......mMMm..", ".......mm...", "....mmm.....", "...mMMMm....", "...mMMMm....", "....mmm.....", "..mmmm......", ".mMMMMm.....", ".mMMMMm.....", "..mmmm......", "............"],
    ["........mm..", ".......mMMm.", ".......mMMm.", "........mm..", ".....mmm....", "....mMMMm...", "....mMMMm...", ".....mmm....", "...mmmm.....", "..mMMMMm....", "..mMMMMm....", "...mmmm.....", "..mmm.......", ".mMMMm......", "..mmm.......", "............"],
    [".........m..", "........mM..", "........m...", "......mm....", ".....mMMm...", ".....mMMm...", "......mm....", "....mmm.....", "...mMMMm....", "....mmm.....", "...mm.......", "..mMMm......", "...mm.......", "............", "............", "............"],
    ["............", ".........m..", "............", "......m.....", ".....mM.....", "............", "....m.......", "...mM.......", "............", "...m........", "............", "............", "............", "............", "............", "............"],
  ];
  const BUBBLES = [
    ["..........", "..........", "..........", "..........", "..........", "..........", "..........", "...f......", "..f.f..f..", "...f......"],
    ["..........", "..........", "..........", "..........", "....f.....", "...f.f....", "....f..f..", "......f.f.", ".......f..", ".f........"],
    ["..........", "...f......", "..f.f.....", "...f......", "......f...", ".....f.f..", "......f...", "..f.......", "..........", ".........."],
    ["...f......", "..........", "..........", "......f...", "..........", "..f.......", "..........", "..........", "..........", ".........."],
  ];
  const CROSS = [
    "rrrr......rrrr", "rcc........ccr", "rc..........cr", "r............r", "..............", "......rr......", ".....rccr.....", ".....rccr.....", "......rr......", "..............", "r............r", "rc..........cr", "rcc........ccr", "rrrr......rrrr",
  ];
  const SHELL = [".kkk.", "kcwck", "kwwwk", "kcwck", ".kkk."];
  const TRAIL = [[".Mm.", "MmmM", ".mM."], ["....", ".mm.", "...."]];

  function coinFrames() {
    // A spinning gold coin: widths shrink to an edge and back; the last frame shows an anchor.
    const widths = [12, 9, 4, 2, 4, 9, 12];
    return widths.map((w, i) => {
      const rows = Array.from({ length: 14 }, () => Array(14).fill("."));
      for (let y = 1; y < 13; y++) {
        const half = Math.round((w / 2) * Math.sqrt(1 - ((y - 6.5) / 6) ** 2));
        for (let x = 7 - half; x < 7 + half; x++) rows[y][x] = x === 7 - half || x === 6 + half || y === 1 || y === 12 ? "k" : i % 2 ? "o" : "y";
      }
      if (i === widths.length - 1 || i === 0) {
        ["...k...", "..kkk..", "...k...", "...k...", ".k.k.k.", "..kkk.."].forEach((row, j) => [...row].forEach((ch, k) => { if (ch === "k") rows[4 + j][4 + k] = "u"; }));
      }
      return rows.map((r) => r.join(""));
    });
  }

  /** A tall column of smoke over a sinking ship: 12×24, 6 frames, puffs rising and spreading. */
  function smokeColumn() {
    return memo("sheet.column", () => {
      const W = 12, H = 24, N = 6;
      const p = pen(W * N, H);
      for (let f = 0; f < N; f++) {
        for (let i = 0; i < 4; i++) {
          const y = H - 4 - (f * 3 + i * 6);
          if (y < 0 || y > H - 3) continue;
          const r = 1 + Math.min(3, Math.floor((H - y) / 7));
          const x = f * W + 6 + ((i % 2) ? 1 : -1) * Math.floor(f / 2);
          p.px(x - r, y - r + 1, P.smoke, r * 2, r * 2 - 1);
          p.px(x - r + 1, y - r, P.smoke, r * 2 - 2, r * 2 + 1);
          p.px(x - r + 1, y - r + 1, P.smokeHi, Math.max(1, r - 1), Math.max(1, r - 1));
        }
      }
      return { url: p.c.toDataURL(), n: N, w: W, h: H };
    });
  }

  /**
   * A sinking half of a broken ship, tilted `t` steps (0 flat, 1, 2) in whole art pixels:
   * the broken end dips in a stair step (no rotation, so it stays on the grid).
   * `first`: the stern half (left, or top when vertical).
   */
  function halfCanvas(kind, dir, first, t) {
    return memo(`half.${kind}.${dir}.${first}.${t}`, () => {
      const L = LEN[kind], W = L * C, hw = Math.ceil(W / 2);
      const src = pen(W, C);
      drawShip(src, kind, 0, 0, true);
      const h = pen(hw, C + 4);
      const x0 = first ? 0 : W - hw;
      for (let x = 0; x < hw; x++) {
        const fromBreak = first ? hw - 1 - x : x; // 0 at the break
        const dip = Math.floor(((hw - fromBreak) / hw) * 2 * t);
        h.g.drawImage(src.c, x0 + x, 0, 1, C, x, dip, 1, C);
      }
      if (dir === "h") return h.c;
      const v = pen(C + 4, hw);
      v.g.translate(C + 4, 0); v.g.rotate(Math.PI / 2); v.g.drawImage(h.c, 0, 0);
      return v.c;
    });
  }
  const half = (kind, dir, first, t) => memo(`halfurl.${kind}.${dir}.${first}.${t}`, () => halfCanvas(kind, dir, first, t).toDataURL());

  const SHEETS = {
    column: () => smokeColumn(),
    trail: () => sheet("trail", TRAIL),
    ripple: () => sheet("ripple", RIPPLE),
    fire: () => sheet("fire", FIRE),
    splash: () => sheet("splash", SPLASH),
    boom: () => sheet("boom", BOOM),
    smoke: () => sheet("smoke", SMOKE),
    bubbles: () => sheet("bubbles", BUBBLES),
    coin: () => sheet("coin", coinFrames()),
  };
  const SINGLE = { miss: MISS, water: WATER_MARK, cross: CROSS, shell: SHELL, splash: SPLASH_STILL, trail: TRAIL[0] };
  /** A one-frame sprite: {url, w, h}. */
  function sprite(name) {
    return memo(`sprite.${name}`, () => {
      const rows = SINGLE[name];
      const p = pen(rows[0].length, rows.length);
      ascii(p, rows);
      return { url: p.c.toDataURL(), w: rows[0].length, h: rows.length, c: p.c };
    });
  }

  // ------------------------------------------------------------ the launcher card

  /** A canvas as an <img> at k CSS px per art pixel; `crop` [x, y, w, h] takes a piece of it. */
  function imgOf(c, k, crop) {
    let src = c;
    if (crop) {
      const q = pen(crop[2], crop[3]);
      q.g.drawImage(c, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
      src = q.c;
    }
    return `<img src="${src.toDataURL()}" alt="" width="${src.width * k}" height="${src.height * k}" style="image-rendering:pixelated;display:block">`;
  }
  /** The card: 80×50 art pixels. A framed corner of the sea on the deep backdrop, the battleship crossing its edge. */
  function cardCanvas() {
    return memo("card", () => {
      const p = pen(80, 50);
      p.px(0, 0, P.back, 80, 50);
      // The sea: 6×3 cells framed on the right (cropped by the card's edge), below the NEW badge (top right 20×10).
      const gx = 24, gy = 12, cols = 6, rows = 3, gw = cols * C + 1, gh = rows * C + 1;
      p.px(gx - 2, gy - 2, P.ink, gw + 4, gh + 4);
      p.px(gx - 1, gy - 1, P.lite, gw + 2, 1); // the frame's lit top row
      p.px(gx, gy, P.sea, gw, gh);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if ((x + y) % 2) p.px(gx + x * C + 1, gy + y * C + 1, P.sea2, C - 1, C - 1);
        if (hash(x + 3, y) > 0.55) p.px(gx + x * C + 3 + Math.floor(hash(y, x) * 3), gy + y * C + 3 + Math.floor(hash(x + 9, y) * 5), P.lite, 3, 1);
      }
      for (let i = 0; i <= cols; i++) p.px(gx + i * C, gy, P.deep, 1, gh);
      for (let i = 0; i <= rows; i++) p.px(gx, gy + i * C, P.deep, gw, 1);
      // What you play with: a splash and a miss on the sea.
      ascii(p, SPLASH_STILL, gx + C - 3, gy + C - 3);
      ascii(p, MISS, gx + 4 * C, gy + C);
      // The interface only it has: the crosshair locked on a cell, inside the sea.
      ascii(p, CROSS, gx + 3 * C - 2, gy - 2);
      // The star: the carrier (the biggest ship) crossing the sea's bottom-left corner, with its hard shadow, burning at the stern.
      const shadow = pen(50, 10);
      drawShip(shadow, "carrier");
      p.g.globalAlpha = 0.14; p.g.filter = "brightness(0)"; p.g.drawImage(shadow.c, 3, 37); p.g.filter = "none"; p.g.globalAlpha = 1;
      drawShip(p, "carrier", 2, 36);
      ascii(p, FIRE[2], 8, 34);
      return p.c;
    });
  }

  /**
   * How long each moment takes on the page, in ms (web/sea-battle.html plays them; the room's
   * animMs in src/game/sea_battle/room.ts must cover them: test/sea_battle.test.ts checks it).
   */
  const ANIM = {"coinSpin": 900, "coinLabel": 800, "swap": 240, "aimHop": 170, "aimHops": 3, "aimLock": 220, "shell": 420, "splash": 300, "missHold": 280, "hitStop": 90, "hitHold": 480, "sinkStopBase": 120, "sinkStopPerCell": 60, "plate": 110, "crack": 120, "halves": 560, "halvesPerCell": 30, "stampHold": 700, "ring": 90, "turnHold": 200};

  /**
   * The placement rules as the page needs them, from the engine (src/game/sea_battle/engine.ts)
   * and the bots' hiding score (bot.ts); test/sea_battle.test.ts checks they agree.
   */
  const SHIPS = { carrier: { name: "Carrier", length: 5 }, battleship: { name: "Battleship", length: 4 }, cruiser: { name: "Cruiser", length: 3 }, submarine: { name: "Submarine", length: 3 }, destroyer: { name: "Destroyer", length: 2 } };
  const BOARDS = { classic: { size: 10, fleet: ["carrier", "battleship", "cruiser", "submarine", "destroyer"] }, quick: { size: 8, fleet: ["battleship", "cruiser", "submarine", "destroyer"] } };
  const cellsOf = (p) => Array.from({ length: SHIPS[p.kind].length }, (_, i) => (p.dir === "h" ? [p.x + i, p.y] : [p.x, p.y + i]));
  /** Whether ship `p` fits with the rest of `fleet` (in bounds, not overlapping or touching). */
  function fits(n, fleet, p) {
    const others = new Set(fleet.filter((q) => q.kind !== p.kind).flatMap((q) => cellsOf(q).map(([x, y]) => y * n + x)));
    return cellsOf(p).every(([x, y]) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < n && ny < n && others.has(ny * n + nx)) return false;
      }
      return true;
    });
  }
  function randomFleet(board, random = Math.random) {
    const { size: n, fleet: kinds } = BOARDS[board];
    for (let attempt = 0; attempt < 500; attempt++) {
      const fleet = [];
      const ok = [...kinds].sort((a, b) => SHIPS[b].length - SHIPS[a].length).every((kind) => {
        for (let t = 0; t < 200; t++) {
          const dir = random() < 0.5 ? "h" : "v", len = SHIPS[kind].length;
          const q = { kind, dir, x: Math.floor(random() * (dir === "h" ? n - len + 1 : n)), y: Math.floor(random() * (dir === "v" ? n - len + 1 : n)) };
          if (fits(n, fleet, q)) { fleet.push(q); return true; }
        }
        return false;
      });
      if (ok) return kinds.map((k) => fleet.find((q) => q.kind === k));
    }
    return null;
  }
  /** How often a ship could cover each cell of an empty board: where hunters look first. */
  function density(board) {
    const { size: n, fleet: kinds } = BOARDS[board];
    const d = new Array(n * n).fill(0);
    for (const k of kinds) {
      const len = SHIPS[k].length;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (x + len <= n) for (let i = 0; i < len; i++) d[y * n + x + i]++;
        if (y + len <= n) for (let i = 0; i < len; i++) d[(y + i) * n + x]++;
      }
    }
    return d;
  }
  /** How hard a fleet is to find, 0..1 (the bots' hiding score). */
  function hiding(board, fleet) {
    const n = BOARDS[board].size, d = density(board);
    const max = Math.max(...d), min = Math.min(...d);
    const cells = fleet.flatMap((q) => cellsOf(q).map(([x, y]) => d[y * n + x]));
    return Math.max(0, Math.min(1, (max - cells.reduce((a, b) => a + b, 0) / cells.length) / (max - min)));
  }
  window.SEA_RULES = { SHIPS, BOARDS, cellsOf, fits, randomFleet, density, hiding };

  window.SEA_ART = { P, C, LEN, ANIM, water, waterCanvas, half, halfCanvas, ship, shipCanvas, shipIcon, mini, sprite, sheet: (name) => SHEETS[name](), card: cardCanvas, drawShip, pen, ascii, FRAMES: { FIRE, SPLASH, MISS, CROSS } };

  const style = document.createElement("style");
  style.textContent = `.lc-art[data-art="sea_battle"] { background: ${P.back}; }`;
  document.head.appendChild(style);
  window.Ploto?.gameCard?.("sea_battle", {
    art: (W, H) => imgOf(cardCanvas(), Math.max(1, Math.round(Math.max(W / 80, H / 50)))),
    icon: () => imgOf(cardCanvas(), 2, [2, 26, 24, 24]), // a crop on the star
  });
})();
