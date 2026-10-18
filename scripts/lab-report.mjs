// Pull real match data from a running server's Monster Lab and print a tier list
// next to the bot-simulated one. Balance data only (monsters, matchups, teams).
//
// Usage: LAB_URL=https://ploto-server.onrender.com LAB_KEY=... npm run lab
//        (env: INCLUDE_BOT=1 to count practice games, VERSION=all for every patch, MIN=5)
const base = (process.env.LAB_URL ?? "http://localhost:8080").replace(/\/$/, "");
const key = process.env.LAB_KEY;
if (!key) {
  console.error("Set LAB_KEY (the server's STATS_KEY).");
  process.exit(1);
}
const params = new URLSearchParams();
if (process.env.INCLUDE_BOT === "1") params.set("includeBot", "1");
if (process.env.VERSION) params.set("version", process.env.VERSION);
const min = Number(process.env.MIN ?? 5);

async function lab(path, extra = {}) {
  const q = new URLSearchParams({ ...Object.fromEntries(params), ...extra });
  const res = await fetch(`${base}/api/monster-lab${path}?${q}`, { headers: { "x-lab-key": key } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path}: ${body.error ?? res.status}`);
  return body;
}

const pct = (x) => (x == null ? "  –  " : `${(100 * x).toFixed(1).padStart(5)}%`);
const [summary, monsters, matchups, teams] = await Promise.all([
  lab("/summary"),
  lab("/monsters"),
  lab("/matchups", { min: String(min) }),
  lab("/teams", { min: String(min) }),
]);

console.log(`\nMONSTER LAB — ${base}`);
console.log(`patch ${summary.balanceVersion} · ${summary.matches} matches${summary.includeBot ? " (incl. practice)" : " (PvP only)"} · first player wins ${pct(summary.firstPlayerWinRate)} · avg ${summary.avgMoves ?? "–"} moves\n`);
if (!summary.matches) {
  console.log("No matches yet for this filter. Play some games (or try INCLUDE_BOT=1 / VERSION=all).");
  process.exit(0);
}

console.log("MONSTERS (win rate, games, avg evolution)");
for (const m of monsters) {
  const noisy = m.games < min ? "  ← few games" : "";
  console.log(`  ${m.monster.padEnd(15)} ${pct(m.winRate)}  ${String(m.games).padStart(4)} games  ★${m.avgEvolution.toFixed(2)}${noisy}`);
}

const lopsided = matchups.filter((m) => m.winRate >= 0.7).sort((a, b) => b.winRate - a.winRate).slice(0, 10);
if (lopsided.length) {
  console.log(`\nMOST LOPSIDED MATCHUPS (≥${min} games)`);
  for (const m of lopsided) console.log(`  ${m.monster} beats ${m.opponent}: ${pct(m.winRate)} over ${m.games}`);
}

if (teams.length) {
  console.log(`\nTEAMS (≥${min} games)`);
  for (const t of teams.slice(0, 10)) console.log(`  ${t.team.join(" + ").padEnd(32)} ${pct(t.winRate)}  ${t.games} games`);
}
console.log("\nCompare with the bot simulation: npm run tiers");
