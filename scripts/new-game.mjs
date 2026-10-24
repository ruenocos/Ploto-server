#!/usr/bin/env node
/**
 * Scaffold a new Ploto game from templates/game (docs/NEW_GAME.md):
 *
 *   node scripts/new-game.mjs <id> "<Title>"     e.g.  node scripts/new-game.mjs tap_race "Tap Race"
 *
 * Writes src/game/<id>/{room,lobby}.ts, web/<slug>.html, web/<slug>.card.js and
 * test/<id>.test.ts, and adds the game to src/games.ts. The result is a working
 * (placeholder) game with the platform's lobby: run `npm test`, `npm run dev`
 * and open /play/<slug>. Then replace the template game with the real one.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [id, title] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9_]{1,23}$/.test(id) || !title) {
  console.error('usage: node scripts/new-game.mjs <id: lowercase, digits, _> "<Title>"');
  process.exit(1);
}
const slug = id.replace(/_/g, "-");
const cls = id.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const prefix = id.replace(/_/g, "") + ":";
const sub = (text) => text.replaceAll("__ID__", id).replaceAll("__SLUG__", slug).replaceAll("__CLASS__", cls).replaceAll("__PREFIX__", prefix).replaceAll("__TITLE__", title);

const registry = path.join(root, "src/games.ts");
const reg = fs.readFileSync(registry, "utf8");
if (reg.includes(`id: "${id}"`)) { console.error(`${id} is already in src/games.ts`); process.exit(1); }

const out = [
  ["room.ts", `src/game/${id}/room.ts`],
  ["lobby.ts", `src/game/${id}/lobby.ts`],
  ["page.html", `web/${slug}.html`],
  ["card.js", `web/${slug}.card.js`],
  ["test.ts", `test/${id}.test.ts`],
];
for (const [, to] of out) if (fs.existsSync(path.join(root, to))) { console.error(`${to} already exists`); process.exit(1); }
for (const [from, to] of out) {
  fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
  fs.writeFileSync(path.join(root, to), sub(fs.readFileSync(path.join(root, "templates/game", from), "utf8")));
  console.log("wrote", to);
}

const entry = `  {
    id: "${id}", title: ${JSON.stringify(title)}, path: "/play/${slug}", page: "${slug}.html", card: "${slug}.card.js",
    players: "2–4 players", minSeats: 2, maxSeats: 4, badge: "NEW",
    lobby: (ctx) => new ${cls}Lobby(ctx),
  },
  // new games go above this line`;
const next = reg
  .replace("  // new games go above this line", entry)
  .replace("\nexport interface GameEntry", `import { ${cls}Lobby } from "./game/${id}/lobby.js";\n\nexport interface GameEntry`)
  .replace(`lobby.js";\nimport { ${cls}Lobby }`, `lobby.js";\nimport { ${cls}Lobby }`);
fs.writeFileSync(registry, next.replace(/\n\nimport \{ (\w+)Lobby \} from "\.\/game\/(\w+)\/lobby\.js";\n\n/, '\nimport { $1Lobby } from "./game/$2/lobby.js";\n\n'));
console.log("added", id, "to src/games.ts");
console.log(`\nNext: npm test, npm run dev, open /play/${slug}. Then follow docs/NEW_GAME.md from "Build the game".`);
