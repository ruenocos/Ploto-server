"""Light rigs: Lumowl, Glintling, Lumistag, Lumoth (three stages each)."""
from __future__ import annotations

from common import CREAM, GOLD, base_materials
from pixelkit import Material
from rigkit import Rig, dot_eyes, mirror_poly, mirror_pts, sparkle, star_points, sym_poly

PRISM = ["#ff6b8a", "#ffb84a", "#8ce06a", "#5ac8ff", "#b48aff"]


def lumowl(stage: int) -> Rig:
    r = Rig("lumowl", base_materials(feather=Material(["#6e4a1a", "#a8762a", "#dcae52", "#ffe08e"]), wing=Material(["#4e3412", "#7e5620", "#ac8034", "#d4a656"]),
                                     face=Material(CREAM), iris=Material(["#ffb21e"], flat=True), beak=Material(["#ff8a2a"], flat=True),
                                     mark=Material(["#8a5e22"], flat=True), star=Material(["#fffbe0"], flat=True),
                                     **{f"p{i}": Material([c], flat=True) for i, c in enumerate(PRISM)}), "#160c02", stage)
    r.part("feet", "legs", pivot=(16, 30), z=1)
    r.pxs("beak", [(13, 29), (14, 29), (18, 29), (19, 29)])
    for side, cx in (("wing-l", 6.4), ("wing-r", 25.6)):
        r.part(side, side, pivot=(cx + (2 if side == "wing-l" else -2), 15), z=-1)
        g = 1 + 0.15 * stage
        r.ellipse(cx - (0.8 * stage if side == "wing-l" else -0.8 * stage), 20.6, 2.8 * g, 6.4 * g, "wing")
        if stage >= 2:
            xs = 2 if side == "wing-l" else 29
            r.pxs(None, [])
            for i in range(5):
                r.px(xs, 16 + i * 2, f"p{i}")
    r.part("body", "body", pivot=(16, 29))
    r.ellipse(16, 18.4, 10, 11, "feather")
    r.ellipse(12, 14, 4.2, 4.2, "face")
    r.ellipse(20, 14, 4.2, 4.2, "face")
    r.ellipse(12, 14, 2.6, 2.8, "iris")
    r.ellipse(20, 14, 2.6, 2.8, "iris")
    r.ellipse(12.4, 14.4, 1.5, 1.7, "ink")
    r.ellipse(20.4, 14.4, 1.5, 1.7, "ink")
    r.pxs("shine", [(11, 13), (19, 13)])
    r.pxs("beak", [(15, 17), (16, 17), (15, 18), (16, 18)])
    r.pxs("mark", [(12, 24), (13, 25), (19, 24), (18, 25), (14, 27), (17, 27)])
    star = [(16, 21), (15, 22), (16, 22), (17, 22), (16, 23)]
    if stage >= 2:
        star += [(16, 20), (14, 22), (18, 22), (16, 24)]
    r.pxs("star", star)
    for side in ("ear-l", "ear-r"):
        r.part(side, side, pivot=(11, 9) if side == "ear-l" else (21, 9), parent="body", z=-1)
        pts = [(9.4, 9.4), (7 - stage * 0.6, 1.6 - stage * 1.2), (13.4, 7.4)]
        r.poly(pts if side == "ear-l" else mirror_poly(pts), "feather")
    if stage >= 1:
        r.part("crest", "fx", pivot=(16, 6), parent="body", z=2)
        r.pxs("star", [(16, 5), (15, 6), (16, 6), (17, 6), (16, 7)])
    return r


def glintling(stage: int) -> Rig:
    r = Rig("glintling", base_materials(star=Material(GOLD), crown=Material(["#c97a10", "#f0b22a", "#ffe066", "#fff6c0"]),
                                        spark=Material(["#fff8c8"], flat=True, floating=True), halo=Material(["#fff6a8"], flat=True, floating=True)),
             "#2a1a02", stage)
    if stage >= 2:
        r.part("halo", "fx", pivot=(16, 3), z=-1)
        r.pxs("halo", [(13, 0), (14, 0), (15, 0), (16, 0), (17, 0), (18, 0), (11, 1), (12, 1), (19, 1), (20, 1), (13, 2), (14, 2), (17, 2), (18, 2)])
    r.part("body", "body", pivot=(16, 30))
    r.poly(star_points(16, 17.4, 14.6, 7.4), "star")
    r.ellipse(16, 17.6, 6.6, 6.2, "star")
    dot_eyes(r, 12, 16, 18)
    r.pxs("ink", [(14, 20), (15, 21), (16, 21), (17, 20)])
    r.pxs("blush", [(11, 19), (20, 19)])
    if stage >= 1:
        r.part("crown", "fx", pivot=(16, 6), parent="body", z=1)
        r.poly([(12.6, 7), (12.6, 3.6), (14.2, 5.2), (16, 2.4), (17.8, 5.2), (19.4, 3.6), (19.4, 7)], "crown")
    r.part("sparkles", "fx", pivot=(16, 16), z=2)
    sparkle(r, 4, 5)
    sparkle(r, 28, 8)
    sparkle(r, 27, 27)
    r.pxs("spark", [(3, 25), (29, 17)])
    if stage >= 2:  # two little starlets keep it company
        for cx, cy in ((3.4, 15), (28.6, 22)):
            r.poly(star_points(cx, cy, 3.2, 1.5), "star")
    return r


def lumistag(stage: int) -> Rig:
    r = Rig("lumistag", base_materials(fur=Material(["#8a7a5a", "#d8cdb0", "#f6f0e0", "#ffffff"]), muzzle=Material(["#9a9488", "#cfc8b8", "#ece6d8", "#ffffff"]),
                                       antler=Material(GOLD), gem=Material(["#ffd23c"], flat=True), glow=Material(["#ffe98a"], flat=True),
                                       hoof=Material(["#b8860b"], flat=True), mane=Material(["#c9a24a", "#e8c46a", "#ffe08e", "#fff4c8"]),
                                       spark=Material(["#fff8c8"], flat=True, floating=True)), "#1e1606", stage)
    r.part("legs", "legs", pivot=(16, 30), z=-1)
    for path in ([(12.4, 26), (12.4, 30.6)], [(19.6, 26), (19.6, 30.6)]):
        r.stroke(path, 1.8, "fur")
    r.pxs("hoof", [(12, 30), (13, 30), (19, 30), (20, 30)])
    r.part("body", "body", pivot=(16, 28))
    r.ellipse(16, 22.8, 7.6, 4.4, "fur")
    r.ellipse(16, 18, 2.8, 3.4, "fur")
    if stage >= 2:
        r.poly([(13, 15), (19, 15), (20, 20), (16, 22), (12, 20)], "mane")
    r.pxs("glow", [(11, 22), (19, 21), (21, 24), (14, 24)])
    r.part("head", "head", pivot=(16, 16), parent="body", z=1)
    r.ellipse(16, 12, 5, 4.6, "fur")
    r.ellipse(16, 15.6, 2.9, 2, "muzzle")
    r.pxs("ink", [(15, 15), (16, 15)])
    r.pxs("gem", [(16, 8), (15, 9), (16, 9), (17, 9), (16, 10)])
    dot_eyes(r, 12, 11, 18)
    r.pxs("blush", [(11, 14), (20, 14)])
    for side in ("ear-l", "ear-r"):
        r.part(side, side, pivot=(11, 11) if side == "ear-l" else (21, 11), parent="head", z=-1)
        pts = [(11.4, 10.6), (5.6, 9.6), (9.8, 12.8)]
        r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
    r.part("antlers", "fx", pivot=(16, 8), parent="head", z=-2)
    grow = 1.2 * stage
    paths = [[(12.6, 8.6), (10.4, 4.4 - grow * 0.5), (8.4, 1.2 - grow)], [(10.8, 5.2), (6.2 - grow, 4.4 - grow * 0.4)], [(9.4, 2.8), (5.6 - grow, 1.8 - grow)]]
    if stage >= 1:
        paths.append([(11.6, 7), (8.6 - grow, 7.4)])
    for path in paths:
        r.stroke(path, 1.5, "antler")
        r.stroke([(32 - x, y) for x, y in path], 1.5, "antler")
    if stage >= 2:
        r.part("stars", "fx", pivot=(16, 2), parent="head", z=2)
        for x, y in ((6, -1), (3, 0), (26, -1), (29, 0)):
            sparkle(r, x, y)
    return r


def lumoth(stage: int) -> Rig:
    r = Rig("lumoth", base_materials(wing=Material(["#8a5a0c", "#d39a17", "#ffd23c", "#fff0a0"]), wing2=Material(["#8a2c4c", "#d0517a", "#ff8fb3", "#ffc6d8"]),
                                     fuzz=Material(["#a08a62", "#ecd9ae", "#fff3d6", "#ffffff"]), body=Material(["#7a5a14", "#c49a2a", "#f0c850", "#ffe48a"]),
                                     vein=Material(["#c98a14"], flat=True), ant=Material(["#7a4e12", "#b8801f", "#e8b84a", "#ffe08a"]),
                                     dot=Material(["#fff8dc"], flat=True), halo=Material(["#fff6a8"], flat=True, floating=True),
                                     eye=Material(["#140a1e"], flat=True)), "#2a1606", stage)
    g = 1 + 0.14 * stage
    for side in ("wing-l", "wing-r"):
        r.part(side, side, pivot=(14, 15) if side == "wing-l" else (18, 15), z=-1)
        upper = [(14, 12), (10, 6), (5, 4), (1.5, 7), (1, 12), (3.5, 16.5), (9, 17.5), (14, 16)]
        lower = [(14, 17), (8.5, 18), (5, 21), (5.5, 25.5), (9, 27.6), (12.5, 25.8), (14, 21.5)]
        if stage >= 2:
            lower += [(12, 27), (10, 31.4), (12.6, 30)]  # streamer
        sc = lambda pts: [(14 + (x - 14) * g, 15 + (y - 15) * g) for x, y in pts]  # noqa: E731
        up, lo = sc(upper), sc(lower)
        if side == "wing-r":
            up, lo = mirror_poly(up), mirror_poly(lo)
        r.poly(lo, "wing2")
        r.poly(up, "wing")
        veins = [(10, 10), (9, 9), (8, 9), (7, 8), (6, 8), (5, 7), (10, 14), (9, 14), (8, 15), (7, 15), (6, 15)]
        dots = [(8, 22), (9, 24), (11, 23)] + ([(4, 10), (5, 12), (7, 25)] if stage >= 1 else [])
        if side == "wing-r":
            veins, dots = [(31 - x, y) for x, y in veins], [(31 - x, y) for x, y in dots]
        r.pxs("vein", veins)
        r.pxs("dot", dots)
    r.part("body", "body", pivot=(16, 28))
    r.ellipse(16, 21, 3.3, 7, "body")
    r.pxs("vein", [(14, 21), (15, 21), (16, 21), (17, 21), (15, 24), (16, 24)])
    r.part("head", "head", pivot=(16, 15), parent="body", z=1)
    r.ellipse(16, 15.4, 4.4, 1.8, "fuzz")
    r.ellipse(16, 11, 5, 4.4, "fuzz")
    r.pxs("eye", [(13, 10), (14, 10), (13, 11), (14, 11), (17, 10), (18, 10), (17, 11), (18, 11)])
    r.pxs("shine", [(13, 10), (17, 10)])
    r.pxs("blush", [(12, 12), (19, 12)])
    r.pxs("ant", mirror_pts([(13, 7), (12, 6), (11, 5), (10, 4), (9, 4), (11, 4), (10, 3)]))
    r.part("halo", "fx", pivot=(16, 2), parent="head", z=2)
    r.pxs("halo", [(14, 1), (15, 1), (16, 1), (17, 1), (12, 2), (13, 2), (18, 2), (19, 2), (14, 3), (15, 3), (16, 3), (17, 3)])
    if stage >= 2:
        r.pxs("halo", [(13, -1), (14, -1), (15, -1), (16, -1), (17, -1), (18, -1), (11, 0), (20, 0)])
    return r


RIGS = [lumowl, glintling, lumistag, lumoth]
