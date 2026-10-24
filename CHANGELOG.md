# Changelog

## 1.0.0

The first full version of Ploto: a launcher with two games on one shared platform.

**Ploto (the platform)**
- Launcher at `/play`: Games, Friends, Profile; chat, presence, invites to any game,
  Continue back into your room, launcher cards drawn to one rule.
- Accounts with unique usernames (or play as a guest), friends, DMs, settings
  (sound, vibration, text size, motion) shared by every page.
- The game kit: one lobby for every game (quick play, host with settings, join by
  code, invite friends into seats, practice with bots, rematches), plus the
  standard screens around a game (in-game menu, How to play, result and rematch).
- The motion kit on Animate.css (poses, play queue, home banners, count-ups) and a
  sound set per game.
- Making a game: `node scripts/new-game.mjs`, docs/NEW_GAME.md and the `new-game`
  skill (questionnaire, brief, scaffold, build, feel pass, ship).
- Browser tests for every game (`npm run e2e`), with screenshots and diffs.

**Match Monsters**
- Server-authoritative match-3 battles, 1v1: 20 monsters with evolutions, pick,
  draft or random teams, prism gems, statuses, bots; pixel art throughout.

**Hold'em**
- No-Limit Texas Hold'em Sit & Go for 2–6 players, play chips only: timers and time
  banks, rising blinds, side pots, sitting out.
- Bots that play short-handed ranges, Medium or Hard; practice with its own setup.

**Server**
- Status endpoint, matchmaking, protoo signaling, SQLite storage, match history and
  stats, Helm chart with Gateway API and cert-manager.
