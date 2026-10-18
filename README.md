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
npm run dev        # status+web on :8080, signaling on :8443
```

Then both of you open **`http://<the-host's-LAN-ip>:8080/play`** (the host can
use `http://localhost:8080/play`). Each picks two monsters, hits **Quick Play**,
and you're matched into a live match: tap a tile then an adjacent one to swap,
match 3+ of your monster's element to attack, last team standing wins. Works on
phones on the same Wi-Fi. 20 monsters across five elements in the picker.

(Want it reachable off-LAN? Put it behind any TLS reverse proxy / tunnel and the
same `/play` page works.)

## Run it

```bash
npm install
npm test          # 31 tests: engine, board, matchmaking, protoo, end-to-end
npm run typecheck
npm run dev       # status on :8080, signaling on :8443
```

Environment variables: `PLOTO_HOST`, `PLOTO_STATUS_PORT`, `PLOTO_SIGNALING_PORT`,
`PLOTO_DOWNTIME` (`1` for maintenance), `PLOTO_MAINTENANCE_REASON`.

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
battler built from the public rules: two monsters per player, match 3+ tiles of a
monster's element to attack, cascades grant a combo multiplier, and a player wins
when both of the opponent's monsters fall. All randomness runs through a seeded
PRNG, so a match is fully reproducible from `(seed, moves)` — which is how the
engine is unit-tested and how matches can be replayed.

The monster roster in `monsters.ts` is our own placeholder set so the game is
playable now; the real roster/art/tuning slot in from the game bundle later.

## Scope & intent

For personal game preservation and interoperability. Independent of, and not
affiliated with, Plato Team Inc.
