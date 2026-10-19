"""
Board tiles: five element gems, berries and stone, all built one way.

Every gem is the same size and square (about 88% of its tile), after Match
Monsters' own board: a 1px outline, a bevel band lit from the top left (light,
mid or dark by which way each edge faces), a big flat table, an engraved glyph
(a lighter fill with a thin darker line) and one white glint. They differ only
in cut, colour and glyph:

  water   rounded-square cushion   droplet
  earth   square, small clipped corners   mountain
  fire    octagon (big clipped corners)   flame
  nature  hexagon with flat top and bottom   leaf
  light   round brilliant   four-point star

Shapes are drawn in a 32-unit space, so the same gems render as 32x32 board
tiles (`TILES`) and 16x16 icons for chips and badges (`SPRITES`).
"""
from __future__ import annotations

import math

from PIL import Image

LIGHT_DIR = (-0.62, -0.78)  # towards the light: up and to the left
U = 32  # design space


def _inside(poly, x: float, y: float) -> bool:
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def _edge_shade(poly, x: float, y: float) -> float:
    """How much the nearest outer edge faces the light (-1 .. 1)."""
    best, shade = 1e9, 0.0
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (L * L)))
        d = math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
        if d < best:
            best, shade = d, (dy / L) * LIGHT_DIR[0] + (-dx / L) * LIGHT_DIR[1]
    return shade


def _clockwise(poly):
    area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]))
    return poly if area > 0 else poly[::-1]


def _arc(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def _rounded_square(x0, y0, x1, y1, r, n=5):
    pts = []
    for cx, cy, a in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        pts += _arc(cx, cy, r, a, a + 90, n)
    return pts


def _rgba(h: str) -> tuple[int, int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255


def cut_gem(poly, glyph, ramp: dict[str, str], size: int, table: float = 0.7, glint: bool = True) -> Image.Image:
    """poly and glyph in the 32-unit space; ramp: outline, dark, mid, light, table, line, fill."""
    k = U / size
    poly = _clockwise(poly)
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    tab = [(cx + (x - cx) * table, cy + (y - cy) * table) for x, y in poly]
    sample = lambda x, y: ((x + 0.5) * k, (y + 0.5) * k)
    inside = {(x, y) for y in range(size) for x in range(size) if _inside(poly, *sample(x, y))}
    in_glyph = {(x, y) for x, y in inside if glyph and _inside(glyph, *sample(x, y))}
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    n4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    lit = []
    for x, y in inside:
        if any((x + dx, y + dy) not in inside for dx, dy in n4):
            c = "outline"
        elif (x, y) in in_glyph:
            c = "line" if any((x + dx, y + dy) not in in_glyph for dx, dy in n4) else "fill"
        elif _inside(tab, *sample(x, y)):
            c = "table"
        else:
            s = _edge_shade(poly, *sample(x, y))
            c = "light" if s > 0.3 else "dark" if s < -0.3 else "mid"
            if c == "light":
                lit.append((x, y))
        img.putpixel((x, y), _rgba(ramp[c]))
    if glint and lit:  # a short white glint on the lit bevel, nearest the top-left corner
        x0, y0, x1, y1 = (min(p[0] for p in inside), min(p[1] for p in inside), max(p[0] for p in inside), max(p[1] for p in inside))
        tx, ty = x0 + (x1 - x0) * 0.22, y0 + (y1 - y0) * 0.22
        gx, gy = min(lit, key=lambda p: (p[0] - tx) ** 2 + (p[1] - ty) ** 2)
        for p in ((gx, gy), (gx + 1, gy - 1), (gx - 1, gy + 1))[: 3 if size >= 24 else 1]:
            if p in lit:
                img.putpixel(p, (255, 255, 255, 255))
    return img


# ---------------------------------------------------------------- cuts and glyphs (32-unit space)
BOX = (2, 2, 30, 30)  # every gem spans the same square

CUTS = {
    "water": _rounded_square(*BOX, 7),
    "earth": [(5, 2), (27, 2), (30, 5), (30, 27), (27, 30), (5, 30), (2, 27), (2, 5)],
    "fire": [(10.5, 2), (21.5, 2), (30, 10.5), (30, 21.5), (21.5, 30), (10.5, 30), (2, 21.5), (2, 10.5)],
    "nature": [(9, 2.5), (23, 2.5), (30, 16), (23, 29.5), (9, 29.5), (2, 16)],
    "light": _arc(16, 16, 14.2, 0, 360, 40)[:-1],
}

GLYPHS = {
    "water": [(16, 8.5)] + _arc(16, 18.5, 5.6, -35, 215, 18),
    "earth": [(8.5, 22.5), (13.5, 13.5), (15.5, 16), (18.5, 10), (23.5, 22.5)],
    "fire": [(16.5, 8), (20.5, 13), (22, 17.5), (21, 21.5), (16, 24), (11, 21.5), (10, 17.5), (11.8, 13.6), (13.6, 16.2), (14.4, 12)],
    "nature": ([(9.5 + 13 * t - 4.6 * math.sin(math.pi * t) * 0.7071, 22.5 - 13 * t - 4.6 * math.sin(math.pi * t) * 0.7071) for t in [i / 10 for i in range(11)]] +
               [(9.5 + 13 * t + 4.6 * math.sin(math.pi * t) * 0.7071, 22.5 - 13 * t + 4.6 * math.sin(math.pi * t) * 0.7071) for t in [i / 10 for i in range(9, 0, -1)]]),
    "light": [(16 + (7.5 if i % 2 == 0 else 2.6) * math.cos(math.radians(-90 + 45 * i)),
               16 + (7.5 if i % 2 == 0 else 2.6) * math.sin(math.radians(-90 + 45 * i))) for i in range(8)],
}

RAMPS = {  # outline, bevel dark / mid / light, table, glyph line and fill
    "water": {"outline": "#08223e", "dark": "#14609c", "mid": "#2a8ed8", "light": "#86d8ff", "table": "#3aa6ee", "line": "#14609c", "fill": "#8ad6ff"},
    "earth": {"outline": "#2a160a", "dark": "#5e3416", "mid": "#8a5428", "light": "#c8945a", "table": "#9c6232", "line": "#5e3416", "fill": "#d8a46a"},
    "fire": {"outline": "#3a0a0a", "dark": "#8a1616", "mid": "#c82a24", "light": "#ff7a5a", "table": "#dc3a2c", "line": "#8a1616", "fill": "#ff9a72"},
    "nature": {"outline": "#0a2a12", "dark": "#196428", "mid": "#2c9a42", "light": "#86e68e", "table": "#38b052", "line": "#196428", "fill": "#9cec98"},
    "light": {"outline": "#3a2802", "dark": "#a87006", "mid": "#e09e12", "light": "#ffe680", "table": "#f4bc24", "line": "#a87006", "fill": "#fff0a0"},
}


class _Img:
    """Adapter so build.py can treat a plain image like a Sprite (name + render())."""
    def __init__(self, name: str, img: Image.Image):
        self.name, self.img = name, img

    def render(self) -> Image.Image:
        return self.img


def _gem(name: str, size: int) -> _Img:
    return _Img(name, cut_gem(CUTS[name], GLYPHS[name], RAMPS[name], size))


def _berry(size: int) -> _Img:
    """Two cherries on one stem, with the same bevel lighting as the gems."""
    ramp = {"outline": "#3a0612", "dark": "#a0142a", "mid": "#e02a44", "light": "#ff7a8a", "table": "#e02a44", "line": "#e02a44", "fill": "#e02a44"}
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    k = U / size
    right = cut_gem(_arc(21.5, 21, 7.4, 0, 360, 24)[:-1], None, ramp, size, table=0.01)
    left = cut_gem(_arc(10.5, 22.5, 7.4, 0, 360, 24)[:-1], None, ramp, size, table=0.01)
    stem, leaf, ink = (90, 58, 28, 255), (76, 196, 100, 255), (11, 46, 20, 255)
    for t in range(13):
        for (x0, y0), (x1, y1) in (((11, 15), (18, 3.5)), ((21, 14), (18, 3.5))):
            x, y = x0 + (x1 - x0) * t / 12, y0 + (y1 - y0) * t / 12
            img.putpixel((int(x / k), int(y / k)), stem)
    leafpoly = [(18, 4), (22, 1.5), (27.5, 2), (24, 5.5)]
    for y in range(size):
        for x in range(size):
            if _inside(leafpoly, (x + 0.5) * k, (y + 0.5) * k):
                img.putpixel((x, y), leaf)
    img.alpha_composite(right)
    img.alpha_composite(left)
    return _Img("berry", img)


def _stone(size: int) -> _Img:
    """A dull blocker: the same square box, matte facets, no table or shine, a crack."""
    poly = [(6, 3), (25, 2.5), (30, 9), (29, 26), (23, 30), (7, 29.5), (2, 23), (2.5, 8)]
    ramp = {"outline": "#16171c", "dark": "#4a4c56", "mid": "#70737e", "light": "#a2a6b2", "table": "#70737e", "line": "#2a2b32", "fill": "#2a2b32"}
    crack = [(16, 6), (17.5, 11), (15, 15), (19, 19), (17, 24), (16, 24), (18, 19), (14, 15), (16.5, 11), (15, 6)]
    return _Img("stone", cut_gem(poly, crack, ramp, size, table=0.01, glint=False))


ORDER = ["fire", "water", "earth", "nature", "light"]
SPRITES = [lambda n=n: _gem(n, 16) for n in ORDER] + [lambda: _berry(16), lambda: _stone(16)]  # icons, chips, badges
TILES = [lambda n=n: _gem(n, 32) for n in ORDER] + [lambda: _berry(32), lambda: _stone(32)]  # the board
