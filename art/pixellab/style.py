"""
The house style for PixelLab art: one prompt template, one palette, fixed
canvas sizes. Every generated sprite goes through here, so the roster stays
one family. See README.md for the why.
"""
from __future__ import annotations

# Every monster stage is drawn on its own canvas, then placed bottom-centre on
# a 64x64 one. The baby really is smaller (44 of 64 rows), which keeps the
# growth the evolution brief asks for, and every stage has the same pixel size.
STAGE_SIZE = (44, 52, 64)
CANVAS = 64

PALETTES = {
    "resurrect-64": ["2e222f", "3e3546", "625565", "966c6c", "ab947a", "694f62", "7f708a", "9babb2", "c7dcd0", "ffffff", "6e2727", "b33831", "ea4f36", "f57d4a", "ae2334", "e83b3b", "fb6b1d", "f79617", "f9c22b", "7a3045", "9e4539", "cd683d", "e6904e", "fbb954", "4c3e24", "676633", "a2a947", "d5e04b", "fbff86", "165a4c", "239063", "1ebc73", "91db69", "cddf6c", "313638", "374e4a", "547e64", "92a984", "b2ba90", "0b5e65", "0b8a8f", "0eaf9b", "30e1b9", "8ff8e2", "323353", "484a77", "4d65b4", "4d9be6", "8fd3ff", "45293f", "6b3e75", "905ea9", "a884f3", "eaaded", "753c54", "a24b6f", "cf657f", "ed8099", "831c5d", "c32454", "f04f78", "f68181", "fca790", "fdcbb0"],
    "apollo": ["172038", "253a5e", "3c5e8b", "4f8fba", "73bed3", "a4dddb", "19332d", "25562e", "468232", "75a743", "a8ca58", "d0da91", "4d2b32", "7a4841", "ad7757", "c09473", "d7b594", "e7d5b3", "341c27", "602c2c", "884b2b", "be772b", "de9e41", "e8c170", "241527", "411d31", "752438", "a53030", "cf573c", "da863e", "1e1d39", "402751", "7a367b", "a23e8c", "c65197", "df84a5", "090a14", "10141f", "151d28", "202e37", "394a50", "577277", "819796", "a8b5b2", "c7cfcc", "ebede9"],
    "endesga-64": ["ff0040", "131313", "1b1b1b", "272727", "3d3d3d", "5d5d5d", "858585", "b4b4b4", "ffffff", "c7cfdd", "92a1b9", "657392", "424c6e", "2a2f4e", "1a1932", "0e071b", "1c121c", "391f21", "5d2c28", "8a4836", "bf6f4a", "e69c69", "f6ca9f", "f9e6cf", "edab50", "e07438", "c64524", "8e251d", "ff5000", "ed7614", "ffa214", "ffc825", "ffeb57", "d3fc7e", "99e65f", "5ac54f", "33984b", "1e6f50", "134c4c", "0c2e44", "00396d", "0069aa", "0098dc", "00cdf9", "0cf1ff", "94fdff", "fdd2ed", "f389f5", "db3ffd", "7a09fa", "3003d9", "0c0293", "03193f", "3b1443", "622461", "93388f", "ca52c9", "c85086", "f68187", "f5555d", "ea323c", "c42430", "891e2b", "571c27"],
}
PALETTE = PALETTES["endesga-64"]

STAGE_NOTE = (
    "a baby: big head, round soft shapes, big round shiny eyes, sitting or low to the ground",
    "an adolescent: taller, longer limbs, a first few sharp accents, bright eyes",
    "the fully evolved adult: a powerful stance, angular sharp shapes, fierce eyes",
)

STYLE = (
    "monster for a creature-collecting RPG, full body, front view facing the viewer, "
    "clean dark outline, cel shading lit from the top left, bold readable silhouette, "
    "saturated colours, 16-bit SNES era pixel art, nothing else in the picture"
)


def prompt(mon: dict, stage: int) -> str:
    """The full prompt for one stage: what it looks like, the line's colours, the stage's proportions, the house style."""
    grown = f"An evolution of the reference creature ({mon['story']}), keeping its colours, face and markings. " if stage else ""
    return f"{grown}{mon['name']}: {mon['stages'][stage]}. Colours: {mon['colors']}. {STAGE_NOTE[stage]}. {STYLE}"


# Pixen: 1 generation per image, the cleanest small sprites PixelLab has.
def pixen_args(mon: dict, stage: int, seed: int) -> dict:
    size = STAGE_SIZE[stage]
    return {"description": prompt(mon, stage), "width": size, "height": size, "no_background": True,
            "outline": "single color black outline", "detail": "medium detail", "direction": "south", "seed": seed}


# Pro: 10-25 generations per call for a grid of options (25 at 42-50 px, 16 at 51-64),
# and it takes the previous stage as a labelled reference, which keeps a line one creature.
def pro_args(mon: dict, stage: int, prev_png_b64: str | None, seed: int) -> dict:
    size = STAGE_SIZE[stage]
    args = {"description": prompt(mon, stage), "width": size, "height": size, "no_background": True, "seed": seed}
    if prev_png_b64:
        args["reference_images"] = [{"base64": prev_png_b64, "usage": "the same creature at its previous, younger "
                                     "stage: keep its species, colours, face and markings"}]
    return args


# Idle loops: a gentle, seamless breath. Frames are drawn by PixelLab from the still.
IDLE_ACTION = "idle breathing in place, subtle loop, the body rises and falls slightly, {extra}"
IDLE_FRAMES = 6
