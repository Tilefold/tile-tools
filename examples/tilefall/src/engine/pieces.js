/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tetromino geometry
 *
 * Defines the seven pieces, their rotation states, and SRS kick offsets.
 */

/** Board codes are the one-based indexes of these kinds. */
export const KINDS = Object.freeze(["I", "O", "T", "S", "Z", "J", "L"]);

/**
 * Coordinates in each piece's spawn box. The box rotates about its center:
 * 4 by 4 for I and 3 by 3 for the other rotating pieces.
 */
const SPAWN = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};

/** Rotate every square clockwise inside a fixed-size spawn box. */
function rotated(cells, size) {
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

/** Four rotation states for every kind, indexed 0, R, 2, L. */
export const PIECES = Object.freeze(
  Object.fromEntries(
    KINDS.map((kind) => {
      const states = [SPAWN[kind]];
      for (let turn = 1; turn < 4; turn += 1) {
        states.push(kind === "O" ? SPAWN.O : rotated(states[turn - 1], kind === "I" ? 4 : 3));
      }
      return [kind, states.map((cells) => cells.map(([x, y]) => Object.freeze([x, y])))];
    }),
  ),
);

/**
 * Kick offsets use screen coordinates: positive y points down. Each test is
 * tried in order, including the unshifted rotation at index zero.
 */
const JLSTZ_KICKS = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
};

const I_KICKS = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

/** Return local cells as fresh coordinate pairs. */
export function cellsFor(kind, rotation) {
  return PIECES[kind][rotation].map(([x, y]) => [x, y]);
}

/** Return the ordered wall kicks for one quarter turn. */
export function kickTests(kind, from, to) {
  const tests = kind === "O" ? [[0, 0]] : (kind === "I" ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`];
  return tests.map(([x, y]) => [x, y]);
}
