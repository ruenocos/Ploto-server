/**
 * __TITLE__'s launcher card and list icon: the game's own art (docs/NEW_GAME.md,
 * "Launcher card"). TEMPLATE: replace with the game's pixel art, drawn on whole
 * pixels (an SVG grid or sprites), sized to the box it gets.
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
