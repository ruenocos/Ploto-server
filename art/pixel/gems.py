"""16x16 board tiles: five element gems (own silhouette each), berries and stone."""
from __future__ import annotations

from pixelkit import Material, Sprite

G = 16


def gem(name: str, ramp: list[str], shape, icon: list[tuple[int, int]], icon_color: str, outline: str) -> Sprite:
    s = Sprite(name, {"gem": Material(ramp), "icon": Material([icon_color], flat=True), "glint": Material(["#ffffff"], flat=True)},
               outline=outline, size=G)
    shape(s)
    s.pxs("icon", icon)
    return s


def fire() -> Sprite:
    def shape(s):
        s.poly([(8, 0.4), (9.6, 1.6), (15.6, 13), (15.2, 14.8), (0.8, 14.8), (0.4, 13), (6.4, 1.6)], "gem")
        s.pxs("glint", [(6, 5), (5, 7)])
    return gem("fire", ["#6e1206", "#b82314", "#f04a2a", "#ff9a6e"], shape,
               [(8, 6), (8, 7), (7, 8), (8, 8), (7, 9), (8, 9), (9, 9), (7, 10), (8, 10), (9, 10)], "#ffc2a0", "#1e0503")


def water() -> Sprite:
    def shape(s):
        s.ellipse(8, 8, 7.4, 7.4, "gem")
        s.pxs("glint", [(4, 4), (5, 3), (3, 5)])
    return gem("water", ["#0c3a7a", "#1a66c0", "#2fa0f0", "#8fd6ff"], shape,
               [(8, 5), (8, 6), (7, 7), (8, 7), (9, 7), (7, 8), (8, 8), (9, 8), (8, 9)], "#c4ecff", "#04122a")


def earth() -> Sprite:
    def shape(s):
        s.poly([(2.4, 1), (13.6, 1), (15, 2.4), (15, 13.6), (13.6, 15), (2.4, 15), (1, 13.6), (1, 2.4)], "gem")
        s.pxs("glint", [(3, 3), (4, 3), (3, 4)])
    return gem("earth", ["#4a2a10", "#87521f", "#c4843c", "#f0bc78"], shape,
               [(5, 10), (6, 9), (7, 8), (8, 9), (9, 8), (10, 9), (11, 10), (6, 10), (7, 10), (8, 10), (9, 10), (10, 10)], "#ffe2b4", "#150a03")


def nature() -> Sprite:
    def shape(s):
        s.poly([(1, 15), (1.8, 9), (5, 4.4), (10, 1.6), (15, 1), (14.2, 7), (11, 11.6), (6, 14.4)], "gem")
        s.pxs("glint", [(5, 6), (6, 5)])
    return gem("nature", ["#174d1c", "#2a8a33", "#4cc44f", "#a2ec88"], shape,
               [(4, 12), (5, 11), (6, 10), (7, 9), (8, 8), (9, 7), (10, 6), (11, 5)], "#d4ffc0", "#05160a")


def light() -> Sprite:
    def shape(s):
        s.poly([(8, 0.2), (15.8, 8), (8, 15.8), (0.2, 8)], "gem")
        s.pxs("glint", [(6, 4), (5, 5)])
    return gem("light", ["#7a4c06", "#c98c10", "#ffcc2e", "#fff09a"], shape,
               [(8, 5), (8, 6), (5, 8), (6, 8), (7, 7), (8, 7), (9, 7), (7, 8), (8, 8), (9, 8), (10, 8), (11, 8), (7, 9), (8, 9), (9, 9), (8, 10), (8, 11)], "#fffbe0", "#1e1302")


def berry() -> Sprite:
    s = Sprite("berry", {"cherry": Material(["#6e0a1c", "#b8162e", "#ee3048", "#ff8a98"]), "stem": Material(["#5a3a1c"], flat=True),
                         "leaf": Material(["#2a7a30", "#3fae46", "#6ad85c", "#a8f08a"]), "glint": Material(["#ffffff"], flat=True)},
               outline="#1e0308", size=G)
    s.stroke([(5, 9), (7.4, 4), (9.6, 1.6)], 1.1, "stem")
    s.stroke([(11, 9), (10.6, 4.6), (9.6, 1.6)], 1.1, "stem")
    s.poly([(9.6, 1.8), (12.6, 0.4), (15, 1.6), (12.6, 3)], "leaf")
    s.ellipse(4.8, 11.4, 3.9, 3.9, "cherry")
    s.ellipse(11.4, 11, 3.9, 3.9, "cherry")
    s.pxs("glint", [(3, 10), (10, 9)])
    return s


def stone() -> Sprite:
    s = Sprite("stone", {"rock": Material(["#34353d", "#5a5c68", "#878a96", "#b6b9c4"]), "crack": Material(["#26272e"], flat=True)},
               outline="#0e0e12", size=G)
    s.poly([(3, 4), (8, 1), (13, 2.4), (15.2, 7.4), (14, 13.6), (8.6, 15.2), (2.6, 13.8), (0.8, 8.6)], "rock")
    s.pxs("crack", [(8, 3), (8, 4), (9, 5), (8, 6), (7, 7), (7, 8), (9, 6), (10, 7), (11, 8), (6, 9), (5, 10)])
    return s


SPRITES = [fire, water, earth, nature, light, berry, stone]
