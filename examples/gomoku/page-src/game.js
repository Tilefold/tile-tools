/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the rules
 *
 * Freestyle Gomoku on a 15 × 15 board: black moves first, the players take
 * turns placing one stone on an empty point, and the first to have five or
 * more stones in an unbroken line (across, down or diagonally) wins. A full
 * board with no line of five is a draw.
 *
 * A game is only its list of moves, `[[x, y], …]` from the top-left point
 * (0, 0); even entries are black's, odd ones white's. Everything else (the
 * board, whose turn it is, the result) is worked out from that list, so two
 * players who agree on the moves agree on everything.
 */

/** Points on each side of the board. */
export const SIZE = 15;

/** Stones in a line that win. */
export const FIVE = 5;

/** Column letters, left to right (A–O). */
const COLUMNS = "ABCDEFGHIJKLMNO";

/** The four directions a line can run in: across, down and the two diagonals. */
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** The color that plays move number `n` (counting from 0). */
export const colorOfMove = (n) => (n % 2 === 0 ? "black" : "white");

/** Whose turn it is after `moves`. */
export const turnOf = (moves) => colorOfMove(moves.length);

/** Whether (x, y) is a point on the board. */
export const onBoard = (x, y) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE;

/**
 * A point's name, as players say it: its column letter and its row number
 * counted from the bottom, so the top-left point is "A15" and the
 * bottom-right one "O1".
 */
export const cellName = (x, y) => `${COLUMNS[x]}${SIZE - y}`;

/** The board after `moves`: one entry per point, "black", "white" or null. */
export function boardOf(moves) {
  const board = Array.from({ length: SIZE * SIZE }, () => null);
  moves.forEach(([x, y], n) => {
    board[y * SIZE + x] = colorOfMove(n);
  });
  return board;
}

/** The stone at (x, y) on `board`, or null for an empty point or one off the board. */
const stoneAt = (board, x, y) => (onBoard(x, y) ? board[y * SIZE + x] : null);

/**
 * The longest line through (x, y) of the stone there, as its points in
 * order; or null when no direction has five.
 */
export function lineThrough(board, x, y) {
  const color = stoneAt(board, x, y);
  if (!color) return null;
  let best = null;
  for (const [dx, dy] of DIRECTIONS) {
    const line = [[x, y]];
    // Walk both ways from the stone while the same color continues.
    for (let i = 1; stoneAt(board, x + dx * i, y + dy * i) === color; i++) {
      line.push([x + dx * i, y + dy * i]);
    }
    for (let i = 1; stoneAt(board, x - dx * i, y - dy * i) === color; i++) {
      line.unshift([x - dx * i, y - dy * i]);
    }
    if (line.length >= FIVE && (!best || line.length > best.length)) best = line;
  }
  return best;
}

/**
 * Why a move can't be played after `moves`, or null when it can:
 * "over" (the game has a result), "off-board" or "taken".
 */
export function refusal(moves, x, y) {
  if (resultOf(moves)) return "over";
  if (!onBoard(x, y)) return "off-board";
  if (boardOf(moves)[y * SIZE + x]) return "taken";
  return null;
}

/**
 * The result of `moves`, or null while the game goes on:
 * `{ winner: "black" | "white", line }` for five in a row (the line's
 * points), or `{ winner: null, line: null }` for a full board.
 */
export function resultOf(moves) {
  if (moves.length === 0) return null;
  const board = boardOf(moves);
  const [x, y] = moves[moves.length - 1];
  const line = lineThrough(board, x, y);
  if (line) return { winner: colorOfMove(moves.length - 1), line };
  if (moves.length >= SIZE * SIZE) return { winner: null, line: null };
  return null;
}

/**
 * Whether `moves` is a game that could have been played: every move on an
 * empty point of the board, and none after a result. Moves that arrive
 * from the other player are checked with it before they are believed.
 */
export function isValidGame(moves) {
  if (!Array.isArray(moves) || moves.length > SIZE * SIZE) return false;
  const played = [];
  for (const move of moves) {
    if (!Array.isArray(move) || move.length !== 2) return false;
    const [x, y] = move;
    if (refusal(played, x, y)) return false;
    played.push([x, y]);
  }
  return true;
}
