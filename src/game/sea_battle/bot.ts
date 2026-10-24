/**
 * Sea Battle's bots. They only use what a player could know: their own view
 * of the rival's sea (misses, hits, water, sunk ships) and which ships are
 * still afloat.
 *
 *   hard    counts every way each remaining ship could still lie and fires
 *           where ships fit most often; once it has a hit it only counts the
 *           ways that pass through it, so it finishes ships fast. It knows
 *           that the corners around a hit are water (ships can't touch).
 *   medium  hunts on a checkerboard with some randomness, follows up a hit
 *           around it (and along the line once it has two), but now and then
 *           wanders off or tries a corner, so it can be beaten.
 */
import { Mark, SHIPS, type RandomSource, type SeaView } from "./engine.js";

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
  const c = pickMax(scores, (k) => marks[k] === Mark.Unknown, random);
  if (c === undefined) return anyOpen(view, random);
  return [c % n, Math.floor(c / n)];
}

function mediumShot(view: SeaView, random: RandomSource): [number, number] {
  const n = view.size;
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && view.outgoing[y * n + x] === Mark.Unknown;
  const hits = openHits(view);
  if (hits.length && random() < 0.85) {
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
    // Now and then it tries a corner by a hit (a real player's mistake: ships can't touch).
    if (random() < 0.12) for (const [x, y] of pts) for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]] as const) if (open(x + dx, y + dy)) candidates.push([x + dx, y + dy]);
    if (candidates.length) return candidates[Math.floor(random() * candidates.length)]!;
  }
  // Hunting: mostly a checkerboard (every ship covers one), sometimes anywhere.
  const all: [number, number][] = [];
  const parity: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (open(x, y)) { all.push([x, y]); if ((x + y) % 2 === 0) parity.push([x, y]); }
  const pool = parity.length && random() < 0.75 ? parity : all;
  return pool[Math.floor(random() * pool.length)] ?? anyOpen(view, random);
}

function anyOpen(view: SeaView, random: RandomSource): [number, number] {
  const n = view.size;
  const open = view.outgoing.flatMap((m, c) => (m === Mark.Unknown ? [c] : []));
  const c = open[Math.floor(random() * open.length)]!;
  return [c % n, Math.floor(c / n)];
}
