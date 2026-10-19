"""
Concept options for one stage of a line, with PixelLab's Pro model.

  python3 art/pixellab/concept.py ember_pup cinder_hound --stage 2 [--seed 1]

One Pro call per monster returns a grid of options (25 at 48 px), drawn for
the colour pool. Every option is saved as candidates/<id>/c<stage>-<seed>-<i>.png
and a numbered contact sheet candidates/<id>-c<stage>-<seed>.png goes up for
review. The adult (stage 2) is designed first; pick.py turns the chosen option
into a sprite. Then the line is worked backwards with --from-next: the picked
older stage goes in as a labelled reference and its own colours become the
palette, so the younger stage is the same creature in the same colours.
"""
from __future__ import annotations

import argparse
import base64
import io
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
    ap.add_argument("--colors", help="try another colour scheme than the roster's")
    ap.add_argument("--extra", default="", help="appended to the stage description")
    ap.add_argument("--from-next", action="store_true", help="draw from the picked next (older) stage")
    ap.add_argument("--palette-only", action="store_true", help="with --from-next: take only its colours, not the reference")
    ap.add_argument("--redraw", action="store_true", help="redraw the picked sprite of this stage (same design and colours), e.g. in another view")
    a = ap.parse_args()

    def mon(mid: str) -> dict:
        m = dict(ROSTER[mid])
        if a.colors:
            m["colors"] = a.colors
        if a.extra:
            m["stages"] = tuple(s + (", " + a.extra if i == a.stage else "") for i, s in enumerate(m["stages"]))
        return m

    def args(mid: str) -> dict:
        out = pro_concept_args(mon(mid), a.stage, a.seed)
        if a.redraw:
            same = Image.open(HERE / "sprites" / f"{mid}-{a.stage}.png").convert("RGBA")
            buf = io.BytesIO()
            same.crop(same.getchannel("A").getbbox()).save(buf, format="PNG")
            out["reference_images"] = [{"base64": base64.b64encode(buf.getvalue()).decode(),
                                        "usage": "this exact creature: keep its design, colours, markings and features, "
                                                 "only change the pose and view as described"}]
            out["palette"] = ["#%02x%02x%02x" % c[:3] for c in sorted({c for c in same.get_flattened_data() if c[3]})]
        if a.from_next:
            older = Image.open(HERE / "sprites" / f"{mid}-{a.stage + 1}.png").convert("RGBA")
            buf = io.BytesIO()
            older.crop(older.getchannel("A").getbbox()).save(buf, format="PNG")
            if not a.palette_only:
                out["reference_images"] = [{"base64": base64.b64encode(buf.getvalue()).decode(),
                                            "usage": "this creature's next, older evolution: draw its younger stage as the same "
                                                     "species with the same colours, face, markings and signature feature, "
                                                     "smaller and less developed"}]
            out["palette"] = ["#%02x%02x%02x" % c[:3] for c in sorted({c for c in older.get_flattened_data() if c[3]})]
        return out

    jobs = [(CAND / mid / f"c{a.stage}-{a.seed}.png", "create_image_pro", args(mid))
            for mid in a.ids if not (CAND / mid / f"c{a.stage}-{a.seed}.png").exists()]
    client = Client()
    print(f"{len(jobs)} calls", flush=True)
    run_jobs(client, jobs)
    for mid in a.ids:
        print("sheet", contact(mid, a.stage, a.seed).relative_to(HERE))
    print(client.balance().splitlines()[1])


if __name__ == "__main__":
    main()
