// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — dead stones and the score
 *
 * Marking works a whole chain at a time and a second click brings it back;
 * a list from elsewhere is cleaned to whole chains of real stones; area
 * scoring counts each color's stones and the empty regions only it
 * borders, with dead stones counted as the other color's area; white adds
 * 7.5 komi, so there's always a winner.
 */
import { describe, expect, it } from "vitest";
import { emptyBoard } from "../../examples/tilego/page-src/game.js";
import {
  KOMI,
  areaOf,
  cleanDead,
  sameList,
  scoreOf,
  toggleChain,
} from "../../examples/tilego/page-src/score.js";

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

// Black owns the left side (columns A-D), white the right (E-J); a white
// stone sits dead inside black's area at B8, and a black pair inside
// white's at G2-G3.
const BOARD = boardFrom([
  "...XO....",
  ".O.XO....",
  "...XO....",
  "...XO....",
  "...XO....",
  "...XO....",
  "...XO.X..",
  "...XO.X..",
  "...XO....",
]);
const B8 = 1 * 9 + 1;
const G3 = 6 * 9 + 6;
const G2 = 7 * 9 + 6;

describe("marking dead stones", () => {
  it("marks a whole chain, and brings it back on a second click", () => {
    const once = toggleChain(BOARD, 9, [], G3);
    expect(once).toEqual([G3, G2]);
    expect(toggleChain(BOARD, 9, once, G2)).toEqual([]);
    // An empty point marks nothing.
    expect(toggleChain(BOARD, 9, once, 0)).toBe(once);
    expect(toggleChain(BOARD, 9, once, B8)).toEqual([B8, G3, G2].sort((a, b) => a - b));
  });

  it("cleans a list from elsewhere to whole chains of stones on the board", () => {
    expect(cleanDead(BOARD, 9, [G2, 0, -1, 999, 1.5, "x", G2])).toEqual([G3, G2]);
    expect(cleanDead(BOARD, 9, null)).toEqual([]);
  });

  it("compares lists", () => {
    expect(sameList([1, 2], [1, 2])).toBe(true);
    expect(sameList([1, 2], [2, 1])).toBe(false);
    expect(sameList([1], null)).toBe(false);
  });
});

describe("the score", () => {
  it("counts each side's stones and the empty points only it borders", () => {
    // Nothing marked: B8 (white) spoils black's area, G2-G3 spoil white's.
    const area = areaOf(BOARD, 9, []);
    expect(area[0]).toBeNull();
    expect(area[3]).toBe("black");
    expect(area[B8]).toBe("white");
    const raw = scoreOf(BOARD, 9, []);
    // Black: its 9 wall stones and the 2 at G2-G3; white: its 9 wall stones and B8, plus komi.
    expect(raw).toMatchObject({ black: 11, white: 10 + KOMI });
  });

  it("counts dead stones as the other side's area", () => {
    const dead = cleanDead(BOARD, 9, [B8, G2]);
    const area = areaOf(BOARD, 9, dead);
    expect(area[B8]).toBe("black");
    expect(area[G2]).toBe("white");
    // Black: columns A-D (36); white: columns E-J (45) and komi.
    const score = scoreOf(BOARD, 9, dead);
    expect(score).toEqual({ black: 36, white: 45 + KOMI, winner: "white", margin: 16.5 });
  });

  it("has a winner on an empty board: white, by the komi", () => {
    expect(scoreOf(emptyBoard(9), 9, [])).toEqual({
      black: 0,
      white: KOMI,
      winner: "white",
      margin: KOMI,
    });
  });
});
