// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump — engine tests
 *
 * The site's layout is sound (every ladder joins two girders inside both,
 * every gap drops onto the girder below, crates roll towards the gaps), and
 * the game on its own: walking stays on the girder; ladders are climbed a
 * step at a time, up and down; a jump arcs and ends; the robot throws
 * crates that roll, drop through gaps, sometimes take a ladder and leave at
 * the bottom; jumping a crate scores; a crate that touches you costs a life
 * and freezes the field; the last life ends the game; the beacon brings the
 * bonus and the next, faster level; a seed replays exactly.
 */
import { describe, expect, it } from "vitest";
import {
  CLIMB_STEP,
  FREEZE_MS,
  JUMP_MS,
  LEAP_POINTS,
  START_BONUS,
  STEP,
  crateSpeed,
  createGame,
  heroFeet,
  throwMs,
} from "../../examples/girder-jump/src/engine/game.js";
import {
  FLOORS,
  LADDERS,
  LEDGE,
  START,
  TOP_FLOOR,
  ladderDown,
  ladderUp,
  rollDir,
} from "../../examples/girder-jump/src/engine/level.js";

/** Runs the clock for `ms` in 50 ms steps; returns every event. */
function run(game, ms) {
  const events = [];
  for (let t = 0; t < ms; t += 50) events.push(...game.step(50));
  return events;
}

/** A game where the robot never throws, so a test places the crates. */
function calm(seed = 1) {
  const g = createGame(seed);
  g.state.throwIn = Infinity;
  return g;
}

describe("the site", () => {
  it("joins girders with ladders that stand inside both", () => {
    for (const l of LADDERS) {
      for (const f of [FLOORS[l.floor], FLOORS[l.floor + 1]]) {
        expect(l.x).toBeGreaterThan(f.x0);
        expect(l.x).toBeLessThan(f.x1);
      }
    }
    // Every girder can be reached from the one below.
    for (let floor = 0; floor < LEDGE; floor++) {
      expect(
        LADDERS.some((l) => l.floor === floor),
        `floor ${floor}`,
      ).toBe(true);
    }
  });

  it("rolls crates towards each girder's gap, which drops onto the girder below", () => {
    for (let floor = 1; floor <= TOP_FLOOR; floor++) {
      const f = FLOORS[floor];
      const below = FLOORS[floor - 1];
      const dropX = rollDir(floor) > 0 ? f.x1 + 3 : f.x0 - 3;
      expect(dropX).toBeGreaterThan(below.x0);
      expect(dropX).toBeLessThan(below.x1);
    }
    expect(rollDir(TOP_FLOOR)).toBe(1);
    expect(rollDir(0)).toBe(-1);
  });

  it("finds ladders up and down near a point", () => {
    expect(ladderUp(0, 194)).toEqual({ floor: 0, x: 196 });
    expect(ladderUp(0, 100)).toBeNull();
    expect(ladderDown(1, 199)).toEqual({ floor: 0, x: 196 });
    expect(ladderDown(0, 196)).toBeNull();
  });
});

describe("moving", () => {
  it("starts at the bottom left with three lives and walks within the girder", () => {
    const g = calm();
    expect(g.state).toMatchObject({ score: 0, lives: 3, level: 1, bonus: START_BONUS });
    expect(g.state.hero).toMatchObject({ floor: START.floor, x: START.x });
    g.act("right");
    expect(g.state.hero).toMatchObject({ x: START.x + STEP, facing: 1 });
    for (let i = 0; i < 100; i++) g.act("left");
    expect(g.state.hero.x).toBe(FLOORS[0].x0 + 4);
  });

  it("climbs a ladder a step at a time, and back down", () => {
    const g = calm();
    g.state.hero.x = 194;
    g.act("up");
    expect(g.state.hero.climb).toMatchObject({ p: CLIMB_STEP });
    // No walking off a ladder.
    g.act("left");
    expect(heroFeet(g.state.hero).x).toBe(196);
    for (let i = 0; i < 3; i++) g.act("up");
    expect(g.state.hero).toMatchObject({ floor: 1, x: 196, climb: null });
    g.act("down");
    expect(g.state.hero.floor).toBe(0);
    expect(g.state.hero.climb.p).toBe(1 - CLIMB_STEP);
    for (let i = 0; i < 3; i++) g.act("down");
    expect(g.state.hero).toMatchObject({ floor: 0, climb: null });
  });

  it("only climbs where there is a ladder", () => {
    const g = calm();
    g.act("up");
    g.act("down");
    expect(g.state.hero).toMatchObject({ floor: 0, climb: null, x: START.x });
  });

  it("jumps in an arc that lands again", () => {
    const g = calm();
    expect(g.act("jump")).toEqual([{ type: "jump" }]);
    expect(g.act("jump")).toEqual([]);
    run(g, JUMP_MS / 2);
    expect(heroFeet(g.state.hero).y).toBeLessThan(FLOORS[0].y - 10);
    run(g, JUMP_MS);
    expect(g.state.hero.jump).toBeNull();
    expect(heroFeet(g.state.hero).y).toBe(FLOORS[0].y);
  });
});

describe("crates", () => {
  it("are thrown by the robot on the top girder, rolling right", () => {
    const g = createGame(1);
    g.state.throwIn = 10;
    expect(run(g, 50)).toContainEqual({ type: "throw" });
    expect(g.state.crates[0]).toMatchObject({ floor: TOP_FLOOR, dir: 1 });
    expect(g.state.throwing).toBeGreaterThan(0);
  });

  it("drop through a gap and roll the other way below", () => {
    const g = calm(3);
    const f = FLOORS[2];
    g.state.crates = [
      { x: f.x0 + 1, floor: 2, dir: -1, fall: null, scored: false, lastLadder: 190 },
    ];
    run(g, 1000);
    expect(g.state.crates[0]).toMatchObject({ floor: 1, dir: 1, fall: null });
  });

  it("sometimes take a ladder down", () => {
    let took = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = calm(seed);
      // Roll over the top of the ladder from girder 0 to girder 1.
      g.state.crates = [{ x: 205, floor: 1, dir: -1, fall: null, scored: false }];
      g.state.hero.x = START.x;
      run(g, 400);
      const c = g.state.crates[0];
      if (c && (c.floor === 0 || (c.fall && c.fall.ladder))) took++;
    }
    expect(took).toBeGreaterThan(0);
    expect(took).toBeLessThan(30);
  });

  it("leave at the bottom left", () => {
    const g = calm();
    g.state.hero.x = 200;
    g.state.crates = [{ x: 20, floor: 0, dir: -1, fall: null, scored: false }];
    run(g, 1500);
    expect(g.state.crates).toEqual([]);
  });

  it("roll faster and come more often at higher levels", () => {
    expect(crateSpeed(3)).toBeGreaterThan(crateSpeed(1));
    expect(crateSpeed(50)).toBe(95);
    expect(throwMs(4)).toBeLessThan(throwMs(1));
    expect(throwMs(50)).toBe(1100);
  });
});

describe("hits and leaps", () => {
  it("score for jumping over a crate", () => {
    const g = calm();
    g.state.hero.x = 100;
    // Jumping when the crate is about three steps away clears it.
    g.state.crates = [{ x: 118, floor: 0, dir: -1, fall: null, scored: false }];
    g.act("jump");
    const events = run(g, JUMP_MS);
    expect(events).toContainEqual({ type: "leap", points: LEAP_POINTS });
    expect(g.state.score).toBe(LEAP_POINTS);
    expect(g.state.lives).toBe(3);
  });

  it("can be cleared from a range of distances at every level, not one exact moment", () => {
    for (let level = 1; level <= 8; level++) {
      let cleared = 0;
      for (let d = 8; d <= 40; d++) {
        const g = calm();
        g.state.level = level;
        g.state.hero.x = 100;
        g.state.crates = [{ x: 100 + d, floor: 0, dir: -1, fall: null, scored: false }];
        g.act("jump");
        const events = run(g, 2000);
        if (!events.some((e) => e.type === "die") && g.state.score > 0) cleared++;
      }
      expect(cleared, `level ${level}`).toBeGreaterThanOrEqual(10);
    }
  });

  it("cost a life and freeze the field, then start again from the bottom", () => {
    const g = calm();
    g.state.hero.x = 100;
    g.state.crates = [{ x: 112, floor: 0, dir: -1, fall: null, scored: false }];
    const events = run(g, 600);
    expect(events).toContainEqual({ type: "die" });
    expect(g.state.lives).toBe(2);
    expect(g.state.freeze).toBeGreaterThan(0);
    expect(g.act("right")).toEqual([]);
    run(g, FREEZE_MS + 50);
    expect(g.state.freeze).toBe(0);
    expect(g.state.hero).toMatchObject({ floor: START.floor, x: START.x });
    expect(g.state.crates).toEqual([]);
  });

  it("end the game with the last life", () => {
    const g = calm();
    g.state.lives = 1;
    g.state.hero.x = 100;
    g.state.crates = [{ x: 112, floor: 0, dir: -1, fall: null, scored: false }];
    const events = run(g, 600);
    expect(events).toContainEqual({ type: "over" });
    expect(g.state.over).toBe(true);
    expect(g.step(50)).toEqual([]);
  });
});

describe("the beacon", () => {
  it("brings the bonus and the next level, back at the start", () => {
    const g = calm();
    run(g, 4000);
    expect(g.state.bonus).toBe(START_BONUS - 200);
    g.state.hero = { floor: 5, x: 120, climb: null, jump: null, facing: 1 };
    const events = [];
    for (let i = 0; i < 4; i++) events.push(...g.act("up"));
    expect(events).toEqual([{ type: "clear", level: 2, bonus: START_BONUS - 200 }]);
    expect(g.state).toMatchObject({ level: 2, score: START_BONUS - 200, bonus: START_BONUS });
    expect(g.state.hero).toMatchObject({ floor: START.floor, x: START.x });
  });
});

describe("seeds", () => {
  it("replay exactly", () => {
    const play = (seed) => {
      const g = createGame(seed);
      const log = [];
      for (let i = 0; i < 600; i++) {
        if (i % 4 === 0) g.act("right");
        if (i % 15 === 0) g.act("jump");
        if (i % 6 === 0) g.act("up");
        log.push(...g.step(50).map((e) => e.type));
      }
      return { log, score: g.state.score, crates: g.state.crates.length };
    };
    expect(play(11)).toEqual(play(11));
  });
});
