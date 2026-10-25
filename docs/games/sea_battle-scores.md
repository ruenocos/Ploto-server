# Sea Battle: scoring rounds

Scored on docs/SCORING.md by two fresh reviewers per round; the lower score per
category counts. Reviewers couldn't listen to the sounds: the sound score rests
on the cue design (coverage, lengths, loudness, brightness, where cues fire).

## Round 1

| Category | A | B | Score |
|---|---|---|---|
| Game design | 7 | 7 | **7** |
| Signature moment | 6 | 7 | **6** |
| Animation | 6 | 7 | **6** |
| Sound and haptics | 7 | 7 | **7** |
| Visual design | 6 | 6 | **6** |
| UX and clarity | 6 | 6 | **6** |
| Platform consistency | 8 | 8 | **8** |
| Bots | 7 | 7 | **7** |
| Implementation | 8 | 7 | **7** |
| Accessibility | 6 | 6 | **6** |

What both saw: the sink is all there but reads small (the stamp lands mid-board,
far from the ship; smoke and bubbles are tiny; a carrier sinks like a destroyer);
a "Miss" label floats over the wrong sea after the swap, "Hit. Again" clips at the
edge; the coin flip plays under a call that already says whose turn it is; the
swap is a fade, not a swap; a hit on your ship sounds like your hit on theirs and
there's no timeout cue; 30 px cells fire on one tap; empty space under the boards,
flat grey squares on the overview, "YOU [YOU]", a clipped "10"; a sparse launcher
card and a banner without the signature moment; no socket reconnect; the server's
animation allowances are shorter than the client's; own ships unlabelled for
screen readers, every turn announced twice, reduced motion hides the results.

Fixes built after round 1: the sink scaled by length (bursts per plate, halves
parting, smoke and bubbles by length, a wobble for big ships, a dimmed board,
SUNK beside the ship, rings of water), stale labels cleared, labels kept inside
the sea, a real swap, a coin flip that doesn't give the result away, reduced
motion holds; struck / lost / timeout cues, softer varied splashes; real sprites
on the overview, sprite trackers, the teal accent, a lighter wreck, clearer
marks, the card and banner redrawn; tap-to-aim then Fire, your name in the dock,
Classic / Quick, an Away tag, a hiding meter; Medium sharper, Hard hides and
sometimes takes its second choice, think time by situation, quick play on 8×8;
the page reconnects, matching animation allowances, reconnect tests; grid rows,
ship names per cell, one announcement per event, focus on your turn.

## Round 2

| Category | A | B | Score |
|---|---|---|---|
| Game design | 8 | 7 | **7** |
| Signature moment | 7 | 6 | **6** |
| Animation | 7 | 7 | **7** |
| Sound and haptics | 7 | 7 | **7** |
| Visual design | 7 | 6 | **6** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 8 | 8 | **8** |
| Bots | 8 | 8 | **8** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 8 | **8** |

What both saw: the SUNK stamp sits off-centre and clipped for a second
(Animate.css's bounceIn replaces its centring transform) and lands after the
ship is gone; your fleet disappears during the coin flip; the swap shows a blank
frame; the sink halves rotate by non-pixel angles; the shell is hard to see; the
win is quieter than a sink and sinks are long; the coordinates are clipped by the
aiming ring; dead space under the board, small trackers, a thin star on the card,
a bare result hero with an orphan tile; the dock labels read wrong on the rival's
turn; the Fire button isn't in the thumb zone; no seconds on the clock; cells
disabled on the rival's turn lose keyboard focus; every event announced
assertively; animation budgets duplicated between client and server, the page
copies the engine's geometry.

Fixes built after round 2: the stamp centred beside the ship and landing at the
crack, whole-pixel tilted halves, the banner playing the game's own sink, the
fleet kept through the coin flip, no blank swap frame, a visible shell with a
trail; sounds rebalanced (the win loudest, shorter sinks); coordinates clear of
the aiming ring, labelled overview, a Fire bar, seconds on the clock, a hunters'
view while placing, both seas on the result; shared rules and timings tested
against the engine and server, a real game to its last sink in the e2e;
focusable cells, polite / assertive announcements, a one-tap firing setting.

## Round 3

| Category | A | B | Score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 8 | 8 | **8** |
| Animation | 8 | 8 | **8** |
| Sound and haptics | 8 | 7 | **7** |
| Visual design | 7 | 7 | **7** |
| UX and clarity | 7 | 6 | **6** |
| Platform consistency | 9 | 9 | **9** |
| Bots | 8 | 8 | **8** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 8 | **8** |

What both saw: a regression from round 2, the placing screen scrolls sideways
(the hunters' view button) and the placing call is clipped; the "fire again" lines
are overwritten when the update settles; "You fired 1 shots"; the hit-stop flash
reads grey; the final sink plays like any other; the ripple looks like a miss
ring; a destroyer's sink shakes like a hit; the last hit before a sink is silent;
the turn chime is as loud as a hit and the splash is bright; Hard beats a good
player 77%; Medium's corner shots look broken; the e2e has no layout or copy
assertions.

Fixes built after round 3: the placing dock wraps (no sideways scroll at any
width; the e2e now asserts it at 360/390/430, with the hunter view open too) and
the call is never clipped; "fire again" lines stay up until the turn changes;
plural copy everywhere; a white-hot star for the hit-stop while the fires hold
still, a one-pixel jolt on a hit, a bigger pop on a streak; the final sink is its
own moment (FLEET SUNK, slower halves, the board wobbles, every wreck lights up in
turn); deeper whole-pixel dips for the halves, every sink shakes, SUNK placed on
the first side clear of the hull and drawn above the smoke; the rival's crosshair
walks from their last shot, quicker on a streak; a tossed, landing coin and "you
lost last time: you fire first" for rematches (the loser opens); a dashed no-go
halo around the picked ship, dots in the hunter view; sounds: the hit before a
sink, the groan, bubbles under the rings, the incoming whistle, a quieter turn
chime, no aim cue on the clock's shots; Hard eased (a good player wins ~26%),
Medium's broken-looking corner shots removed; a keyboard-only, reduced-motion e2e
game; a bot band test against a good-human stand-in.
