"""
Generate candidate sprites for review.

  python3 art/pixellab/generate.py ember_pup cinder_hound --seeds 4 [--stages 0,1,2]

Writes candidates/<id>/s<stage>-<seed>.png (not committed) and a review sheet
candidates/<id>.png: one row per stage, one column per seed. Candidates that
already exist are skipped, so a rerun only fills the gaps. Pick winners with
pick.py.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from PIL import Image

from client import Busy, Client
from roster import ROSTER
from style import pixen_args

HERE = Path(__file__).resolve().parent
CAND = HERE / "candidates"


def run_jobs(client: Client, jobs: list[tuple[Path, str, dict]], poll: float = 6) -> None:
    """Submit (out_path, tool, args) jobs as fast as the plan allows; save each result's first image."""
    pending: dict[str, tuple[Path, str, dict]] = {}
    queue = list(jobs)
    while queue or pending:
        while queue:
            try:
                pending[client.submit(*queue[0][1:])] = queue[0]
                queue.pop(0)
            except Busy:
                break
        time.sleep(poll)
        for jid, job in list(pending.items()):
            out = job[0]
            try:
                imgs = client.fetch(jid)
            except RuntimeError as e:
                del pending[jid]
                if "QueuePool" in str(e):  # PixelLab was overloaded, not our request: try it again
                    queue.append(job)
                else:
                    print("failed", out.name, e, file=sys.stderr)
                continue
            if imgs is None:
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(imgs[0])
            if len(imgs) > 1:
                for i, b in enumerate(imgs):
                    out.with_name(f"{out.stem}-f{i}.png").write_bytes(b)
            print("done", out.relative_to(HERE), flush=True)
            del pending[jid]


def sheet(mid: str, seeds: int, zoom: int = 4) -> Path:
    cell = 64 * zoom + 8
    img = Image.new("RGBA", (cell * seeds + 8, cell * 3 + 8), (35, 42, 70, 255))
    for st in range(3):
        for s in range(seeds):
            p = CAND / mid / f"s{st}-{s}.png"
            if not p.exists():
                continue
            im = Image.open(p).convert("RGBA")
            x = 8 + s * cell + (64 - im.width) * zoom // 2
            y = 8 + st * cell + (64 - im.height) * zoom
            img.alpha_composite(im.resize((im.width * zoom, im.height * zoom), Image.NEAREST), (x, y))
    out = CAND / f"{mid}.png"
    img.save(out)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--seeds", type=int, default=4)
    ap.add_argument("--first-seed", type=int, default=0)
    ap.add_argument("--stages", default="0,1,2")
    a = ap.parse_args()
    stages = [int(s) for s in a.stages.split(",")]
    jobs = []
    for mid in a.ids:
        for st in stages:
            for s in range(a.first_seed, a.first_seed + a.seeds):
                out = CAND / mid / f"s{st}-{s}.png"
                if not out.exists():
                    jobs.append((out, "create_image_pixen", pixen_args(ROSTER[mid], st, 1000 + s)))
    client = Client()
    print(f"{len(jobs)} jobs", flush=True)
    run_jobs(client, jobs)
    for mid in a.ids:
        print("sheet", sheet(mid, a.first_seed + a.seeds).relative_to(HERE))


if __name__ == "__main__":
    main()
