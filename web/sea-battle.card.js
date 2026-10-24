/**
 * Sea Battle's launcher card and list icon: the game's own art, drawn to the
 * launcher card rule (docs/STYLE.md, "Launcher cards"): still, an 80×50 art grid
 * at a whole-number scale, a collage of what's inside (the star, what you play
 * with, one piece of interface only this game has), its own deep backdrop colour, the icon
 * a 24×24 crop of the star.
 * TEMPLATE: replace the placeholder below (see web/holdem.card.js and
 * web/match-monsters.card.js).
 */
(() => {
  "use strict";
  const style = document.createElement("style");
  style.textContent = `.lc-art[data-art="sea_battle"] { background: var(--c-panel-lo, var(--c-well)); }`;
  document.head.appendChild(style);
  window.Ploto.gameCard("sea_battle", {
    art: (W, H) => `<div class="lc-init">Sea Battle</div>`,
    icon: () => "",
  });
})();
