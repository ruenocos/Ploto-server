"""
Turn chosen candidates into game sprites.

  python3 art/pixellab/pick.py ember_pup 2,0,3      # the seed picked for stage 0, 1, 2

Each pick is cleaned (hard alpha edge, snapped onto the house palette, stray
pixels dropped), placed bottom-centre on the 64x64 canvas and written to
sprites/<id>-<stage>.png, which build.py turns into the game's art.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from style import CANVAS, PALETTE

HERE = Path(__file__).resolve().parent
SPRITES = HERE / "sprites"


def _rgb(h: str) -> tuple[int, int, int]:
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


PAL = [_rgb(h) for h in PALETTE]


def nearest(c: tuple[int, int, int], cache: dict = {}) -> tuple[int, int, int]:
    """Closest palette colour by 'redmean', a cheap perceptual RGB distance."""
    if c not in cache:
        r, g, b = c

        def d(p):
            rm = (r + p[0]) / 2
            return (2 + rm / 256) * (r - p[0]) ** 2 + 4 * (g - p[1]) ** 2 + (2 + (255 - rm) / 256) * (b - p[2]) ** 2

        cache[c] = min(PAL, key=d)
    return cache[c]


def clean(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (*nearest((r, g, b)), 255) if a >= 128 else (0, 0, 0, 0)
    # drop lone opaque pixels (generation specks) that touch nothing
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and not any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3]
                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1))):
                px[x, y] = (0, 0, 0, 0)
    return im


def place(im: Image.Image) -> Image.Image:
    """Bottom-centre on the 64 canvas: feet on the last row, like the rigs' (24, 47)."""
    box = im.getchannel("A").getbbox()
    im = im.crop(box)
    out = Image.new("RGBA", (CANVAS, CANVAS))
    out.alpha_composite(im, ((CANVAS - im.width) // 2, CANVAS - im.height))
    return out


def main() -> None:
    mid, seeds = sys.argv[1], [int(s) for s in sys.argv[2].split(",")]
    SPRITES.mkdir(exist_ok=True)
    for stage, seed in enumerate(seeds):
        src = HERE / "candidates" / mid / f"s{stage}-{seed}.png"
        out = SPRITES / f"{mid}-{stage}.png"
        place(clean(Image.open(src))).save(out, optimize=True)
        print(out.relative_to(HERE))


if __name__ == "__main__":
    main()
