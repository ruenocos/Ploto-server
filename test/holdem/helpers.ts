import { expect } from "vitest";
import { HoldemGame } from "../../src/game/holdem/engine.js";
import { cardToString, newDeck, parseCards } from "../../src/game/holdem/cards.js";
import type { Action, ActResult, BlindLevel, Card, HoldemConfig, HoldemEvent } from "../../src/game/holdem/types.js";
import { Rng } from "../../src/game/matchmonsters/rng.js";

/**
 * A 52-card deck that deals the given hole cards and board. `order` is the
 * deal order: the players dealt in, starting left of the button.
 */
export function rig(order: readonly string[], holes: Record<string, string>, board = ""): Card[] {
  const hc = Object.fromEntries(order.map((id) => [id, holes[id] ? parseCards(holes[id]!) : []]));
  const b = parseCards(board);
  const used = new Set([...Object.values(hc).flat(), ...b].map(cardToString));
  const rest = newDeck().filter((c) => !used.has(cardToString(c)));
  const take = (c: Card | undefined) => c ?? rest.shift()!;
  const deck: Card[] = [];
  for (let round = 0; round < 2; round++) for (const id of order) deck.push(take(hc[id]![round]));
  deck.push(rest.shift()!, take(b[0]), take(b[1]), take(b[2]));
  deck.push(rest.shift()!, take(b[3]));
  deck.push(rest.shift()!, take(b[4]));
  deck.push(...rest);
  expect(new Set(deck.map(cardToString)).size).toBe(52);
  return deck;
}

export interface TableOptions {
  readonly ids?: readonly string[];
  readonly chips?: number;
  /** Per-seat stacks (overrides `chips` after creation; keep the sum = ids × chips to keep the invariant). */
  readonly stacks?: readonly number[];
  readonly button?: number;
  readonly blinds?: readonly BlindLevel[];
  readonly every?: number;
  /** Decks per hand number (1-based); hands without one are shuffled from the seed. */
  readonly decks?: Record<number, Card[]>;
  readonly seed?: number;
}

export function table(n: number, opts: TableOptions = {}): HoldemGame {
  const ids = opts.ids ?? ["A", "B", "C", "D", "E", "F"].slice(0, n);
  const rng = new Rng(opts.seed ?? 42);
  const shuffled = (handNo: number): Card[] | undefined => opts.decks?.[handNo];
  const config: HoldemConfig = {
    players: ids.map((id) => ({ id, name: `Player ${id}` })),
    startingChips: opts.chips ?? 1000,
    random: () => rng.next(),
    firstButton: opts.button ?? 0,
    blindsEveryHands: opts.every ?? 0,
    ...(opts.blinds ? { blinds: opts.blinds } : {}),
    ...(opts.decks
      ? {
          deckFor: (h: number) => {
            const d = shuffled(h);
            if (d) return d;
            const deck = newDeck();
            for (let i = deck.length - 1; i > 0; i--) {
              const j = rng.int(i + 1);
              [deck[i], deck[j]] = [deck[j]!, deck[i]!];
            }
            return deck;
          },
        }
      : {}),
  };
  const game = new HoldemGame(config);
  if (opts.stacks) opts.stacks.forEach((s, i) => (game.state.seats[i]!.stack = s));
  return game;
}

export function start(game: HoldemGame): HoldemEvent[] {
  const r = game.startHand();
  if (!r.ok) throw new Error(`startHand rejected: ${r.reason}`);
  return r.events;
}

/** Plays `[id, action]` steps, asserting each is accepted and in turn; returns all events. */
export function play(game: HoldemGame, steps: readonly [string, Action][]): HoldemEvent[] {
  const events: HoldemEvent[] = [];
  for (const [id, action] of steps) {
    expect(game.toActId, `expected ${id} to act`).toBe(id);
    const r = game.act(id, action);
    if (!r.ok) throw new Error(`${id} ${JSON.stringify(action)} rejected: ${r.reason}`);
    events.push(...(r as ActResult).events);
  }
  return events;
}

export const fold: Action = { type: "fold" };
export const check: Action = { type: "check" };
export const call: Action = { type: "call" };
export const allIn: Action = { type: "allIn" };
export const raise = (to: number): Action => ({ type: "raise", to });

export function ofType<T extends HoldemEvent["type"]>(events: readonly HoldemEvent[], type: T): Extract<HoldemEvent, { type: T }>[] {
  return events.filter((e): e is Extract<HoldemEvent, { type: T }> => e.type === type);
}

export function stacks(game: HoldemGame): Record<string, number> {
  return Object.fromEntries(game.state.seats.map((s) => [s.id, s.stack]));
}
