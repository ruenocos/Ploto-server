"""
Fix which way a picked sprite faces.

  python3 art/pixellab/face.py flip ember_pup 1      # it faces left: mirror it so it faces right
  python3 art/pixellab/face.py right cinder_hound 0  # it already faces right: let the rival's copy turn round
  python3 art/pixellab/face.py front ember_pup 2     # a straight front view: never mirrored

Every three-quarter sprite is stored facing right (your side of the arena); the
game mirrors the rival's copy so both teams face each other.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

SPRITES = Path(__file__).resolve().parent / "sprites"


def main() -> None:
    what, mid, stage = sys.argv[1], sys.argv[2], sys.argv[3]
    path = SPRITES / f"{mid}-{stage}.png"
    if what == "flip":
        Image.open(path).transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(path, optimize=True)
    meta_path = SPRITES / "facing.json"
    meta = json.loads(meta_path.read_text())
    meta.setdefault(mid, {})[stage] = "front" if what == "front" else "right"
    meta_path.write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    print(path.name, what, "->", meta[mid][stage])


if __name__ == "__main__":
    main()
