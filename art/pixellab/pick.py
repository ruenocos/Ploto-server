"""
Turn a chosen candidate into a game sprite.

  python3 art/pixellab/pick.py ember_pup 0 candidates/ember_pup/s0-3.png [front|left|right]

The pick is cleaned (hard alpha edge, snapped onto the colour pool, capped at
the stage's colour count, stray pixels dropped), placed bottom-centre on the
64x64 canvas and written to sprites/<id>-<stage>.png. build.py turns those
into the game's art; evolve.py draws the next stage from them.

Facing: every sprite is stored facing right, your side (a left-facing pick is
mirrored); the game mirrors all of the rival's monsters so both teams face each
other. sprites/facing.json notes which picks are front views.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

from style import CANVAS, MAX_COLORS, POOL

HERE = Path(__file__).resolve().parent
SPRITES = HERE / "sprites"


def _rgb(h: str) -> tuple[int, int, int]:
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


PAL = [_rgb(h) for h in POOL]


def _dist(a, b) -> float:
    """'Redmean': a cheap perceptual RGB distance."""
    rm = (a[0] + b[0]) / 2
    return (2 + rm / 256) * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + (2 + (255 - rm) / 256) * (a[2] - b[2]) ** 2


def nearest(c, choices=None):
    return min(choices or PAL, key=lambda p: _dist(c, p))


def clean(im: Image.Image, max_colors: int | None = None) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    cache: dict = {}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            c = (r, g, b)
            if c not in cache:
                cache[c] = nearest(c)
            px[x, y] = (*cache[c], 255)
    # cap the colour count: fold the rarest colour into its nearest remaining one, until it fits
    if max_colors:
        counts = Counter(px[x, y][:3] for y in range(h) for x in range(w) if px[x, y][3])
        remap = {}
        while len(counts) > max_colors:
            rare, n = min(counts.items(), key=lambda kv: kv[1])
            del counts[rare]
            into = nearest(rare, list(counts))
            counts[into] += n
            remap[rare] = into
            for k, v in remap.items():
                if v == rare:
                    remap[k] = into
        for y in range(h):
            for x in range(w):
                c = px[x, y]
                if c[3] and c[:3] in remap:
                    px[x, y] = (*remap[c[:3]], 255)
    # drop lone opaque pixels (generation specks) that touch nothing
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and not any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3]
                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1))):
                px[x, y] = (0, 0, 0, 0)
    return im


def place(im: Image.Image) -> Image.Image:
    """Bottom-centre on the 64 canvas: feet on the last row, like the rigs' (24, 47)."""
    im = im.crop(im.getchannel("A").getbbox())
    out = Image.new("RGBA", (CANVAS, CANVAS))
    out.alpha_composite(im, ((CANVAS - im.width) // 2, CANVAS - im.height))
    return out


def main() -> None:
    mid, stage, src = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])
    facing = sys.argv[4] if len(sys.argv) > 4 else "front"
    SPRITES.mkdir(exist_ok=True)
    out = SPRITES / f"{mid}-{stage}.png"
    im = place(clean(Image.open(src if src.is_absolute() else HERE / src), MAX_COLORS[stage]))
    if facing == "left":
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    im.save(out, optimize=True)
    meta_path = SPRITES / "facing.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta.setdefault(mid, {})[str(stage)] = "front" if facing == "front" else "right"
    meta_path.write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    print(out.relative_to(HERE), meta[mid][str(stage)])


if __name__ == "__main__":
    main()
