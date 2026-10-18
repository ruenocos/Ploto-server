/**
 * Are row / column / area blasts really random? Plays bot matches with the
 * blasting monsters at every evolution stage and tallies where their blasts
 * land, then runs a chi-square test on the placement.
 *
 *   npm run blasts          (N=600 matches per monster; SEED=…)
 *
 * Two different questions:
 *  - placement: is every possible start position equally likely? (should be)
 *  - coverage: is every row equally likely to be *hit*? A 2-row blast can
 *    start at rows 0-5 on a 7-row board, so the middle rows are inside more
 *    of those positions than the edge rows are.
 */
import { MatchMonstersGame } from "../dist/game/matchmonsters/engine.js";
import { chooseEvolution, chooseMove } from "../dist/game/matchmonsters/bot.js";
import { MONSTERS } from "../dist/game/matchmonsters/monsters.js";

const N = Number(process.env.N ?? 600);
let seed = Number(process.env.SEED ?? 4242);
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ids = Object.keys(MONSTERS);
const blasters = ids.filter((id) => MONSTERS[id].ability.effects.some((e) => e.kind === "match"));

/** chi-square statistic and an approximate p-value (Wilson–Hilferty), for counts vs a uniform expectation. */
function chiSquare(counts) {
  const n = counts.reduce((a, b) => a + b, 0), k = counts.length, exp = n / k;
  const x2 = counts.reduce((s, c) => s + (c - exp) ** 2 / exp, 0);
  const df = k - 1;
  const z = (Math.cbrt(x2 / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  const p = 0.5 * erfc(z / Math.SQRT2);
  return { x2, df, p };
}
function erfc(x) { // Numerical Recipes approximation
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const r = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/** key `${shape}:${size}` -> { starts: Map(pos -> n), cover: number[] (per row/col), W, H } */
const tallies = new Map();
for (const id of blasters) {
  for (let i = 0; i < N; i++) {
    const evo = i % 3; // every stage equally
    const partner = ids.find((x) => x !== id && !blasters.includes(x)) ?? ids[0];
    const foe = [ids[(i * 7) % ids.length], ids[(i * 11 + 3) % ids.length]];
    if (foe[0] === foe[1]) foe[1] = ids[(ids.indexOf(foe[0]) + 1) % ids.length];
    const g = new MatchMonstersGame({
      matchId: "b", seed: (rng() * 1e9) | 0,
      players: [[id, partner], foe].map((t, s) => ({ peerId: String(s), displayName: String(s), monsters: t.map((m) => MONSTERS[m]) })),
    });
    g.state.players[0].monsters[0].evolution = evo;
    for (let n = 0; g.state.phase !== "finished" && n < 400; n++) {
      const s = g.state.turn;
      const ev = chooseEvolution(g, s); if (ev) g.evolve(s, ev);
      const mv = chooseMove(g, s); if (!mv) break;
      const r = g.applyMove(s, mv);
      if (!r.ok) break;
      for (const cast of r.casts ?? []) {
        if (cast.monsterId !== MONSTERS[id].id) continue;
        for (const e of cast.effects ?? []) {
          if (e.kind !== "match" || !e.cells.length) continue;
          const xs = e.cells.map((c) => c.x), ys = e.cells.map((c) => c.y);
          const W = g.state.board.width, H = g.state.board.height;
          const x0 = Math.min(...xs), y0 = Math.min(...ys);
          const size = e.shape === "row" ? new Set(ys).size : e.shape === "col" ? new Set(xs).size : Math.max(new Set(xs).size, new Set(ys).size);
          const key = `${e.shape}:${size}`;
          let t = tallies.get(key);
          if (!t) tallies.set(key, (t = { starts: new Map(), cover: Array(e.shape === "col" ? W : H).fill(0), W, H, shape: e.shape, size }));
          const pos = e.shape === "row" ? y0 : e.shape === "col" ? x0 : `${x0},${y0}`;
          t.starts.set(pos, (t.starts.get(pos) ?? 0) + 1);
          if (e.shape === "row") for (const y of new Set(ys)) t.cover[y]++;
          if (e.shape === "col") for (const x of new Set(xs)) t.cover[x]++;
        }
      }
    }
  }
}

console.log(`\nBlast placement over ${N} bot matches per blasting monster (${blasters.map((id) => MONSTERS[id].name).join(", ")})\n`);
for (const [key, t] of [...tallies].sort()) {
  const span = t.shape === "col" ? t.W : t.H;
  const positions = t.shape === "row" || t.shape === "col"
    ? Array.from({ length: Math.max(1, span - t.size + 1) }, (_, i) => i)
    : Array.from({ length: Math.max(1, t.H - t.size + 1) }, (_, y) => Array.from({ length: Math.max(1, t.W - t.size + 1) }, (_, x) => `${x},${y}`)).flat();
  const counts = positions.map((p) => t.starts.get(p) ?? 0);
  const n = counts.reduce((a, b) => a + b, 0);
  const { x2, df, p } = chiSquare(counts);
  console.log(`${key.padEnd(9)} ${String(n).padStart(5)} blasts   start positions: ${counts.map((c) => (c / n * 100).toFixed(0).padStart(3) + "%").join(" ")}`);
  console.log(`${"".padEnd(9)} chi²=${x2.toFixed(1)} df=${df}  p=${p.toFixed(3)}  ${p > 0.01 ? "✓ uniform" : "✗ NOT uniform"}`);
  if (t.shape === "row" || t.shape === "col") {
    const hits = t.cover.map((c) => (c / n * 100).toFixed(0).padStart(3) + "%");
    console.log(`${"".padEnd(9)} chance each ${t.shape === "row" ? "row" : "column"} is hit: ${hits.join(" ")}`);
  }
}
