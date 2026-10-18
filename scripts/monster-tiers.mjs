// Monster tier list: which monsters win most, and how much evolving each one helps.
//
//   1. Tier list — N matches between random teams, greedy bots on both sides that
//      evolve whenever they can. Reports each monster's win rate.
//   2. Evolution value — for each monster, M paired matches that are identical
//      (same seed, partner, opponent, seat) except the monster starts at ★0 in one
//      and fully evolved (★★) in the other. The win-rate gap is what evolving it is worth.
//
// Usage: npm run tiers   (env: N=6000 M=400 SEED=777)
import { MatchMonstersGame } from '../dist/game/matchmonsters/engine.js';
import { chooseEvolution, chooseMove } from '../dist/game/matchmonsters/bot.js';
import { MONSTERS } from '../dist/game/matchmonsters/monsters.js';

const ids = Object.keys(MONSTERS);
let seed = Number(process.env.SEED ?? 777);
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (exclude = []) => { let id; do { id = ids[Math.floor(rng() * ids.length)]; } while (exclude.includes(id)); return id; };


/** Play one match; returns the winner (0 | 1) or null if it stalled. */
function play(teams, gameSeed, startEvo = [[0, 0], [0, 0]]) {
  const g = new MatchMonstersGame({
    matchId: 's', seed: gameSeed,
    players: teams.map((t, i) => ({ peerId: String(i), displayName: String(i), monsters: t.map((id) => MONSTERS[id]) })),
  });
  g.state.players.forEach((p, i) => p.monsters.forEach((m, j) => { m.evolution = startEvo[i][j]; }));
  for (let n = 0; g.state.phase !== 'finished' && n < 600; n++) {
    const s = g.state;
    const evolveId = chooseEvolution(g, s.turn);
    if (evolveId) g.evolve(s.turn, evolveId);
    const mv = chooseMove(g, g.state.turn); if (!mv) break;
    if (!g.applyMove(s.turn, mv).ok) break;
  }
  return g.state.phase === 'finished' ? g.state.winner : null;
}

const name = (id) => MONSTERS[id].name.padEnd(10);
const el = (id) => MONSTERS[id].element.padEnd(6);
const pct = (x) => (100 * x).toFixed(1).padStart(5) + '%';

// ---------------------------------------------------------------- 1. tier list
const N = Number(process.env.N ?? 6000);
const wins = Object.fromEntries(ids.map((id) => [id, 0]));
const games = Object.fromEntries(ids.map((id) => [id, 0]));
for (let i = 0; i < N; i++) {
  const a = pick(), b = pick([a]), c = pick(), d = pick([c]);
  const teams = [[a, b], [c, d]];
  const w = play(teams, (rng() * 1e9) | 0);
  if (w === null) continue;
  for (const t of teams) for (const id of t) games[id]++;
  for (const id of teams[w]) wins[id]++;
}
const tiers = ids.map((id) => ({ id, rate: wins[id] / games[id], n: games[id] })).sort((x, y) => y.rate - x.rate);
const tierOf = (r) => (r >= 0.54 ? 'S' : r >= 0.515 ? 'A' : r >= 0.485 ? 'B' : r >= 0.46 ? 'C' : 'D');
console.log(`\nTIER LIST — win rate over ${N} bot matches (±~${(100 / Math.sqrt(tiers[0].n)).toFixed(1)}% noise)\n`);
for (const t of tiers) console.log(`  ${tierOf(t.rate)}  ${name(t.id)} ${el(t.id)} ${pct(t.rate)}   (${t.n} games)`);

// ---------------------------------------------------------------- 2. evolution value
const M = Number(process.env.M ?? 400);
if (M === 0) process.exit(0);
console.log(`\nEVOLUTION VALUE — win rate at base vs starting at ★★ (${M} paired matches each)\n`);
const evo = [];
for (const id of ids) {
  let base = 0, evolved = 0, n = 0;
  for (let i = 0; i < M; i++) {
    const partner = pick([id]), c = pick(), d = pick([c]);
    const seat = rng() < 0.5 ? 0 : 1;
    const teams = seat === 0 ? [[id, partner], [c, d]] : [[c, d], [id, partner]];
    const s = (rng() * 1e9) | 0;
    const evoStart = seat === 0 ? [[2, 0], [0, 0]] : [[0, 0], [2, 0]];
    const w0 = play(teams, s), w3 = play(teams, s, evoStart);
    if (w0 === null || w3 === null) continue;
    n++; if (w0 === seat) base++; if (w3 === seat) evolved++;
  }
  evo.push({ id, base: base / n, evolved: evolved / n, gain: (evolved - base) / n });
}
evo.sort((x, y) => y.gain - x.gain);
for (const e of evo) console.log(`  ${name(e.id)} ${el(e.id)} ${pct(e.base)} → ${pct(e.evolved)}   ${e.gain >= 0 ? '+' : ''}${(100 * e.gain).toFixed(1)} pts`);
