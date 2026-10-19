"""The arena: a pixel meadow at four times of day, drifting cloud layers, and the grass platform monsters stand on."""
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


# Times of day: the same meadow, re-lit. Each theme lists the sky bands, the
# two mountain ranges, the tree line, the meadow bands, tufts, flowers and the
# platform's grass, plus the clouds' colours (drawn on their own layers so they
# can drift).
THEMES = {
    "day": {
        "sky": ["#5aa6e0", "#7fbfea", "#a6d6f0", "#cbe9f4"], "far": "#8aaed0", "near": "#6f96bc",
        "tree": "#2f6b3a", "tree_hi": "#3d8446", "meadow": ["#7cc85a", "#6cbc4e", "#5cae44", "#4f9e3c"],
        "tuft": "#4e9a3e", "tuft_near": "#3f8a34", "flowers": ("#ffffff", "#ffe14d", "#ff9ab8"),
        "cloud": "#ffffff", "cloud_lo": "#dcecf6", "grass": ("#3f8a34", "#5cae44", "#7cc85a"), "dirt": "#6b4a26", "stars": 0,
    },
    # Dawn: cooler than dusk, lavender up top through pink to pale gold, a soft sun rising in the
    # east (left), dewy greens with a little mist, the last few stars.
    "dawn": {
        "sky": ["#7d86c8", "#b79ad0", "#f2b3c0", "#ffdca6"], "far": "#a597c8", "near": "#8a7cb4",
        "tree": "#2d4c46", "tree_hi": "#3e6656", "meadow": ["#8cc26e", "#7ab462", "#69a356", "#5a924b"],
        "tuft": "#5a924b", "tuft_near": "#4a7f40", "flowers": ("#ffffff", "#ffd3e6", "#fff1a8"),
        "cloud": "#ffe6ee", "cloud_lo": "#f2b8cc", "grass": ("#4a7f40", "#69a356", "#8cc26e"), "dirt": "#6a4a36", "stars": 4,
        "mist": "#b5d6a6",
    },
    "dusk": {
        "sky": ["#4a3a78", "#8a4f86", "#d9707a", "#f7b27a"], "far": "#7a5a8e", "near": "#5a4478",
        "tree": "#2a3f3a", "tree_hi": "#3a5444", "meadow": ["#7a9a4a", "#6a8c42", "#5a7c3a", "#4c6c34"],
        "tuft": "#4c6c34", "tuft_near": "#3e5a2c", "flowers": ("#ffd0a0", "#ffb84a", "#ff8fb3"),
        "cloud": "#ffc8a8", "cloud_lo": "#e08a8a", "grass": ("#3e5a2c", "#5a7c3a", "#7a9a4a"), "dirt": "#5a3a26", "stars": 6,
    },
    "night": {
        "sky": ["#0e1430", "#18224a", "#24335e", "#33456e"], "far": "#2e3c66", "near": "#22305a",
        "tree": "#122a26", "tree_hi": "#1c3a32", "meadow": ["#2f5a46", "#28503e", "#224636", "#1c3c2e"],
        "tuft": "#1c3c2e", "tuft_near": "#163226", "flowers": ("#cfe8ff", "#9fd8ff", "#d8c8ff"),
        "cloud": "#5a6a94", "cloud_lo": "#44527a", "grass": ("#163226", "#224636", "#2f5a46"), "dirt": "#3a2a24", "stars": 40,
    },
}
THEME_NAMES = list(THEMES)


def backdrop(theme: str = "day") -> Image.Image:
    t = THEMES[theme]
    rnd = random.Random(7)
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    _dither_bands(img, 0, 40, t["sky"])
    stars = random.Random(11)
    for _ in range(t["stars"]):
        x, y = stars.randrange(W), stars.randrange(0, 30)
        img.putpixel((x, y), hex_rgb("#fff6d0" if stars.random() < 0.3 else "#cfd8ff"))
    if theme == "night":  # a small moon
        d.ellipse((128, 6, 138, 16), fill=hex_rgb("#fff0c0"))
        d.ellipse((131, 5, 141, 15), fill=hex_rgb(t["sky"][0]))
    if theme == "dusk":  # the sun setting behind the hills
        d.ellipse((60, 30, 84, 54), fill=hex_rgb("#ffd27a"))
    if theme == "dawn":  # a pale sun just clearing the hills on the left, in a soft halo
        d.ellipse((14, 25, 46, 57), fill=hex_rgb("#ffe7b8"))
        d.ellipse((20, 31, 40, 51), fill=hex_rgb("#fff6dc"))
    # Distant mountains.
    d.polygon([(0, 40), (14, 30), (28, 36), (44, 26), (62, 37), (80, 29), (98, 38), (118, 27), (136, 35), (150, 30), (160, 34), (160, 44), (0, 44)], fill=hex_rgb(t["far"]))
    d.polygon([(0, 44), (20, 36), (40, 41), (58, 34), (78, 42), (100, 35), (124, 41), (142, 36), (160, 40), (160, 46), (0, 46)], fill=hex_rgb(t["near"]))
    # Tree line.
    for x in range(-4, W + 6, 7):
        r = rnd.choice((5, 6, 7))
        d.ellipse((x - r, 44 - r, x + r, 44 + r), fill=hex_rgb(t["tree"]))
        d.ellipse((x - r + 2, 43 - r, x + r - 3, 43 + r - 4), fill=hex_rgb(t["tree_hi"]))
    d.rectangle((0, 46, W, 50), fill=hex_rgb(t["tree"]))
    # Meadow: banded grass, darker towards the viewer, with tufts and flowers.
    _dither_bands(img, 50, H, t["meadow"])
    for _ in range(170):
        x, y = rnd.randrange(W), rnd.randrange(52, H)
        c = hex_rgb(t["tuft_near"]) if y > 70 else hex_rgb(t["tuft"])
        img.putpixel((x, y), c)
        if y > 62 and x + 2 < W:
            img.putpixel((x + 1, y - 1), c)
            img.putpixel((x + 2, y), c)
    for _ in range(26):
        x, y = rnd.randrange(W), rnd.randrange(56, H)
        img.putpixel((x, y), hex_rgb(rnd.choice(t["flowers"])))
    if t.get("mist"):  # morning mist over the far meadow: thick at the tree line, thinning out
        for y in range(50, 56):
            for x in range(W):
                if BAYER[y % 4][x % 4] < (56 - y) * 1.1:
                    img.putpixel((x, y), hex_rgb(t["mist"]))
    return img


def clouds(theme: str = "day", layer: str = "far") -> Image.Image:
    """A strip of clouds (160x40, transparent) that tiles horizontally, so it can drift.
    'far' clouds are small and sit higher; 'near' ones are bigger and lower."""
    t = THEMES[theme]
    img = Image.new("RGBA", (W, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    spots = ((26, 9, 0.7), (98, 6, 0.9), (140, 13, 0.6)) if layer == "far" else ((62, 20, 1.0), (128, 22, 1.3))
    for cx, cy, sc in spots:
        for ox in (-W, 0, W):  # draw wrapped copies so the strip tiles seamlessly
            x = cx + ox
            for dx, dy, r in ((0, 0, 6), (7, 1, 5), (-7, 2, 4), (3, -3, 4)):
                rr = r * sc
                d.ellipse((x + dx * sc - rr, cy + dy * sc - rr * 0.7, x + dx * sc + rr, cy + dy * sc + rr * 0.7), fill=(*hex_rgb(t["cloud"]), 255))
            d.line((x - 10 * sc, cy + 3 * sc, x + 10 * sc, cy + 3 * sc), fill=(*hex_rgb(t["cloud_lo"]), 255))
    return img


def platform(theme: str = "day") -> Image.Image:
    """A grassy dirt disc, 40x14, drawn under each monster's feet."""
    t = THEMES[theme]
    img = Image.new("RGBA", (40, 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((1, 3, 38, 13), fill=(*hex_rgb(t["dirt"]), 255))
    d.ellipse((1, 1, 38, 10), fill=(*hex_rgb(t["grass"][0]), 255))
    d.ellipse((3, 2, 36, 8), fill=(*hex_rgb(t["grass"][1]), 255))
    d.line((8, 3, 20, 3), fill=(*hex_rgb(t["grass"][2]), 255))
    return img
