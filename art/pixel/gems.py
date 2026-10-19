"""16x16 board tiles: five element gems (own shape, size and marking each), berries and stone."""
from __future__ import annotations

import math

from PIL import Image


G = 16


# ---------------------------------------------------------------- element gems
# Five cut gems, one construction: a flat-toned facet band around a flat "table"
# with the element's marking, a 1px outline and one white glint, lit from the top
# left. Each element differs in corners (water 1, nature 2, fire 3, earth 4,
# light 6), size and colour, so they read apart by shape alone.
LIGHT_DIR = (-0.62, -0.78)  # towards the light: up and to the left


def _inside(poly: list[tuple[float, float]], x: float, y: float) -> bool:
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
            # outward normal of a clockwise (screen) polygon edge
            nx, ny = dy / L, -dx / L
            best, shade = d, nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1]
    return shade


def cut_gem(name: str, poly, table_scale: float, ramp: dict[str, str], mark: list[tuple[int, int]],
            glint: list[tuple[int, int]], mark_tone: str = "mark") -> Image.Image:
    """ramp: outline, dark, mid, light, table, mark."""
    # make the polygon clockwise on screen so the normals point outwards
    area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]))
    if area < 0:
        poly = poly[::-1]
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    table = [(cx + (x - cx) * table_scale, cy + (y - cy) * table_scale) for x, y in poly]
    inside = {(x, y) for y in range(G) for x in range(G) if _inside(poly, x + 0.5, y + 0.5)}
    img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    rgb = lambda k: tuple(int(ramp[k][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    for x, y in inside:
        if any((x + dx, y + dy) not in inside for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            k = "outline"
        elif _inside(table, x + 0.5, y + 0.5):
            k = "table"
        else:
            s = _edge_shade(poly, x + 0.5, y + 0.5)
            k = "light" if s > 0.3 else "dark" if s < -0.3 else "mid"
        img.putpixel((x, y), rgb(k))
    for p in mark:
        img.putpixel(p, rgb(mark_tone))
    for p in glint:
        img.putpixel(p, (255, 255, 255, 255))
    return img


class _Img:
    """Adapter so build.py can treat a plain image like a Sprite (name + render())."""
    def __init__(self, name: str, img: Image.Image):
        self.name, self.img = name, img

    def render(self) -> Image.Image:
        return self.img


def _circle(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def fire() -> _Img:  # 3 corners: a wide ruby triangle with a little flame
    poly = [(8, 0.9), (15.4, 14.8), (0.6, 14.8)]
    ramp = {"outline": "#3a0c08", "dark": "#8e1a12", "mid": "#d93a22", "light": "#ff8a5c", "table": "#f25a34", "mark": "#ffe9c8"}
    return _Img("fire", cut_gem("fire", poly, 0.36, ramp, [(8, 9), (7, 10), (8, 10), (8, 11), (9, 11), (7, 11)], [(6, 6), (5, 8)]))


def water() -> _Img:  # 1 corner: a sapphire droplet with a wave
    poly = [(8, 0.4)] + _circle(8, 9.8, 5.9, -38, 218, 24)
    ramp = {"outline": "#0a1f45", "dark": "#124c9e", "mid": "#2a84e8", "light": "#7cc8ff", "table": "#4aa6f8", "mark": "#e6f6ff"}
    return _Img("water", cut_gem("water", poly, 0.42, ramp, [(6, 10), (7, 11), (8, 10), (9, 11), (10, 10)], [(5, 7), (4, 9), (6, 6)]))


def earth() -> _Img:  # 4 corners: a small, squat amber square with a mountain
    poly = [(2.2, 2.2), (13.8, 2.2), (13.8, 13.8), (2.2, 13.8)]
    ramp = {"outline": "#2e1a0a", "dark": "#6e3e14", "mid": "#a86a26", "light": "#e0aa5e", "table": "#c88a40", "mark": "#fbe0b0"}
    return _Img("earth", cut_gem("earth", poly, 0.42, ramp, [(8, 6), (7, 7), (8, 7), (9, 7), (6, 8), (7, 8), (8, 8), (9, 8), (10, 8)], [(4, 4), (5, 4), (4, 5)]))


def nature() -> _Img:  # 2 corners: a long emerald leaf with its vein
    a, b, w = (1.0, 15.0), (15.0, 1.0), 5.6
    side1 = [(a[0] + (b[0] - a[0]) * t - 0.707 * w * math.sin(math.pi * t), a[1] + (b[1] - a[1]) * t - 0.707 * w * math.sin(math.pi * t)) for t in [i / 12 for i in range(13)]]
    side2 = [(a[0] + (b[0] - a[0]) * t + 0.707 * w * math.sin(math.pi * t), a[1] + (b[1] - a[1]) * t + 0.707 * w * math.sin(math.pi * t)) for t in [i / 12 for i in range(12, 0, -1)]]
    ramp = {"outline": "#0b2e14", "dark": "#1a6a2c", "mid": "#33a84e", "light": "#86e68e", "table": "#4cc464", "mark": "#d8ffd0"}
    return _Img("nature", cut_gem("nature", side1 + side2, 0.5, ramp, [(5, 10), (6, 9), (7, 8), (8, 7), (9, 6), (10, 5)], [(3, 9), (4, 7)]))


def light() -> _Img:  # 6 corners: a topaz hexagon with a sparkle
    poly = [(4.2, 1.6), (11.8, 1.6), (15.4, 8), (11.8, 14.4), (4.2, 14.4), (0.6, 8)]
    ramp = {"outline": "#3d2c02", "dark": "#b07a08", "mid": "#eeb01a", "light": "#ffe680", "table": "#ffcc2e", "mark": "#ffffff"}
    return _Img("light", cut_gem("light", poly, 0.45, ramp, [(8, 6), (8, 7), (6, 8), (7, 8), (8, 8), (9, 8), (10, 8), (8, 9), (8, 10)], [(4, 4), (3, 5)]))


def berry() -> _Img:  # two cherries on one stem: same flat facets as the gems
    ramp = {"outline": "#3a0612", "dark": "#a0142a", "mid": "#e02a44", "light": "#ff7a8a", "table": "#e02a44", "mark": "#ffffff"}
    img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
    left = cut_gem("c1", _circle(4.9, 11.2, 3.9, 0, 360, 16)[:-1], 0.01, ramp, [], [(3, 9), (3, 10)])
    right = cut_gem("c2", _circle(11.2, 10.8, 3.9, 0, 360, 16)[:-1], 0.01, ramp, [], [(9, 9), (9, 10)])
    stem, leaf, ink = (90, 58, 28, 255), (76, 196, 100, 255), (11, 46, 20, 255)
    for x, y in ((5, 6), (6, 5), (7, 4), (8, 3), (9, 2), (11, 6), (11, 5), (10, 4), (10, 3), (9, 2)):
        img.putpixel((x, y), stem)
    for x, y in ((10, 1), (11, 1), (12, 1), (11, 0), (12, 0), (13, 1), (12, 2)):
        img.putpixel((x, y), leaf)
    for x, y in ((10, 0), (13, 0), (14, 1), (13, 2), (11, 2)):
        img.putpixel((x, y), ink)
    img.alpha_composite(right)
    img.alpha_composite(left)
    return _Img("berry", img)


def stone() -> _Img:  # a dull rock: no table, no shine, just facets and a crack
    poly = [(3, 4), (8, 1), (13, 2.4), (15.2, 7.4), (14, 13.6), (8.6, 15.2), (2.6, 13.8), (0.8, 8.6)]
    ramp = {"outline": "#16171c", "dark": "#4a4c56", "mid": "#70737e", "light": "#a2a6b2", "table": "#70737e", "mark": "#2a2b32"}
    return _Img("stone", cut_gem("stone", poly, 0.01, ramp, [(8, 4), (8, 5), (9, 6), (8, 7), (7, 8), (7, 9), (10, 7), (11, 8), (6, 10)], []))


SPRITES = [fire, water, earth, nature, light, berry, stone]
