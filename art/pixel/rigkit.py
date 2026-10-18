"""
Rigged sprites: a monster split into parts that the client animates separately.

A Rig is drawn in the 32x32 *design* space used by the original sprites, then
scaled per evolution stage onto a 48x48 canvas, standing on the same ground
line. Each part (body, head, tail, wings, ...) is its own layer with its own
outline, a pivot (where it rotates/scales from) and a parent (a head carries its
ears; the body carries the head). Parts are exported cropped to their bounds.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from PIL import Image

from pixelkit import Material, Sprite

CANVAS = 48
ANCHOR = (24.0, 47.0)  # where design (16, 31) lands: centre of the feet
STAGE_SCALE = (1.0, 1.2, 1.38)


@dataclass
class PartInfo:
    name: str
    role: str  # animation preset on the client: body, head, tail, wing-l, wing-r, arm-l, arm-r, ear-l, ear-r, fx, legs, tent-l, tent-r
    parent: str | None
    z: int  # order among siblings; negative = behind the parent's own image
    pivot: tuple[float, float]  # canvas pixels


class Rig:
    def __init__(self, name: str, materials: dict[str, Material], outline: str, stage: int):
        self.name = name
        self.materials = materials
        self.outline = outline
        self.stage = stage
        self.k = STAGE_SCALE[stage]
        self.parts: dict[str, tuple[PartInfo, Sprite]] = {}
        self.order: list[str] = []
        self.cur: Sprite | None = None

    # -- coordinates -------------------------------------------------------------
    def T(self, x: float, y: float) -> tuple[float, float]:
        return ANCHOR[0] + (x - 16) * self.k, ANCHOR[1] + (y - 31) * self.k

    # -- parts -------------------------------------------------------------------
    def part(self, name: str, role: str, pivot: tuple[float, float], parent: str | None = None, z: int = 0) -> "Rig":
        """Start (or switch to) a part; following drawing goes onto its layer."""
        if name not in self.parts:
            info = PartInfo(name, role, parent, z, self.T(*pivot))
            self.parts[name] = (info, Sprite(f"{self.name}-{name}", self.materials, self.outline, size=CANVAS))
            self.order.append(name)
        self.cur = self.parts[name][1]
        return self

    # -- drawing (design coordinates) ---------------------------------------------
    def ellipse(self, cx: float, cy: float, rx: float, ry: float, mat: str) -> None:
        X, Y = self.T(cx, cy)
        self.cur.ellipse(X, Y, rx * self.k, ry * self.k, mat)

    def poly(self, pts, mat: str) -> None:
        self.cur.poly([self.T(x, y) for x, y in pts], mat)

    def stroke(self, pts, width: float, mat: str) -> None:
        self.cur.stroke([self.T(x, y) for x, y in pts], width * self.k, mat)

    def pxs(self, mat: str | None, pts) -> None:
        """Hand-placed design pixels; each becomes a k-sized block on the canvas."""
        k = self.k
        for x, y in pts:
            X0, Y0 = self.T(x, y)
            X1, Y1 = X0 + k, Y0 + k
            for Y in range(math.floor(Y0), math.ceil(Y1)):
                for X in range(math.floor(X0), math.ceil(X1)):
                    if X0 <= X + 0.5 < X1 and Y0 <= Y + 0.5 < Y1:
                        self.cur.px(X, Y, mat)

    def px(self, x: int, y: int, mat: str | None) -> None:
        self.pxs(mat, [(x, y)])

    def mat_at(self, x: int, y: int) -> str | None:
        X, Y = self.T(x + 0.5, y + 0.5)
        X, Y = int(X), int(Y)
        return self.cur.grid[Y][X] if 0 <= X < CANVAS and 0 <= Y < CANVAS else None

    # -- output --------------------------------------------------------------------
    def tree_order(self) -> list[str]:
        """Parts in paint order (children with z<0 before their parent, others after)."""
        kids: dict[str | None, list[str]] = {}
        for n in self.order:
            kids.setdefault(self.parts[n][0].parent, []).append(n)
        out: list[str] = []

        def visit(n: str) -> None:
            mine = sorted(kids.get(n, []), key=lambda c: self.parts[c][0].z)
            for c in mine:
                if self.parts[c][0].z < 0:
                    visit(c)
            out.append(n)
            for c in mine:
                if self.parts[c][0].z >= 0:
                    visit(c)

        for n in sorted(kids.get(None, []), key=lambda c: self.parts[c][0].z):
            visit(n)
        return out

    def render_parts(self) -> list[tuple[PartInfo, Image.Image, tuple[int, int]]]:
        """Each part rendered and cropped: (info, image, (offset_x, offset_y))."""
        out = []
        for n in self.order:
            info, spr = self.parts[n]
            img = spr.render()
            box = img.getbbox()
            if not box:
                continue
            out.append((info, img.crop(box), (box[0], box[1])))
        return out

    def flatten(self) -> Image.Image:
        rendered = {info.name: (img, off) for info, img, off in self.render_parts()}
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        for n in self.tree_order():
            if n in rendered:
                img, off = rendered[n]
                canvas.alpha_composite(img, off)
        return canvas


# -- helpers in design space ----------------------------------------------------------
def mirror_pts(pts):
    return list(pts) + [(31 - x, y) for x, y in pts]


def mirror_poly(pts):
    return [(32 - x, y) for x, y in pts]


def sym_poly(r: Rig, pts, mat: str) -> None:
    r.poly(pts, mat)
    r.poly(mirror_poly(pts), mat)


def dot_eyes(r: Rig, lx: int, ly: int, rx: int, h: int = 2) -> None:
    for x0 in (lx, rx):
        r.pxs("ink", [(x0 + dx, ly + dy) for dx in (0, 1) for dy in range(h)])
        r.px(x0, ly, "shine")


def happy_eyes(r: Rig, lx: int, y: int, rx: int) -> None:
    for x0 in (lx, rx):
        r.pxs("ink", [(x0, y), (x0 + 1, y - 1), (x0 + 2, y)])


def sparkle(r: Rig, x: int, y: int, mat: str = "spark") -> None:
    r.pxs(mat, [(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])


def star_points(cx: float, cy: float, r_out: float, r_in: float, n: int = 5, rot: float = -90):
    pts = []
    for i in range(n * 2):
        rr = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts
