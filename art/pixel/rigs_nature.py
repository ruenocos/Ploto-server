"""Nature rigs: Thornkin, Vinecoil, Myconite, Petalope (three stages each).

Each line follows EVOLUTION.md: a round baby, an adolescent that stands up and
gains a feature, and an adult with its own silhouette.
"""
from __future__ import annotations

from common import CREAM, GOLD, LEAF, base_materials
from pixelkit import Material
from rigkit import Rig, dot_eyes, mirror_poly, mirror_pts, sym_poly

GREEN = ["#2a6a24", "#4aa03a", "#86d65a", "#c8f29a"]
VINE = ["#173d1c", "#2b6e30", "#45a34a", "#82d36a"]
BARK = ["#5a3a1a", "#8a5a2a", "#b8823e", "#dcae64"]
BLOSSOM = ["#b8406a", "#ff8fb3", "#ffb8cf", "#ffe4ee"]


def _mirror_path(path):
    return [(32 - x, y) for x, y in path]


# ------------------------------------------------------------------ thornkin: sprout -> bud imp -> bloom briar
def thornkin(stage: int) -> Rig:
    r = Rig("thornkin", base_materials(body=Material(GREEN), vine=Material(VINE), leaf=Material(LEAF), thorn=Material(BARK),
                                       stem=Material(["#3e6a1a"], flat=True), petal=Material(BLOSSOM), pollen=Material(["#ffe14d"], flat=True)),
             "#0c1a08", stage)
    if stage == 0:
        # A seedling: one round bean that is all head, two leaf ears and a sprout.
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.ellipse(12.8, 30, 2, 1.3, "vine")
        r.ellipse(19.2, 30, 2, 1.3, "vine")
        r.part("body", "body", pivot=(16, 30))
        sym_poly(r, [(9.6, 22), (7, 21.4), (9.6, 24.2)], "thorn")
        r.ellipse(16, 23.6, 7.2, 6.8, "body")
        dot_eyes(r, 12, 21, 18, h=3)
        r.pxs("ink", [(15, 26), (16, 26)])
        r.pxs("blush", [(10, 25), (11, 25), (20, 25), (21, 25)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(12, 18) if side == "ear-l" else (20, 18), parent="body", z=-1)
            pts = [(14, 18.4), (9.6, 14.2), (6, 15.2), (9.4, 18.6)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "leaf")
        r.part("sprout", "fx", pivot=(16, 17), parent="body", z=1)
        r.pxs("stem", [(16, 14), (16, 15), (16, 16)])
        r.pxs("leaf", [(13, 12), (14, 12), (14, 13), (15, 13), (17, 12), (18, 12), (18, 11), (19, 11)])
    elif stage == 1:
        # Stands up on stubby legs, grows twig arms and a closed flower bud.
        r.part("legs", "legs", pivot=(16, 26), z=-1)
        r.stroke([(13.6, 25.4), (13, 30.2)], 2.4, "vine")
        r.stroke([(18.4, 25.4), (19, 30.2)], 2.4, "vine")
        r.pxs("thorn", [(11, 30), (12, 30), (19, 30), (20, 30)])
        r.part("arm-l", "arm-l", pivot=(11.4, 21), z=-1)
        r.stroke([(11.4, 21), (8.4, 23), (7, 25.8)], 1.5, "vine")
        r.pxs("thorn", [(8, 22)])
        r.part("arm-r", "arm-r", pivot=(20.6, 21), z=-1)
        r.stroke([(20.6, 21), (23.8, 19), (25, 16.2)], 1.5, "vine")
        r.pxs("thorn", [(23, 20)])
        r.part("body", "body", pivot=(16, 27))
        sym_poly(r, [(11, 20), (8.6, 18.4), (11.8, 18.6)], "thorn")
        r.ellipse(16, 23, 5.4, 4.8, "body")
        r.poly([(12, 25), (20, 25), (21, 27.6), (16, 26.6), (11, 27.6)], "leaf")
        r.part("head", "head", pivot=(16, 18.6), parent="body", z=1)
        r.ellipse(16, 13.8, 5.6, 5.2, "body")
        dot_eyes(r, 13, 13, 18)
        r.pxs("ink", [(12, 11), (13, 11), (18, 11), (19, 11), (15, 16), (16, 16)])
        r.pxs("blush", [(11, 15), (20, 15)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(12, 11) if side == "ear-l" else (20, 11), parent="head", z=-1)
            pts = [(12.6, 10.4), (5, 6.6), (3.6, 8.8), (11, 13)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "leaf")
        r.part("bud", "fx", pivot=(16, 9), parent="head", z=1)
        r.pxs("stem", [(16, 7), (16, 8)])
        r.ellipse(16.5, 5.2, 1.5, 2.1, "petal")
        r.pxs("leaf", [(15, 6), (17, 6)])
    else:
        # An upright briar: thorn crown, a full bloom behind its head, vine whips.
        r.part("legs", "legs", pivot=(16, 25), z=-1)
        r.stroke([(13.4, 24), (11.6, 28.4), (10, 30.4)], 2.2, "vine")
        r.stroke([(18.6, 24), (20.4, 28.4), (22, 30.4)], 2.2, "vine")
        r.pxs("thorn", [(8, 30), (9, 30), (11, 30), (20, 30), (22, 30), (23, 30)])
        r.part("arm-l", "arm-l", pivot=(10, 16), z=-1)
        whip = [(10, 16.4), (6.6, 19.6), (4.6, 24), (5.6, 27.6), (3.4, 29.4)]
        r.stroke(whip, 1.5, "vine")
        r.pxs("thorn", [(6, 19), (4, 23), (6, 26), (3, 28)])
        r.part("arm-r", "arm-r", pivot=(22, 16), z=-1)
        lash = [(22, 16.4), (25.6, 13.6), (27.6, 9.8), (26.8, 6.4), (28.6, 4.4)]
        r.stroke(lash, 1.5, "vine")
        r.pxs("thorn", [(25, 13), (28, 10), (26, 7), (29, 4)])
        r.part("body", "body", pivot=(16, 25))
        r.poly([(10, 14), (22, 14), (19.4, 19.6), (18.4, 25), (13.6, 25), (12.6, 19.6)], "body")
        r.poly([(12, 24), (20, 24), (22.4, 28.6), (16, 26.8), (9.6, 28.6)], "leaf")
        r.poly([(12.2, 14.6), (19.8, 14.6), (16, 21.4)], "leaf")
        r.pxs("vine", [(16, 15), (16, 16), (16, 17), (16, 18)])
        sym_poly(r, [(10.6, 14.4), (3.6, 11.6), (5, 16.6), (10.8, 18)], "leaf")
        sym_poly(r, [(4.4, 12), (2, 9.6), (5.6, 11.2)], "thorn")
        r.part("bloom", "fx", pivot=(16, 10), z=-2)
        for cx, cy in ((16, 3.6), (22.2, 7.4), (21, 13.6), (11, 13.6), (9.8, 7.4)):
            r.ellipse(cx, cy, 3, 3, "petal")
        r.ellipse(16, 9.4, 4.4, 4.4, "petal")
        r.part("head", "head", pivot=(16, 14), parent="body", z=1)
        r.ellipse(16, 10.6, 4.2, 3.9, "body")
        r.pxs("pollen", [(13, 10), (14, 10), (13, 11), (17, 10), (18, 10), (18, 11)])
        r.pxs("ink", [(14, 11), (17, 11), (12, 9), (13, 9), (14, 10), (19, 9), (18, 9), (17, 10), (15, 13), (16, 13)])
        r.part("crown", "fx", pivot=(16, 7), parent="head", z=1)
        sym_poly(r, [(12.6, 8.2), (11, 3.6), (14.2, 7.2)], "thorn")
        r.poly([(14.8, 7.2), (16, 2.6), (17.2, 7.2)], "thorn")
    return r


# ------------------------------------------------------------------ vinecoil: curled sprout -> rearing vine -> flytrap hood
def vinecoil(stage: int) -> Rig:
    r = Rig("vinecoil", base_materials(body=Material(VINE), leaf=Material(LEAF), petal=Material(BLOSSOM), pollen=Material(["#ffe14d"], flat=True),
                                       tongue=Material(["#e0344a"], flat=True), thorn=Material(BARK),
                                       jaw=Material(["#5a0e1a", "#a3203a", "#e0445a", "#ff8f9a"]), teeth=Material(["#fff6e6"], flat=True),
                                       vein=Material(["#4c7a1a"], flat=True), hood=Material(["#3a5a12", "#5e8a1e", "#8cbc32", "#c4e46a"])), "#08170a", stage)
    if stage == 0:
        # A plump sprout-worm curled into a spiral, big head resting on it.
        r.part("tail", "tail", pivot=(22, 27), z=-1)
        r.poly([(25.6, 25), (29, 23.4), (27, 27)], "leaf")
        r.part("body", "body", pivot=(18, 30))
        r.stroke([(10, 29.4), (16, 30.2), (22, 29.6), (25, 26.6), (23.4, 23.2), (19, 22.6), (17, 25), (19, 26.8)], 4.4, "body")
        r.pxs("leaf", [(14, 31), (15, 31), (16, 31), (17, 31), (18, 31), (19, 31), (20, 31), (24, 29), (26, 27), (26, 26)])
        r.pxs("ink", [(20, 25), (21, 25), (21, 26)])
        r.part("head", "head", pivot=(10, 27), parent="body", z=1)
        r.ellipse(10, 23.4, 5.2, 4.6, "body")
        dot_eyes(r, 7, 21, 11, h=3)
        r.pxs("tongue", [(10, 26), (9, 27), (11, 27)])
        r.pxs("blush", [(6, 25), (13, 25)])
        r.part("flower", "fx", pivot=(10, 19), parent="head", z=1)
        r.pxs("petal", [(10, 16), (9, 17), (11, 17), (10, 18)])
        r.pxs("pollen", [(10, 17)])
    elif stage == 1:
        # Rears up like a cobra; a pair of leaves frames the head, the flower opens.
        r.part("leaves", "fx", pivot=(16, 26), z=1)
        for pts in ([(4, 27), (1.4, 24.6), (5.6, 25.6)], [(26.6, 25.4), (30, 23.6), (27.6, 27.6)], [(11.4, 18.6), (8, 17), (11.6, 16.4)]):
            r.poly(pts, "leaf")
        r.part("body", "body", pivot=(16, 30))
        r.stroke([(5, 29.6), (12, 30.4), (20, 30), (25, 27.8), (24, 24.4), (18, 23.4), (13.6, 21.4), (12.8, 17), (15, 12.6)], 3.8, "body")
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(12, 10) if side == "ear-l" else (20, 10), parent="body", z=0)
            pts = [(12, 9.6), (5.4, 7.6), (6.8, 11.8)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "leaf")
        r.part("head", "head", pivot=(16, 13), parent="body", z=1)
        r.ellipse(16, 9.4, 5, 4.2, "body")
        dot_eyes(r, 13, 8, 17)
        r.pxs("ink", [(12, 7), (19, 7)])
        r.pxs("tongue", [(16, 13), (16, 14), (15, 15), (17, 15)])
        r.part("flower", "fx", pivot=(16, 5), parent="head", z=1)
        r.pxs("petal", [(16, 2), (15, 3), (17, 3), (14, 4), (18, 4), (15, 5), (17, 5), (16, 3), (16, 4)])
        r.pxs("pollen", [(16, 4)])
    else:
        # A flytrap maw on a rearing neck, a leaf hood flared behind it.
        r.part("hood", "fx", pivot=(16, 16), z=-1)
        sym_poly(r, [(16, 17.6), (8.4, 14.6), (5.4, 8.6), (7, 3.4), (11.4, 1.8), (16, 3.6)], "hood")
        r.pxs("vein", mirror_pts([(13, 14), (11, 12), (10, 10), (9, 8), (9, 6), (11, 4), (13, 3)]))
        r.pxs("thorn", mirror_pts([(4, 9), (5, 5), (7, 13)]))
        r.pxs("petal", [(16, 1), (15, 2), (17, 2), (16, 2)])
        r.part("tail", "tail", pivot=(6, 28), z=1)
        r.pxs("petal", [(3, 25), (2, 26), (4, 26), (3, 27), (1, 25), (5, 25)])
        r.pxs("pollen", [(3, 26)])
        r.part("body", "body", pivot=(16, 30))
        r.stroke([(4, 28.6), (11, 30.6), (19, 30.6), (25.6, 28.6), (27, 25), (23.6, 22.2), (18, 21.6), (15.4, 18.6), (16, 14)], 5, "body")
        r.pxs("thorn", [(9, 28), (15, 28), (21, 28), (25, 25), (21, 20), (12, 31)])
        r.part("head", "head", pivot=(16, 14), parent="body", z=1)
        r.ellipse(16, 7, 6, 3.2, "body")
        r.ellipse(16, 12.4, 5, 2.4, "body")
        r.ellipse(16, 9.8, 4.6, 1.8, "jaw")
        r.pxs("teeth", [(12, 9), (14, 9), (16, 9), (18, 9), (20, 9), (13, 11), (15, 11), (17, 11), (19, 11)])
        r.pxs("pollen", [(13, 6), (18, 6)])
        r.pxs("ink", [(12, 5), (13, 5), (18, 5), (19, 5)])
    return r


# ------------------------------------------------------------------ myconite: button -> squire -> conical-helm knight
def myconite(stage: int) -> Rig:
    r = Rig("myconite", base_materials(cap=Material(["#5e1018", "#a12030", "#de4646", "#ff8a7a"]), stem=Material(CREAM),
                                       gill=Material(["#7a5a44", "#a8846a", "#c9a88a", "#e0c4a8"]), spot=Material(["#fff4ea"], flat=True),
                                       glowspot=Material(["#fff8b0"], flat=True), blade=Material(["#5a6070", "#9aa2b4", "#d8dee8", "#ffffff"]),
                                       hilt=Material(GOLD), shield=Material(["#3a4a24", "#5a7a34", "#86ac4a", "#b4d470"]),
                                       pleat=Material(["#8a6a50"], flat=True), spore=Material(["#e6f2a0"], flat=True, floating=True)), "#1a0606", stage)

    def cut_below(y0: int) -> None:
        r.pxs(None, [(x, y) for y in range(y0, y0 + 6) for x in range(-6, 38) if r.mat_at(x, y) == "cap"])

    if stage == 0:
        # A button mushroom: a cap wider than it is, a tiny stem body, a toothpick sword.
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.ellipse(13.2, 30.2, 1.8, 1.2, "gill")
        r.ellipse(18.8, 30.2, 1.8, 1.2, "gill")
        r.part("arm-r", "arm-r", pivot=(21, 27), z=1)
        r.stroke([(22.4, 22.6), (22.4, 27.4)], 1, "blade")
        r.pxs("hilt", [(21, 27), (22, 27), (23, 27), (22, 28)])
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 26.6, 4.8, 4.4, "stem")
        dot_eyes(r, 13, 24, 17, h=3)
        r.pxs("ink", [(15, 28)])
        r.pxs("blush", [(12, 27), (19, 27)])
        r.part("cap", "head", pivot=(16, 22), parent="body", z=1)
        r.ellipse(16, 19, 8.6, 6.6, "cap")
        cut_below(23)
        r.pxs("gill", [(x, 22) for x in range(6, 27) if r.mat_at(x, 22) == "cap"])
        r.pxs("spot", [(11, 16), (12, 16), (11, 17), (12, 17), (17, 14), (18, 14), (17, 15), (18, 15), (21, 18), (22, 18), (14, 19)])
        r.part("spores", "fx", pivot=(16, 18), z=3)
        r.pxs("spore", [(5, 14), (27, 12), (28, 22)])
    elif stage == 1:
        # A squire: it stands on legs, the cap becomes a kettle helm, sword raised, leaf shield.
        r.part("legs", "legs", pivot=(16, 24), z=-1)
        r.stroke([(14, 23.4), (13.6, 29.6)], 2.2, "stem")
        r.stroke([(18, 23.4), (18.4, 29.6)], 2.2, "stem")
        r.ellipse(13.2, 30, 2.2, 1.2, "gill")
        r.ellipse(18.8, 30, 2.2, 1.2, "gill")
        r.part("arm-l", "arm-l", pivot=(11.4, 19), z=1)
        r.ellipse(9.2, 20.4, 3, 3.8, "shield")
        r.pxs("hilt", [(9, 19), (9, 20), (8, 20), (10, 20), (9, 21)])
        r.part("arm-r", "arm-r", pivot=(21, 19.6), z=1)
        r.stroke([(22.2, 19.4), (27, 8.6)], 1.4, "blade")
        r.pxs("hilt", [(20, 19), (21, 19), (21, 20), (22, 18), (23, 20), (21, 21)])
        r.part("body", "body", pivot=(16, 24))
        r.ellipse(16, 18.8, 4.8, 5.4, "stem")
        r.pxs("gill", [(x, 22) for x in range(12, 21)])
        dot_eyes(r, 13, 16, 17)
        r.pxs("ink", [(13, 15), (14, 15), (17, 15), (18, 15), (15, 19), (16, 19)])
        r.part("cap", "head", pivot=(16, 13), parent="body", z=1)
        r.ellipse(16, 10.6, 6.6, 5, "cap")
        cut_below(13)
        r.ellipse(16, 12.6, 9, 1.5, "cap")
        r.pxs("gill", [(x, 13) for x in range(8, 24)])
        r.pxs("spot", [(12, 8), (13, 8), (12, 9), (17, 7), (18, 7), (18, 8), (20, 10), (14, 11)])
        r.part("spores", "fx", pivot=(16, 12), z=3)
        r.pxs("spore", [(4, 6), (29, 15), (3, 18), (6, 26)])
    else:
        # A knight: conical helm with glowing spots, gill-pleated surcoat, greatsword and kite shield.
        r.part("legs", "legs", pivot=(16, 27), z=-1)
        r.stroke([(13.4, 27), (13.2, 30.6)], 2.2, "gill")
        r.stroke([(18.6, 27), (18.8, 30.6)], 2.2, "gill")
        r.part("arm-l", "arm-l", pivot=(10, 14), z=1)
        r.poly([(3.6, 13.4), (10.6, 13.4), (10.6, 20), (7.1, 25.6), (3.6, 20)], "shield")
        r.pxs("hilt", [(7, 15), (7, 16), (6, 17), (7, 17), (8, 17), (7, 18), (7, 19)])
        r.part("arm-r", "arm-r", pivot=(23, 21), z=1)
        r.stroke([(25, 1.6), (25, 21.4)], 2, "blade")
        r.pxs("hilt", [(22, 22), (23, 22), (24, 22), (25, 22), (26, 22), (27, 22), (25, 23), (25, 24), (25, 25)])
        r.pxs("cap", [(25, 26)])
        r.part("body", "body", pivot=(16, 27))
        r.poly([(11, 12.6), (21, 12.6), (20.4, 21.6), (11.6, 21.6)], "stem")
        r.poly([(11.4, 20.6), (20.6, 20.6), (23.4, 28.6), (8.6, 28.6)], "gill")
        r.pxs("pleat", [(x, y) for x in (11, 14, 17, 20) for y in range(23, 28)])
        r.pxs("cap", [(x, y) for x in range(12, 21) for y in (19, 20)])
        r.pxs("hilt", [(15, 19), (16, 19), (15, 20), (16, 20)])
        r.ellipse(10.6, 13.4, 2.8, 1.7, "cap")
        r.ellipse(21.4, 13.4, 2.8, 1.7, "cap")
        r.pxs("spot", [(10, 13), (21, 13)])
        r.part("cap", "head", pivot=(16, 11), parent="body", z=1)
        r.ellipse(16, 12.4, 3.8, 2.4, "ink")
        r.pxs("glowspot", [(14, 12), (17, 12)])
        r.poly([(8.6, 9.4), (12.4, 4), (16, 0.6), (19.6, 4), (23.4, 9.4)], "cap")
        r.ellipse(16, 9.4, 12, 2.1, "cap")
        r.pxs("gill", [(x, 11) for x in range(7, 25) if r.mat_at(x, 10) == "cap"])
        r.pxs("glowspot", [(15, 3), (16, 3), (13, 6), (19, 6), (18, 5), (11, 8), (21, 8), (16, 7)])
        r.part("spores", "fx", pivot=(16, 12), z=3)
        r.pxs("spore", [(1, 4), (30, 10), (2, 25), (29, 27), (27, 1)])
    return r


# ------------------------------------------------------------------ petalope: sitting fawn -> young deer -> blossom stag
def petalope(stage: int) -> Rig:
    r = Rig("petalope", base_materials(fur=Material(["#5a3418", "#9a5e2e", "#d08c4a", "#f2be82"]), cream=Material(["#a8907a", "#e2cdb4", "#fff1de", "#ffffff"]),
                                       antler=Material(["#4a3018", "#7a5430", "#a87c4c", "#d0a874"]), ear=Material(["#ff9fb8"], flat=True),
                                       petal=Material(["#ff8fb3"], flat=True), petal2=Material(["#ffc6d8"], flat=True), pollen=Material(["#ffe14d"], flat=True),
                                       spot=Material(["#fff4e4"], flat=True), hoof=Material(["#2a1a0e"], flat=True),
                                       backfur=Material(["#4a2a12", "#7e4a22", "#b0743c", "#d8a46a"])), "#160c04", stage)

    def bloom(cx: int, cy: int, big: bool = False) -> None:
        pts = [(cx, cy - 1), (cx - 1, cy), (cx + 1, cy), (cx, cy + 1)]
        if big:
            pts += [(cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1), (cx + 1, cy + 1)]
            r.pxs("petal2", [(cx, cy - 2), (cx - 2, cy), (cx + 2, cy), (cx, cy + 2)])
        r.pxs("petal", pts)
        r.px(cx, cy, "pollen")

    if stage == 0:
        # A fawn sitting with its legs folded: big head, big ears, two antler nubs, one bloom.
        r.part("legs", "legs", pivot=(16, 30), z=1)
        r.ellipse(13.4, 30, 1.8, 1.2, "fur")
        r.ellipse(18.6, 30, 1.8, 1.2, "fur")
        r.pxs("hoof", [(13, 30), (18, 30)])
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 26.4, 5.8, 4.4, "fur")
        r.ellipse(16, 25.6, 2.8, 2.6, "cream")
        r.pxs("spot", [(11, 26), (12, 28), (20, 27), (19, 25)])
        r.part("head", "head", pivot=(16, 22), parent="body", z=1)
        r.ellipse(16, 17.4, 6, 5.2, "fur")
        r.ellipse(16, 20.6, 2.9, 1.8, "cream")
        r.ellipse(12.8, 16.8, 1.4, 2, "ink")
        r.ellipse(19.2, 16.8, 1.4, 2, "ink")
        r.pxs("shine", [(12, 16), (18, 16)])
        r.pxs("ink", [(15, 20), (16, 20)])
        r.pxs("blush", [(10, 19), (21, 19)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(11, 15) if side == "ear-l" else (21, 15), parent="head", z=-1)
            pts = [(11.6, 14.6), (3.8, 12.2), (5.4, 15.8), (10.8, 17.2)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
            r.pxs("ear", [(6, 14), (7, 14), (8, 15)] if side == "ear-l" else [(25, 14), (24, 14), (23, 15)])
        r.part("antlers", "fx", pivot=(16, 12), parent="head", z=-2)
        r.pxs("antler", mirror_pts([(12, 12), (12, 11)]))
        bloom(12, 10)
    elif stage == 1:
        # A young deer up on four legs, a neck, small two-tine antlers in bud.
        r.part("backlegs", "legs", pivot=(16, 24), z=-2)
        r.stroke([(11, 22.6), (10.4, 26), (10.8, 29.4)], 1.3, "backfur")
        r.stroke([(21, 22.6), (21.6, 26), (21.2, 29.4)], 1.3, "backfur")
        r.pxs("hoof", [(10, 29), (21, 29)])
        r.part("legs", "legs", pivot=(16, 24), z=-1)
        r.stroke([(14.6, 23), (14.4, 30.4)], 1.3, "fur")
        r.stroke([(17.4, 23), (17.6, 30.4)], 1.3, "fur")
        r.pxs("hoof", [(14, 30), (17, 30)])
        r.part("body", "body", pivot=(16, 26))
        r.ellipse(16, 21.6, 6.8, 3.8, "fur")
        r.pxs("spot", [(11, 21), (13, 20), (19, 20), (21, 22), (17, 23)])
        r.stroke([(16, 19), (16, 14.6)], 3.6, "fur")
        r.ellipse(16, 18.2, 2, 2.2, "cream")
        r.part("head", "head", pivot=(16, 15), parent="body", z=1)
        r.ellipse(16, 11.4, 4.4, 3.8, "fur")
        r.ellipse(16, 13.8, 2.3, 1.5, "cream")
        r.pxs("ink", [(13, 10), (14, 10), (13, 11), (14, 11), (17, 10), (18, 10), (17, 11), (18, 11), (12, 9), (19, 9), (15, 13), (16, 13)])
        r.pxs("shine", [(13, 10), (17, 10)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(12, 10) if side == "ear-l" else (20, 10), parent="head", z=-1)
            pts = [(12.4, 9.8), (6.6, 8), (9.6, 11.6)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
            r.pxs("ear", [(9, 9)] if side == "ear-l" else [(22, 9)])
        r.part("antlers", "fx", pivot=(16, 8), parent="head", z=-2)
        for path in ([(13.4, 8.4), (12, 5.6), (10.6, 3.8)], [(12.4, 6.4), (9.8, 6)]):
            r.stroke(path, 1.4, "antler")
            r.stroke(_mirror_path(path), 1.4, "antler")
        for cx, cy in ((10, 3), (9, 6)):
            r.pxs("petal", mirror_pts([(cx, cy)]))
    else:
        # A blossom stag: long legs, a petal garland, and a wide antler canopy in full bloom.
        r.part("backlegs", "legs", pivot=(16, 21), z=-2)
        r.ellipse(12.4, 21.6, 2, 2.2, "backfur")
        r.ellipse(19.6, 21.6, 2, 2.2, "backfur")
        r.stroke([(11.6, 22.6), (11, 25.8), (11.4, 29.4)], 1.2, "backfur")
        r.stroke([(20.4, 22.6), (21, 25.8), (20.6, 29.4)], 1.2, "backfur")
        r.pxs("hoof", [(11, 29), (20, 29)])
        r.part("legs", "legs", pivot=(16, 21), z=-1)
        r.stroke([(14.6, 21), (14.2, 25.6), (14.4, 30.6)], 1.3, "fur")
        r.stroke([(17.4, 21), (17.8, 25.6), (17.6, 30.6)], 1.3, "fur")
        r.pxs("hoof", [(14, 30), (17, 30)])
        r.part("tail", "tail", pivot=(22, 19), z=-1)
        bloom(24, 17, big=True)
        r.part("body", "body", pivot=(16, 24))
        r.ellipse(16, 19.6, 5, 4.2, "fur")
        r.ellipse(16, 20.4, 2.8, 2.6, "cream")
        r.pxs("spot", [(12, 18), (19, 18), (12, 21), (19, 21)])
        r.stroke([(16, 17), (16, 12.4)], 3.2, "fur")
        r.part("garland", "fx", pivot=(16, 16), parent="body", z=1)
        for cx, cy in ((12, 15), (14, 16), (16, 17), (18, 16), (20, 15)):
            r.pxs("petal", [(cx, cy), (cx + 1, cy), (cx, cy - 1)])
        r.pxs("pollen", [(12, 15), (16, 17), (20, 15)])
        r.part("head", "head", pivot=(16, 12.6), parent="body", z=2)
        r.ellipse(16, 9.6, 3.8, 3.4, "fur")
        r.ellipse(16, 11.8, 2, 1.4, "cream")
        r.pxs("ink", [(13, 9), (14, 9), (17, 9), (18, 9), (12, 8), (19, 8), (15, 11), (16, 11)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(12.6, 9) if side == "ear-l" else (19.4, 9), parent="head", z=-1)
            pts = [(12.8, 8.6), (8, 8.2), (10.6, 10.4)]
            r.poly(pts if side == "ear-l" else mirror_poly(pts), "fur")
        r.part("antlers", "fx", pivot=(16, 7), parent="head", z=-2)
        branches = [[(13.6, 7), (10.6, 4.6), (6, 3), (1.8, 1)], [(9, 3.8), (8.4, 0.4)], [(5.4, 2.8), (3.2, 5.6)], [(11.6, 5.4), (12.2, 1.6)]]
        for path in branches:
            r.stroke(path, 1.3, "antler")
            r.stroke(_mirror_path(path), 1.3, "antler")
        for cx, cy, big in ((2, 1, True), (8, 0, True), (12, 1, False), (3, 5, False), (6, 3, False)):
            bloom(cx, cy, big)
            bloom(31 - cx, cy, big)
    return r


RIGS = [thornkin, vinecoil, myconite, petalope]
