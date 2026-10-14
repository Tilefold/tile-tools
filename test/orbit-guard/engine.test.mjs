// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Orbit Guard — engine tests
 *
 * The game on its own, with seeds so every run is the same: the cannon
 * moves within the field and fires one shot at a time; shots score by row,
 * chip shields and down the courier ship; bombs chip shields and cost a
 * cannon, which comes back after a pause; the grid marches, steps down at
 * the edges and speeds up; a cleared wave starts the next level lower; the
 * game ends at the ground or with the last cannon; a seed replays exactly.
 */
import { describe, expect, it } from "vitest";
import {
  CANNON_Y,
  COLS,
  DRONE_H,
  RESPAWN_MS,
  ROW_POINTS,
  ROWS,
  SHIELD_COLS,
  SHIELD_ROWS,
  SHIELD_Y,
  SHIP_Y,
  SPACE_X,
  SPACE_Y,
  STEP,
  TOP,
  W,
  createGame,
  marchMs,
  shieldX,
} from "../../examples/orbit-guard/src/engine/game.js";

/** Runs the clock for `ms` in 50 ms steps; returns every event. */
function run(game, ms) {
  const events = [];
  for (let t = 0; t < ms; t += 50) events.push(...game.step(50));
  return events;
}

/** A game with no bombs and no courier, so a test controls what happens. */
function quiet(seed = 1) {
  const g = createGame(seed);
  g.state.shipIn = Infinity;
  const step = g.step;
  g.step = (ms) => {
    const events = step(ms);
    g.state.bombs = [];
    return events;
  };
  return g;
}

describe("the cannon", () => {
  it("starts in the middle with three cannons and moves a step at a time, within the field", () => {
    const g = createGame(1);
    expect(g.state).toMatchObject({ score: 0, lives: 3, level: 1, over: false });
    expect(g.state.cannon.x).toBe(W / 2);
    g.act("left");
    expect(g.state.cannon.x).toBe(W / 2 - STEP);
    for (let i = 0; i < 100; i++) g.act("left");
    expect(g.state.cannon.x).toBe(10);
    for (let i = 0; i < 100; i++) g.act("right");
    expect(g.state.cannon.x).toBe(W - 10);
  });

  it("fires one shot at a time", () => {
    const g = createGame(1);
    expect(g.act("fire")).toEqual([{ type: "fire" }]);
    expect(g.act("fire")).toEqual([]);
    expect(g.state.shot).toMatchObject({ x: W / 2, y: CANNON_Y - 4 });
  });
});

describe("shots", () => {
  it("score by row and remove the drone they hit", () => {
    const g = quiet();
    // Line the cannon up under the bottom-left drone, then fire.
    g.state.cannon.x = g.state.ox + 8;
    g.act("fire");
    // Clear the shield in the way.
    for (const s of g.state.shields) s.fill(false);
    const events = run(g, 1500);
    expect(events).toContainEqual({ type: "hit", points: ROW_POINTS[ROWS - 1] });
    expect(g.state.score).toBe(ROW_POINTS[ROWS - 1]);
    expect(g.state.drones.filter(Boolean)).toHaveLength(ROWS * COLS - 1);
    expect(g.state.shot).toBeNull();
  });

  it("chip a shield cell instead of passing through it", () => {
    const g = quiet();
    const x = shieldX(0) + 2;
    g.state.cannon.x = x;
    g.act("fire");
    run(g, 300);
    expect(g.state.shot).toBeNull();
    expect(g.state.shields[0].filter(Boolean).length).toBe(SHIELD_COLS * SHIELD_ROWS - 2 - 1);
  });

  it("down the courier ship for its points", () => {
    const g = quiet();
    g.state.ship = { x: 100, dir: 0, points: 150 };
    g.state.drones.fill(false);
    g.state.drones[0] = true;
    g.state.ox = 0;
    for (const s of g.state.shields) s.fill(false);
    g.state.cannon.x = 110;
    g.act("fire");
    const events = run(g, 1200);
    expect(events).toContainEqual({ type: "ship", points: 150 });
    expect(g.state.score).toBe(150);
    expect(g.state.ship).toBeNull();
  });
});

describe("bombs", () => {
  it("cost a cannon, which comes back after a pause", () => {
    const g = createGame(1);
    g.state.shipIn = Infinity;
    g.state.bombs = [{ x: g.state.cannon.x, y: CANNON_Y - 10 }];
    const events = run(g, 200);
    expect(events).toContainEqual({ type: "die" });
    expect(g.state.lives).toBe(2);
    expect(g.state.cannon.down).toBeGreaterThan(0);
    // No moving or firing while it is down.
    expect(g.act("fire")).toEqual([]);
    run(g, RESPAWN_MS);
    expect(g.state.cannon.down).toBe(0);
  });

  it("chip shields", () => {
    const g = createGame(1);
    g.state.shipIn = Infinity;
    const x = shieldX(1) + 1;
    g.state.bombs = [{ x, y: SHIELD_Y - 4 }];
    run(g, 100);
    expect(g.state.shields[1][0]).toBe(false);
  });

  it("end the game with the last cannon", () => {
    const g = createGame(1);
    g.state.lives = 1;
    g.state.bombs = [{ x: g.state.cannon.x, y: CANNON_Y - 5 }];
    const events = run(g, 200);
    expect(events).toContainEqual({ type: "over" });
    expect(g.state.over).toBe(true);
    // A finished game ignores everything.
    expect(g.step(50)).toEqual([]);
    expect(g.act("left")).toEqual([]);
  });
});

describe("the drones", () => {
  it("march faster as fewer remain and the level rises", () => {
    expect(marchMs(40, 1)).toBeGreaterThan(marchMs(10, 1));
    expect(marchMs(40, 1)).toBeGreaterThan(marchMs(40, 3));
    expect(marchMs(1, 9)).toBe(60);
  });

  it("march sideways, then step down and turn at the edge", () => {
    const g = quiet();
    const { ox, oy } = g.state;
    run(g, marchMs(ROWS * COLS, 1) + 10);
    expect(g.state.ox).toBe(ox + 4);
    expect(g.state.oy).toBe(oy);
    // Push the grid against the right edge.
    g.state.ox = W - 4 - (COLS - 1) * SPACE_X - 16;
    g.state.marchIn = 1;
    run(g, 50);
    expect(g.state.oy).toBe(oy + 8);
    expect(g.state.dir).toBe(-1);
  });

  it("end the game when they reach the ground", () => {
    const g = quiet();
    g.state.oy = CANNON_Y - (ROWS - 1) * SPACE_Y - DRONE_H - 4;
    g.state.marchIn = 1;
    g.state.ox = W - 4 - (COLS - 1) * SPACE_X - 16;
    const events = run(g, 100);
    expect(events).toContainEqual({ type: "over" });
  });

  it("come back lower and faster after a cleared wave", () => {
    const g = quiet();
    const firstY = g.state.oy;
    g.state.drones.fill(false);
    const events = run(g, 50);
    expect(events).toContainEqual({ type: "wave", level: 2 });
    expect(g.state.level).toBe(2);
    expect(g.state.drones.every(Boolean)).toBe(true);
    expect(g.state.oy).toBeGreaterThan(firstY);
    expect(g.state.oy).toBeGreaterThan(TOP);
  });
});

describe("the courier ship", () => {
  it("crosses the top now and then", () => {
    const g = quiet();
    g.state.shipIn = 100;
    run(g, 150);
    expect(g.state.ship).not.toBeNull();
    expect([50, 100, 150, 300]).toContain(g.state.ship.points);
    expect(SHIP_Y).toBeLessThan(g.state.oy);
  });
});

describe("seeds", () => {
  it("replay exactly", () => {
    const play = (seed) => {
      const g = createGame(seed);
      const log = [];
      for (let i = 0; i < 400; i++) {
        if (i % 7 === 0) g.act("fire");
        if (i % 5 === 0) g.act(i % 10 ? "left" : "right");
        log.push(...g.step(50).map((e) => e.type));
      }
      return { log, score: g.state.score, lives: g.state.lives, bombs: g.state.bombs.length };
    };
    expect(play(42)).toEqual(play(42));
  });
});
