"""Fire and water: Pyrup, Magmaul, Emberwing, Tidecoil, Frostnip, Bublob."""
from __future__ import annotations

from pixelkit import Material, Sprite
from common import (AQUA, BONE, FIRE, FLAME, GOLD, ICE, INK, PEACH, WATER, base_materials, dot_eyes,
                    happy_eyes, mirror_poly, mirror_pts, sparkle, sym_poly)
from pixelkit import SIZE


def pyrup() -> Sprite:
    """Small round pup: flame tail, pointy ears with flame tufts, happy."""
    s = Sprite("pyrup", base_materials(fur=Material(FIRE), belly=Material(PEACH), flame=Material(FLAME)), outline="#1a0606")
    s.poly([(10, 25), (5, 23.5), (2.5, 18), (5.5, 19.5), (5, 13.5), (8.5, 18.5), (11, 22)], "flame")
    sym_poly(s, [(10.5, 10.5), (8.2, 3.2), (14.5, 7.5)], "fur")
    s.ellipse(16, 24, 8, 6.4, "fur")
    s.ellipse(16, 25.6, 4.4, 3.9, "belly")
    s.ellipse(12, 29.6, 2.5, 1.7, "fur")
    s.ellipse(20, 29.6, 2.5, 1.7, "fur")
    s.ellipse(16, 13.4, 7.6, 6.6, "fur")
    s.ellipse(16, 16.4, 3.6, 2.5, "belly")
    s.pxs("flame", mirror_pts([(9, 5), (9, 6), (10, 7), (10, 6)]))
    happy_eyes(s, 11, 13, 18)
    s.pxs("ink", [(15, 15), (16, 15), (15, 17), (16, 17)])
    s.pxs("blush", [(10, 15), (21, 15)])
    return s


def magmaul() -> Sprite:
    """Hulking basalt titan: lava cracks, horns, glowing angry face."""
    s = Sprite(
        "magmaul",
        base_materials(
            basalt=Material(["#1e100e", "#3a1c17", "#5c2c22", "#86412f"]),
            arm=Material(["#1a0d0b", "#311712", "#4e241c", "#73382a"]),
            horn=Material(BONE),
            lava=Material(["#ffa12c"], flat=True),
            core=Material(["#fff1a0"], flat=True),
        ),
        outline="#0e0504",
    )
    s.ellipse(5.5, 20, 3.6, 6.8, "arm")
    s.ellipse(26.5, 20, 3.6, 6.8, "arm")
    s.poly([(9.5, 25), (14.5, 25), (14.5, 31), (9.5, 31)], "arm")
    s.poly([(17.5, 25), (22.5, 25), (22.5, 31), (17.5, 31)], "arm")
    s.ellipse(16, 19.5, 10, 8.6, "basalt")
    sym_poly(s, [(11.5, 7), (8, 1.2), (13.5, 5.5)], "horn")
    s.ellipse(16, 9.6, 6.6, 5.2, "basalt")
    # Lava cracks.
    s.pxs("lava", [(12, 15), (12, 16), (13, 17), (13, 18), (12, 19), (19, 14), (20, 15), (20, 16), (21, 17), (21, 18),
                   (16, 21), (16, 22), (17, 23), (17, 24), (5, 18), (6, 19), (6, 20), (26, 21), (25, 22)])
    s.pxs("core", [(13, 17), (20, 16), (16, 22)])
    # Angry glowing eyes and mouth.
    s.pxs("lava", mirror_pts([(12, 8), (13, 8), (13, 9), (14, 9)]))
    s.pxs("core", mirror_pts([(13, 9)]))
    s.pxs("lava", [(14, 12), (15, 12), (16, 12), (17, 12)])
    return s


def emberwing() -> Sprite:
    """Firebird: three-flame crest, flame wings, beak, happy."""
    s = Sprite(
        "emberwing",
        base_materials(
            fur=Material(FIRE),
            belly=Material(PEACH),
            flame=Material(FLAME),
            wing=Material(["#6e1408", "#b3260f", "#ff5a2c", "#ff9a4a"]),
            beak=Material(GOLD),
        ),
        outline="#1a0606",
    )
    s.poly([(12.6, 8), (13.2, 1.8), (15.2, 6.6)], "flame")
    s.poly([(14.8, 7), (16.4, 0.4), (18.2, 7)], "flame")
    s.poly([(17.8, 7.5), (19.6, 2.4), (20.4, 8.2)], "flame")
    sym_poly(s, [(9.5, 15.5), (3, 12.5), (0.6, 16.5), (4, 18.6), (1.2, 22), (6, 21.8), (3.6, 25.2), (10, 22)], "wing")
    s.ellipse(16, 18.2, 7.2, 9.2, "fur")
    s.ellipse(16, 21.4, 4.2, 5, "belly")
    s.poly([(16, 14.4), (14.3, 16.2), (16, 18.2), (17.7, 16.2)], "beak")
    dot_eyes(s, 12, 12, 18)
    s.pxs("beak", [(13, 28), (13, 29), (12, 30), (14, 30), (19, 28), (19, 29), (18, 30), (20, 30)])
    s.pxs("blush", [(11, 15), (20, 15)])
    return s


def tidecoil() -> Sprite:
    """Sea serpent: thick S-coil with a pale belly, aqua fins, big head."""
    s = Sprite(
        "tidecoil",
        base_materials(
            body=Material(["#0e3f6b", "#1c6fa8", "#2fa8d8", "#86dcf2"]),
            belly=Material(["#3f7fa8", "#7cc0e0", "#c4ecfa", "#ffffff"]),
            fin=Material(AQUA),
        ),
        outline="#061626",
    )
    coil = [(3.5, 27.5), (9, 29.4), (16, 29.6), (22.6, 28.2), (26.2, 24.6), (24.6, 20.8), (19.4, 19.6), (13.4, 19.2), (9.6, 16.8), (9.8, 13.2), (12.6, 10.6)]
    # Fins along the top of the loops, then the coil over their bases.
    s.poly([(11.6, 27), (14.4, 21.2), (17, 27)], "fin")
    s.poly([(20.6, 26.6), (26.6, 19.8), (26, 26.6)], "fin")
    s.poly([(14.6, 20), (18.4, 14.4), (20, 20)], "fin")
    s.poly([(1.2, 25.4), (5, 27.4), (2, 31)], "fin")
    s.stroke(coil, 6.2, "body")
    s.stroke([(x, y + 1.6) for x, y in coil[1:-3]], 1.6, "belly")
    s.poly([(14.6, 3.6), (18.6, 0.4), (19.6, 4.8)], "fin")
    s.ellipse(16, 8.4, 7.2, 5.8, "body")
    s.ellipse(16, 11.4, 4.2, 2.4, "belly")
    dot_eyes(s, 12, 7, 18)
    s.pxs("ink", [(14, 11), (18, 11)])
    s.pxs("ink", [(15, 12), (16, 12), (17, 12)])
    return s


def frostnip() -> Sprite:
    """Icy imp: crystal horns, frosty dome body, shivering mouth, snowflakes."""
    s = Sprite(
        "frostnip",
        base_materials(
            body=Material(["#2a5a9a", "#4a8ad0", "#8cc4f2", "#d8f0ff"]),
            crystal=Material(ICE),
            frost=Material(["#eaf8ff"], flat=True),
            spark=Material(["#eaf8ff"], flat=True, floating=True),
        ),
        outline="#0a1a33",
    )
    sym_poly(s, [(11, 10), (8.6, 2.2), (13.4, 8)], "crystal")
    sym_poly(s, [(8.5, 12.5), (5, 9), (9.5, 11)], "crystal")
    s.ellipse(12, 28.4, 2.2, 2.6, "body")
    s.ellipse(20, 28.4, 2.2, 2.6, "body")
    s.ellipse(6.6, 20.6, 2.2, 1.6, "body")
    s.ellipse(25.4, 20.6, 2.2, 1.6, "body")
    s.ellipse(16, 18, 9.2, 9.2, "body")
    s.ellipse(16, 23.4, 8.4, 3.4, "body")
    s.pxs("frost", [(10, 13), (11, 12), (21, 12), (22, 13), (16, 10)])
    s.ellipse(12.6, 18, 1.8, 2.5, "ink")
    s.ellipse(19.4, 18, 1.8, 2.5, "ink")
    s.pxs("shine", [(12, 17), (19, 17)])
    s.pxs("ink", [(14, 22), (15, 23), (16, 22), (17, 23)])
    s.pxs("blush", [(9, 20), (10, 20), (22, 20), (23, 20)])
    sparkle(s, 3, 6)
    sparkle(s, 28, 9)
    sparkle(s, 27, 26)
    return s


def bublob() -> Sprite:
    """Jelly: round translucent dome, frilled skirt, wavy tendrils, bubbles."""
    s = Sprite(
        "bublob",
        base_materials(
            jelly=Material(["#1a5f8a", "#2f9ad0", "#6fd0ff", "#c8f2ff"]),
            tendril=Material(["#1a5f8a", "#3aa0d8", "#8fdcff", "#d8f6ff"]),
            gloss=Material(["#e8fbff"], flat=True),
            bubble=Material(["#bfefff"], flat=True, floating=True),
        ),
        outline="#082238",
    )
    for path in ([(10, 20), (8.6, 24), (10, 27.6), (9, 30.6)], [(14, 21), (14.6, 25), (13.4, 28.6), (14.2, 31)]):
        s.stroke(path, 1.6, "tendril")
        s.stroke([(SIZE - x, y) for x, y in path], 1.6, "tendril")
    s.ellipse(16, 13.4, 10.6, 9.4, "jelly")
    # Frilled bottom edge.
    for x in range(6, 27, 3):
        s.ellipse(x + 0.5, 21.6, 1.7, 1.5, "jelly")
    s.pxs("gloss", [(8, 11), (8, 10), (9, 9), (10, 8), (11, 7), (12, 7)])
    happy_eyes(s, 11, 14, 18)
    s.pxs("ink", [(14, 16), (15, 17), (16, 17), (17, 16)])
    s.pxs("blush", [(9, 16), (22, 16)])
    s.pxs("bubble", [(26, 4), (25, 5), (27, 5), (26, 6), (29, 9), (4, 25), (3, 26), (5, 26), (4, 27)])
    return s


SPRITES = [pyrup, magmaul, emberwing, tidecoil, frostnip, bublob]
