"""
Build every pixel asset and the game's art module.

  python3 art/pixel/build.py

Writes PNGs to art/pixel/out/ and web/pixelart.js, which the client loads:

  window.PIXELART = {
    monsters: { <id>: { icon, stages: [ { flat, core:[x,y], parts: [ {n, role, parent, z, pivot:[x,y], at:[x,y], size:[w,h], src} ] } x3 ] } },
      // or, for a monster drawn with PixelLab (art/pixellab/sprites): one 48x48 image per stage, no parts
      <id>: { res: 48, icon, stages: [ { flat, idle?, n?, face, core:[x,y] } x3 ] },  // idle: an n x 48 frame strip; face: front|right
    gems: { fire, water, earth, nature, light, berry, stone },
    arena, platform,  // the day meadow (kept for older clients)
    themes: { day|dusk|night: { arena, platform, cloudsFar, cloudsNear } },  // 160x100 backdrop, 40x14 platform, 160x40 cloud strips
    fx: { fire, water, earth, nature, light, heal, shield, ice, poison },  // 6-frame 32x32 impact sheets (fx.py)
    status: { burn, poison, regen },  // 4-frame 12x12 loops on monsters with that status
    statusStill: { bubble, shield },  // the bubble shell (48x48) and the shield wall (12x40)
  }

Monster stages are 48x48 canvases; `parts` are cropped layers placed `at` an
offset, with a pivot for animation (canvas pixels). `icon` is the 32x32 base form.
A monster with all three stages in art/pixellab/sprites/ uses those instead of
its rig (same 48x48 canvas, feet on the bottom row).
"""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

import arena
import fx
import gems
import rigs_earth
import rigs_nature
import rigs_fire
import rigs_light
import rigs_water
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
PIXELLAB = HERE.parent / "pixellab" / "sprites"
WEB = HERE.parent.parent / "web" / "pixelart.js"

MONSTER_IDS = {
    "pyrup": "ember_pup", "scorchpaw": "cinder_hound", "magmaul": "magma_titan", "emberwing": "phoenix_chick",
    "tidecoil": "tide_serpent", "frostnip": "frost_imp", "krakling": "kraken_pup", "bublob": "bubble_jelly",
    "craggol": "stone_golem", "rubbug": "boulder_beetle", "tremole": "quake_mole", "gemox": "crystal_ox",
    "thornkin": "thorn_sprite", "vinecoil": "vine_lurker", "myconite": "shroom_knight", "petalope": "petal_fawn",
    "lumowl": "prism_owl", "glintling": "dawn_sprite", "dawnhare": "lumen_stag", "lumoth": "halo_moth",
}


def data_url(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def pixellab_monster(mid: str) -> dict | None:
    """A PixelLab-drawn monster (art/pixellab), if all three of its stages are there."""
    paths = [PIXELLAB / f"{mid}-{st}.png" for st in range(3)]
    if not all(p.exists() for p in paths):
        return None
    facing = json.loads((PIXELLAB / "facing.json").read_text()).get(mid, {}) if (PIXELLAB / "facing.json").exists() else {}
    stages = []
    for st, p in enumerate(paths):
        img = Image.open(p).convert("RGBA")
        assert img.size == (48, 48), f"{p.name} is {img.size}, expected 48x48"
        x0, y0, x1, y1 = img.getchannel("A").getbbox()
        stage = {"flat": data_url(img), "face": facing.get(str(st), "front"),
                 "core": [round((x0 + x1) / 2, 1), round((y0 + y1) / 2 + (y1 - y0) * 0.08, 1)]}
        idle = PIXELLAB / f"{mid}-{st}-idle.png"
        if idle.exists():
            strip = Image.open(idle).convert("RGBA")
            stage.update(idle=data_url(strip), n=strip.width // 48)
        stages.append(stage)
    return {"res": 48, "icon": stages[0]["flat"], "stages": stages}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    monsters: dict[str, dict] = {}
    for module in (rigs_fire, rigs_water, rigs_earth, rigs_nature, rigs_light):
        for make in module.RIGS:
            stages = []
            for stage in range(3):
                rig = make(stage)
                flat = rig.flatten()
                flat.save(OUT / f"{rig.name}-{stage + 1}.png")
                parts = [
                    {"n": info.name, "role": info.role, "parent": info.parent, "z": info.z,
                     "pivot": [round(info.pivot[0], 1), round(info.pivot[1], 1)], "at": list(off), "size": list(img.size), "src": data_url(img)}
                    for info, img, off in rig.render_parts()
                ]
                # Body centre (where charge motes and orbs aim): middle of the sprite's bounding box.
                x0, y0, x1, y1 = flat.getchannel("A").getbbox()
                stages.append({"flat": data_url(flat), "parts": parts, "core": [round((x0 + x1) / 2, 1), round((y0 + y1) / 2 + (y1 - y0) * 0.08, 1)]})
                if stage == 0:
                    icon = flat.crop((8, 16, 40, 48))  # design space of the base form = the old 32x32 frame
                    icon.save(OUT / f"{rig.name}-icon.png")
            monsters[MONSTER_IDS[make.__name__]] = pixellab_monster(MONSTER_IDS[make.__name__]) or {"icon": data_url(icon), "stages": stages}
    tiles = {}
    for make in gems.SPRITES:
        s = make()
        img = s.render()
        img.save(OUT / f"gem-{s.name}.png")
        tiles[s.name] = data_url(img)
    effects = {}
    for name in fx.NAMES:
        img = fx.sheet(name)
        img.save(OUT / f"fx-{name}.png")
        effects[name] = data_url(img)
    status, still = {}, {}
    for name, img in fx.status_sheets().items():
        img.save(OUT / f"status-{name}.png")
        (status if img.width == fx.S * 4 else still)[name] = data_url(img)
    bg, plat = arena.backdrop(), arena.platform()
    themes = {}
    for theme in arena.THEME_NAMES:
        imgs = {"arena": arena.backdrop(theme), "platform": arena.platform(theme),
                "cloudsFar": arena.clouds(theme, "far"), "cloudsNear": arena.clouds(theme, "near")}
        for key, img in imgs.items():
            img.save(OUT / f"{key}-{theme}.png")
        themes[theme] = {k: data_url(v) for k, v in imgs.items()}
    missing = set(MONSTER_IDS.values()) - set(monsters)
    assert not missing, f"no rig for {missing}"
    WEB.write_text(
        "// Generated by art/pixel/build.py; edit the sprite sources there, not this file.\n"
        "// Draw everything at whole-number scales with image-rendering: pixelated.\n"
        f"window.PIXELART = {json.dumps({'monsters': monsters, 'gems': tiles, 'arena': data_url(bg), 'platform': data_url(plat), 'themes': themes, 'fx': effects, 'status': status, 'statusStill': still}, separators=(',', ':'))};\n"
    )
    n_parts = sum(len(s.get("parts", [])) for m in monsters.values() for s in m["stages"])
    n_hd = sum(1 for m in monsters.values() if m.get("res"))
    print(f"{len(monsters)} monsters x 3 stages ({n_hd} drawn with PixelLab, {n_parts} rig parts), {len(tiles)} gems, {len(effects)} effects, arena -> web/pixelart.js ({WEB.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
