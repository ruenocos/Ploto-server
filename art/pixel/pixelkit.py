"""
Tiny pixel-art kit for Plotomon sprites.

A sprite is authored as a grid of *materials* (fur, mane, horn, eye, ...), built
from a few shapes plus hand-placed pixels. Rendering then applies the same rules
to every sprite so the set stays consistent:

  * one light source, top-left: lit edges step up the material's ramp, shadowed
    edges (and the lower part of each shape) step down;
  * a 4-colour ramp per material, plus an optional extra highlight;
  * coloured outlines: a darker version of the colour inside, lighter on the lit
    side (selective outlining), so there's no flat black border;
  * "flat" materials (eyes, teeth, cheeks) are drawn exactly as authored.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from PIL import Image

SIZE = 32


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def mix(a: str, b: str, t: float) -> tuple[int, int, int]:
    ra, rb = hex_rgb(a), hex_rgb(b)
    return tuple(round(ra[i] + (rb[i] - ra[i]) * t) for i in range(3))  # type: ignore[return-value]


@dataclass
class Material:
    ramp: list[str]  # dark -> light (4 colours); flat materials use ramp[0]
    flat: bool = False
    group: str | None = None  # materials in one group shade as one surface
    floating: bool = False  # drawn on top with no outline (halos, glows, sparks)


@dataclass
class Sprite:
    name: str
    materials: dict[str, Material]
    outline: str
    size: int = SIZE
    grid: list[list[str | None]] = field(default_factory=list)
    highlights: list[tuple[int, int]] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.grid:
            self.grid = [[None] * self.size for _ in range(self.size)]

    # -- authoring --------------------------------------------------------------
    def px(self, x: int, y: int, mat: str | None) -> None:
        if 0 <= x < self.size and 0 <= y < self.size:
            self.grid[y][x] = mat

    def pxs(self, mat: str | None, pts) -> None:
        for x, y in pts:
            self.px(x, y, mat)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, mat: str) -> None:
        for y in range(self.size):
            for x in range(self.size):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0:
                    self.grid[y][x] = mat

    def poly(self, pts: list[tuple[float, float]], mat: str) -> None:
        for y in range(self.size):
            for x in range(self.size):
                if _inside(x + 0.5, y + 0.5, pts):
                    self.grid[y][x] = mat

    def stroke(self, pts: list[tuple[float, float]], width: float, mat: str) -> None:
        """A thick polyline (stamped discs)."""
        r = width / 2
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = max(1, int(math.hypot(x1 - x0, y1 - y0) * 3))
            for i in range(steps + 1):
                t = i / steps
                cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                for y in range(int(cy - r - 1), int(cy + r + 2)):
                    for x in range(int(cx - r - 1), int(cx + r + 2)):
                        if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                            self.px(x, y, mat)

    def mirror(self) -> None:
        """Copy the left half onto the right half (for symmetric bodies)."""
        for y in range(self.size):
            for x in range(self.size // 2):
                self.grid[y][self.size - 1 - x] = self.grid[y][x]

    # -- rendering --------------------------------------------------------------
    def _group(self, mat: str | None) -> str | None:
        if mat is None:
            return None
        return self.materials[mat].group or mat

    def render(self) -> Image.Image:
        img = Image.new("RGBA", (self.size, self.size), (0, 0, 0, 0))
        floating = [(x, y, self.materials[m]) for y, row in enumerate(self.grid) for x, m in enumerate(row) if m and self.materials[m].floating]
        # Floating pixels sit outside the silhouette: no outline, no shading.
        g = [[None if (m and self.materials[m].floating) else m for m in row] for row in self.grid]
        get = lambda x, y: g[y][x] if 0 <= x < self.size and 0 <= y < self.size else None  # noqa: E731

        # Bounding boxes per group, for the "lower part is darker" gradient.
        boxes: dict[str, list[int]] = {}
        for y in range(self.size):
            for x in range(self.size):
                grp = self._group(g[y][x])
                if grp is None:
                    continue
                b = boxes.setdefault(grp, [x, y, x, y])
                b[0], b[1], b[2], b[3] = min(b[0], x), min(b[1], y), max(b[2], x), max(b[3], y)

        for y in range(self.size):
            for x in range(self.size):
                mat = g[y][x]
                if mat is None:
                    continue
                m = self.materials[mat]
                if m.flat:
                    img.putpixel((x, y), (*hex_rgb(m.ramp[0]), 255))
                    continue
                grp = self._group(mat)
                other = lambda dx, dy: self._group(get(x + dx, y + dy)) != grp  # noqa: E731
                level = 2
                if other(-1, 0) or other(0, -1):
                    level += 1
                if other(1, 0) or other(0, 1):
                    level -= 1
                x0, y0, x1, y1 = boxes[grp]
                v = (y - y0) / max(1, y1 - y0)
                u = (x - x0) / max(1, x1 - x0)
                if v + 0.35 * u > 0.95:
                    level -= 1
                level = max(0, min(len(m.ramp) - 1, level))
                img.putpixel((x, y), (*hex_rgb(m.ramp[level]), 255))

        for x, y in self.highlights:
            img.putpixel((x, y), (255, 255, 255, 255))

        # Coloured outline around the whole silhouette.
        out = img.copy()
        for y in range(self.size):
            for x in range(self.size):
                if g[y][x] is not None:
                    continue
                neighbours = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if get(x + dx, y + dy) is not None]
                if not neighbours:
                    continue
                dx, dy = neighbours[0]
                inner = self.materials[get(x + dx, y + dy)]  # type: ignore[index]
                lit_side = any(d in neighbours for d in ((1, 0), (0, 1)))  # body is right/below: we're on the lit edge
                t = 0.45 if lit_side else 0.75
                out.putpixel((x, y), (*mix(inner.ramp[0], self.outline, t), 255))
        for x, y, m in floating:
            out.putpixel((x, y), (*hex_rgb(m.ramp[0]), 255))
        return out


def _inside(x: float, y: float, pts: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside
