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
