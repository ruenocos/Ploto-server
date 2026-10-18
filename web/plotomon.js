/**
 * Plotomon — bespoke SVG creature art for Match Monsters.
 *
 * Each of the 20 monsters has its own draw function (distinct silhouette +
 * markings) so they read as individuals, tinted by their element palette and
 * framed in a badge. All original creatures, no external assets.
 * Exposes PLOTOMON.svg(id, size).
 */
(function () {
  const PAL = {
    fire:   { base: "#ff6b3d", dark: "#c0341a", lite: "#ffc3a0", accent: "#ffd23c", bg1: "#3a1510", bg2: "#1d0b08" },
    water:  { base: "#3aa0ff", dark: "#1c5fb0", lite: "#bfe2ff", accent: "#9bf6ff", bg1: "#0f2740", bg2: "#081524" },
    earth:  { base: "#c79153", dark: "#7d5323", lite: "#eccf9f", accent: "#a0e85b", bg1: "#2e2414", bg2: "#171108" },
    nature: { base: "#4ccb6b", dark: "#227a3c", lite: "#bff0c6", accent: "#ffe14d", bg1: "#122c1b", bg2: "#09160e" },
    light:  { base: "#ffd23c", dark: "#d79a1f", lite: "#fff3b0", accent: "#ffffff", bg1: "#3a3112", bg2: "#1d1807" },
  };
  const INK = "#20141b";

  function eye(x, y, r, pupilDy) {
    return (
      `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="#fff"/>` +
      `<circle cx="${x}" cy="${y + (pupilDy ?? r * 0.25)}" r="${r * 0.58}" fill="${INK}"/>` +
      `<circle cx="${x - r * 0.3}" cy="${y - r * 0.2}" r="${r * 0.24}" fill="#fff"/>`
    );
  }
  function eyes(cx, cy, dx, r, mood) {
    let brow = "";
    if (mood === "angry")
      brow =
        `<path d="M${cx - dx - r} ${cy - r * 1.3} l${r * 1.8} ${r * 0.7}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M${cx + dx + r} ${cy - r * 1.3} l${-r * 1.8} ${r * 0.7}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    if (mood === "happy")
      brow =
        `<path d="M${cx - dx - r} ${cy - r * 1.3} q${r} ${-r * 0.8} ${r * 2} 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `<path d="M${cx + dx - r} ${cy - r * 1.3} q${r} ${-r * 0.8} ${r * 2} 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    const blush =
      `<ellipse cx="${cx - dx - r}" cy="${cy + r * 1.7}" rx="${r * 0.8}" ry="${r * 0.5}" fill="#ff7a9c" opacity="0.38"/>` +
      `<ellipse cx="${cx + dx + r}" cy="${cy + r * 1.7}" rx="${r * 0.8}" ry="${r * 0.5}" fill="#ff7a9c" opacity="0.38"/>`;
    return blush + eye(cx - dx, cy, r) + eye(cx + dx, cy, r) + brow;
  }
  const shadow = `<ellipse cx="60" cy="105" rx="30" ry="6" fill="#000" opacity="0.28"/>`;
  const gem = (x, y, r, c) =>
    `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}" fill="${c}" stroke="#fff" stroke-width="1.1"/>`;
  const spots = (c, pts) => `<g fill="${c}" opacity="0.8">` + pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("") + `</g>`;

  // ---------------------------------------------------------------- FIRE
  function pyrup(p) { // small round pup, flame tail, ear tufts
    return shadow +
      `<path d="M30 80 q-16 2 -16 -16 q6 10 12 6 q-2 10 6 10 z" fill="${p.accent}"/>` +
      `<path d="M30 82 q-11 1 -11 -9 q5 6 11 3 z" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="74" rx="30" ry="24" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="82" rx="18" ry="12" fill="${p.lite}" opacity="0.6"/>` +
      `<path d="M44 44 l-7 -16 l15 7 z" fill="${p.base}"/><path d="M76 44 l7 -16 l-15 7 z" fill="${p.base}"/>` +
      `<path d="M45 42 l-3 -9 l8 4 z" fill="${p.accent}"/><path d="M75 42 l3 -9 l-8 4 z" fill="${p.accent}"/>` +
      `<circle cx="60" cy="54" r="22" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="63" rx="8" ry="6" fill="${p.lite}"/><ellipse cx="60" cy="60" rx="3" ry="2.3" fill="${INK}"/>` +
      eyes(60, 51, 9, 5.2, "happy");
  }
  function scorchpaw(p) { // bigger hound, mane, horns, fangs, angry
    return shadow +
      `<path d="M28 86 q-14 0 -16 -12 q9 7 16 2 z" fill="${p.dark}"/>` +
      `<ellipse cx="60" cy="76" rx="33" ry="25" fill="${p.base}"/>` +
      `<g fill="${p.dark}"><path d="M34 60 l-10 -6 l9 10 z"/><path d="M86 60 l10 -6 l-9 10 z"/><path d="M40 50 l-8 -10 l10 10z"/><path d="M80 50 l8 -10 l-10 10z"/></g>` +
      `<circle cx="42" cy="98" r="7" fill="${p.dark}"/><circle cx="78" cy="98" r="7" fill="${p.dark}"/>` +
      `<path d="M42 40 l-5 -15 l11 9 z" fill="${p.lite}"/><path d="M78 40 l5 -15 l-11 9 z" fill="${p.lite}"/>` +
      `<circle cx="60" cy="56" r="25" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="66" rx="10" ry="7" fill="${p.lite}"/><ellipse cx="60" cy="63" rx="3.5" ry="2.6" fill="${INK}"/>` +
      `<path d="M53 72 l3 7 l3 -7 z" fill="#fff"/><path d="M61 72 l3 7 l3 -7 z" fill="#fff"/>` +
      eyes(60, 52, 10, 5.4, "angry");
  }
  function magmaul(p) { // hulking titan with glowing lava cracks
    return shadow +
      `<rect x="30" y="50" width="60" height="48" rx="16" fill="${p.base}"/>` +
      `<path d="M40 60 l8 10 l-5 8 M78 58 l-7 12 M60 54 l0 16 l6 8" stroke="${p.accent}" stroke-width="2.6" fill="none" opacity="0.9"/>` +
      `<rect x="18" y="56" width="14" height="34" rx="7" fill="${p.dark}"/><rect x="88" y="56" width="14" height="34" rx="7" fill="${p.dark}"/>` +
      `<rect x="38" y="94" width="16" height="14" rx="5" fill="${p.dark}"/><rect x="66" y="94" width="16" height="14" rx="5" fill="${p.dark}"/>` +
      `<path d="M40 34 l-8 -16 l16 10 z" fill="${p.lite}"/><path d="M80 34 l8 -16 l-16 10 z" fill="${p.lite}"/>` +
      `<rect x="42" y="30" width="36" height="28" rx="12" fill="${p.base}"/>` +
      `<rect x="48" y="40" width="24" height="10" rx="5" fill="${INK}"/>` +
      eyes(60, 44, 10, 5.4, "angry");
  }
  function emberwing(p) { // firebird with flame crest + flame wings
    return shadow +
      `<g fill="${p.accent}"><path d="M54 42 L57 20 L60 42 Z"/><path d="M60 44 L64 13 L68 44 Z"/><path d="M68 42 L73 22 L74 42 Z"/></g>` +
      `<path d="M30 66 q-20 -10 -18 14 q12 2 20 -4 q-6 8 -16 10 q14 4 22 -8 z" fill="${p.dark}"/>` +
      `<path d="M90 66 q20 -10 18 14 q-12 2 -20 -4 q6 8 16 10 q-14 4 -22 -8 z" fill="${p.dark}"/>` +
      `<ellipse cx="60" cy="70" rx="24" ry="28" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="80" rx="14" ry="16" fill="${p.lite}" opacity="0.6"/>` +
      `<polygon points="60,66 51,72 60,79 69,72" fill="${p.accent}"/>` +
      `<path d="M52 98 l-4 8 M60 100 l0 8 M68 98 l4 8" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>` +
      eyes(60, 54, 9, 5, "happy");
  }

  // ---------------------------------------------------------------- WATER
  function tidecoil(p) { // sea serpent, dorsal fins, coiled tail
    return shadow +
      `<path d="M30 98 q-8 -28 20 -32 q26 -4 20 -26 q-4 -16 -20 -12 q16 4 12 16 q-4 14 -26 18 q-22 6 -16 36 z" fill="${p.base}"/>` +
      `<g fill="${p.accent}"><path d="M44 70 l-6 -8 l8 -2 z"/><path d="M40 84 l-7 -6 l8 -3 z"/><path d="M52 34 l10 -8 l-2 10 z"/></g>` +
      `<circle cx="54" cy="38" r="17" fill="${p.base}"/>` +
      `<ellipse cx="54" cy="46" rx="7" ry="5" fill="${p.lite}"/>` +
      eyes(54, 35, 8, 4.6);
  }
  function frostnip(p) { // icy imp, crystal horns, shivery
    return shadow +
      `<path d="M44 40 l-3 -14 l8 10 z" fill="${p.accent}"/><path d="M76 40 l3 -14 l-8 10 z" fill="${p.accent}"/>` +
      `<path d="M38 86 q-2 12 -7 16 M82 86 q2 12 7 16" stroke="${p.base}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M30 80 q2 -40 30 -40 q28 0 30 40 q-30 8 -60 0 z" fill="${p.base}"/>` +
      `<path d="M40 74 q0 -26 20 -28" stroke="${p.lite}" stroke-width="4" fill="none" opacity="0.6" stroke-linecap="round"/>` +
      spots(p.lite, [[44, 62, 3], [74, 58, 3.5], [60, 48, 2.6]]) +
      eyes(60, 58, 10, 5.6);
  }
  function krakling(p) { // baby kraken, many tentacles, big eyes, spots
    return shadow +
      `<path d="M34 84 q-4 16 -10 20 M46 90 q-2 16 -6 20 M60 92 q0 16 0 20 M74 90 q2 16 6 20 M86 84 q4 16 10 20" stroke="${p.base}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
      `<path d="M28 76 q0 -40 32 -40 q32 0 32 40 q-32 10 -64 0 z" fill="${p.base}"/>` +
      spots(p.dark, [[44, 70, 3], [76, 66, 3], [60, 78, 2.6], [50, 80, 2.4]]) +
      `<ellipse cx="60" cy="54" rx="24" ry="9" fill="#fff" opacity="0.12"/>` +
      eyes(60, 56, 12, 7);
  }
  function bublob(p) { // round jelly dome, bubbles, translucent
    return shadow +
      `<path d="M40 86 q-1 12 -5 16 M54 90 q0 12 -3 16 M66 90 q0 12 3 16 M80 86 q1 12 5 16" stroke="${p.base}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M30 80 q0 -44 30 -44 q30 0 30 44 q-30 10 -60 0 z" fill="${p.base}" opacity="0.92"/>` +
      `<path d="M42 72 q0 -30 20 -32" stroke="${p.lite}" stroke-width="5" fill="none" opacity="0.65" stroke-linecap="round"/>` +
      `<circle cx="74" cy="58" r="4" fill="#fff" opacity="0.5"/><circle cx="48" cy="84" r="3" fill="#fff" opacity="0.4"/>` +
      eyes(60, 60, 11, 6, "happy");
  }

  // ---------------------------------------------------------------- EARTH
  function craggol(p) { // rocky golem, angular body, moss
    return shadow +
      `<polygon points="34,54 86,54 92,96 28,96" fill="${p.base}"/>` +
      `<polygon points="40,54 80,54 72,44 48,44" fill="${p.dark}"/>` +
      `<path d="M34 58 q14 -6 22 2 q10 -4 16 2" stroke="${p.accent}" stroke-width="3" fill="none" opacity="0.8"/>` +
      `<rect x="20" y="58" width="12" height="28" fill="${p.dark}"/><rect x="88" y="58" width="12" height="28" fill="${p.dark}"/>` +
      `<rect x="40" y="96" width="14" height="10" fill="${p.dark}"/><rect x="66" y="96" width="14" height="10" fill="${p.dark}"/>` +
      `<rect x="44" y="58" width="32" height="18" rx="3" fill="${p.lite}" opacity="0.4"/>` +
      eyes(60, 66, 10, 5.4, "angry");
  }
  function rubbug(p) { // beetle, domed shell, horn, 6 legs
    return shadow +
      `<g stroke="${p.dark}" stroke-width="4" stroke-linecap="round"><path d="M34 80 l-12 6 M34 88 l-12 10 M86 80 l12 6 M86 88 l12 10"/></g>` +
      `<ellipse cx="60" cy="80" rx="34" ry="24" fill="${p.dark}"/>` +
      `<path d="M26 80 q34 -34 68 0 z" fill="${p.base}"/>` +
      `<line x1="60" y1="48" x2="60" y2="104" stroke="${p.dark}" stroke-width="3"/>` +
      spots(p.dark, [[46, 72, 4], [74, 72, 4]]) +
      `<path d="M60 48 l0 -16 l-5 6 M60 32 l5 6" stroke="${p.lite}" stroke-width="3" fill="none"/>` +
      eyes(60, 70, 11, 5.2);
  }
  function tremole(p) { // mole, big claws, buck teeth, snout
    return shadow +
      `<ellipse cx="60" cy="78" rx="30" ry="26" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="86" rx="18" ry="14" fill="${p.lite}" opacity="0.5"/>` +
      `<g fill="${p.lite}"><path d="M34 88 l-10 4 l10 4 l-8 4 M86 88 l10 4 l-10 4 l8 4" stroke="${p.lite}" stroke-width="3" fill="none"/></g>` +
      `<ellipse cx="60" cy="70" rx="12" ry="9" fill="${p.lite}"/>` +
      `<ellipse cx="60" cy="68" rx="4" ry="3" fill="#ff7a9c"/>` +
      `<rect x="56" y="74" width="3.4" height="7" fill="#fff"/><rect x="60.6" y="74" width="3.4" height="7" fill="#fff"/>` +
      eyes(60, 58, 7, 3.6);
  }
  function gemox(p) { // ox, crystal horns, forehead gem, bulky
    return shadow +
      `<ellipse cx="60" cy="80" rx="32" ry="22" fill="${p.base}"/>` +
      `<rect x="40" y="96" width="12" height="12" rx="3" fill="${p.dark}"/><rect x="68" y="96" width="12" height="12" rx="3" fill="${p.dark}"/>` +
      `<ellipse cx="60" cy="54" rx="22" ry="20" fill="${p.base}"/>` +
      `<path d="M40 48 q-16 -4 -20 -18 q14 6 22 6 z" fill="${p.lite}"/><path d="M80 48 q16 -4 20 -18 q-14 6 -22 6 z" fill="${p.lite}"/>` +
      gem(60, 44, 6, p.accent) +
      `<ellipse cx="60" cy="64" rx="10" ry="7" fill="${p.lite}"/><ellipse cx="56" cy="64" rx="2.4" ry="3" fill="${INK}"/><ellipse cx="64" cy="64" rx="2.4" ry="3" fill="${INK}"/>` +
      eyes(60, 54, 9, 4.8);
  }

  // ---------------------------------------------------------------- NATURE
  function thornkin(p) { // sprout, leaf hat, thorns
    return shadow +
      `<path d="M60 36 q-16 -2 -22 -16 q8 18 22 14 q14 4 22 -14 q-6 14 -22 16 z" fill="${p.dark}"/><line x1="60" y1="20" x2="60" y2="40" stroke="${p.dark}" stroke-width="3"/>` +
      `<ellipse cx="60" cy="74" rx="24" ry="26" fill="${p.base}"/>` +
      `<g fill="${p.dark}"><path d="M36 70 l-8 -3 l6 6 z"/><path d="M84 70 l8 -3 l-6 6 z"/></g>` +
      `<path d="M46 98 l-3 8 M60 100 l0 8 M74 98 l3 8" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>` +
      eyes(60, 68, 9, 5.2, "happy");
  }
  function vinecoil(p) { // vine snake, leaves along body, flower
    return shadow +
      `<path d="M32 98 q-8 -26 18 -30 q26 -4 20 -24 q-4 -16 -18 -12 q14 4 10 16 q-4 14 -24 18 q-22 6 -16 34 z" fill="${p.base}"/>` +
      `<g fill="${p.dark}"><path d="M40 86 l-9 2 l5 -8 z"/><path d="M52 60 l10 -2 l-6 8 z"/></g>` +
      `<g fill="${p.accent}"><circle cx="58" cy="26" r="4"/><circle cx="50" cy="30" r="4"/><circle cx="62" cy="33" r="4"/><circle cx="55" cy="30" r="3" fill="${p.lite}"/></g>` +
      `<circle cx="56" cy="40" r="15" fill="${p.base}"/>` +
      eyes(56, 40, 8, 4.4, "happy");
  }
  function myconite(p) { // mushroom, spotted cap, spores
    return shadow +
      `<ellipse cx="60" cy="82" rx="20" ry="22" fill="${p.lite}"/>` +
      `<path d="M26 56 q34 -30 68 0 q-34 14 -68 0 z" fill="${p.dark}"/>` +
      spots(p.lite, [[44, 48, 5], [70, 44, 6], [58, 52, 4], [78, 52, 4]]) +
      `<g fill="${p.accent}" opacity="0.8"><circle cx="34" cy="40" r="2"/><circle cx="90" cy="46" r="2"/><circle cx="80" cy="30" r="1.6"/></g>` +
      `<path d="M50 100 l-2 6 M60 102 l0 6 M70 100 l2 6" stroke="${p.base}" stroke-width="3" stroke-linecap="round"/>` +
      eyes(60, 80, 8, 4.6, "happy");
  }
  function petalope(p) { // fawn, flower antlers, spotted back
    return shadow +
      `<ellipse cx="60" cy="80" rx="26" ry="20" fill="${p.base}"/>` +
      spots(p.lite, [[50, 76, 3], [66, 74, 3], [58, 84, 2.6]]) +
      `<circle cx="46" cy="98" r="5" fill="${p.dark}"/><circle cx="74" cy="98" r="5" fill="${p.dark}"/>` +
      `<ellipse cx="60" cy="54" rx="16" ry="17" fill="${p.base}"/>` +
      `<path d="M48 40 q-8 -14 -16 -14 M72 40 q8 -14 16 -14" stroke="${p.dark}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<g fill="${p.accent}"><circle cx="32" cy="24" r="4"/><circle cx="88" cy="24" r="4"/></g>` +
      `<ellipse cx="60" cy="62" rx="6" ry="4.5" fill="${p.lite}"/>` +
      eyes(60, 52, 8, 4.6, "happy");
  }

  // ---------------------------------------------------------------- LIGHT
  function lumowl(p) { // owl, huge eyes, ear tufts, star
    return shadow +
      `<path d="M30 66 q-12 -4 -12 10 q8 0 14 -4 z" fill="${p.dark}"/><path d="M90 66 q12 -4 12 10 q-8 0 -14 -4 z" fill="${p.dark}"/>` +
      `<ellipse cx="60" cy="68" rx="28" ry="30" fill="${p.base}"/>` +
      `<ellipse cx="60" cy="78" rx="18" ry="20" fill="${p.lite}" opacity="0.5"/>` +
      `<path d="M42 40 l-4 -14 l12 8 z" fill="${p.base}"/><path d="M78 40 l4 -14 l-12 8 z" fill="${p.base}"/>` +
      `<polygon points="60,64 53,71 60,78 67,71" fill="${p.accent}"/>` +
      `<path d="M50 98 l-3 7 M60 100 l0 7 M70 98 l3 7" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="47" cy="56" r="13" fill="#fff"/><circle cx="73" cy="56" r="13" fill="#fff"/>` +
      `<circle cx="47" cy="58" r="7" fill="${INK}"/><circle cx="73" cy="58" r="7" fill="${INK}"/>` +
      `<circle cx="44" cy="54" r="2.6" fill="#fff"/><circle cx="70" cy="54" r="2.6" fill="#fff"/>`;
  }
  function glintling(p) { // star sprite, glow, sparkle crown
    const star = (x, y, r, c) => {
      let pts = "";
      for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; pts += `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)} `; }
      return `<polygon points="${pts}" fill="${c}"/>`;
    };
    return shadow +
      `<circle cx="60" cy="66" r="30" fill="${p.base}" opacity="0.25"/>` +
      `<ellipse cx="60" cy="74" rx="22" ry="24" fill="${p.base}"/>` +
      `<g>${star(42, 34, 7, p.accent)}${star(78, 36, 6, p.accent)}${star(60, 26, 5, p.lite)}</g>` +
      `<path d="M46 96 l-2 8 M60 98 l0 8 M74 96 l2 8" stroke="${p.dark}" stroke-width="3" stroke-linecap="round"/>` +
      eyes(60, 70, 9, 5, "happy");
  }
  function lumistag(p) { // stag, glowing branching antlers, star gem
    return shadow +
      `<ellipse cx="60" cy="82" rx="24" ry="18" fill="${p.base}"/>` +
      `<circle cx="48" cy="98" r="5" fill="${p.dark}"/><circle cx="72" cy="98" r="5" fill="${p.dark}"/>` +
      `<ellipse cx="60" cy="56" rx="16" ry="18" fill="${p.base}"/>` +
      `<g stroke="${p.accent}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M50 42 q-10 -16 -20 -18 M44 38 q-8 -8 -16 -8 M50 36 q-6 -12 -14 -16"/><path d="M70 42 q10 -16 20 -18 M76 38 q8 -8 16 -8 M70 36 q6 -12 14 -16"/></g>` +
      gem(60, 50, 5, p.accent) +
      `<ellipse cx="60" cy="64" rx="6" ry="5" fill="${p.lite}"/>` +
      eyes(60, 54, 8, 4.6);
  }
  function lumoth(p) { // moth, big patterned wings, feather antennae
    return shadow +
      `<path d="M58 70 q-34 -24 -40 2 q-4 20 12 24 q18 4 28 -10 z" fill="${p.dark}"/>` +
      `<path d="M62 70 q34 -24 40 2 q4 20 -12 24 q-18 4 -28 -10 z" fill="${p.dark}"/>` +
      `<g fill="${p.accent}" opacity="0.9"><circle cx="30" cy="62" r="6"/><circle cx="90" cy="62" r="6"/><circle cx="34" cy="82" r="4"/><circle cx="86" cy="82" r="4"/></g>` +
      `<ellipse cx="60" cy="70" rx="11" ry="26" fill="${p.base}"/>` +
      `<path d="M52 34 q-10 -16 -16 -16 M68 34 q10 -16 16 -16" stroke="${p.dark}" stroke-width="2.4" fill="none"/>` +
      `<g fill="${p.dark}"><circle cx="36" cy="18" r="3"/><circle cx="84" cy="18" r="3"/></g>` +
      eyes(60, 52, 7, 4.4, "happy");
  }

  const B = {
    ember_pup: pyrup, cinder_hound: scorchpaw, magma_titan: magmaul, phoenix_chick: emberwing,
    tide_serpent: tidecoil, frost_imp: frostnip, kraken_pup: krakling, bubble_jelly: bublob,
    stone_golem: craggol, boulder_beetle: rubbug, quake_mole: tremole, crystal_ox: gemox,
    thorn_sprite: thornkin, vine_lurker: vinecoil, shroom_knight: myconite, petal_fawn: petalope,
    prism_owl: lumowl, dawn_sprite: glintling, lumen_stag: lumistag, halo_moth: lumoth,
  };
  const ELEM = {
    ember_pup: "fire", cinder_hound: "fire", magma_titan: "fire", phoenix_chick: "fire",
    tide_serpent: "water", frost_imp: "water", kraken_pup: "water", bubble_jelly: "water",
    stone_golem: "earth", boulder_beetle: "earth", quake_mole: "earth", crystal_ox: "earth",
    thorn_sprite: "nature", vine_lurker: "nature", shroom_knight: "nature", petal_fawn: "nature",
    prism_owl: "light", dawn_sprite: "light", lumen_stag: "light", halo_moth: "light",
  };

  function svg(id, size) {
    const el = ELEM[id] || "light";
    const p = PAL[el];
    const draw = B[id] || bublob;
    const sz = size || 72;
    const gid = "g" + id;
    return (
      `<svg viewBox="0 0 120 120" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg" class="plotomon">` +
      `<defs><radialGradient id="${gid}" cx="50%" cy="40%" r="70%">` +
      `<stop offset="0%" stop-color="${p.bg1}"/><stop offset="100%" stop-color="${p.bg2}"/></radialGradient></defs>` +
      `<circle cx="60" cy="60" r="58" fill="url(#${gid})"/>` +
      `<circle cx="60" cy="60" r="58" fill="none" stroke="${p.base}" stroke-width="2" opacity="0.5"/>` +
      draw(p) +
      `</svg>`
    );
  }

  window.PLOTOMON = { svg: svg };
})();
