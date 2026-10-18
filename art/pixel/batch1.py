"""
Test batch: Scorchpaw (fire), Krakling (water), Lumoth (light) at 32x32.

Run: python3 art/pixel/batch1.py <out_dir>
Writes each sprite as a 32x32 PNG plus a preview sheet at 1x/2x/4x.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

from pixelkit import SIZE, Material, Sprite

INK = "#140a1e"


def mirror_pts(pts):
    """Points plus their mirror image across the vertical centre line."""
    return list(pts) + [(SIZE - 1 - x, y) for x, y in pts]


def mirror_poly(pts):
    return [(SIZE - x, y) for x, y in pts]


# ------------------------------------------------------------------ Scorchpaw
def scorchpaw() -> Sprite:
    s = Sprite(
        "scorchpaw",
        {
            "fur": Material(["#7a1d10", "#b9341b", "#e9562c", "#ff9455"]),
            "belly": Material(["#b8613f", "#e89b6c", "#ffcf9f", "#fff0d6"]),
            "mane": Material(["#2a0609", "#541014", "#841b1d", "#b8352a"]),
            "horn": Material(["#7c6142", "#b99a6e", "#ecd6ad", "#fff6df"]),
            "flame": Material(["#b3260f", "#ff6a2c", "#ffb23a", "#ffe98c"]),
            "nose": Material([INK], flat=True),
            "brow": Material(["#3a0a0c"], flat=True),
            "eye": Material(["#ffd23c"], flat=True),
            "pupil": Material([INK], flat=True),
            "fang": Material(["#ffffff"], flat=True),
        },
        outline="#1a0606",
    )
    # Flame tail, behind the body on the right.
    s.poly([(20, 28), (24.5, 26.5), (27, 22), (25.5, 17.5), (28.5, 19.5), (30, 14.5), (31.5, 21), (30, 26), (25, 29.8)], "flame")
    # Spiky mane framing the head (symmetric).
    mane_left = [(16, 3), (13.5, 1.5), (11.5, 4.5), (8, 2.5), (7.5, 6.5), (3, 5.5), (5, 9.5), (0.8, 11.5), (4.5, 13.5), (1.5, 18), (6.5, 17.5), (6, 21.5), (10, 20)]
    s.poly(mane_left + list(reversed(mirror_poly(mane_left))), "mane")
    # The mane's spikes burn at the tips.
    for x, y in mirror_pts([(13, 2), (12, 3), (8, 3), (8, 4), (3, 6), (4, 6), (1, 11), (2, 11), (2, 17), (3, 17)]):
        if s.grid[y][x] == "mane":
            s.px(x, y, "flame")
    # Horns, curving up and out.
    horn = [(9.5, 8.5), (11.5, 7), (8.6, 2.6), (6.8, 0.6), (7.4, 4.6)]
    s.poly(horn, "horn")
    s.poly(mirror_poly(horn), "horn")
    # Sitting body, belly, paws.
    s.ellipse(16, 24.5, 8, 6.6, "fur")
    s.ellipse(16, 25.8, 4.2, 4.6, "belly")
    s.ellipse(11.4, 29.6, 2.7, 1.9, "fur")
    s.ellipse(20.6, 29.6, 2.7, 1.9, "fur")
    # Head and muzzle.
    s.ellipse(16, 12.8, 9, 7.6, "fur")
    s.ellipse(16, 16.6, 4.4, 3.1, "belly")
    # Face: angry brows slanting down to the middle, glaring eyes, fangs.
    s.pxs("brow", mirror_pts([(9, 9), (10, 9), (11, 10), (12, 10), (13, 11)]))
    s.pxs("eye", mirror_pts([(10, 11), (11, 11), (12, 11), (10, 12), (11, 12), (12, 12), (13, 12)]))
    s.pxs("pupil", mirror_pts([(12, 11), (12, 12)]))
    s.pxs("nose", [(15, 14), (16, 14), (15, 15), (16, 15)])
    s.pxs("pupil", [(14, 17), (15, 17), (16, 17), (17, 17)])
    s.pxs("fang", [(14, 18), (17, 18)])
    s.highlights += [(15, 14)]
    # Paw toes.
    s.pxs("brow", [(10, 30), (12, 30), (19, 30), (21, 30)])
    return s


# ------------------------------------------------------------------ Krakling
def krakling() -> Sprite:
    s = Sprite(
        "krakling",
        {
            "body": Material(["#123a7d", "#1f63b8", "#3aa0ff", "#8fd3ff"]),
            "tent": Material(["#123a7d", "#1f63b8", "#3aa0ff", "#8fd3ff"]),
            "spot": Material(["#0f2f6b", "#174f9a", "#2a7fd6", "#4d9fe8"]),
            "sucker": Material(["#9cd6ff"], flat=True),
            "white": Material(["#ffffff"], flat=True),
            "pupil": Material(["#0b1633"], flat=True),
            "blush": Material(["#ff8fb3"], flat=True),
            "mouth": Material(["#0b1633"], flat=True),
        },
        outline="#071026",
    )
    # Five stubby tentacles, curling out at the tips.
    left = [
        [(8.5, 19), (6.5, 22.5), (4.2, 25), (3, 27.6), (4, 29.7), (6.3, 29.2)],  # outer: curls outward
        [(12.5, 20.5), (11.6, 24), (11, 27), (12.3, 29.5), (14.3, 28.7)],  # inner: curls in
    ]
    for path in left:
        s.stroke(path, 2.8, "tent")
        s.stroke([(SIZE - x, y) for x, y in path], 2.8, "tent")
    # Dome mantle with a wider skirt where the tentacles start.
    s.ellipse(16, 12.6, 11, 9.6, "body")
    s.ellipse(16, 19.4, 10.2, 3.2, "body")
    # Spots (asymmetric).
    s.pxs("spot", [(8, 7), (9, 7), (8, 8), (13, 4), (14, 4), (21, 5), (22, 5), (22, 6), (24, 10), (25, 10), (25, 11), (7, 14)])
    # Suckers on the inner side of the tentacles.
    for x, y in mirror_pts([(5, 25), (11, 26)]):
        if s.grid[y][x] == "tent":
            s.px(x, y, "sucker")
    # Big glossy eyes: dark, with highlights on the top-left of each.
    s.ellipse(11.6, 13.8, 2.4, 3.1, "pupil")
    s.ellipse(20.4, 13.8, 2.4, 3.1, "pupil")
    s.pxs("white", [(10, 12), (11, 12), (10, 13), (12, 15), (19, 12), (20, 12), (19, 13), (21, 15)])
    s.pxs("blush", [(7, 17), (8, 17), (23, 17), (24, 17)])
    s.pxs("mouth", [(15, 18), (16, 18)])
    return s


# ------------------------------------------------------------------ Lumoth
def lumoth() -> Sprite:
    s = Sprite(
        "lumoth",
        {
            "wing": Material(["#8a5a0c", "#d39a17", "#ffd23c", "#fff0a0"]),
            "wing2": Material(["#8a2c4c", "#d0517a", "#ff8fb3", "#ffc6d8"]),
            "fuzz": Material(["#a08a62", "#ecd9ae", "#fff3d6", "#ffffff"]),
            "body": Material(["#7a5a14", "#c49a2a", "#f0c850", "#ffe48a"]),
            "vein": Material(["#c98a14"], flat=True),
            "ant": Material(["#7a4e12", "#b8801f", "#e8b84a", "#ffe08a"]),
            "dot": Material(["#fff8dc"], flat=True),
            "halo": Material(["#fff6a8"], flat=True, floating=True),
            "eye": Material([INK], flat=True),
            "shine": Material(["#ffffff"], flat=True),
            "blush": Material(["#ff8fa3"], flat=True),
        },
        outline="#2a1606",
    )
    upper = [(14, 12), (10, 6), (5, 4), (1.5, 7), (1, 12), (3.5, 16.5), (9, 17.5), (14, 16)]
    lower = [(14, 17), (8.5, 18), (5, 21), (5.5, 25.5), (9, 27.6), (12.5, 25.8), (14, 21.5)]
    s.poly(lower, "wing2")
    s.poly(mirror_poly(lower), "wing2")
    s.poly(upper, "wing")
    s.poly(mirror_poly(upper), "wing")
    # Veins fanning out from the body, and pale dots on the hindwings.
    s.pxs("vein", mirror_pts([(10, 10), (9, 9), (8, 9), (7, 8), (6, 8), (5, 7), (10, 14), (9, 14), (8, 15), (7, 15), (6, 15)]))
    s.pxs("dot", mirror_pts([(8, 22), (9, 24), (11, 23)]))
    # Yellow fuzzy body under a white fluffy head and ruff.
    s.ellipse(16, 21, 3.3, 7, "body")
    s.ellipse(16, 15.4, 4.4, 1.8, "fuzz")
    s.ellipse(16, 11, 5, 4.4, "fuzz")
    # Feathery antennae and a floating halo.
    s.pxs("ant", mirror_pts([(13, 7), (12, 6), (11, 5), (10, 4), (9, 4), (11, 4), (10, 3)]))
    s.pxs("halo", [(14, 1), (15, 1), (16, 1), (17, 1), (12, 2), (13, 2), (18, 2), (19, 2), (14, 3), (15, 3), (16, 3), (17, 3)])
    # Big dark eyes with a shine, and blush.
    s.pxs("eye", [(13, 10), (14, 10), (13, 11), (14, 11), (17, 10), (18, 10), (17, 11), (18, 11)])
    s.pxs("shine", [(13, 10), (17, 10)])
    s.pxs("blush", [(12, 12), (19, 12)])
    # Segments on the abdomen.
    s.pxs("vein", [(14, 21), (15, 21), (16, 21), (17, 21), (15, 24), (16, 24)])
    return s


SPRITES = [scorchpaw, krakling, lumoth]


def preview(sprites: list[tuple[str, Image.Image]], out: Path) -> None:
    """Each sprite at 1x, 2x and 4x on the game's panel colour, plus a chip mock-up."""
    pad, gap = 16, 24
    scales = (1, 2, 4)
    col_w = sum(SIZE * s for s in scales) + gap * len(scales) + 96
    sheet = Image.new("RGBA", (pad * 2 + col_w, pad * 2 + len(sprites) * (SIZE * 4 + gap)), (21, 25, 39, 255))
    d = ImageDraw.Draw(sheet)
    for row, (name, img) in enumerate(sprites):
        y = pad + row * (SIZE * 4 + gap)
        x = pad
        for sc in scales:
            big = img.resize((SIZE * sc, SIZE * sc), Image.NEAREST)
            sheet.alpha_composite(big, (x, y + (SIZE * 4 - SIZE * sc) // 2))
            x += SIZE * sc + gap
        # In-game chip: 64px sprite in a ring, like the monster chips.
        cx, cy, r = x + 40, y + SIZE * 2, 40
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(34, 40, 57, 255), outline=(255, 107, 61, 255), width=4)
        sheet.alpha_composite(img.resize((64, 64), Image.NEAREST), (cx - 32, cy - 32))
    sheet.save(out)


def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out_dir.mkdir(parents=True, exist_ok=True)
    rendered = []
    for make in SPRITES:
        s = make()
        img = s.render()
        img.save(out_dir / f"{s.name}.png")
        rendered.append((s.name, img))
    preview(rendered, out_dir / "preview.png")
    print("wrote", ", ".join(n for n, _ in rendered))


if __name__ == "__main__":
    main()
