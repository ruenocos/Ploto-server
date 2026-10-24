/**
 * Sea Battle's rules: pure and deterministic (randomness is injected), no
 * timers or sockets. docs/games/sea_battle.md has the rules in plain words.
 *
 *   placing  both players place a fleet (ships can't touch, even at the corners)
 *   firing   one shot at a time; a miss passes the turn, a hit or a sink fires again;
 *            a sunk ship shows, and the water around it is marked
 *   over     a whole fleet is sunk (or someone forfeits)
 *
 * The room (room.ts) runs clocks and bots and decides what each seat may see
 * (`viewFor` here only ever returns what that seat is allowed to know).
 */

/** A float source in [0, 1). Production uses Math.random, tests a seeded `Rng`. */
export type RandomSource = () => number;

export type ShipKind = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";
export const SHIPS: Readonly<Record<ShipKind, { readonly name: string; readonly length: number }>> = {
  carrier: { name: "Carrier", length: 5 },
  battleship: { name: "Battleship", length: 4 },
  cruiser: { name: "Cruiser", length: 3 },
  submarine: { name: "Submarine", length: 3 },
  destroyer: { name: "Destroyer", length: 2 },
};

export type BoardKind = "classic" | "quick";
export interface BoardSpec {
  readonly size: number;
  readonly fleet: readonly ShipKind[];
}
export const BOARDS: Readonly<Record<BoardKind, BoardSpec>> = {
  classic: { size: 10, fleet: ["carrier", "battleship", "cruiser", "submarine", "destroyer"] },
  quick: { size: 8, fleet: ["battleship", "cruiser", "submarine", "destroyer"] },
};

/** A ship's place: its top-left cell and which way it runs. */
export interface Placement {
  readonly kind: ShipKind;
  readonly x: number;
  readonly y: number;
  readonly dir: "h" | "v";
}
export type Fleet = readonly Placement[];

/** What a seat knows about one cell of a sea it fires at. */
export const enum Mark {
  Unknown = 0,
  Miss = 1,
  Hit = 2,
  /** Water next to a sunk ship: nothing can be there. */
  Water = 3,
}

export type ShotResult = "miss" | "hit" | "sunk";

export type SeaEvent =
  | { readonly type: "ready"; readonly seat: number }
  | { readonly type: "start"; readonly first: number }
  | {
      readonly type: "shot";
      readonly by: number;
      readonly x: number;
      readonly y: number;
      readonly result: ShotResult;
      /** The clock fired it. */
      readonly auto?: boolean;
      /** The ship, once sunk (it shows on the board). */
      readonly ship?: Placement;
      /** Cells marked as water around a sunk ship. */
      readonly water?: readonly (readonly [number, number])[];
    }
  | { readonly type: "turn"; readonly seat: number }
  | { readonly type: "over"; readonly winner: number; readonly forfeit?: boolean };

export type Result = { readonly ok: true; readonly events: readonly SeaEvent[] } | { readonly ok: false; readonly reason: string };

export interface SeatStats {
  shots: number;
  hits: number;
  sunk: number;
  streak: number;
  bestStreak: number;
}

/** What one seat may see. */
export interface SeaView {
  readonly phase: "placing" | "firing" | "over";
  readonly size: number;
  readonly fleetKinds: readonly ShipKind[];
  readonly you: number;
  readonly turn: number | null;
  readonly first: number | null;
  readonly winner: number | null;
  readonly forfeit: boolean;
  readonly ready: readonly [boolean, boolean];
  /** Your own fleet (null until placed), with which of its cells are hit. */
  readonly fleet: Fleet | null;
  /** The rival's shots at your sea. */
  readonly incoming: readonly Mark[];
  /** Your shots at the rival's sea. */
  readonly outgoing: readonly Mark[];
  /** The rival's ships you've sunk (or all of them, once the game is over). */
  readonly rivalShips: Fleet;
  /** Which of the rival's ships are sunk (by kind, in fleet order). */
  readonly rivalSunk: readonly ShipKind[];
  /** Which of your ships are sunk. */
  readonly yourSunk: readonly ShipKind[];
  readonly stats: readonly [SeatStats, SeatStats];
}

// ------------------------------------------------------------ geometry

export function cellsOf(p: Placement): [number, number][] {
  const n = SHIPS[p.kind].length;
  return Array.from({ length: n }, (_, i) => (p.dir === "h" ? [p.x + i, p.y] : [p.x, p.y + i]));
}

const NEIGHBOURS = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy] as const)).filter(([dx, dy]) => dx || dy);

/** Why this fleet can't be used on this board, or null when it's fine. */
export function fleetProblem(spec: BoardSpec, fleet: unknown): string | null {
  if (!Array.isArray(fleet)) return "a fleet is a list of ships";
  const want = [...spec.fleet].sort().join();
  const kinds = fleet.map((p) => (p as Placement)?.kind);
  if ([...kinds].sort().join() !== want) return "that isn't the fleet for this board";
  const taken = new Map<number, number>();
  for (const [i, raw] of fleet.entries()) {
    const p = raw as Placement;
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || (p.dir !== "h" && p.dir !== "v")) return "a ship is off the board";
    for (const [x, y] of cellsOf(p)) {
      if (x < 0 || y < 0 || x >= spec.size || y >= spec.size) return "a ship is off the board";
      if (taken.has(y * spec.size + x)) return "two ships overlap";
      taken.set(y * spec.size + x, i);
    }
  }
  for (const [cell, i] of taken) {
    const x = cell % spec.size, y = Math.floor(cell / spec.size);
    for (const [dx, dy] of NEIGHBOURS) {
      const j = taken.get((y + dy) * spec.size + (x + dx));
      if (j !== undefined && j !== i && x + dx >= 0 && x + dx < spec.size) return "ships can't touch, not even at the corners";
    }
  }
  return null;
}

/** A random legal fleet. */
export function randomFleet(spec: BoardSpec, random: RandomSource): Fleet {
  const kinds = [...spec.fleet].sort((a, b) => SHIPS[b].length - SHIPS[a].length); // big ships first: they're hardest to fit
  for (let attempt = 0; attempt < 1000; attempt++) {
    const fleet: Placement[] = [];
    let stuck = false;
    for (const kind of kinds) {
      let placed = false;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const dir = random() < 0.5 ? "h" : "v";
        const n = SHIPS[kind].length;
        const p: Placement = {
          kind,
          dir,
          x: Math.floor(random() * (dir === "h" ? spec.size - n + 1 : spec.size)),
          y: Math.floor(random() * (dir === "v" ? spec.size - n + 1 : spec.size)),
        };
        if (fits(spec, fleet, p)) {
          fleet.push(p);
          placed = true;
        }
      }
      if (!placed) {
        stuck = true;
        break;
      }
    }
    if (!stuck) return spec.fleet.map((k) => fleet.find((p) => p.kind === k)!);
  }
  throw new Error("couldn't place a fleet");
}

/** Whether `p` can join `fleet` (in bounds, not overlapping or touching). */
export function fits(spec: BoardSpec, fleet: Fleet, p: Placement): boolean {
  const others = new Set(fleet.filter((q) => q.kind !== p.kind).flatMap((q) => cellsOf(q).map(([x, y]) => y * spec.size + x)));
  for (const [x, y] of cellsOf(p)) {
    if (x < 0 || y < 0 || x >= spec.size || y >= spec.size) return false;
    if (others.has(y * spec.size + x)) return false;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < spec.size && ny < spec.size && others.has(ny * spec.size + nx)) return false;
    }
  }
  return true;
}

// ------------------------------------------------------------ the game

interface SeaSide {
  fleet: Fleet | null;
  ready: boolean;
  /** Shots received, by cell. */
  marks: Mark[];
  /** Hits taken per ship (fleet order). */
  hits: number[];
  stats: SeatStats;
}

export interface GameOptions {
  readonly board: BoardKind;
  readonly random: RandomSource;
}

export class SeaBattleGame {
  readonly spec: BoardSpec;
  phase: "placing" | "firing" | "over" = "placing";
  turn: number | null = null;
  first: number | null = null;
  winner: number | null = null;
  forfeit = false;
  readonly sides: [SeaSide, SeaSide];
  private readonly random: RandomSource;

  constructor(opts: GameOptions) {
    this.spec = BOARDS[opts.board];
    this.random = opts.random;
    const side = (): SeaSide => ({ fleet: null, ready: false, marks: new Array<Mark>(this.spec.size ** 2).fill(Mark.Unknown), hits: this.spec.fleet.map(() => 0), stats: { shots: 0, hits: 0, sunk: 0, streak: 0, bestStreak: 0 } });
    this.sides = [side(), side()];
  }

  /** Lock in a fleet. When both are ready, a coin flip picks who fires first. */
  ready(seat: number, fleet: Fleet): Result {
    if (this.phase !== "placing") return { ok: false, reason: "the fleets are already placed" };
    const side = this.sides[seat];
    if (!side) return { ok: false, reason: "no such seat" };
    if (side.ready) return { ok: false, reason: "you're already ready" };
    const problem = fleetProblem(this.spec, fleet);
    if (problem) return { ok: false, reason: problem };
    // Keep the board's fleet order, whatever order the client sent.
    side.fleet = this.spec.fleet.map((k) => {
      const p = fleet.find((q) => q.kind === k)!;
      return { kind: p.kind, x: p.x, y: p.y, dir: p.dir };
    });
    side.ready = true;
    const events: SeaEvent[] = [{ type: "ready", seat }];
    if (this.sides.every((s) => s.ready)) {
      this.phase = "firing";
      this.first = this.random() < 0.5 ? 0 : 1;
      this.turn = this.first;
      events.push({ type: "start", first: this.first });
    }
    return { ok: true, events };
  }

  /** Fire at the rival's cell (x, y). */
  fire(seat: number, x: number, y: number, auto = false): Result {
    if (this.phase !== "firing") return { ok: false, reason: "it isn't time to fire" };
    if (this.turn !== seat) return { ok: false, reason: "it isn't your turn" };
    const n = this.spec.size;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= n || y >= n) return { ok: false, reason: "that's off the board" };
    const me = this.sides[seat]!, them = this.sides[1 - seat]!;
    const cell = y * n + x;
    if (them.marks[cell] !== Mark.Unknown) return { ok: false, reason: "you already know what's there" };
    me.stats.shots++;
    const i = them.fleet!.findIndex((p) => cellsOf(p).some(([cx, cy]) => cx === x && cy === y));
    if (i < 0) {
      them.marks[cell] = Mark.Miss;
      me.stats.streak = 0;
      this.turn = 1 - seat;
      return { ok: true, events: [{ type: "shot", by: seat, x, y, result: "miss", ...(auto ? { auto } : {}) }, { type: "turn", seat: this.turn }] };
    }
    them.marks[cell] = Mark.Hit;
    them.hits[i]!++;
    me.stats.hits++;
    me.stats.streak++;
    me.stats.bestStreak = Math.max(me.stats.bestStreak, me.stats.streak);
    const ship = them.fleet![i]!;
    if (them.hits[i]! < SHIPS[ship.kind].length) return { ok: true, events: [{ type: "shot", by: seat, x, y, result: "hit", ...(auto ? { auto } : {}) }] };
    // Sunk: the water around it can't hold a ship.
    me.stats.sunk++;
    const water: [number, number][] = [];
    for (const [sx, sy] of cellsOf(ship)) {
      for (const [dx, dy] of NEIGHBOURS) {
        const wx = sx + dx, wy = sy + dy;
        if (wx < 0 || wy < 0 || wx >= n || wy >= n) continue;
        if (them.marks[wy * n + wx] === Mark.Unknown) {
          them.marks[wy * n + wx] = Mark.Water;
          water.push([wx, wy]);
        }
      }
    }
    const events: SeaEvent[] = [{ type: "shot", by: seat, x, y, result: "sunk", ship, water, ...(auto ? { auto } : {}) }];
    if (them.hits.every((h, k) => h >= SHIPS[them.fleet![k]!.kind].length)) {
      this.phase = "over";
      this.winner = seat;
      this.turn = null;
      events.push({ type: "over", winner: seat });
    }
    return { ok: true, events };
  }

  /** A cell nobody has fired at yet on `seat`'s rival's sea (the clock's shot). */
  randomTarget(seat: number): [number, number] {
    const marks = this.sides[1 - seat]!.marks;
    const open = marks.flatMap((m, c) => (m === Mark.Unknown ? [c] : []));
    const c = open[Math.floor(this.random() * open.length)]!;
    return [c % this.spec.size, Math.floor(c / this.spec.size)];
  }

  /** `seat` gives up (left, or forfeited): the rival wins. */
  concede(seat: number): Result {
    if (this.phase === "over") return { ok: false, reason: "the game is over" };
    this.phase = "over";
    this.winner = 1 - seat;
    this.turn = null;
    this.forfeit = true;
    return { ok: true, events: [{ type: "over", winner: this.winner, forfeit: true }] };
  }

  sunkKinds(seat: number): ShipKind[] {
    const side = this.sides[seat]!;
    return side.fleet ? side.fleet.filter((p, k) => side.hits[k]! >= SHIPS[p.kind].length).map((p) => p.kind) : [];
  }

  /** What `seat` may see: everything about its own sea, only what it has found out about the rival's. */
  viewFor(seat: number): SeaView {
    const me = this.sides[seat]!, them = this.sides[1 - seat]!;
    const over = this.phase === "over";
    const rivalShips = them.fleet ? them.fleet.filter((p, k) => over || them.hits[k]! >= SHIPS[p.kind].length) : [];
    return {
      phase: this.phase,
      size: this.spec.size,
      fleetKinds: this.spec.fleet,
      you: seat,
      turn: this.turn,
      first: this.first,
      winner: this.winner,
      forfeit: this.forfeit,
      ready: [this.sides[0].ready, this.sides[1].ready],
      fleet: me.fleet,
      incoming: [...me.marks],
      outgoing: [...them.marks],
      rivalShips,
      rivalSunk: this.sunkKinds(1 - seat),
      yourSunk: this.sunkKinds(seat),
      stats: [{ ...this.sides[0].stats }, { ...this.sides[1].stats }],
    };
  }
}
