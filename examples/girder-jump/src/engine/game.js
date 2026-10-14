/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump — the game
 *
 * A climb-and-dodge platformer. A grumpy robot on the top girder rolls
 * crates down at you; they roll along each girder, drop through its gap to
 * the next one, and sometimes take a ladder instead. You start at the
 * bottom: walk, climb the ladders and jump the crates (100 points each) to
 * reach the beacon on the top ledge. The sooner you get there, the bigger
 * the bonus; then the next level throws faster crates. A crate that hits
 * you costs a life; the game ends with the last.
 *
 * Pure and deterministic: time arrives through `step(ms)`, input through
 * `act(action)`, and randomness from the seeded generator. Both return the
 * events that happened, for sounds.
 */
import {
  FLOORS,
  LEDGE,
  ROBOT_X,
  START,
  TOP_FLOOR,
  ladderDown,
  ladderUp,
  rollDir,
} from "./level.js";
import { createRng } from "./rng.js";

/** Walking, climbing and jumping. */
export const STEP = 6;
export const CLIMB_STEP = 0.25;
export const JUMP_MS = 760;
export const JUMP_H = 16;

/** Crates: their radius, fall pull, ladder speed and how often they take a ladder. */
export const CRATE_R = 5;
export const GRAVITY = 420;
export const LADDER_SPEED = 55;
export const LADDER_CHANCE = 0.3;

/** Points. */
export const LEAP_POINTS = 100;
export const START_BONUS = 3000;

/** How long a lost life freezes the field, in ms. */
export const FREEZE_MS = 1000;

/**
 * How fast crates roll at a level, in pixels per second.
 *
 * @param {number} level
 * @returns {number}
 */
export function crateSpeed(level) {
  return Math.min(95, 42 + level * 7);
}

/**
 * The shortest wait between two throws at a level, in ms.
 *
 * @param {number} level
 * @returns {number}
 */
export function throwMs(level) {
  return Math.max(1100, 3000 - (level - 1) * 350);
}

/**
 * Where the hero's feet are.
 *
 * @param {any} hero
 * @returns {{ x: number, y: number }}
 */
export function heroFeet(hero) {
  if (hero.climb) {
    const l = hero.climb.ladder;
    const y0 = FLOORS[l.floor].y;
    const y1 = FLOORS[l.floor + 1].y;
    return { x: l.x, y: y0 + (y1 - y0) * hero.climb.p };
  }
  const lift = hero.jump ? Math.sin((Math.PI * hero.jump.ms) / JUMP_MS) * JUMP_H : 0;
  return { x: hero.x, y: FLOORS[hero.floor].y - lift };
}

/**
 * Where a crate's middle is.
 *
 * @param {any} crate
 * @returns {{ x: number, y: number }}
 */
export function crateMiddle(crate) {
  const y = crate.fall ? crate.fall.y : FLOORS[crate.floor].y;
  return { x: crate.x, y: y - CRATE_R };
}

/**
 * Starts a game.
 *
 * @param {number} seed
 * @returns {{ state: any, act: (action: string) => any[], step: (ms: number) => any[] }}
 */
export function createGame(seed) {
  const rng = createRng(seed);
  const state = {
    score: 0,
    lives: 3,
    level: 1,
    over: false,
    bonus: START_BONUS,
    hero: null,
    crates: [],
    throwIn: 0,
    throwing: 0,
    freeze: 0,
    bonusClock: 0,
  };

  /** Puts the hero at the start and clears the field. */
  const reset = () => {
    state.hero = { floor: START.floor, x: START.x, climb: null, jump: null, facing: 1 };
    state.crates = [];
    state.throwIn = 1200;
    state.bonus = START_BONUS;
    state.bonusClock = 0;
  };
  reset();

  const act = (action) => {
    const hero = state.hero;
    if (state.over || state.freeze > 0) return [];
    if (action === "left" || action === "right") {
      if (hero.climb) return [];
      const dir = action === "left" ? -1 : 1;
      const f = FLOORS[hero.floor];
      hero.x = Math.min(f.x1 - 4, Math.max(f.x0 + 4, hero.x + dir * STEP));
      hero.facing = dir;
      return [];
    }
    if (action === "up") {
      if (hero.climb) {
        hero.climb.p = Math.min(1, hero.climb.p + CLIMB_STEP);
        if (hero.climb.p >= 1) {
          hero.floor = hero.climb.ladder.floor + 1;
          hero.x = hero.climb.ladder.x;
          hero.climb = null;
          if (hero.floor === LEDGE) return clear();
        }
        return [];
      }
      if (hero.jump) return [];
      const ladder = ladderUp(hero.floor, hero.x);
      if (ladder) hero.climb = { ladder, p: CLIMB_STEP };
      return [];
    }
    if (action === "down") {
      if (hero.climb) {
        hero.climb.p = Math.max(0, hero.climb.p - CLIMB_STEP);
        if (hero.climb.p <= 0) {
          hero.floor = hero.climb.ladder.floor;
          hero.x = hero.climb.ladder.x;
          hero.climb = null;
        }
        return [];
      }
      if (hero.jump) return [];
      const ladder = ladderDown(hero.floor, hero.x);
      if (ladder) {
        hero.floor = ladder.floor;
        hero.climb = { ladder, p: 1 - CLIMB_STEP };
      }
      return [];
    }
    if (action === "jump" && !hero.climb && !hero.jump) {
      hero.jump = { ms: 0 };
      return [{ type: "jump" }];
    }
    return [];
  };

  /** The hero reached the beacon: bonus, next level, back to the start. */
  function clear() {
    const bonus = state.bonus;
    state.score += bonus;
    state.level += 1;
    reset();
    return [{ type: "clear", level: state.level, bonus }];
  }

  /** Moves one crate; false when it has rolled off the ground girder. */
  const moveCrate = (c, dt) => {
    if (c.fall) {
      if (c.fall.ladder) c.fall.y += LADDER_SPEED * dt;
      else {
        c.fall.vy += GRAVITY * dt;
        c.fall.y += c.fall.vy * dt;
      }
      const landing = FLOORS[c.fall.to].y;
      if (c.fall.y >= landing) {
        c.floor = c.fall.to;
        c.dir = rollDir(c.floor);
        c.fall = null;
        c.scored = false;
      }
      return true;
    }
    const f = FLOORS[c.floor];
    const before = c.x;
    c.x += c.dir * crateSpeed(state.level) * dt;
    // Now and then a crate takes a ladder it rolls over.
    if (c.floor > 0) {
      const ladder = ladderDown(c.floor, (before + c.x) / 2, Math.abs(c.x - before) / 2 + 0.5);
      if (ladder && c.lastLadder !== ladder.x) {
        c.lastLadder = ladder.x;
        if (rng.next() < LADDER_CHANCE) {
          c.x = ladder.x;
          c.fall = { y: f.y, vy: 0, to: c.floor - 1, ladder: true };
          return true;
        }
      }
    }
    if (c.floor === 0) return c.x > -CRATE_R * 2;
    if ((c.dir > 0 && c.x > f.x1) || (c.dir < 0 && c.x < f.x0)) {
      c.fall = { y: f.y, vy: 0, to: c.floor - 1, ladder: false };
    }
    return true;
  };

  /** A crate touching the hero: true for a hit. */
  const touches = (c, feet) => {
    const m = crateMiddle(c);
    return (
      Math.abs(m.x - feet.x) < 4 + CRATE_R - 1 &&
      m.y + CRATE_R > feet.y - 12 + 1 &&
      m.y - CRATE_R < feet.y - 1
    );
  };

  const step = (ms) => {
    const events = [];
    if (state.over) return events;
    const dt = ms / 1000;

    if (state.freeze > 0) {
      state.freeze = Math.max(0, state.freeze - ms);
      if (state.freeze === 0) reset();
      return events;
    }

    // The bonus runs down while you climb.
    state.bonusClock += ms;
    while (state.bonusClock >= 2000) {
      state.bonusClock -= 2000;
      state.bonus = Math.max(0, state.bonus - 100);
    }

    // The jump arc.
    const hero = state.hero;
    if (hero.jump) {
      hero.jump.ms += ms;
      if (hero.jump.ms >= JUMP_MS) hero.jump = null;
    }

    // The robot throws.
    if (state.throwing > 0) state.throwing = Math.max(0, state.throwing - ms);
    state.throwIn -= ms;
    if (state.throwIn <= 0) {
      state.crates.push({ x: ROBOT_X + 14, floor: TOP_FLOOR, dir: 1, fall: null, scored: false });
      state.throwIn = throwMs(state.level) + rng.int(600);
      state.throwing = 300;
      events.push({ type: "throw" });
    }

    // Crates roll, drop and leave.
    state.crates = state.crates.filter((c) => moveCrate(c, dt));

    // Hits and leaps.
    const feet = heroFeet(hero);
    for (const c of state.crates) {
      if (touches(c, feet)) {
        state.lives -= 1;
        events.push({ type: "die" });
        if (state.lives <= 0) {
          state.over = true;
          events.push({ type: "over" });
        } else {
          state.freeze = FREEZE_MS;
        }
        return events;
      }
      if (
        hero.jump &&
        !c.fall &&
        !c.scored &&
        c.floor === hero.floor &&
        Math.abs(c.x - hero.x) < 5
      ) {
        c.scored = true;
        state.score += LEAP_POINTS;
        events.push({ type: "leap", points: LEAP_POINTS });
      }
    }
    return events;
  };

  return { state, act, step };
}
