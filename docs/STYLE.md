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
| `--c-mute` | `#8e97bf` | secondary text |
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
| Label | **Silkscreen** 700 (`--f-label`) | headings, names, buttons, numbers, tags, the HUD |
| Text | **Pixelify Sans** 400/600/700 (`--f-text`) | descriptions, chat, inputs, toasts |

Sizes: `--fs-xs` 11, `--fs-s` 13, `--fs-m` 15, `--fs-l` 18, `--fs-xl` 24,
`--fs-xxl` 32 px. Silkscreen reads as small caps, so never add letter-spacing.
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
- **Chips and tags:** small wells in the label font. Element tags fill with
  the element hue and ink text.
- **Icons:** pixel sprites (the gem art) instead of emoji wherever an element
  or berry is shown.
- **Pips (MOVES):** gold squares with an ink outline. Spent pips go dark.

## Motion

- Monster reactions are stock Animate.css presets (see `POSES` in
  `web/index.html`). Each body part has its own idle loop.
- UI transitions use stepped easing (`steps(n)`), so they move in frames like
  the art does.
- **Glow is for moves only:** cast banners, charge motes, orbs. Nothing else
  glows.
- Everything respects `prefers-reduced-motion`.

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
- Keyboard focus shows as an inset cream ring.

## Evolutions

See [`art/pixel/EVOLUTION.md`](../art/pixel/EVOLUTION.md): every stage changes
silhouette, proportions and dominant feature, not just size.
