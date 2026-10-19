"""
Board tiles with PixelLab: options for each gem (and the berry and stone).

  python3 art/pixellab/tiles.py [fire water ...] [--seed 1]

One Pro call per tile at 32x32 returns 64 options; each is saved as
candidates/tiles/<name>-<seed>-f<i>.png with a numbered contact sheet
candidates/tiles-<name>-<seed>.png. The rules come from Match Monsters' own
board: every gem fills about 85% of its tile, the cuts differ only subtly
(octagon, cushion, clipped square, hexagon, blunt diamond), and each has its
own colour and a soft engraved symbol on a big flat top face.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from client import Client
from generate import run_jobs
from style import POOL

HERE = Path(__file__).resolve().parent
CAND = HERE / "candidates"
SIZE = 32

GEM = ("a single cut gemstone for a match-3 puzzle game board, seen straight from the front, filling most of the "
       "canvas, a big flat polished top face with a soft engraved symbol in a lighter tint of the gem's colour, a "
       "narrow bevelled rim, glossy, lit from the top left with one small white shine, clean dark outline, simple "
       "pixel art, nothing else in the picture")

TILES = {
    "fire": f"an octagon-cut ruby red gem with an engraved flame symbol. {GEM}",
    "water": f"a round cushion-cut aquamarine blue gem with an engraved water droplet symbol. {GEM}",
    "earth": f"a square-cut amber orange-brown gem with clipped corners and an engraved mountain symbol. {GEM}",
    "nature": f"a hexagon-cut emerald green gem with an engraved leaf symbol. {GEM}",
    "light": f"a diamond-shaped topaz yellow gem with blunt tips and an engraved star sparkle symbol. {GEM}",
    "berry": ("a pair of shiny red cherries on one stem with a small green leaf, filling most of the canvas, "
              "match-3 puzzle game tile, glossy, lit from the top left, clean dark outline, simple pixel art"),
    "stone": ("a dull grey rough rock with a crack, filling most of the canvas, a blocker tile in a match-3 puzzle "
              "game, matte, lit from the top left, clean dark outline, simple pixel art"),
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", default=list(TILES))
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    jobs = []
    for name in a.names:
        out = CAND / "tiles" / f"{name}-{a.seed}.png"
        if not out.exists():
            jobs.append((out, "create_image_pro", {"description": TILES[name], "width": SIZE, "height": SIZE,
                                                   "no_background": True, "palette": ["#" + h for h in POOL],
                                                   "palette_name": "Endesga 64", "max_colors": 10, "seed": a.seed}))
    client = Client()
    print(f"{len(jobs)} calls", flush=True)
    run_jobs(client, jobs)
    for name in a.names:
        print("sheet", tile_sheet(name, a.seed).relative_to(HERE))
    print(client.balance().splitlines()[1])


def tile_sheet(name: str, seed: int, zoom: int = 4, cols: int = 8) -> Path:
    from PIL import Image, ImageDraw
    files = sorted((CAND / "tiles").glob(f"{name}-{seed}-f*.png"), key=lambda p: int(p.stem.rsplit("-f", 1)[1]))
    cell = SIZE * zoom + 18
    rows = (len(files) + cols - 1) // cols
    img = Image.new("RGBA", (cols * cell + 6, rows * cell + 6), (24, 29, 49, 255))
    d = ImageDraw.Draw(img)
    for i, p in enumerate(files):
        im = Image.open(p).convert("RGBA")
        x, y = 6 + (i % cols) * cell, 6 + (i // cols) * cell
        img.alpha_composite(im.resize((im.width * zoom, im.height * zoom), Image.NEAREST), (x, y + 12))
        d.text((x, y), str(i + 1), fill=(255, 244, 214, 255))
    out = CAND / f"tiles-{name}-{seed}.png"
    img.save(out)
    return out


if __name__ == "__main__":
    main()
