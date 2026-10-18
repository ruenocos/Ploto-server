"""Earth rigs: Craggol, Rubbug, Tremole, Gemox (three stages each, see EVOLUTION.md).

Each stage is drawn on its own: a round baby, a standing adolescent and an adult
with a new stance and a dominant feature. Parts with role "static" get no idle
loop (things that must stay attached, like a crystal hump).
"""
from __future__ import annotations

from common import BONE, CREAM, CRYSTAL, GOLD, MOSS, ROCK, base_materials
from pixelkit import Material
from rigkit import Rig, eyes, sym_poly

LIMB = ["#2a2b32", "#484a54", "#6c6e7a", "#9a9caa"]


def _mirror(pts):
    return [(32 - x, y) for x, y in pts]


# ------------------------------------------------------------------ Craggol: pebble -> rock child -> mountain ape
def craggol(stage: int) -> Rig:
    r = Rig("craggol", base_materials(rock=Material(ROCK), limb=Material(LIMB), moss=Material(MOSS),
                                      crack=Material(["#22232a"], flat=True), glow=Material(["#a6f0ff"], flat=True), crystal=Material(CRYSTAL)),
             "#101015", stage)
    if stage == 0:
        # A round pebble with a sprout: all head, stubby feet, nub arms.
        r.part("legs", "legs", pivot=(16, 30), z=-1)
        r.ellipse(12, 30, 2.8, 1.7, "limb")
        r.ellipse(20, 30, 2.8, 1.7, "limb")
        for side in ("arm-l", "arm-r"):
            r.part(side, side, pivot=(8, 20) if side == "arm-l" else (24, 20), z=1)
            r.ellipse(5.8 if side == "arm-l" else 26.2, 21.6, 2.2, 2.7, "limb")
        r.part("body", "body", pivot=(16, 30))
        r.poly([(9, 12), (13, 9.6), (19, 9.6), (23, 12), (25.2, 19), (24.2, 25.6), (20, 29.8), (12, 29.8), (7.8, 25.6), (6.8, 19)], "rock")
        r.pxs("moss", [(11, 11), (12, 10), (13, 10), (14, 10), (18, 10), (19, 10), (20, 11), (21, 11)])
        eyes(r, 16, 16, 6)
        r.pxs("ink", [(15, 22), (16, 22)])
        r.pxs("blush", [(10, 20), (22, 20)])
        r.pxs("crack", [(22, 14), (23, 15), (9, 24), (10, 25)])
        r.part("sprout", "fx", pivot=(16, 10), parent="body", z=1)
        r.pxs("moss", [(16, 7), (16, 8), (16, 9)])
        r.ellipse(14.1, 6.6, 1.9, 1.1, "moss")
        r.ellipse(17.9, 6.2, 1.9, 1.1, "moss")
    elif stage == 1:
        # Stands up: a block torso with its own head, boulder fists, a first crystal.
        r.part("legs", "legs", pivot=(16, 30), z=-1)
        r.poly([(10.4, 26), (14.4, 26), (14.6, 31), (10, 31)], "limb")
        r.poly([(17.6, 26), (21.6, 26), (22, 31), (17.4, 31)], "limb")
        for side in ("arm-l", "arm-r"):
            r.part(side, side, pivot=(8.6, 14) if side == "arm-l" else (23.4, 14), z=1)
            arm = [(8.6, 13.4), (5, 15), (4, 21.6), (6.6, 22.6), (8.8, 19)]
            r.poly(arm if side == "arm-l" else _mirror(arm), "limb")
            fx_, fy = (5.4, 24) if side == "arm-l" else (26.6, 24)
            r.ellipse(fx_, fy, 2.8, 2.5, "rock")
            r.pxs("crack", [(4, 24), (5, 25)] if side == "arm-l" else [(27, 24), (26, 25)])
        r.part("body", "body", pivot=(16, 29))
        r.poly([(8, 14.4), (11, 12.2), (21, 12.2), (24, 14.4), (23.2, 24), (20.2, 27.6), (11.8, 27.6), (8.8, 24)], "rock")
        r.pxs("crack", [(12, 17), (13, 18), (12, 19), (19, 21), (20, 22), (16, 25)])
        r.pxs("moss", [(9, 14), (10, 13), (11, 13), (22, 14), (21, 13)])
        r.part("shard", "static", pivot=(9, 13), parent="body", z=-1)
        r.poly([(7.6, 14.6), (6, 8.6), (10.4, 12.6)], "crystal")
        r.part("head", "head", pivot=(16, 12), parent="body", z=1)
        r.poly([(11.2, 12.8), (11.4, 7.8), (13.6, 5.6), (18.4, 5.6), (20.6, 7.8), (20.8, 12.8)], "rock")
        r.pxs("moss", [(x, 5) for x in range(13, 19)] + [(12, 6), (13, 6), (15, 6), (18, 6), (19, 6)])
        eyes(r, 16, 9, 3)
        r.pxs("crack", [(15, 11), (16, 11), (17, 11)])
    else:
        # A hunched mountain ape: huge shoulders and knuckle-walking arms, a small
        # head sunk between them, a ridge of crystals and glowing seams.
        r.part("legs", "legs", pivot=(16, 30), z=-1)
        r.poly([(8.4, 25), (13.4, 25), (13.6, 31), (7.6, 31)], "limb")
        r.poly([(18.6, 25), (23.6, 25), (24.4, 31), (18.4, 31)], "limb")
        r.part("ridge", "static", pivot=(16, 8), z=-2)
        for base, tip, w in (((11, 6.4), (9.4, -1.6), 2.2), ((16, 8), (16, 0.6), 2), ((21, 6.4), (22.6, -1.6), 2.2), ((5, 7.6), (3.6, 2.2), 1.6), ((27, 7.6), (28.4, 2.2), 1.6)):
            r.poly([(base[0] - w, base[1] + 1.6), tip, (base[0] + w, base[1] + 1.6)], "crystal")
        for side in ("arm-l", "arm-r"):
            r.part(side, side, pivot=(6.4, 10) if side == "arm-l" else (25.6, 10), z=1)
            arm = [(5.4, 11), (2.2, 13), (1, 19), (1.4, 24.6), (4.2, 25), (5.8, 19.6), (7, 14)]
            r.poly(arm if side == "arm-l" else _mirror(arm), "limb")
            r.ellipse(5.2 if side == "arm-l" else 26.8, 10.2, 4.4, 3.6, "rock")  # shoulder boulder
            fist = [(0.4, 25.4), (2.2, 23.6), (6.4, 23.6), (8, 26), (7.4, 31), (1, 31)]
            r.poly(fist if side == "arm-l" else _mirror(fist), "rock")
            r.pxs("crack", [(3, 27), (4, 28), (3, 29)] if side == "arm-l" else [(28, 27), (27, 28), (28, 29)])
            r.pxs("moss", [(3, 8), (4, 7), (5, 7), (6, 7), (7, 8)] if side == "arm-l" else [(28, 8), (27, 7), (26, 7), (25, 7), (24, 8)])
            r.pxs("glow", [(3, 18), (4, 19)] if side == "arm-l" else [(28, 18), (27, 19)])
        r.part("body", "body", pivot=(16, 28))
        r.poly([(8, 11.6), (9.4, 7.6), (12, 6.4), (13.6, 8.6), (18.4, 8.6), (20, 6.4), (22.6, 7.6), (24, 11.6), (23, 19.4), (21, 25.8), (11, 25.8), (9, 19.4)], "rock")
        r.poly([(8.8, 10.4), (9.8, 7.8), (12, 6.6), (13.4, 9), (11.4, 9.4)], "moss")
        r.poly([(23.2, 10.4), (22.2, 7.8), (20, 6.6), (18.6, 9), (20.6, 9.4)], "moss")
        r.pxs("crack", [(11, 14), (12, 15), (12, 16), (11, 17), (21, 15), (20, 16), (20, 17), (21, 18), (14, 20), (15, 21), (17, 21), (18, 22), (16, 23)])
        r.pxs("glow", [(12, 15), (20, 16), (15, 21), (17, 21), (16, 22)])
        r.part("head", "head", pivot=(16, 13), parent="body", z=1)
        r.poly([(12.6, 13.6), (12.6, 9.4), (14.4, 7.6), (17.6, 7.6), (19.4, 9.4), (19.4, 13.6), (16, 14.8)], "rock")
        r.pxs("moss", [(14, 7), (15, 7), (16, 7), (17, 7), (13, 8), (18, 8)])
        eyes(r, 16, 11, 2, iris="glow")
    return r


# ------------------------------------------------------------------ Rubbug: grub -> rhino beetle -> rearing hercules
def rubbug(stage: int) -> Rig:
    r = Rig("rubbug", base_materials(shell=Material(["#3a200c", "#6e3e16", "#a8642a", "#e09a52"]), head=Material(["#241408", "#422612", "#66401f", "#8f5e32"]),
                                     horn=Material(BONE), leg=Material(["#241408", "#3b2210", "#55331a", "#734828"]),
                                     seam=Material(["#2a1606"], flat=True), fleck=Material(["#f2b874"], flat=True), rim=Material(GOLD),
                                     belly=Material(["#4a3018", "#7a5430", "#a87c4c", "#d0a470"]), membrane=Material(["#a89870", "#d8c8a0", "#f2e6c4", "#fffaea"]),
                                     eyeglow=Material(["#ffd23c"], flat=True),
                                     babyhead=Material(["#3e2614", "#6e4626", "#9a6c40", "#c49464"])),
             "#120904", stage)
    if stage == 0:
        # A round baby: big head with big eyes up front, a small dome behind, antennae.
        r.part("legs", "legs", pivot=(16, 29), z=-1)
        for path in ([(8, 25), (4.8, 28.2), (4.2, 30.6)], [(11, 28.2), (9.6, 31)]):
            r.stroke(path, 1.7, "leg")
            r.stroke(_mirror(path), 1.7, "leg")
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(13, 13) if side == "ear-l" else (19, 13), z=-2)
            ant = [(13.4, 13.4), (11.2, 9), (8.4, 7.8)]
            r.stroke(ant if side == "ear-l" else _mirror(ant), 1.1, "leg")
            r.ellipse(8.2 if side == "ear-l" else 23.8, 7.6, 1.4, 1.4, "fleck")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 19, 10.4, 8.6, "shell")
        r.pxs("seam", [(16, y) for y in range(11, 18)])
        r.pxs("fleck", [(9, 16), (10, 13), (22, 14), (23, 18)])
        r.part("head", "head", pivot=(16, 28), parent="body", z=1)
        r.ellipse(16, 24.2, 7.8, 6.2, "babyhead")
        eyes(r, 16, 22, 6)
        r.pxs("blush", [(10, 26), (22, 26)])
        r.pxs("ink", [(15, 27), (16, 27)])
        r.pxs("horn", [(16, 17), (15, 18), (16, 18)])
    elif stage == 1:
        # On six legs: a plated shell, a tall horn, mandibles.
        r.part("legs", "legs", pivot=(16, 22), z=-1)
        for path in ([(9, 16), (4.6, 14.6), (3, 11.6)], [(8.6, 20.6), (3.6, 21), (1.8, 23.6)], [(9.6, 24.6), (5.6, 27.4), (4.6, 30.6)]):
            r.stroke(path, 1.7, "leg")
            r.stroke(_mirror(path), 1.7, "leg")
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 20.6, 8.4, 8.2, "shell")
        r.pxs("seam", [(16, y) for y in range(14, 29)])
        for y in (18, 23):  # plate lines
            r.pxs("seam", [(x, y) for x in range(9, 15)] + [(x, y) for x in range(18, 24)])
        r.pxs("fleck", [(11, 16), (20, 16), (12, 21), (21, 21), (13, 26), (19, 26)])
        r.part("head", "head", pivot=(16, 14), parent="body", z=1)
        r.ellipse(16, 12, 5, 3.4, "head")
        eyes(r, 16, 11, 3)
        sym_poly(r, [(12.2, 13.2), (9.6, 14.4), (10.6, 16), (12.8, 14.6)], "horn")  # mandibles
        r.part("horn", "fx", pivot=(16, 9), parent="head", z=-1)
        r.poly([(14.6, 9.6), (14.8, 4.6), (16.4, 1.8), (18.4, 3.2), (17.4, 5.4), (17.6, 9.6)], "horn")
    else:
        # Rears up on its hind legs, wing cases flung open, a forked hercules horn.
        r.part("legs", "legs", pivot=(16, 25), z=-1)
        r.stroke([(13.6, 24), (12.4, 28), (11, 31)], 2.4, "leg")
        r.stroke([(18.4, 24), (19.6, 28), (21, 31)], 2.4, "leg")
        for side in ("wing-l", "wing-r"):
            r.part(side, side, pivot=(14.4, 10.6) if side == "wing-l" else (17.6, 10.6), z=-1)
            web = [(14, 13.6), (8.6, 16.4), (3.4, 22.6), (2.6, 26.4), (5.4, 26.2), (10, 21.4), (14, 17.4)]
            r.poly(web if side == "wing-l" else _mirror(web), "membrane")
            r.pxs("seam", [(6, 22), (7, 21), (9, 19)] if side == "wing-l" else [(25, 22), (24, 21), (22, 19)])
            case = [(14.6, 12.8), (12.2, 9.4), (7.6, 5.6), (3.2, 2.8), (1.2, 4), (2.2, 8.6), (5.4, 13.2), (9.6, 16.6), (13.6, 16)]
            r.poly(case if side == "wing-l" else _mirror(case), "rim")
            inner = [(13.6, 13.2), (11.6, 10.4), (7.4, 7), (3.6, 4.6), (2.6, 5.4), (3.4, 8.6), (6.2, 12.6), (9.8, 15.2), (13, 14.8)]
            r.poly(inner if side == "wing-l" else _mirror(inner), "shell")
            flecks = [(4, 6), (6, 8), (5, 10), (8, 11), (10, 13)]
            r.pxs("fleck", flecks if side == "wing-l" else [(31 - x, y) for x, y in flecks])
        r.part("body", "body", pivot=(16, 26))
        r.ellipse(16, 18.4, 5.4, 8.2, "belly")
        r.pxs("seam", [(x, y) for y in (15, 18, 21, 24) for x in range(13, 19)])
        for side in ("arm-l", "arm-r"):
            r.part(side, side, pivot=(12, 14) if side == "arm-l" else (20, 14), parent="body", z=1)
            arm = [(12, 14), (8.6, 16.6), (7.6, 12.6)]
            r.stroke(arm if side == "arm-l" else _mirror(arm), 1.7, "leg")
            claw = [(7, 12), (6.6, 10.6), (8, 11)]
            r.poly(claw if side == "arm-l" else _mirror(claw), "horn")
        r.part("head", "head", pivot=(16, 11), parent="body", z=1)
        r.ellipse(16, 9, 4.4, 3.2, "head")
        eyes(r, 16, 8, 3, iris="eyeglow")
        r.part("horn", "fx", pivot=(16, 7), parent="head", z=-1)
        r.poly([(14.4, 7.6), (14.4, 2.4), (15.2, -1), (16.8, -1), (17.6, 2.4), (17.6, 7.6)], "horn")
        sym_poly(r, [(15, 3), (11.4, 1.4), (9.6, -2.6), (12.6, -0.6), (15.4, 0.6)], "horn")
        sym_poly(r, [(13.2, 10.4), (11, 11.6), (11.6, 13)], "horn")  # lower prongs
    return r


# ------------------------------------------------------------------ Tremole: fluffball -> digger -> drill brute
def tremole(stage: int) -> Rig:
    r = Rig("tremole", base_materials(fur=Material(["#2e2420", "#4f3e34", "#7a6252", "#a88c74"]), pink=Material(["#8a3a4a", "#c86a7a", "#ff9aaa", "#ffd0d8"]),
                                      belly=Material(["#5e4c40", "#8c7462", "#b89c84", "#dcc4aa"]),
                                      hat=Material(GOLD), claw=Material(["#f4ead2"], flat=True), nose=Material(["#e05a7a"], flat=True),
                                      lamp=Material(["#fff6b0"], flat=True), goggle=Material(["#7fd8ff"], flat=True), strap=Material(["#3a2a1a"], flat=True),
                                      drill=Material(["#4a4e5c", "#7c8496", "#b4bccc", "#eef2fa"]), groove=Material(["#30343e"], flat=True),
                                      babyfur=Material(["#4a3a30", "#7a6252", "#a88c74", "#d0b49a"])),
             "#120c0a", stage)
    if stage == 0:
        # A fluffball under a helmet two sizes too big; eyes squeezed shut, tiny paws.
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.ellipse(12, 30.2, 2.6, 1.5, "pink")
        r.ellipse(20, 30.2, 2.6, 1.5, "pink")
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 22.4, 9.6, 8.2, "babyfur")
        r.ellipse(16, 23.6, 3.4, 2.4, "pink")
        r.pxs("nose", [(15, 22), (16, 22)])
        eyes(r, 16, 19, 5, style="closed")
        r.pxs("blush", [(9, 22), (10, 22), (21, 22), (22, 22)])
        for side, cx in (("arm-l", 6.8), ("arm-r", 25.2)):
            r.part(side, side, pivot=(cx + (1.8 if side == "arm-l" else -1.8), 24.6), z=1)
            r.ellipse(cx, 25.8, 2.6, 2, "pink")
            r.pxs("claw", [(5, 27), (6, 27)] if side == "arm-l" else [(25, 27), (26, 27)])
        r.part("hat", "head", pivot=(16, 17), parent="body", z=1)
        r.ellipse(16, 11.8, 9, 5.4, "hat")
        r.poly([(6.4, 14.6), (25.6, 14.6), (25.6, 16.6), (6.4, 16.6)], "hat")
        r.pxs("white", [(12, 8), (11, 9), (11, 10)])
    elif stage == 1:
        # Up on its feet: pear-shaped, a long snout, shovel paws and a lamp on the helmet.
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.ellipse(11.4, 29.8, 2.8, 1.6, "pink")
        r.ellipse(20.6, 29.8, 2.8, 1.6, "pink")
        r.part("tail", "tail", pivot=(22, 27), z=-2)
        r.stroke([(21.6, 27.6), (25, 28.4), (26.4, 26.6)], 1.4, "pink")
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 21.6, 7.8, 8, "fur")
        r.ellipse(16, 23.6, 4.6, 5, "belly")
        r.part("head", "head", pivot=(16, 16), parent="body", z=1)
        r.ellipse(16, 14.4, 6, 4.6, "fur")
        r.ellipse(16, 15.4, 4.6, 2.6, "belly")  # light face mask so the eyes read on dark fur
        r.ellipse(16, 17.2, 2.6, 2, "pink")
        r.pxs("nose", [(15, 17), (16, 17)])
        eyes(r, 16, 14.6, 4, brow=False)  # the helmet brim is its brow
        r.ellipse(16, 10.6, 6, 3, "hat")
        r.pxs("hat", [(x, 12) for x in range(9, 23)])
        r.ellipse(16, 9.6, 1.4, 1.2, "lamp")
        for side, cx in (("arm-l", 6.4), ("arm-r", 25.6)):
            r.part(side, side, pivot=(cx + (2.6 if side == "arm-l" else -2.6), 20), z=1)
            r.ellipse(cx, 21.4, 3.4, 2.8, "pink")
            claws = [(2, 22), (2, 23), (3, 24), (4, 24), (5, 24)]
            r.pxs("claw", claws if side == "arm-l" else [(31 - x, y) for x, y in claws])
    else:
        # A stout drill brute: the paws became drills, goggles down, a big headlamp.
        r.part("feet", "legs", pivot=(16, 30), z=-1)
        r.ellipse(10.6, 29.8, 3.6, 1.8, "pink")
        r.ellipse(21.4, 29.8, 3.6, 1.8, "pink")
        r.pxs("claw", [(8, 31), (10, 31), (12, 31), (19, 31), (21, 31), (23, 31)])
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 19.6, 10.4, 9.6, "fur")
        r.ellipse(16, 22.6, 6, 6.2, "belly")
        r.pxs("fur", [(9, 27), (11, 28), (22, 27), (20, 28)])
        r.part("head", "head", pivot=(16, 13), parent="body", z=1)
        r.ellipse(16, 11.6, 6.4, 4.6, "fur")
        r.ellipse(16, 14.8, 3, 2.2, "pink")
        r.pxs("nose", [(15, 14), (16, 14), (15, 15), (16, 15)])
        r.pxs("claw", [(10, 14), (9, 15), (22, 14), (23, 15)])  # whiskers
        r.pxs("strap", [(x, 10) for x in range(9, 24)])
        eyes(r, 16, 10, 3, iris="goggle", brow=False)
        r.ellipse(16, 6.4, 6.8, 3.6, "hat")
        r.pxs("hat", [(x, 9) for x in range(8, 25)])
        r.ellipse(16, 5.4, 2.4, 2, "lamp")
        r.pxs("strap", [(13, 5), (19, 5)])
        for side in ("arm-l", "arm-r"):
            r.part(side, side, pivot=(7, 16) if side == "arm-l" else (25, 16), z=1)
            hub = (6, 16.4) if side == "arm-l" else (26, 16.4)
            r.ellipse(hub[0], hub[1], 3.4, 3.2, "pink")
            cone = [(1, 17.2), (8.8, 19.6), (0.4, 28.8)]
            r.poly(cone if side == "arm-l" else _mirror(cone), "drill")
            grooves = [(3, 19), (4, 19), (5, 20), (2, 21), (3, 22), (4, 22), (2, 24), (3, 24), (1, 26)]
            r.pxs("groove", grooves if side == "arm-l" else [(31 - x, y) for x, y in grooves])
    return r


# ------------------------------------------------------------------ Gemox: lying calf -> young bull -> crystal bison
def gemox(stage: int) -> Rig:
    r = Rig("gemox", base_materials(fur=Material(["#3a2414", "#6e4424", "#a8703c", "#d8a464"]), muzzle=Material(["#9a7a5a", "#d8b894", "#f6e2c4", "#fff6e6"]),
                                    mane=Material(["#2a180c", "#4e3018", "#76502c", "#a07448"]), back=Material(["#2e1c10", "#583620", "#865a34", "#b08050"]),
                                    crystal=Material(CRYSTAL), hoof=Material(["#2a1a0e"], flat=True), gem=Material(["#9ee6f0"], flat=True),
                                    glint=Material(["#e8ffff"], flat=True, floating=True), cream=Material(CREAM)),
             "#120a04", stage)
    if stage == 0:
        # A calf lying down: a big head on a little loaf of a body, crystal nubs.
        r.part("body", "body", pivot=(16, 30))
        r.ellipse(16, 26.8, 10.6, 4.4, "fur")
        r.pxs("hoof", [(9, 30), (10, 30), (22, 30), (23, 30)])
        r.part("head", "head", pivot=(16, 24), parent="body", z=1)
        r.ellipse(16, 18.4, 8.2, 7.2, "fur")
        r.ellipse(16, 22.6, 5, 2.8, "muzzle")
        r.pxs("ink", [(14, 22), (17, 22)])
        eyes(r, 16, 16, 6)
        r.pxs("blush", [(10, 20), (22, 20)])
        r.pxs("gem", [(15, 12), (16, 12), (15, 13), (16, 13)])
        r.pxs("shine", [(15, 12)])
        for side in ("ear-l", "ear-r"):
            r.part(side, side, pivot=(9.4, 16.4) if side == "ear-l" else (22.6, 16.4), parent="head", z=-1)
            ear = [(9.6, 15.4), (4.8, 17.4), (5.6, 19.4), (10, 18.4)]
            r.poly(ear if side == "ear-l" else _mirror(ear), "fur")
        r.part("horns", "fx", pivot=(16, 12), parent="head", z=-1)
        sym_poly(r, [(11, 13), (10.4, 8.2), (13.8, 11.6)], "crystal")
    elif stage == 1:
        # A young bull on four legs: curving crystal horns, the first shoulder crystals, a tail.
        r.part("legs", "legs", pivot=(16, 30), z=-1)
        for x0 in (7.4, 22.6):  # back legs, peeking out
            r.poly([(x0 - 1.6, 25), (x0 + 1.6, 25), (x0 + 1.4, 30.6), (x0 - 1.4, 30.6)], "mane")
        for x0 in (11.4, 20.6):
            r.poly([(x0 - 1.8, 25), (x0 + 1.8, 25), (x0 + 1.6, 31), (x0 - 1.6, 31)], "fur")
            r.pxs("hoof", [(int(x0) - 1, 30), (int(x0), 30), (int(x0) + 1, 30)])
        r.part("tail", "tail", pivot=(24, 20), z=-2)
        r.stroke([(23.6, 20.4), (27, 18.6), (28.4, 15.6)], 1.2, "fur")
        r.poly([(27.4, 16.4), (28.6, 12.6), (29.8, 16)], "crystal")
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 21.2, 9.4, 5.6, "fur")
        r.part("shoulders", "static", pivot=(16, 17), parent="body", z=-1)
        sym_poly(r, [(8, 18), (7.4, 12.6), (10.6, 16.4)], "crystal")
        sym_poly(r, [(10.6, 17), (11.2, 13.4), (12.8, 16.6)], "crystal")
        r.part("head", "head", pivot=(16, 18), parent="body", z=1)
        r.ellipse(16, 15.6, 5.6, 5, "fur")
        r.ellipse(16, 18.6, 3.8, 2.2, "muzzle")
        r.pxs("ink", [(14, 18), (17, 18)])
        eyes(r, 16, 14, 4)
        r.pxs("gem", [(15, 11), (16, 11), (14, 12), (15, 12), (16, 12), (17, 12)])
        r.pxs("shine", [(15, 11)])
        r.part("horns", "fx", pivot=(16, 12), parent="head", z=-1)
        sym_poly(r, [(11.6, 12.6), (8, 11.2), (6.2, 7), (9.2, 8.8), (12.4, 10.8)], "crystal")
    else:
        # A crystal bison: a mountain of crystals on its hump, a shaggy mane,
        # a lowered head with wide horns.
        r.part("legs", "legs", pivot=(16, 30), z=-1)
        for x0 in (6.4, 25.6):
            r.poly([(x0 - 2, 24), (x0 + 2, 24), (x0 + 1.8, 30.6), (x0 - 1.8, 30.6)], "back")
        for x0 in (11, 21):
            r.poly([(x0 - 2.4, 24), (x0 + 2.4, 24), (x0 + 2.2, 31), (x0 - 2.2, 31)], "fur")
            r.pxs("hoof", [(int(x0) - 2, 30), (int(x0) - 1, 30), (int(x0), 30), (int(x0) + 1, 30)])
        r.part("hump", "static", pivot=(16, 12), z=-2)
        for base, tip, w in (((9, 12.6), (7.4, 5.4), 2.4), ((13, 11.4), (12.4, 2.6), 2.6), ((18.4, 11.4), (19.6, 1.4), 2.8), ((23, 12.6), (25, 5.8), 2.4)):
            r.poly([(base[0] - w, base[1] + 2), tip, (base[0] + w, base[1] + 2)], "crystal")
        r.part("body", "body", pivot=(16, 29))
        r.ellipse(16, 20.4, 12.6, 7.4, "back")
        r.ellipse(16, 22.4, 10.6, 5.2, "fur")
        r.part("mane", "static", pivot=(16, 16), parent="body", z=1)
        r.poly([(8.6, 13), (23.4, 13), (25, 18), (23.4, 22.4), (21.6, 21), (20, 23.6), (18, 22), (16, 24.4), (14, 22), (12, 23.6), (10.4, 21), (8.6, 22.4), (7, 18)], "mane")
        r.part("head", "head", pivot=(16, 18), parent="mane", z=1)
        r.ellipse(16, 17.6, 5.2, 4.6, "fur")
        r.ellipse(16, 20.6, 3.6, 2, "muzzle")
        r.pxs("ink", [(14, 20), (17, 20)])
        eyes(r, 16, 16, 4, iris="gem")  # glowing eyes under a heavy brow
        r.pxs("gem", [(15, 12), (16, 12), (14, 13), (15, 13), (16, 13), (17, 13), (15, 14), (16, 14)])
        r.pxs("shine", [(15, 12)])
        r.part("horns", "fx", pivot=(16, 14), parent="head", z=-1)
        sym_poly(r, [(11.6, 15.6), (6.4, 15.4), (3, 12.6), (2.6, 10.2), (5.2, 11.6), (8.4, 12.6), (12.2, 13.4)], "cream")
        sym_poly(r, [(3.4, 12.8), (1.4, 7.4), (5, 11)], "crystal")
        r.part("glints", "fx", pivot=(16, 4), z=3)
        r.pxs("glint", [(5, 3), (27, 3), (16, -1)])
    return r


RIGS = [craggol, rubbug, tremole, gemox]
