# Ploto — a clean-room Plato game server

A community reimplementation of the backend for Plato (`com.plato.android`), so
favourite games — **Match Monsters** first — stay playable after the official
service goes down. This is a preservation project: the server is written
independently from what the Plato client does *on the wire*, using open protocols
and libraries. It ships no Plato code or game assets.

> Status: early. The status endpoint, matchmaking, the protoo signaling front
> door, and a playable clean-room Match Monsters engine are in and tested. The
> exact in-game wire payloads and the voice SFU are the next pieces — see
> [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## What's here

| Area          | Module              | State                                                        |
| ------------- | ------------------- | ------------------------------------------------------------ |
| Status/health | `src/status`        | ✅ serves the exact `{"downtime":0,"reason":""}` document      |
| Matchmaking   | `src/matchmaking`   | ✅ waiting-pool pairing, keyed by game/mode/stake             |
| Signaling     | `src/signaling`     | ✅ protoo-over-WebSocket (framing matches the client exactly) |
| Match Monsters| `src/game/matchmonsters` | ✅ server-authoritative match-3 battle engine, seeded + replayable |
| Voice (mediasoup) | —               | ⏳ methods identified (stock mediasoup-demo); SFU to be wired |
| In-game payloads  | `src/signaling/gameRoom.ts` | ⏳ provisional `mm:*` methods until the game `client.zip` is mapped |

## How the real client talks to a server

Established clean-room, from DNS/Certificate-Transparency records, one health
check, and the open-source libraries the client embeds (full notes in
[`docs/PROTOCOL.md`](docs/PROTOCOL.md)):

- **Status** — `GET status-prod.platocorp.com/` → `{"downtime":0,"reason":""}`.
- **Real-time** — **protoo** signaling over a WebSocket (sub-protocol `protoo`,
  `?roomId=&peerId=`) with a **mediasoup** SFU for voice. The client is the
  stock `mediasoup-demo` Android client, so the methods and framing are the
  documented open ones — we build on the upstream libraries rather than
  reinventing them.
- **Games** — HTML5 bundles (`client.zip`) fetched from `games-prod.platocdn.com`
  and run in a WebView; the native app tunnels their messages over the real-time
  layer. Match Monsters' own message vocabulary lives in that bundle.

## Play with a friend (right now)

No Plato servers involved — this is a standalone, self-hosted game.

```bash
npm install
npm run dev        # web, status and WebSocket all on :8080
```

Then both of you open **`http://<the-host's-LAN-ip>:8080/play`** (the host can
use `http://localhost:8080/play`), or deploy it (see [`docs/DEPLOY.md`](docs/DEPLOY.md)).
Choose **Blind pick** (each picks two monsters in the lobby) or **Draft**, then
**Quick Play** (matched with anyone queuing in the same mode), **Bot**, or
**Friend** (a 4-character code + a share link, `/play?room=CODE`, that pre-fills
the code for them; the host's mode decides). No accounts needed.

**Draft.** Both players ban one monster at the same time (revealed together),
then pick in a snake: whoever moves second in the match picks first, 1-2-1.
Picks are unique and visible, so you can counter what your rival takes (which
kits beat or combo with which is for players to discover). Quick Play gives 20
seconds per step (then no ban or a random pick); friend rooms and bot practice
have no timer, and the bot drafts counters too.

**Accounts & friends.** Claim a username (no password: the server hands back a
secret key that stays in the browser's localStorage; copy it from your profile to
sign in on another device). Then add friends by username, chat with them, and
tap **Invite** to start a match without sharing codes. Your profile shows your
record and recent matches.

**Solo?** Tap **Bot**. In blind pick the bot takes a random team; it plays a
greedy (occasionally sloppy) game. Practice games add debug shortcuts under
the board: **+4 🍓** (evolve right away) and **⚡ Charge up** (both your
monsters fire on your next match). After any game, **Rematch** restarts with
the same teams, and the loser goes first.

### How a match plays

The screen is an arena on top (your two monsters on the left, the rival's on
the right, each with its element and charge under it) and the gem board below.
Monsters are rigged pixel sprites that idle part by part and react with stock
Animate.css presets: they wind up to cast, strike, flinch when hit, cheer on
heals and shields, wobble when slowed, and flash into their next stage when
they evolve. Tap one for its move, passive and evolution line.

- Drag a gem onto a neighbour to swap (or tap one, then the other). Any swap is allowed: one that makes no
  match just moves the tile (handy for setting up a combo) and still uses a move,
  so the board can never lock you in.
- Stuck? After 8 seconds without a move, the best swap on the board nudges.
- Every moment has a sound and, on phones that support it, a vibration. Settings (the sliders button in the lobby, ☰ in a match) turn sound, vibration and hints on or off, set the text size, and can force reduced motion.
- You get **2 moves per turn** (the opening player gets 1 on their first turn).
  A line of **4+** grants an extra move.
- Matching tiles **charges** your monsters of that element. At its charge cost a
  monster **fires its move** — damage plus a twist (see below).
- 🍓 **Berries** appear on the board; collect **4** to **evolve** a monster.
  Every monster has three stages (base, ★, ★★), each with its own sprite.
  Every evolution: numbers +25%, tile/charge counts +1, charge cost −1,
  passives grow. At ★ blasts widen and seals/burns/poison last a turn longer;
  at ★★ haste gives an extra move and ice lasts longer. Tap a monster to see
  exactly what its next evolution changes.
- 🪨 **Stone** tiles can't move and crumble when a neighbour is matched;
  ❄ **frozen** tiles can't be swapped until the ice melts.
- One HP pool each (80). Shields cap at 30. From round 20, **sudden death**
  deals growing damage each turn, so every match ends.

### Element archetypes

| Element | Archetype | Plays like |
| ------- | --------- | ---------- |
| 🔥 Fire | Destroyer | big hits, burns (Pyrup detonates them), blasts that match rows/columns/areas (the tiles charge you) |
| 💧 Water | Controller | freeze the rival's best tiles for their turn, drain rival charge, make the rival lose a move; Bublob's bubble blocks the rival's control |
| ⛰️ Earth | Fortress | stone the rival's element tiles, quakes, big shields and heals |
| 🌿 Nature | Sustain | poison (halves the rival's healing), life-steal, seal a rival monster's charge, overgrowth |
| ✨ Light | Tempo | burst, piercing hits that ignore shields, extra moves, regeneration, charging its partner |

20 monsters, each with its own move; some have passives (Scorchpaw goes
**berserk** at low HP, Lumoth **follows up** whenever its partner hits).

## Run it

```bash
npm install
npm test          # engine, board, matchmaking, protoo, rooms, end-to-end
npm run typecheck
npm run dev       # everything on :8080
npm run sim       # balance simulator (N=600 SEED=777)
npm run tiers     # per-monster win rates + what evolving each is worth (bot sim)
npm run lab       # the same from real matches (LAB_URL=… LAB_KEY=…)
```

Environment variables: `PORT` / `PLOTO_PORT`, `PLOTO_HOST`, `PLOTO_DATA_DIR`
(where the SQLite file `postgres.db` with accounts and match history lives,
default `./data`), `STATS_KEY` (opens the Monster Lab stats API),
`PLOTO_DOWNTIME` (`1` for maintenance), `PLOTO_MAINTENANCE_REASON`.

Deploying: a Helm chart for Kubernetes (Gateway API + cert-manager
`letsencrypt-prod`) lives in [`deploy/helm/ploto`](deploy/helm/ploto); see
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Getting a game bundle (the dumper)

Games are HTML5 `client.zip` bundles. To finish the in-game protocol we read one
bundle's JS. `src/tools/bundleDumper` extracts a bundle and reports what it says
about networking:

```bash
npm run dump -- ./client.zip              # a bundle you already have
npm run dump -- https://host/client.zip   # an exact URL you already know
```

It writes `manifest.json` (every file + sha256) and `protocol-report.json`
(URLs, ws endpoints, protoo method names, event-like strings) next to the
extracted files. Extraction is zip-slip-safe.

**Why it doesn't fetch the bundle for you from the config server.** The app does
`config request → bundle URL → download`, and in principle we could do the same.
But that first call is not a plain anonymous GET: the API host isn't a literal in
the app (it's assembled / delivered via Firebase Remote Config), and the call
carries an `X-API-Key` plus an anonymous device-session token
(`ANONYMOUS`/`deviceId`/`anonymousId`). Replicating that is a real client
bootstrap against Plato prod — a separate decision from downloading a public
file — so the dumper stays deliberately scoped to a bundle you supply. The
cleanest source is your own device's app cache while the service is up.

## The Match Monsters engine

`src/game/matchmonsters` is a self-contained, server-authoritative match-3
battler built from the public rules. A monster's move is a list of **effects**
(`damage` (optionally piercing), `heal`, `shield`, `drain`, `dot`, `ignite`,
`regen`, `bubble`, `match`, `freeze`, `petrify`, `convert`, `sap`, `slow`,
`seal`, `haste`, `cleanse`, `empower`) applied in
order, plus optional passives (`berserk`, `followUp`). Display text is generated
from the effects, so `monsters.ts` is the single source of truth for numbers.
All randomness runs through a seeded PRNG, so a match is fully reproducible from
`(seed, moves)` — which is how the engine is unit-tested and replayed.

**Animations are typed.** Each cast reports an ordered list of effect events
(which tiles turned to stone, how much charge was drained, which monster got
sealed…). `web/animators.js` has an `animate()` for every effect kind and every
board action (swap, cascade, reshuffle, ice landing, turn-start ticks), and is
type-checked against the engine's types, so `npm run typecheck` fails if a new
effect has no animation.

**Match history** records every finished match (monsters, evolutions, winner,
length, mode). The Monster Lab API (`/api/monster-lab`, gated by `STATS_KEY`)
serves per-monster, matchup and team win rates from it for tuning.

Balance is checked with `npm run sim` (match length, first-player edge, win
share per element) and `npm run tiers` (per-monster win rate, and what going
base → ★★ is worth for each). Both use the same greedy bot as practice mode.
Last run: 100% of matches finish (median 54 moves), every monster wins
48–52%, and evolving to ★★ adds +26 to +42 points of win rate for every
monster.

The roster and art are our own, so the game is playable now; the real
roster/tuning can slot in from the game bundle later.

## Scope & intent

For personal game preservation and interoperability. Independent of, and not
affiliated with, Plato Team Inc.
