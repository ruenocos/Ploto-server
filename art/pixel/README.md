# Pixel sprites

All Plotomon art in the game, authored as code so it stays editable and
consistent: 20 rigged monsters with three evolution stages each, the board
tiles (16×16), and the arena (a 160×100 meadow plus the grass platform).

- `pixelkit.py` — the rules every sprite shares: top-left light, a 4-colour ramp
  per material, coloured selective outlines, flat faces, unoutlined "floating"
  bits (halos, sparks, bubbles).
- `common.py` — element palettes and face helpers.
- `rigkit.py` — rigged monsters. A rig is drawn in a 32×32 design space, scaled
  per stage (×1.0, ×1.2, ×1.38) onto a 48×48 canvas with the feet at (24, 47),
  and split into parts (body, head, ears, wings, tail, tentacles, fx …). Each part
  has a role (which idle animation it gets), a parent, a z order (below 0 paints
  behind its parent) and a pivot (the joint it rotates around).
- `rigs_fire.py`, `rigs_water.py`, `rigs_earth.py`, `rigs_nature.py`,
  `rigs_light.py` — the monsters. Each `def name(stage)` draws all three
  stages, and each stage is its own design (baby, adolescent, adult) with a
  different silhouette, per [`EVOLUTION.md`](EVOLUTION.md). Parts that must
  not move (crystal humps, ridges) use the role `static`.
- `EVOLUTION.md` — the evolution design brief and its sources.
- `gems.py` — fire triangle, water round, earth square, nature leaf, light
  diamond, cherries and stone.
- `arena.py` — the battlefield backdrop and platform.
- `build.py` — renders everything to `out/` and writes `web/pixelart.js`
  (data URLs the client loads; see its docstring for the shape).
- `rigsheet.py` — a review sheet: each monster's three stages in colour, then as
  black silhouettes (`python3 rigsheet.py sheet.png rigs_fire`).

```bash
python3 art/pixel/build.py      # after editing any sprite
```

The PNGs in `out/` (`<name>-1..3.png` flattened stages, `<name>-icon.png` the
32×32 base form) open in Aseprite if you'd rather nudge pixels by hand (then the
sources here are out of date, so pick one workflow per sprite).

## In the client

- The arena rebuilds each rig from its parts: nested full-canvas layers, each
  rotating around its pivot, so the client can animate them separately. Idle
  loops come from the part's role (`.r-body` breathes, `.r-tail` sways, wings
  flap, ears twitch). Reactions are stock [Animate.css](https://animate.style)
  presets played on the whole monster through `fx.pose` (the `POSES` table in
  `web/index.html` maps each moment to a preset: cast → tada, attack →
  rubberBand, hurt → shakeX, cheer → bounce, charge → pulse, slowed → wobble,
  faint → fadeOutDown, evolve → flash then bounceIn).
- Sprites are drawn at whole-number device-pixel scales only (`--u` = one
  sprite pixel, `image-rendering: pixelated`), and the board snaps its tile
  size to multiples of the gem sprite, so every pixel is the same size.
- Everywhere a monster appears (lobby cards, the detail sheet and its
  evolution line, the end card) it's the live rig, idling with its own parts,
  not a static image. The 32×32 icon is only for small chips (team slots,
  invites).
