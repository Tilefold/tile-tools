// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — who's ahead, roughly
 *
 * The guess counts each color's stones, the small regions only it
 * borders, part of the open points nearer to it, and white's komi. A
 * lone stone doesn't own the empty board, the curve is wide while much of
 * the board is open and narrow at the end, dead stones are taken off when
 * marked, and every region counts once both passed. The percentage never
 * shows 0 or 100.
 */
import { describe, expect, it } from "vitest";
import { emptyBoard } from "../../examples/tilego/page-src/game.js";
import { estimateOf, percentOf } from "../../examples/tilego/page-src/estimate.js";
import { KOMI, scoreOf } from "../../examples/tilego/page-src/score.js";

/** A 9 × 9 board from nine rows of text: X black, O white, . empty. */
function boardFrom(rows) {
  const board = emptyBoard(9);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      board[y * 9 + x] = c === "X" ? "black" : c === "O" ? "white" : null;
    }),
  );
  return board;
}

// Black walls off columns A-C with D, white columns G-J with F; column E is
// open between them.
const WALLS = boardFrom(Array(9).fill("...X.O..."));

describe("the guess at who's ahead", () => {
  it("gives white the komi on an empty board, and only a slight edge for it", () => {
    const e = estimateOf(emptyBoard(9), 9);
    expect(e).toMatchObject({ black: 0, white: KOMI, leader: "white", margin: 7.5 });
    expect(e.blackChance).toBeGreaterThan(0.4);
    expect(e.blackChance).toBeLessThan(0.5);
  });

  it("doesn't give a lone stone the empty board round it", () => {
    const board = emptyBoard(9);
    board[4 * 9 + 4] = "black";
    const e = estimateOf(board, 9);
    // The stone, and part of the 24 points within three steps of it.
    expect(e.black).toBeGreaterThan(1);
    expect(e.black).toBeLessThan(10);
    expect(Math.abs(e.blackChance - 0.5)).toBeLessThan(0.05);
  });

  it("counts walled-off regions in full, and leaves a point both reach alike open", () => {
    const e = estimateOf(WALLS, 9);
    expect(e.black).toBe(9 + 27);
    expect(e.white).toBe(9 + 27 + KOMI);
    expect(e).toMatchObject({ leader: "white", margin: 7.5 });
    // Little is open, so a 7.5 lead says a lot.
    expect(e.blackChance).toBeLessThan(0.2);
  });

  it("is sure of a big lead near the end and unsure of the same lead early", () => {
    const late = boardFrom([
      "...X.O...",
      "...X.O...",
      "...X.O...",
      "...X.O...",
      "...XXXXXX",
      "...X.....",
      "...X.....",
      "...X.....",
      "...X.....",
    ]);
    const e = estimateOf(late, 9);
    expect(e.leader).toBe("black");
    expect(percentOf(e.blackChance)).toBe(99);
    const early = emptyBoard(19);
    early[3 * 19 + 3] = "black";
    early[3 * 19 + 15] = "white";
    early[15 * 19 + 3] = "black";
    const wide = estimateOf(early, 19);
    expect(wide.blackChance).toBeGreaterThan(0.4);
    expect(wide.blackChance).toBeLessThan(0.65);
  });

  it("takes marked dead stones off, and counts every region once both passed", () => {
    const board = WALLS.slice();
    board[0] = "white"; // A9, a dead white stone in black's area
    // Unmarked, the white stone spoils black's region: it counts only in part.
    expect(estimateOf(board, 9).black).toBeLessThan(9 + 26);
    const marked = estimateOf(board, 9, { dead: [0], ended: true });
    expect(marked.black).toBe(9 + 27);
    // Once ended, the guess counts as the score does.
    const score = scoreOf(board, 9, [0]);
    expect(marked.black).toBe(score.black);
    expect(marked.white).toBe(score.white);
  });

  it("rounds the margin to a half point, never below one", () => {
    const board = emptyBoard(9);
    board[4 * 9 + 4] = "black";
    const e = estimateOf(board, 9);
    expect(e.margin * 2).toBe(Math.round(e.margin * 2));
    expect(e.margin).toBeGreaterThanOrEqual(0.5);
  });
});

describe("percentOf", () => {
  it("rounds to a whole percentage and keeps clear of 0 and 100", () => {
    expect(percentOf(0.624)).toBe(62);
    expect(percentOf(0)).toBe(1);
    expect(percentOf(1)).toBe(99);
  });
});
