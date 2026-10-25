# Wild Eights: score rounds

Scored by docs/SCORING.md: two fresh reviewers a round, each category takes the
lower of the two scores; rounds repeat until every category is 9 or more, six
rounds at most. Each reviewer also answers the standing question: does it feel
cluttered, and can we reduce eye strain?

Evidence for each round (screens at 360/390/430 and reduced motion, frame strips
of the deal, plays, a draw, the wild eight, a 2, a jack, the last card and the
win, the sound table, bot bands, tests and the browser suite) is captured by a
script and handed to the reviewers.

## Round 1

| Category | A | B | Round score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 7 | 7 | **7** |
| Animation | 7 | 7 | **7** |
| Sound and haptics | 7 | 7 | **7** |
| Visual design | 6 | 7 | **6** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 6 | 8 | **6** |
| Bots | 7 | 7 | **7** |
| Implementation | 8 | 7 | **7** |
| Accessibility | 7 | 7 | **7** |

Clutter (both): sparse more than cluttered; the strain is a saturated rim that
stayed lit all game after the first eight, a big near-empty felt, gold doing
four jobs, khaki-dimmed cards and about 150 px of empty navy under the hand.

What both saw: the rim's flood never reset (every later suit change recoloured
it) and swapped in one frame; the next player didn't feel the eight; the
wild's slam barely louder than a card; the "owe" sting fired at the forced draw,
not when the 2 landed; rivals' events buzzed your phone; drawn cards appeared
before their backs landed, and yours never turned over; "Last card" flashed on
rivals during the deal; being skipped yourself was a line of small text; a
forfeit in a 3–4 player game ended it for everyone (a bug); the result put its
own standings in the hero ("2NDANN" overlapped); the banner beat every 2.6 s
(STYLE says 3.6–4.2); the launcher card's suit picker sat under the NEW badge;
"or a ace", "or a 8"; Hard barely ahead of Medium.

Fixes built after round 1: leaving or forfeiting a 3–4 player game leaves the
others playing and places you last (a room test checks); the rim's colour
belongs to an eight (a plain card lets it go), filled side by side out from the
pile in stepped frames, with a table thump, a bigger burst and a second ring,
and the next player's seat (or your hand) jolts, outlined in the suit's colour;
the owe sting when the 2 lands, pitched up for every 2 stacked, the +N badge
pops; your own "Skipped" stamp over your hand; drawn cards join the hand when
the last lands, yours turning face up on the way; no "Last card" during the
deal, no suit badge before the starter is face up; only your own events buzz;
a louder, longer wild, a quieter win, a patterned turn buzz, a falling skip;
the hand and dock at the bottom by the thumb, cards bigger (up to 84 px), the
table capped; gold only for eights: what you can play is an accent outline,
what you can't is faded (not khaki); one back and a count per rival, names in
Pixelify in their own case, "Next" on the player after you; the call says
"Your turn" with its hint only when your cards are live; "an ace", "Match
hearts, or play an eight"; a hint when a rival is on one card and you hold a 2
or a jack; the kit's standings on the result (You and Bot tags, points left),
the last card on the felt as the hero; banner every 3.8 s, keeping its place
on a resize; the launcher card's picker bottom left, a lighter shadow; spades'
flood cyan-grey (never the turn's purple); a calmer felt; the deck count only
when low; the pile has a label for screen readers; the picker keeps focus and
returns it; "Leave game" in 3–4 player games; How to play as a short list;
a draw by choice no longer marks a suit as missing; Hard sheds its dearest
cards when someone is close to going out (the bands barely move: luck rules
this game, logged in the brief).

## Round 2

| Category | A | B | Round score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 7 | 7 | **7** |
| Animation | 7 | 7 | **7** |
| Sound and haptics | 7 | 7 | **7** |
| Visual design | 7 | 7 | **7** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 8 | 8 | **8** |
| Bots | 7 | 7 | **7** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 7 | **7** |

Clutter (both): not cluttered, under-filled: a big felt holding two cards, a
dead band above the hand, the deck's saturated checker the loudest thing on the
table, labels scattered (the suit chip, a +2 in the far corner, tags hanging off
the tiles).

What both saw: the hand unsorted; the suit index too small to tell clubs from
spades at hand size; the flood a thin line with no wind-up, and the chip naming
the new suit only after the burst; the banner's card leaving the fan wasn't the
card landing on the pile; deal and draw too quiet, the wild barely louder than
a card, the wild buzzing for every eight at the table; big hands overlapping to
under 44 px; Draw tappable under the picker; pixel 2s and 5s reading as 8 and S;
"Leave game" opening a "Forfeit this match?" sheet; Hard barely ahead of Medium;
the clock counted the animation wait.

Fixes built after round 2: your hand sorted (by suit, colours alternating, ace
to king, eights at the right end); the full suit glyph in every card's index;
the wild: the card rises, then slams (the sound on the impact frame), a 70 ms
hit-stop, the chip names the suit on impact, a 5 px rim filling side by side
over 440 ms while the swirl rises, then a wash of the colour over the felt
(strong, then faint while the suit holds); the next player jellos (its own
pose); only your own eight, or one that lands on you, buzzes; when a 2 lands,
two card backs fly at the victim; the banner plays the card it shows, with the
game's slam, the rest of the fan closing up, an eight in the first beat; two
rows for a big hand so every card keeps a 44 px slice; the picker really modal
(nothing behind it can be tapped) and it reads out your counts; ranks in words
("Match spades or a five"); in two-player games a jack says "goes again"; the
table and the hand sized together (no dead band), cards up to 92 px; a flat card
back with one mark; the suit and the +N together in one plate; rival tiles as a
name and "N cards", with three dots while a bot thinks; "Leave table" and its own
sheet; the clock shows 20 s (the room sends when the turn starts); the plain
"Match …" hint only while you're learning (the chip says it); louder deal and
draw, a louder, longer wild; Medium follows the suit more often and names its
second-best suit now and then (never one it lacks); Hard turns a jack into a
free turn in two-player games and sheds dear cards when anyone is on two.
Bands: Medium beats a casual player about 60%, Hard about 63%, Hard beats
Medium about 54% (luck rules: logged in the brief).

## Round 3

| Category | A | B | Round score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 8 | 8 | **8** |
| Animation | 7 | 8 | **7** |
| Sound and haptics | 8 | 8 | **8** |
| Visual design | 7 | 7 | **7** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 9 | 8 | **8** |
| Bots | 7 | 7 | **7** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 8 | **8** |

Clutter (both): not cluttered; a text-dense HUD over an empty felt, a muddy wash
left over the felt after an eight, the flat purple deck the loudest block.

What both saw: at 1× a pixel 5 reads as an 8 ("8 cards" holding five, "eights
count 80"); the felt wash turned the green olive and stayed; "Last card" covered
the count; "Next" cut names short; the hint clipped at 430; the in-game back flat
while the banner's is a checker; an eight on the pile looked like any card; the
+2 preview flew cards into your hand before you drew them; the banner jumped
between states; focus at the start of a turn could land on the wrong card (the
hand on screen is sorted; the index wasn't); the rim colour lived only in the
page's memory (a reload lost it); Hard barely ahead of Medium.

Fixes built after round 3: card counts in the grid font as bare numbers, numbers
in words in the rules and copy ("Draw two"); no lasting wash: the colour floods
in from the rim as a band that grows and settles, the felt stays green; "Last
card" takes the count's place; a chevron marks the next player (names keep
their room); a shorter hint; the deck's checker back (low contrast); a 2 px gold
frame on an eight on the pile; the deck lifts when a 2 lands (cards travel only
when drawn); a drawn card joins the hand the moment it lands; the banner repaints
only on a resize; focus uses the sorted hand; the rim's colour follows the table
(reloads keep it); a rival's eight flies face down and shows itself as it slams;
the last card gets a slam and a burst, and the winner celebrates; the suits a
player has shown they lack appear as faded pips on their seat; your hand's points
show once a rival is down to two; the picker says its keys and the call says
"Name the suit for your eight"; the focus ring sits outside the "can play" edge;
the deck count always shows (gold under ten); "Points left" replaces the Place
tile; the think dots obey Ploto's Motion setting; a jingle for the win, a soft
sine for the loss, a louder falling skip, a rival's last card a higher note, a
little buzz on the suit; a reshuffle makes a riffle. Bots: Medium plays more
loosely and Hard names a suit the next player lacks with an eight when they're
close; the bands barely move (Medium about 59%, Hard about 62% against a casual
player): this game is mostly luck, as the brief says.

## Round 4

| Category | A | B | Round score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 8 | 8 | **8** |
| Animation | 8 | 8 | **8** |
| Sound and haptics | 8 | 8 | **8** |
| Visual design | 7 | 7 | **7** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 8 | 8 | **8** |
| Bots | 7 | 7 | **7** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 8 | **8** |

Clutter (both): under-filled and in places glaring: a big empty felt, a
saturated purple deck slab, a gold "Skipped" slab over the whole hand, small
low-contrast labels (the deck count, faded void pips).

What both saw: the body font's 2 still read as 8 in the rules, the picker and
the timer hint; a rival's eight landed, then rose and slammed again (a double
landing); the rim filled after the burst, side by side clockwise, not out from
the pile; the jello skewed your whole hand; "Your turn" lingered about a second
after your card left; the banner still jumped once; a forced six took 2.4 s; the
rivals were text tiles, not fans on the table; the void pips unexplained (they
read as "has hearts"); the deck count at 3.9:1; the winner's "Points left 0".

Fixes built after round 4: numbers in words across the copy and the engine's
reasons ("Answer with a two, or draw four"); each rival's cards face down on the
felt in front of them (plays fly from and draws go to them; the one whose turn
it is raised); a rival's eight flies face down to a hover above the pile, then
slams once (no second rise); all four sides of the rim fill at once from their
middles over 200 ms, the band holds, then settles; your cards jolt one after
another (no skew), the call bar outlined in the suit's colour too; a crossed-out
pip for a suit a player lacks, explained in How to play and read out in the
seat's label; "Skipped" and "+2" on a plain panel plate (gold is the eight's);
"Last card" as an accent tag; the deck a size down, a darker checker; the deck
count a bare number on ink in the grid font; the clubs and spades pips full size
on hand cards, and a wider index column; a smaller card in one row before two
rows; "Your turn" clears the moment your card leaves; a big draw goes twice as
fast; the banner repaints only when home appears; "points in hand" from three
cards left, "N points left"; the winner's tile is "Cards drawn"; the result shows
the last card at full size; the pile's label names the suit after an eight;
sounds: a sine win level with the wild, louder deal and draw ticks, a longer
tick and turn chime, a riffle for the reshuffle.

## Round 5

| Category | A | B | Round score |
|---|---|---|---|
| Game design | 8 | 8 | **8** |
| Signature moment | 8 | 8 | **8** |
| Animation | 8 | 8 | **8** |
| Sound and haptics | 8 | 8 | **8** |
| Visual design | 7 | 7 | **7** |
| UX and clarity | 7 | 7 | **7** |
| Platform consistency | 8 | 8 | **8** |
| Bots | 7 | 8 | **7** |
| Implementation | 8 | 8 | **8** |
| Accessibility | 8 | 8 | **8** |

Clutter (both): under-filled; the strain came from a suit-coloured outline left
stuck on the call bar and the hand after an eight (a bug), a thick rim that held
for many turns, the purple deck slab, khaki-dulled cards, and a call bar that
went blank on every animation.

What both saw: the outline the eight puts on the next player and the call bar
never came off (its reset ran on a timer the screen's settle cancelled);
the call bar went blank while your own play, jack or draw animated; the hand
jumped between one and two rows (it was rebuilt each time); the chip blinked
when it popped a second time; "You hold 1"; owe and skip quieter than the turn
chime; keeping a drawn card made no sound.

Fixes built after round 5: outlines and plates end by themselves (Web
Animations and their own timers; the settle also clears any inline outline);
the call bar never goes blank: "Your play: the jack of spades", "Drawing four",
"Eight: hearts named", "A jack: you go again", and "Ben must answer with a two
or draw four" when a 2 lands on a rival; the hand is keyed by card, so cards
slide to new places and between rows, new ones go in at their sorted place;
the chip pops once, on impact; after the flood the rim settles to a thinner,
softer band (full strength only for the moment); a plain plate names the suit
over the next player's seat; "You hold one" (numbers in words); the deck smaller
and darker; the picker's keyboard hint hidden on phones; unplayable cards stay
cream and sit lower (the raised, outlined ones are what you can play); a crossed
pip for a missing suit, bigger, with "no" before it; "Eights out N of 4" under
the deck; a small stack per rival on the felt; louder owe and skip (skip louder
when it's you), a fuller play, a keep blip, darker draw and deal ticks, a louder
win.
