/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Playing board
 *
 * Tests placement, stores locked blocks, and removes completed rows.
 */

export const WIDTH = 10;
export const HEIGHT = 20;

/** Create distinct empty rows so one write cannot change another row. */
export function createBoard() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
}

/**
 * A cell above the visible board is permitted during spawn and rotation.
 * Side walls, the floor, and occupied visible cells are solid.
 */
export function collides(board, cells) {
  return cells.some(
    ([x, y]) => x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && board[y][x] !== 0),
  );
}

/** Place a locked piece by its board code (1 through 7). */
export function mergePiece(board, cells, code) {
  for (const [x, y] of cells) {
    if (y >= 0 && y < HEIGHT) board[y][x] = code;
  }
}

/** Remove every complete row, including separated rows, and return its count. */
export function clearLines(board) {
  let removed = 0;
  for (let y = HEIGHT - 1; y >= 0; y -= 1) {
    if (board[y].every((code) => code !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(WIDTH).fill(0));
      removed += 1;
      y += 1; // Recheck this index after rows above shift down.
    }
  }
  return removed;
}
