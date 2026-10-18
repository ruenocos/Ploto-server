"""Review sheet for rigs: per monster, its three stages in colour, then as black
silhouettes. If two stages' silhouettes only differ in size, the evolution
isn't different enough (see EVOLUTION.md).

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
width = pad + 6 * cell + pad * 2
sheet = Image.new("RGBA", (width, pad + len(makers) * cell), (21, 25, 39, 255))
for i, make in enumerate(makers):
    y = pad + i * cell
    for stage in range(3):
        img = make(stage).flatten().resize((CANVAS * scale, CANVAS * scale), Image.NEAREST)
        sheet.alpha_composite(img, (pad + stage * cell, y))
        alpha = img.getchannel("A").point(lambda a: 255 if a else 0)
        sil = Image.new("RGBA", img.size, (236, 238, 245, 255))
        sil.paste((0, 0, 0, 255), mask=alpha)
        sheet.alpha_composite(sil, (pad * 3 + (3 + stage) * cell, y))
sheet.save(out_path)
print(", ".join(m.__name__ for m in makers))
