# Ploto platform: launcher, shared base, games

Ploto is a launcher with games inside it. Each game is its own thing (its own
rules, table or board, and screens); they share the parts around the games, so
those are built once and behave the same everywhere:

```
Launcher          /play            Games · Friends · Profile tabs
───────────────────────────────────────────────────────────────
Games             /play/match-monsters      /play/holdem     (next game…)
───────────────────────────────────────────────────────────────
Shared base       accounts · friends · chat · invites · presence · rooms
                  · settings · name · toasts · sheets · sounds (platform.js/.css)
```

## Pages and files

| URL | File | What |
|---|---|---|
| `/play` | `web/launcher.html` | The launcher. `?room=CODE` (old Match Monsters links) redirects to `/play/match-monsters?room=CODE`. |
| `/play/match-monsters` | `web/index.html` | Match Monsters. Back on its home goes to `/play`. |
| `/play/holdem` | `web/holdem.html` | Hold'em. `?table=CODE` joins a table. |
| `/play/platform.js` | `web/platform.js` | Shared toolkit (`window.Ploto`), loaded by every page. |
| `/play/platform.css` | `web/platform.css` | Shared tokens and components (pixel style, see docs/STYLE.md). |
| `/play/games` | — | The game registry (JSON), see below. |

Every page loads, in order: `platform.css`, `feedback.js` deps (`riffwave.js`,
`sfxr.js`, `sounds.js`, `feedback.js`), `icons.js`, `platform.js`, then its own code.

### Query parameters every game page understands

- `?invite=<inviteId>`: the launcher's Join on an invite. The game page runs its
  own accept flow (Match Monsters may need a team first; Hold'em takes a seat).
- `?inviteFriend=<accountId>`: the launcher's Invite on a friend, after choosing
  this game. The game page runs its own host flow (Match Monsters: choose teams;
  Hold'em: host settings) and the invite goes out at the end.

## Game registry: `GET /play/games`

```json
[{ "id": "match_monsters", "title": "Match Monsters", "path": "/play/match-monsters",
   "players": "1v1", "minSeats": 2, "maxSeats": 2, "online": 12 },
 { "id": "holdem", "title": "Hold'em", "path": "/play/holdem",
   "players": "2–6 players", "minSeats": 2, "maxSeats": 6, "badge": "NEW", "online": 3 }]
```

`online` = players currently in a room or queue of that game. A new game is one
entry in `src/platform/games.ts` plus its lobby module and page.

## Shared client toolkit: `window.Ploto` (web/platform.js)

Storage keys are shared with Match Monsters' page, so the name, account and
settings carry across pages: `mm.key`, `mm.account`, `mm.guestName`,
`mm.settings` (localStorage), `mm.peer` (sessionStorage).

| API | What |
|---|---|
| `Ploto.$(id)`, `Ploto.esc(s)`, `Ploto.sleep(ms)` | Helpers |
| `Ploto.local` / `Ploto.store` | `get/set/del` JSON over localStorage / sessionStorage |
| `Ploto.peerId` | This tab's peer id |
| `Ploto.connect(roomId)` → sock | protoo-over-WebSocket: `sock.request(method, data)` → Promise, `sock.on(method, fn)` for notifications |
| `Ploto.waitOpen(sock)` | Resolves when open |
| `Ploto.lobby()` → Promise<sock> | The shared lobby socket (`roomId=lobby`), signed in when there's an account; reconnects with backoff. `Ploto.onLobby(method, fn)` registers notification handlers that survive reconnects. |
| `Ploto.api(method, path, body?)` | JSON HTTP with the account key |
| `Ploto.account` / `Ploto.restoreAccount()` / `Ploto.onAccount(fn)` | `{id, username}` or null |
| `Ploto.claim(username)` | Create an account (stores the key) |
| `Ploto.displayName()` / `Ploto.ensureName(opts)` / `Ploto.askName(opts)` | Name to play under; the name modal |
| `Ploto.toast(msg, ms?)` | Toast at the top |
| `Ploto.sheet(html, {onClose})` → el / `Ploto.closeSheet()` | Bottom sheet (modal). Never auto-focuses a text box on touch screens, so the keyboard waits for a tap. |
| `Ploto.confirm({title, body, yes, no, danger})` → Promise<bool> | In-app yes/no |
| `Ploto.settings`, `Ploto.saveSettings()`, `Ploto.openSettings()` | Sound, vibration, text size, motion (same key as Match Monsters) |
| `Ploto.cue(name, opts)` | Sound + haptic (web/feedback.js) |
| `Ploto.reduceMotion()` | Motion setting / prefers-reduced-motion |
| `Ploto.games()` → Promise<registry> | `/play/games` (cached) |
| `Ploto.setActivity(gameId, label)` | Tell friends what you're doing ("At a Hold'em table") |
| `Ploto.errText(e)` | A failure as players should read it |

## Lobby socket (`roomId=lobby`)

Platform methods (shared by every page):

| Method | Data | Returns |
|---|---|---|
| `platform:auth` (alias `mm:auth`) | `{key}` | `{account}` |
| `platform:activity` | `{gameId, label}` or `{}` to clear | `{ok}` — friends get `social:presence` with `activity` |
| `platform:invites` | — | `{invites: [Invite]}` pending invites addressed to me |
| `platform:declineInvite` (alias `mm:declineInvite`) | `{inviteId}` | `{ok}` |
| `platform:cancelInvite` (alias `mm:cancelInvite`) | `{inviteId}` | `{ok}` |

`Invite` (also the `social:invite` notification) =
`{inviteId, gameId, from: {id, username}, label, expiresInMs, …game fields}`.
`label` is shown as is ("Hold'em table", "Match Monsters · Draft").
`social:inviteGone` = `{inviteId, reason}`. `social:presence` =
`{id, online, activity?: {gameId, label}}`.

Each game adds its own methods under its prefix (`mm:*`, `holdem:*`), handled by
its lobby module (`src/game/<game>/lobby.ts`).

## HTTP API additions

- `GET /api/friends`: each friend also has `activity` (`{gameId, label}` or null).
- `GET /api/me/stats`: `{totals: {played, wins}, games: {<gameId>: {tiles: [{label, value}], recent: [{what, when}]}}}`
  for the Profile tab (signed-in players; guests get 401 and see the claim prompt).

## Hold'em

### Lobby methods (`holdem:*` on the lobby socket)

| Method | Data | Returns |
|---|---|---|
| `holdem:quick` | `{displayName}` | `{roomId, code}` — a quick table (6 seats, 1,000 chips, timer on, blinds every 10). Starts when full, or 20 s after you sit down with bots in the empty seats. |
| `holdem:host` | `{displayName, settings}` | `{roomId, code}` — a table you host (lobby state) |
| `holdem:practice` | `{displayName, settings?}` | `{roomId, code}` — you + bots, timer off, starts right away |
| `holdem:tableInfo` | `{code}` | `{roomId, code, host, settings, seatsFree, started}` |
| `holdem:join` | `{code, displayName}` | `{roomId, code}` — reserves a seat |
| `holdem:invite` | `{friendId, roomId}` | `{inviteId}` — invite a friend to your table |
| `holdem:acceptInvite` | `{inviteId, displayName}` | `{roomId, code}` |

`settings` = `{seats: 2–6, bots: bool, chips: 500|1000|2000|5000, timer: bool, blindsEvery: 10|5|0}`.

### Table room (`roomId=<roomId>` socket, same peerId)

| Method | Data | Returns |
|---|---|---|
| `holdem:getState` | — | `TableView` |
| `holdem:act` | `{action}` (`{type:'fold'|'check'|'call'|'allIn'}` or `{type:'raise', to}`) | `{ok}` |
| `holdem:start` | — (host) | `{ok}` — empty seats get bots if `settings.bots` |
| `holdem:addBot` / `holdem:removeBot` | `{seat}` (host, before start) | `{ok}` |
| `holdem:settings` | `{settings}` (host, before start) | `{ok}` |
| `holdem:leave` | — | `{ok}` — before start frees the seat; during play you sit out (auto check/fold) |
| `holdem:rematch` | — (after game over) | `{roomId, code}` — first caller hosts a new table with the same settings; others who call join it |

Notification `holdem:update` = `{view: TableView, events: Event[]}` after every
change; events are filtered per viewer (you only ever see your own hole cards
until showdown).

`TableView` = `{roomId, code, phase: 'lobby'|'playing'|'over', you: seat|null, host: seat,
settings, seats: [{seat, kind: 'player'|'bot'|'empty'|'invited', name, connected, away, chips, bet,
folded, allIn, cards: Card[]|null (own, or revealed), dealer, sb, bb, toAct, place}],
board: Card[], pots: [{amount}], blinds: {sb, bb, level, nextIn}, handNo,
toAct: seat|null, legal: {canFold, canCheck, call, minRaiseTo, maxRaiseTo, canRaise}|null,
deadline: epochMs|null, bank: seconds left in your time bank, standings: [{seat, name, place}],
rematch: {roomId, code}|null}`.

`Card` = `{rank: 2..14, suit: 's'|'h'|'d'|'c'}`.

`Event` (in order; the client animates them): `handStart {handNo, button, sb, bb}`,
`blinds {seat, amount}`, `deal {}`, `action {seat, type, amount, toTotal, allIn}`,
`street {name, cards}`, `showdown {reveals: [{seat, cards, handName}]}`,
`pot {index, amount, winners: [{seat, amount, handName}]}`, `eliminated {seat, place}`,
`blindsUp {sb, bb}`, `gameOver {standings}`, `timeout {seat, type}`.

Timers: with the timer on, each action has 25 s; then the player's time bank (60 s
for the whole game) runs; then the server acts for them (check if free, else fold).
A disconnected or away player is acted for after 5 s even with the timer off.
Bots act after a short human-like pause.
