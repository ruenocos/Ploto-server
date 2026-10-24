/**
 * __TITLE__'s launcher card and list icon: the game's own art, drawn to the
 * launcher card rule (docs/STYLE.md, "Launcher cards"): still, an 80×50 art grid
 * at a whole-number scale, the game's surface in its frame with 2–3 hero objects
 * (its signature moment), its own deep backdrop colour, the icon a 24×24 crop.
 * TEMPLATE: replace the placeholder below (see web/holdem.card.js and
 * web/match-monsters.card.js).
 */
(() => {
  "use strict";
  const style = document.createElement("style");
  style.textContent = `.lc-art[data-art="__ID__"] { background: var(--c-panel-lo, var(--c-well)); }`;
  document.head.appendChild(style);
  window.Ploto.gameCard("__ID__", {
    art: (W, H) => `<div class="lc-init">__TITLE__</div>`,
    icon: () => "",
  });
})();
