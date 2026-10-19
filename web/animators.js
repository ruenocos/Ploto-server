// @ts-check
/**
 * Animators: one `animate()` for every effect a move can have, and one for
 * every board action (swapping, cascades, reshuffles, ice landing, turn ticks).
 *
 * This file is type-checked against the server's own types (`npm run typecheck`
 * runs tsconfig.web.json). EFFECTS is typed as a full map over EffectKind, so
 * adding an effect to the engine without an animation here fails the build.
 *
 * Animators only use the primitives in `Fx` (provided by index.html), and
 * resolve when their animation has finished.
 */

/** @typedef {import("../src/game/matchmonsters/types.js").EffectKind} EffectKind */
/** @typedef {import("../src/game/matchmonsters/types.js").EffectEvent} EffectEvent */
/** @typedef {import("../src/game/matchmonsters/types.js").CastEvent} CastEvent */
/** @typedef {import("../src/game/matchmonsters/types.js").CascadeStep} CascadeStep */
/** @typedef {import("../src/game/matchmonsters/types.js").MoveResult} MoveResult */
/** @typedef {import("../src/game/matchmonsters/types.js").AbilityEvent} AbilityEvent */
/** @typedef {import("../src/game/matchmonsters/types.js").Cell} Cell */
/** @typedef {import("../src/game/matchmonsters/types.js").Gem} Gem */
/**
 * @template {EffectKind} K
 * @typedef {import("../src/game/matchmonsters/types.js").EffectEventFor<K>} EventFor
 */

/** @typedef {{ x: number, y: number }} Pt */
/** @typedef {"attack" | "pierce" | "heal" | "shield" | "burn" | "poison" | "burn-tick" | "poison-tick" | "regen-tick" | "fatigue"} LandKind */
/** @typedef {"attack" | "cast" | "hurt" | "cheer" | "charge" | "dizzy" | "faint" | "evolveOut" | "evolveIn"} Pose  each maps to a stock Animate.css preset (POSES in index.html) */

/**
 * The drawing primitives index.html hands to every animator.
 * @typedef {object} Fx
 * @property {(ms: number) => Promise<void>} sleep
 * @property {boolean} reduceMotion
 * @property {Record<string, string>} COLOR  colour per element / berry / stone
 * @property {(x: number, y: number) => HTMLElement | null} tileAt
 * @property {(el: Element) => Pt} centerOf
 * @property {(seat: 0 | 1) => HTMLElement} sideOf   a player's half of the arena
 * @property {(seat: 0 | 1, monsterId: string) => HTMLElement | null} monOf   a monster's body centre on the battlefield
 * @property {(seat: 0 | 1) => Pt} hitOf   where hits on a player land (between their monsters)
 * @property {(seat: 0 | 1) => HTMLElement} hpBarOf
 * @property {() => HTMLElement} board
 * @property {() => HTMLElement} banner
 * @property {(cls: "mote" | "orb", from: Pt, to: Pt, color: string, opts?: { delay?: number, dur?: number, arc?: number }) => Promise<void>} fly
 * @property {(at: Pt, color: string, count?: number, spread?: number) => void} burst
 * @property {(el: Element | null) => void} bump   a quick stock pulse ("this changed")
 * @property {(el: Element | null, preset: string, opts?: { speed?: "" | "fast" | "faster" | "slow" | "slower", keep?: boolean }) => Promise<void>} play   play an Animate.css preset (name without the animate__ prefix)
 * @property {(host: HTMLElement, text: string, color: string, icons?: string[]) => void} floatText   a floating label, led by pixel icons (web/icons.js names)
 * @property {(name: string, scale?: number) => string} icon   a pixel icon (web/icons.js) as inline SVG markup
 * @property {(seat: 0 | 1, kind: LandKind, amount: number, color?: string, element?: string) => void} land   apply + show a number on a player (the impact takes the attacker's element)
 * @property {(at: Pt, kind: string, opts?: { k?: number, dur?: number }) => void} impact   a pixel impact sprite (art/pixel/fx.py: an element, heal, shield, ice or poison)
 * @property {() => number} tileFxUnit   impact scale that fits a board tile
 * @property {(seat: 0 | 1, monsterId: string, delta: number) => void} charge   move a monster's shown charge
 * @property {(seat: 0 | 1) => HTMLElement | null} stashOf   a player's berry counter in the HUD
 * @property {(seat: 0 | 1, delta: number) => void} berries   move a player's shown berry count
 * @property {(x: number, y: number, gem: Gem, cls?: string) => void} setTile   change one tile (with an entrance class)
 * @property {(step: CascadeStep, opts: { mover: 0 | 1 | null, combo?: number }) => Promise<void>} playStep
 * @property {(seat: 0 | 1, monsterId: string | null, pose: Pose) => Promise<void>} pose   body language (null = both monsters); `land` already flinches/cheers
 * @property {() => Promise<void>} shuffle
 */

/**
 * Context for one effect of one cast.
 * @typedef {object} CastCtx
 * @property {Fx} fx
 * @property {CastEvent} cast
 * @property {MoveResult} data
 * @property {HTMLElement | null} source  the caster's body centre
 * @property {Set<number>} playedSteps  effectSteps already animated
 */

/**
 * @template {EffectKind} K
 * @typedef {{ animate(e: EventFor<K>, ctx: CastCtx): Promise<void> }} EffectAnimator
 */

const other = (/** @type {0 | 1} */ seat) => /** @type {0 | 1} */ (seat === 0 ? 1 : 0);

/** Send an orb from the caster to a player's monsters (skipped if there's no source). */
async function orbTo(/** @type {CastCtx} */ ctx, /** @type {0 | 1} */ seat, /** @type {string} */ color, dur = 300) {
  const { fx, source } = ctx;
  if (source) await fx.fly("orb", fx.centerOf(source), fx.hitOf(seat), color, { dur, arc: 30 });
}

/** A bubble on the target soaked up a harmful effect: the orb flies, the bubble pops. */
async function blocked(/** @type {CastCtx} */ ctx, /** @type {0 | 1} */ target) {
  const { fx } = ctx;
  await orbTo(ctx, target, "#bfefff");
  fx.impact(fx.hitOf(target), "water");
  fx.floatText(fx.sideOf(target), "blocked", "#bfefff", ["bubble"]);
  void fx.pose(target, null, "cheer");
  await fx.sleep(380);
}

/** The caster lunges at the rival (the attack pose); the orb leaves at the peak of the dart. */
async function lunge(/** @type {CastCtx} */ ctx) {
  void ctx.fx.pose(ctx.cast.by, ctx.cast.monsterId, "attack");
  await ctx.fx.sleep(ctx.fx.reduceMotion ? 0 : 260);
}

/** Motes from the caster to each cell, then `onArrive` per cell. */
async function motesToCells(/** @type {CastCtx} */ ctx, /** @type {readonly Cell[]} */ cells, /** @type {string} */ color, /** @type {(c: Cell) => void} */ onArrive) {
  const { fx, source } = ctx;
  await Promise.all(
    cells.map((c, i) => {
      const tile = fx.tileAt(c.x, c.y);
      if (!tile || !source) return fx.sleep(i * 60).then(() => onArrive(c));
      return fx.fly("mote", fx.centerOf(source), fx.centerOf(tile), color, { delay: i * 70, dur: 420 }).then(() => onArrive(c));
    }),
  );
}

/** @type {{ [K in EffectKind]: EffectAnimator<K> }} */
const EFFECTS = {
  damage: {
    async animate(e, ctx) {
      const color = ctx.fx.COLOR[ctx.cast.element] ?? "#ff6a4d";
      await lunge(ctx);
      await orbTo(ctx, e.target, color);
      ctx.fx.land(e.target, e.pierce ? "pierce" : "attack", e.amount, color, ctx.cast.element);
      await ctx.fx.sleep(90);
    },
  },

  heal: {
    async animate(e, ctx) {
      await orbTo(ctx, e.target, "#4fd17a");
      ctx.fx.land(e.target, "heal", e.amount);
      await ctx.fx.sleep(90);
    },
  },

  shield: {
    async animate(e, ctx) {
      const { fx } = ctx;
      await orbTo(ctx, e.target, "#7fd0ff");
      if (e.amount > 0) fx.land(e.target, "shield", e.amount);
      else fx.floatText(fx.sideOf(e.target), "max", "#7fd0ff", ["shield"]);
      await fx.sleep(90);
    },
  },

  // Life steal: the hit travels out, then the stolen life flows back.
  drain: {
    async animate(e, ctx) {
      const { fx } = ctx;
      const color = fx.COLOR[ctx.cast.element] ?? "#ff6a4d";
      await lunge(ctx);
      await orbTo(ctx, e.target, color);
      fx.land(e.target, "attack", e.amount, color, ctx.cast.element);
      const caster = other(e.target);
      const home = ctx.source ? fx.centerOf(ctx.source) : fx.hitOf(caster);
      await fx.fly("orb", fx.hitOf(e.target), home, "#4fd17a", { dur: 380, arc: 50 });
      if (e.healed > 0) fx.land(caster, "heal", e.healed);
      await fx.sleep(90);
    },
  },

  dot: {
    async animate(e, ctx) {
      const color = e.dot === "burn" ? "#ff9a3c" : "#8be27f";
      await lunge(ctx);
      if (e.blocked) return blocked(ctx, e.target);
      await orbTo(ctx, e.target, color);
      ctx.fx.land(e.target, e.dot, e.amount, color);
      await ctx.fx.sleep(90);
    },
  },

  // The rival's burns go up all at once: a fire burst and one big number.
  ignite: {
    async animate(e, ctx) {
      const { fx } = ctx;
      if (e.amount <= 0) return; // nothing was burning
      const at = fx.hitOf(e.target);
      await orbTo(ctx, e.target, "#ff9a3c", 260);
      fx.impact(at, "fire", { dur: 480 });
      fx.burst(at, "#ffd23c", 8, 30);
      fx.floatText(fx.sideOf(e.target), e.burns > 1 ? `ignite ×${e.burns}` : "ignite", "#ffb04a", ["burn"]);
      fx.land(e.target, "pierce", e.amount, "#ff7a2a", "fire");
      await fx.sleep(240);
    },
  },

  // A soft glow settles on the caster's side; the healing itself ticks in at turn start.
  regen: {
    async animate(e, ctx) {
      const { fx } = ctx;
      await orbTo(ctx, e.target, "#92e27c");
      for (const c of fx.sideOf(e.target).querySelectorAll(".core")) fx.impact(fx.centerOf(c), "heal");
      fx.floatText(fx.sideOf(e.target), `${e.amount}/turn ×${e.turns}`, "#92e27c", ["heal"]);
      void fx.pose(e.target, null, "cheer");
      await fx.sleep(300);
    },
  },

  // A bubble wraps the caster's team.
  bubble: {
    async animate(e, ctx) {
      const { fx } = ctx;
      await orbTo(ctx, e.target, "#bfefff");
      for (const c of fx.sideOf(e.target).querySelectorAll(".core")) fx.impact(fx.centerOf(c), "water");
      fx.floatText(fx.sideOf(e.target), e.count > 1 ? `×${e.count}` : "bubble", "#bfefff", ["bubble"]);
      void fx.pose(e.target, null, "cheer");
      await fx.sleep(300);
    },
  },

  // Blast: the region lights up in a sweep, then clears like a match (and charges you).
  match: {
    async animate(e, ctx) {
      const { fx, data, cast } = ctx;
      const color = fx.COLOR[cast.element] ?? "#fff";
      e.cells.forEach((c, i) => {
        const t = fx.tileAt(c.x, c.y);
        if (!t) return;
        t.style.setProperty("--zap", color);
        t.style.setProperty("--zd", `${i * 22}ms`);
        t.classList.add("zap");
      });
      await fx.sleep(fx.reduceMotion ? 120 : 260 + e.cells.length * 22);
      const step = data.effectSteps[e.step];
      if (step && !ctx.playedSteps.has(e.step)) {
        ctx.playedSteps.add(e.step);
        await fx.playStep(step, { mover: cast.by });
      }
      // Stones caught in the blast shatter into the rival (Tremole).
      if (e.shatter) {
        fx.land(e.shatter.target, "attack", e.shatter.amount, fx.COLOR.earth, "earth");
        fx.floatText(fx.sideOf(e.shatter.target), `${e.shatter.stones} stone${e.shatter.stones === 1 ? "" : "s"} shattered`, "#d8a860");
        await fx.sleep(200);
      }
    },
  },

  // Freezes land on the rival's turn: show the cold gathering over the board.
  freeze: {
    async animate(e, ctx) {
      const { fx, source } = ctx;
      if (e.blocked) return blocked(ctx, e.target);
      const board = fx.board();
      const r = board.getBoundingClientRect();
      if (source && !fx.reduceMotion) {
        const flights = [];
        for (let i = 0; i < Math.min(8, e.count * 2); i++) {
          const to = { x: r.left + r.width * (0.15 + Math.random() * 0.7), y: r.top + r.height * (0.15 + Math.random() * 0.7) };
          flights.push(fx.fly("mote", fx.centerOf(source), to, "#bfe9ff", { delay: i * 40, dur: 460, arc: 80 }));
        }
        await Promise.all(flights);
      }
      board.animate([{ filter: "none" }, { filter: "brightness(1.25) saturate(0.4) hue-rotate(160deg)" }, { filter: "none" }], { duration: 420 });
      fx.impact({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, "ice", { k: fx.tileFxUnit() * 2, dur: 420 });
      fx.floatText(fx.sideOf(e.target), `${e.count} next turn`, "#bfe9ff", ["frozen"]);
      void fx.pose(e.target, null, "hurt");
      await fx.sleep(300);
    },
  },

  petrify: {
    async animate(e, ctx) {
      const { fx } = ctx;
      await motesToCells(ctx, e.cells, fx.COLOR.earth ?? "#e0a35e", (c) => {
        fx.setTile(c.x, c.y, "stone", "fresh");
        const t = fx.tileAt(c.x, c.y);
        if (t) fx.impact(fx.centerOf(t), "earth", { k: fx.tileFxUnit() });
      });
      await fx.sleep(250);
    },
  },

  convert: {
    async animate(e, ctx) {
      const { fx } = ctx;
      const color = fx.COLOR[e.element] ?? "#fff";
      await motesToCells(ctx, e.cells, color, (c) => {
        fx.setTile(c.x, c.y, e.element, "converted");
        const t = fx.tileAt(c.x, c.y);
        if (t) fx.impact(fx.centerOf(t), e.element, { k: fx.tileFxUnit() });
      });
      await fx.sleep(300);
    },
  },

  // Berries sprout on the board, one by one, where the caster's motes land.
  grow: {
    async animate(e, ctx) {
      const { fx } = ctx;
      await motesToCells(ctx, e.cells, fx.COLOR.berry ?? "#ff5a7a", (c) => {
        fx.setTile(c.x, c.y, "berry", "converted");
        const t = fx.tileAt(c.x, c.y);
        if (t) fx.impact(fx.centerOf(t), "heal", { k: fx.tileFxUnit() });
      });
      await fx.sleep(300);
    },
  },

  // Berries hop out of the rival's stash and into the caster's.
  pluck: {
    async animate(e, ctx) {
      const { fx, cast } = ctx;
      const from = fx.stashOf(e.target), to = fx.stashOf(cast.by);
      if (!e.count || !from || !to) {
        fx.floatText(fx.sideOf(e.target), "no berries to steal", "#8f98ad");
        await fx.sleep(300);
        return;
      }
      void fx.pose(e.target, null, "hurt");
      await Promise.all(Array.from({ length: e.count }, (_, i) =>
        fx.sleep(i * 140).then(() => {
          fx.berries(e.target, -1);
          return fx.fly("orb", fx.centerOf(from), fx.centerOf(to), fx.COLOR.berry ?? "#ff5a7a", { dur: 520, arc: 60 });
        }).then(() => fx.berries(cast.by, 1)),
      ));
      void fx.pose(cast.by, cast.monsterId, "cheer");
      await fx.sleep(160);
    },
  },

  // Charge leaks out of the rival monsters and streams into the caster.
  sap: {
    async animate(e, ctx) {
      const { fx, source, cast } = ctx;
      const color = fx.COLOR[cast.element] ?? "#3aa0ff";
      const flights = Object.entries(e.drained).map(([monsterId, n]) => {
        const mon = fx.monOf(e.target, monsterId);
        fx.charge(e.target, monsterId, -n);
        void fx.pose(e.target, monsterId, "hurt");
        if (!mon) return Promise.resolve();
        fx.impact(fx.centerOf(mon), cast.element);
        return source ? fx.fly("mote", fx.centerOf(mon), fx.centerOf(source), color, { dur: 460 }) : Promise.resolve();
      });
      if (!flights.length) fx.floatText(fx.sideOf(e.target), "no charge to drain", "#8f98ad");
      await Promise.all(flights);
      if (flights.length) void fx.pose(cast.by, cast.monsterId, "charge");
      await fx.sleep(120);
    },
  },

  // The rival's monsters get the spins.
  slow: {
    async animate(e, ctx) {
      const { fx } = ctx;
      if (e.blocked) return blocked(ctx, e.target);
      await orbTo(ctx, e.target, fx.COLOR.water ?? "#3aa0ff");
      void fx.pose(e.target, null, "dizzy");
      fx.floatText(fx.sideOf(e.target), e.count > 0 ? `-${e.count} move next turn` : "already slowed", "#9bf6ff", ["slow"]);
      await fx.sleep(420);
    },
  },

  // A lock slams onto the sealed monster.
  seal: {
    async animate(e, ctx) {
      const { fx } = ctx;
      if (e.blocked) return blocked(ctx, e.target);
      const mon = e.monsterId ? fx.monOf(e.target, e.monsterId) : null;
      const fighter = mon?.closest(".fighter");
      const stage = fighter?.querySelector(".stage");
      if (mon && ctx.source) await fx.fly("orb", fx.centerOf(ctx.source), fx.centerOf(mon), "#b39dff", { dur: 320 });
      if (fighter instanceof HTMLElement && stage instanceof HTMLElement && e.monsterId) {
        const stamp = document.createElement("div");
        stamp.className = "stamp";
        stamp.innerHTML = fx.icon("seal", 4);
        stage.appendChild(stamp);
        void fx.play(stamp, "zoomInDown", { speed: "faster" });
        void fx.pose(e.target, e.monsterId, "hurt");
        fighter.classList.add("sealed"); // the next render keeps it in sync with the real state
        fighter.classList.remove("ready");
        fx.floatText(stage, `sealed ${e.matches} matches`, "#b39dff");
        await fx.sleep(650);
        stamp.remove();
      } else {
        await fx.sleep(200);
      }
    },
  },

  haste: {
    async animate(_e, ctx) {
      const { fx, cast } = ctx;
      const banner = fx.banner();
      const r = banner.getBoundingClientRect();
      fx.impact({ x: r.right - 34, y: r.top + r.height / 2 }, "light");
      fx.bump(banner);
      void fx.pose(cast.by, null, "cheer");
      await fx.sleep(320); // the bonus pip itself pops in when the turn re-renders
    },
  },

  cleanse: {
    async animate(e, ctx) {
      const { fx, cast } = ctx;
      const side = fx.sideOf(cast.by);
      for (const f of side.querySelectorAll(".fighter .core")) {
        fx.impact(fx.centerOf(f), "light");
      }
      void fx.pose(cast.by, null, "cheer");
      if (e.removed > 0) fx.floatText(side, "cleansed", "#fff6c2", ["cleanse"]);
      await fx.sleep(360);
    },
  },

  // Motes stream from the caster into its partner.
  empower: {
    async animate(e, ctx) {
      const { fx, source, cast } = ctx;
      await Promise.all(
        e.monsterIds.map((id) => {
          const mon = fx.monOf(cast.by, id);
          if (!mon || !source) {
            fx.charge(cast.by, id, e.count);
            return Promise.resolve();
          }
          const color = fx.COLOR[cast.element] ?? "#ffd23c";
          return Promise.all(
            Array.from({ length: Math.min(6, e.count) }, (_, i) =>
              fx.fly("mote", fx.centerOf(source), fx.centerOf(mon), color, { delay: i * 60, dur: 420 }),
            ),
          ).then(() => {
            fx.charge(cast.by, id, e.count);
            void fx.pose(cast.by, id, "cheer");
          });
        }),
      );
      await fx.sleep(120);
    },
  },
};

/**
 * Board actions, i.e. everything that isn't a move's effect.
 * @typedef {object} BoardAnimators
 * @property {{ animate(data: MoveResult, fx: Fx): Promise<void> }} swap  the player's own swap (match or not)
 * @property {{ animate(steps: readonly CascadeStep[], opts: { mover: 0 | 1 | null, combo?: boolean }, fx: Fx): Promise<void> }} cascade  matches clearing and tiles falling
 * @property {{ animate(fx: Fx): Promise<void> }} reshuffle
 * @property {{ animate(cells: readonly Cell[], fx: Fx): Promise<void> }} iceLanded  freezes landing as the turn passes
 * @property {{ animate(events: readonly AbilityEvent[], fx: Fx): Promise<void> }} turnStart  burns, poison and sudden death
 */

/** @type {BoardAnimators} */
const BOARD = {
  swap: {
    async animate(data, fx) {
      const { from, to } = data.move;
      for (const c of [from, to]) fx.tileAt(c.x, c.y)?.classList.add("swapin");
      // A swap that matched nothing gets a little settle so it doesn't feel ignored.
      if (data.cascades.length === 0) {
        for (const c of [from, to]) fx.bump(fx.tileAt(c.x, c.y));
      }
      await fx.sleep(160);
    },
  },

  cascade: {
    async animate(steps, opts, fx) {
      let n = 0;
      for (const step of steps) {
        n++;
        await fx.playStep(step, { mover: opts.mover, ...(opts.combo && n >= 2 ? { combo: n } : {}) });
      }
    },
  },

  reshuffle: {
    async animate(fx) {
      await fx.shuffle();
    },
  },

  iceLanded: {
    async animate(cells, fx) {
      cells.forEach((c, i) => {
        const t = fx.tileAt(c.x, c.y);
        if (!t) return;
        t.classList.add("fresh");
        setTimeout(() => fx.impact(fx.centerOf(t), "ice", { k: fx.tileFxUnit() }), i * 50);
      });
      if (cells.length) await fx.sleep(400);
    },
  },

  turnStart: {
    async animate(events, fx) {
      for (const a of events) {
        fx.land(a.targetPlayer, a.type, a.amount);
        await fx.sleep(260);
      }
    },
  },
};

/** @type {any} */ (window).MM_ANIMATORS = { effects: EFFECTS, board: BOARD };
