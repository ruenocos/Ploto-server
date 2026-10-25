# Wild Eights

**One line:** the shedding card game for 2–4: match the top card by suit or
number, and be the first to empty your hand. Eights are wild.

**Mood:** cozy and a little chaotic: a card table with friends, quick turns,
small surprises (a 2 lands on you, a Jack skips you, an 8 changes everything).
**Signature moment:** the wild eight. The card slams down, the table's colour
floods to the suit you name and a ring of that suit's pips bursts out from the
pile; the next player feels it.

## Rules in plain words

1. Each player gets 7 cards (2 players) or 6 (3–4). One card starts the pile.
2. On your turn, play a card that matches the top card's suit or number.
3. **8s are wild:** play one on anything and name the next suit.
4. **2s:** the next player draws two, unless they answer with a 2 of their own:
   then the next one draws four, and so on.
5. **Jacks:** the next player is skipped.
6. Can't (or won't) play? Draw one. If it fits you may play it right away;
   otherwise your turn ends.
7. Down to one card, everyone sees it (Last card). Empty your hand to win.
   Everyone else is placed by what's left in their hand: 8s count 50, faces 10,
   aces 1, the rest their number.

## Seats and settings

- 2–4 players. Quick play (bots fill empty seats if nobody comes in 20 s), play
  friends (code or invite; the host starts), practice against bots (its own
  setup screen: how many bots, how hard).
- Host settings: **Seats** (2, 3, 4), **Fill empty seats with bots**, **Turn
  timer** (On: 20 s a turn / Off), **Bot difficulty** (Medium / Hard).
- A clock that runs out plays for you: the first card that fits (keeping 8s),
  or a draw.
- Leaving mid-game: with two players it's a forfeit; with more, the clock plays
  your turns and the game goes on.

## Art (code-drawn pixel art)

A felt table (a deep green of its own, with a pixel weave), cards drawn at a
whole scale with ink outlines and big readable pips; suit colours from Ploto's
palette (spades and clubs ink, hearts and diamonds red) plus a suit flood colour
for the table edge; card backs in the game's accent. The pile, the draw deck,
your fanned hand at the bottom, rivals' fans around the table. The launcher
card: an 8 mid-slam over the pile (the star), a fan of cards (what you play
with), the suit picker (the interface only it has).

## Sounds

deal, play (card slap), wild (the eight: a bigger slap and a rising swirl as the
table changes colour), suit (each suit a different note), draw, owe (a 2 lands
on you), skip, last (last card), turn, tick, timeout, win, lose.

## Out of scope for v1

Reverse cards, multi-round scoring to a target, 5–6 players, house-rule toggles.

## Decisions made overnight (each can be reversed)

1. **The rule set:** 8 wild, 2 draw-two (stacking), Jack skip; no reverse (it does
   nothing in two-player games and confuses the order on a phone).
2. **One round per game**, placed by points left: a game is about 3–5 minutes;
   a rematch is one tap.
3. **Draw one, then play it or pass** (not draw until you can play): turns stay
   short and drawing is a choice, not a punishment loop.
4. **The first card up is never an 8, 2 or Jack** (nobody named a suit; nobody
   owes before the first turn).
5. **Public information:** when a player draws instead of playing, everyone saw
   they couldn't follow the suit; the bots (and the page, for screen readers)
   use it. Hidden hands are never sent to anyone else.
6. **Bots:** Medium plays any card that fits, sometimes an 8 too early, and keeps
   a drawn card a fifth of the time; Hard holds 8s back, saves 2s and jacks for
   when the next player is close to going out, sheds its dearest cards when
   someone is down to their last ones, and steers the suit towards one the next
   player has shown they lack. Luck is a big part of this game (bots.txt in each
   round has the numbers): in two-player games Hard beats a casual player about
   3 in 5 and Medium about 11 in 20; with four players Hard wins about 31%
   against a 25% fair share. Pushing Hard further barely moved these, so it was
   left there.
7. **Ploto's deck:** the cards are Hold'em's faces (the same glyphs and court
   portraits), so a card reads the same in every Ploto card game; Wild Eights
   adds a gold frame inside every eight (wild).
8. **The rim's colour belongs to an eight:** after a wild eight the table's rim
   takes the named suit's colour (spades cyan-grey, hearts red, diamonds
   orange, clubs green) and keeps it while that suit is in force; the next
   plain card lets it go.
9. **Leaving a 3–4 player game:** you're placed last, the clock passes your
   turns (no draws, no plays) and the others play on (a forfeit with two players ends the game).
10. **A draw by choice marks nothing:** only a draw with nothing to play shows
    the table you're out of a suit (bots use it; so can people).
11. **Profile tile:** Games, and Most eights in a game.

12. **Six cards at 3–4 players** (was five; changed after round 6, your call,
    25 October): turns where nothing fits drop from about 28–30% to 25–27%, and
    a game runs about four turns longer (37–42 turns). To go back, revert the
    commit "Wild Eights: six cards at 3-4 players".