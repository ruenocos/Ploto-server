"""
What each monster looks like at each stage, for the PixelLab prompts.

Keys are the game's monster ids. Per line (see README.md for the rules):

- `signature`: the one feature that carries the line, named in the same words
  at every stage. Stage 2 shows it partly grown; the biggest change, where it
  completes, is saved for stage 3.
- `colors`: main hue, accent, contrast patch, in the same words every stage.
  Lines of one element differ in value and accent, not just shape.
- `accents`: pool colours stage 2-3 may add on top of the baby's own colours.
- `stages`: what each stage looks like; `idle`: what moves in its idle loop.
"""

ROSTER: dict[str, dict] = {
    # Fire: Pyrup mid orange, Scorchpaw light gold, Magmaul dark charcoal, Emberwing deep red.
    "ember_pup": {
        "name": "Pyrup",
        "signature": "a flame-tipped tail",
        "colors": "bright orange fur, cream muzzle chest and tail tip, dark brown paws and ear backs",
        "accents": ["ffc825", "ffeb57", "ffa214"],
        "stages": (
            "a tiny fox kit sitting, oversized pointed ears, a bushy tail with a small glowing ember on its tip",
            "a lean young fox standing on four longer legs, a longer bushy tail with a small real flame on its tip, "
            "tiny flames on the ear tips",
            "a regal fox sitting tall, a thick cream ruff on its chest, two big tails made entirely of flame, "
            "flames on the ear tips",
        ),
        "idle": "the flames flicker and the tail sways",
    },
    "cinder_hound": {
        "name": "Scorchpaw",
        "signature": "a flame mane",
        "colors": "golden yellow fur, cream muzzle and belly, a red-orange flame mane, charcoal claws",
        "accents": ["c64524", "e07438", "3d3d3d"],
        "stages": (
            "a chubby lion cub sitting, round ears, big paws, a small tuft of flame on top of its head",
            "a young lion standing on all fours, longer legs, a short scruffy mane with small flames at its edges",
            "a muscular lion king standing upright on two legs, a huge mane made completely of fire, "
            "two short charcoal horns, clawed hands",
        ),
        "idle": "the flame mane flickers",
    },
    "magma_titan": {
        "name": "Magmaul",
        "signature": "a cracked charcoal rock shell over glowing magma",
        "colors": "charcoal grey rock with slate-blue highlights, glowing orange and yellow magma",
        "accents": ["424c6e", "657392", "ffeb57"],
        "stages": (
            "a small cute blob of glowing magma with stubby arms, wearing a cracked piece of charcoal rock on its "
            "head like a helmet",
            "a stocky magma creature on two short legs, the rock helmet has grown into a shell covering its head, "
            "back and shoulders, a glowing magma belly",
            "a hulking titan, its rock shell has become a volcano on its back with a glowing crater, rock armour on "
            "its arms, huge fists on the ground, a glowing magma belly",
        ),
        "idle": "the magma glows and pulses",
    },
    "phoenix_chick": {
        "name": "Emberwing",
        "signature": "a flame crest",
        "colors": "deep red feathers, gold crest and wing tips, cream belly, yellow beak and legs",
        "accents": ["ffc825", "edab50", "ffa214"],
        "stages": (
            "a round fluffy chick, tiny stubby wings, a small flame crest on its head",
            "a gangly fledgling standing on long legs, wings folded against its body, a taller flame crest, "
            "long tail feathers",
            "a phoenix with its wings spread wide, the wing tips, the long tail and the tall crest are made of fire",
        ),
        "idle": "the flame crest flickers and the feathers shift",
    },
}
