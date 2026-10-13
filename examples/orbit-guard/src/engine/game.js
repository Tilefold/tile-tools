/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Orbit Guard — the game
 *
 * A fixed shooter. Five rows of drones march across the sky, step down at
 * each edge and drop bombs; your cannon moves along the ground and fires
 * one shot at a time, from behind four shields that wear away. Now and
 * then a courier ship crosses the top for bonus points. Clear the wave and
 * the next one starts lower and marches faster. You lose a cannon to a
 * bomb, and the game when the drones reach the ground or your last cannon
 * goes.
 *
 * Pure and deterministic: no Tilefold, no clock, no randomness of its own.
 * Time arrives through `step(ms)`, input through `act(action)`, and the
 * random numbers come from the seeded generator, so a seed replays exactly.
 * Both return the events that happened (for sounds), and `state` is plain
 * data the renderer reads.
 */
import { createRng } from "./rng.js";

/** The field, in logical pixels; the top `TOP` rows hold the score bar. */
export const W = 240;
export const H = 256;
export const TOP = 18;

/** The drone grid. */
export const ROWS = 5;
export const COLS = 8;
export const DRONE_W = 16;
export const DRONE_H = 12;
export const SPACE_X = 22;
export const SPACE_Y = 16;

/** The cannon. */
export const CANNON_Y = H - 18;
export const CANNON_W = 16;
export const CANNON_H = 8;
export const STEP = 6;

/** Shots and bombs, in pixels per second. */
export const SHOT_SPEED = 260;
export const BOMB_SPEED = 110;
export const MAX_BOMBS = 3;

/** Shields: four blocks of 6×4 cells, each cell 4 pixels square. */
export const SHIELDS = 4;
export const SHIELD_COLS = 6;
export const SHIELD_ROWS = 4;
export const CELL = 4;
export const SHIELD_Y = H - 52;

/** The courier ship. */
export const SHIP_Y = TOP + 4;
export const SHIP_W = 20;
export const SHIP_SPEED = 60;
export const SHIP_POINTS = [50, 100, 150, 300];

/** Points for a drone in each row, top to bottom. */
export const ROW_POINTS = [30, 20, 20, 10, 10];

/** How long a lost cannon takes to come back, in ms. */
export const RESPAWN_MS = 1200;

/** The left edge of shield `i`. */
export const shieldX = (i) => 30 + i * 60 - (SHIELD_COLS * CELL) / 2;

/**
 * The time between two marching steps: faster with fewer drones and higher levels.
 *
 * @param {number} alive Drones left.
 * @param {number} level
 * @returns {number}
 */
export function marchMs(alive, level) {
  return Math.max(60, 40 + alive * 13 - (level - 1) * 40);
}

/** A fresh wave: every drone alive, the grid lower for later levels, shields whole. */
function wave(state) {
  state.drones = new Array(ROWS * COLS).fill(true);
  state.ox = 20;
  state.oy = TOP + 22 + Math.min(state.level - 1, 5) * 8;
  state.dir = 1;
  state.frame = 0;
  state.marchIn = marchMs(ROWS * COLS, state.level);
  // Each shield is a block with an arch cut into the middle of its base.
  state.shields = Array.from({ length: SHIELDS }, () =>
    Array.from(
      { length: SHIELD_COLS * SHIELD_ROWS },
      (_, i) =>
        !(i >= SHIELD_COLS * (SHIELD_ROWS - 1) && i % SHIELD_COLS >= 2 && i % SHIELD_COLS <= 3),
    ),
  );
  state.shot = null;
  state.bombs = [];
}

/** True when two rectangles overlap. */
const hits = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;

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
    cannon: { x: W / 2, down: 0 },
    ship: null,
    shipIn: 12_000 + rng.int(8000),
    blasts: [],
  };
  wave(state);

  /** The drone at (row, col), its rectangle, or null when it is gone. */
  const droneAt = (row, col) =>
    state.drones[row * COLS + col]
      ? { x: state.ox + col * SPACE_X, y: state.oy + row * SPACE_Y }
      : null;

  /** Removes the shield cell under a point; true when one was there. */
  const chipShield = (x, y) => {
    for (let i = 0; i < SHIELDS; i++) {
      const sx = shieldX(i);
      if (
        x < sx ||
        x >= sx + SHIELD_COLS * CELL ||
        y < SHIELD_Y ||
        y >= SHIELD_Y + SHIELD_ROWS * CELL
      )
        continue;
      const c = Math.floor((x - sx) / CELL) + Math.floor((y - SHIELD_Y) / CELL) * SHIELD_COLS;
      if (state.shields[i][c]) {
        state.shields[i][c] = false;
        return true;
      }
    }
    return false;
  };

  const act = (action) => {
    if (state.over || state.cannon.down > 0) return [];
    if (action === "left") state.cannon.x = Math.max(10, state.cannon.x - STEP);
    else if (action === "right") state.cannon.x = Math.min(W - 10, state.cannon.x + STEP);
    else if (action === "fire" && !state.shot) {
      state.shot = { x: state.cannon.x, y: CANNON_Y - 4 };
      return [{ type: "fire" }];
    }
    return [];
  };

  /** Moves the grid one step, down a row at an edge; ends the game at the ground. */
  const march = (events) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let lowest = -Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = droneAt(r, c);
        if (!d) continue;
        minX = Math.min(minX, d.x);
        maxX = Math.max(maxX, d.x + DRONE_W);
        lowest = Math.max(lowest, d.y + DRONE_H);
      }
    }
    const dx = 4 * state.dir;
    if (minX + dx < 4 || maxX + dx > W - 4) {
      state.oy += 8;
      state.dir = -state.dir;
      lowest += 8;
    } else {
      state.ox += dx;
    }
    state.frame = 1 - state.frame;
    // Drones grind through the shields they reach.
    if (lowest >= SHIELD_Y) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const d = droneAt(r, c);
          if (!d) continue;
          for (let x = d.x; x < d.x + DRONE_W; x += CELL)
            for (let y = d.y; y < d.y + DRONE_H; y += CELL) chipShield(x, y);
        }
      }
    }
    if (lowest >= CANNON_Y) {
      state.over = true;
      events.push({ type: "over" });
    }
  };

  /** A random bottom drone drops a bomb, now and then. */
  const maybeBomb = (ms) => {
    if (state.bombs.length >= MAX_BOMBS || state.cannon.down > 0) return;
    const chance = (ms / 1000) * (0.9 + state.level * 0.25);
    if (rng.next() > chance) return;
    const cols = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (droneAt(r, c)) {
          cols.push(droneAt(r, c));
          break;
        }
      }
    }
    if (!cols.length) return;
    const d = cols[rng.int(cols.length)];
    state.bombs.push({ x: d.x + DRONE_W / 2, y: d.y + DRONE_H });
  };

  const step = (ms) => {
    const events = [];
    if (state.over) return events;
    const dt = ms / 1000;

    state.blasts = state.blasts.map((b) => ({ ...b, ms: b.ms - ms })).filter((b) => b.ms > 0);
    if (state.cannon.down > 0) state.cannon.down = Math.max(0, state.cannon.down - ms);

    // The cannon's shot.
    if (state.shot) {
      state.shot.y -= SHOT_SPEED * dt;
      const s = state.shot;
      let spent = s.y < TOP;
      if (!spent && chipShield(s.x, s.y)) spent = true;
      for (let r = 0; r < ROWS && !spent; r++) {
        for (let c = 0; c < COLS && !spent; c++) {
          const d = droneAt(r, c);
          if (d && hits(s.x - 1, s.y, 2, 6, d.x, d.y, DRONE_W, DRONE_H)) {
            state.drones[r * COLS + c] = false;
            state.score += ROW_POINTS[r];
            state.blasts.push({ x: d.x, y: d.y, ms: 200 });
            events.push({ type: "hit", points: ROW_POINTS[r] });
            spent = true;
          }
        }
      }
      const ship = state.ship;
      if (!spent && ship && hits(s.x - 1, s.y, 2, 6, ship.x, SHIP_Y, SHIP_W, 8)) {
        state.score += ship.points;
        state.blasts.push({ x: ship.x, y: SHIP_Y, ms: 400, points: ship.points });
        events.push({ type: "ship", points: ship.points });
        state.ship = null;
        spent = true;
      }
      if (spent) state.shot = null;
    }

    // Bombs.
    for (const b of state.bombs) b.y += BOMB_SPEED * dt;
    state.bombs = state.bombs.filter((b) => {
      if (b.y > H || chipShield(b.x, b.y)) return false;
      const cx = state.cannon.x - CANNON_W / 2;
      if (state.cannon.down === 0 && hits(b.x - 1, b.y, 2, 6, cx, CANNON_Y, CANNON_W, CANNON_H)) {
        state.lives -= 1;
        state.blasts.push({ x: cx, y: CANNON_Y, ms: 600 });
        events.push({ type: "die" });
        state.cannon.down = RESPAWN_MS;
        if (state.lives <= 0) {
          state.over = true;
          events.push({ type: "over" });
        }
        return false;
      }
      return true;
    });
    if (state.cannon.down > 0) state.bombs = state.bombs.filter((b) => b.y < SHIELD_Y);
    if (state.over) return events;

    // The courier ship.
    if (state.ship) {
      state.ship.x += state.ship.dir * SHIP_SPEED * dt;
      if (state.ship.x < -SHIP_W || state.ship.x > W) state.ship = null;
    } else {
      state.shipIn -= ms;
      if (state.shipIn <= 0) {
        const dir = rng.next() < 0.5 ? 1 : -1;
        state.ship = {
          x: dir > 0 ? -SHIP_W : W,
          dir,
          points: SHIP_POINTS[rng.int(SHIP_POINTS.length)],
        };
        state.shipIn = 15_000 + rng.int(10_000);
      }
    }

    // The drones march, and drop bombs.
    const alive = state.drones.filter(Boolean).length;
    if (alive === 0) {
      state.level += 1;
      wave(state);
      events.push({ type: "wave", level: state.level });
      return events;
    }
    state.marchIn -= ms;
    while (state.marchIn <= 0 && !state.over) {
      march(events);
      state.marchIn += marchMs(alive, state.level);
    }
    maybeBomb(ms);
    return events;
  };

  return { state, act, step };
}
