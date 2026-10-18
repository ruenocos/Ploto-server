"""The arena backdrop (a pixel meadow) and the grass platform monsters stand on."""
from __future__ import annotations

import random

from PIL import Image, ImageDraw

from pixelkit import hex_rgb

W, H = 160, 100
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def _dither_bands(img: Image.Image, y0: int, y1: int, colors: list[str]) -> None:
    """Vertical gradient through `colors`, ordered-dithered between neighbouring bands."""
    cols = [hex_rgb(c) for c in colors]
    n = len(cols) - 1
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1) * n
        i = min(n - 1, int(t))
        f = t - i
        for x in range(W):
            img.putpixel((x, y), cols[i + 1] if f * 16 > BAYER[y % 4][x % 4] else cols[i])


def backdrop() -> Image.Image:
    rnd = random.Random(7)
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    _dither_bands(img, 0, 40, ["#5aa6e0", "#7fbfea", "#a6d6f0", "#cbe9f4"])
    # Clouds.
    for cx, cy, s in ((26, 10, 1.0), (98, 7, 1.3), (138, 16, 0.9), (62, 20, 0.7)):
        for dx, dy, r in ((0, 0, 6), (7, 1, 5), (-7, 2, 4), (3, -3, 4)):
            rr = r * s
            d.ellipse((cx + dx * s - rr, cy + dy * s - rr * 0.7, cx + dx * s + rr, cy + dy * s + rr * 0.7), fill=hex_rgb("#ffffff"))
        d.line((cx - 10 * s, cy + 3 * s, cx + 10 * s, cy + 3 * s), fill=hex_rgb("#dcecf6"))
    # Distant mountains.
    d.polygon([(0, 40), (14, 30), (28, 36), (44, 26), (62, 37), (80, 29), (98, 38), (118, 27), (136, 35), (150, 30), (160, 34), (160, 44), (0, 44)], fill=hex_rgb("#8aaed0"))
    d.polygon([(0, 44), (20, 36), (40, 41), (58, 34), (78, 42), (100, 35), (124, 41), (142, 36), (160, 40), (160, 46), (0, 46)], fill=hex_rgb("#6f96bc"))
    # Tree line.
    for x in range(-4, W + 6, 7):
        r = rnd.choice((5, 6, 7))
        d.ellipse((x - r, 44 - r, x + r, 44 + r), fill=hex_rgb("#2f6b3a"))
        d.ellipse((x - r + 2, 43 - r, x + r - 3, 43 + r - 4), fill=hex_rgb("#3d8446"))
    d.rectangle((0, 46, W, 50), fill=hex_rgb("#2f6b3a"))
    # Meadow: banded grass, darker towards the viewer, with tufts and flowers.
    _dither_bands(img, 50, H, ["#7cc85a", "#6cbc4e", "#5cae44", "#4f9e3c"])
    for _ in range(170):
        x, y = rnd.randrange(W), rnd.randrange(52, H)
        c = hex_rgb("#3f8a34") if y > 70 else hex_rgb("#4e9a3e")
        img.putpixel((x, y), c)
        if y > 62 and x + 2 < W:
            img.putpixel((x + 1, y - 1), c)
            img.putpixel((x + 2, y), c)
    for _ in range(26):
        x, y = rnd.randrange(W), rnd.randrange(56, H)
        img.putpixel((x, y), hex_rgb(rnd.choice(("#ffffff", "#ffe14d", "#ff9ab8"))))
    return img


def platform() -> Image.Image:
    """A grassy dirt disc, 40x14, drawn under each monster's feet."""
    img = Image.new("RGBA", (40, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((1, 3, 38, 13), fill=(*hex_rgb("#6b4a26"), 255))
    d.ellipse((1, 1, 38, 10), fill=(*hex_rgb("#3f8a34"), 255))
    d.ellipse((3, 2, 36, 8), fill=(*hex_rgb("#5cae44"), 255))
    d.line((8, 3, 20, 3), fill=(*hex_rgb("#7cc85a"), 255))
    return img
