# Making a new game

How a game joins Ploto, step by step. The rule underneath everything:

> **Ploto owns everything around the game** (lobby, codes, invites, friends,
> names, accounts, settings, the invite card, Continue, rematches, sheets,
> toasts, the back button). **The game owns the game** (rules, settings,
> assets, its screen, its motion and sound).

That split is what makes a game quick to add and still feel like itself.
Claude runs this process with the `new-game` skill (`.claude/skills/new-game/`).

## 1. Brief: decide what to make

Before any code, answer these (the skill asks them in four short rounds):

| Round | Questions |
|---|---|
| The game | What kind of game? Who plays (solo vs bots, 1v1, 2–4, 2–6)? How long is a game? Turns or real time? |
| The feel | The mood (cozy, tense, chaotic, calm)? Skill or luck? The one moment that has to feel great (a reveal, a combo, a showdown, a comeback)? Any inspiration (games, screenshots, links)? |
| Ploto fit | Quick play? Bots (in rooms, practice only, none)? Who starts (the host, or as soon as seats fill)? Which settings may a host change? |
| The look | Art source (PixelLab sprites, code-drawn pixel art, both)? An accent colour of its own? The sound's character? The home banner idea? |

Then Claude proposes 2–3 directions (a line each: the hook, the signature
moment, the banner), you pick one, and it becomes a one-page brief in
`docs/games/<id>.md`: rules in plain words, seats and settings, the signature
moment, art and sound list, and what's out of scope for v1.

## 2. Scaffold

```
node scripts/new-game.mjs <id> "<Title>"      # e.g. tap_race "Tap Race"
```

It writes a working placeholder game (a tap race) on the platform's lobby:

| File | What it is | Owner |
|---|---|---|
| `src/game/<id>/room.ts` | the room: settings, `LobbyRules`, `startGame`, the game's methods, each seat's view | game |
| `src/game/<id>/lobby.ts` | a `GameKit`: which settings quick / host / practice rooms get, recording results | game (kit is Ploto's) |
| `web/<slug>.html` | the page: Ploto's home, room lobby and sheets; the game's own screen | both, clearly split |
| `web/<slug>.card.js` | its launcher card art and list icon (`Ploto.gameCard`) | game |
| `src/game/<id>/sounds.json` | its sound set, in its own words (`tap`, `win`); `npm run sounds` builds `web/sounds.js` | game |
| `test/<id>.test.ts` | host, join by code, start, finish, record, rematch, practice | game |
| `e2e/games/<id>.mjs` | its browser-test adapter: how to host, start, tell it's in the game, finish one | game (the flows are Ploto's) |
| `src/games.ts` | one registry entry: title, path, players, seats, profile tiles, lobby | Ploto |

`npm test`, `npm run dev`, open `/play/<slug>`: it already has quick play,
hosting with settings, codes, invites, practice with bots, the in-game menu,
How to play, the result with rematches, Continue and the invite card. And
`npm run build && npm run e2e -- --game <id>` drives all of it in a browser.

## 3. Build the game

In this order, each step tested before the next:

1. **Rules engine** (`src/game/<id>/engine.ts`): pure and deterministic, seeded
   randomness, no timers or sockets. Unit tests per rule, and a simulation test
   that plays thousands of random games and checks invariants (Hold'em: 5,000
   bot games, chips conserved after every action, every game ends).
2. **Bot**: legal moves only, beatable, fast (Hold'em decides in under 15 ms).
3. **Room** (`room.ts`): `startGame` builds the engine from the seated players;
   `gameRequest` maps methods to moves with readable errors; one view per seat
   with **redaction** (never send what a seat mustn't know: hidden cards,
   blind picks); updates as `{view, events}` so the client can animate events
   and then settle on the view; `finish()` when it's over.
4. **Results**: `record` in `lobby.ts` writes places and stats; the registry's
   `profile` names the tiles ("Tables", "Biggest pot").
5. **Screen** (`web/<slug>.html`): replace the template's game screen. Updates
   go through `Ploto.playQueue`: animate each event from what's on screen, end
   on its view, catch up when behind (`q.speed()`) or when the tab comes back.
   Keep the kit's screens around it: `kit.menu` (☰, Escape and the phone's back
   in a game), `def.rules` for How to play, `kit.renderResult` with the game's
   art and stats inside.
6. **Feel pass**: the signature moment first, then motion (the game's
   `Ploto.poses` map of Animate.css presets, steps() for UI), sound (its
   `sounds.json`), haptics.
7. **Art**: the launcher card (to the rule in docs/STYLE.md, "Launcher cards":
   a still collage of what's inside on the 80×50 grid: the star, what you play
   with, one piece of interface only it has; the icon a crop of the star), the home banner,
   to the rule in docs/STYLE.md, "Home banners" (`Ploto.banner`: the game's
   world and signature moment, an intro once, a beat every ~4 s while visible),
   then in-game art.

## 4. Consistency: what every game does the same

- [ ] Lobby screens come from the kit (`Ploto.lobbyKit`): home rows, code form,
      Playing as, room lobby, invite picker, share, settings sheet. No custom lobby UI.
- [ ] Names, claiming, settings, confirms, toasts, sheets and the invite card are
      `Ploto.*`. No copies.
- [ ] The in-game menu, How to play and the result are the kit's (`kit.menu`,
      `def.rules`, `kit.renderResult`): the game adds its own rows, steps, art and
      stats, never its own version of the screen.
- [ ] Motion through Ploto's library: Animate.css presets via `Ploto.poses` /
      `playPreset`, updates via `Ploto.playQueue`, the banner via `Ploto.banner`.
- [ ] `Ploto.saveRoom` / `forgetRoom` so reloads resume and the launcher can Continue.
- [ ] `Ploto.backGuard`: the phone's back button walks the screens (in a game it
      opens the menu, never a silent exit).
- [ ] Outside the game screen: only `pl-*` blocks and the tokens in `platform.css`.
- [ ] Copy follows docs/STYLE.md, Voice: short, plain, no exclamation marks, no
      em dashes, the game's own nouns ("Table code", "Room code").
- [ ] Works at 360 px wide, with reduced motion, with the keyboard, with zero
      console errors.

## 5. Own feel: what makes it this game

- [ ] **A signature moment** that's built first and polished most (Match
      Monsters: a combo that fires a move; Hold'em: the showdown flip).
- [ ] **Its own motion vocabulary**, used everywhere it appears: the home banner
      uses the same poses and timings as the game (the banner is a trailer, not
      a different animation).
- [ ] **An accent of its own** within Ploto's palette (Hold'em's felt, Match
      Monsters' element hues), added as tokens on its page.
- [ ] **Its own sound set** (`src/game/<id>/sounds.json`, its own cue names,
      played with `Ploto.cue`), with haptics on the same beats.
- [ ] **A launcher card to the rule** (docs/STYLE.md, "Launcher cards"): still,
      80×50, a collage of the star, its pieces and one piece of interface, its own backdrop colour.
- [ ] **A home banner to the rule** (docs/STYLE.md, "Home banners"): the same
      pieces as the card, moving with the game's own poses.
- [ ] **Art on Ploto's grid**: whole device pixels, `image-rendering: pixelated`,
      sizes snapped per screen; check against the reference images, at 1× and 3×.
- [ ] **Words in its world**: what a room, a code, a win are called.

## 6. Score and refine

Score the game on the ten categories in docs/SCORING.md (game design, signature
moment, animation, sound and haptics, visual design, UX, platform consistency,
bots, implementation, accessibility) with two independent reviewers, take the
lower score, build the fixes for everything under 9, and score again. Repeat
until every category is 9/10 or better, and log each round in
`docs/games/<id>-scores.md`.

## 7. Ship

- [ ] `npm test` and `npm run typecheck` clean; the simulation test passes.
- [ ] `npm run build && npm run e2e`: every lobby path (host + code, invite from
      the room through the launcher's card, quick, practice, reload, back out
      while waiting), a full game to the result and a rematch, for every game,
      zero console errors. A failing check saves each player's screen.
- [ ] `npm run e2e -- --screens out/now --compare out/before`: every screen at
      360 / 390 / 430 px, diffed against the last set, so nothing else moved.
- [ ] Docs: the brief, the game's section in docs/PLATFORM.md (its methods,
      view and events), the README line.
- [ ] Commit, push, and check both existing games still work.
