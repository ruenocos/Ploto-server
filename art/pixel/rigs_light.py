"""Light rigs: Lumowl, Glintling, Dawnhart (lumistag), Halomoth (lumoth) (three stages each).

Each line follows EVOLUTION.md: a round baby, a lankier adolescent with one new
feature, and an adult with its own silhouette.

- Lumowl: fluffball owlet -> fledgling with folded wings and a prism plume ->
  great owl with prism-tipped wings spread wide.
- Glintling: a chubby sitting star -> a comet with a trailing tail -> a robed
  dawn spirit with a sunburst halo, holding two starlets.
- Dawnhart: a big-headed fawn with antler buds -> a long-legged yearling (three
  quarter view) with forked antlers -> a stag with a gold mane and wide,
  starlit antlers.
- Halomoth: a fuzzy haloed larva -> an upright moth with small round wings -> a
  luna-moth adult with pointed forewings and long streamers.
"""
from __future__ import annotations

from common import CREAM, GOLD, base_materials
from pixelkit import Material
from rigkit import Rig, eyes, mirror_poly, mirror_pts, sparkle, star_points

PRISM = ["#ff6b8a", "#ffb84a", "#8ce06a", "#5ac8ff", "#b48aff"]
RAY = ["#a85a08", "#d98a14", "#f0b22a", "#ffd860"]


def _mirror_path(path):
    return [(32 - x, y) for x, y in path]


# ------------------------------------------------------------------ Lumowl
def lumowl(stage: int) -> Rig:
    r = Rig("lumowl", base_materials(feather=Material(["#6e4a1a", "#a8762a", "#dcae52", "#ffe08e"]), wing=Material(["#4e3412", "#7e5620", "#ac8034", "#d4a656"]),
                                     down=Material(CREAM), face=Material(CREAM), iris=Material(["#ffb21e"], flat=True), beak=Material(["#ff8a2a"], flat=True),
                                     mark=Material(["#8a5e22"], flat=True), star=Material(["#fffbe0"], flat=True), gold=Material(GOLD),
                                     talon=Material(["#ff9a2e"], flat=True), **{f"p{i}": Material([c], flat=True) for i, c in enumerate(PRISM)}), "#160c02", stage)
    if stage == 0:  # owlet: one round ball of fluff, all face
        r.part("feet", "legs", pivot=(16, 30), z=1)
        r.pxs("talon", [(12, 30), (13, 30), (14, 30), (17, 30), (18, 30), (19, 30)])
        for side, cx in (("wing-l", 5.4), ("wing-r", 26.6)):
            r.part(side, side, pivot=(cx + (2 if side == "wing-l" else -2), 19), z=-1)
            r.ellipse(cx, 23.4, 2.4, 4.2, "wing")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 20.2, 10.8, 10.4, "feather")
        r.ellipse(16, 26.4, 6.2, 4, "down")
        r.pxs("feather", [(16, 9), (17, 8)])  # the one curl of baby fluff
        for cx in (11.6, 20.4):
            r.ellipse(cx, 18.6, 4.6, 4.6, "face")
            r.ellipse(cx, 18.6, 3, 3.1, "iris")  # orange ring under the house eyes
        eyes(r, 16, 17, 6)
        r.pxs("beak", [(15, 22), (16, 22), (15, 23), (16, 23)])
        r.pxs("mark", [(12, 26), (13, 27), (19, 26), (18, 27)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(10, 12) if side == "ear-l" else (22, 12), parent="body", z=-1)
            pts = [(8.4, 13.6), (7.2, 6.2), (12.8, 10.8)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "feather")
        return r

    if stage == 1:  # fledgling: stands up, head and body separate, wings folded, a prism plume
        r.part("feet", "legs", pivot=(16, 30), z=1)
        r.pxs("talon", [(12, 30), (13, 30), (14, 30), (17, 30), (18, 30), (19, 30)])
        for side in ("wing-l", "wing-r"):
            r.part(side, side, pivot=(10, 18) if side == "wing-l" else (22, 18), z=-1)
            pts = [(10.6, 17.4), (7, 19), (5.6, 24.4), (6.6, 29.6), (8.6, 28.4), (10.6, 25)]
            r.poly(pts if side == "wing-l" else mirror_poly(pts), "wing")
            r.pxs("mark", [(7, 24), (7, 26)] if side == "wing-l" else [(24, 24), (24, 26)])
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 24, 7.4, 6.8, "feather")
        r.ellipse(16, 25.6, 4.6, 4.4, "down")
        r.pxs("mark", [(13, 23), (14, 24), (18, 23), (17, 24), (15, 27), (16, 27)])
        r.pxs("star", [(16, 21), (15, 22), (16, 22), (17, 22), (16, 23)])
        r.part("head", "head", pivot=(16, 18), parent="body", z=1)
        r.ellipse(16, 13.4, 7.4, 6, "feather")
        for cx in (12.8, 19.2):
            r.ellipse(cx, 13.8, 3.2, 3.2, "face")
            r.ellipse(cx, 14, 2.1, 2.1, "iris")
        eyes(r, 16, 13.5, 5)
        r.pxs("beak", [(15, 16), (16, 16), (15, 17), (16, 17)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(11, 10) if side == "ear-l" else (21, 10), parent="head", z=-1)
            pts = [(10, 10.6), (7.6, 3.6), (13.4, 8.6)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "feather")
        r.part("plume", "fx", pivot=(16, 8), parent="head", z=1)
        r.pxs("p0", [(16, 5)])
        r.pxs("p1", [(15, 6), (16, 6)])
        r.pxs("p3", [(15, 7), (16, 7)])
        return r

    # great prism owl: upright, prism-tipped wings spread wide, horned tufts, fierce stare
    r.part("feet", "legs", pivot=(16, 30), z=1)
    r.pxs("talon", [(12, 30), (13, 29), (13, 30), (14, 30), (17, 30), (18, 30), (18, 29), (19, 30)])
    for side in ("wing-l", "wing-r"):
        r.part(side, side, pivot=(12, 15) if side == "wing-l" else (20, 15), z=-1)
        pts = [(12.6, 15), (8, 10), (3, 7), (0, 8), (-0.6, 13), (0, 18.4), (1.6, 22.6), (3.6, 21), (4.8, 24.6), (7, 22.2), (8.8, 25.4), (12, 21)]
        r.poly(pts if side == "wing-l" else mirror_poly(pts), "wing")
        coverts = [(9.4, 13), (5.6, 10.8), (3.2, 12), (6.4, 15.6), (10.6, 16.6)]
        r.poly(coverts if side == "wing-l" else mirror_poly(coverts), "feather")
        tips = [(1, 10, "p0"), (0, 12, "p1"), (0, 14, "p2"), (1, 16, "p3"), (1, 18, "p4"), (2, 20, "p4")]
        for x, y, m in tips:
            r.px(x if side == "wing-l" else 31 - x, y, m)
    r.part("body", "body", pivot=(16, 30))
    r.ellipse(16, 22, 6.6, 8.2, "feather")
    r.ellipse(16, 24, 4, 5.4, "down")
    r.pxs("mark", [(11, 20), (12, 21), (20, 20), (19, 21), (11, 24), (12, 25), (20, 24), (19, 25)])
    r.pxs("gold", [(15, 21), (16, 21), (14, 22), (15, 22), (16, 22), (17, 22), (15, 23), (16, 23)])
    r.part("head", "head", pivot=(16, 15), parent="body", z=1)
    r.ellipse(16, 10.4, 6, 5, "feather")
    for cx in (13.2, 18.8):
        r.ellipse(cx, 10.8, 2.6, 2.4, "face")
    eyes(r, 16, 10.7, 4.4, iris="iris")
    r.pxs("beak", [(15, 12), (16, 12), (15, 13), (16, 13), (16, 14)])
    for side in ("ear-l", "ear-r"):
        r.part(side, side, pivot=(12, 7) if side == "ear-l" else (20, 7), parent="head", z=-1)
        pts = [(11, 8), (8.6, -1.6), (14, 6)]
        r.poly(pts if side == "ear-l" else mirror_poly(pts), "feather")
    return r


# ------------------------------------------------------------------ Glintling
def glintling(stage: int) -> Rig:
    r = Rig("glintling", base_materials(star=Material(GOLD), crown=Material(RAY), trail=Material(["#d39a17", "#ffd23c", "#ffeea0", "#fffbe6"]),
                                        robe=Material(CREAM), trim=Material(["#d39a17"], flat=True),
                                        spark=Material(["#fff8c8"], flat=True, floating=True)), "#2a1a02", stage)
    if stage == 0:  # a chubby star sitting on its two lower points
        r.part("body", "body", pivot=(16, 30))
        r.poly(star_points(16, 20.6, 12.8, 8), "star")
        r.ellipse(16, 21.6, 8, 7.4, "star")
        eyes(r, 16, 18, 6)
        r.pxs("ink", [(14, 23), (15, 24), (16, 24), (17, 23)])
        r.pxs("blush", [(9, 23), (22, 23)])
        r.part("sparkles", "fx", pivot=(16, 20), z=2)
        sparkle(r, 28, 10)
        r.pxs("spark", [(3, 13)])
        return r

    if stage == 1:  # a comet: the star lifts off on a curling tail
        r.part("tail", "tail", pivot=(16, 18), z=-1)
        r.poly([(11.8, 16.4), (20, 15.8), (21.8, 19.6), (23.4, 24), (24.6, 30.6), (21.8, 27.4), (19.4, 24.4), (17.2, 21.6), (14.4, 19.4)], "trail")
        r.stroke([(13, 18.6), (14.6, 23.4), (16.4, 28.4)], 1.4, "trail")
        r.pxs("spark", [(26, 26), (12, 26)])
        r.part("body", "body", pivot=(16, 20))
        r.poly(star_points(16, 12.6, 8.8, 5.2), "star")
        r.ellipse(16, 13, 5.6, 5.2, "star")
        eyes(r, 16, 12, 5)
        r.pxs("ink", [(14, 15), (15, 16), (16, 16), (17, 15)])
        r.pxs("blush", [(11, 14), (20, 14)])
        r.part("sparkles", "fx", pivot=(16, 14), z=2)
        r.poly(star_points(4.4, 20, 2.6, 1.2), "star")
        r.poly(star_points(27.6, 8, 2.2, 1), "star")
        sparkle(r, 26, 22)
        return r

    # dawn spirit: robed, a sunburst halo, arms out holding two starlets
    r.part("halo", "fx", pivot=(16, 9), z=-2)
    r.poly(star_points(16, 9, 10.6, 6.6, n=10), "crown")
    r.part("body", "body", pivot=(16, 30))
    r.poly([(12.4, 14), (19.6, 14), (21.6, 19), (22.8, 23), (24.6, 27.6), (26, 31), (21.8, 29.2), (18.8, 27.6), (15.6, 28.6), (12.4, 27), (10.4, 23), (10.4, 19)], "robe")
    r.stroke([(12.6, 24), (15.4, 28), (18.6, 30.6)], 1.4, "robe")
    r.pxs("trim", [(x, 20) for x in range(11, 21)])
    r.pxs("star", [(15, 19), (16, 19), (15, 20), (16, 20), (15, 21), (16, 21)])
    for side in ("arm-l", "arm-r"):
        r.part(side, side, pivot=(12, 16) if side == "arm-l" else (20, 16), parent="body", z=-1)
        path = [(12, 16.4), (8, 15), (5, 12)]
        r.stroke(path if side == "arm-l" else _mirror_path(path), 2.4, "robe")
        r.poly(star_points(3.8 if side == "arm-l" else 28.2, 10.4, 3, 1.4), "star")
    r.part("head", "head", pivot=(16, 14), parent="body", z=1)
    r.poly(star_points(16, 9.4, 6.4, 3.8), "trail")
    r.ellipse(16, 10, 4, 3.6, "trail")
    eyes(r, 16, 9, 1.4)
    r.pxs("ink", [(15, 12), (16, 12)])
    r.part("sparkles", "fx", pivot=(16, 16), z=2)
    sparkle(r, 2, 20)
    sparkle(r, 29, 21)
    r.pxs("spark", [(4, 3), (27, 2)])
    return r


# ------------------------------------------------------------------ Dawnhart
def lumistag(stage: int) -> Rig:
    r = Rig("lumistag", base_materials(fur=Material(["#8a7a5a", "#d8cdb0", "#f6f0e0", "#ffffff"]), muzzle=Material(["#9a9488", "#cfc8b8", "#ece6d8", "#ffffff"]),
                                       antler=Material(GOLD), gem=Material(["#ffd23c"], flat=True), glow=Material(["#ffd56a"], flat=True),
                                       hoof=Material(["#b8860b"], flat=True), mane=Material(["#c9a24a", "#e8c46a", "#ffe08e", "#fff4c8"]),
                                       eyeglow=Material(["#ffcf3a"], flat=True), spark=Material(["#fff8c8"], flat=True, floating=True)), "#1e1606", stage)
    if stage == 0:  # fawn: front view, a huge head, floppy ears, two antler buds
        r.part("legs", "legs", pivot=(16, 30), z=-1)
        for x in (12.8, 19.2):
            r.stroke([(x, 25.4), (x, 30.6)], 2, "fur")
        r.pxs("hoof", [(12, 30), (13, 30), (18, 30), (19, 30)])
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 24.4, 6.8, 4.6, "fur")
        r.pxs("glow", [(10, 24), (12, 26), (21, 24), (19, 26)])
        r.part("head", "head", pivot=(16, 21), parent="body", z=1)
        r.ellipse(16, 15.2, 7.4, 6.6, "fur")
        r.ellipse(16, 19.2, 3.4, 2.2, "muzzle")
        r.pxs("ink", [(15, 18), (16, 18)])
        eyes(r, 16, 13, 6)
        r.pxs("gem", [(15, 10), (16, 10)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(10, 14) if side == "ear-l" else (22, 14), parent="head", z=-1)
            pts = [(10.2, 13.2), (2.8, 14.4), (5.2, 17.4), (10, 16.6)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
        r.part("buds", "fx", pivot=(16, 9), parent="head", z=-1)
        r.ellipse(12.6, 8.6, 1.7, 2.2, "antler")
        r.ellipse(19.4, 8.6, 1.7, 2.2, "antler")
        return r

    if stage == 1:  # yearling: three-quarter view, long legs, a neck, forked antlers
        r.part("legs", "legs", pivot=(18, 24), z=-1)
        for x0, x1 in ((22.4, 22.8), (25, 25.6), (13.4, 12.8), (15.8, 15.6)):
            r.stroke([(x0, 22), (x1, 30.6)], 1.6, "fur")
        r.pxs("hoof", [(12, 30), (13, 30), (15, 30), (16, 30), (22, 30), (23, 30), (25, 30), (26, 30)])
        r.part("tail", "tail", pivot=(26, 18), z=-1)
        r.ellipse(26.8, 18.2, 1.7, 1.8, "fur")
        r.part("body", "body", pivot=(18, 24))
        r.ellipse(19, 20.4, 7.6, 3.9, "fur")
        r.pxs("glow", [(17, 18), (20, 18), (23, 19), (21, 21), (15, 20)])
        r.part("head", "head", pivot=(12, 18), parent="body", z=1)
        r.poly([(10.4, 19), (14.8, 19.4), (13.6, 12), (10.4, 12)], "fur")
        r.ellipse(11.6, 10.3, 4, 3.9, "fur")
        r.ellipse(9.4, 12.6, 2.4, 1.7, "muzzle")
        r.pxs("ink", [(7, 12)])
        eyes(r, 11.2, 10, 1.6)
        r.pxs("gem", [(11, 7)])
        for side, pts in (("ear-l", [(9.2, 9), (4.6, 7.6), (7.6, 10.6)]), ("ear-r", [(14, 8.4), (18.4, 6.6), (16, 10)])):
            r.part(side, side, pivot=(9, 9) if side == "ear-l" else (14, 8), parent="head", z=-1)
            r.poly(pts, "fur")
        r.part("antlers", "fx", pivot=(11, 7), parent="head", z=-2)
        for path in ([(10, 7.6), (8.8, 5), (7.8, 3.6)], [(9, 5.6), (6.8, 5.2)], [(13.2, 7.4), (14, 4.8), (15.2, 3.4)], [(13.8, 5.4), (16.2, 5)]):
            r.stroke(path, 1.3, "antler")
        return r

    # stag: tall, a gold mane, wide antlers with starlit tips
    r.part("legs", "legs", pivot=(18, 24), z=-1)
    for x0, x1 in ((23, 23.4), (25.8, 26.4), (13.4, 12.6), (16.2, 15.8)):
        r.stroke([(x0, 22), (x1, 30.6)], 1.6, "fur")
    r.pxs("hoof", [(12, 30), (13, 30), (15, 30), (16, 30), (23, 30), (24, 30), (26, 30), (27, 30), (12, 29), (15, 29), (23, 29), (26, 29)])
    r.part("tail", "tail", pivot=(27, 17), z=-1)
    r.poly([(26, 16.4), (30, 14.6), (29.6, 18.4), (27, 19)], "mane")
    r.part("body", "body", pivot=(18, 24))
    r.ellipse(19.6, 19.4, 8.2, 4.4, "fur")
    r.pxs("glow", [(18, 17), (20, 16), (23, 17), (25, 19), (21, 20), (17, 20)])
    r.part("head", "head", pivot=(12, 18), parent="body", z=1)
    r.poly([(10, 17.4), (14.6, 18), (13.6, 9.6), (10.4, 9.6)], "fur")
    r.poly([(9, 16), (14.6, 15.4), (15.4, 20.6), (12.6, 23.2), (9.6, 21.4)], "mane")
    r.ellipse(11.6, 8, 3.6, 3, "fur")
    r.ellipse(9.4, 9.8, 2.3, 1.6, "muzzle")
    r.pxs("ink", [(7, 9)])
    eyes(r, 11, 6.5, 1.4, iris="eyeglow")
    r.pxs("gem", [(11, 4), (11, 5)])
    for side, pts in (("ear-l", [(9.4, 6.8), (5, 5.6), (8, 8.4)]), ("ear-r", [(13.8, 6.2), (18, 4.6), (15.8, 7.8)])):
        r.part(side, side, pivot=(9, 7) if side == "ear-l" else (14, 6), parent="head", z=-1)
        r.poly(pts, "fur")
    r.part("antlers", "fx", pivot=(11, 5), parent="head", z=-2)
    left = [[(10, 5.4), (8, 2), (4.8, -0.4), (1.4, -1.2)], [(7.6, 2.4), (4.4, 3.4), (1.4, 2.8)], [(5.6, 0.4), (5, -2.2)]]
    right = [[(13, 5.2), (15.4, 2), (18.8, -0.4), (22.4, -1.2)], [(15.4, 2.4), (18.4, 3.4), (21.4, 2.8)], [(18, 0.2), (18.6, -2.2)]]
    for path in left + right:
        r.stroke(path, 1.4, "antler")
    r.part("stars", "fx", pivot=(11, 0), parent="head", z=2)
    r.pxs("spark", [(0, -2), (0, 2), (4, -3), (22, -2), (22, 2), (18, -3)])
    return r


# ------------------------------------------------------------------ Halomoth
def lumoth(stage: int) -> Rig:
    r = Rig("lumoth", base_materials(wing=Material(["#8a5a0c", "#d39a17", "#ffd23c", "#fff0a0"]), wing2=Material(["#8a2c4c", "#d0517a", "#ff8fb3", "#ffc6d8"]),
                                     fuzz=Material(["#a08a62", "#ecd9ae", "#fff3d6", "#ffffff"]), body=Material(["#7a5a14", "#c49a2a", "#f0c850", "#ffe48a"]),
                                     band=Material(["#8a2c4c", "#d0517a", "#ff8fb3", "#ffc6d8"]), vein=Material(["#c98a14"], flat=True),
                                     ant=Material(["#7a4e12", "#b8801f", "#e8b84a", "#ffe08a"]), dot=Material(["#fff8dc"], flat=True),
                                     leg=Material(["#7a5a14"], flat=True), halo=Material(["#fff6a8"], flat=True, floating=True),
                                     eye=Material(["#140a1e"], flat=True), eyeglow=Material(["#ffd23c"], flat=True)), "#2a1606", stage)
    if stage == 0:  # larva: a fuzzy caterpillar rearing its big head, a tiny halo
        r.part("legs", "legs", pivot=(20, 30), z=1)
        r.pxs("leg", [(16, 30), (19, 30), (23, 30)])
        r.part("body", "body", pivot=(20, 30))
        r.ellipse(26.4, 28.6, 3, 2.6, "body")
        r.ellipse(22.2, 27, 3.8, 3.7, "band")
        r.ellipse(17.6, 24.6, 4.5, 4.3, "body")
        r.ellipse(13.4, 21.8, 3.7, 3.3, "fuzz")
        r.pxs("vein", [(26, 28), (17, 23), (16, 24), (18, 23)])
        r.part("head", "head", pivot=(11, 23), parent="body", z=1)
        r.ellipse(10.8, 16.4, 7, 6.6, "fuzz")
        eyes(r, 11, 14, 6)
        r.pxs("ink", [(10, 20), (11, 20)])
        r.pxs("blush", [(5, 19), (16, 19)])
        r.part("antennae", "fx", pivot=(11, 10), parent="head", z=-1)
        r.pxs("ant", [(7, 10), (6, 9), (6, 8), (14, 10), (15, 9), (15, 8)])
        r.part("halo", "fx", pivot=(11, 6), parent="head", z=2)
        r.pxs("halo", [(7, 7), (8, 6), (9, 6), (10, 6), (11, 6), (12, 6), (13, 6), (14, 7)])
        return r

    if stage == 1:  # young moth: upright, a fluffy collar, one pair of small round wings
        for side in ("wing-l", "wing-r"):
            r.part(side, side, pivot=(13, 17) if side == "wing-l" else (19, 17), z=-1)
            fore = [(13, 15), (9, 12.4), (5, 12.2), (3.8, 15.6), (5.2, 19.8), (9.4, 21), (13, 19.6)]
            r.ellipse(9.8 if side == "wing-l" else 22.2, 23.4, 3.4, 2.8, "wing2")
            r.poly(fore if side == "wing-l" else mirror_poly(fore), "wing")
            r.pxs("dot", [(7, 15), (8, 16)] if side == "wing-l" else [(24, 15), (23, 16)])
        r.part("legs", "legs", pivot=(16, 29), z=-1)
        r.stroke([(14.6, 27.6), (13.6, 30.6)], 1, "leg")
        r.stroke([(17.4, 27.6), (18.4, 30.6)], 1, "leg")
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 23, 3.8, 6.2, "fuzz")
        r.pxs("band", [(14, 25), (15, 25), (16, 25), (17, 25)])
        r.ellipse(16, 16.8, 5.4, 2.8, "fuzz")
        r.part("head", "head", pivot=(16, 16), parent="body", z=1)
        r.ellipse(16, 12.6, 4.8, 4.2, "fuzz")
        eyes(r, 16, 12, 3.4, iris="eye", shine=True)
        r.pxs("blush", [(12, 14), (19, 14)])
        r.part("antennae", "fx", pivot=(16, 8), parent="head", z=-1)
        r.pxs("ant", mirror_pts([(13, 9), (12, 8), (11, 7), (10, 6), (9, 6), (11, 6), (10, 8)]))
        r.part("halo", "fx", pivot=(16, 4), parent="head", z=2)
        r.pxs("halo", [(14, 4), (15, 4), (16, 4), (17, 4), (13, 5), (18, 5)])
        return r

    # luna moth: pointed forewings with eye spots, long hindwing streamers, plumed antennae
    for side in ("wing-l", "wing-r"):
        r.part(side, side, pivot=(14, 15) if side == "wing-l" else (18, 15), z=-1)
        fore = [(14, 13), (10, 8), (5, 3.6), (0.6, 1.4), (-0.6, 4), (0.4, 10), (3, 15), (8, 17), (14, 16.4)]
        hind = [(14, 17), (9, 18), (5.4, 21), (4.6, 25), (3.2, 29), (2.6, 31.4), (5, 30.6), (8, 26.6), (11.4, 25), (14, 21.4)]
        if side == "wing-r":
            fore, hind = mirror_poly(fore), mirror_poly(hind)
        r.poly(hind, "wing2")
        r.poly(fore, "wing")
        spots = [(5, 8), (6, 8), (5, 9), (6, 9)]
        veins = [(11, 11), (9, 10), (7, 10), (4, 6), (3, 5), (11, 14), (8, 14), (6, 14)]
        hdots = [(8, 21), (9, 22), (6, 25)]
        if side == "wing-r":
            spots, veins, hdots = [(31 - x, y) for x, y in spots], [(31 - x, y) for x, y in veins], [(31 - x, y) for x, y in hdots]
        r.pxs("vein", veins)
        r.pxs("dot", spots + hdots)
        r.px(6 if side == "wing-l" else 25, 9, "eye")
    r.part("body", "body", pivot=(16, 28))
    r.ellipse(16, 21, 2.8, 7.4, "body")
    r.pxs("vein", [(15, 20), (16, 20), (15, 23), (16, 23), (15, 26), (16, 26)])
    r.ellipse(16, 14.6, 4.6, 2.2, "fuzz")
    r.part("head", "head", pivot=(16, 14), parent="body", z=1)
    r.ellipse(16, 10.8, 4, 3.6, "fuzz")
    eyes(r, 16, 9.5, 2.9, iris="eyeglow", lid="eye")
    r.part("antennae", "fx", pivot=(16, 7), parent="head", z=-1)
    r.pxs("ant", mirror_pts([(13, 8), (12, 7), (11, 6), (10, 6), (9, 5), (8, 5), (7, 4), (6, 4), (10, 5), (8, 4), (11, 7), (9, 6)]))
    r.part("halo", "fx", pivot=(16, 3), parent="head", z=2)
    r.pxs("halo", [(14, 2), (15, 2), (16, 2), (17, 2), (13, 3), (18, 3)])
    return r


RIGS = [lumowl, glintling, lumistag, lumoth]
