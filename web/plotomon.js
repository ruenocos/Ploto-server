/**
 * Plotomon — procedural fantasy creature art for Match Monsters.
 *
 * Each monster maps to an archetype (beast, titan, bird, serpent, blob, sprite,
 * stag) rendered in its element's palette with a few per-monster feature toggles,
 * so the 20 creatures look like one cohesive, Pokemon-ish set. Exposes
 * PLOTOMON.svg(id, size) returning an <svg> string drawn on a 120x120 canvas
 * inside a tinted badge. No external assets.
 */
(function () {
  const PAL = {
    fire:   { base: "#ff6b3d", dark: "#c0341a", lite: "#ffc3a0", accent: "#ffd23c", bg1: "#3a1510", bg2: "#1d0b08" },
    water:  { base: "#3aa0ff", dark: "#1c5fb0", lite: "#bfe2ff", accent: "#9bf6ff", bg1: "#0f2740", bg2: "#081524" },
    earth:  { base: "#c79153", dark: "#7d5323", lite: "#eccf9f", accent: "#a0e85b", bg1: "#2e2414", bg2: "#171108" },
    nature: { base: "#4ccb6b", dark: "#227a3c", lite: "#bff0c6", accent: "#ffe14d", bg1: "#122c1b", bg2: "#09160e" },
    light:  { base: "#ffd23c", dark: "#d79a1f", lite: "#fff3b0", accent: "#ffffff", bg1: "#3a3112", bg2: "#1d1807" },
  };
  const INK = "#1b1016";

  // --- shared parts ---------------------------------------------------------
  function eyes(cx, cy, dx, r, happy) {
    const e = (x) =>
      `<ellipse cx="${x}" cy="${cy}" rx="${r}" ry="${r * 1.15}" fill="#fff"/>` +
      `<circle cx="${x}" cy="${cy + r * 0.25}" r="${r * 0.6}" fill="${INK}"/>` +
      `<circle cx="${x - r * 0.3}" cy="${cy - r * 0.15}" r="${r * 0.24}" fill="#fff"/>`;
    const brow = happy
      ? `<path d="M${cx - dx - r} ${cy - r * 1.4} q${r} ${-r * 0.7} ${r * 2} 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `<path d="M${cx + dx - r} ${cy - r * 1.4} q${r} ${-r * 0.7} ${r * 2} 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      : "";
    return e(cx - dx) + e(cx + dx) + brow;
  }
  const shadow = `<ellipse cx="60" cy="104" rx="30" ry="7" fill="#000" opacity="0.28"/>`;
  const gem = (x, y, r, c) =>
    `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${c}" stroke="#fff" stroke-width="1.2" opacity="0.95"/>`;

  // --- archetypes -----------------------------------------------------------
  function beast(p, f) {
    const tail = f.flame
      ? `<path d="M30 78 q-16 -4 -14 -20 q8 10 10 2 q2 10 8 8 z" fill="${p.accent}"/>`
      : `<path d="M30 80 q-14 2 -16 -10 q10 6 16 2 z" fill="${p.dark}"/>`;
    const horns = f.horns
      ? `<path d="M44 40 l-6 -16 l10 10 z" fill="${p.lite}"/><path d="M76 40 l6 -16 l-10 10 z" fill="${p.lite}"/>`
      : "";
    const ears = `<path d="M44 42 l-8 -14 l16 6 z" fill="${p.base}"/><path d="M76 42 l8 -14 l-16 6 z" fill="${p.base}"/>`;
    const fang = f.fangs
      ? `<path d="M54 74 l3 6 l3 -6 z" fill="#fff"/><path d="M62 74 l3 6 l3 -6 z" fill="#fff"/>`
      : "";
    return (
      shadow + tail +
      `<ellipse cx="60" cy="74" rx="34" ry="26" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="82" rx="24" ry="15" fill="${p.lite}" opacity="0.55"/>` +
      `<circle cx="42" cy="98" r="7" fill="${p.dark}"/><circle cx="78" cy="98" r="7" fill="${p.dark}"/>` +
      ears + horns +
      `<circle cx="60" cy="56" r="24" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="66" rx="9" ry="7" fill="${p.lite}"/>` +
      `<ellipse cx="60" cy="63" rx="3.4" ry="2.6" fill="${INK}"/>` +
      fang + eyes(60, 52, 10, 5.4, f.happy)
    );
  }

  function titan(p, f) {
    const horns = f.horns
      ? `<path d="M40 30 l-6 -16 l12 8 z" fill="${p.lite}"/><path d="M80 30 l6 -16 l-12 8 z" fill="${p.lite}"/>`
      : "";
    const shellTop = f.shell ? `<path d="M36 56 q24 -22 48 0 z" fill="${p.dark}"/>` : "";
    return (
      shadow +
      `<rect x="34" y="52" width="52" height="44" rx="14" fill="${p.base}"/>` +
      `<rect x="44" y="64" width="32" height="28" rx="10" fill="${p.lite}" opacity="0.5"/>` +
      gem(60, 76, 8, p.accent) + shellTop +
      `<rect x="22" y="56" width="12" height="30" rx="6" fill="${p.dark}"/>` +
      `<rect x="86" y="56" width="12" height="30" rx="6" fill="${p.dark}"/>` +
      `<rect x="40" y="92" width="14" height="14" rx="5" fill="${p.dark}"/>` +
      `<rect x="66" y="92" width="14" height="14" rx="5" fill="${p.dark}"/>` +
      horns +
      `<rect x="44" y="30" width="32" height="26" rx="11" fill="${p.base}"/>` +
      eyes(60, 43, 9, 5, f.happy)
    );
  }

  function bird(p, f) {
    const wings = `<path d="M30 70 q-18 -6 -16 12 q10 2 18 -2 z" fill="${p.dark}"/>` +
      `<path d="M90 70 q18 -6 16 12 q-10 2 -18 -2 z" fill="${p.dark}"/>`;
    const crest = f.crest
      ? `<path d="M60 20 q-8 -12 2 -14 q2 8 10 6 q-4 8 -12 8 z" fill="${p.accent}"/>`
      : "";
    const antennae = f.antennae
      ? `<path d="M50 30 q-8 -14 -14 -14" stroke="${INK}" stroke-width="2" fill="none"/><circle cx="36" cy="16" r="3" fill="${p.accent}"/>` +
        `<path d="M70 30 q8 -14 14 -14" stroke="${INK}" stroke-width="2" fill="none"/><circle cx="84" cy="16" r="3" fill="${p.accent}"/>`
      : "";
    const bigEye = f.owl ? 7 : 5;
    return (
      shadow + wings +
      `<ellipse cx="60" cy="68" rx="26" ry="30" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="78" rx="16" ry="18" fill="${p.lite}" opacity="0.6"/>` +
      `<polygon points="60,66 52,72 60,78 68,72" fill="${p.accent}"/>` +
      `<path d="M52 98 l-4 8 M60 100 l0 8 M68 98 l4 8" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>` +
      crest + antennae +
      eyes(60, 54, f.owl ? 12 : 9, bigEye, f.happy)
    );
  }

  function serpent(p, f) {
    const frill = f.fins
      ? `<path d="M60 22 q10 -10 4 2 q10 -6 2 4 q8 0 -2 6 z" fill="${p.accent}"/>`
      : "";
    return (
      shadow +
      `<path d="M30 96 q-6 -26 18 -30 q26 -4 22 -24 q-3 -16 -18 -14 q14 4 10 16 q-4 14 -24 18 q-24 6 -18 34 z" fill="${p.base}"/>` +
      `<path d="M34 94 q-4 -20 16 -24" stroke="${p.lite}" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/>` +
      frill +
      `<circle cx="56" cy="36" r="17" fill="${p.base}"/>` +
      `<ellipse cx="56" cy="44" rx="7" ry="5" fill="${p.lite}"/>` +
      `<path d="M50 50 q6 5 12 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      eyes(56, 33, 8, 4.6, f.happy)
    );
  }

  function blob(p, f) {
    const horns = f.horns
      ? `<path d="M44 40 l-4 -12 l9 8 z" fill="${p.dark}"/><path d="M76 40 l4 -12 l-9 8 z" fill="${p.dark}"/>`
      : "";
    const tentacles = `<path d="M38 84 q-2 14 -8 18 M50 90 q0 14 -4 18 M70 90 q0 14 4 18 M82 84 q2 14 8 18"
      stroke="${p.base}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    return (
      shadow + tentacles + horns +
      `<path d="M28 78 q0 -42 32 -42 q32 0 32 42 q-32 10 -64 0 z" fill="${p.base}"/>` +
      `<path d="M40 74 q0 -28 20 -30" stroke="${p.lite}" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/>` +
      `<ellipse cx="60" cy="56" rx="26" ry="10" fill="#fff" opacity="0.14"/>` +
      eyes(60, 58, 11, 6, f.happy)
    );
  }

  function sprite(p, f) {
    const cap = f.mushroom
      ? `<path d="M30 52 q30 -34 60 0 q-30 10 -60 0 z" fill="${p.dark}"/>` +
        `<circle cx="46" cy="44" r="4" fill="${p.lite}"/><circle cx="68" cy="40" r="5" fill="${p.lite}"/><circle cx="60" cy="50" r="3" fill="${p.lite}"/>`
      : `<path d="M60 20 q-14 6 -22 -2 q6 16 22 14 q16 2 22 -14 q-8 8 -22 2 z" fill="${p.dark}"/>` +
        `<path d="M60 18 l0 18" stroke="${p.dark}" stroke-width="3"/>`;
    const petals = f.petals
      ? `<g fill="${p.accent}"><circle cx="46" cy="30" r="5"/><circle cx="60" cy="24" r="5"/><circle cx="74" cy="30" r="5"/></g>`
      : "";
    return (
      shadow +
      `<ellipse cx="60" cy="76" rx="24" ry="26" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="84" rx="14" ry="14" fill="${p.lite}" opacity="0.55"/>` +
      `<path d="M44 98 l-3 8 M60 100 l0 8 M76 98 l3 8" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>` +
      cap + petals +
      eyes(60, 68, 9, 5.2, f.happy)
    );
  }

  function stag(p, f) {
    const antlers =
      `<path d="M46 38 q-10 -18 -22 -18 M40 34 q-10 -8 -18 -6 M46 30 q-8 -12 -16 -16" stroke="${p.lite}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="M74 38 q10 -18 22 -18 M80 34 q10 -8 18 -6 M74 30 q8 -12 16 -16" stroke="${p.lite}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return (
      shadow +
      `<ellipse cx="60" cy="78" rx="28" ry="22" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="84" rx="18" ry="12" fill="${p.lite}" opacity="0.5"/>` +
      `<circle cx="46" cy="98" r="6" fill="${p.dark}"/><circle cx="74" cy="98" r="6" fill="${p.dark}"/>` +
      gem(60, 72, 6, p.accent) + antlers +
      `<ellipse cx="60" cy="50" rx="18" ry="19" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="60" rx="7" ry="5" fill="${p.lite}"/>` +
      eyes(60, 48, 9, 5, f.happy)
    );
  }

  const B = { beast, titan, bird, serpent, blob, sprite, stag };

  // monster id -> { e: element, b: body archetype, f: features }
  const SPEC = {
    ember_pup:    { e: "fire",   b: "beast",   f: { flame: 1, happy: 1 } },
    cinder_hound: { e: "fire",   b: "beast",   f: { flame: 1, horns: 1, fangs: 1 } },
    magma_titan:  { e: "fire",   b: "titan",   f: { horns: 1 } },
    phoenix_chick:{ e: "fire",   b: "bird",    f: { crest: 1, happy: 1 } },

    tide_serpent: { e: "water",  b: "serpent", f: { fins: 1 } },
    frost_imp:    { e: "water",  b: "blob",    f: { horns: 1 } },
    kraken_pup:   { e: "water",  b: "blob",    f: {} },
    bubble_jelly: { e: "water",  b: "blob",    f: { happy: 1 } },

    stone_golem:  { e: "earth",  b: "titan",   f: {} },
    boulder_beetle:{ e: "earth", b: "titan",   f: { shell: 1 } },
    quake_mole:   { e: "earth",  b: "beast",   f: { fangs: 1 } },
    crystal_ox:   { e: "earth",  b: "titan",   f: { horns: 1, happy: 1 } },

    thorn_sprite: { e: "nature", b: "sprite",  f: {} },
    vine_lurker:  { e: "nature", b: "serpent", f: { fins: 1 } },
    shroom_knight:{ e: "nature", b: "sprite",  f: { mushroom: 1 } },
    petal_fawn:   { e: "nature", b: "stag",    f: { happy: 1 } },

    prism_owl:    { e: "light",  b: "bird",    f: { owl: 1 } },
    dawn_sprite:  { e: "light",  b: "sprite",  f: { petals: 1, happy: 1 } },
    lumen_stag:   { e: "light",  b: "stag",    f: {} },
    halo_moth:    { e: "light",  b: "bird",    f: { antennae: 1 } },
  };

  function svg(id, size) {
    const s = SPEC[id] || { e: "light", b: "blob", f: {} };
    const p = PAL[s.e];
    const sz = size || 72;
    const gid = "g" + id.replace(/[^a-z0-9]/g, "");
    const inner = B[s.b](p, s.f || {});
    return (
      `<svg viewBox="0 0 120 120" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg" class="plotomon">` +
      `<defs><radialGradient id="${gid}" cx="50%" cy="40%" r="70%">` +
      `<stop offset="0%" stop-color="${p.bg1}"/><stop offset="100%" stop-color="${p.bg2}"/></radialGradient></defs>` +
      `<circle cx="60" cy="60" r="58" fill="url(#${gid})"/>` +
      `<circle cx="60" cy="60" r="58" fill="none" stroke="${p.base}" stroke-width="2" opacity="0.5"/>` +
      inner +
      `</svg>`
    );
  }

  window.PLOTOMON = { svg: svg };
})();
