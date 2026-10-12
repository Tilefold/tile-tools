/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Seeded piece randomizer
 *
 * Generates reproducible seven-piece bags without external dependencies.
 */

import { KINDS } from "./pieces.js";

/** Convert numeric and text seeds into a stable unsigned 32-bit value. */
function seedNumber(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const source = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32; its single integer state makes exact save and restore simple. */
export function createRng(seed = Date.now()) {
  let state = seedNumber(seed);
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return state;
    },
    setState(value) {
      state = value >>> 0;
    },
  };
}

/**
 * Fisher-Yates shuffles a fresh copy of all seven kinds each time a bag ends.
 * A snapshot includes the unfinished bag and the PRNG state.
 */
export function createBag(seed = Date.now(), snapshot) {
  const rng = createRng(seed);
  let remaining = [];
  if (snapshot) {
    rng.setState(snapshot.rng);
    remaining = [...snapshot.remaining];
  }
  return {
    next() {
      if (remaining.length === 0) {
        remaining = [...KINDS];
        for (let i = remaining.length - 1; i > 0; i -= 1) {
          const j = Math.floor(rng.next() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
      }
      return remaining.pop();
    },
    toJSON() {
      return { rng: rng.getState(), remaining: [...remaining] };
    },
  };
}
