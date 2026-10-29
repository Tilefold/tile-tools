/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — who's ahead, roughly
 *
 * A quick guess at the score and each side's winning chances while a game
 * is played, for the bar above the board. It's no Go engine: it reads no
 * fights and doesn't know which stones are dead. It counts, by area as the
 * real score does:
 *
 *   - each color's stones on the board, one point each;
 *   - empty regions only one color borders, in full, once they're small
 *     enough to be real territory (less than half the board, so a lone
 *     stone doesn't own the empty board around it); after both passed,
 *     every such region counts, as in the score;
 *   - the rest of the empty points by influence: a point nearer to one
 *     color's stones than the other's (counting steps along the lines)
 *     counts for that color in part, less the farther it is;
 *   - white's komi.
 *
 * The chances come from the lead through a logistic curve whose width
 * grows with the empty points still in play: early on, a lead of a few
 * points says little; at the end, it says nearly everything.
 */
import { neighbors } from "./game.js";
import { KOMI, areaOf } from "./score.js";

/** How much an empty point counts for the nearer color, by its distance in steps. */
const INFLUENCE = [0, 0.5, 0.3, 0.15];

/** Largest share of the board an empty region one color borders may be, and still count in full. */
const TERRITORY_SHARE = 1 / 2;

/** How much each empty point still in play widens the curve, in points of lead. */
const SPREAD_PER_POINT = 0.35;

/** Steps from each empty point to the nearest stone of `color` (Infinity when out of reach). */
function distances(board, size, color) {
  const dist = new Array(board.length).fill(Infinity);
  const queue = [];
  board.forEach((stone, i) => {
    if (stone === color) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    if (dist[i] >= INFLUENCE.length - 1) continue;
    for (const n of neighbors(size, i)) {
      if (board[n] || dist[n] <= dist[i] + 1) continue;
      dist[n] = dist[i] + 1;
      queue.push(n);
    }
  }
  return dist;
}

/** The sizes of the empty regions, by point (stones get 0). */
function regionSizes(board, size) {
  const sizes = new Array(board.length).fill(0);
  for (let start = 0; start < board.length; start++) {
    if (board[start] || sizes[start]) continue;
    const region = [start];
    sizes[start] = -1;
    for (let k = 0; k < region.length; k++) {
      for (const n of neighbors(size, region[k])) {
        if (board[n] || sizes[n]) continue;
        sizes[n] = -1;
        region.push(n);
      }
    }
    for (const p of region) sizes[p] = region.length;
  }
  return sizes;
}

/**
 * The guess for `board` (one entry per point: "black", "white" or null) of
 * `size`. `dead` (point numbers) are taken off first; `ended` says both
 * players passed, so every region one color borders is its own.
 *
 * Returns `{ black, white, lead, leader, margin, blackChance }`: each
 * color's points (white's with komi), black's lead (negative when white
 * leads), who leads and by about how much (a half point at least, rounded
 * to a half), and black's chance of winning from 0 to 1 (white's is the
 * rest).
 */
export function estimateOf(board, size, { dead = [], ended = false } = {}) {
  const gone = new Set(dead);
  const alive = board.map((stone, i) => (stone && !gone.has(i) ? stone : null));
  const owner = areaOf(alive, size, []);
  const sizes = regionSizes(alive, size);
  const near = { black: distances(alive, size, "black"), white: distances(alive, size, "white") };
  const territory = ended ? Infinity : size * size * TERRITORY_SHARE;

  let black = 0;
  let white = KOMI;
  let open = 0;
  alive.forEach((stone, i) => {
    let color = stone;
    let weight = 1;
    if (!stone) {
      if (owner[i] && sizes[i] <= territory) color = owner[i];
      else {
        // Still in play: the nearer color gets part of it.
        open += 1;
        const b = near.black[i];
        const w = near.white[i];
        color = b < w ? "black" : w < b ? "white" : null;
        weight = color ? (INFLUENCE[Math.min(b, w)] ?? 0) : 0;
      }
    }
    if (color === "black") black += weight;
    else if (color === "white") white += weight;
  });

  const lead = black - white;
  const spread = 1 + SPREAD_PER_POINT * open;
  return {
    black,
    white,
    lead,
    leader: lead > 0 ? "black" : "white",
    margin: Math.max(0.5, Math.round(Math.abs(lead) * 2) / 2),
    blackChance: 1 / (1 + Math.exp(-lead / spread)),
  };
}

/** A chance (0 to 1) as a whole percentage, never quite 0 or 100 while the game goes on. */
export const percentOf = (chance) => Math.min(99, Math.max(1, Math.round(chance * 100)));
