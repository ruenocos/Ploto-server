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
The lobby asks one thing per screen. Tap **Play**, then choose how:
**Quick match** (matched with anyone queuing in the same mode), **A friend**,
or **Practice** (the bot). Next, how teams are made: **Pick** (choose your two
on the next screen, the rival picks theirs blind), **Draft** or **Random**; it
remembers your last choice. A friend game ends on **Play a friend**: your
friends with a one-tap Invite, or **Share an invite link** (a 4-character code
+ a link, `/play?room=CODE`; the host's mode decides). Got a code? Type it under
Play or Play a friend. A link asks a new player for a name, then joins straight
away: draft and random rooms at once, a blind-pick room as soon as they've
picked two. Every screen has Back (and Escape); leaving a wait cancels it. No
accounts needed. **Monsters** on the home screen is the roster: tap one for its
evolution line and move, and **Play with** it.

**Random.** Both players are dealt two random monsters. The match opens with
the deal: four slots spin through the roster and lock in one by one,
alternating sides. A rematch deals new teams.

**Draft.** Both players ban one monster at the same time (revealed together),
then pick in a snake: whoever moves second in the match picks first, 1-2-1.
Picks are unique and visible, so you can counter what your rival takes (which
kits beat or combo with which is for players to discover). Quick Play gives 20
seconds per step (then no ban or a random pick); friend rooms and bot practice
have no timer, and the bot drafts counters too.

**Accounts & friends.** Optional, and never in the way: play first, then tap
**Friends** (or your name) in the lobby and **Claim a username** (your name is
filled in) (no password: the server hands back a
secret key that stays in the browser's localStorage; copy it from your profile to
sign in on another device). Then add friends by username, chat with them, and
tap **Invite** to start a match without sharing codes (you choose teams first):
**Play a friend** lists your friends (online first) with a one-tap Invite,
above the link and code options. Accepting a blind-pick invite without a team
takes you to Your team, where the button reads **Accept**.
After a match with a signed-in rival, **Add them as a friend** from the end
screen. Your profile shows your record and recent matches.

**Solo?** Tap **Play**, then **Practice**. In Pick the bot takes a random team; it plays a
greedy (occasionally sloppy) game. Practice games add debug shortcuts under
the board: **+4 berries** (evolve right away) and **Charge up** (both your
monsters fire on your next match). After any game, **Rematch** restarts with
the same teams (after a draft it drafts new ones, in Random it deals new
ones), and the loser goes first.

### How a match plays

The screen is an arena on top (your two monsters on the left, the rival's on
the right, each with its element and charge under it) and the gem board below.
Monsters are rigged pixel sprites that idle part by part and react with stock
Animate.css presets: they wind up to cast, strike, flinch when hit, cheer on
heals and shields, wobble when slowed, and flash into their next stage when
they evolve. Tap one for its move, passive and evolution line.

- Drag a gem onto a neighbour to swap (or tap one, then the other; on a keyboard, arrow keys move a cursor and Enter picks and swaps). Any swap is allowed: one that makes no
  match just moves the tile (handy for setting up a combo) and still uses a move,
  so the board can never lock you in.
- Stuck? After 8 seconds without a move, the best swap on the board nudges.
- Every moment has a sound and, on phones that support it, a vibration. Settings (the sliders button in the lobby, ☰ in a match) turn sound, vibration and hints on or off, set the text size, and can force reduced motion.
- You get **2 moves per turn** (the opening player gets 1 on their first turn).
  A line of **4+** (berries too) grants an extra move.
- 💎 A line of **5+** leaves a **Prism** (on the tile you moved, if it's in the line).
  Swap it with any tile to clear every tile of that kind, as your match; swap two
  prisms to clear the whole board. Prisms never match by colour, and stay on the
  board until someone uses them, so your rival can take one you leave behind.
- Matching tiles **charges** your monsters of that element. At its charge cost a
  monster **fires its move**: damage plus one twist (see below). Each monster
  acts at most once per move; any extra charge waits for your next move.
- Every monster also has one **passive**, an always-on rule (Pyrup's Kindling
  burns the rival whenever its partner hits, Gemox's Crystal hide shields the
  team when a rival move lands…). A passive that goes off shows its name over
  the monster; passives never fire moves, so they can't chain.
- 🍓 **Berries** appear on the board; collect **4** to **evolve** a monster.
  Every monster has three stages (★, ★★, ★★★), each with its own sprite.
  Every evolution: numbers +25%, tile/charge counts +1, charge cost −1,
  passives grow; seals last one more match per evolution. At ★★ blasts widen and
  burns/poison last a turn longer;
  at ★★★ haste gives an extra move and ice lasts longer. Tap a monster to see
  exactly what its next evolution changes.
- 🪨 **Stone** tiles can't move and crumble when a neighbour is matched;
  ❄ **frozen** tiles can't be swapped until the ice melts.
- One HP pool each (80). Shields cap at 30. From round 20, **sudden death**
  deals growing damage each turn, so every match ends.

### Element archetypes

| Element | Archetype | Plays like |
| ------- | --------- | ---------- |
| 🔥 Fire | Destroyer | big hits, burns (Emberwing makes them last longer, Pyrup detonates them), blasts that clear rows/columns/areas (the gems charge you) |
| 💧 Water | Controller | freeze the rival's best tiles for their turn, drain rival charge, make the rival lose a move; Bublob steals berries and answers the rival's control with a bubble |
| ⛰️ Earth | Guardian | stone the rival's element tiles, quakes that shatter stones, a shield bash, crystals that grow earth gems |
| 🌿 Nature | Survivor | poison (halves the rival's healing), life-steal that feeds on burns and poison, sealing the rival's readiest monster, Petalope growing berries and charging on them |
| ✨ Light | Striker | burst, piercing hits that ignore shields, extra moves, regeneration, charging its partner |

20 monsters, each with **one move** (damage plus one twist) and **one passive**
(the monster sheet has the exact numbers, and what each evolution changes):

| Monster | Move: twist | Passive |
| ------- | ----------- | ------- |
| 🔥 Pyrup | Ember Bite: detonates the rival's burns | **Kindling**: when its partner's move hits, the rival catches a burn |
| 🔥 Scorchpaw | Scorch Line: clears a row | **Berserk**: at low HP its move becomes a flurry of strikes |
| 🔥 Magmaul | Eruption: clears a 3×3 area | **Overheat**: charge banked past full is spent on the next Eruption for extra damage |
| 🔥 Emberwing | Cinder Rain: burns | **Afterburn**: the team's burns last a turn longer |
| 💧 Tidecoil | Undertow: drains rival charge | **Undercurrent**: the drained charge flows into its partner |
| 💧 Frostnip | Frostbite: freezes tiles for the rival's turn | **Frost armor**: while ice is on the board, rival hits deal less |
| 💧 Krakling | Riptide: the rival loses a move | **Lurk**: gains charge whenever a rival monster fires |
| 💧 Bublob | Pearl Snatch: steals a berry | **Bubble shell**: when a harmful effect lands on the team, blows a bubble that blocks the next |
| ⛰️ Craggol | Shield Bash: shields up, hits for half its shield | **Bedrock**: no single rival hit deals more than a cap |
| ⛰️ Rubbug | Petrify: turns rival tiles to stone | **Rockslide**: its move hits harder for every stone on the board |
| ⛰️ Tremole | Tremor: clears a column | **Fault line**: stones in the team's blasts shatter into the rival |
| ⛰️ Gemox | Crystallize: grows earth gems | **Crystal hide**: gains shield when a rival move hits the team |
| 🌿 Thornkin | Thorn Prick: poisons (halves healing) | **Thorns**: poisons a rival whose move hits the team |
| 🌿 Tanglet | Feeding Vine: steals HP | **Feeds on pain**: steals more for every turn of burn or poison on the rival (up to 4 turns) |
| 🌿 Myconite | Spore Cloud: seals the rival monster closest to firing | **Mycelium**: gains charge whenever its partner fires |
| 🌿 Petalope | Harvest Bloom: grows berries | **Sweet tooth**: every berry the team collects charges it (up to full) |
| ✨ Lumowl | Smite: clears a 2×2 area | **Keen eye**: the team's hits ignore shields |
| ✨ Glintling | Starstep: an extra move | **Daybreak**: starts fully charged, and charges fully whenever it evolves |
| ✨ Dawnhare | Radiance: regeneration | **Glow**: each turn the team's regen ticks, it gains charge |
| ✨ Halomoth | Kindred Glow: charges its partner | **Follow-up**: strikes too whenever its partner's move hits |

Kits are built to work alone and to combo: Tanglet feeds on Thornkin's
poison, Pyrup detonates the burns Kindling and Emberwing lay, Craggol's bash
grows with Gemox's Crystal hide, Tremole shatters Rubbug's stones, Petalope
grows berries for the whole team to evolve with.

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
`regen`, `bubble`, `match`, `freeze`, `petrify`, `convert`, `grow`, `pluck`, `sap`, `slow`,
`seal`, `haste`, `cleanse`, `empower`, `charge`) applied in
order, plus one passive (`berserk`, `followUp`, `afterburn`, `sweetTooth`,
`kindling`, `overheat`, `lurk`, `undercurrent`, `frostArmor`, `bubbleShell`,
`bedrock`, `rockslide`, `faultLine`, `crystalHide`, `thorns`, `feedsOnPain`,
`mycelium`, `keenEye`, `daybreak`, `glow`). A passive that goes off is reported
as its own cast (`via: "passive"`) carrying ordinary effect events, so it
animates like a move. Display text is generated from the effects and passives,
so `monsters.ts` is the single source of truth for numbers.
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
★ → ★★★ is worth for each). Both use the same greedy bot as practice mode.
Last run (after the one-move-one-passive rework, `N=40000`): every monster
wins 48–53% (the noise is about ±1), and evolving to ★★★ adds +29 to +45
points of win rate for every monster. Pairs of the same element win more
(both monsters charge on every match of that element, about 63% on average);
no mixed-element pair is above 56%.

The roster and art are our own, so the game is playable now; the real
roster/tuning can slot in from the game bundle later.

## Scope & intent

For personal game preservation and interoperability. Independent of, and not
affiliated with, Plato Team Inc.
