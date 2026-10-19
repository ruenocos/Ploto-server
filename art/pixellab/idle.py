"""
Idle loops for picked sprites.

  python3 art/pixellab/idle.py ember_pup [--stages 0,1,2] [--variant 0]

PixelLab animates each sprites/<id>-<stage>.png with the last frame pinned to
the first, so the loop closes. The frames are cleaned like the stills (same
palette, hard alpha) and written next to the sprite as one strip,
sprites/<id>-<stage>-idle.png (n x 64 wide), after review in candidates/.
`--keep` copies a reviewed candidate strip into sprites/.
"""
from __future__ import annotations

import argparse
import base64
import io
import shutil
from pathlib import Path

from PIL import Image

from client import Client
from generate import run_jobs
from pick import clean
from roster import ROSTER
from style import CANVAS, IDLE_ACTION, IDLE_CALM, IDLE_FRAMES

HERE = Path(__file__).resolve().parent
SPRITES = HERE / "sprites"
CAND = HERE / "candidates"


def b64(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def strip(frames: list[Image.Image]) -> Image.Image:
    out = Image.new("RGBA", (CANVAS * len(frames), CANVAS))
    for i, f in enumerate(frames):
        out.alpha_composite(clean(f.convert("RGBA")), (i * CANVAS, 0))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--stages", default="0,1,2")
    ap.add_argument("--variant", type=int, default=0)
    ap.add_argument("--keep", action="store_true", help="copy the reviewed variant into sprites/")
    ap.add_argument("--calm", action="store_true", help="the stricter stand-still prompt (no walking, running or smoke)")
    ap.add_argument("--only", help="just these stages: id:stage,id:stage (the ids and --stages are then ignored)")
    a = ap.parse_args()
    stages = [int(s) for s in a.stages.split(",")]
    pairs = [(p.split(":")[0], int(p.split(":")[1])) for p in a.only.split(",")] if a.only else [(m, st) for m in a.ids for st in stages]
    if a.keep:
        for mid in a.ids:
            for st in stages:
                src = CAND / mid / f"idle-s{st}-v{a.variant}.png"
                shutil.copy(src, SPRITES / f"{mid}-{st}-idle.png")
                print("kept", src.name, "->", f"{mid}-{st}-idle.png")
        return
    jobs = []
    for mid, st in pairs:
        out = CAND / mid / f"idle-s{st}-v{a.variant}-raw.png"
        if out.exists():
            continue
        still = Image.open(SPRITES / f"{mid}-{st}.png")
        jobs.append((out, "animate_image", {
            "action": IDLE_CALM if a.calm else IDLE_ACTION.format(extra=ROSTER[mid]["idle"]), "frame_count": IDLE_FRAMES,
            "first_frame_base64": b64(still), "last_frame_base64": b64(still),
            "no_background": True, "seed": 2000 + a.variant}))
    run_jobs(Client(), jobs)
    # run_jobs saved every frame as <raw stem>-f<i>.png; frame 0 is the input itself.
    for mid, st in pairs:
        raw = CAND / mid / f"idle-s{st}-v{a.variant}-raw.png"
        frames = sorted(raw.parent.glob(f"{raw.stem}-f*.png"), key=lambda p: int(p.stem.rsplit("-f", 1)[1]))
        if not frames:
            continue
        # the pinned last frame repeats frame 0: drop it so the loop doesn't hold a beat
        imgs = [Image.open(p) for p in frames]
        if len(imgs) > 2 and list(imgs[-1].getdata()) == list(imgs[0].getdata()):
            imgs = imgs[:-1]
        out = CAND / mid / f"idle-s{st}-v{a.variant}.png"
        strip(imgs).save(out)
        print("strip", out.relative_to(HERE), len(imgs), "frames")


if __name__ == "__main__":
    main()
