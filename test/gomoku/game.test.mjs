// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the rules and game codes
 *
 * Five or more in a row wins in every direction, four doesn't, a full board
 * is a draw; moves on a taken point, off the board or after the end are
 * refused, and a move list from the other player is believed only when it
 * could have been played. Points are named the way players say them, and
 * game codes read back the same however they were typed.
 */
import { describe, expect, it } from "vitest";
import {
  SIZE,
  boardOf,
  cellName,
  isValidGame,
  refusal,
  resultOf,
  turnOf,
} from "../../examples/gomoku/page-src/game.js";
import { CODE_ALPHABET, parseCode, showCode } from "../../examples/gomoku/page-src/code.js";

/** Black plays `black`, white plays `white`, alternating from black. */
const alternate = (black, white) => {
  const moves = [];
  for (let i = 0; i < Math.max(black.length, white.length); i++) {
    if (black[i]) moves.push(black[i]);
    if (white[i]) moves.push(white[i]);
  }
  return moves;
};

/** Points in a line from (x, y), `n` long, stepping (dx, dy). */
const line = (x, y, dx, dy, n) => Array.from({ length: n }, (_, i) => [x + dx * i, y + dy * i]);

describe("the rules", () => {
  it("starts with black and alternates", () => {
    expect(turnOf([])).toBe("black");
    expect(turnOf([[7, 7]])).toBe("white");
    const board = boardOf([
      [7, 7],
      [8, 8],
    ]);
    expect(board[7 * SIZE + 7]).toBe("black");
    expect(board[8 * SIZE + 8]).toBe("white");
  });

  it.each([
    ["across", 1, 0],
    ["down", 0, 1],
    ["down-right", 1, 1],
    ["up-right", 1, -1],
  ])("wins with five %s", (_, dx, dy) => {
    const start = dy === -1 ? [3, 10] : [3, 3];
    const five = line(start[0], start[1], dx, dy, 5);
    const elsewhere = line(0, 14, 1, 0, 4);
    const moves = alternate(five, elsewhere);
    expect(resultOf(moves)).toEqual({ winner: "black", line: five });
  });

  it("doesn't count four, or a five broken by the other color", () => {
    const four = alternate(line(3, 3, 1, 0, 4), line(0, 14, 1, 0, 4));
    expect(resultOf(four)).toBeNull();
    // Black at x 3,4,5,7,8 with white on 6: not five in a row.
    const broken = alternate(
      [
        [3, 3],
        [4, 3],
        [5, 3],
        [7, 3],
        [8, 3],
      ],
      [
        [6, 3],
        [0, 14],
        [1, 14],
        [2, 14],
      ],
    );
    expect(resultOf(broken)).toBeNull();
  });

  it("lets a longer line win too (freestyle), filling the gap last", () => {
    const black = [...line(2, 5, 1, 0, 3), ...line(6, 5, 1, 0, 3), [5, 5]];
    const white = line(0, 0, 2, 0, 6); // spread out: no line of its own
    const moves = alternate(black, white);
    expect(resultOf(moves)?.winner).toBe("black");
    expect(resultOf(moves)?.line).toHaveLength(7);
  });

  it("calls a full board with no five a draw", () => {
    // Coloring by (x + 2y) mod 4 never puts more than two of a color in a row,
    // in any direction, and gives black 113 points and white 112.
    const order = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) order.push([x, y]);
    }
    const colorAt = (x, y) => ((x + 2 * y) % 4 < 2 ? "b" : "w");
    const blacks = order.filter(([x, y]) => colorAt(x, y) === "b");
    const whites = order.filter(([x, y]) => colorAt(x, y) === "w");
    const moves = alternate(blacks, whites);
    expect(moves).toHaveLength(SIZE * SIZE);
    // Every prefix is still a game in progress, and the last move leaves a draw.
    expect(isValidGame(moves)).toBe(true);
    expect(resultOf(moves)).toEqual({ winner: null, line: null });
  });

  it("refuses taken points, points off the board and moves after the end", () => {
    expect(refusal([[7, 7]], 7, 7)).toBe("taken");
    expect(refusal([], 15, 0)).toBe("off-board");
    expect(refusal([], -1, 0)).toBe("off-board");
    expect(refusal([], 1.5, 0)).toBe("off-board");
    const won = alternate(line(3, 3, 1, 0, 5), line(0, 14, 1, 0, 4));
    expect(refusal(won, 9, 9)).toBe("over");
    expect(refusal([], 7, 7)).toBeNull();
  });

  it("believes only move lists that could have been played", () => {
    expect(isValidGame([])).toBe(true);
    expect(
      isValidGame([
        [7, 7],
        [8, 8],
      ]),
    ).toBe(true);
    expect(
      isValidGame([
        [7, 7],
        [7, 7],
      ]),
    ).toBe(false);
    expect(isValidGame([[7, 7, 1]])).toBe(false);
    expect(isValidGame([["7", 7]])).toBe(false);
    expect(isValidGame("7,7")).toBe(false);
    const won = alternate(line(3, 3, 1, 0, 5), line(0, 14, 1, 0, 4));
    expect(isValidGame([...won, [9, 9]])).toBe(false);
  });

  it("names points by column letter and row from the bottom", () => {
    expect(cellName(0, 0)).toBe("A15");
    expect(cellName(7, 7)).toBe("H8");
    expect(cellName(14, 14)).toBe("O1");
  });
});

describe("game codes", () => {
  it("read back however they were typed", () => {
    expect(parseCode("k7p-4qx")).toBe("K7P4QX");
    expect(parseCode(" K7P 4QX ")).toBe("K7P4QX");
    expect(showCode("K7P4QX")).toBe("K7P-4QX");
  });

  it("refuse anything that can't be a code", () => {
    expect(parseCode("K7P4Q")).toBeNull();
    expect(parseCode("K7P4QXA")).toBeNull();
    expect(parseCode("K0P4QX")).toBeNull(); // 0 looks like O and isn't used
    expect(parseCode(null)).toBeNull();
  });

  it("use no look-alike characters", () => {
    for (const ch of "0O1IL5S2Z8B") expect(CODE_ALPHABET).not.toContain(ch);
  });
});
