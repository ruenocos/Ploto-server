// Balance simulator: plays N matches with a greedy bot (prefers matches that
// charge its own monsters) and reports match length, first-player edge, and
// win share per element. Usage: npm run sim  (env: N=600 SEED=777)
import { MatchMonstersGame } from '../dist/game/matchmonsters/engine.js';
import { findMatches, isMovable } from '../dist/game/matchmonsters/board.js';
import { MONSTERS } from '../dist/game/matchmonsters/monsters.js';
const ids = Object.keys(MONSTERS);
let seed = Number(process.env.SEED ?? 777);
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function team() { const a = ids[Math.floor(rng()*ids.length)]; let b; do { b = ids[Math.floor(rng()*ids.length)]; } while (b === a); return [MONSTERS[a], MONSTERS[b]]; }
function bestMove(g) {
  const s = g.state, b = s.board, me = s.players[s.turn]; const els = new Set(me.monsters.map(m => m.def.element));
  let best = null, bestScore = -1;
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) for (const [dx, dy] of [[1,0],[0,1]]) {
    const nx = x+dx, ny = y+dy; if (nx >= b.width || ny >= b.height) continue;
    if (!isMovable(b, x, y, s.ice) || !isMovable(b, nx, ny, s.ice)) continue;
    const t = b.grid[y][x]; b.grid[y][x] = b.grid[ny][nx]; b.grid[ny][nx] = t;
    const m = findMatches(b); let score = 0;
    for (const c of m) score += els.has(c.element) ? 3 : (c.element === 'berry' ? 2 : 1);
    b.grid[ny][nx] = b.grid[y][x]; b.grid[y][x] = t;
    if (m.length && score > bestScore) { bestScore = score; best = { from: { x, y }, to: { x: nx, y: ny } }; }
  }
  return best;
}
const N = Number(process.env.N ?? 600); let fin = 0, moves = 0, turns = 0, lens = [], firstWins = 0; const elWins = {}, elGames = {};
for (let i = 0; i < N; i++) {
  const t0 = team(), t1 = team();
  const g = new MatchMonstersGame({ matchId: 's', seed: (rng()*1e9)|0, players: [{ peerId: '0', displayName: 'A', monsters: t0 }, { peerId: '1', displayName: 'B', monsters: t1 }] });
  let n = 0, tc = 0, last = g.state.turn;
  while (g.state.phase !== 'finished' && n < 600) {
    const mv = bestMove(g); if (!mv) break;
    const r = g.applyMove(g.state.turn, { type: 'swap', ...mv }); if (!r.ok) break; n++;
    if (g.state.turn !== last) { tc++; last = g.state.turn; }
  }
  if (g.state.phase === 'finished') {
    fin++; moves += n; turns += tc; lens.push(n); if (g.state.winner === 0) firstWins++;
    const wt = g.state.winner === 0 ? t0 : t1;
    for (const tm of [t0, t1]) for (const m of tm) elGames[m.element] = (elGames[m.element] ?? 0) + 1;
    for (const m of wt) elWins[m.element] = (elWins[m.element] ?? 0) + 1;
  }
}
lens.sort((a,b)=>a-b);
console.log(`finished ${fin}/${N} | moves avg ${(moves/fin).toFixed(1)} median ${lens[lens.length>>1]} p10 ${lens[Math.floor(lens.length*0.1)]} p90 ${lens[Math.floor(lens.length*0.9)]} | turn-changes avg ${(turns/fin).toFixed(1)} | p0 wins ${(100*firstWins/fin).toFixed(0)}%`);
console.log('win share by element (wins/appearances):', Object.fromEntries(Object.keys(elGames).map(k => [k, (elWins[k]/elGames[k]).toFixed(2)])));
