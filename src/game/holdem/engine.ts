/**
 * No-Limit Texas Hold'em Sit & Go engine.
 *
 * Rules (standard NLHE, tournament style):
 *  - 2–6 players, equal starting stacks. The button moves to the next player
 *    still in the game each hand; the two players after it post the blinds.
 *    Heads-up the button posts the small blind and acts first preflop, last
 *    after the flop. A player who can't cover a blind posts what they have,
 *    all-in. (Simple moving button: no dead-button rule when players bust.)
 *  - Preflop the amount to call is the full big blind even if the big blind
 *    posted short. The minimum bet is the big blind; a raise must be at least
 *    the last full bet/raise on the street. An all-in for less is allowed, but
 *    if it (alone or with other short all-ins) adds up to less than a full
 *    raise, it doesn't reopen the betting: players who already acted may only
 *    call or fold (see `SeatState.actedAt`).
 *  - Chips no one else can match are returned (uncalled bets). Side pots are
 *    built from each player's total contribution; folded players' chips stay
 *    in the pots they contributed to, but they can't win them.
 *  - If everyone but one folds, that player wins without showing. If everyone
 *    still in is all-in (or all but one, who has matched the biggest bet), the
 *    board runs out automatically. At showdown every remaining player reveals,
 *    starting with the river's last aggressor (else the first player left of
 *    the button). Split pots give odd chips to the first winner(s) left of the
 *    button.
 *  - A player with no chips after a hand is out. Players busting on the same
 *    hand are placed by their stacks at the start of it (bigger = better),
 *    then by seat order (lower seat = better). The game ends when one player
 *    has every chip.
 *
 * Pure and synchronous: the room layer calls `startHand`, `act` and
 * `timeoutAction`, and sends each player `viewFor(id)` plus the returned events
 * passed through `redactEvents`. Timers and delays between hands are the room's.
 */
import type {
  ActResult,
  ActRejection,
  Action,
  ActionKind,
  BlindLevel,
  Card,
  HoldemConfig,
  HoldemEvent,
  HoldemState,
  HoldemView,
  LegalActions,
  Phase,
  Pot,
  PotWinner,
  RandomSource,
  RejectReason,
  Reveal,
  SeatState,
  SeatView,
  Standing,
  Street,
} from "./types.js";
import { DEFAULT_BLINDS, MAX_PLAYERS, MIN_PLAYERS } from "./types.js";
import { cardToString, cryptoRandom, newDeck, shuffle } from "./cards.js";
import { evaluate } from "./evaluator.js";

const NO_ACTIONS: LegalActions = { canFold: false, canCheck: false, call: 0, canRaise: false, minRaiseTo: 0, maxRaiseTo: 0 };
const NEXT_STREET: Partial<Record<Phase, { street: Street; cards: number }>> = {
  preflop: { street: "flop", cards: 3 },
  flop: { street: "turn", cards: 1 },
  turn: { street: "river", cards: 1 },
};

/** The blinds at a 0-based level: the schedule, then doubling its last level. */
export function blindsAt(schedule: readonly BlindLevel[], levelIndex: number): BlindLevel {
  if (levelIndex < schedule.length) return schedule[levelIndex]!;
  const last = schedule[schedule.length - 1]!;
  const factor = 2 ** (levelIndex - schedule.length + 1);
  return { sb: last.sb * factor, bb: last.bb * factor };
}

/**
 * Pots from contributions. Each distinct contribution level of a player still
 * in the hand closes a pot: it holds everyone's chips up to that level (folded
 * players' included) and is won among the live players who reached it. Chips
 * above the top live level (only possible from folded players) join the last pot.
 */
export function buildPots(entries: readonly { readonly id: string; readonly amount: number; readonly live: boolean }[]): Pot[] {
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  if (total === 0) return [];
  const levels = [...new Set(entries.filter((e) => e.live && e.amount > 0).map((e) => e.amount))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: string[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const e of entries) amount += Math.min(e.amount, level) - Math.min(e.amount, prev);
    pots.push({ amount, eligible: entries.filter((e) => e.live && e.amount >= level).map((e) => e.id) });
    prev = level;
  }
  const leftover = entries.reduce((sum, e) => sum + Math.max(0, e.amount - prev), 0);
  if (leftover > 0) {
    const last = pots[pots.length - 1];
    if (last) last.amount += leftover;
    else pots.push({ amount: leftover, eligible: entries.filter((e) => e.live).map((e) => e.id) });
  }
  return pots;
}

/**
 * The events as `viewer` may see them (null = spectator): everyone else's
 * hole cards are blanked from `holeDealt`. Showdown reveals are public.
 */
export function redactEvents(events: readonly HoldemEvent[], viewer: string | null): HoldemEvent[] {
  return events.map((e) =>
    e.type === "holeDealt" ? { ...e, hands: e.hands.map((h) => ({ id: h.id, cards: h.id === viewer ? h.cards : null })) } : e,
  );
}

function reject(reason: RejectReason): ActRejection {
  return { ok: false, reason };
}

export class HoldemGame {
  readonly state: HoldemState;
  /** Chips in the game: players × starting stack, forever (see `chipsTotal`). */
  readonly totalChips: number;
  private readonly random: RandomSource;
  private readonly schedule: readonly BlindLevel[];
  private readonly blindsEvery: number;
  private readonly firstButton: number;
  private readonly deckFor: ((handNo: number) => readonly Card[]) | undefined;
  private deck: Card[] = [];
  private deckPos = 0;
  private log: HoldemEvent[] = [];

  constructor(config: HoldemConfig) {
    const n = config.players.length;
    if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new RangeError(`need ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
    if (new Set(config.players.map((p) => p.id)).size !== n) throw new Error("player ids must be unique");
    if (!Number.isInteger(config.startingChips) || config.startingChips <= 0) throw new RangeError("startingChips must be a positive integer");
    this.schedule = config.blinds ?? DEFAULT_BLINDS;
    if (this.schedule.length === 0) throw new RangeError("blind schedule is empty");
    for (const l of this.schedule) {
      if (!Number.isInteger(l.sb) || !Number.isInteger(l.bb) || l.sb <= 0 || l.bb < l.sb) throw new RangeError("bad blind level");
    }
    this.blindsEvery = config.blindsEveryHands ?? 10;
    if (!Number.isInteger(this.blindsEvery) || this.blindsEvery < 0) throw new RangeError("blindsEveryHands must be ≥ 0");
    this.random = config.random ?? cryptoRandom;
    this.deckFor = config.deckFor;
    const fb = config.firstButton ?? Math.floor(this.random() * n);
    if (!Number.isInteger(fb) || fb < 0 || fb >= n) throw new RangeError("firstButton out of range");
    this.firstButton = fb;
    this.totalChips = n * config.startingChips;

    const seats: SeatState[] = config.players.map((p, seat) => ({
      id: p.id,
      name: p.name,
      bot: p.bot ?? false,
      seat,
      stack: config.startingChips,
      bet: 0,
      committed: 0,
      startStack: config.startingChips,
      hole: [],
      inHand: false,
      folded: false,
      allIn: false,
      acted: false,
      actedAt: 0,
      revealed: false,
      place: null,
    }));
    this.state = {
      phase: "handOver",
      handNo: 0,
      levelIndex: 0,
      button: -1,
      sbSeat: -1,
      bbSeat: -1,
      board: [],
      currentBet: 0,
      minRaise: 0,
      streetRaises: 0,
      toAct: -1,
      lastAggressor: -1,
      seats,
    };
  }

  // ---------------------------------------------------------------- queries

  get phase(): Phase {
    return this.state.phase;
  }

  /** Whose turn it is, or null. */
  get toActId(): string | null {
    return this.state.toAct >= 0 ? this.state.seats[this.state.toAct]!.id : null;
  }

  /** Every event of the current (or just finished) hand, unredacted. */
  get handEvents(): readonly HoldemEvent[] {
    return this.log;
  }

  get blinds(): BlindLevel {
    return blindsAt(this.schedule, this.state.levelIndex);
  }

  /** Sum of stacks plus every chip in the middle. Always equals `totalChips`. */
  chipsTotal(): number {
    let sum = 0;
    for (const s of this.state.seats) sum += s.stack + s.committed;
    return sum;
  }

  /** The seat for an id or seat index, or null. */
  seat(seatOrId: number | string): SeatState | null {
    const seats = this.state.seats;
    if (typeof seatOrId === "number") return seats[seatOrId] ?? null;
    return seats.find((s) => s.id === seatOrId) ?? null;
  }

  /** What the player may do now. All false/0 unless it's their turn. */
  legal(seatOrId: number | string): LegalActions {
    const p = this.seat(seatOrId);
    const s = this.state;
    if (!p || p.seat !== s.toAct || !this.inBetting()) return NO_ACTIONS;
    const target = this.callTarget(p);
    const toCall = Math.max(0, target - p.bet);
    const allInTo = p.bet + p.stack;
    const reopened = !p.acted || s.currentBet - p.actedAt >= s.minRaise;
    const canRaise = reopened && allInTo > target && this.othersCanAct(p);
    return {
      canFold: true,
      canCheck: toCall === 0,
      call: Math.min(toCall, p.stack),
      canRaise,
      minRaiseTo: canRaise ? Math.min(s.currentBet + s.minRaise, allInTo) : 0,
      maxRaiseTo: canRaise ? allInTo : 0,
    };
  }

  /**
   * The table as `viewer` sees it (null = spectator). Hole cards show only to
   * their owner, and to everyone once revealed at showdown.
   */
  viewFor(viewer: string | null): HoldemView {
    const s = this.state;
    const me = viewer === null ? null : this.seat(viewer);
    const { sb, bb } = this.blinds;
    const seats: SeatView[] = s.seats.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      bot: p.bot,
      stack: p.stack,
      bet: p.bet,
      inHand: p.inHand,
      folded: p.folded,
      allIn: p.allIn,
      busted: p.place !== null && p.stack === 0,
      place: p.place,
      cards: p.hole.length > 0 && (p === me || p.revealed) ? [...p.hole] : null,
      hasCards: p.inHand && !p.folded && p.hole.length > 0,
    }));
    const pots = buildPots(s.seats.map((p) => ({ id: p.id, amount: p.committed - p.bet, live: p.inHand && !p.folded })));
    return {
      you: me ? me.id : null,
      phase: s.phase,
      handNo: s.handNo,
      level: s.levelIndex + 1,
      sb,
      bb,
      nextLevelAtHand: this.blindsEvery > 0 ? (Math.floor(Math.max(s.handNo - 1, 0) / this.blindsEvery) + 1) * this.blindsEvery + 1 : null,
      button: s.button >= 0 ? s.seats[s.button]!.id : null,
      toActId: this.toActId,
      board: [...s.board],
      pots,
      totalPot: s.seats.reduce((sum, p) => sum + p.committed, 0),
      currentBet: s.currentBet,
      seats,
      legal: me && me.seat === s.toAct ? this.legal(me.seat) : null,
    };
  }

  /** Everyone, still-playing players first (by chips), then the busted by place. */
  standings(): Standing[] {
    return [...this.state.seats]
      .sort((a, b) => {
        if (a.place === null && b.place === null) return b.stack - a.stack || a.seat - b.seat;
        if (a.place === null) return -1;
        if (b.place === null) return 1;
        return a.place - b.place;
      })
      .map((p) => ({ id: p.id, name: p.name, place: p.place, chips: p.stack }));
  }

  // ---------------------------------------------------------------- commands

  /** Deals the next hand (only between hands). */
  startHand(): ActResult | ActRejection {
    const s = this.state;
    if (s.phase === "gameOver") return reject("game over");
    if (s.phase !== "handOver") return reject("hand in progress");
    const events: HoldemEvent[] = [];
    s.handNo++;

    const level = this.blindsEvery > 0 ? Math.floor((s.handNo - 1) / this.blindsEvery) : 0;
    if (level > s.levelIndex) {
      s.levelIndex = level;
      const { sb, bb } = this.blinds;
      events.push({ type: "blindsUp", level: level + 1, sb, bb });
    }
    const { sb, bb } = this.blinds;

    for (const p of s.seats) {
      const alive = p.place === null;
      p.inHand = alive;
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
      p.committed = 0;
      p.startStack = p.stack;
      p.hole = [];
      p.acted = false;
      p.actedAt = 0;
      p.revealed = false;
    }
    s.board = [];
    s.button = s.handNo === 1 && s.seats[this.firstButton]!.place === null ? this.firstButton : this.nextInHand(s.button < 0 ? this.firstButton : s.button);
    const headsUp = s.seats.filter((p) => p.inHand).length === 2;
    s.sbSeat = headsUp ? s.button : this.nextInHand(s.button);
    s.bbSeat = this.nextInHand(s.sbSeat);
    events.push({
      type: "handStart",
      handNo: s.handNo,
      button: s.seats[s.button]!.id,
      level: s.levelIndex + 1,
      sb,
      bb,
      stacks: s.seats.filter((p) => p.inHand).map((p) => ({ id: p.id, chips: p.stack })),
    });

    this.deck = this.deckFor ? this.checkedDeck(this.deckFor(s.handNo)) : shuffle(newDeck(), this.random);
    this.deckPos = 0;

    const sbSeat = s.seats[s.sbSeat]!;
    const bbSeat = s.seats[s.bbSeat]!;
    const sbAmount = this.put(sbSeat, Math.min(sb, sbSeat.stack));
    const bbAmount = this.put(bbSeat, Math.min(bb, bbSeat.stack));
    events.push({
      type: "blindsPosted",
      posts: [
        { id: sbSeat.id, kind: "sb", amount: sbAmount, allIn: sbSeat.allIn },
        { id: bbSeat.id, kind: "bb", amount: bbAmount, allIn: bbSeat.allIn },
      ],
    });
    s.currentBet = bb;
    s.minRaise = bb;
    s.streetRaises = 0;
    s.lastAggressor = -1;

    // Deal one card at a time, starting left of the button.
    const order: SeatState[] = [];
    for (let i = 0, at = s.button; i < s.seats.length; i++) {
      at = (at + 1) % s.seats.length;
      if (s.seats[at]!.inHand) order.push(s.seats[at]!);
    }
    for (let round = 0; round < 2; round++) for (const p of order) p.hole.push(this.draw());
    events.push({ type: "holeDealt", hands: order.map((p) => ({ id: p.id, cards: [...p.hole] })) });

    s.phase = "preflop";
    // Preflop action starts left of the big blind (heads-up that's the button).
    this.proceed(events, s.bbSeat);
    this.log = [...events];
    return { ok: true, events };
  }

  /** Applies a player's action. */
  act(id: string, action: Action): ActResult | ActRejection {
    return this.apply(id, action, false);
  }

  /** The action for a player whose clock ran out: check if they can, else fold. */
  timeoutAction(id: string): ActResult | ActRejection {
    const legal = this.legal(id);
    return this.apply(id, legal.canCheck ? { type: "check" } : { type: "fold" }, true);
  }

  // ---------------------------------------------------------------- betting

  private apply(id: string, action: Action, timedOut: boolean): ActResult | ActRejection {
    const s = this.state;
    if (s.phase === "gameOver") return reject("game over");
    if (!this.inBetting()) return reject("no hand in progress");
    const p = this.seat(id);
    if (!p) return reject("unknown player");
    if (p.seat !== s.toAct) return reject("not your turn");
    const legal = this.legal(p.seat);

    let kind: ActionKind;
    let amount = 0;
    switch (action.type) {
      case "fold":
        kind = "fold";
        p.folded = true;
        break;
      case "check":
        if (!legal.canCheck) return reject("cannot check facing a bet");
        kind = "check";
        break;
      case "call":
        // Calling with nothing to call is read as a check (a harmless race on the client).
        kind = legal.call === 0 ? "check" : "call";
        amount = this.put(p, legal.call);
        break;
      case "raise":
      case "allIn": {
        const allInTo = p.bet + p.stack;
        if (action.type === "allIn" && p.stack <= legal.call) {
          kind = "call";
          amount = this.put(p, p.stack);
          break;
        }
        if (!legal.canRaise) return reject("raise not allowed");
        const to = action.type === "allIn" ? allInTo : action.to;
        if (!Number.isInteger(to)) return reject("invalid amount");
        if (to > allInTo) return reject("raise above stack");
        if (to < legal.minRaiseTo) return reject("raise below minimum");
        kind = s.currentBet === 0 ? "bet" : "raise";
        amount = this.put(p, to - p.bet);
        // A full raise sets the new minimum; a short all-in raises the price
        // without changing it (and, via actedAt, without reopening the betting).
        if (to - s.currentBet >= s.minRaise) s.minRaise = to - s.currentBet;
        s.currentBet = to;
        s.streetRaises++;
        s.lastAggressor = p.seat;
        break;
      }
      default:
        return reject("unknown action");
    }
    p.acted = true;
    p.actedAt = s.currentBet;
    const events: HoldemEvent[] = [{ type: "action", id: p.id, action: kind, amount, toTotal: p.bet, allIn: p.allIn, timedOut }];
    this.proceed(events, p.seat);
    this.log.push(...events);
    return { ok: true, events };
  }

  private inBetting(): boolean {
    const ph = this.state.phase;
    return ph === "preflop" || ph === "flop" || ph === "turn" || ph === "river";
  }

  /** Moves chips from a stack into the player's bet. */
  private put(p: SeatState, chips: number): number {
    const n = Math.min(chips, p.stack);
    p.stack -= n;
    p.bet += n;
    p.committed += n;
    if (p.stack === 0) p.allIn = true;
    return n;
  }

  /** Someone else still in the hand can still bet. */
  private othersCanAct(p: SeatState): boolean {
    return this.state.seats.some((o) => o !== p && o.inHand && !o.folded && !o.allIn);
  }

  /**
   * What `p` must bring their bet up to. Normally the street's current bet;
   * when everyone else still in is all-in, only as much as the biggest of
   * their bets, since nobody could match more.
   */
  private callTarget(p: SeatState): number {
    const s = this.state;
    if (this.othersCanAct(p)) return s.currentBet;
    let most = 0;
    for (const o of s.seats) if (o !== p && o.inHand && !o.folded) most = Math.max(most, o.bet);
    return Math.min(s.currentBet, most);
  }

  private needsToAct(p: SeatState): boolean {
    if (!p.inHand || p.folded || p.allIn) return false;
    if (!this.othersCanAct(p)) return p.bet < this.callTarget(p);
    return !p.acted || p.bet < this.state.currentBet;
  }

  /** The next seat after `after` (exclusive) that must act, or -1 if the round is over. */
  private nextToAct(after: number): number {
    const seats = this.state.seats;
    for (let i = 1; i <= seats.length; i++) {
      const p = seats[(after + i) % seats.length]!;
      if (this.needsToAct(p)) return p.seat;
    }
    return -1;
  }

  /** The next seat after `seat` still in the game (dealt into this hand). */
  private nextInHand(seat: number): number {
    const seats = this.state.seats;
    for (let i = 1; i <= seats.length; i++) {
      const p = seats[(seat + i) % seats.length]!;
      if (p.inHand) return p.seat;
    }
    throw new Error("no players in hand");
  }

  /**
   * After an action by `after`: pass the turn, or close the street — dealing
   * the next one (and running the board out while nobody can bet) — or end
   * the hand.
   */
  private proceed(events: HoldemEvent[], after: number): void {
    const s = this.state;
    for (;;) {
      if (s.seats.filter((p) => p.inHand && !p.folded).length === 1) {
        this.finishHand(events, false);
        return;
      }
      const next = this.nextToAct(after);
      if (next >= 0) {
        s.toAct = next;
        return;
      }
      s.toAct = -1;
      this.returnUncalled(events);
      const step = NEXT_STREET[s.phase];
      if (!step) {
        this.finishHand(events, true);
        return;
      }
      for (const p of s.seats) {
        p.bet = 0;
        p.acted = false;
        p.actedAt = 0;
      }
      s.currentBet = 0;
      s.minRaise = this.blinds.bb;
      s.streetRaises = 0;
      s.lastAggressor = -1;
      this.draw(); // burn
      const cards: Card[] = [];
      for (let i = 0; i < step.cards; i++) cards.push(this.draw());
      s.board.push(...cards);
      s.phase = step.street;
      events.push({ type: "street", name: step.street, cards, board: [...s.board] });
      // After the flop the first player left of the button acts first.
      after = s.button;
    }
  }

  /**
   * Gives back the part of the biggest contribution nobody matched (a bet
   * everyone folded to, or an all-in bigger than every caller's stack).
   */
  private returnUncalled(events: HoldemEvent[]): void {
    const seats = this.state.seats;
    let top: SeatState | null = null;
    let second = 0;
    for (const p of seats) {
      if (!top || p.committed > top.committed) {
        if (top) second = Math.max(second, top.committed);
        top = p;
      } else second = Math.max(second, p.committed);
    }
    if (!top || top.committed <= second) return;
    const amount = top.committed - second;
    top.committed -= amount;
    top.bet = Math.max(0, top.bet - amount);
    top.stack += amount;
    top.allIn = top.stack === 0;
    events.push({ type: "betReturned", id: top.id, amount });
  }

  // ---------------------------------------------------------------- hand end

  private finishHand(events: HoldemEvent[], showdown: boolean): void {
    const s = this.state;
    s.toAct = -1;
    this.returnUncalled(events);
    s.phase = "showdown";
    const n = s.seats.length;
    // Seats in order starting left of the button: reveal order, odd chips.
    const fromButton = (seat: number) => (seat - s.button - 1 + n) % n;
    const live = s.seats.filter((p) => p.inHand && !p.folded);

    const scores = new Map<string, { score: number; name: string }>();
    if (showdown && live.length > 1) {
      const leftOfButton = [...live].sort((a, b) => fromButton(a.seat) - fromButton(b.seat));
      const firstIdx = Math.max(0, leftOfButton.findIndex((p) => p.seat === s.lastAggressor));
      const order = [...leftOfButton.slice(firstIdx), ...leftOfButton.slice(0, firstIdx)];
      const reveals: Reveal[] = [];
      for (const p of order) {
        const hand = evaluate([...p.hole, ...s.board]);
        p.revealed = true;
        scores.set(p.id, { score: hand.score, name: hand.name });
        reveals.push({ id: p.id, cards: [...p.hole], handName: hand.name });
      }
      events.push({ type: "showdown", reveals });
    }

    const pots = buildPots(s.seats.map((p) => ({ id: p.id, amount: p.committed, live: p.inHand && !p.folded })));
    pots.forEach((pot, potIndex) => {
      const contenders = pot.eligible.map((id) => this.seat(id)!);
      let winners: SeatState[];
      if (contenders.length === 1) winners = contenders;
      else {
        const best = Math.max(...contenders.map((p) => scores.get(p.id)!.score));
        winners = contenders.filter((p) => scores.get(p.id)!.score === best);
      }
      winners.sort((a, b) => fromButton(a.seat) - fromButton(b.seat));
      const share = Math.floor(pot.amount / winners.length);
      let odd = pot.amount - share * winners.length;
      const paid: PotWinner[] = winners.map((p) => {
        const won = share + (odd > 0 ? 1 : 0);
        if (odd > 0) odd--;
        p.stack += won;
        return { id: p.id, amount: won, handName: scores.get(p.id)?.name ?? null };
      });
      events.push({ type: "potAwarded", potIndex, amount: pot.amount, winners: paid });
    });
    for (const p of s.seats) {
      p.committed = 0;
      p.bet = 0;
    }

    // Eliminations: best start-of-hand stack takes the better place, then lower seat.
    const aliveBefore = s.seats.filter((p) => p.place === null).length;
    const busted = s.seats
      .filter((p) => p.inHand && p.place === null && p.stack === 0)
      .sort((a, b) => b.startStack - a.startStack || a.seat - b.seat);
    busted.forEach((p, i) => (p.place = aliveBefore - busted.length + 1 + i));
    for (const p of [...busted].reverse()) events.push({ type: "eliminated", id: p.id, place: p.place! });

    const alive = s.seats.filter((p) => p.place === null);
    if (alive.length === 1) {
      alive[0]!.place = 1;
      s.phase = "gameOver";
      events.push({ type: "gameOver", standings: this.standings() });
    } else s.phase = "handOver";
  }

  // ---------------------------------------------------------------- deck

  private draw(): Card {
    const c = this.deck[this.deckPos++];
    if (!c) throw new Error("deck exhausted");
    return c;
  }

  private checkedDeck(cards: readonly Card[]): Card[] {
    const seen = new Set(cards.map(cardToString));
    if (cards.length !== 52 || seen.size !== 52) throw new Error("deckFor must return 52 distinct cards");
    return [...cards];
  }
}
