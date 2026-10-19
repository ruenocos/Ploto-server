"""
The house style for PixelLab art: one prompt template, one colour pool, fixed
canvas sizes, one eye style. Every generated sprite goes through here, so the
roster stays one family. The rules and their sources are in README.md.
"""
from __future__ import annotations

# Every stage is drawn natively on its own canvas (never rescaled), then placed
# bottom-centre on a 64x64 one: the baby really is smaller, every stage has the
# same pixel size.
STAGE_SIZE = (44, 52, 64)
CANVAS = 64
# Colours per sprite after cleaning: the detail per pixel stays about level as the canvas grows.
MAX_COLORS = (12, 14, 16)

# The roster's shared colour pool: 48 colours picked from Endesga 64 (hue-shifted
# ramps, a near-black outline). Every sprite is snapped onto it, and stages 2-3
# are drawn with only their line's colours from it.
POOL = [
    "131313", "272727", "3d3d3d",                                  # outline and darks
    "5d5d5d", "858585", "b4b4b4", "ffffff",                        # greys
    "1a1932", "2a2f4e", "424c6e", "657392", "92a1b9", "c7cfdd",    # slate
    "391f21", "5d2c28", "8a4836", "bf6f4a", "e69c69", "f6ca9f", "f9e6cf",  # brown to cream
    "8e251d", "c64524", "e07438", "ffa214", "ffc825", "ffeb57",    # fire
    "891e2b", "c42430", "ea323c", "f68187",                        # red
    "134c4c", "1e6f50", "33984b", "5ac54f", "99e65f", "d3fc7e",    # green
    "0c2e44", "00396d", "0069aa", "0098dc", "00cdf9", "94fdff",    # blue
    "3b1443", "622461", "93388f", "ca52c9", "fdd2ed",              # purple
    "edab50",                                                      # gold
]
PALETTE = POOL

# Proportions and expression per stage. The eyes are built the same way at every
# stage and across the roster (EYES); only the expression changes.
STAGE_NOTE = (
    "a baby: big head about as big as its body, round soft shapes, a happy expression, sitting or low to the ground",
    "an adolescent: smaller head, longer legs, a first few pointed shapes, a confident expression",
    "the fully evolved adult: a strong wide stance, angular shapes, a determined expression, clearly the most powerful",
)
EYES = "black oval eyes with one white shine pixel"
STYLE = (
    "monster for a creature-collecting RPG, full body, front view facing the viewer, "
    "clean dark outline, simple cel shading lit from the top left, bold readable silhouette, "
    "16-bit SNES era pixel art, nothing else in the picture"
)


def prompt(mon: dict, stage: int) -> str:
    """One stage's prompt: the line's name, colours and signature (same words every stage), the stage, the house style."""
    return (f"{mon['name']}: {mon['stages'][stage]}. Colours: {mon['colors']}. "
            f"Signature: {mon['signature']}. Eyes: {EYES}. {STAGE_NOTE[stage]}. {STYLE}")


# Babies: Pixen, 1 generation per image, the cleanest small sprites PixelLab has.
def pixen_args(mon: dict, stage: int, seed: int) -> dict:
    size = STAGE_SIZE[stage]
    return {"description": prompt(mon, stage), "width": size, "height": size, "no_background": True,
            "outline": "single color black outline", "detail": "medium detail", "direction": "south", "seed": seed}


# Stages 2 and 3: PixFlux img2img from the previous stage, scaled up to fill the
# new canvas, drawn with only the previous stage's colours (plus the line's
# accents). The init keeps the front view and the face; the strength sets how
# far it grows (lower = bigger change).
EVOLVE_STRENGTH = ((55, 75), (40, 60))  # tried per stage: from the baby, from stage 2


def pixflux_evolve_args(mon: dict, stage: int, init_b64: str, colors_b64: str, strength: int, seed: int) -> dict:
    size = STAGE_SIZE[stage]
    return {"description": prompt(mon, stage), "width": size, "height": size, "no_background": True,
            "direction": "south", "outline": "single color black outline", "detail": "medium detail",
            "init_image_base64": init_b64, "init_image_strength": strength,
            "color_image_base64": colors_b64, "seed": seed}


# Idle loops: a gentle, seamless breath. Frames are drawn by PixelLab from the still.
IDLE_ACTION = "idle breathing in place, subtle loop, the body rises and falls slightly, {extra}"
IDLE_FRAMES = 6
