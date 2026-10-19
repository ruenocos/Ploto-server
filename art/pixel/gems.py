"""16x16 board tiles: five element gems (own shape, size and marking each), berries and stone."""
from __future__ import annotations

import math

from PIL import Image


G = 16


# ---------------------------------------------------------------- element gems
# Five cut gems in one construction, after Match Monsters' own tiles: every gem
# fills ~85% of its tile (14 of 16 px) and they differ only subtly in cut, plus
# colour and an engraved symbol on a big flat table. A narrow bevel lit from the
# top left (light, mid, dark by which way each edge faces), a 1px outline and
# one white glint. Cuts: fire octagon, water round cushion, earth clipped square,
# nature hexagon, light blunt diamond.
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


def _mark(rows: dict[int, list[int]]) -> list[tuple[int, int]]:
    return [(x, y) for y, xs in rows.items() for x in xs]


FLAME = _mark({4: [8], 5: [7, 8], 6: [7, 8, 9], 7: [6, 7, 8, 9], 8: [6, 7, 8, 9, 10], 9: [6, 7, 8, 9, 10], 10: [7, 8, 9]})
DROP = _mark({4: [7, 8], 5: [7, 8], 6: [6, 7, 8, 9], 7: [6, 7, 8, 9], 8: [5, 6, 7, 8, 9, 10], 9: [5, 6, 7, 8, 9, 10], 10: [6, 7, 8, 9]})
MOUNTAIN = _mark({5: [7, 8], 6: [6, 7, 8, 9], 7: [5, 6, 7, 8, 9, 10], 8: [4, 5, 6, 7, 8, 9, 10, 11], 9: [4, 5, 6, 7, 8, 9, 10, 11]})
LEAF = _mark({4: [10, 11], 5: [8, 9, 10, 11], 6: [7, 8, 9, 10], 7: [6, 7, 8, 9, 10], 8: [6, 7, 8, 9], 9: [5, 6, 7], 10: [4, 5]})
SPARKLE = _mark({4: [7, 8], 5: [7, 8], 6: [6, 7, 8, 9], 7: [4, 5, 6, 7, 8, 9, 10, 11], 8: [4, 5, 6, 7, 8, 9, 10, 11], 9: [6, 7, 8, 9], 10: [7, 8], 11: [7, 8]})
TABLE = 0.66  # the flat face: most of the gem, a narrow bevel around it


def fire() -> _Img:  # octagon, ruby, flame
    poly = [(5, 1), (11, 1), (15, 5), (15, 11), (11, 15), (5, 15), (1, 11), (1, 5)]
    ramp = {"outline": "#3a0c08", "dark": "#8e1a12", "mid": "#c8301c", "light": "#ff7a54", "table": "#e2432a", "mark": "#ff8e6a"}
    return _Img("fire", cut_gem("fire", poly, TABLE, ramp, FLAME, [(4, 3), (3, 4)]))


def water() -> _Img:  # round cushion, aquamarine, droplet
    poly = _circle(8, 8, 7.1, 0, 360, 28)[:-1]
    ramp = {"outline": "#08223e", "dark": "#14609c", "mid": "#2a8ed8", "light": "#7ad0ff", "table": "#38a6ec", "mark": "#86d4ff"}
    return _Img("water", cut_gem("water", poly, TABLE, ramp, DROP, [(4, 4), (3, 5)]))


def earth() -> _Img:  # square with clipped corners, amber, mountain
    poly = [(3, 1.4), (13, 1.4), (14.6, 3), (14.6, 13), (13, 14.6), (3, 14.6), (1.4, 13), (1.4, 3)]
    ramp = {"outline": "#2e1a0a", "dark": "#7a4614", "mid": "#b07026", "light": "#eab268", "table": "#c88438", "mark": "#ecbc78"}
    return _Img("earth", cut_gem("earth", poly, TABLE, ramp, MOUNTAIN, [(3, 3), (4, 3)]))


def nature() -> _Img:  # pointy-top hexagon, emerald, leaf
    poly = [(8, 0.6), (14.8, 4.4), (14.8, 11.6), (8, 15.4), (1.2, 11.6), (1.2, 4.4)]
    ramp = {"outline": "#0b2e14", "dark": "#1a6a2c", "mid": "#2f9a46", "light": "#86e68e", "table": "#40b85a", "mark": "#8ee49a"}
    return _Img("nature", cut_gem("nature", poly, TABLE, ramp, LEAF, [(4, 5), (5, 4)]))


def light() -> _Img:  # diamond with blunt tips, topaz, sparkle
    poly = [(6.6, 1), (9.4, 1), (15, 6.6), (15, 9.4), (9.4, 15), (6.6, 15), (1, 9.4), (1, 6.6)]
    ramp = {"outline": "#3d2c02", "dark": "#a87406", "mid": "#e2a414", "light": "#ffe680", "table": "#f6c22a", "mark": "#fff0a8"}
    return _Img("light", cut_gem("light", poly, TABLE, ramp, SPARKLE, [(5, 3), (4, 4)]))


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
