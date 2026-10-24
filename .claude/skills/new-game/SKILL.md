---
name: new-game
description: Make a new game for Ploto, from a questionnaire and brief through scaffold, build, feel pass and ship. Use when the user wants to add, design, prototype or "one-shot" a new game on the platform.
---

# New game

Follow docs/NEW_GAME.md. This file is how to run it. Read docs/NEW_GAME.md,
docs/PLATFORM.md ("The game kit") and docs/STYLE.md first.

The rule: Ploto owns everything around the game (lobby, codes, invites,
friends, names, accounts, settings, invite card, Continue, rematches, sheets,
toasts, back button). The game owns its rules, settings, assets, screen,
motion and sound. Never rebuild a Ploto piece inside a game; if a game needs
something Ploto lacks, add it to Ploto (platform.js, lobbykit.js, kit.ts,
lobbyRoom.ts) so every game gets it.

## 1. Questionnaire (AskUserQuestion, four rounds, up to 4 questions each)

Ask one round at a time and adapt later rounds to earlier answers. Offer
concrete options (the user can always pick Other). Put a recommended option
first when you have a reason to.

1. **The game**: kind of game (card/table, board or puzzle duel, arcade/real
   time, party/word); who plays (1v1, 2–4, 2–6, solo vs bots); length of a game
   (under 3 min, 5–10, 15–30); turns or real time.
2. **The feel**: mood (cozy, tense, chaotic and funny, calm and strategic);
   skill vs luck; the signature moment (a reveal, a combo chain, a bluff and
   showdown, a comeback); inspiration ("I'll share screenshots or links", "a
   game I'll name", "propose directions for me").
3. **Ploto fit**: quick play (yes / no); bots (fill rooms, practice only, none);
   who starts (the host, or as soon as seats fill); which settings a host may
   change (offer ones that suit the game type; multiSelect).
4. **The look**: art (PixelLab sprites, code-drawn pixel art, both); an accent
   colour; the sound's character; the home banner idea.

If they share inspiration, look at it before proposing anything, and name what
you'll take from it (layout, motion, a mechanic) and what you won't.

## 2. Directions and brief

Propose 2–3 directions, a short paragraph each: the hook, the signature
moment, the banner, and what makes it feel unlike Match Monsters and Hold'em.
Recommend one. When the user picks, write `docs/games/<id>.md` (rules in plain
words, seats and settings, signature moment, art and sound list, out of scope
for v1) and get a yes before code.

## 3. Build

1. `node scripts/new-game.mjs <id> "<Title>"`, then `npm test`,
   `npm run build && npm run e2e -- --game <id>`, and open `/play/<slug>`: the
   placeholder must already work end to end.
2. Engine (pure, seeded) with unit tests and a simulation test of thousands of
   random games checking invariants. Then the bot.
3. Room: settings, `LobbyRules`, `startGame`, `gameRequest`, per-seat views
   with redaction, `{view, events}` updates, `finish()`. Lobby: settings per
   room kind, `record`, the registry's `profile` tiles and `players` line.
4. Screen: replace the template's game screen; updates through
   `Ploto.playQueue` (animate from what's on screen, settle on each view, catch
   up when behind). Keep the kit's menu, How to play (`def.rules`) and result
   (`kit.renderResult`); fill them with the game's rows, steps, art and stats.
5. Feel pass: the signature moment first, then motion (a `Ploto.poses` map of
   Animate.css presets, steps() for UI, whole pixels, reduced motion), sound
   (`src/game/<id>/sounds.json` in the game's own words, `npm run sounds`) and
   haptics via `Ploto.cue`. Update `e2e/games/<id>.mjs` as the screens change.
6. Art: launcher card (`web/<slug>.card.js`, to docs/STYLE.md "Launcher cards":
   still, 80×50 grid, a collage: the star, what you play with, one piece of interface only this game has; icon = a crop of the star), home banner to "Home banners" (`Ploto.banner`,
   the card's pieces moving with the game's own poses), in-game art. PixelLab: the key is in the scratchpad
   (`.pixellab_key`), never in the repo; review candidates with the user.

Ship in milestones (playable rules, then the screen, then feel, then art),
each committed and pushed with both existing games still working. Show the
user screenshots at each milestone and ask before big direction changes.

## 4. Score and refine (docs/SCORING.md)

After the art milestone, score every category with two fresh reviewer agents
(give them the evidence pack and the rubric, never your own scores), take the
lower score per category, build the fixes for everything under 9, and repeat
with fresh reviewers until every category is 9/10 or better (stop after 6
rounds and say what's left). Log each round in `docs/games/<id>-scores.md`.

## 5. Checks before every push

- `npm test`, `npm run typecheck`.
- `npm run build && npm run e2e`: every game's lobby paths, a full game and a
  rematch, zero console errors.
- `npm run e2e -- --screens <new> --compare <last>`: 360 / 390 / 430 px, look
  at every diff it lists.
- The consistency and own-feel checklists in docs/NEW_GAME.md, item by item.
- Copy: STYLE.md Voice (no exclamation marks, no em dashes, plain words).
