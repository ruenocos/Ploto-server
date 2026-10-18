"""Fire rigs: Pyrup, Scorchpaw, Magmaul, Emberwing (three stages each).

Each line follows EVOLUTION.md: a round, big-headed baby; an adolescent with a
new posture; an adult with its own silhouette and the family motif grown into
its main shape.
"""
from __future__ import annotations

from common import BONE, FIRE, FLAME, GOLD, INK, PEACH, base_materials, star_points
from pixelkit import Material
from rigkit import Rig, dot_eyes, mirror_poly, mirror_pts, sym_poly

OUT_FIRE = "#1a0606"
FIRE_SOFT = ["#9a2a14", "#d2481f", "#f7703a", "#ffab6e"]  # babies: a touch lighter


def _mirror_px(pts):
    return [(31 - x, y) for x, y in pts]


def pyrup(stage: int) -> Rig:
    """Ember pup -> lean flame hound -> two-tailed fire fox sitting tall."""
    r = Rig("pyrup", base_materials(fur=Material(FIRE_SOFT if stage == 0 else FIRE), belly=Material(PEACH), flame=Material(FLAME),
                                     iris=Material(["#ffd23c"], flat=True), brow=Material(["#4a0e08"], flat=True),
                                     mark=Material(GOLD), ember=Material(["#ffe98c"], flat=True, floating=True)), OUT_FIRE, stage)
    if stage == 0:
        # Fox kit: oversized ears and a bushy tail with an ember tip (Scorchpaw's cub has round ears and a mane tuft).
        r.part("tail", "tail", pivot=(11, 27), z=-2)
        r.poly([(12, 29.6), (7.4, 29), (4.4, 25.6), (4.2, 21.4), (6.6, 23.6), (9.4, 25.8), (12.4, 26.4)], "fur")
        r.poly([(4.2, 21.4), (3.4, 18.2), (5, 19.6), (5.4, 17), (7.2, 21), (6.6, 23.6)], "flame")
        r.part("feet", "legs", pivot=(16, 30), z=1)
        r.ellipse(12.6, 30, 2.3, 1.4, "fur")
        r.ellipse(19.4, 30, 2.3, 1.4, "fur")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 26.4, 5.6, 4.3, "fur")
        r.ellipse(16, 27.4, 3, 2.7, "belly")
        r.part("head", "head", pivot=(16, 23), parent="body", z=1)
        r.ellipse(16, 18.6, 7, 5.6, "fur")
        r.poly([(9.4, 19), (12.6, 19.6), (16, 22.6), (19.4, 19.6), (22.6, 19), (21.4, 22.4), (16, 24.4), (10.6, 22.4)], "belly")
        dot_eyes(r, 12, 17, 18, h=3)
        r.pxs("ink", [(15, 21), (16, 21)])
        r.pxs("blush", [(10, 20), (21, 20)])
        for side, piv in (("ear-l", (12, 15)), ("ear-r", (20, 15))):
            r.part(side, side, pivot=piv, parent="head", z=-1)
            pts = [(9.4, 15.6), (7.6, 7.4), (14.6, 13.4)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
            inner = [(9, 10), (9, 11), (10, 11), (10, 12), (11, 12)]
            r.pxs("belly", inner if side == "ear-l" else _mirror_px(inner))
            r.pxs("flame", [(8, 8)] if side == "ear-l" else [(23, 8)])
        return r

    if stage == 1:
        r.part("tail", "tail", pivot=(11, 24), z=-2)
        tail = [(13, 25), (8.4, 23.6), (5.4, 19), (5.2, 13.6), (7.2, 9.6), (9.4, 13), (9.8, 18), (13, 21.6)]
        r.poly(tail, "fur")
        r.poly([(5.2, 13.6), (3.6, 9.4), (5.6, 10.4), (5.8, 6.4), (7.6, 9.4), (9.4, 13), (6.6, 14.8)], "flame")
        r.part("hind", "legs", pivot=(16, 29), z=-1)
        r.ellipse(9.2, 28.6, 2.6, 2.6, "fur")
        r.ellipse(22.8, 28.6, 2.6, 2.6, "fur")
        r.part("legs", "legs", pivot=(16, 30), z=1)
        for x0 in (11.2, 17.8):
            r.poly([(x0, 22), (x0 + 3, 22), (x0 + 3, 30), (x0, 30)], "fur")
            r.ellipse(x0 + 1.5, 30.2, 2, 1.2, "fur")
        r.pxs("brow", [(12, 31), (13, 31), (18, 31), (19, 31)])
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 20.6, 6.6, 4.8, "fur")
        r.ellipse(16, 21.6, 3.2, 3.2, "belly")
        r.pxs("flame", [(16, 20), (15, 21), (16, 21), (16, 22)])
        r.part("head", "head", pivot=(16, 17), parent="body", z=1)
        r.ellipse(16, 13, 5.6, 4.6, "fur")
        r.ellipse(16, 16, 3, 2, "belly")
        r.pxs("iris", [(12, 12), (13, 12), (18, 12), (19, 12)])
        r.pxs("ink", [(13, 12), (18, 12), (12, 13), (13, 13), (18, 13), (19, 13)])
        r.pxs("brow", [(11, 11), (12, 11), (19, 11), (20, 11)])
        r.pxs("ink", [(15, 15), (16, 15)])
        for side, piv in (("ear-l", (12, 10)), ("ear-r", (20, 10))):
            r.part(side, side, pivot=piv, parent="head", z=-1)
            pts = [(10.6, 11), (8.6, 2.6), (14.6, 8.8)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
            tips = [(9, 4), (9, 5), (10, 5)]
            r.pxs("flame", tips if side == "ear-l" else _mirror_px(tips))
        r.part("tuft", "fx", pivot=(16, 9), parent="head", z=1)
        r.poly([(14.8, 9.4), (16, 6.2), (17.2, 9.4)], "flame")
        return r

    # ★★: sits upright like a fox spirit; the ember tail has become two great flame tails fanned behind.
    r.part("tails", "tail", pivot=(16, 26), z=-3)
    for pts in ([(14.5, 27), (9, 26), (4, 21.5), (1.2, 15), (1.6, 8.5), (3.6, 12.2), (4.8, 6.6), (6.6, 12.6), (8.6, 18.6), (14.5, 23.5)],):
        for side in (pts, mirror_poly(pts)):
            r.poly(side, "fur")
    for pts in ([(1.4, 15), (1.6, 8.5), (3.6, 12.2), (4.8, 6.6), (6.6, 12.6), (7.6, 15.6), (4.2, 16.6)],):
        for side in (pts, mirror_poly(pts)):
            r.poly(side, "flame")
    r.part("hips", "legs", pivot=(16, 29), z=-1)
    r.ellipse(10.8, 28, 3.6, 3, "fur")
    r.ellipse(21.2, 28, 3.6, 3, "fur")
    r.part("legs", "legs", pivot=(16, 30), z=1)
    for x0 in (12.4, 17.6):
        r.poly([(x0, 20), (x0 + 2.2, 20), (x0 + 2.2, 30), (x0, 30)], "fur")
        r.ellipse(x0 + 1.1, 30.3, 1.7, 1, "fur")
    r.pxs("mark", [(13, 24), (18, 24), (13, 25), (18, 25)])
    r.part("body", "body", pivot=(16, 29))
    r.ellipse(16, 18.6, 5.2, 6.6, "fur")
    r.poly([(12.6, 13.4), (19.4, 13.4), (18.6, 19.6), (17.4, 18), (16, 21.6), (14.6, 18), (13.4, 19.6)], "belly")
    r.part("head", "head", pivot=(16, 12), parent="body", z=1)
    r.ellipse(16, 8.8, 5.2, 3.9, "fur")
    sym_poly(r, [(11.4, 8.6), (8.4, 11.8), (12.6, 11.4)], "fur")  # cheek fluff
    r.poly([(13.4, 10.2), (18.6, 10.2), (16, 13.4)], "belly")
    r.pxs("ink", [(15, 12), (16, 12)])
    r.pxs("iris", [(11, 8), (12, 8), (19, 8), (20, 8)])
    r.pxs("ink", [(13, 8), (18, 8)])
    r.pxs("brow", [(11, 7), (12, 7), (13, 7), (18, 7), (19, 7), (20, 7)])
    r.pxs("mark", [(16, 6), (15, 7), (16, 7), (17, 7)])
    for side, piv in (("ear-l", (13, 6)), ("ear-r", (19, 6))):
        r.part(side, side, pivot=piv, parent="head", z=-1)
        pts = [(11.4, 7.4), (8.2, -1.6), (15, 5.4)]
        r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
        tips = [(9, -1), (9, 0), (10, 0), (10, 1)]
        r.pxs("flame", tips if side == "ear-l" else _mirror_px(tips))
    r.part("embers", "fx", pivot=(16, 14), z=2)
    r.pxs("ember", [(2, 4), (29, 3), (6, 1), (26, 0)])
    return r


def scorchpaw(stage: int) -> Rig:
    """Lion cub -> maned young lion on all fours -> horned beast king standing upright."""
    r = Rig(
        "scorchpaw",
        base_materials(
            fur=Material(FIRE_SOFT if stage == 0 else ["#7a1d10", "#b9341b", "#e9562c", "#ff9455"]), belly=Material(PEACH),
            mane=Material(["#2a0609", "#541014", "#841b1d", "#b8352a"]), horn=Material(BONE),
            flame=Material(FLAME), nose=Material([INK], flat=True), brow=Material(["#3a0a0c"], flat=True),
            eye=Material(["#ffd23c"], flat=True), pupil=Material([INK], flat=True), fang=Material(["#ffffff"], flat=True),
            lava=Material(["#ffb23a"], flat=True),
        ),
        OUT_FIRE, stage,
    )
    if stage == 0:
        r.part("tail", "tail", pivot=(20, 28), z=-2)
        r.stroke([(20, 29), (23.6, 28.6), (25.6, 26)], 1.4, "fur")
        r.poly([(24.6, 26.6), (24.8, 22.6), (26.2, 24.4), (27.4, 22), (28.2, 25.6), (27, 27.6)], "flame")
        r.part("paws", "legs", pivot=(16, 30), z=1)
        r.ellipse(12.6, 30, 2.4, 1.5, "fur")
        r.ellipse(19.4, 30, 2.4, 1.5, "fur")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 26.4, 5.4, 4.1, "fur")
        r.ellipse(16, 27.4, 2.8, 2.6, "belly")
        r.part("head", "head", pivot=(16, 23), parent="body", z=1)
        r.ellipse(16, 18.4, 7.2, 6.2, "fur")
        r.ellipse(16, 21.4, 3.3, 2.2, "belly")
        dot_eyes(r, 12, 16, 18, h=3)
        r.pxs("nose", [(15, 20), (16, 20)])
        r.pxs("pupil", [(15, 22), (16, 22)])
        r.pxs("blush", [(10, 20), (21, 20)])
        for side, c in (("ear-l", (10.6, 13.6)), ("ear-r", (21.4, 13.6))):
            r.part(side, side, pivot=c, parent="head", z=-1)
            r.ellipse(c[0], c[1], 2.1, 2.1, "fur")
        r.part("mane", "fx", pivot=(16, 13), parent="head", z=1)
        r.poly([(12.8, 13.8), (13.6, 10.4), (15, 12.4), (16.2, 9.4), (17.6, 12.4), (19.2, 10.8), (19.2, 14)], "mane")
        r.pxs("flame", [(16, 10)])
        return r

    if stage == 1:
        r.part("tail", "tail", pivot=(21, 26), z=-3)
        r.stroke([(21, 26), (25.4, 25), (27.8, 21), (28.4, 17.6)], 1.6, "fur")
        r.poly([(27, 18.6), (26.6, 14), (28.4, 15.6), (29.4, 12), (30.6, 15.8), (31, 18.6), (29.2, 19.8)], "flame")
        r.part("hind", "legs", pivot=(16, 29), z=-2)
        r.ellipse(8.8, 28.6, 2.8, 2.6, "fur")
        r.ellipse(23.2, 28.6, 2.8, 2.6, "fur")
        r.part("legs", "legs", pivot=(16, 30), z=1)
        for x0 in (11, 17.6):
            r.poly([(x0, 21.6), (x0 + 3.4, 21.6), (x0 + 3.4, 30), (x0, 30)], "fur")
            r.ellipse(x0 + 1.7, 30.2, 2.2, 1.3, "fur")
        r.pxs("fang", [(11, 31), (13, 31), (18, 31), (20, 31)])
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 21, 7, 4.8, "fur")
        r.ellipse(16, 22, 3.2, 3, "belly")
        r.part("head", "head", pivot=(16, 17), parent="body", z=1)
        r.part("mane", "fx", pivot=(16, 14), parent="head", z=-2)
        r.poly(star_points(16, 13.6, 8.6, 6.2, n=9, rot=-90), "mane")
        for x, y in mirror_pts([(16, 5), (10, 8), (8, 13)]):
            if r.mat_at(x, y) == "mane":
                r.px(x, y, "flame")
        r.part("horns", "fx", pivot=(16, 9), parent="head", z=-1)
        sym_poly(r, [(12.2, 10), (10.8, 6), (13.8, 8.8)], "horn")
        r.part("head", "head", pivot=(16, 17), parent="body", z=1)
        r.ellipse(16, 13.4, 5.4, 4.6, "fur")
        r.ellipse(16, 16.2, 3, 2, "belly")
        r.pxs("brow", mirror_pts([(11, 11), (12, 11), (13, 12)]))
        r.pxs("eye", mirror_pts([(12, 12), (13, 13), (12, 13)]))
        r.pxs("pupil", mirror_pts([(13, 13)]))
        r.pxs("nose", [(15, 15), (16, 15)])
        r.pxs("pupil", [(15, 17), (16, 17)])
        r.pxs("fang", [(14, 17), (17, 17)])
        return r

    # ★★: stands on two legs, arms and claws free; the mane is a crown of flame-tipped spikes, horns sweep back.
    r.part("tail", "tail", pivot=(20, 26), z=-3)
    r.poly([(19, 27), (24.6, 26), (28.4, 21.6), (29.4, 15.6), (31.2, 18.4), (32.2, 12.6), (33.2, 19.4), (31.4, 25.4), (25.6, 29.6)], "flame")
    r.part("legs", "legs", pivot=(16, 30), z=-1)
    leg = [(10.4, 23), (15, 23), (14.6, 28.6), (15.4, 31), (9.6, 31), (10.2, 28)]
    r.poly(leg, "fur")
    r.poly(mirror_poly(leg), "fur")
    r.pxs("fang", [(10, 31), (12, 31), (19, 31), (21, 31)])
    r.part("body", "body", pivot=(16, 30))
    r.poly([(8.6, 13.4), (23.4, 13.4), (22, 19.6), (19.8, 25), (12.2, 25), (10, 19.6)], "fur")
    r.poly([(13, 15), (19, 15), (18, 23.4), (14, 23.4)], "belly")
    r.pxs("lava", [(14, 17), (15, 18), (17, 17), (16, 18), (14, 20), (17, 20)])
    for side, sh in (("arm-l", (9.6, 15)), ("arm-r", (22.4, 15))):
        r.part(side, side, pivot=sh, parent="body", z=1)
        arm = [(8, 13.6), (11.2, 15), (10.2, 21), (9.8, 24.6), (5.8, 24.6), (6.2, 19.4)]
        r.poly(arm if side == "arm-l" else mirror_poly(arm), "fur")
        cx = 7.8 if side == "arm-l" else 24.2
        r.ellipse(cx, 25.4, 2.4, 1.9, "fur")
        claws = [(6, 27), (8, 27), (9, 27)] if side == "arm-l" else [(22, 27), (23, 27), (25, 27)]
        r.pxs("fang", claws)
    r.part("head", "head", pivot=(16, 13), parent="body", z=2)
    r.part("mane", "fx", pivot=(16, 9), parent="head", z=-2)
    spikes = star_points(16, 9.4, 12, 7.2, n=11, rot=-90)
    r.poly(spikes, "mane")
    for i, (x, y) in enumerate(spikes[::2]):
        tx, ty = int(round(16 + (x - 16) * 0.82)), int(round(9.4 + (y - 9.4) * 0.82))
        if r.mat_at(tx, ty) == "mane":
            r.px(tx, ty, "flame")
    r.part("horns", "fx", pivot=(16, 5), parent="head", z=-1)
    sym_poly(r, [(12, 6.4), (13.6, 5), (9.6, 0.4), (5.4, -2.6), (7.6, 1.8)], "horn")
    r.part("head", "head", pivot=(16, 13), parent="body", z=2)
    r.ellipse(16, 8.8, 4.8, 4.2, "fur")
    r.ellipse(16, 11.4, 2.9, 1.8, "belly")
    r.pxs("brow", mirror_pts([(11, 6), (12, 7), (13, 7), (14, 8)]))
    r.pxs("eye", mirror_pts([(12, 8), (13, 8)]))
    r.pxs("pupil", mirror_pts([(13, 8)]))
    r.pxs("nose", [(15, 10), (16, 10)])
    r.pxs("pupil", [(14, 12), (15, 12), (16, 12), (17, 12), (15, 13), (16, 13)])
    r.pxs("fang", [(14, 12), (17, 12)])
    return r


def magmaul(stage: int) -> Rig:
    """Lava pebble -> standing basalt golem -> hunched volcano titan with fists on the ground."""
    r = Rig(
        "magmaul",
        base_materials(
            basalt=Material(["#1e100e", "#3a1c17", "#5c2c22", "#86412f"]), arm=Material(["#1a0d0b", "#311712", "#4e241c", "#73382a"]),
            horn=Material(BONE), lava=Material(["#ffa12c"], flat=True), core=Material(["#fff1a0"], flat=True),
            magma=Material(FLAME), ember=Material(["#ffd36a"], flat=True, floating=True), smoke=Material(["#6b5a58"], flat=True, floating=True),
        ),
        "#0e0504", stage,
    )
    if stage == 0:
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.ellipse(12.4, 30.2, 2.1, 1.3, "arm")
        r.ellipse(19.6, 30.2, 2.1, 1.3, "arm")
        for side, c in (("arm-l", (8.6, 25)), ("arm-r", (23.4, 25))):
            r.part(side, side, pivot=(c[0] + (1 if side == "arm-l" else -1), 23), z=1)
            r.ellipse(c[0], c[1], 2, 2.4, "arm")
        r.part("body", "body", pivot=(16, 30))
        r.poly([(9.6, 17.6), (12.4, 15.4), (19.6, 15.4), (22.4, 17.6), (24, 23), (22.6, 28.6), (19, 30.2), (13, 30.2), (9.4, 28.6), (8, 23)], "basalt")
        r.ellipse(16, 16.6, 3.6, 1.2, "lava")
        r.pxs("core", [(15, 16), (16, 16)])
        r.pxs("lava", [(21, 20), (21, 21), (22, 22), (10, 25), (11, 26), (11, 27), (17, 28), (18, 28)])
        # Big glowing eyes and a small mouth.
        for x0 in (12, 18):
            r.pxs("lava", [(x0, 21), (x0 + 1, 21), (x0, 22), (x0 + 1, 22)])
            r.px(x0, 21, "core")
        r.pxs("lava", [(15, 24), (16, 24)])
        return r

    if stage == 1:
        r.part("legs", "legs", pivot=(16, 30), z=-1)
        r.poly([(10, 24), (14.6, 24), (14.6, 31), (9.6, 31)], "arm")
        r.poly([(17.4, 24), (22, 24), (22.4, 31), (17.4, 31)], "arm")
        for side in ("arm-l", "arm-r"):
            r.part(side, side, pivot=(8.4, 14.6) if side == "arm-l" else (23.6, 14.6), z=1)
            arm = [(6, 13), (10.4, 14), (9.8, 22), (8.8, 25.6), (3.8, 25.6), (3.8, 19)]
            sh = [(4.8, 14.4), (6.2, 10.4), (10, 13.6)]
            r.poly(arm if side == "arm-l" else mirror_poly(arm), "arm")
            r.poly(sh if side == "arm-l" else mirror_poly(sh), "basalt")
            kn = [(4, 24), (6, 25), (8, 24)]
            r.pxs("lava", kn if side == "arm-l" else _mirror_px(kn))
        r.part("body", "body", pivot=(16, 29))
        r.poly([(10, 12), (22, 12), (24, 16), (23, 23), (20, 25.6), (12, 25.6), (9, 23), (8, 16)], "basalt")
        r.pxs("lava", [(12, 15), (12, 16), (13, 17), (13, 18), (12, 19), (19, 14), (20, 15), (20, 16), (21, 17), (16, 20), (16, 21), (17, 22), (17, 23)])
        r.pxs("core", [(13, 17), (20, 16), (16, 21)])
        r.part("head", "head", pivot=(16, 12), parent="body", z=1)
        r.poly([(12, 6.4), (20, 6.4), (21.2, 9.6), (19.6, 12.6), (12.4, 12.6), (10.8, 9.6)], "basalt")
        r.pxs("lava", [(13, 9), (14, 9), (17, 9), (18, 9), (14, 11), (15, 11), (16, 11), (17, 11)])
        r.pxs("core", [(13, 9), (18, 9)])
        r.part("horns", "fx", pivot=(16, 7), parent="head", z=-1)
        sym_poly(r, [(12, 7.4), (10.8, 3.6), (14.2, 6.4)], "horn")
        return r

    # ★★: hunched titan, giant fists planted, head sunk between the shoulders, a volcano erupting from its back.
    r.part("plume", "fx", pivot=(16, 2), z=-2)
    r.poly([(13.6, 3.6), (12.4, -0.6), (14.6, 0.6), (16, -2.8), (17.4, 0.6), (19.6, -0.6), (18.4, 3.6)], "magma")
    r.pxs("ember", [(10, -2), (22, -1), (8, 2), (24, 3)])
    r.part("legs", "legs", pivot=(16, 30), z=-1)
    r.poly([(10.6, 25), (15, 25), (15, 31), (10.2, 31)], "arm")
    r.poly([(17, 25), (21.4, 25), (21.8, 31), (17, 31)], "arm")
    r.part("body", "body", pivot=(16, 29))
    r.poly([(6.8, 11), (11.6, 5.2), (13, 2.8), (19, 2.8), (20.4, 5.2), (25.2, 11), (25.2, 16.6), (22.2, 26), (9.8, 26), (6.8, 16.6)], "basalt")
    r.poly([(13, 3.2), (19, 3.2), (18.2, 4.6), (13.8, 4.6)], "lava")
    r.pxs("lava", [(14, 5), (14, 6), (13, 7), (18, 5), (18, 6), (19, 7)])
    r.ellipse(16, 20, 2.6, 2.6, "lava")
    r.ellipse(16, 20, 1.3, 1.3, "core")
    r.pxs("lava", [(12, 18), (11, 17), (10, 16), (20, 18), (21, 17), (22, 16), (13, 23), (12, 24), (19, 23), (20, 24)])
    for side in ("arm-l", "arm-r"):
        r.part(side, side, pivot=(7.4, 11.6) if side == "arm-l" else (24.6, 11.6), parent="body", z=1)
        arm = [(4, 8.6), (10.6, 10.6), (10.2, 17.6), (8.6, 25.6), (9, 29), (0.4, 29), (-0.6, 25), (0.8, 15.6)]
        r.poly(arm if side == "arm-l" else mirror_poly(arm), "arm")
        fist = (4.4, 29) if side == "arm-l" else (27.6, 29)
        r.ellipse(fist[0], fist[1], 4.4, 2.6, "arm")
        kn = [(2, 28), (4, 27), (6, 28), (3, 30), (5, 30)]
        r.pxs("lava", kn if side == "arm-l" else _mirror_px(kn))
        spikes = ([(1.6, 10.6), (0.8, 4.6), (5.6, 9.2)], [(5.4, 9.2), (6.2, 3.8), (9.2, 9.8)])
        for sp in spikes:
            r.poly(sp if side == "arm-l" else mirror_poly(sp), "horn")
    r.part("head", "head", pivot=(16, 14), parent="body", z=2)
    r.poly([(12.6, 9.4), (19.4, 9.4), (20.6, 12.4), (18.8, 15.6), (13.2, 15.6), (11.4, 12.4)], "arm")
    r.pxs("horn", [(12, 10), (13, 10), (14, 11), (19, 10), (18, 10), (17, 11)])
    r.pxs("lava", [(13, 12), (14, 12), (17, 12), (18, 12), (14, 14), (15, 14), (16, 14), (17, 14)])
    r.pxs("core", [(14, 12), (17, 12)])
    return r


def emberwing(stage: int) -> Rig:
    """Round fluff chick -> long-legged fledgling with folded wings -> phoenix on the wing."""
    r = Rig(
        "emberwing",
        base_materials(fur=Material(FIRE_SOFT if stage == 0 else FIRE), belly=Material(PEACH), flame=Material(FLAME),
                       wing=Material(["#6e1408", "#b3260f", "#ff5a2c", "#ff9a4a"]), beak=Material(GOLD), tip=Material(["#ffe14d"], flat=True),
                       iris=Material(["#ffd23c"], flat=True), brow=Material(["#4a0e08"], flat=True),
                       ember=Material(["#ffe98c"], flat=True, floating=True)),
        OUT_FIRE, stage,
    )
    if stage == 0:
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.pxs("beak", [(13, 30), (14, 30), (12, 31), (14, 31), (17, 30), (18, 30), (17, 31), (19, 31)])
        for side, c in (("wing-l", (9.4, 24.4)), ("wing-r", (22.6, 24.4))):
            r.part(side, side, pivot=(c[0] + (1.2 if side == "wing-l" else -1.2), 22.4), z=1)
            r.ellipse(c[0], c[1], 2, 2.8, "wing")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 23.6, 7.2, 6.6, "fur")
        r.poly([(9.4, 21), (7.6, 20.4), (8.8, 22.6)], "fur")
        r.poly([(22.6, 21), (24.4, 20.4), (23.2, 22.6)], "fur")
        r.ellipse(16, 26.2, 4.2, 3.7, "belly")
        dot_eyes(r, 12, 19, 18, h=3)
        r.poly([(14.8, 23), (17.2, 23), (16, 24.8)], "beak")
        r.pxs("blush", [(11, 23), (20, 23)])
        r.part("crest", "fx", pivot=(16, 17), parent="body", z=1)
        r.poly([(14.8, 17.6), (16, 12.6), (17.4, 17.6)], "flame")
        return r

    if stage == 1:
        r.part("tail", "tail", pivot=(16, 25), z=-2)
        r.poly([(13, 24), (9.6, 30), (12.6, 29), (16, 31.4), (19.4, 29), (22.4, 30), (19, 24)], "wing")
        r.pxs("tip", [(10, 29), (16, 30), (22, 29)])
        r.part("legs", "legs", pivot=(16, 27), z=-1)
        r.stroke([(14, 25.6), (13.6, 30)], 1, "beak")
        r.stroke([(18, 25.6), (18.4, 30)], 1, "beak")
        r.pxs("beak", [(12, 30), (14, 30), (17, 30), (19, 30)])
        r.part("body", "body", pivot=(16, 28))
        r.ellipse(16, 20.4, 5.2, 6.2, "fur")
        r.ellipse(16, 22, 3.1, 4, "belly")
        for side in ("wing-l", "wing-r"):
            r.part(side, side, pivot=(10.8, 15.6) if side == "wing-l" else (21.2, 15.6), parent="body", z=1)
            w = [(10.8, 15), (7, 15.6), (3.6, 18.6), (2.4, 23.4), (4.6, 22.4), (4, 25.6), (6.6, 23.8), (7, 26.6), (9.2, 23.6), (11.2, 19.6)]
            r.poly(w if side == "wing-l" else mirror_poly(w), "wing")
            t = [(2, 23), (4, 25), (6, 26)]
            r.pxs("tip", t if side == "wing-l" else _mirror_px(t))
        r.part("head", "head", pivot=(16, 15), parent="body", z=2)
        r.ellipse(16, 12, 4.4, 3.8, "fur")
        r.poly([(14.6, 13), (17.4, 13), (16, 15.4)], "beak")
        r.pxs("iris", [(13, 11), (18, 11)])
        r.pxs("ink", [(14, 11), (17, 11), (13, 12), (14, 12), (17, 12), (18, 12)])
        r.pxs("brow", [(13, 10), (14, 10), (17, 10), (18, 10)])
        r.part("crest", "fx", pivot=(16, 9), parent="head", z=-1)
        for f in ([(13.4, 9.4), (12.6, 5.2), (15, 8)], [(15, 8.6), (16, 4.4), (17.2, 8.6)], [(17, 8), (19.4, 5.2), (18.6, 9.4)]):
            r.poly(f, "flame")
        return r

    # ★★: airborne phoenix: wings swept up in a V, long flame streamers trailing below.
    r.part("tail", "tail", pivot=(16, 24), z=-3)
    streamer = [(15, 23), (13.2, 28), (10.4, 31.6), (13.6, 30.8), (16, 26.6)]
    r.poly(streamer, "flame")
    r.poly(mirror_poly(streamer), "flame")
    r.poly([(15.2, 24), (16, 31.8), (16.8, 24)], "flame")
    for side in ("wing-l", "wing-r"):
        r.part(side, side, pivot=(13.4, 14) if side == "wing-l" else (18.6, 14), z=-2)
        w = [(13.8, 12.8), (10, 9), (6, 4.4), (2, 0.2), (-1, -2.2), (0, 3), (-1, 6.2), (2, 7.6), (0.4, 11.2), (4, 11.6),
             (3, 15.2), (7, 14.6), (7.4, 18), (11.4, 16.6)]
        r.poly(w if side == "wing-l" else mirror_poly(w), "wing")
        tips = [(0, 4), (1, 9), (3, 13), (7, 16)]
        tips = tips if side == "wing-l" else _mirror_px(tips)
        for x, y in tips:
            if r.mat_at(x, y) == "wing":
                r.px(x, y, "tip")
    r.part("legs", "legs", pivot=(16, 24), z=-1)
    r.pxs("beak", [(14, 24), (14, 25), (17, 24), (17, 25)])
    r.part("body", "body", pivot=(16, 24))
    r.ellipse(16, 17.6, 3.7, 6.6, "fur")
    r.ellipse(16, 19.2, 2.3, 4.4, "belly")
    r.pxs("beak", [(14, 14), (15, 15), (16, 16), (17, 15), (18, 14)])
    r.part("head", "head", pivot=(16, 11), parent="body", z=2)
    r.ellipse(16, 8.2, 3.5, 3.1, "fur")
    r.poly([(14.8, 9.2), (17.4, 9.2), (16.4, 11.8), (15.6, 11.2)], "beak")
    r.pxs("iris", [(14, 8), (17, 8)])
    r.pxs("ink", [(15, 8), (16, 8)])
    r.pxs("brow", [(13, 7), (14, 7), (17, 7), (18, 7)])
    r.part("crest", "fx", pivot=(16, 6), parent="head", z=-1)
    r.poly([(14.4, 6.4), (11.8, 0.6), (12.8, -2.6), (15, 2), (16, -3), (17, 2), (19.2, -2.6), (20.2, 0.6), (17.6, 6.4)], "flame")
    r.part("embers", "fx", pivot=(16, 16), z=2)
    r.pxs("ember", [(5, 20), (27, 21), (9, 25), (23, 26)])
    return r


RIGS = [pyrup, scorchpaw, magmaul, emberwing]
