"""Shared palettes and face helpers for Plotomon sprites."""
from __future__ import annotations

from pixelkit import SIZE, Material, Sprite

INK = "#140a1e"

# Element ramps (dark -> light), reused across monsters of an element.
FIRE = ["#7a1d10", "#b9341b", "#e9562c", "#ff9455"]
FLAME = ["#b3260f", "#ff6a2c", "#ffb23a", "#ffe98c"]
PEACH = ["#b8613f", "#e89b6c", "#ffcf9f", "#fff0d6"]
WATER = ["#123a7d", "#1f63b8", "#3aa0ff", "#8fd3ff"]
ICE = ["#4f86b3", "#8cc4ec", "#d2efff", "#ffffff"]
AQUA = ["#13606e", "#2a9fb0", "#6fe0e8", "#c8fbff"]
EARTH = ["#4a2e14", "#7d5323", "#b8803f", "#e0b070"]
ROCK = ["#34353d", "#585a66", "#868996", "#b8bbc6"]
MOSS = ["#2d5a1f", "#4c8a2e", "#76b843", "#a8de6a"]
CRYSTAL = ["#2e6a86", "#4fa9c4", "#9ee6f0", "#e8ffff"]
LEAF = ["#1d5a2a", "#2f8a3f", "#4ccb6b", "#9be88a"]
PINK = ["#8a2c4c", "#d0517a", "#ff8fb3", "#ffc6d8"]
GOLD = ["#8a5a0c", "#d39a17", "#ffd23c", "#fff0a0"]
CREAM = ["#a08a62", "#ecd9ae", "#fff3d6", "#ffffff"]
BONE = ["#7c6142", "#b99a6e", "#ecd6ad", "#fff6df"]


def base_materials(**extra: Material) -> dict[str, Material]:
    mats = {
        "ink": Material([INK], flat=True),
        "shine": Material(["#ffffff"], flat=True),
        "blush": Material(["#ff8fa8"], flat=True),
        "white": Material(["#ffffff"], flat=True),
    }
    mats.update(extra)
    return mats


def mirror_pts(pts):
    return list(pts) + [(SIZE - 1 - x, y) for x, y in pts]


def mirror_poly(pts):
    return [(SIZE - x, y) for x, y in pts]


def sym_poly(s: Sprite, pts, mat: str) -> None:
    """A left-side polygon and its mirror image."""
    s.poly(pts, mat)
    s.poly(mirror_poly(pts), mat)


def dot_eyes(s: Sprite, lx: int, ly: int, rx: int, ry: int | None = None, h: int = 2) -> None:
    """Two 2-wide dark eyes (h tall) with a shine on the top-left pixel of each."""
    ry = ly if ry is None else ry
    for x0, y0 in ((lx, ly), (rx, ry)):
        s.pxs("ink", [(x0 + dx, y0 + dy) for dx in (0, 1) for dy in range(h)])
        s.px(x0, y0, "shine")


def happy_eyes(s: Sprite, lx: int, y: int, rx: int) -> None:
    """Closed ^ ^ eyes, 3 px wide."""
    for x0 in (lx, rx):
        s.pxs("ink", [(x0, y), (x0 + 1, y - 1), (x0 + 2, y)])


def sparkle(s: Sprite, x: int, y: int, mat: str = "spark") -> None:
    """A small + shaped sparkle."""
    s.pxs(mat, [(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])


def star_points(cx: float, cy: float, r_out: float, r_in: float, n: int = 5, rot: float = -90):
    import math

    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts
