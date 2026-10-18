# Plato server — protocol notes (clean-room)

This document records what the Plato client (`com.plato.android`, v7.5.0, package
`com.playchat`) does *on the wire*, so an independent server can be built that the
original app can talk to. Everything here was established from publicly-observable
behaviour (DNS / Certificate Transparency logs, a single health-check request) and
from the open-source libraries the client is built on. No game assets or server code
are reproduced here — only the interface between client and server.

## 1. Hosts

| Purpose            | Host (prod)                     | Notes                                           |
| ------------------ | ------------------------------- | ----------------------------------------------- |
| Health / status    | `status-prod.platocorp.com`     | `GET /` → `{"downtime":0,"reason":""}`          |
| Config bootstrap    | `*.platocorp.com` (wildcard)    | HTTP + protobuf; returns SKUs + server endpoints |
| Game bundles       | `games-prod.platocdn.com`       | HTML5 game clients, shipped as `client.zip`     |
| Game assets        | `game-assets-prod.platocdn.com` | images / audio / lottie                          |
| Blobs              | `blob-prod.platocdn.com`        | user-generated content                           |
| Profile images     | `profile-prod.platocdn.com`     | avatars (`/user0.png` is the default)           |

Environments observed in CT logs: `-dev`, `-stage`, `-prod` variants of each CDN host.

## 2. Status endpoint  ✅ known exactly

```
GET https://status-prod.platocorp.com/
200  content-type: text/plain; charset=utf-8
{"downtime":0,"reason":""}
```

`downtime` is a flag (0 = up). `reason` is shown to users during maintenance. The
client polls this before/around connecting. Implemented in `src/status`.

## 3. Real-time layer — protoo over WebSocket + mediasoup  ✅ standard stack

The client embeds the **mediasoup-demo** Android client (`org.mediasoup.droid.lib`,
`org.protoojs.droid`). The signaling is therefore the open, documented **protoo**
protocol, and the media is a **mediasoup** SFU. This is the voice/video layer of
Plato rooms.

### WebSocket framing (from `WebSocketTransport`)

- Connect: `wss://<rtc-host>/?roomId=<id>&peerId=<id>`
- WebSocket sub-protocol: `protoo`
- Custom request header prefix: `RTC-Signaling-`
- Messages are JSON, one of:
  - Request:      `{ "request": true, "id": <num>, "method": <str>, "data": {...} }`
  - Response ok:  `{ "response": true, "id": <num>, "ok": true, "data": {...} }`
  - Response err: `{ "response": true, "id": <num>, "ok": false, "errorCode": <num>, "errorReason": <str> }`
  - Notification: `{ "notification": true, "method": <str>, "data": {...} }`

### Methods (client → server) — exactly stock mediasoup-demo

`getRouterRtpCapabilities`, `join`, `createWebRtcTransport`,
`connectWebRtcTransport`, `restartIce`, `produce`, `closeProducer`,
`pauseProducer`, `resumeProducer`, `pauseConsumer`, `resumeConsumer`,
`resumeConsumers`.

`join` payload: `{ displayName, device, rtpCapabilities, sctpCapabilities }`
→ response `{ peers: [...] }`.

### Notifications (server → client)

`newPeer`, `peerClosed`, `peerDisplayNameChanged`, `newConsumer`,
`newDataConsumer`, `consumerClosed`, `consumerPaused`, `consumerResumed`,
`consumerLayersChanged`, `consumerScore`, `producerScore`, `activeSpeaker`.

Because these are stock, the server side is built on the upstream `mediasoup` and
`protoo-server` npm packages (see `src/signaling`) rather than a reimplementation.
SCTP data channels are negotiated (`sctpCapabilities`, `newDataConsumer`), which is
how in-game data can travel alongside voice.

## 4. Games — HTML5 `client.zip` in a WebView

Games (Match Monsters among them) are **not** in the APK. They are HTML5 bundles
downloaded from `games-prod.platocdn.com` as `client.zip` and run in a WebView. A dev
build string (`http://192.168.86.32:9020/client.zip`) confirms the `client.zip`
convention. The native app hosts the WebView and tunnels the game's messages over the
real-time layer; the game's own message vocabulary lives inside its `client.zip`.

**Still needed to match the exact game wire-format:** the Match Monsters `client.zip`
(the game-client JS). Until then, the Match Monsters *engine* here is written
clean-room from the publicly described rules, behind a protocol adapter
(`src/game/matchmonsters`), so the rules are real and testable now and only the
outer wire-mapping is pending.

## 5. Matchmaking

The client has a matchmaking/"Quick Play" queue with waiting pools
(`WaitingMatchMakingItem(waitingPool=...)`). Modelled in `src/matchmaking` as pools
keyed by `{gameId, mode, stake}` that pair peers and spin up a room.

## Status legend
- ✅ known exactly / standard open protocol — safe to implement directly
- ⏳ needs the game `client.zip` to finalise the in-game payload mapping
