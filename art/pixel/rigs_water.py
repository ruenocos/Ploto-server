"""Water rigs: Tidecoil, Frostnip, Krakling, Bublob (three stages each)."""
from __future__ import annotations

from common import AQUA, ICE, base_materials
from pixelkit import Material
from rigkit import Rig, dot_eyes, happy_eyes, mirror_poly, mirror_pts, sparkle, sym_poly

WATER_BODY = ["#123a7d", "#1f63b8", "#3aa0ff", "#8fd3ff"]


def tidecoil(stage: int) -> Rig:
    r = Rig("tidecoil", base_materials(body=Material(["#0e3f6b", "#1c6fa8", "#2fa8d8", "#86dcf2"]),
                                       belly=Material(["#3f7fa8", "#7cc0e0", "#c4ecfa", "#ffffff"]), fin=Material(AQUA),
                                       glow=Material(["#c8fbff"], flat=True)), "#061626", stage)
    coil = [(3.5, 27.5), (9, 29.4), (16, 29.6), (22.6, 28.2), (26.2, 24.6), (24.6, 20.8), (19.4, 19.6), (13.4, 19.2), (9.6, 16.8), (9.8, 13.2), (12.6, 10.6)]
    r.part("fins", "fx", pivot=(16, 22), z=-1)
    r.poly([(11.6, 27), (14.4, 21.2 - stage), (17, 27)], "fin")
    r.poly([(20.6, 26.6), (26.6, 19.8 - stage), (26, 26.6)], "fin")
    r.poly([(14.6, 20), (18.4, 14.4 - stage), (20, 20)], "fin")
    r.poly([(1.2, 25.4), (5, 27.4), (2, 31)], "fin")
    r.part("body", "body", pivot=(16, 30))
    r.stroke(coil, 6.2, "body")
    r.stroke([(x, y + 1.6) for x, y in coil[1:-3]], 1.6, "belly")
    if stage >= 2:
        r.pxs("glow", [(9, 30), (15, 31), (21, 30), (24, 26), (20, 21)])
    r.part("head", "head", pivot=(16, 13), parent="body", z=1)
    r.ellipse(16, 8.4, 7.2, 5.8, "body")
    r.ellipse(16, 11.4, 4.2, 2.4, "belly")
    dot_eyes(r, 12, 7, 18)
    r.pxs("ink", [(14, 11), (18, 11), (15, 12), (16, 12), (17, 12)])
    if stage >= 1:  # whisker barbels
        r.stroke([(11, 11), (7.6, 12.4), (6, 14.6)], 1, "fin")
        r.stroke([(21, 11), (24.4, 12.4), (26, 14.6)], 1, "fin")
    r.part("crest", "fx", pivot=(16, 4), parent="head", z=-1)
    r.poly([(14.6, 3.6), (18.6, 0.4 - stage), (19.6, 4.8)], "fin")
    if stage >= 2:
        r.poly([(10.4, 5), (10, 0.6), (13.4, 3.6)], "fin")
        r.poly([(21.6, 5.6), (24.4, 1.4), (22.4, 6.6)], "fin")
    return r


def frostnip(stage: int) -> Rig:
    r = Rig("frostnip", base_materials(body=Material(["#2a5a9a", "#4a8ad0", "#8cc4f2", "#d8f0ff"]), crystal=Material(ICE),
                                       frost=Material(["#eaf8ff"], flat=True), spark=Material(["#eaf8ff"], flat=True, floating=True)),
             "#0a1a33", stage)
    r.part("feet", "legs", pivot=(16, 30), z=-1)
    r.ellipse(12, 28.4, 2.2, 2.6, "body")
    r.ellipse(20, 28.4, 2.2, 2.6, "body")
    for side, cx in (("arm-l", 6.6), ("arm-r", 25.4)):
        r.part(side, side, pivot=(cx + (1.6 if side == "arm-l" else -1.6), 20.6), z=1)
        r.ellipse(cx, 20.6, 2.2, 1.6, "body")
        if stage >= 1:
            pts = [(5, 19), (2.6, 15.4), (7, 18)]
            r.poly(pts if side == "arm-l" else mirror_poly(pts), "crystal")
    r.part("body", "body", pivot=(16, 28))
    r.ellipse(16, 18, 9.2, 9.2, "body")
    r.ellipse(16, 23.4, 8.4, 3.4, "body")
    r.pxs("frost", [(10, 13), (11, 12), (21, 12), (22, 13), (16, 10)])
    r.ellipse(12.6, 18, 1.8, 2.5, "ink")
    r.ellipse(19.4, 18, 1.8, 2.5, "ink")
    r.pxs("shine", [(12, 17), (19, 17)])
    r.pxs("ink", [(14, 22), (15, 23), (16, 22), (17, 23)])
    r.pxs("blush", [(9, 20), (10, 20), (22, 20), (23, 20)])
    r.part("crystals", "fx", pivot=(16, 10), parent="body", z=-1)
    up = 1.6 * stage
    sym_poly(r, [(11, 10), (8.6, 2.2 - up), (13.4, 8)], "crystal")
    sym_poly(r, [(8.5, 12.5), (5 - up * 0.5, 9 - up * 0.5), (9.5, 11)], "crystal")
    if stage >= 2:
        r.poly([(14.4, 9.6), (16, 0.6 - up), (17.6, 9.6)], "crystal")
    r.part("snow", "fx", pivot=(16, 16), z=2)
    sparkle(r, 3, 6)
    sparkle(r, 28, 9)
    sparkle(r, 27, 26)
    if stage >= 2:
        sparkle(r, 4, 24)
    return r


def krakling(stage: int) -> Rig:
    r = Rig("krakling", base_materials(body=Material(WATER_BODY), tent=Material(WATER_BODY),
                                       spot=Material(["#0f2f6b", "#174f9a", "#2a7fd6", "#4d9fe8"]),
                                       sucker=Material(["#9cd6ff"], flat=True), fin=Material(AQUA)), "#071026", stage)
    outer = [(8.5, 19), (6.5, 22.5), (4.2, 25), (3, 27.6), (4, 29.7), (6.3, 29.2)]
    inner = [(12.5, 20.5), (11.6, 24), (11, 27), (12.3, 29.5), (14.3, 28.7)]
    for side, sx in (("tent-l", 1), ("tent-r", -1)):
        r.part(side, side, pivot=(16 - sx * 5, 20), z=-1)
        for path in ([outer, inner] + ([[(15, 21), (14.6, 26), (15.4, 30.4), (17, 30.4)]] if stage >= 2 else [])):
            pts = path if sx == 1 else [(32 - x, y) for x, y in path]
            r.stroke(pts, 2.8, "tent")
        for x, y in [(5, 25), (11, 26)]:
            X = x if sx == 1 else 31 - x
            if r.mat_at(X, y) == "tent":
                r.px(X, y, "sucker")
    if stage >= 1:
        r.part("fins", "fx", pivot=(16, 6), z=-2)
        sym_poly(r, [(7, 10), (2.6, 4.6 - stage), (9.6, 6.4)], "fin")
    r.part("body", "body", pivot=(16, 22))
    r.ellipse(16, 12.6, 11, 9.6, "body")
    r.ellipse(16, 19.4, 10.2, 3.2, "body")
    spots = [(8, 7), (9, 7), (8, 8), (13, 4), (14, 4), (21, 5), (22, 5), (22, 6), (24, 10), (25, 10), (25, 11), (7, 14)]
    if stage >= 1:
        spots += [(18, 3), (11, 6), (26, 14), (6, 11)]
    r.pxs("spot", spots)
    if stage >= 2:
        r.pxs("fin", [(x, 3) for x in range(12, 20)] + [(13, 2), (16, 1), (19, 2)])
    r.ellipse(11.6, 13.8, 2.4, 3.1, "ink")
    r.ellipse(20.4, 13.8, 2.4, 3.1, "ink")
    r.pxs("white", [(10, 12), (11, 12), (10, 13), (12, 15), (19, 12), (20, 12), (19, 13), (21, 15)])
    r.pxs("blush", [(7, 17), (8, 17), (23, 17), (24, 17)])
    r.pxs("ink", [(15, 18), (16, 18)])
    return r


def bublob(stage: int) -> Rig:
    r = Rig("bublob", base_materials(jelly=Material(["#1a5f8a", "#2f9ad0", "#6fd0ff", "#c8f2ff"]),
                                     tendril=Material(["#1a5f8a", "#3aa0d8", "#8fdcff", "#d8f6ff"]), gloss=Material(["#e8fbff"], flat=True),
                                     core=Material(["#fff6c8"], flat=True), bubble=Material(["#bfefff"], flat=True, floating=True)),
             "#082238", stage)
    long = 1.6 * stage
    for side, sx in (("tent-l", 1), ("tent-r", -1)):
        r.part(side, side, pivot=(16 - sx * 4, 21), z=-1)
        for path in ([(10, 20), (8.6, 24), (10, 27.6), (9, 30.6 + long)], [(14, 21), (14.6, 25), (13.4, 28.6), (14.2, 31 + long)]):
            r.stroke(path if sx == 1 else [(32 - x, y) for x, y in path], 1.6, "tendril")
    r.part("body", "body", pivot=(16, 22))
    r.ellipse(16, 13.4, 10.6, 9.4, "jelly")
    for x in range(6, 27, 3):
        r.ellipse(x + 0.5, 21.6, 1.7, 1.5, "jelly")
    r.pxs("gloss", [(8, 11), (8, 10), (9, 9), (10, 8), (11, 7), (12, 7)])
    if stage >= 1:
        r.ellipse(16, 10, 2.2, 2.2, "core")
    happy_eyes(r, 11, 14, 18)
    r.pxs("ink", [(14, 16), (15, 17), (16, 17), (17, 16)])
    r.pxs("blush", [(9, 16), (22, 16)])
    if stage >= 2:
        r.part("frill", "fx", pivot=(16, 4), parent="body", z=-1)
        for x0 in (10, 13, 16, 19, 22):
            r.ellipse(x0, 4.4, 1.8, 2.6, "tendril")
    r.part("bubbles", "fx", pivot=(16, 16), z=2)
    r.pxs("bubble", [(26, 4), (25, 5), (27, 5), (26, 6), (29, 9), (4, 25), (3, 26), (5, 26), (4, 27)])
    return r


RIGS = [tidecoil, frostnip, krakling, bublob]
