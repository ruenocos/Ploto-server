"""
Check lines before approving them: facing on both sides of the arena, and growth.

  python3 art/pixellab/check.py ember_pup cinder_hound ... [--out sheet.png]

Prints each stage's visible height and flags a line whose stages don't grow
enough (baby ~26, teen ~33, adult ~40 px tall: at least GROW px each step).
The sheet shows every stage as drawn on your side (should face right) and as
the game shows it on the rival's side: always mirrored (`.side.foe .rig`), so it
faces left.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SPRITES = HERE / "sprites"
GROW = 5


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--out", default=str(HERE / "candidates" / "check.png"))
    a = ap.parse_args()
    face = json.loads((SPRITES / "facing.json").read_text())
    Z, C = 3, 48 * 3 + 8
    sheet = Image.new("RGBA", (6 * C + 40, len(a.ids) * C + 30), (35, 42, 70, 255))
    d = ImageDraw.Draw(sheet)
    d.text((10, 8), "YOUR SIDE  ->", fill=(255, 244, 214, 255))
    d.text((3 * C + 40, 8), "<-  RIVAL SIDE", fill=(255, 244, 214, 255))
    for r, mid in enumerate(a.ids):
        heights = []
        for st in range(3):
            im = Image.open(SPRITES / f"{mid}-{st}.png").convert("RGBA")
            x0, y0, x1, y1 = im.getchannel("A").getbbox()
            heights.append(y1 - y0)
            y = 26 + r * C
            sheet.alpha_composite(im.resize((48 * Z, 48 * Z), Image.NEAREST), (10 + st * C, y))
            rival = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)  # the game mirrors every rival monster
            sheet.alpha_composite(rival.resize((48 * Z, 48 * Z), Image.NEAREST), (3 * C + 40 + st * C, y))
        ok = heights[1] - heights[0] >= GROW and heights[2] - heights[1] >= GROW
        print(f"{mid:16} heights {heights}  {'ok' if ok else 'GROWTH TOO SMALL'}  facing {[face[mid][str(s)] for s in range(3)]}")
    sheet.save(a.out)
    print("sheet", a.out)


if __name__ == "__main__":
    main()
