/**
 * Wild Eights' pixel art, drawn in code: the felt table, the suit pips, the suit
 * burst of a wild eight, small canvas cards for the launcher card and the home
 * banner, and the timings the page plays (`window.EIGHTS_ART`). The cards in the
 * game itself are Ploto's deck, the same faces as Hold'em's (pixel glyphs from
 * GRIDS below, court portraits from web/cards.js), so a card reads the same in
 * every Ploto card game.
 *
 * The card follows the launcher card rule: still, the 80×50 grid, a collage of the
 * star (an eight slamming onto the pile, close to the camera), what you play with
 * (a fan of cards) and the piece of interface only this game has (the suit picker).
 */
(() => {
  "use strict";

  const P = {
    ink: "#0a0c14", felt: "#1d4c3c", feltHi: "#214f40", feltLo: "#1a4537", rim: "#10302a", rimHi: "#1a4238",
    card: "#fff4d6", cardLo: "#e3d2a6", red: "#b8213a", black: "#141a2c", gold: "#ffcc33", goldLo: "#d99a1a",
    back: "#7c5cff", backLo: "#5a41c8", backHi: "#a996ff", cream: "#fff4d6", white: "#eef0ff",
  };
  /** Each suit: its name, its ink on a card, and its flood colour (the table's rim and the suit badge after an eight). */
  const SUIT = {
    S: { name: "spades", one: "spade", ink: P.black, flood: "#7fc4d8", floodLo: "#3f7f94" }, // cyan-grey: never the accent purple that means "your turn"
    H: { name: "hearts", one: "heart", ink: P.red, flood: "#ff6b7f", floodLo: "#b8213a" },
    D: { name: "diamonds", one: "diamond", ink: P.red, flood: "#ffa94d", floodLo: "#c4661a" },
    C: { name: "clubs", one: "club", ink: P.black, flood: "#8fd45f", floodLo: "#4c8f2a" },
  };
  const SUITS = ["S", "H", "D", "C"];

  /** Pixel glyphs, "X" filled: the suits (7×7), small pips (5 wide) and the ranks (3×5; "10" stays narrow). */
  const GRIDS = {
    S: ["...X...", "..XXX..", ".XXXXX.", "XXXXXXX", "XXXXXXX", "...X...", "..XXX.."],
    H: [".XX.XX.", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."],
    D: ["...X...", "..XXX..", ".XXXXX.", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."],
    C: ["..XXX..", "..XXX..", "XX.X.XX", "XXXXXXX", "XX.X.XX", "...X...", "..XXX.."],
    pS: ["..X..", ".XXX.", "XXXXX", "XXXXX", "..X..", ".XXX."],
    pH: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."],
    pD: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
    pC: [".XXX.", "XXXXX", "XXXXX", "XX.XX", "..X..", ".XXX."],
  };
  const RANK_GLYPH = {
    A: [".X.", "X.X", "XXX", "X.X", "X.X"], K: ["X.X", "X.X", "XX.", "X.X", "X.X"], Q: [".X.", "X.X", "X.X", "X.X", ".XX"],
    J: ["..X", "..X", "..X", "X.X", ".X."], 0: ["XXX", "X.X", "X.X", "X.X", "XXX"], 1: ["X", "X", "X", "X", "X"],
    2: ["XX.", "..X", ".X.", "X..", "XXX"], 3: ["XX.", "..X", ".X.", "..X", "XX."], 4: ["X.X", "X.X", "XXX", "..X", "..X"],
    5: ["XXX", "X..", "XX.", "..X", "XX."], 6: [".XX", "X..", "XXX", "X.X", "XXX"], 7: ["XXX", "..X", ".X.", ".X.", ".X."],
    8: ["XXX", "X.X", "XXX", "X.X", "XXX"], 9: ["XXX", "X.X", "XXX", "..X", "XX."],
  };
  for (const r of ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]) {
    const gs = [...r].map((ch) => RANK_GLYPH[ch]);
    GRIDS["r" + r] = gs[0].map((_, y) => gs.map((g) => g[y]).join("."));
  }

  function pen(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    return { c, g, px(x, y, col, ww = 1, hh = 1) { g.fillStyle = col; g.fillRect(x, y, ww, hh); } };
  }
  function glyph(p, name, x, y, col) { (GRIDS[name] || []).forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "X") p.px(x + i, y + j, col); })); }
  const cache = new Map();
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  const rankOf = (c) => c.slice(0, -1), suitOf = (c) => c.slice(-1);

  // ------------------------------------------------------------ small canvas cards (launcher, banner, icons)

  /**
   * A small card, 13×18 art px: an ink edge with clipped corners, the rank top left, a big pip
   * low in the middle. An eight (wild) has a gold frame inside its edge. `back`: the deck's back.
   */
  function miniCanvas(card, back = false) {
    return memo(`mini.${card}.${back}`, () => {
      const W = 13, H = 18, p = pen(W, H);
      p.px(1, 0, P.ink, W - 2, H); p.px(0, 1, P.ink, W, H - 2);
      if (back) {
        p.px(1, 1, P.backHi, W - 2, H - 2);
        for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) p.px(x, y, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? P.back : P.backLo);
        return p.c;
      }
      p.px(1, 1, P.card, W - 2, H - 2);
      p.px(1, H - 2, P.cardLo, W - 2, 1);
      const r = rankOf(card), s = suitOf(card), ink = SUIT[s].ink;
      if (r === "8") { p.px(1, 1, P.gold, W - 2, 1); p.px(1, H - 2, P.goldLo, W - 2, 1); p.px(1, 1, P.gold, 1, H - 2); p.px(W - 2, 1, P.goldLo, 1, H - 2); }
      glyph(p, "r" + r, 2, 2, ink);
      glyph(p, s, 3, 9, ink);
      return p.c;
    });
  }
  const mini = (card, back = false) => memo(`miniurl.${card}.${back}`, () => miniCanvas(card, back).toDataURL());
  /** A suit pip canvas: 7×7 (`big`) or 5 wide, in the suit's card ink or its flood colour, with an ink edge if `outline`. */
  function pipCanvas(s, { big = true, flood = false, outline = false } = {}) {
    return memo(`pip.${s}.${big}.${flood}.${outline}`, () => {
      const g = GRIDS[big ? s : "p" + s], o = outline ? 1 : 0, w = g[0].length + 2 * o, h = g.length + 2 * o, p = pen(w, h);
      const on = (x, y) => g[y]?.[x] === "X";
      if (outline) for (let y = -1; y <= g.length; y++) for (let x = -1; x <= g[0].length; x++) if (!on(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => on(x + dx, y + dy))) p.px(x + o, y + o, P.ink);
      glyph(p, big ? s : "p" + s, o, o, flood ? SUIT[s].flood : SUIT[s].ink);
      return p.c;
    });
  }
  const pip = (s, opts = {}) => memo(`pipurl.${s}.${opts.big !== false}.${!!opts.flood}.${!!opts.outline}`, () => pipCanvas(s, opts).toDataURL());

  // ------------------------------------------------------------ the table

  /** The felt, a 16×16 tile: a quiet weave a shade off the base (it never shimmers). */
  function feltCanvas() {
    return memo("felt", () => {
      const p = pen(16, 16);
      p.px(0, 0, P.felt, 16, 16);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) { p.px(x + ((y / 4) % 2) * 2, y, P.feltHi); p.px(x + 2 - ((y / 4) % 2) * 2, y + 2, P.feltLo); }
      return p.c;
    });
  }
  const felt = () => memo("felturl", () => feltCanvas().toDataURL());

  // ------------------------------------------------------------ effects (frame sheets)

  /**
   * The wild eight's burst: a ring of the named suit's pips flying out from the pile and thinning
   * (48×48, 6 frames), with a cream flash in the first frame.
   */
  function burstSheet(s) {
    return memo(`burst.${s}`, () => {
      const N = 6, S = 48, p = pen(S * N, S), g = GRIDS["p" + s];
      for (let f = 0; f < N; f++) {
        const ox = f * S, c = S / 2, r = 8 + f * 3.4;
        if (f === 0) for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 30) p.px(ox + c + x, c + y, P.cream);
        if (f === 1) for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; p.px(ox + Math.round(c + Math.cos(t) * 9), Math.round(c + Math.sin(t) * 9), P.cream, 2, 2); }
        for (let i = 0; i < 8; i++) {
          if (f >= 4 && i % 2) continue; // the ring thins as it goes
          const t = (i / 8) * Math.PI * 2 + 0.2, x = Math.round(ox + c + Math.cos(t) * r - 2.5), y = Math.round(c + Math.sin(t) * r - 2.5);
          g.forEach((row, j) => [...row].forEach((ch, k) => { if (ch === "X") p.px(x + k, y + j, f >= 5 ? SUIT[s].floodLo : SUIT[s].flood); }));
        }
      }
      return { url: p.c.toDataURL(), n: N, w: S, h: S };
    });
  }
  /** A card slapping down: four short lines thrown out from its corners (24×32, 3 frames). */
  function slapSheet() {
    return memo("slap", () => {
      const N = 3, W = 24, H = 32, p = pen(W * N, H);
      for (let f = 0; f < N; f++) {
        const o = f * W, d = 1 + f * 2;
        for (const [x, y, dx, dy] of [[3, 3, -1, -1], [W - 4, 3, 1, -1], [3, H - 4, -1, 1], [W - 4, H - 4, 1, 1]]) {
          for (let i = 0; i < 2; i++) p.px(o + x + dx * (d + i), y + dy * (d + i), f === 2 ? P.cardLo : P.cream);
        }
      }
      return { url: p.c.toDataURL(), n: N, w: W, h: H };
    });
  }
  const SHEETS = { slap: slapSheet };

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
      p.g.fillStyle = p.g.createPattern(feltCanvas(), "repeat") || P.felt;
      p.g.fillRect(0, 0, 80, 50);
      p.px(0, 0, SUIT.H.flood, 80, 1); p.px(0, 49, SUIT.H.floodLo, 80, 1); // the rim, flooded hearts by the eight
      // What you play with: a fan of cards, bottom right, cropped by the card's edge.
      ["5H", "KC", "9H", "QD"].forEach((c, i) => p.g.drawImage(miniCanvas(c), 44 + i * 8, 33 - (i === 1 || i === 2 ? 2 : 0)));
      // The pile under the star: two cards, the top one a little turned (offset, as pixel art does it).
      p.g.drawImage(miniCanvas("7S"), 20, 25); p.g.drawImage(miniCanvas("7H"), 23, 23);
      // The piece of interface only it has: the suit picker, four pips in a strip, hearts picked.
      // (bottom left, clear of the NEW badge's corner)
      p.px(2, 37, P.ink, 26, 11); p.px(3, 38, P.rimHi, 24, 9);
      SUITS.forEach((s, i) => { if (s === "H") { p.px(3 + i * 6, 38, P.cream, 6, 9); } p.g.drawImage(pipCanvas(s, { big: false, flood: s !== "H" }), 3 + i * 6, 39 + (s === "S" || s === "C" ? 0 : 1)); });
      // The star: the eight of hearts slamming down, close to the camera (2×), with its burst.
      p.g.imageSmoothingEnabled = false;
      const star = miniCanvas("8H");
      for (const [x, y] of [[6, 10], [36, 8], [36, 38], [21, 2]]) p.g.drawImage(pipCanvas("H", { big: false, flood: true }), x, y);
      p.g.globalAlpha = 0.14; p.g.filter = "brightness(0)"; p.g.drawImage(star, 14, 9, 26, 36); p.g.filter = "none"; p.g.globalAlpha = 1;
      p.g.drawImage(star, 13, 8, 26, 36);
      return p.c;
    });
  }

  /**
   * How long each moment takes on the page, in ms (web/wild-eights.html plays them; the room's
   * animBudget in src/game/wild_eights/room.ts covers them: test/wild_eights.test.ts checks they agree).
   */
  const ANIM = { deal: 90, play: 320, wild: 900, draw: 260, skip: 500, owed: 600, turn: 180, last: 500, win: 1400 };

  window.EIGHTS_ART = { P, SUIT, SUITS, GRIDS, ANIM, mini, miniCanvas, pip, pipCanvas, felt, feltCanvas, burst: burstSheet, sheet: (name) => SHEETS[name](), card: cardCanvas, pen };

  const style = document.createElement("style");
  style.textContent = `.lc-art[data-art="wild_eights"] { background: ${P.felt}; }`;
  document.head?.appendChild(style);
  window.Ploto?.gameCard?.("wild_eights", {
    art: (W, H) => imgOf(cardCanvas(), Math.max(1, Math.round(Math.max(W / 80, H / 50)))),
    icon: () => imgOf(cardCanvas(), 2, [12, 7, 28, 28]), // a crop on the star (the eight slamming down)
  });
})();
