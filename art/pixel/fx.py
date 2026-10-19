"""Impact effects: one 6-frame sprite sheet per element or status (32x32 frames).

Each effect is a burst in its own shape (fire licks upward, light is a
four-point star, ice six-point, earth chunky) drawn with a 4-colour ramp,
plus particles in character (embers rise, droplets fall, rocks arc, leaves
orbit, sparkles blink, plus signs float up, bubbles pop). Soft edges are
checkerboard-dithered instead of blurred, so the effects stay pixel art on
the game's palette. The client plays a sheet with steps(6); see `fx.impact`
in web/index.html.

Frames: 0 flash, 1 swell, 2 full, 3 hollowing, 4 breaking up, 5 last bits.
"""
from __future__ import annotations

import math
import random

from PIL import Image

from pixelkit import hex_rgb

F = 32  # frame size
N = 6  # frames
C = 15.5  # centre

RAMPS = {
    "fire": ["#7a1d10", "#e9562c", "#ffb23a", "#ffe98c"],
    "water": ["#123a7d", "#3aa0ff", "#8fd3ff", "#e8f8ff"],
    "earth": ["#4a2e14", "#9a6a34", "#d8a860", "#f4dca8"],
    "nature": ["#1d5a2a", "#3fae4c", "#8be27f", "#e4ffd0"],
    "light": ["#a8740e", "#ffcc33", "#fff0a0", "#ffffff"],
    "heal": ["#1f7a3a", "#4fd17a", "#b8f7c4", "#ffffff"],
    "shield": ["#1f5a8a", "#5ab8f0", "#bfe9ff", "#ffffff"],
    "ice": ["#4f86b3", "#8cc4ec", "#d2efff", "#ffffff"],
    "poison": ["#2e4a12", "#6fae2a", "#c4e85a", "#f4ffc0"],
}

RADIUS = [3, 6, 9, 11, 12, 13]  # outer edge per frame
HOLLOW = [0, 0, 3, 7, 10, 12]  # inner edge per frame (the burst opens up)


def _shape(name: str, theta: float, dy: float, d: float, t: int) -> float:
    """Radius multiplier by direction: what makes each burst look like its element."""
    if name == "fire":  # taller upward, flickering tongues
        up = -dy / d if d else 0
        return 0.9 + 0.6 * max(0.0, up) ** 1.5 + 0.18 * abs(math.sin(4 * theta + t * 1.7))
    if name in ("light", "heal"):  # four-point star
        return 0.5 + 0.55 * abs(math.cos(2 * theta)) ** 3
    if name == "ice":  # six-point crystal
        return 0.55 + 0.5 * abs(math.cos(3 * theta)) ** 4
    if name == "earth":  # lumpy
        return 0.85 + 0.22 * math.sin(3 * theta + 1.3) * math.cos(2 * theta)
    if name == "nature":  # a five-petal bloom that turns as it opens
        return 0.62 + 0.42 * (1 + math.cos(5 * theta + t * 0.35)) / 2
    if name == "water":  # a rippled splash ring
        return 1 + 0.1 * math.sin(8 * theta)
    return 1.0


def _burst(img: Image.Image, f: int, name: str, ramp: list[tuple[int, int, int]], rnd: random.Random) -> None:
    holes = {(rnd.randrange(F), rnd.randrange(F)) for _ in range(160)}
    for y in range(F):
        for x in range(F):
            # Earth is drawn in 2x2 chunks so it reads as rock, not fire.
            sx, sy = (x // 2 * 2 + 0.5, y // 2 * 2 + 0.5) if name == "earth" else (x, y)
            dx, dy = sx - C, sy - C
            d = math.hypot(dx, dy)
            theta = math.atan2(dy, dx)
            m = _shape(name, theta, dy, d, f)
            outer, inner = RADIUS[f] * m, HOLLOW[f] * m
            if not inner <= d <= outer:
                continue
            u = (d - inner) / max(0.01, outer - inner)  # 0 inner edge .. 1 outer edge
            if u > 0.78 and (x + y) % 2:  # soft outer edge: dithered, never blurred
                continue
            if f >= 4 and (x, y) in holes or f == 5 and (x * 7 + y * 3) % 3:
                continue
            idx = 3 - int(u * 3.99) - (1 if f >= 3 else 0) - (1 if f >= 5 else 0)
            if f == 0:
                idx = 3
            img.putpixel((f * F + x, y), ramp[max(0, idx)] + (255,))


def _put(img: Image.Image, f: int, x: float, y: float, c: tuple[int, int, int], size: int = 1) -> None:
    for oy in range(size):
        for ox in range(size):
            px, py = round(x) + ox, round(y) + oy
            if 0 <= px < F and 0 <= py < F:
                img.putpixel((f * F + px, py), c + (255,))


def _plus(img: Image.Image, f: int, x: float, y: float, c: tuple[int, int, int], core: tuple[int, int, int]) -> None:
    for ox, oy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
        _put(img, f, x + ox, y + oy, core if (ox, oy) == (0, 0) else c)


def _particles(img: Image.Image, f: int, name: str, ramp: list[tuple[int, int, int]], rnd: random.Random) -> None:
    hi, mid, lo = ramp[3], ramp[2], ramp[1]
    if f == 0:
        return
    if name == "fire":  # embers rise and drift
        for i in range(9):
            a = -math.pi / 2 + (i - 4) * 0.32
            r = 4 + f * 2.2
            _put(img, f, C + math.cos(a) * r + math.sin(i + f) * 1.2, C + math.sin(a) * r - f * 1.4, hi if (i + f) % 2 else mid)
    elif name == "water":  # droplets thrown out, then falling
        for i in range(10):
            a = math.pi + (i + 0.5) * math.pi / 10
            v = 2.4 + (i % 3) * 0.5
            x, y = C + math.cos(a) * v * f, C + math.sin(a) * v * f + 0.55 * f * f
            _put(img, f, x, y, mid, 2 if i % 3 == 0 and f < 4 else 1)
    elif name == "earth":  # rock chunks arc out under gravity
        rock = hex_rgb("#868996")
        for i in range(7):
            a = math.pi + (i + 0.5) * math.pi / 7
            v = 2 + (i % 2) * 0.8
            _put(img, f, C + math.cos(a) * v * f, C + math.sin(a) * v * f + 0.5 * f * f, rock if i % 2 else lo, 2)
    elif name == "nature":  # leaves orbit outward
        for i in range(6):
            a = i * math.pi / 3 + f * 0.7
            r = 3 + f * 2
            x, y = C + math.cos(a) * r, C + math.sin(a) * r
            _put(img, f, x, y, lo)
            _put(img, f, x + 1, y - 1, mid)
    elif name in ("light", "ice"):  # sparkles blink in and out around it
        for i in range(6):
            if (i + f) % 2:
                continue
            a = i * math.pi / 3 + 0.4
            r = 6 + f * 1.8
            _plus(img, f, C + math.cos(a) * r, C + math.sin(a) * r, mid, hi)
    elif name == "heal":  # plus signs float up
        for i, x0 in enumerate((8, 16, 23, 12, 20)):
            y = 26 - f * 3.2 - i * 2
            if 2 <= y <= 29 and f >= 1 + i % 2:
                _plus(img, f, x0, y, lo, hi)
    elif name == "poison":  # bubbles rise and pop
        for i, x0 in enumerate((9, 15, 21, 12, 19)):
            y = 24 - f * 2.8 - i * 1.5
            if f >= 4 + i % 2:  # popped: a few specks
                for ox, oy in ((-2, 0), (2, 0), (0, -2)):
                    _put(img, f, x0 + ox, y + oy, mid)
                continue
            for ox, oy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                _put(img, f, x0 + ox, y + oy, mid)
            _put(img, f, x0 - 1, y - 1, hi)


def _hexagon(img: Image.Image, f: int, ramp: list[tuple[int, int, int]]) -> None:
    """Shield: a hexagon outline swelling out, a dithered pane inside early on, then fragments."""
    r = [4, 7, 10, 12, 13, 14][f]
    pts = [(C + r * math.cos(math.pi / 6 + k * math.pi / 3), C + r * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    color = ramp[3] if f < 2 else ramp[2] if f < 4 else ramp[1]
    for k in range(6):
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 6]
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for s in range(steps + 1):
            if f >= 4 and (s + k) % 3 == 0:  # breaking up
                continue
            _put(img, f, x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps, color)
    if f <= 2:
        for y in range(F):
            for x in range(F):
                if (x + y) % 2 == 0 and math.hypot(x - C, y - C) < r * 0.8 and (x + y) % 4 == 0:
                    _put(img, f, x, y, ramp[2])


def sheet(name: str) -> Image.Image:
    rnd = random.Random(sum(map(ord, name)))  # stable across runs (hash() is salted)
    ramp = [hex_rgb(c) for c in RAMPS[name]]
    img = Image.new("RGBA", (F * N, F), (0, 0, 0, 0))
    for f in range(N):
        if name == "shield":
            _hexagon(img, f, ramp)
        elif name in ("heal", "poison"):
            if f <= 2:  # a small burst under the floating bits
                _burst(img, f, "light" if name == "heal" else "water", ramp, rnd)
        else:
            _burst(img, f, name, ramp, rnd)
        _particles(img, f, name, ramp, rnd)
    return img


NAMES = list(RAMPS)


# ---------------------------------------------------------------- statuses
# Small loops that sit on the monsters while a status lasts (4 frames, 12x12),
# plus two still overlays: the bubble shell (48x48) and the shield (18x22).
S = 12


def _loop(name: str) -> Image.Image:
    img = Image.new("RGBA", (S * 4, S), (0, 0, 0, 0))

    def put(f: int, x: float, y: float, c: str) -> None:
        px, py = round(x), round(y)
        if 0 <= px < S and 0 <= py < S:
            img.putpixel((f * S + px, py), hex_rgb(c) + (255,))

    for f in range(4):
        if name == "burn":  # a flickering flame: wide red base, orange body, a yellow core, the tip sways
            sway = [0, 1, 0, -1][f]
            rows = [(10, 2, "#b3260f"), (9, 3, "#e9562c"), (8, 3, "#ff6a2c"), (7, 3, "#ff6a2c"), (6, 2, "#ff6a2c"), (5, 2, "#ffb23a"), (4, 1, "#ffb23a")]
            for y, half, c in rows:
                shift = sway if y <= 5 else 0
                for x in range(6 - half + shift, 6 + half + shift):
                    put(f, x, y, c)
            put(f, 5 + sway, 3, "#ffe98c")
            put(f, 5 + sway * 2, 2, "#ffe98c")
            for x, y in ((5, 8), (6, 8), (5, 7), (5, 9), (6, 9)):
                put(f, x, y, "#ffe98c")
        elif name == "poison":  # a bubble wobbles up and pops
            y = 9 - f * 2.4
            if f < 3:
                for ox, oy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                    put(f, 6 + ox, y + oy, "#8be27f")
                put(f, 5, y - 1, "#e4ffd0")
                put(f, 3, 10 - f, "#6fae2a")
            else:
                for ox, oy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
                    put(f, 6 + ox, y + oy, "#8be27f")
        elif name == "regen":  # a plus floats up and fades
            y = 9 - f * 2.4
            core, arm = ("#ffffff", "#92e27c") if f < 3 else ("#92e27c", "#4fd17a")
            for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                if f < 3 or (ox + oy) % 2 == 0:
                    put(f, 6 + ox, y + oy, arm)
            put(f, 6, y, core)
    return img


def _bubble_shell() -> Image.Image:
    """A floating soap-bubble ring with a dithered rim and a highlight top-left."""
    n = 48
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if 22.2 <= d < 23.4:
                img.putpixel((x, y), hex_rgb("#bfefff") + (255,))
            elif 20.8 <= d < 22.2 and (x + y) % 2 == 0:
                img.putpixel((x, y), hex_rgb("#8fd3ff") + (255,))
            a = math.atan2(y - c, x - c)
            if 19.2 <= d < 20.8 and -2.6 < a < -1.9:
                img.putpixel((x, y), (255, 255, 255, 255))
    return img


def _shield_wall() -> Image.Image:
    """A heater shield (18x22): straight top, sides curving in to a point, dark outline,
    silver-blue rim, the face split light and dark down the middle (lit from the left),
    a glint top left and a small diamond boss."""
    w, h = 18, 22
    ink, rim, dark, face, white = "#12305a", "#bfe9ff", "#2f7cc0", "#5ab8f0", "#ffffff"

    def half(y: int) -> float:  # half-width at row y, outline included
        if y < 10:
            return 9 if y else 8  # bevelled top corners
        t = (y - 9) / (h - 9)
        return 9 * (1 - t ** 1.7)

    inside = {(x, y) for y in range(h) for x in range(w) if abs(x + 0.5 - w / 2) <= half(y) + 0.01}
    out = lambda x, y: (x, y) not in inside
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for x, y in inside:
        if any(out(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c = ink
        elif any(out(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)) or any(out(x + dx, y + dy) for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2))):
            c = rim
        else:
            c = face if x < w // 2 else dark
        img.putpixel((x, y), hex_rgb(c) + (255,))
    for i in range(3):  # glint
        img.putpixel((4 + i, 6 - i), hex_rgb(white) + (255,))
    img.putpixel((4, 7), hex_rgb(white) + (255,))
    for x, y in ((8, 8), (9, 8), (7, 9), (8, 9), (9, 9), (10, 9), (8, 10), (9, 10)):  # boss
        img.putpixel((x, y), hex_rgb(rim) + (255,))
    img.putpixel((8, 8), hex_rgb(white) + (255,))
    for x, y in ((10, 10), (9, 11), (8, 11)):
        img.putpixel((x, y), hex_rgb(ink) + (255,))
    return img


def status_sheets() -> dict[str, Image.Image]:
    return {"burn": _loop("burn"), "poison": _loop("poison"), "regen": _loop("regen"),
            "bubble": _bubble_shell(), "shield": _shield_wall()}
