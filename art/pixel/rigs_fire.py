"""Fire rigs: Pyrup, Scorchpaw, Magmaul, Emberwing (three stages each)."""
from __future__ import annotations

from common import BONE, FIRE, FLAME, GOLD, INK, PEACH, base_materials
from pixelkit import Material
from rigkit import Rig, dot_eyes, happy_eyes, mirror_poly, mirror_pts, sym_poly

OUT_FIRE = "#1a0606"


def pyrup(stage: int) -> Rig:
    r = Rig("pyrup", base_materials(fur=Material(FIRE), belly=Material(PEACH), flame=Material(FLAME)), OUT_FIRE, stage)
    # Flame tail: one lobe, two at ★, three at ★★.
    r.part("tail", "tail", pivot=(10, 25), z=-2)
    r.poly([(10, 25), (5, 23.5), (2.5, 18), (5.5, 19.5), (5, 13.5), (8.5, 18.5), (11, 22)], "flame")
    if stage >= 1:
        r.poly([(9, 23), (4, 19), (3.5, 11), (7, 16), (8.5, 12), (10, 19)], "flame")
    if stage >= 2:
        r.poly([(8, 22), (1, 17.5), (0, 12.6), (4, 15), (2.4, 9), (8, 15)], "flame")
    r.part("feet", "legs", pivot=(16, 30), z=1)
    r.ellipse(12, 29.6, 2.5, 1.7, "fur")
    r.ellipse(20, 29.6, 2.5, 1.7, "fur")
    r.part("body", "body", pivot=(16, 30))
    r.ellipse(16, 24, 8, 6.4, "fur")
    r.ellipse(16, 25.6, 4.4, 3.9, "belly")
    if stage >= 1:
        r.pxs("flame", [(15, 24), (16, 24), (15, 25), (16, 25), (16, 23)])
    r.part("head", "head", pivot=(16, 19), parent="body", z=1)
    if stage >= 2:  # flame collar behind the head
        for x0 in (8, 11, 14, 17, 20, 23):
            r.poly([(x0 - 1.6, 20.6), (x0 + 0.4, 15.6), (x0 + 2.2, 20.6)], "flame")
    r.ellipse(16, 13.4, 7.6, 6.6, "fur")
    r.ellipse(16, 16.4, 3.6, 2.5, "belly")
    if stage == 0:
        happy_eyes(r, 11, 13, 18)
    else:
        dot_eyes(r, 11, 12, 19)
    r.pxs("ink", [(15, 15), (16, 15), (15, 17), (16, 17)])
    if stage >= 2:
        r.pxs("white", [(14, 18), (17, 18)])
    r.pxs("blush", [(10, 15), (21, 15)])
    tip = 3.2 - stage * 1.4
    for side, (bx, by) in (("ear-l", (11, 9)), ("ear-r", (21, 9))):
        r.part(side, side, pivot=(bx, by), parent="head", z=-1)
        pts = [(10.5, 10.5), (8.2, tip), (14.5, 7.5)]
        r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
        inner = [(9, 5), (9, 6), (10, 7), (10, 6)] + ([(9, 4), (8, 3)] if stage >= 1 else [])
        r.pxs("flame", inner if side == "ear-l" else [(31 - x, y) for x, y in inner])
    return r


def scorchpaw(stage: int) -> Rig:
    r = Rig(
        "scorchpaw",
        base_materials(
            fur=Material(["#7a1d10", "#b9341b", "#e9562c", "#ff9455"]), belly=Material(PEACH),
            mane=Material(["#2a0609", "#541014", "#841b1d", "#b8352a"]), horn=Material(BONE),
            flame=Material(FLAME), nose=Material([INK], flat=True), brow=Material(["#3a0a0c"], flat=True),
            eye=Material(["#ffd23c"], flat=True), pupil=Material([INK], flat=True), fang=Material(["#ffffff"], flat=True),
            lava=Material(["#ffb23a"], flat=True),
        ),
        OUT_FIRE, stage,
    )
    r.part("tail", "tail", pivot=(22, 27), z=-2)
    r.poly([(20, 28), (24.5, 26.5), (27, 22), (25.5, 17.5), (28.5, 19.5), (30, 14.5), (31.5, 21), (30, 26), (25, 29.8)], "flame")
    if stage >= 1:
        r.poly([(22, 26), (27.5, 21), (28, 12), (31, 16), (32.5, 10), (33, 20), (30, 27)], "flame")
    r.part("paws", "legs", pivot=(16, 30), z=1)
    r.ellipse(11.4, 29.6, 2.7, 1.9, "fur")
    r.ellipse(20.6, 29.6, 2.7, 1.9, "fur")
    r.pxs("brow", [(10, 30), (12, 30), (19, 30), (21, 30)])
    r.part("body", "body", pivot=(16, 30))
    r.ellipse(16, 24.5, 8, 6.6, "fur")
    r.ellipse(16, 25.8, 4.2, 4.6, "belly")
    if stage >= 2:
        r.pxs("lava", [(16, 23), (15, 24), (16, 25), (17, 26), (16, 27), (14, 26)])
    r.part("head", "head", pivot=(16, 20), parent="body", z=1)
    r.ellipse(16, 12.8, 9, 7.6, "fur")
    r.ellipse(16, 16.6, 4.4, 3.1, "belly")
    r.pxs("brow", mirror_pts([(9, 9), (10, 9), (11, 10), (12, 10), (13, 11)] + ([(8, 8)] if stage >= 2 else [])))
    r.pxs("eye", mirror_pts([(10, 11), (11, 11), (12, 11), (10, 12), (11, 12), (12, 12), (13, 12)]))
    r.pxs("pupil", mirror_pts([(12, 11), (12, 12)]))
    r.pxs("nose", [(15, 14), (16, 14), (15, 15), (16, 15)])
    r.pxs("pupil", [(14, 17), (15, 17), (16, 17), (17, 17)])
    r.pxs("fang", [(14, 18), (17, 18)] + ([(13, 18)] if stage >= 1 else []) + ([(18, 18)] if stage >= 1 else []))
    r.part("mane", "fx", pivot=(16, 14), parent="head", z=-1)
    spike = 1.2 * stage
    mane_left = [(16, 3 - spike), (13.5, 1.5 - spike), (11.5, 4.5), (8, 2.5 - spike), (7.5, 6.5), (3 - spike, 5.5), (5, 9.5),
                 (0.8 - spike, 11.5), (4.5, 13.5), (1.5 - spike, 18), (6.5, 17.5), (6, 21.5), (10, 20)]
    r.poly(mane_left + list(reversed(mirror_poly(mane_left))), "mane")
    for x, y in mirror_pts([(13, 2), (12, 3), (8, 3), (8, 4), (3, 6), (4, 6), (1, 11), (2, 11), (2, 17), (3, 17)]):
        if r.mat_at(x, y) == "mane":
            r.px(x, y, "flame")
    r.part("horns", "fx", pivot=(16, 8), parent="head", z=-2)
    reach = 1.6 * stage
    horn = [(9.5, 8.5), (11.5, 7), (8.6 - reach * 0.5, 2.6 - reach), (6.8 - reach, 0.6 - reach), (7.4 - reach * 0.4, 4.6 - reach * 0.4)]
    sym_poly(r, horn, "horn")
    if stage >= 2:
        sym_poly(r, [(7, 12), (8.4, 10.6), (3, 9), (4.4, 11.6)], "horn")
    return r


def magmaul(stage: int) -> Rig:
    r = Rig(
        "magmaul",
        base_materials(
            basalt=Material(["#1e100e", "#3a1c17", "#5c2c22", "#86412f"]), arm=Material(["#1a0d0b", "#311712", "#4e241c", "#73382a"]),
            horn=Material(BONE), lava=Material(["#ffa12c"], flat=True), core=Material(["#fff1a0"], flat=True),
        ),
        "#0e0504", stage,
    )
    r.part("legs", "legs", pivot=(16, 30), z=-1)
    r.poly([(9.5, 25), (14.5, 25), (14.5, 31), (9.5, 31)], "arm")
    r.poly([(17.5, 25), (22.5, 25), (22.5, 31), (17.5, 31)], "arm")
    for side, cx in (("arm-l", 5.5), ("arm-r", 26.5)):
        r.part(side, side, pivot=(cx + (2 if side == "arm-l" else -2), 15), z=1)
        r.ellipse(cx, 20, 3.6, 6.8, "arm")
        r.pxs("lava", [(5, 18), (6, 19), (6, 20)] if side == "arm-l" else [(26, 21), (25, 22)])
        if stage >= 1:  # rock spikes on the shoulders
            pts = [(3, 15), (2, 10.5), (6.5, 14)]
            r.poly(pts if side == "arm-l" else mirror_poly(pts), "horn")
        if stage >= 2:  # molten fists
            r.pxs("lava", [(4, 25), (5, 26), (6, 25), (7, 26)] if side == "arm-l" else [(24, 25), (25, 26), (26, 25), (27, 26)])
    r.part("body", "body", pivot=(16, 28))
    r.ellipse(16, 19.5, 10, 8.6, "basalt")
    r.pxs("lava", [(12, 15), (12, 16), (13, 17), (13, 18), (12, 19), (19, 14), (20, 15), (20, 16), (21, 17), (21, 18),
                   (16, 21), (16, 22), (17, 23), (17, 24)])
    r.pxs("core", [(13, 17), (20, 16), (16, 22)])
    if stage >= 2:
        r.ellipse(16, 18.5, 2.4, 2.4, "lava")
        r.ellipse(16, 18.5, 1.2, 1.2, "core")
    r.part("head", "head", pivot=(16, 13), parent="body", z=1)
    r.ellipse(16, 9.6, 6.6, 5.2, "basalt")
    r.pxs("lava", mirror_pts([(12, 8), (13, 8), (13, 9), (14, 9)]))
    r.pxs("core", mirror_pts([(13, 9)]))
    r.pxs("lava", [(14, 12), (15, 12), (16, 12), (17, 12)])
    r.part("horns", "fx", pivot=(16, 6), parent="head", z=-1)
    sym_poly(r, [(11.5, 7), (8 - stage, 1.2 - stage * 1.2), (13.5, 5.5)], "horn")
    if stage >= 2:
        r.poly([(14.6, 5), (16, 0.2 - stage), (17.4, 5)], "horn")
    return r


def emberwing(stage: int) -> Rig:
    r = Rig(
        "emberwing",
        base_materials(fur=Material(FIRE), belly=Material(PEACH), flame=Material(FLAME),
                       wing=Material(["#6e1408", "#b3260f", "#ff5a2c", "#ff9a4a"]), beak=Material(GOLD), tip=Material(["#ffe14d"], flat=True)),
        OUT_FIRE, stage,
    )
    if stage >= 2:  # long tail plumes
        r.part("tail", "tail", pivot=(16, 25), z=-3)
        r.poly([(14, 24), (10, 31), (12.4, 32), (16, 26), (19.6, 32), (22, 31), (18, 24)], "flame")
    for side in ("wing-l", "wing-r"):
        r.part(side, side, pivot=(10, 17) if side == "wing-l" else (22, 17), z=-2)
        g = 1 + 0.18 * stage
        base = [(9.5, 15.5), (3, 12.5), (0.6, 16.5), (4, 18.6), (1.2, 22), (6, 21.8), (3.6, 25.2), (10, 22)]
        pts = [(10 + (x - 10) * g, 18 + (y - 18) * g) for x, y in base]
        r.poly(pts if side == "wing-l" else mirror_poly(pts), "wing")
        if stage >= 2:
            tips = [(1, 16), (2, 21), (3, 25)]
            r.pxs("tip", tips if side == "wing-l" else [(31 - x, y) for x, y in tips])
    r.part("feet", "legs", pivot=(16, 30), z=1)
    r.pxs("beak", [(13, 28), (13, 29), (12, 30), (14, 30), (19, 28), (19, 29), (18, 30), (20, 30)])
    r.part("body", "body", pivot=(16, 28))
    r.ellipse(16, 18.2, 7.2, 9.2, "fur")
    r.ellipse(16, 21.4, 4.2, 5, "belly")
    r.poly([(16, 14.4), (14.3, 16.2), (16, 18.2), (17.7, 16.2)], "beak")
    dot_eyes(r, 12, 12, 18)
    r.pxs("blush", [(11, 15), (20, 15)])
    r.part("crest", "fx", pivot=(16, 9), parent="body", z=-1)
    flames = [[(14.8, 7), (16.4, 0.4), (18.2, 7)]]
    if stage >= 1:
        flames += [[(12.6, 8), (13.2, 1.8), (15.2, 6.6)], [(17.8, 7.5), (19.6, 2.4), (20.4, 8.2)]]
    if stage >= 2:
        flames += [[(10.6, 9.4), (10, 4), (13, 8)], [(19.4, 8.4), (22.4, 4.6), (21.6, 9.6)]]
    for f in flames:
        r.poly(f, "flame")
    return r


RIGS = [pyrup, scorchpaw, magmaul, emberwing]
