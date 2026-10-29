/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the rules
 *
 * Go on a 9 × 9, 13 × 13 or 19 × 19 board. Black moves first and the
 * players take turns, each placing one stone on an empty point or passing.
 * A chain of stones (stones of one color joined across, never diagonally)
 * with no empty point next to it is captured and taken off the board. A
 * move may not leave its own chain without one (no suicide), and may not
 * take back a single stone at once where a single stone was just taken
 * (simple ko). Two passes in a row end the play; the players then agree on
 * which stones are dead and the board is scored (score.js).
 *
 * A game is only its board size and its list of moves: `[x, y]` from the
 * top-left point (0, 0), or "pass"; even entries are black's, odd ones
 * white's. Everything else (the board, the captures, the ko point, whose
 * turn it is, whether play has ended) is worked out from that list, so two
 * players who agree on the moves agree on everything.
 */

/** The board sizes a game can have. */
export const SIZES = [9, 13, 19];

/** A pass, as a move in the list. */
export const PASS = "pass";

/**
 * Column letters, left to right. "I" is left out, as on every Go board, so
 * it can't be mistaken for "J" or the number 1.
 */
export const COLUMNS = "ABCDEFGHJKLMNOPQRST";

/** Whether `size` is a board size a game can have. */
export const isSize = (size) => SIZES.includes(size);

/** The color that plays move number `n` (counting from 0). */
export const colorOfMove = (n) => (n % 2 === 0 ? "black" : "white");

/** The other color. */
export const otherColor = (color) => (color === "black" ? "white" : "black");

/** Whose turn it is after `moves`. */
export const turnOf = (moves) => colorOfMove(moves.length);

/** Whether `move` is a pass. */
export const isPass = (move) => move === PASS;

/** Whether play has ended after `moves`: its last two moves are passes. */
export const playEnded = (moves) =>
  moves.length >= 2 && isPass(moves[moves.length - 1]) && isPass(moves[moves.length - 2]);

/** Most moves a game may have: far more than any real game, so a list can't grow without end. */
export const maxMoves = (size) => size * size * 3;

/** Whether (x, y) is a point on a board of `size`. */
export const onBoard = (size, x, y) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;

/**
 * A point's name, as players say it: its column letter and its row number
 * counted from the bottom, so on a 9 × 9 board the top-left point is "A9"
 * and the bottom-right one "J1".
 */
export const cellName = (size, x, y) => `${COLUMNS[x]}${size - y}`;

/** The name of a move: a point's, or "pass". */
export const moveName = (size, move) => (isPass(move) ? PASS : cellName(size, move[0], move[1]));

/** The points next to point `i` (across and down, never diagonally). */
export function neighbors(size, i) {
  const x = i % size;
  const y = Math.floor(i / size);
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  if (y > 0) out.push(i - size);
  if (y < size - 1) out.push(i + size);
  return out;
}

/**
 * The chain through point `i` on `board` (its stones, all of one color,
 * joined across) and how many empty points touch it. Empty points have
 * no chain: `{ stones: [], liberties: 0 }`.
 */
export function chainAt(board, size, i) {
  const color = board[i];
  if (!color) return { stones: [], liberties: 0 };
  const stones = [i];
  const seen = new Set(stones);
  const free = new Set();
  for (let k = 0; k < stones.length; k++) {
    for (const n of neighbors(size, stones[k])) {
      if (board[n] === null) free.add(n);
      else if (board[n] === color && !seen.has(n)) {
        seen.add(n);
        stones.push(n);
      }
    }
  }
  return { stones, liberties: free.size };
}

/** The empty board of `size`: one entry per point, "black", "white" or null. */
export const emptyBoard = (size) => Array.from({ length: size * size }, () => null);

/** A position: the board, the ko point (where the next move may not go) and the stones taken. */
const startPosition = (size) => ({
  board: emptyBoard(size),
  ko: null,
  captured: { black: 0, white: 0 },
});

/**
 * Plays `move` for `color` from `pos`: the new position, or the reason it
 * can't be played ("off-board", "taken", "ko" or "suicide"). `captured`
 * counts the stones each color has taken.
 */
export function playMove(pos, size, color, move) {
  if (isPass(move)) return { pos: { ...pos, ko: null } };
  if (!Array.isArray(move) || move.length !== 2) return { why: "off-board" };
  const [x, y] = move;
  if (!onBoard(size, x, y)) return { why: "off-board" };
  const i = y * size + x;
  if (pos.board[i]) return { why: "taken" };
  if (pos.ko === i) return { why: "ko" };
  const board = pos.board.slice();
  board[i] = color;
  // The other color's chains left with no empty point come off.
  const taken = [];
  for (const n of neighbors(size, i)) {
    if (board[n] !== otherColor(color)) continue;
    const chain = chainAt(board, size, n);
    if (chain.liberties > 0) continue;
    for (const s of chain.stones) board[s] = null;
    taken.push(...chain.stones);
  }
  const own = chainAt(board, size, i);
  if (own.liberties === 0) return { why: "suicide" };
  // One stone that took one stone, and now has that point as its only
  // liberty, could be taken straight back: that point is the ko.
  const ko = taken.length === 1 && own.stones.length === 1 && own.liberties === 1 ? taken[0] : null;
  return {
    pos: {
      board,
      ko,
      captured: { ...pos.captured, [color]: pos.captured[color] + taken.length },
    },
  };
}

/** The last position worked out, so drawing the same game again costs nothing. */
let memo = { moves: null, size: 0, result: null };

/**
 * Plays `moves` from the empty board of `size`: `{ pos, bad }`, where
 * `pos` is the position after the moves that could be played and `bad`
 * is the number of the first move that couldn't (null when all could).
 */
export function replay(moves, size) {
  if (memo.moves === moves && memo.size === size) return memo.result;
  let pos = startPosition(size);
  let bad = null;
  for (let n = 0; n < moves.length; n++) {
    // No move follows the two passes that end the play.
    const ended = n >= 2 && isPass(moves[n - 1]) && isPass(moves[n - 2]);
    const next = ended ? { why: "ended" } : playMove(pos, size, colorOfMove(n), moves[n]);
    if (next.why) {
      bad = n;
      break;
    }
    pos = next.pos;
  }
  const result = { pos, bad };
  memo = { moves, size, result };
  return result;
}

/** The position after `moves` (played as far as they can be). */
export const positionOf = (moves, size) => replay(moves, size).pos;

/**
 * Why `move` can't be played next after `moves`, or null when it can:
 * "ended" (both players passed), "off-board", "taken", "ko" or "suicide".
 */
export function refusal(moves, size, move) {
  if (playEnded(moves)) return "ended";
  if (moves.length >= maxMoves(size)) return "ended";
  const next = playMove(positionOf(moves, size), size, turnOf(moves), move);
  return next.why ?? null;
}

/**
 * Whether `moves` is a game that could have been played on a board of
 * `size`: every move a pass or a legal stone, none after the two passes
 * that end the play. Games that arrive from the other player (or from
 * storage) are checked with it before they are believed.
 */
export function isValidGame(moves, size) {
  if (!isSize(size) || !Array.isArray(moves) || moves.length > maxMoves(size)) return false;
  for (const move of moves) {
    if (isPass(move)) continue;
    if (!Array.isArray(move) || move.length !== 2) return false;
  }
  return replay(moves, size).bad === null;
}
