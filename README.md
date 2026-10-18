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

## Run it

```bash
npm install
npm test          # 31 tests: engine, board, matchmaking, protoo, end-to-end
npm run typecheck
npm run dev       # status on :8080, signaling on :8443
```

Environment variables: `PLOTO_HOST`, `PLOTO_STATUS_PORT`, `PLOTO_SIGNALING_PORT`,
`PLOTO_DOWNTIME` (`1` for maintenance), `PLOTO_MAINTENANCE_REASON`.

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
