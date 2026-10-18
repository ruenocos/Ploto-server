# Evolution design brief

Every monster has three stages: **Base**, **★** and **★★**. Each stage should
read as a new creature from the same family, not the same sprite scaled up.
The rules below come from how creature collectors (Pokémon, Temtem, Cassette
Beasts, Coromon) build their lines, plus basic character-design proportion
rules. Sources are at the end.

## The test

Render `python3 rigsheet.py sheet.png rigs_<element>`. The right half shows each
stage as a black silhouette. **If you scale the Base silhouette up and it covers
the ★ or ★★ silhouette, the stage fails.** Each stage needs at least one change
in *outline*, not just in size or interior detail.

## Stage by stage

| | Base (baby) | ★ (adolescent) | ★★ (adult) |
|---|---|---|---|
| Height in design px (of 32; the rig scales it ×1.0 / ×1.2 / ×1.38) | ~23–26 (drawn at ×1.0, so pixel-crisp) | ~24–27 | ~29–32 |
| Head share of total height | 50–60% | 35–45% | 25–35% |
| Posture | sitting, curled or low on all fours | standing up, neck or limbs lengthen | a new stance: upright/biped, rearing, airborne, armoured |
| Shape language | circles; soft, compact | round body with first sharp accents | triangles and blocks; spikes, horns, plates, claws |
| Eyes (`eyes()`, see below) | `round` | `bright` | `sharp` |
| Signature motif | a tiny hint (a flame tip, one leaf, one crystal) | the motif grows **and** one new feature appears | the motif becomes the main shape (flame → wings, leaf → frond crown, crystal → armour) |
| Palette | the family ramp, a touch lighter | the family ramp | the family ramp plus one accent (darker shell, gold trim, glowing marks) |

Rules of thumb:

- **Same family:** keep the core palette and one or two motifs across all
  three stages (Bulbasaur's bulb becomes a bud, then a flower). Never bring in
  an unrelated element.
- **Silhouette first:** the ★★ form should be recognisable from its outline
  alone, and different from every other monster's ★★ form.
- **Uneven split:** about 60/40 between the dominant mass and the secondary
  one. 50/50 masses compete with each other.
- **Growing up:** proportions move from baby to adult (smaller head relative to
  the body, longer limbs) rather than everything scaling together.

## Eyes

Every monster's eyes come from one helper, `rigkit.eyes(r, cx, y, gap, …)`, so
they follow one set of rules:

- Sizes are in **canvas** pixels, so eyes never come out lopsided at the ×1.2 /
  ×1.38 stage scales.
- They're mirrored around the face's centre line, so both eyes always match.
- The shine is always the **outer top pixel**.

| Style | Default for | Shape |
|---|---|---|
| `round` | Base | 2×3 ink, shine |
| `bright` | ★ | 2×2 ink, shine, a flat brow two rows above |
| `sharp` | ★★ | 2×2, inner top pixel lidded, brow slanting down to the nose; give `iris=` a glow material to light it |
| `closed` | any (sleepy, squinting) | a 3-px arc |

Allowed exceptions go through the helper's parameters, never through
hand-placed eye pixels. For example, an owl's coloured iris ring is drawn
under the helper's eyes, and a shadowed face passes a glowing `iris`.

## Rig conventions (unchanged)

- Draw in the 32×32 design space with the feet centred on (16, 31). The rig
  scales each stage onto the 48×48 canvas.
- Each stage needs a `body` part; add head, ears, wings, tail, arms, legs,
  tentacles and fx as separate parts with sensible pivots, so the client's idle
  loops have something to move. Roles: body, head, tail, wing-l/r, arm-l/r,
  ear-l/r, legs, tent-l/r, fx.
- Use `pixelkit` materials: top-left light, 4-colour ramps, coloured
  selective outlines, flat faces, `floating=True` for halos and sparks.

## Sources

- [The Evolution of Pokémon Art over the Years — Smogon](https://www.smogon.com/articles/pokemon-art-through-ages): similar silhouettes made Gen 1 sprites hard to tell apart.
- [Designing a Pokémon — Where Creativity Works](https://wherecreativityworks.com/designing-a-pokemon/): round and compact base, athletic middle, imposing final; design the family together.
- [Designing Animated Characters for Children of Different Ages — Disney Research](https://la.disneyresearch.com/wp-content/uploads/Designing-Animated-Characters-for-Children-of-Different-Ages-Paper.pdf): younger reads as a bigger head relative to the body and bigger eyes.
- [Analysis of a Cute Creature — Clip Studio Tips](https://tips.clip-studio.com/en-us/articles/7185): circles and triangles read clearly; split masses about 60/40.
- [Creature collecting gets an analogue upgrade in Cassette Beasts — Wireframe](https://wireframe.raspberrypi.com/articles/creature-collecting-gets-an-analogue-upgrade-in-cassette-beasts) and [Temtem's community-designed Tem — Massively OP](https://massivelyop.com/?p=248081): how indie creature collectors approach staged and branching evolutions.
