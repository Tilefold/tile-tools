/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — dead stones and the score
 *
 * When both players have passed, they mark the stones that are dead
 * (chains that can't escape capture) and both accept the result. Marking
 * works a chain at a time: a click on a stone marks its whole chain dead,
 * and another click brings it back. The dead stones are kept as a sorted
 * list of point numbers (y * size + x), always whole chains, so two boards
 * that agree on the list agree on the score.
 *
 * Scoring is by area, as in the Chinese rules: each color scores its stones
 * still on the board plus the empty points (and dead stones) it surrounds
 * alone, and white adds a komi of 7.5 for moving second. The half point
 * means a game can't be drawn.
 */
import { chainAt, neighbors, positionOf } from "./game.js";

/** Points white gets for moving second. */
export const KOMI = 7.5;

/** No stones marked dead, and nobody has accepted: how marking starts. */
export const NO_MARKS = Object.freeze({ dead: [], v: 0, mine: false, theirs: false });

/** Whether two lists of points are the same (both sorted). */
export const sameList = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((p, i) => p === b[i]);

/**
 * `dead` with the chain through point `i` marked dead, or back alive when
 * it was; unchanged when `i` is an empty point. Sorted.
 */
export function toggleChain(board, size, dead, i) {
  const { stones } = chainAt(board, size, i);
  if (stones.length === 0) return dead;
  const marked = new Set(dead);
  const wasDead = marked.has(i);
  for (const s of stones) {
    if (wasDead) marked.delete(s);
    else marked.add(s);
  }
  return [...marked].sort((a, b) => a - b);
}

/**
 * A list of dead stones that came from elsewhere (the other player, an
 * agent, storage), made safe: whole numbers of points that hold a stone,
 * each with its whole chain, sorted and without repeats. Anything else in
 * it is dropped.
 */
export function cleanDead(board, size, dead) {
  if (!Array.isArray(dead)) return [];
  const out = new Set();
  for (const i of dead) {
    if (!Number.isInteger(i) || i < 0 || i >= size * size || !board[i] || out.has(i)) continue;
    for (const s of chainAt(board, size, i).stones) out.add(s);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Whose area each point is, with `dead` taken off the board: a color for
 * that color's stones and for the empty regions only it borders, null for
 * regions both colors (or neither) border.
 */
export function areaOf(board, size, dead) {
  const gone = new Set(dead);
  const alive = board.map((stone, i) => (stone && !gone.has(i) ? stone : null));
  const owner = alive.slice();
  const seen = new Set();
  for (let start = 0; start < alive.length; start++) {
    if (alive[start] || seen.has(start)) continue;
    // One empty region (dead stones count as empty), and the colors around it.
    const region = [start];
    const borders = new Set();
    seen.add(start);
    for (let k = 0; k < region.length; k++) {
      for (const n of neighbors(size, region[k])) {
        if (alive[n]) borders.add(alive[n]);
        else if (!seen.has(n)) {
          seen.add(n);
          region.push(n);
        }
      }
    }
    const color = borders.size === 1 ? [...borders][0] : null;
    for (const p of region) owner[p] = color;
  }
  return owner;
}

/**
 * The score of `board` with `dead` marked: each color's points (area, and
 * komi for white), the winner and by how much.
 */
export function scoreOf(board, size, dead) {
  const owner = areaOf(board, size, dead);
  let black = 0;
  let white = KOMI;
  for (const color of owner) {
    if (color === "black") black += 1;
    else if (color === "white") white += 1;
  }
  const winner = black > white ? "black" : "white";
  return { black, white, winner, margin: Math.abs(black - white) };
}

/**
 * The result of a game whose players agreed on `dead` after `moves`:
 * `{ winner, resigned: null, score: { black, white, margin } }`.
 */
export function scoredResult(moves, size, dead) {
  const { black, white, winner, margin } = scoreOf(positionOf(moves, size).board, size, dead);
  return { winner, resigned: null, score: { black, white, margin } };
}

/** The result of a game `resigned` gave up: the other color wins. */
export const resignedResult = (resigned) => ({
  winner: resigned === "black" ? "white" : "black",
  resigned,
  score: null,
});
