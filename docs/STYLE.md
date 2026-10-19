# Ploto pixel style

One visual language for the whole client: the monsters, gems and arena are
pixel art, so the UI is too. It stays clean, though: flat colours, a short
palette, generous spacing, and no texture for the sake of texture. The tokens
are the CSS custom properties at the top of `web/index.html`; use them, never
raw values.

## The pixel unit

- **`--px` = 2 CSS px** is one UI pixel. Borders, bevels, notches, shadows and
  bar segments are whole multiples of it, so the UI lands on whole device
  pixels on 1×, 2× and 3× screens.
- Sprites have their own unit, `--u` (set by the arena per screen), and are only
  ever drawn at whole-number scales with `image-rendering: pixelated`.

## Palette

Every UI colour comes from this list. Element hues are only for element
things (gems, charge bars, element tags, move names).

| Token | Hex | Use |
|---|---|---|
| `--c-ink` | `#0a0c14` | outlines, hard shadows, bar tracks |
| `--c-night` | `#121626` | page background |
| `--c-well` | `#181d31` | sunken: inputs, the board, chips |
| `--c-panel` | `#232a46` | panels and cards |
| `--c-raise` | `#2f375c` | raised: ghost buttons, bubbles |
| `--c-edge` | `#4a5486` | bevel highlight, dividers |
| `--c-mute` | `#9aa3cb` | secondary text |
| `--c-text` | `#eef0ff` | text |
| `--c-cream` | `#fff4d6` | headings, names, numbers |
| `--c-accent-lo` / `--c-accent` / `--c-accent-hi` | `#33267d` / `#6a4fe0` / `#a08cff` | primary actions, your turn, links |
| `--c-good` / `--c-good-hi` | `#36b65b` / `#92e27c` | HP, wins, heals |
| `--c-bad` / `--c-bad-hi` | `#d8364b` / `#ff8080` | low HP, damage, forfeit |
| `--c-gold` / `--c-gold-lo` | `#ffcc33` / `#a8740e` | moves left, stars, warnings |
| `--fire` `--water` `--earth` `--nature` `--light` | | element hues |

## Type

| Role | Font | Where |
|---|---|---|
| Label | **Silkscreen** 700 (`--f-label`) | buttons, headings, titles, monster and move names in sheets, HP and charge numbers, the turn banner |
| Text | **Pixelify Sans** 400/600/700 (`--f-text`) | everything small: player names, card names, chips, tags, badges, section heads, descriptions, chat, inputs, toasts |

**Silkscreen only at its grid.** It's drawn on an 8 px grid (125 font units per
pixel), so it's crisp only when each of its pixels is a whole number of device
pixels. Its sizes are `--fl-1` … `--fl-6`: 8 font pixels at 1.5, 2, 3, 4 and 6
CSS px each, snapped per screen by `sizeType()` (on a 3× phone `--fl-1` is
13.3 px, on a 2× phone 12 px, on a desktop 16 px; `--fl-2` is 16, `--fl-3` 24,
`--fl-4` 32, `--fl-6` 48). Never set it in raw px or below `--fl-1`. The arena's
charge badges size it from their own pixel unit (`8 × --gu`), so the number and
the gem beside it share one pixel size.

**Pixelify Sans for anything smaller,** at `--fs-xs` 12, `--fs-s` 13 or
`--fs-m` 15 px, scaled by the Text size setting (`--ts`). Nothing is under 12 px.
Uppercase Pixelify labels get 1 px letter-spacing; Silkscreen never does (it
reads as small caps already). Player names stay in their own case.

Both fonts are self-hosted from pinned `@fontsource` packages
(`/play/fonts/…`). Font smoothing is off so edges stay crisp.

## Spacing

A 4 px grid: `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s6` 24.

## Surfaces

Every surface is the same **frame**: corners cut by one UI pixel (a
`clip-path`), a one-UI-pixel `--c-ink` outline, a one-UI-pixel highlight on top,
and a darker two-UI-pixel band at the bottom. Variants change only the fill:

- **Panel** (cards, sheets, HUD, toasts): `--c-panel`.
- **Well** (board, inputs, "next evolution", bar tracks): `--c-well` with the
  highlight inverted, so it reads as sunken.
- **Active** (your HUD card, a picked monster): the frame's outline takes the
  accent or element colour, and the fill is tinted 16–22% toward it.

No rounded corners, no blur, no soft drop shadows. Depth is bevels only.

## Components

- **Button:** a raised block with a two-UI-pixel lip. On press it moves down
  one UI pixel and the lip shrinks. Variants: primary (accent), ghost (raise),
  danger (bad), disabled (grey). Label font, uppercase.
- **Bars** (HP, charge): ink track, flat fill with a one-UI-pixel highlight, and
  HP segmented every 10% so you can count chunks. A cream "ghost" shows damage
  just taken. Shield is a striped overlay.
- **Chips and tags:** small wells in Pixelify Sans 700, a pixel icon first.
  Status chips list buffs before debuffs and carry a one-UI-pixel underline
  (green for buffs, red for debuffs); timed ones end in `×turns`. Element tags
  fill with the element hue and ink text.
- **Element hues** are the `--fire` … `--light` tokens (plus `--berry`,
  `--stone`) and nothing else: tiles, motes, bursts and tags all read them.
- **Toasts** sit at the top of the screen, clear of the dock, the board and
  the thumb. Plain text, sentence case, no exclamation marks.
- **Questions** ("Forfeit this match?", "Sign out?") are the in-game sheet
  via `confirmPanel`, never the browser's confirm box.
- **Your name** gets a small YOU tag rather than a "(you)" suffix, so it never
  pushes the name into an ellipsis.
- **Icons:** never emoji (every phone draws them differently, and some can't
  draw them at all). Elements and berries use the gem sprites; everything else
  (shield, burn, poison, slow, bubble, heal, halved healing, seal, charge,
  passive, stars, ban, pierce, frozen, cleanse, battle, chat, friends,
  forfeit) is a 7×7 grid in `web/icons.js`, drawn as SVG in the current text
  colour at one icon pixel per UI pixel (`ic(name)`; floating numbers use 3 CSS
  px per icon pixel). Add new icons there, as ASCII grids.
- **Pips (MOVES):** gold squares with an ink outline. Spent pips go dark.

## Motion

- Monster reactions are stock Animate.css presets (see `POSES` in
  `web/index.html`). Each body part has its own idle loop.
- UI transitions use stepped easing (`steps(n)`), so they move in frames like
  the art does.
- **Effects are pixel art too.** Hits land as 6-frame impact sprites per
  element (`art/pixel/fx.py`: fire, water, earth, nature, light, plus heal,
  shield, ice, poison), at the arena's sprite pixel size. Motes and orbs are
  small hard-edged pixel shapes. Soft edges are dithered, never blurred.
- **Weight:** a hit freezes the arena for a beat (hit-stop: 60 ms, 140 ms from
  12 damage), then shakes in tiers with stock presets (head shake from 8,
  full shake from 16). Damage numbers grow and warm up in bands (under 8,
  8–14, 15–19, 20+) and land with a small random sideways offset; combo
  labels get gold at ×4 and orange at ×6, and the match sound stops rising at
  ×5.
- **Statuses show on the monsters:** flames while burning, bubbles while
  poisoned, plus signs while regenerating (4-frame loops), a bubble shell and
  a glass shield wall while those last.
- **Evolution is staged:** the arena dims, the monster turns into a white
  silhouette, old and new silhouettes trade places (each swap at least
  340 ms apart, so never more than 3 a second, per WCAG 2.3.1), one burst of
  light, then the new form bounces in.
- **The arena** has three times of day (day, dusk, night), picked from the
  room id so both players see the same one, and two cloud layers drifting at
  different speeds, one sprite pixel per step.
- **The end card** opens with a stepped circular wipe; a winning team
  cheers; your damage, best hit and best combo count up.
- Small life: now and then a glint runs across one gem; gems squash for one
  frame when they land; a draft pick lands in its slot like a stamp.
- **Glow is for moves only:** cast banners. Nothing else glows.
- Everything respects `prefers-reduced-motion` (and the Motion setting):
  no impacts, shakes, hit-stop, drifting clouds, status loops, silhouette
  swaps or wipes; the result of each moment still shows.

## Sound and haptics

- One `cue(event)` per game moment (`web/feedback.js`), called where the
  visual happens, so sound, vibration and animation land together.
- Light touches for frequent events (select, swap, match), stronger patterned
  ones for big moments (cast, heavy hit, your turn, evolve, KO, win).
  Consecutive cascade steps pitch the match sound up.
- Sounds are jsfxr's stock presets (one seeded variant each,
  `scripts/gen-sounds.mjs` → `web/sounds.js`), normalised to the same peak.
- Every cue has a visual too, so nothing depends on hearing or feeling it.
  iOS has no Vibration API.

## Settings and accessibility

- Per device: sound, vibration, hints, text size (1× / 1.15× / 1.3×, through
  `--ts`), and motion ("Device" follows `prefers-reduced-motion`; "Reduced"
  forces it on).
- Text colours meet WCAG AA (4.5:1) on the surfaces they sit on. Gems differ
  in shape as well as colour.
- Keyboard focus shows as an inset cream ring. The board takes focus: arrow
  keys move a dashed cursor, Enter or Space picks and swaps, Escape lets go.
  Monsters are focusable (Enter opens their sheet). Sheets are modal dialogs:
  focus moves in, Tab stays inside, Escape closes, and focus returns to what
  opened them.
- Small buttons are at least 40 px tall, main buttons 44 px.

## Voice

Plain and short. Sentence case, no em dashes, no exclamation marks, no emoji.
Say "rival" for the other player and "bot" for the practice opponent. Server
errors reach players through `errText()`, which capitalises them and turns
internal failures into a plain "Something went wrong. Try again".

## Evolutions

See [`art/pixel/EVOLUTION.md`](../art/pixel/EVOLUTION.md): every stage changes
silhouette, proportions and dominant feature, not just size.
