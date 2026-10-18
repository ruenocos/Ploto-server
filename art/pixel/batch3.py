"""Earth, nature and light: the remaining eleven."""
from __future__ import annotations

from pixelkit import SIZE, Material, Sprite
from common import (BONE, CREAM, CRYSTAL, EARTH, GOLD, LEAF, MOSS, PINK, ROCK, base_materials, dot_eyes, happy_eyes,
                    mirror_poly, mirror_pts, sparkle, star_points, sym_poly)


# ------------------------------------------------------------------ earth
def craggol() -> Sprite:
    """Rock golem: angular body, mossy top, glowing slit eyes."""
    s = Sprite(
        "craggol",
        base_materials(rock=Material(ROCK), limb=Material(["#2a2b32", "#484a54", "#6c6e7a", "#9a9caa"]), moss=Material(MOSS),
                       crack=Material(["#22232a"], flat=True), glow=Material(["#a6f0ff"], flat=True)),
        outline="#101015",
    )
    sym_poly(s, [(7.5, 13.5), (2.4, 16.6), (2, 25), (6.4, 26.4), (8.6, 21)], "limb")
    s.poly([(9, 26), (14.5, 26), (14.5, 31), (9, 31)], "limb")
    s.poly([(17.5, 26), (23, 26), (23, 31), (17.5, 31)], "limb")
    s.poly([(7, 13), (10.6, 9.4), (21.4, 9.4), (25, 13), (26, 23.6), (21.4, 27.6), (10.6, 27.6), (6, 23.6)], "rock")
    s.poly([(10, 10.6), (11, 4.4), (15, 2.2), (21, 4.4), (22, 10.6)], "rock")
    s.pxs("moss", [(12, 3), (13, 3), (14, 2), (15, 2), (16, 2), (17, 2), (18, 3), (19, 3), (11, 4), (13, 4), (16, 3), (20, 4),
                   (8, 12), (9, 11), (10, 11), (22, 11), (23, 12), (3, 17), (4, 16)])
    s.pxs("crack", [(12, 16), (13, 17), (13, 18), (12, 19), (20, 19), (19, 20), (20, 21), (16, 24), (17, 25)])
    s.pxs("glow", [(12, 7), (13, 7), (18, 7), (19, 7)])
    s.pxs("crack", [(15, 10), (16, 10)])
    return s


def rubbug() -> Sprite:
    """Rhino beetle: glossy split shell, big horn, six legs."""
    s = Sprite(
        "rubbug",
        base_materials(shell=Material(["#3a200c", "#6e3e16", "#a8642a", "#e09a52"]), head=Material(["#241408", "#422612", "#66401f", "#8f5e32"]),
                       horn=Material(BONE), leg=Material(["#241408", "#3b2210", "#55331a", "#734828"]),
                       seam=Material(["#2a1606"], flat=True), fleck=Material(["#f2b874"], flat=True)),
        outline="#120904",
    )
    for path in ([(9, 16), (4.6, 14.4), (2.4, 11.4)], [(8.4, 20.4), (3.6, 20.6), (1.6, 23)], [(9.2, 24.4), (5, 27.2), (3.6, 30.2)]):
        s.stroke(path, 1.7, "leg")
        s.stroke([(SIZE - x, y) for x, y in path], 1.7, "leg")
    s.ellipse(16, 20.4, 8.6, 8.6, "shell")
    s.pxs("seam", [(16, y) for y in range(14, 29)])
    s.pxs("fleck", [(11, 17), (12, 22), (20, 17), (21, 23), (10, 20)])
    s.poly([(14.4, 9.6), (15.8, 1.6), (18.2, 3.4), (17.6, 9.6)], "horn")
    s.ellipse(16, 11.6, 5.2, 3.6, "head")
    s.pxs("white", [(13, 11), (19, 11)])
    s.pxs("ink", [(14, 11), (18, 11)])
    return s


def tremole() -> Sprite:
    """Quake mole in a hard hat: pink snout, buck teeth, big digging claws."""
    s = Sprite(
        "tremole",
        base_materials(fur=Material(["#2e2420", "#4f3e34", "#7a6252", "#a88c74"]), pink=Material(["#8a3a4a", "#c86a7a", "#ff9aaa", "#ffd0d8"]),
                       hat=Material(GOLD), claw=Material(["#f4ead2"], flat=True), nose=Material(["#e05a7a"], flat=True)),
        outline="#120c0a",
    )
    s.ellipse(11, 29.6, 2.6, 1.6, "pink")
    s.ellipse(21, 29.6, 2.6, 1.6, "pink")
    s.ellipse(16, 20.4, 9, 9.4, "fur")
    s.ellipse(6.6, 22.2, 3.6, 3, "pink")
    s.ellipse(25.4, 22.2, 3.6, 3, "pink")
    s.pxs("claw", mirror_pts([(3, 24), (4, 25), (5, 25), (6, 25), (7, 25), (5, 26), (7, 26)]))
    s.ellipse(16, 8.6, 6.6, 3.6, "hat")
    s.pxs("hat", [(x, 11) for x in range(8, 24)])
    s.pxs("white", [(16, 7), (16, 6)])
    s.ellipse(16, 15.4, 3.4, 2.5, "pink")
    s.pxs("nose", [(15, 14), (16, 14)])
    s.pxs("white", [(15, 17), (16, 17), (15, 18), (16, 18)])
    s.pxs("ink", [(11, 13), (12, 13), (19, 13), (20, 13)])
    s.pxs("blush", [(10, 15), (21, 15)])
    return s


def gemox() -> Sprite:
    """Ox: curved crystal horns, forehead gem, bulky body."""
    s = Sprite(
        "gemox",
        base_materials(fur=Material(["#3a2414", "#6e4424", "#a8703c", "#d8a464"]), muzzle=Material(["#9a7a5a", "#d8b894", "#f6e2c4", "#fff6e6"]),
                       crystal=Material(CRYSTAL), hoof=Material(["#2a1a0e"], flat=True), gem=Material(["#9ee6f0"], flat=True)),
        outline="#120a04",
    )
    sym_poly(s, [(9.4, 8.6), (4, 7.4), (1.2, 2.6), (5.4, 3.6), (10.4, 6.4)], "crystal")
    s.ellipse(16, 23, 10.2, 7, "fur")
    s.poly([(9, 27), (12.6, 27), (12.6, 31), (9, 31)], "fur")
    s.poly([(19.4, 27), (23, 27), (23, 31), (19.4, 31)], "fur")
    s.pxs("hoof", [(9, 30), (10, 30), (11, 30), (12, 30), (19, 30), (20, 30), (21, 30), (22, 30)])
    s.ellipse(7.6, 10.4, 2.4, 1.4, "fur")
    s.ellipse(24.4, 10.4, 2.4, 1.4, "fur")
    s.ellipse(16, 11.2, 7.2, 6.2, "fur")
    s.ellipse(16, 15.2, 4.6, 2.7, "muzzle")
    s.pxs("ink", [(14, 15), (17, 15)])
    s.pxs("gem", [(15, 6), (16, 6), (14, 7), (15, 7), (16, 7), (17, 7), (15, 8), (16, 8)])
    s.pxs("shine", [(15, 6)])
    dot_eyes(s, 11, 10, 19)
    s.pxs("crystal", [(7, 19), (6, 20), (25, 19), (26, 20)])
    return s


# ------------------------------------------------------------------ nature
def thornkin() -> Sprite:
    """Sprout imp: two-leaf hat, thorny round body, mischievous grin."""
    s = Sprite(
        "thornkin",
        base_materials(body=Material(["#2a6a24", "#4aa03a", "#86d65a", "#c8f29a"]), leaf=Material(LEAF),
                       thorn=Material(["#5a3a1a", "#8a5a2a", "#b8823e", "#dcae64"]), stem=Material(["#4a6a1e"], flat=True)),
        outline="#0c1a08",
    )
    s.poly([(15.4, 8.4), (9.4, 3.6), (4.6, 5.4), (8.8, 8.8)], "leaf")
    s.poly([(16.6, 8.4), (22.6, 2.8), (27.4, 4.6), (23.2, 8.8)], "leaf")
    s.pxs("stem", [(16, 5), (16, 6), (16, 7), (16, 8)])
    for pts in ([(8.4, 15), (4.6, 15.4), (8, 17.4)], [(8.4, 22), (5, 24), (9.2, 24.4)], [(13, 27), (12, 30.4), (15, 27.6)]):
        s.poly(pts, "thorn")
        s.poly(mirror_poly(pts), "thorn")
    s.ellipse(16, 18.8, 8.2, 9, "body")
    dot_eyes(s, 12, 17, 18)
    s.pxs("ink", [(14, 21), (15, 22), (16, 22), (17, 21)])
    s.pxs("blush", [(11, 20), (20, 20)])
    return s


def vinecoil() -> Sprite:
    """Vine snake: coiled leafy body, flower on its head, little forked tongue."""
    s = Sprite(
        "vinecoil",
        base_materials(body=Material(["#173d1c", "#2b6e30", "#45a34a", "#82d36a"]), leaf=Material(LEAF),
                       petal=Material(["#ff8fb3"], flat=True), pollen=Material(["#ffe14d"], flat=True), tongue=Material(["#e0344a"], flat=True)),
        outline="#08170a",
    )
    coil = [(6.6, 28.6), (12, 30), (19, 30), (24.6, 27.8), (26, 23.6), (22.4, 21), (15, 21), (9.6, 18.6), (9.6, 14.4), (13.6, 12)]
    s.stroke(coil, 4.6, "body")
    for pts in ([(4, 26.6), (2, 23.6), (6.4, 25.4)], [(26.4, 20.6), (29.6, 18.6), (27, 22.6)], [(7.6, 15.6), (4.2, 13.8), (8, 13.8)]):
        s.poly(pts, "leaf")
    s.ellipse(17, 9.2, 5.8, 4.6, "body")
    s.pxs("petal", [(21, 3), (20, 4), (22, 4), (21, 5), (20, 2), (22, 2)])
    s.pxs("pollen", [(21, 4)])
    dot_eyes(s, 14, 8, 18)
    s.pxs("tongue", [(17, 13), (16, 14), (18, 14)])
    return s


def myconite() -> Sprite:
    """Mushroom knight: spotted red cap, little sword, drifting spores."""
    s = Sprite(
        "myconite",
        base_materials(cap=Material(["#5e1018", "#a12030", "#de4646", "#ff8a7a"]), stem=Material(CREAM),
                       gill=Material(["#7a5a44", "#a8846a", "#c9a88a", "#e0c4a8"]), spot=Material(["#fff4ea"], flat=True),
                       blade=Material(["#5a6070", "#9aa2b4", "#d8dee8", "#ffffff"]), hilt=Material(GOLD),
                       spore=Material(["#e6f2a0"], flat=True, floating=True)),
        outline="#1a0606",
    )
    s.stroke([(25.6, 13), (25.6, 23)], 1.6, "blade")
    s.pxs("hilt", [(24, 23), (25, 23), (26, 23), (27, 23), (25, 24), (25, 25)])
    s.ellipse(12.8, 28.6, 2.2, 1.6, "gill")
    s.ellipse(19.2, 28.6, 2.2, 1.6, "gill")
    s.ellipse(16, 21.6, 6.2, 7, "stem")
    s.ellipse(16, 11.6, 11.4, 7.6, "cap")
    s.pxs(None, [(x, y) for y in (17, 18, 19) for x in range(SIZE) if s.grid[y][x] == "cap"])
    s.ellipse(16, 21.6, 6.2, 7, "stem")
    s.pxs("gill", [(x, 16) for x in range(7, 25) if s.grid[16][x] == "cap"])
    s.pxs("spot", [(9, 9), (10, 9), (9, 10), (15, 6), (16, 6), (15, 7), (16, 7), (21, 8), (22, 8), (22, 9), (12, 13), (19, 12), (20, 12)])
    dot_eyes(s, 13, 20, 17)
    s.pxs("ink", [(15, 24), (16, 24)])
    s.pxs("blush", [(12, 23), (19, 23)])
    s.pxs("spore", [(4, 5), (27, 3), (29, 13), (2, 15), (5, 22)])
    return s


def petalope() -> Sprite:
    """Fawn: flowering antlers, doe eyes, white-spotted back."""
    s = Sprite(
        "petalope",
        base_materials(fur=Material(["#5a3418", "#9a5e2e", "#d08c4a", "#f2be82"]), cream=Material(["#a8907a", "#e2cdb4", "#fff1de", "#ffffff"]),
                       antler=Material(["#4a3018", "#7a5430", "#a87c4c", "#d0a874"]), ear=Material(["#ff9fb8"], flat=True),
                       petal=Material(["#ff8fb3"], flat=True), pollen=Material(["#ffe14d"], flat=True), spot=Material(["#fff4e4"], flat=True),
                       hoof=Material(["#2a1a0e"], flat=True)),
        outline="#160c04",
    )
    for path in ([(12.6, 8.4), (10.4, 4.6), (8.4, 2.4)], [(10.8, 5.4), (6.8, 5)]):
        s.stroke(path, 1.5, "antler")
        s.stroke([(SIZE - x, y) for x, y in path], 1.5, "antler")
    for cx, cy in ((8, 2), (6, 5)):
        s.pxs("petal", mirror_pts([(cx, cy - 1), (cx - 1, cy), (cx + 1, cy), (cx, cy + 1)]))
        s.pxs("pollen", mirror_pts([(cx, cy)]))
    sym_poly(s, [(11.4, 9.6), (5.4, 8.4), (9.6, 11.8)], "fur")
    s.pxs("ear", mirror_pts([(8, 9), (9, 10)]))
    for path in ([(12.4, 26), (12.4, 30.6)], [(19.6, 26), (19.6, 30.6)]):
        s.stroke(path, 1.8, "fur")
    s.pxs("hoof", [(12, 30), (13, 30), (19, 30), (20, 30)])
    s.ellipse(16, 23, 7.2, 5.6, "fur")
    s.ellipse(16, 21.6, 3.2, 2.8, "cream")
    s.pxs("spot", [(11, 22), (12, 20), (20, 21), (21, 24), (18, 25)])
    s.ellipse(16, 12.2, 5.6, 5, "fur")
    s.ellipse(16, 15.6, 3, 2.1, "cream")
    s.pxs("ink", [(15, 15), (16, 15)])
    s.ellipse(12.9, 12.2, 1.3, 1.9, "ink")
    s.ellipse(19.1, 12.2, 1.3, 1.9, "ink")
    s.pxs("shine", [(12, 11), (18, 11)])
    s.pxs("blush", [(11, 14), (20, 14)])
    return s


# ------------------------------------------------------------------ light
def lumowl() -> Sprite:
    """Owl: huge amber eyes in a pale face disc, ear tufts, star on its chest."""
    s = Sprite(
        "lumowl",
        base_materials(feather=Material(["#6e4a1a", "#a8762a", "#dcae52", "#ffe08e"]), wing=Material(["#4e3412", "#7e5620", "#ac8034", "#d4a656"]),
                       face=Material(CREAM), iris=Material(["#ffb21e"], flat=True), beak=Material(["#ff8a2a"], flat=True),
                       mark=Material(["#8a5e22"], flat=True), star=Material(["#fffbe0"], flat=True)),
        outline="#160c02",
    )
    sym_poly(s, [(9.4, 9.4), (7, 1.6), (13.4, 7.4)], "feather")
    s.ellipse(6.4, 20.6, 2.8, 6.4, "wing")
    s.ellipse(25.6, 20.6, 2.8, 6.4, "wing")
    s.ellipse(16, 18.4, 10, 11, "feather")
    s.ellipse(12, 14, 4.2, 4.2, "face")
    s.ellipse(20, 14, 4.2, 4.2, "face")
    s.ellipse(12, 14, 2.6, 2.8, "iris")
    s.ellipse(20, 14, 2.6, 2.8, "iris")
    s.ellipse(12.4, 14.4, 1.5, 1.7, "ink")
    s.ellipse(20.4, 14.4, 1.5, 1.7, "ink")
    s.pxs("shine", [(11, 13), (19, 13)])
    s.pxs("beak", [(15, 17), (16, 17), (15, 18), (16, 18)])
    s.pxs("mark", [(12, 24), (13, 25), (19, 24), (18, 25), (14, 27), (17, 27)])
    s.pxs("star", [(16, 21), (15, 22), (16, 22), (17, 22), (16, 23)])
    s.pxs("beak", [(13, 29), (14, 29), (18, 29), (19, 29)])
    return s


def glintling() -> Sprite:
    """Star sprite: a plump five-point star with a face, sparkles around it."""
    s = Sprite(
        "glintling",
        base_materials(star=Material(GOLD), spark=Material(["#fff8c8"], flat=True, floating=True)),
        outline="#2a1a02",
    )
    s.poly(star_points(16, 17.4, 14.6, 7.4), "star")
    s.ellipse(16, 17.6, 6.6, 6.2, "star")
    dot_eyes(s, 12, 16, 18)
    s.pxs("ink", [(14, 20), (15, 21), (16, 21), (17, 20)])
    s.pxs("blush", [(11, 19), (20, 19)])
    sparkle(s, 4, 5)
    sparkle(s, 28, 8)
    sparkle(s, 27, 27)
    s.pxs("spark", [(3, 25), (29, 17)])
    return s


def lumistag() -> Sprite:
    """White stag: branching golden antlers, forehead star gem, glowing spots."""
    s = Sprite(
        "lumistag",
        base_materials(fur=Material(["#8a7a5a", "#d8cdb0", "#f6f0e0", "#ffffff"]), muzzle=Material(["#9a9488", "#cfc8b8", "#ece6d8", "#ffffff"]),
                       antler=Material(GOLD), gem=Material(["#ffd23c"], flat=True), glow=Material(["#ffe98a"], flat=True),
                       hoof=Material(["#b8860b"], flat=True)),
        outline="#1e1606",
    )
    for path in ([(12.6, 8.6), (10.4, 4.4), (8.4, 1.2)], [(10.8, 5.2), (6.2, 4.4)], [(9.4, 2.8), (5.6, 1.8)]):
        s.stroke(path, 1.5, "antler")
        s.stroke([(SIZE - x, y) for x, y in path], 1.5, "antler")
    sym_poly(s, [(11.4, 10.6), (5.6, 9.6), (9.8, 12.8)], "fur")
    for path in ([(12.4, 26), (12.4, 30.6)], [(19.6, 26), (19.6, 30.6)]):
        s.stroke(path, 1.8, "fur")
    s.pxs("hoof", [(12, 30), (13, 30), (19, 30), (20, 30)])
    s.ellipse(16, 22.8, 7.6, 4.4, "fur")
    s.ellipse(16, 18, 2.8, 3.4, "fur")
    s.pxs("glow", [(11, 22), (19, 21), (21, 24), (14, 24)])
    s.ellipse(16, 12, 5, 4.6, "fur")
    s.ellipse(16, 15.6, 2.9, 2, "muzzle")
    s.pxs("ink", [(15, 15), (16, 15)])
    s.pxs("gem", [(16, 8), (15, 9), (16, 9), (17, 9), (16, 10)])
    dot_eyes(s, 12, 11, 18)
    s.pxs("blush", [(11, 14), (20, 14)])
    return s


SPRITES = [craggol, rubbug, tremole, gemox, thornkin, vinecoil, myconite, petalope, lumowl, glintling, lumistag]
