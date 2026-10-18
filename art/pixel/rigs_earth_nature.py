"""Earth and nature rigs (three stages each)."""
from __future__ import annotations

from common import BONE, CREAM, CRYSTAL, GOLD, LEAF, MOSS, ROCK, base_materials
from pixelkit import Material
from rigkit import Rig, dot_eyes, mirror_poly, mirror_pts, sym_poly


# ------------------------------------------------------------------ earth
def craggol(stage: int) -> Rig:
    r = Rig("craggol", base_materials(rock=Material(ROCK), limb=Material(["#2a2b32", "#484a54", "#6c6e7a", "#9a9caa"]), moss=Material(MOSS),
                                      crack=Material(["#22232a"], flat=True), glow=Material(["#a6f0ff"], flat=True), crystal=Material(CRYSTAL)),
             "#101015", stage)
    r.part("legs", "legs", pivot=(16, 30), z=-1)
    r.poly([(9, 26), (14.5, 26), (14.5, 31), (9, 31)], "limb")
    r.poly([(17.5, 26), (23, 26), (23, 31), (17.5, 31)], "limb")
    for side in ("arm-l", "arm-r"):
        r.part(side, side, pivot=(8, 15) if side == "arm-l" else (24, 15), z=1)
        pts = [(7.5, 13.5), (2.4, 16.6), (2, 25), (6.4, 26.4), (8.6, 21)]
        r.poly(pts if side == "arm-l" else mirror_poly(pts), "limb")
        if stage >= 1:
            c = [(4, 15.6), (3.2, 11), (6.6, 14.6)]
            r.poly(c if side == "arm-l" else mirror_poly(c), "crystal")
        r.pxs("moss", [(3, 17), (4, 16)] if side == "arm-l" else [(28, 17), (27, 16)])
    r.part("body", "body", pivot=(16, 28))
    r.poly([(7, 13), (10.6, 9.4), (21.4, 9.4), (25, 13), (26, 23.6), (21.4, 27.6), (10.6, 27.6), (6, 23.6)], "rock")
    r.pxs("crack", [(12, 16), (13, 17), (13, 18), (12, 19), (20, 19), (19, 20), (20, 21), (16, 24), (17, 25)])
    r.pxs("moss", [(8, 12), (9, 11), (10, 11), (22, 11), (23, 12)])
    if stage >= 2:
        r.pxs("glow", [(13, 17), (13, 18), (19, 20), (16, 24)])
    r.part("head", "head", pivot=(16, 10), parent="body", z=1)
    r.poly([(10, 10.6), (11, 4.4), (15, 2.2), (21, 4.4), (22, 10.6)], "rock")
    r.pxs("moss", [(12, 3), (13, 3), (14, 2), (15, 2), (16, 2), (17, 2), (18, 3), (19, 3), (11, 4), (13, 4), (16, 3), (20, 4)])
    r.pxs("glow", [(12, 7), (13, 7), (18, 7), (19, 7)])
    r.pxs("crack", [(15, 10), (16, 10)])
    if stage >= 2:  # moss beard
        r.poly([(11, 10), (21, 10), (19, 13.6), (16, 15), (13, 13.6)], "moss")
        r.part("crown", "fx", pivot=(16, 3), parent="head", z=-1)
        for x0, h in ((12, 3), (16, 4.6), (20, 3)):
            r.poly([(x0 - 1.4, 3.4), (x0, 3.4 - h), (x0 + 1.4, 3.4)], "crystal")
    return r


def rubbug(stage: int) -> Rig:
    r = Rig("rubbug", base_materials(shell=Material(["#3a200c", "#6e3e16", "#a8642a", "#e09a52"]), head=Material(["#241408", "#422612", "#66401f", "#8f5e32"]),
                                     horn=Material(BONE), leg=Material(["#241408", "#3b2210", "#55331a", "#734828"]),
                                     seam=Material(["#2a1606"], flat=True), fleck=Material(["#f2b874"], flat=True), rim=Material(GOLD)),
             "#120904", stage)
    r.part("legs", "legs", pivot=(16, 22), z=-1)
    for path in ([(9, 16), (4.6, 14.4), (2.4, 11.4)], [(8.4, 20.4), (3.6, 20.6), (1.6, 23)], [(9.2, 24.4), (5, 27.2), (3.6, 30.2)]):
        r.stroke(path, 1.7, "leg")
        r.stroke([(32 - x, y) for x, y in path], 1.7, "leg")
    r.part("body", "body", pivot=(16, 29))
    if stage >= 2:
        r.ellipse(16, 20.4, 9.4, 9.4, "rim")
    r.ellipse(16, 20.4, 8.6, 8.6, "shell")
    r.pxs("seam", [(16, y) for y in range(14, 29)])
    flecks = [(11, 17), (12, 22), (20, 17), (21, 23), (10, 20)]
    if stage >= 1:
        flecks += [(13, 26), (19, 26), (13, 19), (19, 20)]
    r.pxs("fleck", flecks)
    r.part("head", "head", pivot=(16, 14), parent="body", z=1)
    r.ellipse(16, 11.6, 5.2, 3.6, "head")
    r.pxs("white", [(13, 11), (19, 11)])
    r.pxs("ink", [(14, 11), (18, 11)])
    r.part("horn", "fx", pivot=(16, 9), parent="head", z=-1)
    r.poly([(14.4, 9.6), (15.8, 1.6 - 1.4 * stage), (18.2, 3.4 - 1.4 * stage), (17.6, 9.6)], "horn")
    if stage >= 2:
        sym_poly(r, [(12, 10), (8.6, 5.6), (13.4, 8.6)], "horn")
    return r


def tremole(stage: int) -> Rig:
    r = Rig("tremole", base_materials(fur=Material(["#2e2420", "#4f3e34", "#7a6252", "#a88c74"]), pink=Material(["#8a3a4a", "#c86a7a", "#ff9aaa", "#ffd0d8"]),
                                      hat=Material(GOLD), claw=Material(["#f4ead2"], flat=True), nose=Material(["#e05a7a"], flat=True),
                                      lamp=Material(["#fff6b0"], flat=True), goggle=Material(["#7fd8ff"], flat=True), strap=Material(["#3a2a1a"], flat=True)),
             "#120c0a", stage)
    r.part("feet", "legs", pivot=(16, 30), z=-1)
    r.ellipse(11, 29.6, 2.6, 1.6, "pink")
    r.ellipse(21, 29.6, 2.6, 1.6, "pink")
    r.part("body", "body", pivot=(16, 29))
    r.ellipse(16, 20.4, 9, 9.4, "fur")
    r.ellipse(16, 15.4, 3.4, 2.5, "pink")
    r.pxs("nose", [(15, 14), (16, 14)])
    r.pxs("white", [(15, 17), (16, 17), (15, 18), (16, 18)])
    if stage >= 2:  # goggles
        r.pxs("strap", [(x, 12) for x in range(8, 24)])
        r.pxs("goggle", [(10, 12), (11, 12), (12, 12), (19, 12), (20, 12), (21, 12), (11, 13), (20, 13)])
    else:
        r.pxs("ink", [(11, 13), (12, 13), (19, 13), (20, 13)])
    r.pxs("blush", [(10, 15), (21, 15)])
    for side, cx in (("arm-l", 6.6), ("arm-r", 25.4)):
        r.part(side, side, pivot=(cx + (2.4 if side == "arm-l" else -2.4), 20), z=1)
        g = 1 + 0.2 * stage
        r.ellipse(cx, 22.2, 3.6 * g, 3 * g, "pink")
        claws = [(3, 24), (4, 25), (5, 25), (6, 25), (7, 25), (5, 26), (7, 26)]
        if stage >= 2:
            claws += [(2, 25), (3, 26), (4, 27), (6, 27), (8, 27)]
        r.pxs("claw", claws if side == "arm-l" else [(31 - x, y) for x, y in claws])
    r.part("hat", "fx", pivot=(16, 11), parent="body", z=1)
    r.ellipse(16, 8.6, 6.6, 3.6, "hat")
    r.pxs("hat", [(x, 11) for x in range(8, 24)])
    if stage >= 1:
        r.ellipse(16, 6.6, 1.6, 1.4, "lamp")
    else:
        r.pxs("white", [(16, 7), (16, 6)])
    return r


def gemox(stage: int) -> Rig:
    r = Rig("gemox", base_materials(fur=Material(["#3a2414", "#6e4424", "#a8703c", "#d8a464"]), muzzle=Material(["#9a7a5a", "#d8b894", "#f6e2c4", "#fff6e6"]),
                                    crystal=Material(CRYSTAL), hoof=Material(["#2a1a0e"], flat=True), gem=Material(["#9ee6f0"], flat=True)),
             "#120a04", stage)
    r.part("legs", "legs", pivot=(16, 30), z=-1)
    r.poly([(9, 27), (12.6, 27), (12.6, 31), (9, 31)], "fur")
    r.poly([(19.4, 27), (23, 27), (23, 31), (19.4, 31)], "fur")
    r.pxs("hoof", [(9, 30), (10, 30), (11, 30), (12, 30), (19, 30), (20, 30), (21, 30), (22, 30)])
    r.part("body", "body", pivot=(16, 29))
    r.ellipse(16, 23, 10.2, 7, "fur")
    shards = [(7, 19), (6, 20), (25, 19), (26, 20)]
    if stage >= 1:
        r.poly([(12, 17.6), (13.4, 13.6), (15, 17.4)], "crystal")
        r.poly([(17, 17.4), (18.8, 12.8), (20.4, 17.6)], "crystal")
    if stage >= 2:
        sym_poly(r, [(7, 22), (3.6, 18), (8, 19)], "crystal")
        sym_poly(r, [(9, 26), (6, 24), (10, 24)], "crystal")
    r.pxs("crystal", shards)
    r.part("head", "head", pivot=(16, 16), parent="body", z=1)
    r.ellipse(7.6, 10.4, 2.4, 1.4, "fur")
    r.ellipse(24.4, 10.4, 2.4, 1.4, "fur")
    r.ellipse(16, 11.2, 7.2, 6.2, "fur")
    r.ellipse(16, 15.2, 4.6, 2.7, "muzzle")
    r.pxs("ink", [(14, 15), (17, 15)])
    gem = [(15, 6), (16, 6), (14, 7), (15, 7), (16, 7), (17, 7), (15, 8), (16, 8)]
    if stage >= 2:
        gem += [(15, 5), (16, 5), (13, 7), (18, 7), (15, 9), (16, 9)]
    r.pxs("gem", gem)
    r.pxs("shine", [(15, 6)])
    dot_eyes(r, 11, 10, 19)
    r.part("horns", "fx", pivot=(16, 7), parent="head", z=-1)
    reach = 1.4 * stage
    sym_poly(r, [(9.4, 8.6), (4 - reach, 7.4 - reach * 0.3), (1.2 - reach, 2.6 - reach), (5.4 - reach * 0.5, 3.6 - reach * 0.4), (10.4, 6.4)], "crystal")
    return r


# ------------------------------------------------------------------ nature
def thornkin(stage: int) -> Rig:
    r = Rig("thornkin", base_materials(body=Material(["#2a6a24", "#4aa03a", "#86d65a", "#c8f29a"]), leaf=Material(LEAF),
                                       thorn=Material(["#5a3a1a", "#8a5a2a", "#b8823e", "#dcae64"]), stem=Material(["#4a6a1e"], flat=True),
                                       petal=Material(["#ff8fb3", "#ffb0c8", "#ffd0de", "#ffffff"]), pollen=Material(["#ffe14d"], flat=True)),
             "#0c1a08", stage)
    if stage >= 2:  # vine arms
        for side in ("arm-l", "arm-r"):
            r.part(side, side, pivot=(9, 19) if side == "arm-l" else (23, 19), z=-1)
            path = [(9, 19), (5, 17.6), (2.6, 14.6), (3.6, 12.4)]
            r.stroke(path if side == "arm-l" else [(32 - x, y) for x, y in path], 1.6, "leaf")
    r.part("feet", "legs", pivot=(16, 30), z=1)
    r.pxs("stem", [(12, 28), (13, 29), (19, 28), (18, 29)])
    r.part("body", "body", pivot=(16, 29))
    for pts in ([(8.4, 15), (4.6, 15.4), (8, 17.4)], [(8.4, 22), (5, 24), (9.2, 24.4)], [(13, 27), (12, 30.4), (15, 27.6)]):
        r.poly(pts, "thorn")
        r.poly(mirror_poly(pts), "thorn")
    if stage >= 1:
        sym_poly(r, [(10, 11.6), (7.4, 9.6), (11, 10.4)], "thorn")
    r.ellipse(16, 18.8, 8.2, 9, "body")
    dot_eyes(r, 12, 17, 18)
    r.pxs("ink", [(14, 21), (15, 22), (16, 22), (17, 21)])
    r.pxs("blush", [(11, 20), (20, 20)])
    for side in ("ear-l", "ear-r"):
        r.part(side, side, pivot=(16, 9), parent="body", z=1 if side == "ear-r" else -1)
        pts = [(15.4, 8.4), (9.4, 3.6), (4.6, 5.4), (8.8, 8.8)]
        r.poly(pts if side == "ear-l" else [(32 - x, y + (-0.8 if True else 0)) for x, y in pts], "leaf")
    r.part("sprout", "fx", pivot=(16, 9), parent="body", z=2)
    r.pxs("stem", [(16, 5), (16, 6), (16, 7), (16, 8)] + ([(16, 4), (16, 3)] if stage >= 1 else []))
    if stage == 1:
        r.ellipse(16.5, 2.4, 1.6, 1.8, "petal")
    if stage >= 2:
        for dx, dy in ((0, -2.2), (2.2, 0), (0, 2.2), (-2.2, 0)):
            r.ellipse(16.5 + dx, 2.2 + dy, 1.6, 1.6, "petal")
        r.px(16, 2, "pollen")
    return r


def vinecoil(stage: int) -> Rig:
    r = Rig("vinecoil", base_materials(body=Material(["#173d1c", "#2b6e30", "#45a34a", "#82d36a"]), leaf=Material(LEAF),
                                       petal=Material(["#ff8fb3"], flat=True), pollen=Material(["#ffe14d"], flat=True), tongue=Material(["#e0344a"], flat=True),
                                       thorn=Material(["#5a3a1a", "#8a5a2a", "#b8823e", "#dcae64"])), "#08170a", stage)
    coil = [(6.6, 28.6), (12, 30), (19, 30), (24.6, 27.8), (26, 23.6), (22.4, 21), (15, 21), (9.6, 18.6), (9.6, 14.4), (13.6, 12)]
    r.part("leaves", "fx", pivot=(16, 24), z=1)
    leaves = [[(4, 26.6), (2, 23.6), (6.4, 25.4)], [(26.4, 20.6), (29.6, 18.6), (27, 22.6)], [(7.6, 15.6), (4.2, 13.8), (8, 13.8)]]
    if stage >= 1:
        leaves += [[(17, 31.4), (20, 33), (21, 30.6)], [(24, 29), (28, 30.4), (26.6, 27)]]
    for pts in leaves:
        r.poly(pts, "leaf")
    r.part("body", "body", pivot=(16, 30))
    r.stroke(coil, 4.6, "body")
    if stage >= 2:
        r.pxs("thorn", [(11, 27), (17, 27), (23, 25), (20, 19), (8, 16)])
    r.part("head", "head", pivot=(15, 13), parent="body", z=1)
    r.ellipse(17, 9.2, 5.8, 4.6, "body")
    dot_eyes(r, 14, 8, 18)
    r.pxs("tongue", [(17, 13), (16, 14), (18, 14)])
    r.part("flower", "fx", pivot=(21, 5), parent="head", z=1)
    petals = [(21, 3), (20, 4), (22, 4), (21, 5), (20, 2), (22, 2)]
    if stage >= 1:
        petals += [(19, 3), (23, 3), (21, 1), (19, 5), (23, 5)]
    r.pxs("petal", petals)
    r.pxs("pollen", [(21, 4)] + ([(21, 3)] if stage >= 1 else []))
    if stage >= 2:
        r.pxs("petal", [(13, 4), (12, 5), (14, 5), (13, 6)])
        r.pxs("pollen", [(13, 5)])
    return r


def myconite(stage: int) -> Rig:
    r = Rig("myconite", base_materials(cap=Material(["#5e1018", "#a12030", "#de4646", "#ff8a7a"]), stem=Material(CREAM),
                                       gill=Material(["#7a5a44", "#a8846a", "#c9a88a", "#e0c4a8"]), spot=Material(["#fff4ea"], flat=True),
                                       glowspot=Material(["#fff8b0"], flat=True), blade=Material(["#5a6070", "#9aa2b4", "#d8dee8", "#ffffff"]),
                                       hilt=Material(GOLD), shield=Material(["#3a4a24", "#5a7a34", "#86ac4a", "#b4d470"]),
                                       spore=Material(["#e6f2a0"], flat=True, floating=True)), "#1a0606", stage)
    r.part("feet", "legs", pivot=(16, 30), z=-1)
    r.ellipse(12.8, 28.6, 2.2, 1.6, "gill")
    r.ellipse(19.2, 28.6, 2.2, 1.6, "gill")
    r.part("arm-r", "arm-r", pivot=(24, 22), z=1)
    r.stroke([(25.6, 13 - stage), (25.6, 23)], 1.6, "blade")
    r.pxs("hilt", [(24, 23), (25, 23), (26, 23), (27, 23), (25, 24), (25, 25)])
    if stage >= 1:
        r.part("arm-l", "arm-l", pivot=(9, 22), z=1)
        r.ellipse(7.4, 23, 2.8, 3.4, "shield")
        r.px(7, 23, "hilt")
    r.part("body", "body", pivot=(16, 29))
    r.ellipse(16, 21.6, 6.2, 7, "stem")
    dot_eyes(r, 13, 20, 17)
    r.pxs("ink", [(15, 24), (16, 24)])
    r.pxs("blush", [(12, 23), (19, 23)])
    r.part("cap", "head", pivot=(16, 16), parent="body", z=1)
    w = 11.4 + 1.2 * stage
    r.ellipse(16, 11.6, w, 7.6 + 0.6 * stage, "cap")
    r.pxs(None, [(x, y) for y in (17, 18, 19, 20) for x in range(-4, 36) if r.mat_at(x, y) == "cap"])
    r.pxs("gill", [(x, 16) for x in range(4, 28) if r.mat_at(x, 16) == "cap"])
    spots = [(9, 9), (10, 9), (9, 10), (15, 6), (16, 6), (15, 7), (16, 7), (21, 8), (22, 8), (22, 9), (12, 13), (19, 12), (20, 12)]
    r.pxs("glowspot" if stage >= 2 else "spot", spots)
    r.part("spores", "fx", pivot=(16, 14), z=3)
    r.pxs("spore", [(4, 5), (27, 3), (29, 13), (2, 15), (5, 22)] + ([(1, 8), (30, 20)] if stage >= 1 else []))
    return r


def petalope(stage: int) -> Rig:
    r = Rig("petalope", base_materials(fur=Material(["#5a3418", "#9a5e2e", "#d08c4a", "#f2be82"]), cream=Material(["#a8907a", "#e2cdb4", "#fff1de", "#ffffff"]),
                                       antler=Material(["#4a3018", "#7a5430", "#a87c4c", "#d0a874"]), ear=Material(["#ff9fb8"], flat=True),
                                       petal=Material(["#ff8fb3"], flat=True), pollen=Material(["#ffe14d"], flat=True), spot=Material(["#fff4e4"], flat=True),
                                       hoof=Material(["#2a1a0e"], flat=True)), "#160c04", stage)
    r.part("legs", "legs", pivot=(16, 30), z=-1)
    for path in ([(12.4, 26), (12.4, 30.6)], [(19.6, 26), (19.6, 30.6)]):
        r.stroke(path, 1.8, "fur")
    r.pxs("hoof", [(12, 30), (13, 30), (19, 30), (20, 30)])
    if stage >= 2:
        r.part("tail", "tail", pivot=(22, 22), z=-2)
        r.ellipse(23.6, 21, 2, 1.6, "cream")
        r.pxs("petal", [(25, 19), (24, 20), (26, 20), (25, 21)])
        r.pxs("pollen", [(25, 20)])
    r.part("body", "body", pivot=(16, 28))
    r.ellipse(16, 23, 7.2, 5.6, "fur")
    r.ellipse(16, 21.6, 3.2, 2.8, "cream")
    r.pxs("spot", [(11, 22), (12, 20), (20, 21), (21, 24), (18, 25)])
    r.part("head", "head", pivot=(16, 17), parent="body", z=1)
    r.ellipse(16, 12.2, 5.6, 5, "fur")
    r.ellipse(16, 15.6, 3, 2.1, "cream")
    r.pxs("ink", [(15, 15), (16, 15)])
    r.ellipse(12.9, 12.2, 1.3, 1.9, "ink")
    r.ellipse(19.1, 12.2, 1.3, 1.9, "ink")
    r.pxs("shine", [(12, 11), (18, 11)])
    r.pxs("blush", [(11, 14), (20, 14)])
    for side in ("ear-l", "ear-r"):
        r.part(side, side, pivot=(11, 10) if side == "ear-l" else (21, 10), parent="head", z=-1)
        pts = [(11.4, 9.6), (5.4, 8.4), (9.6, 11.8)]
        r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
        r.pxs("ear", [(8, 9), (9, 10)] if side == "ear-l" else [(23, 9), (22, 10)])
    r.part("antlers", "fx", pivot=(16, 8), parent="head", z=-2)
    for path in ([(12.6, 8.4), (10.4, 4.6), (8.4, 2.4)], [(10.8, 5.4), (6.8, 5)]) + (([(9.4, 3.4), (10, 0.4)],) if stage >= 1 else ()):
        r.stroke(path, 1.5, "antler")
        r.stroke([(32 - x, y) for x, y in path], 1.5, "antler")
    blooms = [(8, 2), (6, 5)] + ([(10, 0)] if stage >= 1 else []) + ([(12, 3), (4, 3)] if stage >= 2 else [])
    for cx, cy in blooms:
        r.pxs("petal", mirror_pts([(cx, cy - 1), (cx - 1, cy), (cx + 1, cy), (cx, cy + 1)]))
        r.pxs("pollen", mirror_pts([(cx, cy)]))
    return r


RIGS = [craggol, rubbug, tremole, gemox, thornkin, vinecoil, myconite, petalope]
