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
