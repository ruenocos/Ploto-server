/**
 * Deterministic, seedable PRNG (mulberry32).
 *
 * The real Plato server is authoritative over all randomness ("shuffles, deals,
 * dice and timers run on Plato servers, not your device"). We mirror that: every
 * random event in a match is driven by a seed held only by the server, so a match
 * is fully reproducible from (seed, move-list). That makes games replayable and
 * the engine unit-testable.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force to uint32.
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new RangeError("maxExclusive must be > 0");
    return Math.floor(this.next() * maxExclusive);
  }

  /** Pick one element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("cannot pick from empty array");
    return items[this.int(items.length)]!;
  }
}
