"""Contact sheet for rigs: each monster's three stages side by side (6x).

python3 rigsheet.py out.png rigs_fire [rigs_water ...]
"""
import importlib
import sys

from PIL import Image

from rigkit import CANVAS

out_path, mods = sys.argv[1], sys.argv[2:]
makers = [m for mod in mods for m in importlib.import_module(mod).RIGS]
scale, pad = 4, 6
cell = CANVAS * scale + pad
per_row = 2  # monsters per row (each takes 3 cells)
rows = (len(makers) + per_row - 1) // per_row
sheet = Image.new("RGBA", (pad + per_row * (3 * cell + pad * 3), pad + rows * cell), (21, 25, 39, 255))
for i, make in enumerate(makers):
    for stage in range(3):
        img = make(stage).flatten().resize((CANVAS * scale, CANVAS * scale), Image.NEAREST)
        x = pad + (i % per_row) * (3 * cell + pad * 3) + stage * cell
        sheet.alpha_composite(img, (x, pad + (i // per_row) * cell))
sheet.save(out_path)
print(", ".join(m.__name__ for m in makers))
