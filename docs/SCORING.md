# Scoring a game

Every new game is scored before it ships, and refined until **every category
is 9/10 or better** (docs/NEW_GAME.md, step 6). The score is a tool for finding
what to fix next, not a grade: each round ends with a list of fixes, the fixes
get built, and the game is scored again.

## Categories

| # | Category | What a 9 looks like |
|---|---|---|
| 1 | **Game design** | The rules fit in a few lines; every turn has a real decision; a game lasts as long as the brief says; comebacks are possible; nothing feels unfair or random for no reason. |
| 2 | **Signature moment** | The one moment the brief names is built first and polished most: it reads instantly, it lands with weight (anticipation, impact, follow-through), and players would want to see it again. |
| 3 | **Animation** | Every state change is animated from what's on screen and settles on the true state; the game's poses (Animate.css presets via `Ploto.poses`) and `steps()` UI motion are used consistently; timings feel snappy, not slow; a backlog catches up; reduced motion still shows every result. |
| 4 | **Sound and haptics** | A cue for every game moment, named in the game's own words (`sounds.json`); big moments sound bigger than small ones; nothing grates when repeated; haptics land on the same beats; volume balanced against Ploto's set. |
| 5 | **Visual design and art** | Whole pixels on Ploto's grid; the game's own accent within the palette; a clear hierarchy (what to look at first); the launcher card and home banner follow docs/STYLE.md; it looks like this game and no other. |
| 6 | **UX and clarity** | At 360 px everything fits and every target is at least 44 px; whose turn it is and what to do next are always obvious; How to play teaches the game; errors and waits read in plain words. |
| 7 | **Platform consistency** | Lobby, menu, How to play, result and rematch are the kit's; copy follows docs/STYLE.md Voice; nothing around the game is custom. |
| 8 | **Opponent (bots)** | Medium is beatable and makes believable mistakes; Hard punishes sloppy play; bots act at a human pace; practice is fun. |
| 9 | **Implementation** | A pure, seeded engine with unit tests and a simulation of thousands of games; views redact everything a seat mustn't know; reconnects, timeouts, leaving and rematches all work; zero console errors; the browser suite passes. |
| 10 | **Accessibility** | Reduced motion, keyboard play, contrast (WCAG AA for text), labels for screen readers, no meaning carried by colour alone, no flashing above 3 per second. |

### Standing question: clutter and eye strain

Every round, each reviewer also answers: **does it feel cluttered, and can we
reduce eye strain?** Look at the screens a player stares at longest (the game
screen mid-game, the setup, the result): visual noise (textures, speckle, grid
lines, labels, trackers, accents competing with each other), the brightness and
contrast of large areas, text density, motion that never rests, and anything
that could be removed, merged or calmed without losing information. It feeds
visual design, UX and accessibility; a cluttered or tiring screen can't score 9
in any of them. Reviewers return a verdict and at least four concrete fixes.

## Anchors

- **10**: as good as the best mobile games of its kind; nothing to add.
- **9**: ship it; a reviewer finds only nits.
- **7–8**: solid, with gaps a player would notice.
- **5–6**: works, but plain or rough.
- **3–4**: parts are broken or missing.
- **1–2**: not there yet.

## How a round works

1. **Gather evidence:** screenshots of every screen at 360 / 390 / 430 px
   (`npm run e2e -- --game <id> --screens <dir>`), frame strips of the signature
   moment and the main animations (a frame every ~80 ms), the sound list with
   each cue's preset, length and loudness, the test and simulation output, and
   the code paths.
2. **Score independently:** two fresh reviewers (agents that haven't seen the
   build happen) score every category from the evidence, with a reason and the
   top fixes for anything under 10. They get the evidence and this rubric, never
   the builder's own scores.
3. **Take the lower score** of the two per category. The builder's own score
   doesn't count.
4. **Refine:** build the fixes for every category under 9, most impactful first,
   then re-gather the evidence and score again with fresh reviewers.
5. **Done** when every category is 9 or more in the same round. After 6 rounds,
   stop and list what's still under 9 and why.

Log every round in `docs/games/<id>-scores.md`: the scores, the reasons, the fixes
built. Reviewers can't hear sound, so the sound score rests on the cue design
(coverage, presets, lengths, loudness, layering); say so in the log.
