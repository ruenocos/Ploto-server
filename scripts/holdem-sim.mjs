// Hold'em Sit & Go simulator: N bot games for every seat count (2–6) and
// starting stack (500/1000/2000/5000), blinds up every 10 hands. Reports game
// length (average and p90 hands), bust-order sanity (places 1..n once each,
// winner holds every chip), bot decision time, and how often the normal bot
// beats the easy one (seats are split between the two levels).
// Usage: npm run holdem  (env: N=100 SEED=2026)
import { HoldemGame } from '../dist/game/holdem/engine.js';
import { chooseAction } from '../dist/game/holdem/bot.js';
import { Rng } from '../dist/game/matchmonsters/rng.js';

const N = Number(process.env.N ?? 100);
const rng = new Rng(Number(process.env.SEED ?? 2026));
const random = () => rng.next();
const STACKS = [500, 1000, 2000, 5000];
const pct = (x) => (100 * x).toFixed(1).padStart(5);
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const times = [];
let badEnds = 0, multiBusts = 0, totalHands = 0;
const rows = [];
let normalWins = 0, normalFair = 0, games = 0;

for (let n = 2; n <= 6; n++) {
  for (const chips of STACKS) {
    const lengths = [];
    let nWins = 0, nFair = 0;
    for (let g = 0; g < N; g++) {
      // Half the seats normal, half easy (odd tables alternate which gets the extra), in random seats.
      const levels = Array.from({ length: n }, (_, i) => ((i + g) % 2 === 0 ? 'normal' : 'easy'));
      for (let i = levels.length - 1; i > 0; i--) { const j = rng.int(i + 1); [levels[i], levels[j]] = [levels[j], levels[i]]; }
      const game = new HoldemGame({
        players: levels.map((_, i) => ({ id: `p${i}`, name: `P${i}`, bot: true })),
        startingChips: chips, blindsEveryHands: 10, random,
      });
      let hands = 0;
      while (game.phase !== 'gameOver' && hands < 5000) {
        game.startHand(); hands++;
        let busts = 0;
        while (game.toActId !== null) {
          const id = game.toActId;
          const seat = game.seat(id).seat;
          const t0 = performance.now();
          const action = chooseAction(game, id, random, { level: levels[seat] });
          times.push(performance.now() - t0);
          const r = game.act(id, action);
          if (!r.ok) throw new Error(`illegal bot action ${JSON.stringify(action)}: ${r.reason}`);
          busts += r.events.filter((e) => e.type === 'eliminated').length;
        }
        if (busts > 1) multiBusts++;
        if (game.chipsTotal() !== game.totalChips) throw new Error('chips not conserved');
      }
      const st = game.standings();
      const placesOk = st.every((s, i) => s.place === i + 1) && st[0].chips === game.totalChips;
      if (game.phase !== 'gameOver' || !placesOk) badEnds++;
      lengths.push(hands);
      totalHands += hands;
      const winner = game.seat(st[0].id).seat;
      if (levels[winner] === 'normal') nWins++;
      nFair += levels.filter((l) => l === 'normal').length / n;
    }
    games += N; normalWins += nWins; normalFair += nFair;
    rows.push({ n, chips, avg: lengths.reduce((a, b) => a + b, 0) / N, p90: quantile(lengths, 0.9), max: Math.max(...lengths), win: nWins / N, fair: nFair / N });
  }
}

console.log(`Hold'em Sit & Go sim: ${N} games per row, blinds every 10 hands, seats split normal/easy\n`);
console.log('seats  stack   avg hands  p90  max   normal wins  (fair share)');
for (const r of rows) {
  console.log(`${String(r.n).padStart(5)}  ${String(r.chips).padStart(5)}  ${r.avg.toFixed(1).padStart(9)}  ${String(r.p90).padStart(4)}  ${String(r.max).padStart(4)}    ${pct(r.win)}%       (${pct(r.fair)}%)`);
}
const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`\ngames ${games}, hands ${totalHands}, bad endings ${badEnds}, hands with 2+ busts ${multiBusts}`);
console.log(`normal bot won ${pct(normalWins / games)}% of games vs a fair share of ${pct(normalFair / games)}%`);
console.log(`bot decision: avg ${avgMs.toFixed(3)} ms, p99 ${quantile(times, 0.99).toFixed(3)} ms, max ${times.reduce((a, b) => Math.max(a, b), 0).toFixed(2)} ms over ${times.length} decisions`);
