/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — gravity loop
 *
 * Pulls the falling piece down one row at a time while a game runs. The
 * delay is asked for before every step, so the game speeds up the moment
 * the level changes. A chained timeout (not an interval) means a slow step
 * can never pile up behind itself, and stopping is immediate.
 */

/** The fastest step the loop will ever take, in ms (Tilefold caps updates at 60 a second). */
export const MIN_STEP_MS = 30;

/**
 * Creates the loop.
 *
 * @param {{ step: () => void, delay: () => number, onError?: (err: unknown) => void,
 *           setTimer?: (fn: () => void, ms: number) => any,
 *           clearTimer?: (handle: any) => void }} o
 *   `step` runs one gravity step; `delay` says how long to wait before the
 *   next one; `onError` hears about a step that threw. Timers default to
 *   the global ones (tests pass fakes or use fake timers).
 * @returns {{ start: () => void, stop: () => void, restart: () => void, readonly running: boolean }}
 */
export function createLoop(o) {
  const setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((h) => clearTimeout(h));
  let handle = null;
  let running = false;

  /** The next delay, kept to a sane range whatever `delay` returns. */
  const wait = () => {
    const ms = Number(o.delay());
    return Number.isFinite(ms) ? Math.max(MIN_STEP_MS, ms) : 1000;
  };

  const schedule = () => {
    handle = setTimer(() => {
      handle = null;
      if (!running) return;
      try {
        o.step();
      } catch (err) {
        // A failing step is reported, never thrown: an uncaught error in the
        // worker would count against the tile.
        if (o.onError) o.onError(err);
      }
      if (running) schedule();
    }, wait());
  };

  return {
    start() {
      if (running) return;
      running = true;
      schedule();
    },
    stop() {
      running = false;
      if (handle !== null) clearTimer(handle);
      handle = null;
    },
    /** Starts the wait again from now (after a piece locks, for example). */
    restart() {
      if (!running) return;
      if (handle !== null) clearTimer(handle);
      schedule();
    },
    get running() {
      return running;
    },
  };
}
