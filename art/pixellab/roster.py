"""
What each monster looks like at each stage, for the PixelLab prompts.

Keys are the game's monster ids. Every line is built on a myth that fits its
kit, so it has an idea of its own rather than "an animal plus its element".
Per line (see README.md for the rules):

- `myth`: what it is based on, and why that fits its move.
- `signature`: the one feature that carries the line, named in the same words
  at every stage. Stage 2 shows it partly grown; the biggest change, where it
  completes, is saved for stage 3 (the adult is designed first).
- `colors`: main hue, accent, contrast patch, in the same words every stage.
  The element shows in one feature, not the whole body.
- `accents`: pool colours later stages may add on top of the earlier stage's.
- `stages`: what each stage looks like; `idle`: what moves in its idle loop.
"""

ROSTER: dict[str, dict] = {
    # Fire: four different values and materials, so they never read as four red animals.
    "ember_pup": {
        "name": "Pyrup",
        "myth": "Kitsune with kitsunebi (fox-fire): Ember Bite sets the rival's burns off like wisps bursting",
        "signature": "floating orange fox-fire wisps at the tips of its tails",
        "colors": "white and cream fur, red-orange markings on the face and ear tips, orange fox-fire wisps",
        "accents": ["ffa214", "ffc825", "e07438"],
        "stages": (
            "a tiny kitsune fox kit sitting, big ears, one fluffy tail with a small fox-fire wisp floating at its tip",
            "a young kitsune fox standing, three fluffy tails each with a fox-fire wisp floating at its tip",
            "an elegant nine-tailed kitsune fox spirit sitting tall, nine tails fanned out behind it, "
            "a fox-fire wisp floating at the tip of every tail",
        ),
        "idle": "the fox-fire wisps bob and flicker, the tails sway",
    },
    "cinder_hound": {
        "name": "Scorchpaw",
        "myth": "Shisa guardian lion, made of kiln-fired clay: Berserk, the glaze cracks and glows when it is hurt",
        "signature": "a glossy teal glazed mane with glowing orange cracks",
        "colors": "terracotta orange-brown clay body, glossy teal glaze mane and tail, glowing orange cracks",
        "accents": ["ffa214", "ffc825", "0098dc"],
        "stages": (
            "a small clay shisa lion-dog pup sitting, round body, a little curl of teal glaze on its head, "
            "one small glowing crack",
            "a shisa guardian lion-dog standing on four legs, a curly teal glazed mane and curly tail like a temple "
            "statue, a few glowing orange cracks",
            "a big shisa temple guardian lion standing proud on a small stone base, a huge curly teal glazed mane "
            "and tail, open fierce mouth, many glowing orange cracks across the clay",
        ),
        "idle": "the glowing cracks pulse",
    },
    "magma_titan": {
        "name": "Magmaul",
        "myth": "Zaratan, the turtle mistaken for an island: Eruption, the island on its back is a volcano",
        "signature": "a volcano growing on its shell",
        "colors": "charcoal grey basalt shell, olive green scaly skin, glowing orange lava",
        "accents": ["ffa214", "ffc825", "33984b"],
        "stages": (
            "a tiny turtle hatchling with a dark pebble shell, a small warm orange glow in one crack of the shell",
            "a sturdy turtle whose dark rock shell has grown into a small smoking cone with a glowing orange tip",
            "a giant turtle carrying a whole volcano island on its shell, a glowing orange crater on top, lava "
            "running down the rock, thick stumpy legs",
        ),
        "idle": "the lava glows and a little smoke rises",
    },
    "phoenix_chick": {
        "name": "Emberwing",
        "myth": "the Slavic Firebird, whose feathers keep glowing after they fall: Afterburn, its burns last longer",
        "signature": "long plume feathers ending in glowing eye-spots",
        "colors": "crimson and gold plumage, cream chest, glowing yellow-white eye-spots on the plumes",
        "accents": ["ffeb57", "ffc825", "edab50"],
        "stages": (
            "a round fluffy firebird chick, gold down, a tiny crest, one long plume feather with a glowing eye-spot",
            "a slender young firebird standing, a small flame crest, three long plume feathers with glowing "
            "eye-spots trailing behind",
            "a majestic firebird like a fiery peacock, a flame crown crest, wings half open, a long train of plume "
            "feathers fanned out behind it, each ending in a glowing eye-spot",
        ),
        "idle": "the plumes sway and the eye-spots glow",
    },
}
