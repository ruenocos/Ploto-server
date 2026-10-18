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
Each picks two monsters, then either **Quick Play** (matched with anyone
queuing) or **Invite a friend** (a 4-character code + a share link,
`/play?room=CODE`, that pre-fills the code for them). No accounts.

### How a match plays

- Tap a tile, then a neighbour, to swap. A swap must make a match.
- You get **2 moves per turn** (the opening player gets 1 on their first turn).
  A line of **4+** grants an extra move.
- Matching tiles **charges** your monsters of that element. At its charge cost a
  monster **fires its move** — damage plus a twist (see below).
- 🍓 **Berries** appear on the board; collect **4** to **evolve** a monster
  (+20% power, −1 charge cost, up to ★★★).
- 🪨 **Stone** tiles can't move and crumble when a neighbour is matched;
  ❄ **frozen** tiles can't be swapped until the ice melts.
- One HP pool each (80). Shields cap at 30. From round 20, **sudden death**
  deals growing damage each turn, so every match ends.

### Element archetypes

| Element | Archetype | Plays like |
| ------- | --------- | ---------- |
| 🔥 Fire | Destroyer | big hits, burns, blasts that match a row/column/area (the tiles charge you) |
| 💧 Water | Controller | freeze tiles, drain rival charge, make the rival lose a move |
| ⛰️ Earth | Fortress | turn tiles to stone, quakes, big shields and heals |
| 🌿 Nature | Sustain | poison, life-steal, seal a rival monster's charge, overgrowth |
| ✨ Light | Tempo | burst, extra moves, cleansing, charging its partner |

20 monsters, each with its own move; some have passives (Scorchpaw goes
**berserk** at low HP, Lumoth **follows up** whenever its partner hits).

## Run it

```bash
npm install
npm test          # engine, board, matchmaking, protoo, rooms, end-to-end
npm run typecheck
npm run dev       # everything on :8080
npm run sim       # balance simulator (N=600 SEED=777)
npm run tiers     # per-monster win rates + what evolving each is worth
```

Environment variables: `PORT` / `PLOTO_PORT`, `PLOTO_HOST`, `PLOTO_DOWNTIME`
(`1` for maintenance), `PLOTO_MAINTENANCE_REASON`.

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
(`damage`, `heal`, `shield`, `drain`, `dot`, `match`, `freeze`, `petrify`,
`convert`, `sap`, `slow`, `seal`, `haste`, `cleanse`, `empower`) applied in
order, plus optional passives (`berserk`, `followUp`). Display text is generated
from the effects, so `monsters.ts` is the single source of truth for numbers.
All randomness runs through a seeded PRNG, so a match is fully reproducible from
`(seed, moves)` — which is how the engine is unit-tested and replayed.

Balance is checked with `npm run sim`: a greedy bot plays hundreds of matches
and reports length, first-player edge and win share per element (last run: 100%
of matches finish, median 44 moves, first player 53%, every element 0.48–0.53).

The roster and art are our own, so the game is playable now; the real
roster/tuning can slot in from the game bundle later.

## Scope & intent

For personal game preservation and interoperability. Independent of, and not
affiliated with, Plato Team Inc.
