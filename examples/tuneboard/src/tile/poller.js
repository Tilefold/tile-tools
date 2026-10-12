/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — poller
 *
 * Asks Spotify what is playing over and over, waiting however long the
 * session says between asks (the normal interval, a rate-limit pause or an
 * error back-off; null means stop until something changes). A chained
 * timeout rather than an interval means a slow answer never piles up
 * behind itself, only one ask is ever in flight, and stopping is
 * immediate. `soon(ms)` moves the next ask earlier, for example to confirm
 * a skip shortly after the user pressed it.
 */

/** The shortest wait the poller will ever take, in ms. */
export const MIN_WAIT_MS = 250;

/**
 * Creates the poller.
 *
 * @param {{ tick: () => Promise<unknown>, delay: () => number|null,
 *           onError?: (err: unknown) => void,
 *           setTimer?: (fn: () => void, ms: number) => any,
 *           clearTimer?: (handle: any) => void }} o
 *   `tick` asks once; `delay` says how long to wait before the next ask.
 *   Timers default to the global ones (tests use fake timers).
 * @returns {{ start: () => void, stop: () => void, soon: (ms?: number) => void,
 *             readonly running: boolean, readonly waiting: boolean }}
 */
export function createPoller(o) {
  const setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((h) => clearTimeout(h));
  let handle = null;
  let running = false;
  let busy = false;

  /** Clears any pending wait. */
  const cancel = () => {
    if (handle !== null) clearTimer(handle);
    handle = null;
  };

  /** Waits `ms`, then asks. */
  const wait = (ms) => {
    cancel();
    handle = setTimer(
      () => {
        handle = null;
        void ask();
      },
      Math.max(MIN_WAIT_MS, ms),
    );
  };

  /** Asks once, then schedules the next ask from the session's answer. */
  const ask = async () => {
    if (!running || busy) return;
    busy = true;
    try {
      await o.tick();
    } catch (err) {
      // A failing ask is reported, never thrown: an uncaught error in the
      // worker would count against the tile.
      if (o.onError) o.onError(err);
    } finally {
      busy = false;
    }
    if (!running || handle !== null) return;
    const next = o.delay();
    if (next !== null && Number.isFinite(next)) wait(next);
  };

  return {
    /** Starts polling with an ask right away. */
    start() {
      if (running) return;
      running = true;
      void ask();
    },
    stop() {
      running = false;
      cancel();
    },
    /** Asks after `ms` (default at once), replacing the current wait. */
    soon(ms = 0) {
      if (!running) return;
      wait(ms);
    },
    get running() {
      return running;
    },
    /** True while a next ask is scheduled. */
    get waiting() {
      return handle !== null;
    },
  };
}
