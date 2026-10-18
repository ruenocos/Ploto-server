"""Render a contact sheet (8x) for any sprite modules: python3 sheet.py out.png batch2 [batch3 ...]"""
import importlib
import sys

from PIL import Image

from pixelkit import SIZE

out_path, mods = sys.argv[1], sys.argv[2:]
sprites = [make() for m in mods for make in importlib.import_module(m).SPRITES]
scale, per_row, pad = 6, 6, 8
cell = SIZE * scale + pad
rows = (len(sprites) + per_row - 1) // per_row
sheet = Image.new("RGBA", (per_row * cell + pad, rows * cell + pad), (21, 25, 39, 255))
for i, s in enumerate(sprites):
    img = s.render().resize((SIZE * scale, SIZE * scale), Image.NEAREST)
    sheet.alpha_composite(img, (pad + (i % per_row) * cell, pad + (i // per_row) * cell))
sheet.save(out_path)
print(" ".join(s.name for s in sprites))
