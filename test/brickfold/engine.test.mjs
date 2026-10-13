// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Brickfold — engine tests
 *
 * The game on its own: the paddle moves within the field and carries the
 * waiting ball; a launch sends it up; walls and the ceiling bounce it; a
 * brick breaks (tough ones take two hits) and scores by row; the paddle's
 * edge sends it out steeper than its middle; a missed ball costs one and
 * waits on the paddle again; the last miss ends the game; a cleared wall
 * brings the next pattern and a faster ball; a seed replays exactly.
 */
import { describe, expect, it } from "vitest";
import {
  BALL_R,
  BRICK_GAP,
  BRICK_H,
  BRICK_W,
  COLS,
  H,
  PADDLE_W,
  PADDLE_Y,
  PATTERNS,
  ROW_POINTS,
  STEP,
  TOP,
  W,
  WALL_X,
  WALL_Y,
  ballSpeed,
  createGame,
  wallFor,
} from "../../examples/brickfold/src/engine/game.js";

/** Runs the clock for `ms` in 40 ms steps; returns every event. */
function run(game, ms) {
  const events = [];
  for (let t = 0; t < ms; t += 40) events.push(...game.step(40));
  return events;
}

/** Puts the ball somewhere, moving with (vx, vy). */
function ballAt(game, x, y, vx, vy) {
  game.state.ball = { x, y, vx, vy, stuck: false };
}

/** The middle of brick `i`. */
const brickMiddle = (i) => ({
  x: WALL_X + (i % COLS) * (BRICK_W + BRICK_GAP) + BRICK_W / 2,
  y: WALL_Y + Math.floor(i / COLS) * (BRICK_H + BRICK_GAP) + BRICK_H / 2,
});

describe("the paddle", () => {
  it("starts in the middle with the ball waiting on it, and carries the ball as it moves", () => {
    const g = createGame(1);
    expect(g.state).toMatchObject({ score: 0, lives: 3, level: 1, over: false });
    expect(g.state.ball).toMatchObject({ x: W / 2, y: PADDLE_Y - BALL_R, stuck: true });
    g.act("left");
    expect(g.state.paddle.x).toBe(W / 2 - STEP);
    expect(g.state.ball.x).toBe(W / 2 - STEP);
    // A waiting ball doesn't move with the clock.
    expect(g.step(40)).toEqual([]);
  });

  it("stays within the field", () => {
    const g = createGame(1);
    for (let i = 0; i < 50; i++) g.act("left");
    expect(g.state.paddle.x).toBe(PADDLE_W / 2 + 2);
    for (let i = 0; i < 50; i++) g.act("right");
    expect(g.state.paddle.x).toBe(W - PADDLE_W / 2 - 2);
  });

  it("launches the ball upwards at the level's speed, once", () => {
    const g = createGame(1);
    expect(g.act("launch")).toEqual([{ type: "launch" }]);
    expect(g.act("launch")).toEqual([]);
    const { vx, vy, stuck } = g.state.ball;
    expect(stuck).toBe(false);
    expect(vy).toBeLessThan(0);
    expect(Math.hypot(vx, vy)).toBeCloseTo(ballSpeed(1), 5);
  });
});

describe("bounces", () => {
  it("off the side walls and the ceiling", () => {
    const g = createGame(1);
    g.state.bricks.fill(0);
    g.state.bricks[0] = 1; // keep the level from ending
    ballAt(g, W - BALL_R - 1, 150, 150, 0);
    g.step(40);
    expect(g.state.ball.vx).toBeLessThan(0);
    ballAt(g, 120, TOP + BALL_R + 1, 0, -150);
    g.step(40);
    expect(g.state.ball.vy).toBeGreaterThan(0);
  });

  it("off the paddle, steeper from its edge than from its middle", () => {
    const middle = createGame(1);
    ballAt(middle, middle.state.paddle.x, PADDLE_Y - 6, 0, 150);
    expect(run(middle, 120)).toContainEqual({ type: "paddle" });
    const edge = createGame(1);
    ballAt(edge, edge.state.paddle.x + PADDLE_W / 2 - 1, PADDLE_Y - 6, 0, 150);
    run(edge, 120);
    expect(middle.state.ball.vy).toBeLessThan(0);
    expect(Math.abs(edge.state.ball.vx)).toBeGreaterThan(Math.abs(middle.state.ball.vx) + 50);
    expect(edge.state.ball.vx).toBeGreaterThan(0);
  });
});

describe("bricks", () => {
  it("break, score by row, and turn the ball back", () => {
    const g = createGame(1);
    const i = 5 * COLS + 4; // bottom row
    const m = brickMiddle(i);
    ballAt(g, m.x, m.y + 12, 0, -150);
    const events = run(g, 200);
    expect(events).toContainEqual({ type: "brick", broken: true });
    expect(g.state.bricks[i]).toBe(0);
    expect(g.state.score).toBe(ROW_POINTS[5]);
    expect(g.state.ball.vy).toBeGreaterThan(0);
  });

  it("take two hits when tough", () => {
    const g = createGame(1);
    g.state.level = 2;
    g.state.bricks = wallFor(2);
    const i = PATTERNS[1].join("").indexOf("X");
    expect(g.state.bricks[i]).toBe(2);
    const m = brickMiddle(i);
    // Clear the bricks below so the ball reaches it.
    for (let r = Math.floor(i / COLS) + 1; r < 6; r++) g.state.bricks[r * COLS + (i % COLS)] = 0;
    ballAt(g, m.x, m.y + 12, 0, -150);
    expect(run(g, 200)).toContainEqual({ type: "brick", broken: false });
    expect(g.state.bricks[i]).toBe(1);
    expect(g.state.score).toBe(0);
  });
});

describe("missing", () => {
  it("costs a ball, which waits on the paddle again", () => {
    const g = createGame(1);
    ballAt(g, 10, H - 4, 0, 200);
    g.state.paddle.x = W - 30;
    const events = run(g, 200);
    expect(events).toContainEqual({ type: "lose" });
    expect(g.state.lives).toBe(2);
    expect(g.state.ball).toMatchObject({ stuck: true, x: g.state.paddle.x });
  });

  it("ends the game with the last ball", () => {
    const g = createGame(1);
    g.state.lives = 1;
    ballAt(g, 10, H - 4, 0, 200);
    g.state.paddle.x = W - 30;
    const events = run(g, 200);
    expect(events).toContainEqual({ type: "over" });
    expect(g.state.over).toBe(true);
    expect(g.act("left")).toEqual([]);
    expect(g.step(40)).toEqual([]);
  });
});

describe("levels", () => {
  it("bring the next pattern and a faster ball when the wall is clear", () => {
    const g = createGame(1);
    g.state.bricks.fill(0);
    ballAt(g, 120, 150, 0, -150);
    expect(g.step(40)).toContainEqual({ type: "level", level: 2 });
    expect(g.state.bricks).toEqual(wallFor(2));
    expect(g.state.ball.stuck).toBe(true);
    expect(ballSpeed(2)).toBeGreaterThan(ballSpeed(1));
    expect(ballSpeed(99)).toBe(300);
  });

  it("repeat the patterns after the last one", () => {
    expect(wallFor(PATTERNS.length + 1)).toEqual(wallFor(1));
    for (const p of PATTERNS) {
      expect(p).toHaveLength(6);
      for (const row of p) expect(row).toMatch(/^[#X.]{10}$/);
    }
  });
});

describe("seeds", () => {
  it("replay exactly", () => {
    const play = (seed) => {
      const g = createGame(seed);
      g.act("launch");
      const log = [];
      for (let i = 0; i < 600; i++) {
        const b = g.state.ball;
        if (b.x < g.state.paddle.x - 6) g.act("left");
        else if (b.x > g.state.paddle.x + 6) g.act("right");
        if (b.stuck) g.act("launch");
        log.push(...g.step(40).map((e) => e.type));
      }
      return { log, score: g.state.score };
    };
    expect(play(9)).toEqual(play(9));
  });
});
