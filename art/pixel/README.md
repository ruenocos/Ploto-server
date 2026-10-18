# Pixel sprites

All Plotomon art in the game: 20 monsters (32×32) and the board tiles (16×16),
authored as code so they stay editable and consistent.

- `pixelkit.py` — the rules every sprite shares: top-left light, a 4-colour ramp
  per material, coloured selective outlines, flat faces, unoutlined "floating"
  bits (halos, sparks, bubbles).
- `common.py` — element palettes and face helpers.
- `batch1.py`, `batch2.py`, `batch3.py` — the monsters (shapes + hand-placed pixels).
- `gems.py` — fire triangle, water round, earth square, nature leaf, light
  diamond, cherries and stone.
- `build.py` — renders everything to `out/` and writes `web/pixelart.js`
  (data URLs the client loads).
- `sheet.py` — an 8× contact sheet for reviewing: `python3 sheet.py out.png batch2`.

```bash
python3 art/pixel/build.py      # after editing any sprite
```

The PNGs in `out/` open in Aseprite if you'd rather nudge pixels by hand (then
the sources here are out of date, so pick one workflow per sprite).

In the client, sprites are drawn at whole-number scales only (32/64/96/128 px,
`image-rendering: pixelated`), and the board snaps its tile size to multiples of
the gem sprite in device pixels so every pixel is the same size.
