/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Screensaver Themes — random numbers
 *
 * A small seeded generator, so a theme looks different each time it starts
 * but a test can replay exactly the same frames from the same seed.
 */

/**
 * Numbers in [0, 1) from `seed`, the same sequence for the same seed.
 *
 * @param {number} seed Any number; its whole-number part is used.
 * @returns {() => number}
 */
export function seededRandom(seed) {
  // xorshift32: tiny, fast and good enough for pictures. 0 would stay 0.
  let state = Math.trunc(seed) >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}
