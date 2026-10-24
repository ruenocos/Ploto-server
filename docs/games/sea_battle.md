# Sea Battle: brief

**One line:** hide your fleet, take turns firing at your rival's sea; a hit fires
again; sink the whole fleet first.

**Mood:** tense and punchy. Short turns, a beat of suspense before every impact,
big hits. **Signature moment:** the sink.

## Rules in plain words

1. Each player has a sea (10×10, or 8×8 on a quick board) and a fleet.
   Classic: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2.
   Quick: Battleship 4, Cruiser 3, Submarine 3, Destroyer 2.
2. **Place your fleet.** It starts placed at random: move a ship by tapping it
   and then a cell, turn it with Rotate, or Shuffle the lot. Ships can't touch,
   not even at the corners. Tap Ready.
3. A coin flip decides who fires first.
4. **Fire** at a cell of your rival's sea: a miss is a splash and the turn
   passes; a **hit** fires again; when every cell of a ship is hit it's
   **sunk**: the ship shows, and the water around it is marked (nothing can be
   there), and you fire again.
5. Sink the whole fleet to win.

## Seats and settings

- 1v1. Quick play (a bot takes the other seat if nobody comes in 20 s), host a
  game for a friend (code or invite; whoever comes first plays), practice
  against a bot (its own setup screen, like Hold'em's).
- Host settings: **Board** (Classic 10×10 / Quick 8×8), **Turn timer** (On: 20 s
  a shot, 60 s to place / Off), **Bot difficulty** (Medium / Hard; used if a bot
  takes the seat).
- Practice setup: Board, Bot difficulty.
- Timer off still has a 30 s clock for a disconnected player, so nobody waits
  forever; when a clock runs out it fires at a random open cell for you.
- Leaving or forfeiting mid-game hands the win to the rival.

## The signature moment: the sink

The last hit lands (a hit-stop beat), the whole ship shows plate by plate, it
cracks with one flash, breaks in two and goes down in stepped bubbles while a
smoke column rises; the sea shakes; a SUNK stamp lands with the ship's name; the
water around it ripples into "nothing here" marks one ring at a time; its icon in
the fleet tracker is crossed out. Bigger ships sink bigger.

Around it: every shot has a crosshair lock and a shell in flight (suspense),
then a splash (miss) or a fire burst that keeps burning (hit). The two seas swap
places when the turn changes: yours comes up big when the rival fires at you.

## Art (code-drawn pixel art, Ploto's grid)

Water tiles with a two-frame stepped swell, grid coordinates (A–J, 1–10), ships
seen from above (grey hull, deck, turrets, one per length), a white ring for a
miss, a burning marker for a hit, a cracked dark hull when sunk, the crosshair,
the shell, splash and fire sprites, smoke puffs. Accent: deep sea teal, signal
red for hits.

**Launcher card:** a battleship hull crossing a corner of the grid (the star),
the sea grid with a splash and a burning hit (the pieces), the crosshair locked
on a cell (the interface only this game has). Backdrop: deep sea teal.
**Home banner:** the same sea; intro: a ship slides in and the crosshair locks;
beat: a shell lands, alternating splash and hit.

## Sounds (sounds.json, its own words)

place, rotate, ready, aim, fire, splash, hit, sunk, win, lose, timeout.

## Out of scope for v1

Salvo mode, special weapons, other fleet layouts, 3+ players, in-game chat.

## Decisions made overnight (the user was asleep; each can be reversed)

1. **Ships can't touch, even diagonally**, and a sunk ship marks the water around
   it. It's the common mobile rule, makes sinks more rewarding (they reveal
   information) and keeps hunting fair.
2. **The fleet starts randomly placed**, so Ready works in one tap; placing by
   hand is optional (tap a ship, tap a cell; Rotate; Shuffle).
3. **Classic fleet 5-4-3-3-2 on 10×10**, plus a Quick 8×8 board (4-3-3-2) for
   shorter games.
4. **A coin flip picks who fires first**, shown before the first shot.
5. **Clocks fire for you** at a random open cell when they run out (instead of
   skipping your turn), so a game always ends.
6. **Quick play waits 20 s for a person, then a bot takes the seat**, like
   Hold'em's quick tables.
7. **Medium is the default bot difficulty**, like Hold'em.
8. **Profile tiles:** Battles, Wins, Best accuracy, Longest streak (hits in a row).
