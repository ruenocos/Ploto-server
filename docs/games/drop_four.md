# Drop Four

**One line:** take turns dropping discs into a 7×6 grid; four in a row wins. Each
player has one bomb per game.

**Mood:** punchy and playful. Fast turns (a move is one tap), weighty drops, a
loud finish. **Signature moment:** the drop and the winning line: discs fall
with gravity and bounce into place; when four line up, the line lights up disc
by disc and the other discs shake loose.

## Rules in plain words

1. The grid has 7 columns and 6 rows. Tap a column to drop your disc: it falls
   to the lowest free spot.
2. Four of your discs in a row (across, down or diagonal) wins.
3. **Your bomb** (one per game, if the host leaves bombs on): drop it instead of
   a disc. It lands, then blows up: it clears itself and the discs right next to
   it on the left, the right and below. Discs above fall down to fill the gap.
   If the fall makes four in a row for the bomber, the bomber wins; if it makes
   four only for the other player, they win.
4. A full grid with no four in a row is a draw.
5. A coin flip picks who drops first; in a rematch the loser starts (after a
   draw, whoever went second).

## Seats and settings

- 1v1. Quick play (a bot takes the seat if nobody comes in 20 s), play a friend
  (code or invite; whoever comes first plays), practice against a bot (its own
  setup screen).
- Host settings: **Bombs** (On / Off), **Turn timer** (On: 15 s a move / Off),
  **Bot difficulty** (Medium / Hard).
- Practice setup: Bombs, Bot difficulty.
- A clock that runs out drops in a random column for you.

## Art (code-drawn pixel art)

A blue grid frame with round holes and a lit top edge; two disc colours from
Ploto's palette (gold and coral) with a highlight pixel and an ink outline; the
bomb, a dark disc with a fuse and a spark; a column hover arrow; the blast
frames; the winning line's glow-free light-up (each disc flashes cream, one
after another); dust when a disc lands. The launcher card: a disc mid-fall above
a column (the star), the grid with a few discs (the pieces), the bomb with its
spark (the interface only this game has).

## Sounds

drop (per row fallen, pitched by height), land, bomb, blast, line (one note per
lit disc, rising), win, lose, draw, tick, timeout.

## Out of scope for v1

Other grid sizes, pop-out rules, more than one bomb, 3+ players.

## Decisions made overnight (each can be reversed)

1. **One bomb per player per game**, on by default: the twist that makes a
   losing position worth playing on.
2. **Bomb outcome rule**: after the fall, the bomber wins if they have four;
   otherwise the other player wins if they have four.
3. **15 s a move** with the timer on (a move is one tap).
4. **The loser starts the rematch** (after a draw, whoever went second), as in
   Sea Battle: the first move is worth a lot in this game, so it goes to the
   player who needs it.
5. **Medium is the default bot.**
6. **Bot bands** (simulated against stand-ins built on the same search: a good
   player reads 4 moves ahead and rarely slips, a casual one reads 1): a good
   player beats Medium about 58% of the time, a casual player about 45%; Hard
   beats a good player about 3 games in 4. Hard thinks in about 15 ms (a node
   budget, so it's the same on every machine); the room adds human think time.
7. **No column confirm:** a tap drops (columns are 35–50 px wide on phones, the
   full height of the grid), as in every Drop Four game people know.
8. **Profile tile:** Games, and Longest line.
