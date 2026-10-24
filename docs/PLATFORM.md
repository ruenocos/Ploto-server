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
| `/play/lobbykit.js` | `web/lobbykit.js` | The lobby kit (`Ploto.lobbyKit`): lobby screens, menu, how to play, result. |
| `/play/motion.js` | `web/motion.js` | The motion kit: Animate.css presets, poses, play queue, banners, count-ups. |
| `/play/animate.min.css` | Animate.css | Ploto's animation library (stock presets). |
| `/play/games` | — | The game registry (JSON), see below. |

Every game page loads, in order: `platform.css` and `animate.min.css`,
`feedback.js` deps (`riffwave.js`, `sfxr.js`, `sounds.js`, `feedback.js`),
`icons.js`, `platform.js`, `motion.js`, `lobbykit.js`, then its own code.

### Query parameters every game page understands

- `?invite=<inviteId>`: the launcher's Join on an invite. The game page runs its
  own accept flow (Match Monsters may need a team first; Hold'em takes a seat).
- `?code=<code>`: a shared invite link; the page joins that room (Hold'em still
  reads the older `?table=`).
- `?inviteFriend=<accountId>`: the launcher's Invite on a friend, after choosing
  this game. The game page runs its own host flow (Match Monsters: choose teams;
  Hold'em: host settings) and the invite goes out at the end.

## Game lobbies: the same shape in every game

Every game opens straight into its lobby (no title screen), built from the
shared `pl-*` blocks in `platform.css`; only the game's own options differ.
Once a match starts, nothing is shared: each game draws its own table or board.

| Screen | Blocks | Hold'em | Match Monsters |
|---|---|---|---|
| Home | `pl-bar` (Back to the launcher, title, one info action), `pl-hero` (the game's art), `pl-row` × 3 (quick / with friends / practice), `pl-form` + `pl-code` ("Have a code?"). Your name isn't on game pages: it's in the launcher's Profile, and Ploto asks for one the first time you play | Rules | Monsters (the roster) |
| The game's options | the game's own controls | Host a table: seats, bots, chips, timer, blinds | Teams: Pick, Draft or Random (then Your team for Pick) |
| Room lobby | `pl-codecard` (code + Share invite), `pl-sumline` (the room's settings in a line), `pl-label` + `pl-seats` / `pl-seat` (you, players, open seats with Invite), `pl-waitline` or a `pl-foot` action | Seats 2–6, host starts | 1v1: starts as soon as the friend joins |

Invite on an open seat lists your online friends (with what they're doing),
or shares the code instead. In Match Monsters the code and an invite are open
side by side; whichever lands first starts the match and the other is withdrawn.

## The game kit: lobby methods and room lobbies shared by every game

The platform owns everything up to the deal: codes, seats, the host, invites,
bots in open seats, quick-room countdowns, starting and rematches. A game owns
its rules, its settings and everything after the start.

**Server.** A game's lobby is a `GameKit` (`src/platform/kit.ts`) given a
`GameDef` (which settings each kind of room gets, how to build a room, how to
record a result). Its rooms extend `LobbyRoom` (`src/platform/lobbyRoom.ts`) with
`LobbyRules` (`start: "host"|"full"`, `minPlayers`, `bots`) and a few hooks:
`capacity`, `emptySeat`, `fillsWithBots`, `parseSettings`, `startGame`,
`gameRequest`, and optionally `onChange` and `leaveDuringGame`. Codes are unique
across games; `platform:findCode {code}` → `{code, gameId, path}`.

Lobby methods, the same in every game (`<p>` is the game's prefix):

| Method | Data | Returns |
|---|---|---|
| `<p>quick` | `{displayName, settings?, data?}` | `{roomId, code, seat}`: a seat in the quick room filling up, or a new one |
| `<p>host` | `{displayName, settings, data?}` | `{roomId, code, seat}`: a room you host |
| `<p>practice` | `{displayName, settings?, data?}` | `{roomId, code, seat}`: you and bots, started the moment you connect |
| `<p>info` | `{code}` | `{roomId, code, host, settings, seatsFree, started, …game fields}` |
| `<p>join` | `{code, displayName, data?}` | `{roomId, code, seat}` |
| `<p>invite` | `{friendId, roomId}` | `{inviteId}`: holds an open seat for an online friend |
| `<p>acceptInvite` | `{inviteId, displayName, data?}` | `{roomId, code, seat}` |

Room methods, the same in every game (on the room socket):

| Method | Data | Returns |
|---|---|---|
| `lobby:getView` | — | `LobbyView` |
| `lobby:start` | — (host) | `{ok}`: open seats become bots when the settings allow |
| `lobby:addBot` / `lobby:removeBot` | `{seat}` (host, before the start) | `{ok}` |
| `lobby:settings` | `{settings}` (host, before the start) | `{ok}` |
| `lobby:leave` | — | `{ok}`: before the start frees the seat; during the game the game decides (Hold'em sits you out) |
| `lobby:rematch` | — (after the game) | `{roomId, code}`: the first caller hosts a new room with the same settings; others join it |

Notification `lobby:update` = `{view: LobbyView}` after every lobby change.
`LobbyView` = `{roomId, code, gameId, mode: 'quick'|'private'|'practice'|'rematch',
phase: 'lobby'|'playing'|'over', you, host (-1: no host), settings, startsAt
(quick rooms, epoch ms), minPlayers, bots, fillsWithBots, startRule,
seats: [{seat, kind: 'player'|'bot'|'empty'|'invited', name, connected, inviteId?}],
rematch: {roomId, code, players} | null}`.

**Client.** `Ploto.lobbyKit(def)` (web/lobbykit.js) draws the lobby screens from
those: the game home (`[data-mode]` rows, `[data-code-form]`), seat
taking that gives the seat back if you back out (`kit.seat`, `kit.cancelSeat`),
joining by code (`kit.info`, `kit.join`), the room lobby from a `LobbyView`
(`kit.renderRoom(view, {main, foot, req})`), the invite picker, sharing,
the settings sheet from the game's settings schema, and `Ploto.backGuard` for
the phone's back button. The game passes its nouns ("Table code"), settings
schema and summary line, share text and pixel art.

**Standard screens around the game.** The kit also draws the three screens every
game has around its own, so they look and work the same everywhere:

| Screen | Call | The game gives |
|---|---|---|
| In-game menu (the ☰ button, Escape, the phone's back) | `kit.menu({view, items})` | its own rows (`{label, danger, run}`: Forfeit match, Leave table). Ploto adds Share invite (in a room lobby), How to play, Settings and Close |
| How to play | `kit.rules()` | `def.rules() → {steps, extra}`: numbered steps in its own words, plus any extra HTML (Hold'em's hand ranking) |
| Result and rematch | `kit.renderResult(root, {...})`, then `kit.countResult(root)` | `hero` (its art), `title`, `sub`, `win`, `standings` (places) and/or `tiles` (stats that count up), `rematchHint`, `extra`, and its own `onRematch` / `onLeave` when it handles them itself. Ploto draws the rematch state from the room ("Ben wants a rematch", Join rematch, "Ann and Ben are in"), or `blocked` when it can't happen |

The game keeps everything inside those screens' frames that's its own: its
art in the result's hero, its intro and cheer around it (Match Monsters' wipe),
its stats.

## Game registry: `GET /play/games`

```json
[{ "id": "match_monsters", "title": "Match Monsters", "path": "/play/match-monsters",
   "players": "1v1", "minSeats": 2, "maxSeats": 2, "online": 12 },
 { "id": "holdem", "title": "Hold'em", "path": "/play/holdem",
   "players": "2–6 players", "minSeats": 2, "maxSeats": 6, "badge": "NEW", "online": 3 }]
```

`online` = players currently in a room of that game; `card` is the game's own
launcher art (`web/<game>.card.js`). A new game is one entry in `src/games.ts`
plus its folder and page: docs/NEW_GAME.md, and `node scripts/new-game.mjs`.

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
| `Ploto.lobby()` → Promise<sock> | The shared lobby socket (`roomId=lobby`), signed in when there's an account; reconnects with backoff. `Ploto.onLobby(method, fn)` registers notification handlers that survive reconnects. `Ploto.onLobbyOpen(fn)` runs `fn(sock)` after each (re)connect once signed in, to catch up on what was missed. One per tab: a page never opens a second lobby socket of its own (they share a peer id). |
| `Ploto.api(method, path, body?)` | JSON HTTP with the account key |
| `Ploto.account` / `Ploto.restoreAccount()` / `Ploto.onAccount(fn)` | `{id, username}` or null |
| `Ploto.claim(username)` | Create an account (stores the key) |
| `Ploto.openClaim()` → Promise<account> / `Ploto.signInWithKey(key)` | The claim sheet (with "sign in with your key") / sign in with a key from another device |
| `Ploto.displayName()` / `Ploto.ensureName(opts)` / `Ploto.askName(opts)` | Name to play under; the name modal |
| `Ploto.toast(msg, ms?)` | Toast at the top |
| `Ploto.sheet(html, {onClose})` → el / `Ploto.closeSheet()` | Bottom sheet (modal). Never auto-focuses a text box on touch screens, so the keyboard waits for a tap. |
| `Ploto.confirm({title, body, yes, no, danger})` → Promise<bool> | In-app yes/no |
| `Ploto.settings`, `Ploto.saveSettings()`, `Ploto.openSettings()` | Sound, vibration, text size, motion (same key as Match Monsters) |
| `Ploto.cue(name, opts)` | Sound + haptic (web/feedback.js): the page's game set first (`src/game/<id>/sounds.json`), then Ploto's (`src/platform/sounds.json`). The lobby kit sets the game (`MM_FEEDBACK.setGame(id)`) |
| `Ploto.reduceMotion()` | Motion setting / prefers-reduced-motion |
| `Ploto.playPreset(el, preset, {speed, keep})` → Promise | A stock Animate.css preset on an element (web/motion.js) |
| `Ploto.poses(map)` → `pose(el, name)` | A game's body language: moment → preset, played the same everywhere (nothing with reduced motion) |
| `Ploto.playQueue({run, onError, onReturn})` → `q` | Play updates strictly one after another: `q.add(item)`, `q.speed()` (1, 0.45, 0.3 as the backlog grows), `q.clear()`, `q.collapse(fn)`; `onReturn(items)` cuts the backlog when the tab comes back |
| `Ploto.banner(el, {draw, intro, beat, every})` → `{paint, stop}` | A home banner (docs/STYLE.md, Home banners): drawn for its size, an intro once on screen, a beat while visible |
| `Ploto.countUp(el, to, {steps, ms, format})` | A number counting up in stepped frames |
| `Ploto.games()` → Promise<registry> | `/play/games` (cached) |
| `Ploto.setActivity(gameId, label)` | Tell friends what you're doing ("At a Hold'em table") |
| `Ploto.errText(e)` | A failure as players should read it |
| `Ploto.addSettings(rows)` | A game's own rows in the Settings sheet (Match Monsters: hints) |
| `Ploto.acceptInvitesHere(gameId, fn)` / `Ploto.inviteDetails(gameId, fn)` / `Ploto.setInviteBusy(fn)` | The invite card is Ploto's, on every page: Join opens the game's page (`?invite=`) unless this page accepts that game's invites itself; a game can add art and a note to its invites' card; while busy (in a match) an invite is a toast |
| `Ploto.saveRoom(gameId, room)` / `Ploto.savedRoom(gameId?)` / `Ploto.forgetRoom(gameId?)` | The room this tab is in (sessionStorage `ploto.room`): the game page resumes it, the launcher offers Continue |

## Lobby socket (`roomId=lobby`)

Platform methods (shared by every page):

| Method | Data | Returns |
|---|---|---|
| `platform:auth` (alias `mm:auth`) | `{key}` | `{account}` |
| `platform:activity` | `{gameId, label}` or `{}` to clear | `{ok}` — friends get `social:presence` with `activity` |
| `platform:invites` | — | `{invites: [Invite]}` pending invites addressed to me |
| `platform:room` | `{roomId}` | `{gameId, phase, code}` while that room is going and you have a seat (the launcher's Continue) |
| `platform:findCode` | `{code}` | `{code, gameId, path}`: which game a code belongs to |
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

### Lobby

The game kit's methods with the `holdem:` prefix. Quick tables: 6 seats, 1,000
chips, timer on, blinds every 10; they start when full, or 20 s after the first
player sits down, with bots in the empty seats. Practice: you and 3 bots, timer
off, dealt the moment you connect (the first `holdem:update` can arrive before
your `holdem:getState` answer). Rooms follow the platform's lobby (`lobby:*`):
the host starts, 2 players or more.

`settings` = `{seats: 2–6, bots: bool, chips: 500|1000|2000|5000, timer: bool, blindsEvery: 10|5|0, botStyle: 'sharp'|'relaxed'}`.
Bots play short-handed ranges (about a third of hands at 4 seats, more on the
button and in the big blind, some limps). "Sharp" is the normal bot; "Relaxed"
calls more, reads its hand noisily and sizes bets at random. Quick tables use
Sharp; a host picks; practice uses your last choice and can switch mid-game.

### Table room (`roomId=<roomId>` socket, same peerId)

| Method | Data | Returns |
|---|---|---|
| `holdem:getState` | — | `TableView` |
| `holdem:act` | `{action}` (`{type:'fold'|'check'|'call'|'allIn'}` or `{type:'raise', to}`) | `{ok}` |
| `holdem:botStyle` | `{style: 'sharp'|'relaxed'}` (practice tables only) | `{ok}`: the bots play that way from their next move |
| `lobby:*` | | the platform's room methods above; `lobby:leave` during play sits you out (auto check/fold) |

Notification `holdem:update` = `{view: TableView, events: Event[]}` after every
change; events are filtered per viewer (you only ever see your own hole cards
until showdown). The request `holdem:back` (no data) ends sitting out.

`TableView` = `{roomId, code, mode: 'quick'|'private'|'practice'|'rematch',
phase: 'lobby'|'playing'|'over', you: seat, host: seat (-1 for quick tables),
settings, startsAt: epochMs|null (quick tables: when bots fill in and the deal starts),
seats: [{seat, kind: 'player'|'bot'|'empty'|'invited', name, connected, away, chips, bet,
inHand, folded, allIn, busted, place, cards: Card[]|null (yours, or shown at showdown),
hasCards (face-down cards to draw), dealer, sb, bb}],
board: Card[], pots: [{amount}] (collected on earlier streets), totalPot (incl. this street's bets),
handNo, street: 'preflop'|'flop'|'turn'|'river'|'showdown'|'handOver'|'gameOver'|null,
blinds: {sb, bb, level, nextIn: hands until they go up, or null}|null,
toAct: seat|null, legal: {canFold, canCheck, call, canRaise, minRaiseTo, maxRaiseTo}|null (yours, on your turn),
deadline: epochMs|null (whoever is to act; null = no clock), inBank: bool (the time bank is running),
bank: seconds left in your time bank, standings: [{seat, name, place}] (busted so far, and the winner at the end),
results: [{seat, name, place, isBot, handsWon, biggestPot, bestHand}]|null (when over),
rematch: {roomId, code, players: [name]}|null (who has joined the rematch so far)}`.

`Card` = `{rank: 2..14, suit: 's'|'h'|'d'|'c'}`. A `raise.to` is the total bet for the street.

`Event` (in order; the client animates them, then settles on the view). Every event
has a `type` field naming it; an `action` event carries the move in its `action` field:
`handStart {handNo, button, sb, bb, stacks: [{seat, chips}]}`,
`blinds {seat, kind: 'sb'|'bb', amount, allIn}`, `deal {hands: [{seat, cards|null}]}` (deal order),
`timeout {seat, action}` (the clock acted; followed by the action), 
`action {seat, action: 'fold'|'check'|'call'|'bet'|'raise', amount (chips put in), toTotal, allIn}`,
`returned {seat, amount}` (an uncalled bet comes back),
`street {name: 'flop'|'turn'|'river', cards (new), board (all)}`,
`showdown {reveals: [{seat, cards, handName}]}`,
`pot {index, amount, winners: [{seat, amount, handName|null}]}`, `eliminated {seat, place}`,
`blindsUp {level, sb, bb}`, `gameOver {standings: [{seat, name, place, chips}]}`.

Timers: with the timer on, each action has 25 s; then the player's time bank (60 s
for the whole game) runs; then the server acts for them (check if free, else fold).
A disconnected or away player is acted for after 5 s even with the timer off.
Bots act after a short human-like pause.

## Match Monsters

### Lobby

The game kit's methods with the `mm:` prefix. `settings` = `{team: 'pick'|'draft'|'random'}`;
`data` on a seat-taking call is your two monster ids, needed for blind picks
(`pick`) and ignored otherwise. Rooms have two seats and start as soon as both
are taken (`startRule: 'full'`):

- quick: rooms with the same `team` fill up together (draft rooms give 20 s per draft step);
- host: a room behind a code; whoever comes first, a code joiner or an invited friend,
  takes the second seat (an invite is withdrawn if someone else takes its seat);
  the host can also seat the bot (`lobby:addBot`);
- practice: you and the bot, started the moment you connect.

`mm:info` adds `team`. The invite (`social:invite`) adds `team` and, for blind
picks, the host's `monsters`. Rematches keep the same picks; drafts draft
again and random teams are dealt again.

### Match room (`roomId=<roomId>` socket, same peerId)

Before the start it's the platform's room lobby (`lobby:*`). Once started, the
same connection carries the draft (if any) and then the match:

| Method | Data | Returns |
|---|---|---|
| `mm:getState` | — | the draft view while drafting (`{draft, remainingMs, names, botSeat, connected}`), then the match snapshot |
| `mm:ban` / `mm:pick` | `{monsterId}` | `{ok}` (draft) |
| `mm:leaveDraft` | — | `{ok}`: the match is off (`mm:draftCancelled` to both) |
| `mm:move` | `{from: {x, y}, to: {x, y}}` | `{accepted}` |
| `mm:evolve` | `{monsterId}` | `{ok, evolution, berries}` |
| `mm:forfeit` | — | `{ok}` |
| `mm:debug` | `{action: 'berries'|'charge'}` | `{ok}` (games against the bot only) |

Notifications: `mm:draftUpdate`, `mm:draftDone`, `mm:moveResult`, `mm:evolved`,
`mm:gameOver`, `mm:peerStatus`, and the platform's `lobby:update`.
