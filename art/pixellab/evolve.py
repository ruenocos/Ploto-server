"""
Draw a line's next stage from its picked previous stage.

  python3 art/pixellab/evolve.py ember_pup 1 [--seeds 3]

Takes sprites/<id>-<stage-1>.png, scales it up (nearest) to fill the new
stage's canvas as the img2img start, and asks PixFlux for the stage's prompt
drawn with only the previous stage's colours plus the line's accents. Each
strength in style.EVOLVE_STRENGTH x each seed is one candidate (1 generation
each): candidates/<id>/e<stage>-<strength>-<seed>.png, plus a review sheet
candidates/<id>-e<stage>.png with the previous stage on the left.
"""
from __future__ import annotations

import argparse
import base64
import io
from pathlib import Path

from PIL import Image

from client import Client
from generate import run_jobs
from pick import _rgb
from roster import ROSTER
from style import EVOLVE_STRENGTH, STAGE_SIZE, pixflux_evolve_args

HERE = Path(__file__).resolve().parent
CAND = HERE / "candidates"
SPRITES = HERE / "sprites"


def enc(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def init_from(prev: Image.Image, size: int, fill: float = 0.95) -> Image.Image:
    im = prev.crop(prev.getchannel("A").getbbox())
    k = fill * size / max(im.size)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
    out = Image.new("RGBA", (size, size))
    out.alpha_composite(im, ((size - im.width) // 2, size - im.height))
    return out


def colors_of(prev: Image.Image, accents: list[str]) -> Image.Image:
    """A swatch strip of the previous stage's colours plus the accents: PixFlux draws with only these."""
    cols = sorted({c[:3] for c in prev.get_flattened_data() if c[3]}) + [_rgb(h) for h in accents]
    out = Image.new("RGB", (len(cols), 1))
    out.putdata(cols)
    return out


def sheet(mid: str, stage: int, keys: list[str], zoom: int = 4) -> Path:
    cell = 64 * zoom + 8
    paths = [SPRITES / f"{mid}-{stage - 1}.png"] + [CAND / mid / f"e{stage}-{k}.png" for k in keys]
    img = Image.new("RGBA", (cell * len(paths) + 8, cell + 8), (35, 42, 70, 255))
    for i, p in enumerate(paths):
        if p.exists():
            im = Image.open(p).convert("RGBA")
            im = im.crop(im.getchannel("A").getbbox())
            img.alpha_composite(im.resize((im.width * zoom, im.height * zoom), Image.NEAREST),
                                (8 + i * cell + (64 - im.width) * zoom // 2, 8 + (64 - im.height) * zoom))
    out = CAND / f"{mid}-e{stage}.png"
    img.save(out)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--stage", type=int, required=True)
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--first-seed", type=int, default=0)
    ap.add_argument("--strength", type=int, action="append", help="override style.EVOLVE_STRENGTH")
    a = ap.parse_args()
    jobs, keys = [], {}
    for mid in a.ids:
        mon = ROSTER[mid]
        prev = Image.open(SPRITES / f"{mid}-{a.stage - 1}.png").convert("RGBA")
        init, colors = enc(init_from(prev, STAGE_SIZE[a.stage])), enc(colors_of(prev, mon["accents"]))
        keys[mid] = []
        for strength in a.strength or EVOLVE_STRENGTH[a.stage - 1]:
            for seed in range(a.first_seed, a.first_seed + a.seeds):
                k = f"{strength}-{seed}"
                keys[mid].append(k)
                out = CAND / mid / f"e{a.stage}-{k}.png"
                if not out.exists():
                    jobs.append((out, "create_image_pixflux", pixflux_evolve_args(mon, a.stage, init, colors, strength, 500 + seed)))
    print(f"{len(jobs)} jobs", flush=True)
    run_jobs(Client(), jobs)
    for mid in a.ids:
        print("sheet", sheet(mid, a.stage, keys[mid]).relative_to(HERE))


if __name__ == "__main__":
    main()
