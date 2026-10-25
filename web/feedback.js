// @ts-check
/**
 * Sound and haptics: one `cue(event)` per game moment, called at the exact
 * moment its visual happens, so sound, vibration and animation land together.
 * Small, frequent events get a light touch; big moments get stronger,
 * patterned ones.
 *
 * Sounds are jsfxr stock presets, one set per game plus Ploto's own (generated
 * by scripts/gen-sounds.mjs from src/game/<game>/sounds.json and
 * src/platform/sounds.json into web/sounds.js), synthesised here into Web Audio
 * buffers on first use. A page plays its game's set first, then Ploto's.
 * Haptics use the Vibration API where the device has it (Android; iOS Safari
 * has none, so there the sound and visuals carry the cue on their own).
 */

(() => {
/** @typedef {string} Cue  a name in the page's game set or Ploto's (web/sounds.js) */
/** @typedef {{ code: string, vol: number, buzz: number | number[] }} Sound */

const W = /** @type {any} */ (window);
/** The game whose set this page plays first (set by the lobby kit). */
let game = "";
/** A cue's sound: the game's own, else Ploto's. @returns {Sound | null} */
function soundFor(/** @type {Cue} */ name) {
  const sets = W.PLOTO_SOUNDS || {};
  return sets[game]?.[name] ?? sets.ui?.[name] ?? null;
}
const settings = { sound: true, haptics: true };
/** The vibration still playing: a new call cancels it, so a weaker buzz mustn't cut a stronger one short. */
let buzzUntil = 0, buzzStrength = 0;
const total = (/** @type {number | number[]} */ p) => (Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p);

/** Vibrate, unless a stronger pattern is still playing. Returns whether the browser accepted it. */
function buzz(/** @type {number | number[]} */ pattern) {
  if (!settings.haptics || !("vibrate" in navigator)) return false;
  // Browsers refuse (and log) vibration before the page's first tap, e.g. right after a reload.
  const ua = /** @type {any} */ (navigator).userActivation;
  if (ua && !ua.hasBeenActive) return false;
  const now = performance.now(), strength = total(pattern);
  if (now < buzzUntil && strength < buzzStrength) return false;
  let ok = false;
  try { ok = navigator.vibrate(pattern); } catch {}
  if (ok) { buzzUntil = now + strength; buzzStrength = strength; }
  return ok;
}
/** @type {AudioContext | null} */
let ctx = null;
/** @type {GainNode | null} */
let master = null;
/** @type {Map<string, AudioBuffer>} */
const buffers = new Map();

/** Browsers only allow audio after a user gesture: create the context on the first one. */
function unlock() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return;
  }
  const AC = W.AudioContext || W.webkitAudioContext;
  if (!AC) return;
  ctx = /** @type {AudioContext} */ (new AC());
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
}
for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, unlock, { capture: true, passive: true });

/** Synthesise a sound once (jsfxr), then reuse its buffer. */
function bufferFor(/** @type {string} */ code) {
  let buf = buffers.get(code);
  if (buf || !ctx) return buf ?? null;
  const sfxr = W.jsfxr?.sfxr;
  if (!code || !sfxr) return null;
  try {
    buf = /** @type {AudioBuffer} */ (sfxr.toWebAudio(code, ctx).buffer);
    // jsfxr's output peaks anywhere from ~0.7 to ~3 (clipping). Normalise every
    // sound to the same peak so only the cue's vol decides how loud a moment is.
    const data = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.9 / peak;
    buffers.set(code, buf);
    return buf;
  } catch {
    return null;
  }
}

/**
 * Play one moment's sound and haptic.
 * @param {Cue} name
 * @param {{ pitch?: number, vol?: number, buzz?: boolean }} [opts] pitch: playback rate (combo steps rise); vol: extra scale; buzz: false plays the sound without its haptic
 */
function cue(name, opts = {}) {
  const c = soundFor(name);
  if (!c) return;
  if (opts.buzz !== false) buzz(c.buzz);
  if (!settings.sound || !ctx || !master || ctx.state !== "running") return;
  const buf = bufferFor(c.code);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = opts.pitch ?? 1;
  const gain = ctx.createGain();
  gain.gain.value = c.vol * (opts.vol ?? 1);
  src.connect(gain).connect(master);
  src.start();
}

/** Turn sound / haptics on or off (from the settings sheet). */
function configure(/** @type {{ sound?: boolean, haptics?: boolean }} */ next) {
  Object.assign(settings, next);
  if (!settings.haptics && "vibrate" in navigator) {
    try { navigator.vibrate(0); } catch {}
  }
}

/** A long, unmistakable buzz for the settings' Test button; false if the browser refused it. */
function testBuzz() {
  buzzUntil = 0;
  return buzz([200, 100, 200]);
}

/** Play this game's set first (Ploto's own after). */
function setGame(/** @type {string} */ id) { game = id; }

W.MM_FEEDBACK = { cue, configure, testBuzz, setGame, canVibrate: "vibrate" in navigator };
})();
