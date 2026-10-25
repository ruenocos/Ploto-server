/**
 * Wild Eights' rules: pure and deterministic (randomness is injected), no timers
 * or sockets. docs/games/wild_eights.md has the rules in plain words.
 *
 * A 52-card deck; 2 players get 7 cards each, 3–4 get 5. On your turn play a card
 * that matches the top of the pile by suit or rank. An 8 is wild: play it on
 * anything and name the next suit. A 2 makes the next player draw two, unless they
 * answer with a 2 of their own (the draws stack). A Jack skips the next player.
 * Can't play? Draw one: if it fits you may play it, otherwise your turn passes.
 * The first to empty their hand wins; the others are placed by what's left in
 * their hands (8s 50, faces 10, aces 1, the rest their number; fewer is better).
 */

export type RandomSource = () => number;
export type Suit = "S" | "H" | "D" | "C";
export const SUITS: readonly Suit[] = ["S", "H", "D", "C"];
/** A card as a short id: rank (A 2–10 J Q K) and suit, e.g. "8H", "10S", "QD". */
export type Card = string;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export const rankOf = (c: Card): string => c.slice(0, -1);
export const suitOf = (c: Card): Suit => c.slice(-1) as Suit;
export const fullDeck = (): Card[] => SUITS.flatMap((s) => RANKS.map((r) => `${r}${s}`));
/** What a card left in hand costs at the end. */
export const points = (c: Card): number => { const r = rankOf(c); return r === "8" ? 50 : r === "A" ? 1 : ["J", "Q", "K"].includes(r) ? 10 : Number(r); };

export type EightsEvent =
  | { readonly type: "deal"; readonly counts: readonly number[]; readonly top: Card; readonly first: number }
  | { readonly type: "play"; readonly by: number; readonly card: Card; readonly suit?: Suit; readonly left: number; readonly auto?: boolean }
  | { readonly type: "draw"; readonly by: number; readonly n: number; readonly cards?: readonly Card[]; readonly forced?: boolean; readonly reshuffled?: boolean }
  | { readonly type: "pass"; readonly by: number }
  | { readonly type: "skip"; readonly seat: number }
  | { readonly type: "lastCard"; readonly seat: number }
  | { readonly type: "turn"; readonly seat: number; readonly owed: number; readonly suit: Suit }
  | { readonly type: "over"; readonly winner: number; readonly hands: readonly (readonly Card[])[]; readonly scores: readonly number[]; readonly forfeit?: boolean };

export type Result = { readonly ok: true; readonly events: readonly EightsEvent[] } | { readonly ok: false; readonly reason: string };

export interface EightsView {
  readonly phase: "playing" | "over";
  readonly you: number;
  readonly hand: readonly Card[];
  readonly counts: readonly number[];
  readonly top: Card;
  /** The suit to follow (an 8's named suit, else the top card's). */
  readonly suit: Suit;
  readonly turn: number | null;
  /** Cards the player to move must draw unless they answer a 2 with a 2. */
  readonly owed: number;
  /** You drew this turn and may play only that card (or pass). */
  readonly drawn: Card | null;
  readonly deckLeft: number;
  readonly winner: number | null;
  readonly forfeit: boolean;
  readonly scores: readonly number[] | null;
  readonly hands: readonly (readonly Card[])[] | null; // everyone's, once it's over
  readonly order: number; // 1 clockwise, -1 not used (no reverse in v1)
  /** Suits each player has shown they're out of (they drew instead of following it; it clears when they play that suit). Public: everyone saw it. */
  readonly voids: readonly (readonly Suit[])[];
  readonly stats: readonly { played: number; drawn: number; eights: number; twos: number }[];
}

export interface GameOptions {
  readonly players: number;
  readonly random: RandomSource;
  /** Who plays first; a random seat when unset. */
  readonly first?: number;
}

export class EightsGame {
  readonly players: number;
  hands: Card[][];
  deck: Card[];
  pile: Card[] = [];
  suit: Suit;
  turn: number | null;
  owed = 0;
  drawn: Card | null = null;
  phase: "playing" | "over" = "playing";
  winner: number | null = null;
  forfeit = false;
  scores: number[] | null = null;
  readonly first: number;
  stats: { played: number; drawn: number; eights: number; twos: number }[];
  voids: Set<Suit>[];
  /** Players who left or forfeited a 3–4 player game: the clock plays their turns; they're placed after everyone still in. */
  readonly out = new Set<number>();
  private readonly random: RandomSource;

  constructor(opts: GameOptions) {
    this.players = opts.players;
    this.random = opts.random;
    this.deck = this.shuffle(fullDeck());
    const n = this.players === 2 ? 7 : 5;
    this.hands = Array.from({ length: this.players }, () => this.deck.splice(0, n));
    // The first card up is never an 8 (nobody named a suit), a 2 or a Jack: it goes back in.
    let top = this.deck.shift()!;
    while (["8", "2", "J"].includes(rankOf(top))) { this.deck.push(top); top = this.deck.shift()!; }
    this.pile.push(top);
    this.suit = suitOf(top);
    this.first = opts.first ?? Math.floor(this.random() * this.players);
    this.turn = this.first;
    this.stats = Array.from({ length: this.players }, () => ({ played: 0, drawn: 0, eights: 0, twos: 0 }));
    this.voids = Array.from({ length: this.players }, () => new Set<Suit>());
  }

  get top(): Card { return this.pile[this.pile.length - 1]!; }

  /** The events that open the game. */
  openingEvents(): EightsEvent[] {
    return [{ type: "deal", counts: this.hands.map((h) => h.length), top: this.top, first: this.first }, { type: "turn", seat: this.turn!, owed: 0, suit: this.suit }];
  }

  /** Whether `card` may be played now by the player to move. */
  canPlay(card: Card): boolean {
    if (this.owed > 0) return rankOf(card) === "2"; // only a 2 answers a 2
    if (this.drawn && card !== this.drawn) return false;
    return rankOf(card) === "8" || suitOf(card) === this.suit || rankOf(card) === rankOf(this.top);
  }
  playable(seat: number): Card[] { return seat === this.turn ? this.hands[seat]!.filter((c) => this.canPlay(c)) : []; }

  play(seat: number, card: Card, suit?: Suit, auto = false): Result {
    if (this.phase !== "playing") return { ok: false, reason: "the game is over" };
    if (this.turn !== seat) return { ok: false, reason: "it isn't your turn" };
    const hand = this.hands[seat]!;
    const i = hand.indexOf(card);
    if (i < 0) return { ok: false, reason: "you don't have that card" };
    if (!this.canPlay(card)) return { ok: false, reason: this.owed ? `answer with a two, or draw ${["", "", "two", "", "four", "", "six", "", "eight"][this.owed] || this.owed}` : this.drawn ? "you can only play the card you drew" : "it doesn't match the suit or the number" };
    const rank = rankOf(card);
    if (rank === "8" && !SUITS.includes(suit as Suit)) return { ok: false, reason: "name a suit for your 8" };
    hand.splice(i, 1);
    this.voids[seat]!.delete(suitOf(card));
    this.pile.push(card);
    this.drawn = null;
    this.suit = rank === "8" ? (suit as Suit) : suitOf(card);
    const st = this.stats[seat]!;
    st.played++;
    if (rank === "8") st.eights++;
    if (rank === "2") st.twos++;
    const events: EightsEvent[] = [{ type: "play", by: seat, card, ...(rank === "8" ? { suit: this.suit } : {}), left: hand.length, ...(auto ? { auto } : {}) }];
    if (!hand.length) return { ok: true, events: [...events, this.end(seat)] };
    if (hand.length === 1) events.push({ type: "lastCard", seat });
    let next = this.next(seat);
    if (rank === "2") this.owed += 2;
    if (rank === "J") { events.push({ type: "skip", seat: next }); next = this.next(next); }
    this.turn = next;
    events.push({ type: "turn", seat: next, owed: this.owed, suit: this.suit });
    return { ok: true, events };
  }

  /**
   * Draw: owing a 2's cards, take them all and the turn passes; otherwise take one, and play it
   * if it fits (it's then the only card you may play) or pass.
   */
  draw(seat: number, auto = false): Result {
    if (this.phase !== "playing") return { ok: false, reason: "the game is over" };
    if (this.turn !== seat) return { ok: false, reason: "it isn't your turn" };
    if (this.drawn) return { ok: false, reason: "you've already drawn: play it or pass" };
    const owed = this.owed;
    const n = owed || 1;
    const stuck = !owed && !this.hands[seat]!.some((c) => this.canPlay(c)); // a draw by choice tells nothing
    const { cards, reshuffled } = this.take(n);
    // New cards nobody else saw may hold any suit, so the old marks no longer hold. A stuck draw
    // that still doesn't fit proves the void again: the hand had none and the new card isn't one.
    this.voids[seat]!.clear();
    if (stuck && !(cards[0] && (rankOf(cards[0]) === "8" || suitOf(cards[0]) === this.suit || rankOf(cards[0]) === rankOf(this.top)))) this.voids[seat]!.add(this.suit);
    this.hands[seat]!.push(...cards);
    this.stats[seat]!.drawn += cards.length;
    const events: EightsEvent[] = [{ type: "draw", by: seat, n: cards.length, cards, ...(owed ? { forced: true } : {}), ...(reshuffled ? { reshuffled } : {}) }];
    if (owed) {
      this.owed = 0;
      return { ok: true, events: [...events, ...this.advance(seat)] };
    }
    const card = cards[0];
    if (card && (rankOf(card) === "8" || suitOf(card) === this.suit || rankOf(card) === rankOf(this.top))) {
      this.drawn = card; // they may play it now, or pass
      if (auto) { const s = rankOf(card) === "8" ? this.bestSuit(seat) : undefined; const r = this.play(seat, card, s, true); return r.ok ? { ok: true, events: [...events, ...r.events] } : r; }
      return { ok: true, events: [...events, { type: "turn", seat, owed: 0, suit: this.suit }] };
    }
    return { ok: true, events: [...events, ...this.advance(seat)] };
  }

  /** Pass after drawing a card you could play but don't want to. */
  pass(seat: number): Result {
    if (this.phase !== "playing") return { ok: false, reason: "the game is over" };
    if (this.turn !== seat) return { ok: false, reason: "it isn't your turn" };
    if (!this.drawn) return { ok: false, reason: "draw first" };
    return { ok: true, events: this.advance(seat) };
  }

  /** The clock's move: play the first card that fits (an 8 names your strongest suit), else draw. */
  autoMove(seat: number): Result {
    // A player who left only draws and passes: someone who isn't at the table can't win it.
    if (this.out.has(seat)) return this.drawn ? this.pass(seat) : this.draw(seat);
    const fits = this.playable(seat);
    if (this.drawn) return fits.length ? this.play(seat, this.drawn, rankOf(this.drawn) === "8" ? this.bestSuit(seat) : undefined, true) : this.pass(seat);
    const nonEight = fits.find((c) => rankOf(c) !== "8");
    const card = nonEight ?? fits[0];
    if (card) return this.play(seat, card, rankOf(card) === "8" ? this.bestSuit(seat) : undefined, true);
    return this.draw(seat, true);
  }

  /** The suit `seat` holds most of (not counting 8s): what an 8 names by default. */
  bestSuit(seat: number): Suit {
    const n: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
    for (const c of this.hands[seat]!) if (rankOf(c) !== "8") n[suitOf(c)]++;
    return SUITS.reduce((a, b) => (n[b] > n[a] ? b : a), this.suit);
  }

  concede(seat: number): Result {
    if (this.phase === "over") return { ok: false, reason: "the game is over" };
    this.forfeit = true;
    // With two players the other wins; with more, the player with the fewest points left (not the one who left).
    const others = [...Array(this.players).keys()].filter((s) => s !== seat);
    const winner = others.reduce((a, b) => (this.handPoints(b) < this.handPoints(a) ? b : a));
    return { ok: true, events: [this.end(winner, true)] };
  }

  handPoints(seat: number): number { return this.hands[seat]!.reduce((a, c) => a + points(c), 0); }

  /** Final places, best first: the winner, then fewest points left, then those who left. */
  places(): number[] {
    const rank = (s: number) => (s === this.winner ? 0 : this.out.has(s) ? 2 : 1);
    const order = [...Array(this.players).keys()].sort((a, b) => rank(a) - rank(b) || this.handPoints(a) - this.handPoints(b));
    const place = new Array<number>(this.players);
    order.forEach((s, i) => { place[s] = i + 1; });
    return place;
  }

  viewFor(seat: number): EightsView {
    return {
      phase: this.phase,
      you: seat,
      hand: [...this.hands[seat]!],
      counts: this.hands.map((h) => h.length),
      top: this.top,
      suit: this.suit,
      turn: this.turn,
      owed: this.owed,
      drawn: this.turn === seat ? this.drawn : null,
      deckLeft: this.deck.length,
      winner: this.winner,
      forfeit: this.forfeit,
      scores: this.scores,
      hands: this.phase === "over" ? this.hands.map((h) => [...h]) : null,
      order: 1,
      voids: this.voids.map((v) => [...v]),
      stats: this.stats.map((s) => ({ ...s })),
    };
  }

  // ------------------------------------------------------------ internals

  private next(seat: number): number { return (seat + 1) % this.players; }

  /** End the turn after a draw or pass: the next player is up. */
  private advance(seat: number): EightsEvent[] {
    this.drawn = null;
    const events: EightsEvent[] = [{ type: "pass", by: seat }];
    this.turn = this.next(seat);
    events.push({ type: "turn", seat: this.turn, owed: this.owed, suit: this.suit });
    return events;
  }

  /** Take n cards from the deck, reshuffling the pile under the top card when it runs out. */
  private take(n: number): { cards: Card[]; reshuffled: boolean } {
    const cards: Card[] = [];
    let reshuffled = false;
    while (cards.length < n) {
      if (!this.deck.length) {
        if (this.pile.length <= 1) break; // every card is in someone's hand: take what there is
        const top = this.pile.pop()!;
        this.deck = this.shuffle(this.pile);
        this.pile = [top];
        reshuffled = true;
      }
      cards.push(this.deck.shift()!);
    }
    return { cards, reshuffled };
  }

  private end(winner: number, forfeit = false): EightsEvent {
    this.phase = "over";
    this.winner = winner;
    this.turn = null;
    this.drawn = null;
    this.forfeit = forfeit;
    this.scores = this.hands.map((_, s) => this.handPoints(s));
    return { type: "over", winner, hands: this.hands.map((h) => [...h]), scores: this.scores, ...(forfeit ? { forfeit } : {}) };
  }

  private shuffle(cards: Card[]): Card[] {
    const a = [...cards];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
  }
}
