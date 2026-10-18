// @ts-check
/**
 * Sound and haptics: one `cue(event)` per game moment, called at the exact
 * moment its visual happens, so sound, vibration and animation land together.
 * Small, frequent events get a light touch; big moments get stronger,
 * patterned ones.
 *
 * Sounds are jsfxr stock presets (generated once by scripts/gen-sounds.mjs
 * into web/sounds.js) synthesised here into Web Audio buffers on first use.
 * Haptics use the Vibration API where the device has it (Android; iOS Safari
 * has none, so there the sound and visuals carry the cue on their own).
 */

(() => {
/** @typedef {"select" | "swap" | "match" | "ready" | "cast" | "hit" | "bigHit" | "heal" | "turn" | "evolve" | "ko" | "win"} Cue */

/**
 * What each moment sounds and feels like. `vol` is relative (0..1);
 * `buzz` is a vibration pattern in ms (on, off, on, ...).
 * @type {Record<Cue, { sound: string, vol: number, buzz: number | number[] }>}
 */
const CUES = {
  select: { sound: "select", vol: 0.35, buzz: 5 },
  swap: { sound: "swap", vol: 0.4, buzz: 8 },
  match: { sound: "match", vol: 0.45, buzz: 12 },
  ready: { sound: "ready", vol: 0.5, buzz: [15, 30, 15] },
  cast: { sound: "cast", vol: 0.6, buzz: 25 },
  hit: { sound: "hit", vol: 0.6, buzz: 30 },
  bigHit: { sound: "bigHit", vol: 0.7, buzz: [40, 30, 60] },
  heal: { sound: "heal", vol: 0.45, buzz: 15 },
  turn: { sound: "turn", vol: 0.6, buzz: [30, 60, 30] },
  evolve: { sound: "evolve", vol: 0.7, buzz: [20, 40, 20, 40, 60] },
  ko: { sound: "ko", vol: 0.7, buzz: 80 },
  win: { sound: "evolve", vol: 0.7, buzz: [30, 50, 30, 50, 80] },
};

const W = /** @type {any} */ (window);
const settings = { sound: true, haptics: true };
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
function bufferFor(/** @type {string} */ name) {
  let buf = buffers.get(name);
  if (buf || !ctx) return buf ?? null;
  const code = W.MM_SOUNDS?.[name];
  const sfxr = W.jsfxr?.sfxr;
  if (!code || !sfxr) return null;
  try {
    buf = /** @type {AudioBuffer} */ (sfxr.toWebAudio(code, ctx).buffer);
    // jsfxr's output peaks anywhere from ~0.7 to ~3 (clipping). Normalise every
    // sound to the same peak so only CUES[].vol decides how loud a moment is.
    const data = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.9 / peak;
    buffers.set(name, buf);
    return buf;
  } catch {
    return null;
  }
}

/**
 * Play one moment's sound and haptic.
 * @param {Cue} name
 * @param {{ pitch?: number, vol?: number }} [opts] pitch: playback rate (combo steps rise); vol: extra scale
 */
function cue(name, opts = {}) {
  const c = CUES[name];
  if (!c) return;
  if (settings.haptics && "vibrate" in navigator) {
    try { navigator.vibrate(c.buzz); } catch {}
  }
  if (!settings.sound || !ctx || !master || ctx.state !== "running") return;
  const buf = bufferFor(c.sound);
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

W.MM_FEEDBACK = { cue, configure, canVibrate: "vibrate" in navigator };
})();
