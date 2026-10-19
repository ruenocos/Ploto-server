"""Water rigs: Tidecoil, Frostnip, Krakling, Bublob (three stages each).

Each line grows up rather than just bigger (see EVOLUTION.md):
  Tidecoil  tadpole hatchling  -> S-necked young serpent -> fan-frilled leviathan
  Frostnip  snowball           -> horned imp on two legs -> ice warden (crown, pauldrons, blade arms)
  Krakling  round baby octopus -> hooded squid with fins  -> kraken with raised, curling arms
  Bublob    single bubble      -> frilled bell jelly      -> bubble-domed jelly with a crest knot and ribbon arms
"""
from __future__ import annotations

import math

from common import AQUA, ICE, base_materials
from pixelkit import Material
from rigkit import Rig, eyes, mirror_poly, sparkle, sym_poly

WATER_BODY = ["#123a7d", "#1f63b8", "#3aa0ff", "#8fd3ff"]
DEEP = ["#0a1c3c", "#14325e", "#22508a", "#3a74b0"]  # adult accent: darker shell/plates
# Krakling is deep-sea indigo, so it never reads as a blue blob next to Bublob's pale jelly.
INDIGO = ["#1c1a5e", "#33309a", "#5458d6", "#8d92f2"]
INDIGO_DEEP = ["#0e0c30", "#1c1856", "#2c2a80", "#4644a8"]


def flip(pts):
    """Mirror design points across the centre line (for strokes and polys)."""
    return [(32 - x, y) for x, y in pts]


# --------------------------------------------------------------------- Tidecoil
def tidecoil(stage: int) -> Rig:
    r = Rig("tidecoil", base_materials(body=Material(["#0e3f6b", "#1c6fa8", "#2fa8d8", "#86dcf2"]),
                                       belly=Material(["#3f7fa8", "#7cc0e0", "#c4ecfa", "#ffffff"]), fin=Material(AQUA),
                                       vein=Material(["#13606e"], flat=True), horn=Material(["#6e6a5a", "#b8b29a", "#e8e2c8", "#ffffff"]),
                                       plate=Material(DEEP), glow=Material(["#c8fbff"], flat=True),
                                       eye=Material(["#ffd84a"], flat=True)), "#061626", stage)
    if stage == 0:
        # Tadpole hatchling: a big round head on a little curled tail.
        r.part("tail", "tail", pivot=(11, 27), z=-1)
        r.stroke([(12, 28), (7.4, 29.2), (3.6, 28)], 4.2, "body")
        r.stroke([(3.6, 28), (1.6, 25.6), (2.4, 23.2)], 2.7, "body")
        r.poly([(3, 24.2), (-0.8, 19.4), (4.6, 21.6)], "fin")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 26, 7.5, 5, "body")
        r.ellipse(16.5, 27.4, 4.5, 3, "belly")
        r.part("head", "head", pivot=(16, 23.5), parent="body", z=1)
        r.ellipse(16, 16.6, 9, 7.8, "body")
        r.ellipse(16, 20.4, 5.2, 3, "belly")
        eyes(r, 16, 14, 6)
        r.pxs("ink", [(15, 21), (16, 21)])
        r.pxs("blush", [(9, 18), (10, 18), (21, 18), (22, 18)])
        r.part("crest", "fx", pivot=(16, 10.5), parent="head", z=-1)
        r.poly([(14.2, 10.4), (18, 5), (19.6, 10.6)], "fin")
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(8.5, 15) if side == "ear-l" else (23.5, 15), parent="head", z=-1)
            pts = [(8.6, 13.6), (3, 9.8), (4, 14), (7.8, 17.2)]
            r.poly(pts if side == "ear-l" else flip(pts), "fin")
        return r

    if stage == 1:
        # Young serpent: rises into an S, grows a dorsal row, barbels and a tail fan.
        r.part("tail", "tail", pivot=(8, 29), z=-1)
        r.poly([(8, 27.6), (2.4, 24), (1.6, 28), (3, 31.2), (8, 30.6)], "fin")
        r.pxs("vein", [(4, 26), (5, 27), (4, 29), (5, 29)])
        r.part("dorsal", "fx", pivot=(18, 22), z=-1)
        r.poly([(21.6, 24.6), (27.4, 21.6), (25, 27.4)], "fin")
        r.poly([(12.6, 19.4), (7.6, 17.2), (11.6, 22.4)], "fin")
        r.part("body", "body", pivot=(16, 30))
        coil = [(7, 29.4), (12, 30), (19, 29.6), (23, 27.4), (22.4, 24), (17.6, 22.6), (13.6, 20.6), (12.8, 17), (14.4, 13.8)]
        r.stroke(coil, 5, "body")
        r.stroke([(x + 0.6, y + 1.4) for x, y in coil[1:5]], 1.6, "belly")
        r.stroke([(15.4, 21.4), (14.8, 18.6), (15.6, 15.6)], 1.4, "belly")
        r.part("head", "head", pivot=(15, 13), parent="body", z=1)
        r.ellipse(15.4, 10.4, 5.6, 4.4, "body")
        r.ellipse(19.8, 11.8, 3.4, 2.6, "body")
        r.ellipse(18.6, 13, 3.4, 1.3, "belly")
        eyes(r, 16.5, 9, 2)
        r.pxs("ink", [(21, 12), (22, 12)])
        r.stroke([(22.6, 12.6), (25, 12.2), (26.6, 13.6)], 0.9, "fin")
        r.part("crest", "fx", pivot=(14, 7), parent="head", z=-1)
        r.poly([(11.4, 8), (12.6, 3), (15.8, 6.8)], "fin")
        r.part("ear-l", "ear-l", pivot=(10.6, 10.6), parent="head", z=-1)
        r.poly([(11, 9.4), (5.8, 7.4), (7, 11), (10.6, 12.4)], "fin")
        return r

    # Leviathan: rears out of a wide coil, a spined fan frill behind a horned head.
    r.part("tail", "tail", pivot=(5, 29), z=-1)
    r.poly([(5.6, 27.6), (0.4, 22.6), (-0.4, 27.8), (0.6, 31.4), (5.6, 30.8)], "fin")
    r.pxs("vein", [(1, 25), (2, 26), (3, 27), (1, 29), (2, 29), (3, 29)])
    r.part("dorsal", "fx", pivot=(24, 25), z=-1)
    for base, tip in (((21, 24), (24.6, 19.4)), ((25.6, 25), (30.6, 21.2)), ((27.8, 28.4), (32.4, 26.6))):
        r.poly([(base[0] - 1.6, base[1] + 0.6), tip, (base[0] + 1.6, base[1] + 1.4)], "fin")
    r.part("body", "body", pivot=(16, 30))
    coil = [(4, 29.2), (10, 30.6), (17, 30.6), (24, 30), (28.4, 27.4), (27, 23.8), (21.6, 22.8)]
    r.stroke(coil, 5.6, "body")
    neck = [(21.6, 22.8), (17.4, 21.6), (14.8, 18.2), (15, 13.6), (16, 10.6)]
    r.stroke(neck, 5.8, "body")
    r.stroke([(x, y + 1.6) for x, y in coil[1:5]], 1.8, "plate")
    r.pxs("glow", [(9, 31), (14, 32), (20, 31), (25, 29)])
    r.stroke([(16.4, 21.4), (15.8, 18), (16.4, 14.6)], 1.6, "plate")
    r.pxs("belly", [(16, 20), (16, 17), (16, 15)])
    r.part("frill", "fx", pivot=(16, 10), parent="body", z=-1)
    fan = [(8.6, 14.6), (3.6, 10.4), (6.4, 9.2), (4.4, 4.6), (8.8, 6.2), (9.4, 0.8), (12.6, 4.4), (16, -1.4),
           (19.4, 4.4), (22.6, 0.8), (23.2, 6.2), (27.6, 4.6), (25.6, 9.2), (28.4, 10.4), (23.4, 14.6)]
    r.poly(fan, "fin")
    for tip in ((5, 10), (6, 5), (10, 2), (16, 0), (22, 2), (26, 5), (27, 10)):
        r.stroke([(16, 10), (16 + (tip[0] - 16) * 0.82, 10 + (tip[1] - 10) * 0.82)], 0.8, "vein")
    r.part("head", "head", pivot=(16, 12), parent="body", z=1)
    r.ellipse(16, 9.2, 5.2, 3.8, "body")
    r.poly([(11.8, 10.2), (20.2, 10.2), (18.8, 14.6), (16, 15.6), (13.2, 14.6)], "body")
    r.poly([(13.4, 12.8), (18.6, 12.8), (17.6, 15), (14.4, 15)], "plate")
    eyes(r, 16, 10, 2, iris="eye")  # amber: reads against the blue
    r.pxs("white", [(14, 13), (17, 13), (15, 14), (16, 14)])
    r.part("horns", "fx", pivot=(16, 7), parent="head", z=-1)
    r.stroke([(13.6, 7.4), (11, 4.4), (10.6, 1.4)], 1.4, "horn")
    r.stroke([(18.4, 7.4), (21, 4.4), (21.4, 1.4)], 1.4, "horn")
    return r


# --------------------------------------------------------------------- Frostnip
def frostnip(stage: int) -> Rig:
    r = Rig("frostnip", base_materials(body=Material(["#2a5a9a", "#4a8ad0", "#8cc4f2", "#d8f0ff"]), crystal=Material(ICE),
                                       frost=Material(["#eaf8ff"], flat=True), plate=Material(DEEP),
                                       glow=Material(["#9ff6ff"], flat=True), spark=Material(["#eaf8ff"], flat=True, floating=True)),
             "#0a1a33", stage)
    if stage == 0:
        # Snowball: one round body, nub feet and hands, a single crystal sprout.
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.ellipse(11.8, 29.6, 2.8, 2, "body")
        r.ellipse(20.2, 29.6, 2.8, 2, "body")
        for side, cx in (("arm-l", 6.8), ("arm-r", 25.2)):
            r.part(side, side, pivot=(cx + (1.8 if side == "arm-l" else -1.8), 22), z=1)
            r.ellipse(cx, 22.6, 2.1, 1.8, "body")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 21.5, 9.5, 8.8, "body")
        r.pxs("frost", [(11, 16), (12, 15), (13, 15), (20, 15), (21, 16)])
        eyes(r, 16, 20, 6)
        r.pxs("ink", [(15, 25), (16, 24), (17, 25)])
        r.pxs("blush", [(9, 24), (10, 24), (22, 24), (23, 24)])
        r.part("crystal", "fx", pivot=(16, 14.5), parent="body", z=-1)
        r.poly([(14, 14.4), (16, 6.8), (18, 14.4)], "crystal")
        r.poly([(17.2, 13.6), (20.6, 9.2), (19.4, 14.4)], "crystal")
        r.part("snow", "fx", pivot=(16, 20), z=2)
        sparkle(r, 2, 14)
        sparkle(r, 30, 18)
        return r

    if stage == 1:
        # Imp: stands up on two legs, ice horns, pointed ears, claws and a tail.
        r.part("tail", "tail", pivot=(19.6, 26.6), z=-2)
        r.stroke([(19.6, 26.6), (24.4, 27.6), (26.6, 25)], 1.3, "body")
        r.poly([(25.6, 25.6), (27.6, 21.4), (28, 25.4)], "crystal")
        r.part("legs", "legs", pivot=(16, 27), z=-1)
        r.stroke([(13.6, 25.4), (13, 30.4)], 2.8, "body")
        r.stroke([(18.4, 25.4), (19, 30.4)], 2.8, "body")
        r.pxs("frost", [(12, 30), (13, 30), (19, 30), (20, 30)])
        for side in ("arm-l", "arm-r"):
            sx = 1 if side == "arm-l" else -1
            r.part(side, side, pivot=(16 - sx * 4.6, 20.6), z=1)
            arm = [(11.4, 20.6), (8.6, 23), (8, 25.2)]
            claw = [(7, 24.6), (7.6, 27.8), (9, 25)]
            r.stroke(arm if sx == 1 else flip(arm), 2, "body")
            r.poly(claw if sx == 1 else flip(claw), "crystal")
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 23, 5, 4.6, "body")
        r.ellipse(16, 24.2, 2.8, 2.6, "frost")
        r.part("head", "head", pivot=(16, 18), parent="body", z=1)
        r.ellipse(16, 14.4, 5.6, 4.8, "body")
        eyes(r, 16, 13, 2)
        r.pxs("ink", [(14, 17), (15, 17), (16, 17), (17, 17), (18, 17)])
        r.pxs("white", [(15, 18)])
        r.pxs("frost", [(12, 10), (13, 10), (19, 10)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(11, 14.6) if side == "ear-l" else (21, 14.6), parent="head", z=-1)
            pts = [(11.2, 13.2), (5.8, 11.6), (11, 16.4)]
            r.poly(pts if side == "ear-l" else flip(pts), "body")
        r.part("horns", "fx", pivot=(16, 10), parent="head", z=-1)
        sym_poly(r, [(12.2, 11.2), (10.4, 4.4), (14.6, 10)], "crystal")
        return r

    # Ice warden: broad armoured shoulders, crystal pauldrons, blade forearms, a crown.
    r.part("legs", "legs", pivot=(16, 26), z=-1)
    r.stroke([(12.4, 25), (11.8, 30.2)], 3.6, "body")
    r.stroke([(19.6, 25), (20.2, 30.2)], 3.6, "body")
    r.ellipse(11.6, 30.4, 2.6, 1.2, "plate")
    r.ellipse(20.4, 30.4, 2.6, 1.2, "plate")
    for side in ("arm-l", "arm-r"):
        sx = 1 if side == "arm-l" else -1
        r.part(side, side, pivot=(16 - sx * 7.4, 16.4), z=1)
        arm = [(8.6, 17), (6.6, 21), (5.6, 23.4)]
        blade = [(4, 21.6), (7.4, 22.6), (5, 30.4), (2.8, 25.6)]
        pauldron = [(3.4, 18.4), (1.6, 11.8), (5, 14.4), (6.6, 9.2), (9, 14.2), (11.2, 13.4), (11, 18.4)]
        r.stroke(arm if sx == 1 else flip(arm), 3, "body")
        r.poly(blade if sx == 1 else flip(blade), "crystal")
        r.poly(pauldron if sx == 1 else flip(pauldron), "crystal")
        r.ellipse(7.4 if sx == 1 else 24.6, 17, 3.6, 2.2, "plate")
    r.part("body", "body", pivot=(16, 28))
    r.poly([(8.6, 15.4), (23.4, 15.4), (21.4, 27), (10.6, 27)], "body")
    r.poly([(11, 15.6), (21, 15.6), (16, 23.4)], "plate")
    r.pxs("glow", [(16, 19), (15, 18), (17, 18)])
    r.pxs("frost", [(12, 25), (13, 26), (19, 25), (20, 26)])
    r.part("head", "head", pivot=(16, 15), parent="body", z=2)
    r.ellipse(16, 11.6, 4.2, 3.8, "body")
    eyes(r, 16, 11, 2)  # ink: a glow would vanish on pale ice
    r.poly([(13, 13.6), (19, 13.6), (17.8, 16.4), (16, 17.4), (14.2, 16.4)], "frost")
    r.part("crown", "fx", pivot=(16, 8), parent="head", z=-1)
    r.poly([(11.6, 9.4), (11.8, 3), (13.8, 7), (16, -0.6), (18.2, 7), (20.2, 3), (20.4, 9.4)], "crystal")
    r.part("snow", "fx", pivot=(16, 16), z=3)
    sparkle(r, 0, 6)
    sparkle(r, 31, 5)
    return r


# --------------------------------------------------------------------- Krakling
def krakling(stage: int) -> Rig:
    r = Rig("krakling", base_materials(body=Material(INDIGO), tent=Material(INDIGO),
                                       spot=Material(["#120f3e", "#24206e", "#3c3aa8", "#6a6ad8"]), plate=Material(INDIGO_DEEP),
                                       sucker=Material(["#9cd6ff"], flat=True), fin=Material(AQUA),
                                       glow=Material(["#7ff7ff"], flat=True), eye=Material(["#ffa040"], flat=True)), "#071026", stage)
    if stage == 0:
        # Baby octopus: one round head, four stubby curled tentacles.
        for side in ("tent-l", "tent-r"):
            sx = 1 if side == "tent-l" else -1
            r.part(side, side, pivot=(16 - sx * 4.4, 24.5), z=-1)
            for path in ([(10.8, 24.4), (8.4, 28.2), (5.8, 29.8)], [(13.9, 25.6), (13.4, 30.2)]):
                r.stroke(path if sx == 1 else flip(path), 3.2, "tent")
        r.part("body", "body", pivot=(16, 27))
        r.ellipse(16, 17.6, 10.4, 9.6, "body")
        r.ellipse(16, 24.4, 8.3, 3.4, "body")
        r.pxs("spot", [(9, 12), (10, 12), (9, 13), (21, 11), (22, 11), (22, 12), (13, 10)])
        eyes(r, 16, 17, 6)
        r.pxs("ink", [(15, 23), (16, 23)])
        return r

    if stage == 1:
        # Hooded squid: the mantle grows into a pointed hood with side fins; tentacles lengthen.
        r.part("fins", "fx", pivot=(16, 10), z=-2)
        sym_poly(r, [(10.6, 9.4), (4.4, 6.4), (8.6, 14)], "fin")
        for side in ("tent-l", "tent-r"):
            sx = 1 if side == "tent-l" else -1
            r.part(side, side, pivot=(16 - sx * 3, 22), z=-1)
            for path, w in (([(12, 22), (8.4, 24.6), (5.6, 27.6), (4.6, 30.6), (6.8, 31)], 2.4),
                            ([(13.6, 23), (11.8, 27), (11.2, 31)], 2.2), ([(15.2, 23), (15, 31)], 2)):
                r.stroke(path if sx == 1 else flip(path), w, "tent")
            for x, y in ((6, 28), (12, 28)):
                X = x if sx == 1 else 31 - x
                if r.mat_at(X, y) == "tent":
                    r.px(X, y, "sucker")
        r.part("body", "body", pivot=(16, 23))
        r.ellipse(16, 14.6, 6, 7.6, "body")
        r.poly([(10.8, 10.4), (16, 4.4), (21.2, 10.4)], "body")
        r.ellipse(16, 19.6, 6.8, 4.2, "body")
        r.pxs("spot", [(13, 8), (18, 9), (19, 10), (12, 12), (20, 13), (16, 11)])
        eyes(r, 16, 18, 4)
        r.pxs("ink", [(15, 22), (16, 22)])
        return r

    # Kraken: two great arms raised and curling overhead, a spined ridge, splayed legs.
    for side in ("tent-l", "tent-r"):
        sx = 1 if side == "tent-l" else -1
        r.part(side, side, pivot=(16 - sx * 6, 19), z=-1)
        thick = [(10.6, 19.4), (6.6, 16.4), (4.2, 11.4)]
        thin = [(4.2, 11.4), (4.4, 6), (7.6, 3.4), (10, 4.6), (9.4, 7)]
        r.stroke(thick if sx == 1 else flip(thick), 3.8, "tent")
        r.stroke(thin if sx == 1 else flip(thin), 2.6, "tent")
        for x, y in ((7, 16), (5, 13), (5, 9), (7, 5)):
            X = x if sx == 1 else 31 - x
            if r.mat_at(X, y) == "tent":
                r.px(X, y, "sucker")
    r.part("legs", "legs", pivot=(16, 25), z=-1)
    for path, w in (([(12, 24.6), (7.4, 27.6), (2.6, 29.6), (1.2, 27.6)], 3), ([(14.4, 25.6), (12.4, 31)], 2.6)):
        r.stroke(path, w, "tent")
        r.stroke(flip(path), w, "tent")
    r.part("body", "body", pivot=(16, 24))
    r.ellipse(16, 15.4, 7.4, 8.4, "body")
    r.poly([(9.6, 11.6), (16, 1.6), (22.4, 11.6)], "body")
    r.ellipse(16, 22.6, 8.2, 3.2, "body")
    r.pxs("plate", [(11, 12), (12, 12), (11, 13), (20, 11), (21, 11), (21, 12), (15, 6), (16, 6), (16, 7), (13, 9), (18, 9), (9, 17), (22, 16)])
    eyes(r, 16, 17, 4, iris="eye")  # deep-sea orange
    r.poly([(14.4, 20.6), (17.6, 20.6), (16, 23.2)], "plate")
    r.part("fins", "fx", pivot=(16, 7), parent="body", z=-1)
    sym_poly(r, [(12.6, 6.6), (9.4, 1.4), (11.4, 8.6)], "fin")
    return r


# ----------------------------------------------------------------------- Bublob
def bublob(stage: int) -> Rig:
    r = Rig("bublob", base_materials(jelly=Material(["#1a5f8a", "#2f9ad0", "#6fd0ff", "#c8f2ff"]),
                                     tendril=Material(["#1a5f8a", "#3aa0d8", "#8fdcff", "#d8f6ff"]), gloss=Material(["#e8fbff"], flat=True),
                                     rim=Material(["#14507a", "#2482b8", "#4fb6e8", "#a6e4ff"]),
                                     sail=Material(["#5a3a9a", "#8a62d0", "#b89cff", "#e6dcff"]),
                                     core=Material(["#fff6c8"], flat=True), glow=Material(["#fff6c8"], flat=True),
                                     bubble=Material(["#bfefff"], flat=True, floating=True)),
             "#082238", stage)
    if stage == 0:
        # A single bubble: small round dome, two short tendrils, big shiny eyes.
        for side in ("tent-l", "tent-r"):
            sx = 1 if side == "tent-l" else -1
            r.part(side, side, pivot=(16 - sx * 3.2, 21.5), z=-1)
            path = [(12.8, 21.6), (11.7, 25.6), (13.3, 28.8), (12.5, 31)]
            r.stroke(path if sx == 1 else flip(path), 1.9, "tendril")
        r.part("body", "body", pivot=(16, 23))
        r.ellipse(16, 15.3, 9.4, 8.1, "jelly")
        for x in (9, 13.3, 17.6, 21.9):
            r.ellipse(x + 0.1, 22.4, 2.2, 1.8, "jelly")
        r.pxs("gloss", [(9, 12), (9, 11), (10, 10), (11, 9), (12, 9)])
        eyes(r, 16, 15, 6)
        r.pxs("blush", [(9, 19), (10, 19), (21, 19), (22, 19)])
        r.part("bubbles", "fx", pivot=(16, 14), z=2)
        r.pxs("bubble", [(27, 6), (26, 7), (28, 7), (27, 8)])
        return r

    if stage == 1:
        # Bell jelly: a wide frilled skirt, a lit core, long trailing arms.
        for side in ("tent-l", "tent-r"):
            sx = 1 if side == "tent-l" else -1
            r.part(side, side, pivot=(16 - sx * 3, 20), z=-1)
            for path, w, mat in (([(13, 20), (11.2, 24), (13, 27.4), (11.6, 31)], 2.2, "rim"),
                                 ([(9, 19.6), (7, 23.6), (8.6, 27.6), (7.6, 30.4)], 1.1, "tendril")):
                r.stroke(path if sx == 1 else flip(path), w, mat)
        r.part("body", "body", pivot=(16, 20))
        r.ellipse(16, 13.4, 8, 6.8, "jelly")
        for x in range(8, 25, 3):
            r.ellipse(x + 0.5, 19.4, 1.8, 1.6, "rim")
        r.ellipse(16, 11.4, 2.2, 2.2, "core")
        r.pxs("gloss", [(9, 12), (9, 11), (10, 10), (11, 9), (12, 8)])
        eyes(r, 16, 14, 4)
        r.pxs("ink", [(15, 17), (16, 17)])
        r.pxs("blush", [(9, 16), (22, 16)])
        r.part("bubbles", "fx", pivot=(16, 14), z=2)
        r.pxs("bubble", [(27, 7), (26, 8), (28, 8), (27, 9), (3, 13), (4, 25)])
        return r

    # Jelly warden: a tall bell inside a bubble dome, ribbon arms sweeping wide.
    for side in ("tent-l", "tent-r"):
        sx = 1 if side == "tent-l" else -1
        r.part(side, side, pivot=(16 - sx * 4, 18), z=-1)
        for path, w, mat in (([(12, 18), (8, 21.6), (4, 23.4), (2, 26.6), (3.6, 30.4)], 2.6, "rim"),
                             ([(14, 19), (13, 23.6), (10.4, 27.4), (11.6, 31)], 2.1, "rim"),
                             ([(10, 18.6), (6.6, 19.4), (2.4, 19.6), (0.6, 22.4)], 1, "tendril")):
            r.stroke(path if sx == 1 else flip(path), w, mat)
    r.part("body", "body", pivot=(16, 18))
    r.ellipse(16, 11.6, 8.6, 6.8, "jelly")
    for x in range(7, 26, 3):
        r.ellipse(x + 0.5, 17.6, 2, 1.8, "rim")
    r.ellipse(16, 9.6, 3, 2.8, "core")
    r.pxs("gloss", [(9, 10), (9, 9), (10, 8), (11, 7)])
    r.pxs("glow", [(8, 19), (14, 20), (17, 20), (23, 19)])
    eyes(r, 16, 13, 4, iris="glow")
    r.pxs("ink", [(15, 16), (16, 16)])
    # The bubble motif grown up: a protective dome around the bell, with a violet crest knot on top.
    r.part("dome", "fx", pivot=(16, 11), z=2)
    ring = sorted({(round(16 + 12.4 * math.cos(a / 40 * math.pi)), round(11.6 - 12.4 * math.sin(a / 40 * math.pi))) for a in range(3, 38)})
    r.pxs("bubble", [p for p in ring if p[1] <= 15])
    r.pxs("shine", [(7, 4), (8, 3), (6, 5)])
    r.part("crest", "fx", pivot=(16, 5), parent="body", z=1)
    r.ellipse(16, 4.4, 2.2, 1.8, "sail")
    sym_poly(r, [(14.6, 4), (12, 1.6), (15, 2.8)], "sail")
    return r


RIGS = [tidecoil, frostnip, krakling, bublob]
