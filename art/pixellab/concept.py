"""
Concept options for one stage of a line, with PixelLab's Pro model.

  python3 art/pixellab/concept.py ember_pup cinder_hound --stage 2 [--seed 1]

One Pro call per monster returns a grid of options (25 at 48 px), drawn for
the colour pool. Every option is saved as candidates/<id>/c<stage>-<seed>-<i>.png
and a numbered contact sheet candidates/<id>-c<stage>-<seed>.png goes up for
review. The adult (stage 2) is designed first; pick.py then turns the chosen
option into a sprite, and evolve.py works the line backwards from it.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

from client import Client
from generate import run_jobs
from roster import ROSTER
from style import pro_concept_args

HERE = Path(__file__).resolve().parent
CAND = HERE / "candidates"


def contact(mid: str, stage: int, seed: int, zoom: int = 3, cols: int = 5) -> Path:
    files = sorted((CAND / mid).glob(f"c{stage}-{seed}-f*.png"), key=lambda p: int(p.stem.rsplit("-f", 1)[1]))
    cell = 48 * zoom + 18
    rows = (len(files) + cols - 1) // cols
    img = Image.new("RGBA", (cols * cell + 6, rows * cell + 6), (35, 42, 70, 255))
    d = ImageDraw.Draw(img)
    for i, p in enumerate(files):
        im = Image.open(p).convert("RGBA")
        x, y = 6 + (i % cols) * cell, 6 + (i // cols) * cell
        img.alpha_composite(im.resize((im.width * zoom, im.height * zoom), Image.NEAREST), (x, y + 12))
        d.text((x, y), str(i + 1), fill=(255, 244, 214, 255))
    out = CAND / f"{mid}-c{stage}-{seed}.png"
    img.save(out)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--stage", type=int, default=2)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    jobs = [(CAND / mid / f"c{a.stage}-{a.seed}.png", "create_image_pro", pro_concept_args(ROSTER[mid], a.stage, a.seed))
            for mid in a.ids if not (CAND / mid / f"c{a.stage}-{a.seed}.png").exists()]
    client = Client()
    print(f"{len(jobs)} calls", flush=True)
    run_jobs(client, jobs)
    for mid in a.ids:
        print("sheet", contact(mid, a.stage, a.seed).relative_to(HERE))
    print(client.balance().splitlines()[1])


if __name__ == "__main__":
    main()
