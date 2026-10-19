// Duo stats: which pairs win most, and which rise above their parts.
//
// Random team vs random team, greedy bots on both sides that evolve whenever
// they can (as in monster-tiers.mjs). For every pair: its win rate, and its
// synergy = win rate minus what its two monsters' solo win rates predict
// (the mean of both), so a strong duo of two strong monsters doesn't count
// as synergy.
//
// Usage: npm run duos   (env: N=20000 SEED=777 OUT=file.json to dump raw counts)
//        Several runs with different SEEDs can be merged: MERGE=a.json,b.json node scripts/duo-sim.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { MatchMonstersGame } from '../dist/game/matchmonsters/engine.js';
import { chooseEvolution, chooseMove } from '../dist/game/matchmonsters/bot.js';
import { MONSTERS } from '../dist/game/matchmonsters/monsters.js';

const ids = Object.keys(MONSTERS);
let seed = Number(process.env.SEED ?? 777);
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (exclude = []) => { let id; do { id = ids[Math.floor(rng() * ids.length)]; } while (exclude.includes(id)); return id; };
const key = (a, b) => [a, b].sort().join('+');

function play(teams, gameSeed) {
  const g = new MatchMonstersGame({
    matchId: 's', seed: gameSeed,
    players: teams.map((t, i) => ({ peerId: String(i), displayName: String(i), monsters: t.map((id) => MONSTERS[id]) })),
  });
  for (let n = 0; g.state.phase !== 'finished' && n < 600; n++) {
    const s = g.state;
    const evolveId = chooseEvolution(g, s.turn);
    if (evolveId) g.evolve(s.turn, evolveId);
    const mv = chooseMove(g, g.state.turn); if (!mv) break;
    if (!g.applyMove(s.turn, mv).ok) break;
  }
  return g.state.phase === 'finished' ? g.state.winner : null;
}

let solo = {}, pair = {};
if (process.env.MERGE) {
  for (const f of process.env.MERGE.split(',')) {
    const d = JSON.parse(readFileSync(f, 'utf8'));
    for (const [k, [w, n]] of Object.entries(d.solo)) { solo[k] ??= [0, 0]; solo[k][0] += w; solo[k][1] += n; }
    for (const [k, [w, n]] of Object.entries(d.pair)) { pair[k] ??= [0, 0]; pair[k][0] += w; pair[k][1] += n; }
  }
} else {
  const N = Number(process.env.N ?? 20000);
  for (let i = 0; i < N; i++) {
    const a = pick(), b = pick([a]), c = pick(), d = pick([c]);
    const teams = [[a, b], [c, d]];
    const w = play(teams, (rng() * 1e9) | 0);
    if (w === null) continue;
    teams.forEach((t, s) => {
      const won = s === w ? 1 : 0;
      for (const id of t) { solo[id] ??= [0, 0]; solo[id][0] += won; solo[id][1]++; }
      const k = key(...t); pair[k] ??= [0, 0]; pair[k][0] += won; pair[k][1]++;
    });
  }
  if (process.env.OUT) { writeFileSync(process.env.OUT, JSON.stringify({ solo, pair })); process.exit(0); }
}

const name = (id) => MONSTERS[id].name;
const pct = (x) => (100 * x).toFixed(1).padStart(5) + '%';
const sgn = (x) => ((x >= 0 ? '+' : '') + (100 * x).toFixed(1)).padStart(6);
const rate = (id) => solo[id][0] / solo[id][1];
const rows = Object.entries(pair).map(([k, [w, n]]) => {
  const [a, b] = k.split('+');
  const r = w / n;
  return { a, b, r, n, syn: r - (rate(a) + rate(b)) / 2 };
});
const noise = 100 / Math.sqrt(rows.reduce((s, x) => s + x.n, 0) / rows.length);
const line = (x) => `  ${(name(x.a) + ' + ' + name(x.b)).padEnd(24)} ${pct(x.r)}  synergy ${sgn(x.syn)}   (${x.n} games)`;
console.log(`\n${rows.length} pairs, ~${Math.round(rows.reduce((s, x) => s + x.n, 0) / rows.length)} games each (noise about ±${noise.toFixed(1)} points)\n`);
console.log('STRONGEST DUOS (win rate)');
rows.sort((x, y) => y.r - x.r).slice(0, 12).forEach((x) => console.log(line(x)));
console.log('\nBEST SYNERGY (better together than apart)');
[...rows].sort((x, y) => y.syn - x.syn).slice(0, 12).forEach((x) => console.log(line(x)));
console.log('\nWORST SYNERGY (worse together than apart)');
[...rows].sort((x, y) => x.syn - y.syn).slice(0, 8).forEach((x) => console.log(line(x)));
console.log('\nWEAKEST DUOS (win rate)');
rows.sort((x, y) => x.r - y.r).slice(0, 8).forEach((x) => console.log(line(x)));
