# Pixel sprites (test batch)

32×32 Plotomon sprites, authored as code so they stay editable and consistent.

- `pixelkit.py` — the rules every sprite shares: top-left light, a 4-colour ramp
  per material, coloured selective outlines, flat faces, unoutlined "floating"
  bits (halos, sparks).
- `batch1.py` — Scorchpaw, Krakling and Lumoth: shapes plus hand-placed pixels.
- `out/` — rendered PNGs (open them in Aseprite to tweak by hand) and a preview.

```bash
python3 art/pixel/batch1.py art/pixel/out
```

Display at whole-number scales only (32px = 1×, 64, 96, 128) with
`image-rendering: pixelated`, or they blur.
