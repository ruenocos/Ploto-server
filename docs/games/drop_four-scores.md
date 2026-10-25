# Drop Four: scoring rounds

Scored on docs/SCORING.md by two fresh reviewers per round; the lower score per
category counts. Reviewers can't listen to the sounds: the sound score rests on
the cue design (coverage, lengths, loudness, brightness, where cues fire). Every
reviewer also answers the standing question: does it feel cluttered, and can we
reduce eye strain?

## Round 1

| Category | A | B | Score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 7 | 7 | **7** |
| Animation | 7 | 7 | **7** |
| Sound and haptics | 7 | 7 | **7** |
| Visual design | 7 | 7 | **7** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 8 | 8 | **8** |
| Bots | 7 | 8 | **7** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 8 | **8** |

Clutter (both): not cluttered, but unbalanced: a saturated cobalt board and a
solid purple turn bar stacked at the top, an empty band below the dock, a key
hint that wraps and makes the dock jump.

What both saw: practice lost its coin flip (updates before the first state were
dropped); the line turns cream and loses whose it is; the other discs only dim
(the brief says they shake loose); a tap waits for the server before the disc
moves; no bomb preview and no last-move marker; the rival's bomb is a bare icon;
40 px columns at 360; Medium misses a visible four now and then; the fuse sound
is shorter than the fuse, pop inaudible, lose a buzz with a heavy haptic; the
banner takes 15 s to reach its payoff and leaves out the bomb.

Fixes built after round 1: early updates kept and replayed (practice opens with
the coin flip; the e2e checks it); a cream-ringed line that keeps the winner's
colour after a one-frame flash; a beat of stillness, then the rest of the grid
shakes loose and drops out; your disc starts falling when you tap; an armed bomb
outlines what it would clear, says "Nothing to clear there" when it would clear
nothing, and on touch asks for a second tap; a cream pip on the last move; a
bomb chip that says "Bomb ready" / "Bomb used"; whole-device-pixel sizing (a 2×
phone at 360 gets 45 px columns); the board centred and the dock at the bottom;
a calmer frame and an Active-frame call instead of a purple slab; short call
copy, the pulse only on your turn; Medium always takes a visible four, looks one
move ahead and slips among its next-best moves (a good player wins 58%, a casual
one 50%); Hard on a bigger budget (a good player wins 21%); the rival's hand
sometimes weighs a neighbouring column; the clock drops in the most central
column; a tick per row as a disc falls, a longer clack, one pop per cleared disc
with the cells announced, a fuse that lasts, a sine lose with a lighter haptic,
no buzz on the rival's moves, a single tick for your turn; gold and coral differ
in shape (groove ring / centre pip); a bomb diagram in How to play; the banner
cropped close with the bomb, reaching four on its second beat, then the bomb
going off; the result: the decisive line lit and the rest dimmed, two tiles, the
win pose.

## Round 2

| Category | A | B | Score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 8 | 8 | **8** |
| Animation | 8 | 7 | **7** |
| Sound and haptics | 8 | 8 | **8** |
| Visual design | 8 | 7 | **7** |
| UX and clarity | 8 | 8 | **8** |
| Platform consistency | 9 | 9 | **9** |
| Bots | 7 | 7 | **7** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 9 | **8** |

Clutter (both): not cluttered; the strain is the bright cobalt lattice (42 lit
hole lips), a second saturated purple frame on the call, gold text meaning two
things, and dead bands around the board.

What both saw: in friend and quick games the coin flip played on a hidden
screen (the page had no model yet, and the game's update beat the lobby's);
the FOUR stamp could cover the line; the discs that shake loose flew over the
dock; up to seven blips a move; Hard didn't punish sloppy play (a casual
stand-in won as often as a good one); Medium spotted every bomb win; columns
40 px at 1×; a full column gave no visible cue; the last-move pip was tiny and
marked a fallen disc after a bomb; the result's faded discs turned muddy.

Fixes built after round 2: the coin flip in every room (the model is seeded from
the first update, the game screen shown at once; the e2e checks the host sees
it); the stamp placed away from the line, with the win pose; a 120 ms stillness,
discs held big as they light, a stepped cream bar joining the four; the rest
drop out through the bottom of the frame (clipped; the e2e checks); a bigger
blast with a hit-stop and a whole-pixel rattle; two ticks a fall, no sound for
the rival's turn, a quieter turn chime, a louder timeout, a softer lose, a fuse
that lasts; the bomb ready after your third disc ("Bomb in N"), hidden once used
(a chip says so), its reach marked with × and read out in the column labels;
Hard on 40,000 positions and never leaving a move the rival's bomb can win from
(a good player wins 14%, a casual one 6%); Medium sees bomb wins half the time
(a good player wins 59%, a casual one 46%); a visible full-column cue; a bigger
last-move pip, cleared after a blast; no column tint on touch, the hand drops in
on your turn; a darker frame with shaded upper lips only; STYLE's Active frame
on the call; the rival's chip in plain text, "their bomb is ready" said once;
spent discs on the result (flat, marks kept) with the bar, the line kind as a
tile, a bigger hero; the clock taller as well as red when low; 4 px gutters at
360 (45 px columns on 2×); the clock's drop renamed and documented as central.

## Round 3

| Category | A | B | Round score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 8 | 8 | **8** |
| Animation | 8 | 8 | **8** |
| Sound and haptics | 8 | 8 | **8** |
| Visual design | 8 | 8 | **8** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 8 | 9 | **8** |
| Bots | 8 | 8 | **8** |
| Implementation | 7 | 7 | **7** |
| Accessibility | 8 | 8 | **8** |

Clutter (both): calm shell, but the board's lattice (42 near-black holes on
bright cobalt) is the strain; a second saturated block (the purple call on your
turn), labels said twice (the call and the stamp, the chip and the button), a
keyboard hint line and spent discs on the result add noise.

What both saw: the rival's chip said "Bomb ready" from the first move; during
the coin flip the call already named a turn, and a rival whose page was still
opening read as away; the browser suite had a failing bomb test (its move plan
gave Ben Ann's turn) and an assert that could never fail; the dock jumped when
the bomb was used; the cream bar covered the lit discs, and the result brought
back the discs that had just fallen out; the fourth disc landed like any other;
empty updates sped the coin label past reading; Medium's block rate was dead
code (it always blocked); bots never bombed to attack.

A design finding: in simulation the first player won about three games in four,
casual and Medium players alike.

Fixes built after round 3: the game's first disc can't go in the middle column
(first-player wins 55–59%; a test holds it under 62%), shown as a dimmed column
with its own line in the call; the bomb counts down on both sides ("Bomb in 2"),
read out in labels and the I summary, with a cue, a pulse and an announcement
when yours is ready; "Coin flip / Who goes first?" during the flip, "Waiting for
Ben to arrive" until the rival connects, "Ben is away. The clock plays for
them" after; the e2e fixed and tightened (the countdown and the ready chip are
checked); the bomb button stays put all game (disabled, "Bomb used"); the bar
runs between the lit discs, never over them, and the result shows only the line;
a 160 ms hit-stop and a deeper squash and rattle for the winning disc, 150 ms a
lit disc; empty updates collapse in the queue and the coin label holds 900 ms;
Medium misses one threat in five for real and now and then bombs to clear two
of your discs, Hard bombs when a blast clearly helps (and checks your bomb from
your third disc, not your second); the call on your turn is an outline only;
holes lighter (#1c2240) and the frame a step darker; the keyboard hint is a
one-time toast; the board sits low by the dock; the last-move pip quiets after
1.5 s; the stamp says only FOUR (the call says who); result tiles Discs, Longest
line and Bomb, the line's direction in the subtitle; the How to play diagrams
cut at cell edges; "Forfeit match"; the rival's disc falls without ticks, the
land clack softer, a sine win (still the loudest) and a falling lose, a shorter
haptic for a loss; a timeout is announced as one.
