"""
What each monster looks like at each stage, for the PixelLab prompts.

Keys are the game's monster ids. Every line has a `story`: the one thing that
grows from stage to stage, so the three stages read as one creature growing
up rather than three monsters (art/pixel/EVOLUTION.md). `colors` is the line's
scheme and is repeated in every stage's prompt, so the colours never drift.
Stages 2 and 3 are drawn with the previous stage as a reference image.
`idle` names what moves in its idle loop.
"""

ROSTER: dict[str, dict] = {
    "ember_pup": {  # Pyrup
        "name": "Pyrup",
        "story": "an ember on the tail grows into a wildfire",
        "colors": "bright orange fur, cream muzzle, chest and tail tip, dark brown paws, yellow and orange flames",
        "stages": (
            "a tiny fox kit sitting, oversized pointed ears, a bushy tail whose tip is a small glowing ember",
            "a lean young fox standing alert on four legs, longer legs and snout, the tail tip and the ear tips "
            "are now small real flames, no other fire",
            "a regal fox sitting tall and proud, a thick cream ruff on the chest, two big tails made entirely of "
            "flame, flames along the ear tips, a gold flame mark on the forehead",
        ),
        "idle": "the flames flicker and the tail sways",
    },
    "cinder_hound": {  # Scorchpaw
        "name": "Scorchpaw",
        "story": "a lion's mane slowly catches fire",
        "colors": "golden yellow fur, cream muzzle and belly, red and orange flames, dark brown claws",
        "stages": (
            "a chubby lion cub sitting, big paws, round ears, a single small flame tuft on top of the head",
            "a young lion on all fours, longer legs, a short scruffy mane that is just starting to smoulder "
            "with small flames at its edges, a flame tip on the tail",
            "a muscular lion beast king standing upright on two legs, a huge mane fully ablaze, two short curved "
            "horns, clawed hands, the same golden fur",
        ),
        "idle": "the flames in the mane flicker",
    },
    "magma_titan": {  # Magmaul
        "name": "Magmaul",
        "story": "living magma grows a rock shell, then becomes a volcano",
        "colors": "glowing orange and yellow magma, dark grey basalt rock, small white-hot highlights",
        "stages": (
            "a small cute blob of glowing molten magma with stubby arms, wearing a cracked piece of dark rock on "
            "its head like a helmet, big friendly eyes",
            "a stocky magma creature standing on two legs, its body now half covered in dark basalt rock plates, "
            "glowing magma showing between the plates and in its chest, chunky fists",
            "a hulking volcano titan, fully armoured in dark basalt, a smoking crater on its back, magma glowing "
            "from its joints and eyes, huge fists resting on the ground",
        ),
        "idle": "the magma glows and pulses",
    },
    "phoenix_chick": {  # Emberwing
        "name": "Emberwing",
        "story": "a flame crest spreads until the bird is fire",
        "colors": "golden yellow and orange feathers, a red-orange flame crest, yellow beak and legs",
        "stages": (
            "a round fluffy chick, soft yellow down, tiny stubby wings, a little flame crest on its head",
            "a gangly fledgling standing on long legs, wings still folded against its body, the flame crest "
            "now taller, long orange tail feathers with burning tips",
            "a majestic phoenix with its wings spread wide, the wing tips and the long tail are made of fire, "
            "a tall flame crest, gold and red feathers",
        ),
        "idle": "the flame crest flickers and the feathers shift",
    },
}
