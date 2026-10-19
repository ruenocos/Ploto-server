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
            "a tiny kitsune fox kit sitting, pure white fur with red-orange ear tips and face markings like the "
            "older stages, big ears, one fluffy white tail with a small fox-fire wisp floating at its tip",
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
            "a tiny round shisa lion-dog pup sitting, bare unglazed terracotta clay, just one small drip of teal "
            "glaze on top of its head, one tiny glowing orange crack",
            "a young shisa lion-dog sitting upright like a temple statue, mouth closed, the teal glaze only half "
            "covers its curly mane with drips running down onto bare terracotta clay, two small glowing orange cracks",
            "a big shisa temple guardian lion standing proud on a small stone base, a huge curly teal glazed mane "
            "and tail, open fierce mouth, many glowing orange cracks across the clay",
        ),
        "idle": "the glowing cracks pulse",
    },
    "magma_titan": {
        "name": "Magmaul",
        "myth": "Zaratan, the turtle mistaken for an island: Eruption, the island on its back is a volcano",
        "signature": "a volcano growing on its shell",
        "colors": "black obsidian rock skin with glowing orange-yellow magma veins, dark charcoal basalt shell, "
                  "glowing orange lava",
        "accents": ["ffa214", "ffc825", "ffeb57"],
        "stages": (
            "a tiny round turtle hatchling with a smooth black obsidian pebble shell, one small glowing orange crack "
            "on the shell, big head",
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
    # Water: kelp teal, ice pale, deep purple, pearly pink.
    "tide_serpent": {
        "name": "Tidecoil",
        "myth": "the Kelpie, a water horse that drags riders under: Undertow drains the rival's charge",
        "signature": "a mane of kelp and sea foam",
        "colors": "deep teal-blue horse body, dark green kelp mane, white sea foam, pale aqua belly",
        "accents": ["94fdff", "ffffff", "1e6f50"],
        "stages": (
            "a small water foal sitting, a short kelp mane, a curled seahorse tail instead of hind legs",
            "a young kelpie standing in a splash of water, front horse legs, a fish tail behind, a longer kelp mane",
            "a great kelpie rearing up, its kelp mane turning into a breaking wave of white foam, a long fish tail",
        ),
        "idle": "the kelp mane sways like it is underwater",
    },
    "frost_imp": {
        "name": "Frostnip",
        "myth": "Jack Frost, who paints frost on windows: Frostbite freezes tiles",
        "signature": "an icicle paintbrush tail",
        "colors": "pale ice-blue skin, white frosty hair, deep blue markings, clear ice crystals",
        "accents": ["ffffff", "94fdff", "0098dc"],
        "stages": (
            "a tiny round snowflake imp with a cheeky grin, a short tail ending in a little icicle brush",
            "a mischievous frost imp with small icicle horns, a long tail ending in an icicle paintbrush, frost patterns on its arms",
            "a tall frost elder with a crown of icicles, a long icicle brush tail, a cape covered in frost patterns",
        ),
        "idle": "the icicle brush tail swishes and sparkles",
    },
    "kraken_pup": {
        "name": "Krakling",
        "myth": "the Kraken that drags ships down: Riptide grabs and slows the rival",
        "signature": "an old brass diving helmet",
        "colors": "deep purple-blue skin, pale lilac suckers, tarnished brass, sea-green rust",
        "accents": ["edab50", "33984b", "ca52c9"],
        "stages": (
            "a baby octopus wearing an old brass diving helmet too big for it, little tentacles peeking out",
            "a bigger octopus, the brass diving helmet now sits on top of its head like a hat, dragging a rusty anchor",
            "a huge kraken with thick tentacles clutching a broken ship's mast, the old brass diving helmet worn like a crown",
        ),
        "idle": "the tentacles curl and uncurl",
    },
    "bubble_jelly": {
        "name": "Bublob",
        "myth": "the Shen, a clam whose breath makes mirages: Bubble Barrier",
        "signature": "a glowing pearl and shimmering bubbles",
        "colors": "pearly pink-white shell, lavender inside, iridescent cyan bubbles, a glowing white pearl",
        "accents": ["94fdff", "fdd2ed", "ffffff"],
        "stages": (
            "a small round clam with big eyes peeking out, blowing one shimmering bubble",
            "a clam opened wide showing a glowing pearl inside, a ring of shimmering bubbles floating around it",
            "a giant clam, its breath forming a big shimmering mirage bubble with a tiny palace inside, a glowing pearl",
        ),
        "idle": "the bubbles drift up and wobble",
    },
    # Earth: grey stone, dark beetle, muddy olive, cream and crystal.
    "stone_golem": {
        "name": "Craggol",
        "myth": "the Golem of Prague, brought to life by a rune: Shield Bash",
        "signature": "a glowing gold rune on its forehead",
        "colors": "grey stone body, tan clay patches, moss on the shoulders, a glowing gold rune",
        "accents": ["ffc825", "33984b", "b4b4b4"],
        "stages": (
            "a small chunky clay doll golem sitting, a glowing rune on its forehead",
            "a stone golem standing, holding a big stone slab as a shield, the rune glowing on its forehead",
            "a towering fortress golem, battlements on its shoulders, a shield carved like a castle gate, the rune blazing",
        ),
        "idle": "the rune pulses with light",
    },
    "boulder_beetle": {
        "name": "Rubbug",
        "myth": "the scarab rolling the sun, here a boulder that turns things to stone: Petrify",
        "signature": "a round boulder it rolls",
        "colors": "dark brown-black beetle shell with a green-gold sheen, sandstone boulder, amber eyes",
        "accents": ["edab50", "5ac54f", "bf6f4a"],
        "stages": (
            "a chubby beetle grub pushing a small round pebble",
            "a beetle standing on its back legs pushing a round boulder twice its size",
            "a great scarab beetle holding a huge carved boulder over its head, a stone eye carved on its shell",
        ),
        "idle": "the beetle shifts its grip on the boulder",
    },
    "quake_mole": {
        "name": "Tremole",
        "myth": "the Namazu, the giant catfish that causes earthquakes: Tremor shatters a column",
        "signature": "long whiskers and a stone on its back",
        "colors": "muddy olive-brown catfish skin, cream belly, grey stone, brown mud",
        "accents": ["858585", "8a4836", "f6ca9f"],
        "stages": (
            "a tiny round catfish in a little mud puddle, very long whiskers, a pebble on its back",
            "a catfish walking on stubby legs, long whiskers, a flat stone strapped on its back",
            "a giant namazu catfish, a huge carved keystone pinning its back, long whiskers, cracks in the ground around it",
        ),
        "idle": "the whiskers wave slowly",
    },
    "crystal_ox": {
        "name": "Gemox",
        "myth": "Audumbla, the cow that licked a being out of salt-ice: Crystallize grows gems",
        "signature": "crystal horns",
        "colors": "warm cream-white fur, pink-violet crystals, grey hooves and nose",
        "accents": ["ca52c9", "fdd2ed", "ffffff"],
        "stages": (
            "a small calf sitting, tiny crystal nubs on its head",
            "a sturdy young ox with pointed crystal horns and a few crystals growing on its shoulders",
            "a great ox with huge crystal horns and a whole crystal mountain growing on its back",
        ),
        "idle": "the crystals glint",
    },
    # Nature: pale root, dark bark, red cap, soft green.
    "thorn_sprite": {
        "name": "Thornkin",
        "myth": "the Mandrake, the poisonous root that screams: Thorn Prick poisons",
        "signature": "a leafy sprout on its head",
        "colors": "pale tan root body, green leaves, purple thorns, magenta flowers",
        "accents": ["ca52c9", "93388f", "5ac54f"],
        "stages": (
            "a tiny mandrake root baby with stubby root legs and a leafy sprout on its head",
            "a mandrake root creature with thorny vine arms and a bigger leafy sprout",
            "a screaming mandrake elder with a wide open mouth, crowned with thorny magenta blooms, thorny root arms",
        ),
        "idle": "the leaves rustle",
    },
    "vine_lurker": {
        "name": "Tanglet",
        "myth": "the Jubokko, a tree that drinks from the battlefield: Feeding Vine steals life",
        "signature": "red sap fruit on hanging vines",
        "colors": "dark bark brown, green leaves, red sap and red fruit",
        "accents": ["ea323c", "c42430", "33984b"],
        "stages": (
            "a little sapling creature with a root mouth and one red fruit",
            "a walking tree stump with grasping vine arms and a few red fruits",
            "a hunched tree monster with long hanging vines, many red sap fruits and a toothy root mouth",
        ),
        "idle": "the hanging vines sway",
    },
    "shroom_knight": {
        "name": "Myconite",
        "myth": "the warden of a fairy ring, which traps whoever steps in: Spore Cloud seals",
        "signature": "a red spotted mushroom cap",
        "colors": "red cap with white spots, cream stem body, mossy green cloak, glowing spores",
        "accents": ["99e65f", "ffffff", "1e6f50"],
        "stages": (
            "a tiny toadstool creature holding a pebble as a shield",
            "a toadstool knight, its cap worn like a helmet, holding a twig lance and a leaf shield",
            "a fairy-ring warden in a mossy cloak of glowing spores, a ring of small mushrooms around its feet",
        ),
        "idle": "spores drift from the cap",
    },
    "petal_fawn": {
        "name": "Petalope",
        "myth": "the Qilin, who walks without crushing the grass: Bloom heals and grows tiles",
        "signature": "blossoms on its head",
        "colors": "soft green and cream fur, pink blossoms, gold hooves and markings",
        "accents": ["f389f5", "fdd2ed", "ffc825"],
        "stages": (
            "a small fawn lying down, a single flower bud on its head",
            "a young qilin standing, small antlers sprouting pink blossoms",
            "a graceful qilin with a flowing mane of flowers, flowers blooming where its hooves touch the ground",
        ),
        "idle": "the petals flutter",
    },
    # Light: ivory glass, pale glow, white fur, mint wings.
    "prism_owl": {
        "name": "Lumowl",
        "myth": "the Owl of Athena, with stained-glass wings: Smite pierces shields like a beam",
        "signature": "stained-glass wing feathers",
        "colors": "ivory feathers, stained-glass wings in amber, rose and sky blue, gold eyes",
        "accents": ["ffc825", "f68187", "0098dc"],
        "stages": (
            "a round owlet sitting in a cracked prism eggshell",
            "an owl with a few stained-glass feathers on its wings",
            "a great owl with its stained-glass wings spread wide, light shining through them",
        ),
        "idle": "the glass feathers shimmer",
    },
    "dawn_sprite": {
        "name": "Glintling",
        "myth": "the will-o'-the-wisp: Starstep gives an extra move",
        "signature": "a little lantern",
        "colors": "pale yellow-white glowing body, soft cyan edges, warm gold lantern",
        "accents": ["ffeb57", "94fdff", "edab50"],
        "stages": (
            "a tiny floating spark of light with eyes",
            "a floating wisp spirit carrying a tiny glowing lantern",
            "a lantern spirit in a flowing cloak of starlight, carrying a big glowing lantern",
        ),
        "idle": "the light flickers and floats",
    },
    "lumen_stag": {
        "name": "Dawnhare",
        "myth": "the Moon Rabbit pounding the elixir of life: Radiance heals over time",
        "signature": "a mortar and pestle of glowing elixir",
        "colors": "white fur, pale gold crescent markings, glowing gold elixir, wooden mortar",
        "accents": ["ffc825", "ffeb57", "8a4836"],
        "stages": (
            "a small bunny sitting, holding a tiny pestle",
            "a hare standing on its hind legs holding a wooden mortar and pestle",
            "a moon rabbit with a crescent halo, holding a big bowl of glowing elixir",
        ),
        "idle": "the elixir glows and the ears twitch",
    },
    "halo_moth": {
        "name": "Halomoth",
        "myth": "the moth as a soul (Psyche): Kindred Glow follows up its partner",
        "signature": "glowing eye-spots on its wings",
        "colors": "pale mint and lilac wings, soft gold glow, fuzzy cream body",
        "accents": ["ffeb57", "fdd2ed", "99e65f"],
        "stages": (
            "a chubby glowworm with glowing spots along its back",
            "a moth wrapped in a cocoon cloak, small wings with glowing eye-spots",
            "a luna moth with big wings, each with a glowing eye-spot, a faint halo above its head",
        ),
        "idle": "the wings flutter slowly",
    },
}
