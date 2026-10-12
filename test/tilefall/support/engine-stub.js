/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Engine stub (tests only)
 *
 * A tiny stand-in for the real game engine that honours the same contract
 * (createGame, the move methods, getState, toJSON, snapshot restore,
 * gravityMs) with the simplest possible rules: every piece is an O block
 * spawning at columns 4–5, rotation never changes anything, a grounded
 * piece locks on the next tick, and each full row scores 100 × level.
 * Predictable enough to drive the tile's behaviour tests exactly.
 */

export const KINDS = ["I", "O", "T", "S", "Z", "J", "L"];
const W = 10;
const H = 20;
const O = 2; // board code of the O piece

/** Milliseconds per row: 1000 at level 1, 100 less per level, never under 100. */
export function gravityMs(level) {
  return Math.max(100, 1100 - level * 100);
}

/**
 * @param {{ startLevel?: number, seed?: number, snapshot?: any }} [opts]
 */
export function createGame(opts = {}) {
  const s = opts.snapshot
    ? structuredClone(opts.snapshot)
    : {
        board: Array.from({ length: H }, () => Array(W).fill(0)),
        x: 4,
        y: 0,
        startLevel: opts.startLevel ?? 1,
        score: 0,
        lines: 0,
        clears: 0,
        lastClear: null,
        over: false,
        hold: null,
        canHold: true,
      };
  if (!s || !Array.isArray(s.board)) throw new Error("bad snapshot");

  const cells = (x = s.x, y = s.y) => [
    [x, y],
    [x + 1, y],
    [x, y + 1],
    [x + 1, y + 1],
  ];
  const fits = (x, y) =>
    cells(x, y).every(([cx, cy]) => cx >= 0 && cx < W && cy >= 0 && cy < H && !s.board[cy][cx]);
  const level = () => s.startLevel + Math.floor(s.lines / 10);

  const lock = () => {
    for (const [x, y] of cells()) s.board[y][x] = O;
    const kept = s.board.filter((row) => row.some((c) => !c));
    const cleared = H - kept.length;
    if (cleared) {
      s.score += 100 * cleared * level();
      s.lines += cleared;
      s.clears += 1;
      s.lastClear = { lines: cleared };
      s.board = [...Array.from({ length: cleared }, () => Array(W).fill(0)), ...kept];
    }
    s.x = 4;
    s.y = 0;
    s.canHold = true;
    if (!fits(s.x, s.y)) s.over = true;
  };

  const shift = (dx, dy) => {
    if (s.over || !fits(s.x + dx, s.y + dy)) return false;
    s.x += dx;
    s.y += dy;
    return true;
  };

  let ghostY = () => {
    let y = s.y;
    while (fits(s.x, y + 1)) y += 1;
    return y;
  };

  return {
    moveLeft: () => shift(-1, 0),
    moveRight: () => shift(1, 0),
    rotateCW: () => false,
    rotateCCW: () => false,
    softDrop() {
      if (!shift(0, 1)) return false;
      s.score += 1;
      return true;
    },
    hardDrop() {
      if (s.over) return false;
      const rows = ghostY() - s.y;
      s.y += rows;
      s.score += rows * 2;
      lock();
      return true;
    },
    hold() {
      if (s.over || !s.canHold) return false;
      s.hold = "O";
      s.canHold = false;
      s.x = 4;
      s.y = 0;
      return true;
    },
    tick() {
      if (s.over) return false;
      if (shift(0, 1)) return true;
      lock();
      return true;
    },
    getState() {
      return structuredClone({
        board: s.board,
        active: s.over ? null : { kind: "O", cells: cells() },
        ghost: s.over ? [] : cells(s.x, ghostY()),
        next: ["O", "T", "I"],
        hold: s.hold,
        canHold: s.canHold,
        score: s.score,
        lines: s.lines,
        level: level(),
        over: s.over,
        clears: s.clears,
        lastClear: s.lastClear,
      });
    },
    toJSON: () => structuredClone(s),
  };
}
