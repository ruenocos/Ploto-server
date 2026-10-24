"""
Face-card portraits for Hold'em: one jack, queen and king, with PixelLab's Pro model.

  python3 art/pixellab/cards.py concept [--seed 1]        # a grid of options per rank -> candidates/cards/<rank>-<seed>.png
  python3 art/pixellab/cards.py pick jack candidates/cards/jack-1-f12.png
  python3 art/pixellab/cards.py build                      # cards/*.png -> web/cards.js

One portrait per rank, used for all four suits: drawn with the classic card
colours (red robe, gold, cream), and the client swaps the red ramp for a navy one
on clubs and spades, like a real deck's red and black courts.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
CAND = HERE / "candidates" / "cards"
PICKS = HERE / "cards"
WEB = HERE.parent.parent / "web" / "cards.js"

SIZE = 32  # a Pro call at 32 px returns a grid of 64 options

# The court colours. RED is the robe ramp the client swaps for NAVY on black suits.
RED = ["891e2b", "c42430", "ea323c"]
NAVY = ["1a1932", "2a2f4e", "424c6e"]
PALETTE = ["131313", "3d3d3d", "ffffff", "c7cfdd", "858585", "b4b4b4",   # outline, whites, greys (beard)
           "f9e6cf", "f6ca9f", "e69c69", "bf6f4a",                       # skin
           "391f21", "5d2c28", "8a4836",                                  # hair
           "edab50", "ffc825", "ffa214",                                  # gold
           *RED]

STYLE = ("pixel art bust portrait for a playing card face, front view, head and shoulders filling the frame, "
         "symmetrical, bold dark outline, flat cel shading lit from the top left, big simple shapes, few colours, "
         "a red robe with gold trim, cute retro handheld game style, nothing else in the picture")
RANKS = {
    "jack": "the Jack: a young knave with a friendly grin, short brown hair under a red cap with a gold feather",
    "queen": "the Queen: a kind queen with long brown hair, a small gold crown, holding a little flower",
    "king": "the King: a wise old king with a full white beard and moustache, a big gold crown with points",
}


def concept(seed: int) -> None:
    from client import Client
    from generate import run_jobs
    jobs = []
    for rank, desc in RANKS.items():
        out = CAND / f"{rank}-{seed}.png"
        if out.exists():
            continue
        jobs.append((out, "create_image_pro", {
            "description": f"{desc}. {STYLE}", "width": SIZE, "height": SIZE, "no_background": True,
            "palette": ["#" + h for h in PALETTE], "palette_name": "Ploto court", "max_colors": 14, "seed": seed}))
    client = Client()
    run_jobs(client, jobs)
    for rank in RANKS:
        print("sheet", contact(rank, seed).relative_to(HERE))
    print(client.balance().splitlines()[1])


def contact(rank: str, seed: int, zoom: int = 4, cols: int = 8) -> Path:
    files = sorted(CAND.glob(f"{rank}-{seed}-f*.png"), key=lambda p: int(p.stem.rsplit("-f", 1)[1]))
    cell = SIZE * zoom + 18
    rows = max(1, (len(files) + cols - 1) // cols)
    img = Image.new("RGBA", (cols * cell + 6, rows * cell + 6), (255, 244, 214, 255))  # the card's cream
    d = ImageDraw.Draw(img)
    for i, p in enumerate(files):
        im = Image.open(p).convert("RGBA")
        x, y = 6 + (i % cols) * cell, 6 + (i // cols) * cell
        img.alpha_composite(im.resize((im.width * zoom, im.height * zoom), Image.NEAREST), (x, y + 12))
        d.text((x, y), str(i), fill=(20, 26, 44, 255))
    out = CAND / f"{rank}-{seed}-sheet.png"
    img.save(out)
    return out


def pick(rank: str, src: str) -> None:
    """Snap a chosen option onto the palette with hard alpha, cropped to its content."""
    im = Image.open(src).convert("RGBA")
    pal = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in PALETTE]
    out = Image.new("RGBA", im.size)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            if a < 128:
                continue
            c = min(pal, key=lambda p: (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2)
            out.putpixel((x, y), (*c, 255))
    PICKS.mkdir(exist_ok=True)
    out.crop(out.getchannel("A").getbbox()).save(PICKS / f"{rank}.png")
    print("picked", rank, "->", (PICKS / f"{rank}.png").relative_to(HERE))


def build() -> None:
    """web/cards.js: each portrait as data URLs, red (hearts, diamonds) and navy (clubs, spades)."""
    hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    swap = {hx(r): hx(n) for r, n in zip(RED, NAVY)}
    url = lambda im: (buf := io.BytesIO(), im.save(buf, format="PNG", optimize=True),
                      "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode())[2]
    art = {}
    for rank in RANKS:
        red = Image.open(PICKS / f"{rank}.png").convert("RGBA")
        navy = red.copy()
        px = navy.load()
        for y in range(navy.height):
            for x in range(navy.width):
                if px[x, y][3] and px[x, y][:3] in swap:
                    px[x, y] = (*swap[px[x, y][:3]], 255)
        art[rank] = {"red": url(red), "black": url(navy), "w": red.width, "h": red.height}
    WEB.write_text("/* Generated by art/pixellab/cards.py build: Hold'em's face-card portraits (PixelLab). */\n"
                   f"window.PLOTO_CARDS = {json.dumps(art)};\n")
    print("wrote", WEB)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("concept"); c.add_argument("--seed", type=int, default=1)
    p = sub.add_parser("pick"); p.add_argument("rank", choices=list(RANKS)); p.add_argument("src")
    sub.add_parser("build")
    a = ap.parse_args()
    if a.cmd == "concept":
        concept(a.seed)
    elif a.cmd == "pick":
        pick(a.rank, a.src)
    else:
        build()


if __name__ == "__main__":
    main()
