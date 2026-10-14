/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Arcade kit — seeded random numbers
 *
 * A small, fast generator (mulberry32) so a game started with the same seed
 * plays out the same way. That makes the engines easy to test: a test picks
 * a seed and knows exactly what will happen.
 *
 * This file is the same in every arcade example.
 */

/**
 * A random number source.
 *
 * @param {number} seed Any number; the same seed gives the same sequence.
 * @returns {{ next: () => number, int: (n: number) => number }}
 *   `next` gives a number from 0 (inclusive) to 1; `int(n)` a whole number from 0 to n - 1.
 */
export function createRng(seed) {
  let state = (Number.isFinite(seed) ? seed : 1) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}
