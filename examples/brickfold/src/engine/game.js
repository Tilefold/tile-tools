/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Brickfold — the game
 *
 * A brick breaker. Bounce the ball off your paddle to break the wall of
 * bricks above; where the ball meets the paddle decides its angle. Bricks
 * marked tough take two hits. Clear the wall for the next level's pattern,
 * with a faster ball. Miss the ball and you lose one; the game ends with
 * the last.
 *
 * Pure and deterministic: time arrives through `step(ms)`, input through
 * `act(action)`, and the only randomness (the launch angle) comes from the
 * seeded generator. Both return the events that happened, for sounds.
 */
import { createRng } from "./rng.js";

/** The field; the top `TOP` rows hold the score bar. */
export const W = 240;
export const H = 256;
export const TOP = 18;

/** The wall. */
export const COLS = 10;
export const ROWS = 6;
export const BRICK_W = 22;
export const BRICK_H = 9;
export const BRICK_GAP = 1;
export const WALL_X = (W - COLS * (BRICK_W + BRICK_GAP) + BRICK_GAP) / 2;
export const WALL_Y = TOP + 22;

/** Points for a brick in each row, top to bottom. */
export const ROW_POINTS = [60, 50, 40, 30, 20, 10];

/** The paddle. */
export const PADDLE_Y = H - 16;
export const PADDLE_W = 40;
export const PADDLE_H = 6;
export const STEP = 14;

/** The ball. */
export const BALL_R = 3;
export const MAX_SPEED = 300;

/**
 * Wall patterns, one per level (then they repeat, faster): `#` a brick,
 * `X` a tough brick (two hits), `.` a gap. Each row is COLS wide.
 */
export const PATTERNS = [
  ["##########", "##########", "##########", "##########", "##########", "##########"],
  ["..######..", ".########.", "####XX####", "##########", ".########.", "..######.."],
  ["#.#.#.#.#.", ".#.#.#.#.#", "XXXXXXXXXX", "#.#.#.#.#.", ".#.#.#.#.#", "##########"],
  ["X########X", "#X######X#", "##X####X##", "###X##X###", "####XX####", "##########"],
];

/**
 * The ball's speed at a level, in pixels per second.
 *
 * @param {number} level
 * @returns {number}
 */
export function ballSpeed(level) {
  return Math.min(MAX_SPEED, 150 + (level - 1) * 18);
}

/**
 * The wall for a level: hits left per brick (0 for a gap), row by row.
 *
 * @param {number} level
 * @returns {number[]}
 */
export function wallFor(level) {
  const pattern = PATTERNS[(level - 1) % PATTERNS.length];
  return pattern.flatMap((row) => [...row].map((c) => (c === "X" ? 2 : c === "#" ? 1 : 0)));
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
    paddle: { x: W / 2 },
    ball: { x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, stuck: true },
    bricks: wallFor(1),
  };

  /** Puts the ball back on the paddle, waiting for a launch. */
  const stick = () => {
    state.ball = { x: state.paddle.x, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, stuck: true };
  };

  /** Sends the ball up at `angle` radians from straight up (negative = left). */
  const aim = (angle) => {
    const speed = ballSpeed(state.level);
    state.ball.vx = Math.sin(angle) * speed;
    state.ball.vy = -Math.cos(angle) * speed;
  };

  const act = (action) => {
    if (state.over) return [];
    if (action === "left" || action === "right") {
      const dx = action === "left" ? -STEP : STEP;
      state.paddle.x = Math.min(
        W - PADDLE_W / 2 - 2,
        Math.max(PADDLE_W / 2 + 2, state.paddle.x + dx),
      );
      if (state.ball.stuck) state.ball.x = state.paddle.x;
      return [];
    }
    if (action === "launch" && state.ball.stuck) {
      state.ball.stuck = false;
      aim((rng.next() - 0.5) * 1.2);
      return [{ type: "launch" }];
    }
    return [];
  };

  /** The brick a point is inside, as its index, or -1. */
  const brickAt = (x, y) => {
    const col = Math.floor((x - WALL_X) / (BRICK_W + BRICK_GAP));
    const row = Math.floor((y - WALL_Y) / (BRICK_H + BRICK_GAP));
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    const i = row * COLS + col;
    return state.bricks[i] > 0 ? i : -1;
  };

  /** Moves the ball a short way (a few pixels), bouncing off whatever it meets. */
  const move = (dt, events) => {
    const b = state.ball;
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;

    // Walls and ceiling.
    if (nx - BALL_R < 0 || nx + BALL_R > W) b.vx = -b.vx;
    if (ny - BALL_R < TOP) b.vy = Math.abs(b.vy);

    // Bricks: test the leading edge in x and in y separately, so the ball
    // bounces off the side it actually hit.
    const edgeX = nx + Math.sign(b.vx) * BALL_R;
    const edgeY = ny + Math.sign(b.vy) * BALL_R;
    const hitX = brickAt(edgeX, b.y);
    const hitY = brickAt(b.x, edgeY);
    for (const i of new Set([hitX, hitY])) {
      if (i < 0) continue;
      state.bricks[i] -= 1;
      const broken = state.bricks[i] === 0;
      if (broken) state.score += ROW_POINTS[Math.floor(i / COLS)];
      events.push({ type: "brick", broken });
    }
    if (hitX >= 0) b.vx = -b.vx;
    if (hitY >= 0) b.vy = -b.vy;

    // The paddle: the further from its middle, the steeper the bounce.
    const px = state.paddle.x;
    if (
      b.vy > 0 &&
      ny + BALL_R >= PADDLE_Y &&
      b.y + BALL_R <= PADDLE_Y + PADDLE_H &&
      nx >= px - PADDLE_W / 2 - BALL_R &&
      nx <= px + PADDLE_W / 2 + BALL_R
    ) {
      const offset = Math.max(-1, Math.min(1, (nx - px) / (PADDLE_W / 2)));
      aim(offset * 1.05);
      events.push({ type: "paddle" });
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.x = Math.max(BALL_R, Math.min(W - BALL_R, b.x));
  };

  const step = (ms) => {
    const events = [];
    if (state.over || state.ball.stuck) return events;
    // Small steps, so a fast ball never jumps through a brick.
    const speed = Math.hypot(state.ball.vx, state.ball.vy) || 1;
    const parts = Math.max(1, Math.ceil((speed * ms) / 1000 / 2));
    for (let i = 0; i < parts && !state.ball.stuck; i++) {
      move(ms / 1000 / parts, events);
      if (state.ball.y - BALL_R > H) {
        state.lives -= 1;
        events.push({ type: "lose" });
        if (state.lives <= 0) {
          state.over = true;
          events.push({ type: "over" });
          return events;
        }
        stick();
      }
    }
    if (state.bricks.every((n) => n === 0)) {
      state.level += 1;
      state.bricks = wallFor(state.level);
      stick();
      events.push({ type: "level", level: state.level });
    }
    return events;
  };

  return { state, act, step };
}
