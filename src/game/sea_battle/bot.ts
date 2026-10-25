/**
 * Sea Battle's bots. They only use what a player could know: their own view
 * of the rival's sea (misses, hits, water, sunk ships) and which ships are
 * still afloat.
 *
 *   hard    counts every way each remaining ship could still lie and fires
 *           where ships fit most often (some shots are one of its top few
 *           rather than the very best, so a good player can win); once it has a hit it only
 *           counts the ways that pass through it, so it finishes ships fast.
 *           It knows the corners around a hit are water (ships can't touch),
 *           and hides its own fleet where ships are least likely to be.
 *   medium  finishes ships like a person (around a hit, then along the line)
 *           but hunts loosely, anywhere on the sea. It never makes a shot that
 *           looks broken; it's beatable because it finds ships late.
 */
import { BOARDS, Mark, SHIPS, randomFleet, type BoardSpec, type Fleet, type RandomSource, type SeaView, cellsOf } from "./engine.js";

export type BotLevel = "medium" | "hard";

/** The cell the bot fires at next. */
export function chooseShot(view: SeaView, level: BotLevel, random: RandomSource): [number, number] {
  return level === "hard" ? hardShot(view, random) : mediumShot(view, random);
}

/** Lengths of the rival's ships still afloat. */
function afloat(view: SeaView): number[] {
  const left = [...view.fleetKinds];
  for (const k of view.rivalSunk) left.splice(left.indexOf(k), 1);
  return left.map((k) => SHIPS[k].length);
}

/** Hits that belong to ships not yet sunk. */
function openHits(view: SeaView): number[] {
  const n = view.size;
  const sunk = new Set(view.rivalShips.flatMap((p) => Array.from({ length: SHIPS[p.kind].length }, (_, i) => (p.dir === "h" ? p.y * n + p.x + i : (p.y + i) * n + p.x))));
  return view.outgoing.flatMap((m, c) => (m === Mark.Hit && !sunk.has(c) ? [c] : []));
}

function pickMax(scores: Float64Array, ok: (c: number) => boolean, random: RandomSource): number {
  let best = -1;
  let ties: number[] = [];
  for (let c = 0; c < scores.length; c++) {
    if (!ok(c)) continue;
    const s = scores[c]!;
    if (s > best + 1e-9) { best = s; ties = [c]; }
    else if (Math.abs(s - best) <= 1e-9) ties.push(c);
  }
  return ties[Math.floor(random() * ties.length)]!;
}

/** One of the `n` best cells, at random. */
function pickTop(scores: Float64Array, ok: (c: number) => boolean, n: number, random: RandomSource): number | undefined {
  const cells = [...scores.keys()].filter(ok).sort((a, b) => scores[b]! - scores[a]!).slice(0, n);
  return cells[Math.floor(random() * cells.length)];
}

/** How often a ship could cover each cell of an empty board (the density a hunter starts from). */
function emptyDensity(spec: BoardSpec): Float64Array {
  const n = spec.size, d = new Float64Array(n * n);
  for (const kind of spec.fleet) {
    const len = SHIPS[kind].length;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (x + len <= n) for (let i = 0; i < len; i++) d[y * n + x + i]! += 1;
      if (y + len <= n) for (let i = 0; i < len; i++) d[(y + i) * n + x]! += 1;
    }
  }
  return d;
}

/** How hard a fleet is to find: 0 (where hunters look first) to 1 (where they look last). */
export function hiding(spec: BoardSpec, fleet: Fleet): number {
  const d = emptyDensity(spec);
  const max = Math.max(...d), min = Math.min(...d);
  const cells = fleet.flatMap((p) => cellsOf(p).map(([x, y]) => d[y * spec.size + x]!));
  const avg = cells.reduce((a, b) => a + b, 0) / cells.length;
  return Math.max(0, Math.min(1, (max - avg) / (max - min)));
}

/**
 * A bot's fleet. Hard usually hides it well (any layout at least half as hidden as
 * it gets, picked at random, so "it hugs the edges" isn't a sure tell) and one game
 * in four takes any layout; Medium takes any.
 */
export function botFleet(board: keyof typeof BOARDS, level: BotLevel, random: RandomSource): Fleet {
  const spec = BOARDS[board];
  if (level !== "hard" || random() < 0.25) return randomFleet(spec, random);
  for (let i = 0; i < 60; i++) {
    const f = randomFleet(spec, random);
    if (hiding(spec, f) >= 0.5) return f;
  }
  return randomFleet(spec, random);
}

function hardShot(view: SeaView, random: RandomSource): [number, number] {
  const n = view.size;
  const marks = [...view.outgoing];
  const hits = openHits(view);
  // Ships can't touch: the corners around a hit are water.
  for (const c of hits) {
    const x = c % n, y = Math.floor(c / n);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < n && ny < n && marks[ny * n + nx] === Mark.Unknown) marks[ny * n + nx] = Mark.Water;
    }
  }
  const hitSet = new Set(hits);
  const scores = new Float64Array(n * n);
  for (const len of afloat(view)) {
    for (const dir of ["h", "v"] as const) {
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if ((dir === "h" ? x + len : y + len) > n) continue;
          const cells: number[] = [];
          let covered = 0, blocked = false;
          for (let i = 0; i < len && !blocked; i++) {
            const c = dir === "h" ? y * n + x + i : (y + i) * n + x;
            const m = marks[c];
            if (m === Mark.Miss || m === Mark.Water || (m === Mark.Hit && !hitSet.has(c))) blocked = true;
            else { cells.push(c); if (m === Mark.Hit) covered++; }
          }
          if (blocked) continue;
          if (hits.length && !covered) continue; // finishing a ship: only placements through its hits
          const w = hits.length ? covered * covered : 1;
          for (const c of cells) if (marks[c] === Mark.Unknown) scores[c]! += w;
        }
      }
    }
  }
  const open = (k: number) => marks[k] === Mark.Unknown;
  // Hunting, it sometimes takes its second or third choice (finishing a ship, never).
  // Hunting it sometimes takes one of its top few cells; finishing a ship, sometimes its second best.
  const c = !hits.length ? (random() < 0.3 ? pickTop(scores, open, 4, random) : pickMax(scores, open, random)) : random() < 0.3 ? pickTop(scores, open, 2, random) : pickMax(scores, open, random);
  if (c === undefined) return anyOpen(view, random);
  return [c % n, Math.floor(c / n)];
}

function mediumShot(view: SeaView, random: RandomSource): [number, number] {
  const n = view.size;
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && view.outgoing[y * n + x] === Mark.Unknown;
  const hits = openHits(view);
  if (hits.length) {
    const pts = hits.map((c) => [c % n, Math.floor(c / n)] as const);
    const candidates: [number, number][] = [];
    if (pts.length >= 2 && (pts.every((p) => p[1] === pts[0]![1]) || pts.every((p) => p[0] === pts[0]![0]))) {
      // Two or more in a line: try the ends.
      const horizontal = pts.every((p) => p[1] === pts[0]![1]);
      const along = pts.map((p) => (horizontal ? p[0] : p[1]));
      const lo = Math.min(...along) - 1, hi = Math.max(...along) + 1;
      for (const v of [lo, hi]) {
        const [x, y] = horizontal ? [v, pts[0]![1]] : [pts[0]![0], v];
        if (open(x, y)) candidates.push([x, y]);
      }
    }
    if (!candidates.length) {
      for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (open(x + dx, y + dy)) candidates.push([x + dx, y + dy]);
    }
    if (candidates.length) return candidates[Math.floor(random() * candidates.length)]!;
  }
  // Hunting: anywhere, like most people; now and then on a checkerboard (every ship covers one).
  const all: [number, number][] = [];
  const parity: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (open(x, y)) { all.push([x, y]); if ((x + y) % 2 === 0) parity.push([x, y]); }
  const pool = parity.length && random() < 0.1 ? parity : all;
  return pool[Math.floor(random() * pool.length)] ?? anyOpen(view, random);
}

function anyOpen(view: SeaView, random: RandomSource): [number, number] {
  const n = view.size;
  const open = view.outgoing.flatMap((m, c) => (m === Mark.Unknown ? [c] : []));
  const c = open[Math.floor(random() * open.length)]!;
  return [c % n, Math.floor(c / n)];
}
