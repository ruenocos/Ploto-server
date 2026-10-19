# PixelLab monsters

The monster art drawn with [PixelLab](https://www.pixellab.ai) (API, from
these scripts), replacing the hand-rigged sprites in `art/pixel` line by line.
The key comes from the environment (`PIXELLAB_API_KEY` or `PIXELLAB_KEY_FILE`),
never from the repo.

## The rules

Taken from how Pokémon, Disney/Pixar and pixel-art creature games keep a cast
cohesive (Sugimori and Nishida on evolution lines, Cassette Beasts' shared
colour pool, the GBA sprite limits):

- **An idea per line, from a myth that fits the kit.** Pyrup is a kitsune whose
  fox-fire wisps burst (Ember Bite sets off burns); Scorchpaw a kiln-fired shisa
  whose glaze cracks when hurt (Berserk). Never "an animal plus its element".
- **One signature feature carried through the line**, named in the same words
  at every stage (`roster.py`). Stage 2 shows it partly grown; the biggest
  change is saved for stage 3, so the teen is never a small copy of the adult.
- **Adult first, then backwards.** The adult is designed from a grid of options;
  the teen and baby are drawn with the picked older stage as a reference and its
  own colours as the palette, so the line stays one creature in one set of colours.
- **Small canvases:** 32 / 40 / 48 px for baby / teen / adult, drawn natively
  (never rescaled) and placed feet-down on the game's 48x48 canvas. Small
  sprites force big shapes and at most three features.
- **Colours:** one shared 48-colour pool (from Endesga 64) for the whole roster,
  11 / 13 / 15 colours per sprite (the GBA limit was 15 plus transparent). Each
  line has its own main hue, accent and contrast patch; within an element the
  lines differ in value (Pyrup white, Scorchpaw terracotta and teal, Magmaul
  obsidian, Emberwing crimson).
- **Same eyes, outline and light everywhere:** dark outline, light from the top
  left, hue-shifted shadows.
- **Facing:** every sprite is a three-quarter view stored facing right (your
  side); the game mirrors the rival's copy so both teams face each other.

## Workflow

```bash
export PIXELLAB_KEY_FILE=~/.pixellab_key
cd art/pixellab
python3 concept.py ember_pup --stage 2                 # 25 adult options -> candidates/ember_pup-c2-1.png
python3 pick.py ember_pup 2 candidates/ember_pup/c2-1-f0.png [left|right|front]
python3 concept.py ember_pup --stage 1 --from-next     # teen options drawn from the picked adult
python3 concept.py ember_pup --stage 0 --from-next     # baby options drawn from the picked teen
python3 face.py flip ember_pup 1                       # fix a pick that faces the wrong way
echo ember_pup >> sprites/ready.txt                    # approve the line
python3 ../pixel/build.py                              # swaps approved lines into web/pixelart.js
```

- `roster.py` — every monster's myth, signature, colours and three stage briefs.
- `style.py` — sizes, colour pool, colour caps, the house style string.
- `concept.py` — options for a stage with PixelLab's Pro model (`--from-next`,
  `--palette-only`, `--redraw`, `--colors`, `--extra`).
- `pick.py` — cleans a pick (pool colours, colour cap, hard edges) into `sprites/`.
- `face.py` — flips a sprite or sets its facing (`sprites/facing.json`).
- `evolve.py`, `generate.py`, `idle.py` — img2img evolution, Pixen candidates,
  idle loops (optional; the client plays an `<id>-<stage>-idle.png` strip if present).
- `candidates/` — review material, not committed.
