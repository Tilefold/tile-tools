// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the rules
 *
 * Point names on each board size (no "I" column), whose turn it is, a
 * stone that takes a chain left without liberties (one stone, a group, at
 * the edge and in the corner), suicide refused unless the move captures,
 * simple ko refused at once and allowed again after a move elsewhere or a
 * pass, the end of play after two passes, and games checked before they
 * are believed (a bad move, a move after the end, a board size that isn't
 * one, a list too long).
 */
import { describe, expect, it } from "vitest";
import {
  PASS,
  cellName,
  chainAt,
  isValidGame,
  maxMoves,
  moveName,
  neighbors,
  playEnded,
  positionOf,
  refusal,
  replay,
  turnOf,
} from "../../examples/tilego/page-src/game.js";

/** Moves from point names ("D4", "pass") on a board of `size`, as players would say them. */
function moves(size, names) {
  const columns = "ABCDEFGHJKLMNOPQRST";
  return names.map((name) =>
    name === PASS ? PASS : [columns.indexOf(name[0]), size - Number(name.slice(1))],
  );
}

/** The stone on the point named `name` after `list`. */
const at = (size, list, name) => {
  const [[x, y]] = moves(size, [name]);
  return positionOf(list, size).board[y * size + x];
};

describe("the board", () => {
  it("names points by column (skipping I) and by row from the bottom", () => {
    expect(cellName(9, 0, 0)).toBe("A9");
    expect(cellName(9, 8, 8)).toBe("J1");
    expect(cellName(19, 18, 0)).toBe("T19");
    expect(cellName(13, 6, 6)).toBe("G7");
    expect(moveName(9, PASS)).toBe("pass");
    expect(moveName(9, [2, 6])).toBe("C3");
  });

  it("finds the neighbors of a corner, an edge and a middle point", () => {
    expect(neighbors(9, 0).sort((a, b) => a - b)).toEqual([1, 9]);
    expect(neighbors(9, 4).sort((a, b) => a - b)).toEqual([3, 5, 13]);
    expect(neighbors(9, 40).sort((a, b) => a - b)).toEqual([31, 39, 41, 49]);
  });

  it("says whose turn it is, passes included", () => {
    expect(turnOf([])).toBe("black");
    expect(turnOf(moves(9, ["E5"]))).toBe("white");
    expect(turnOf(moves(9, ["E5", "pass"]))).toBe("black");
  });
});

describe("captures", () => {
  it("takes a single stone left with no liberty and counts it", () => {
    // White E5 surrounded by black on all four sides.
    const game = moves(9, ["E6", "E5", "D5", "A1", "F5", "A2", "E4"]);
    expect(at(9, game, "E5")).toBeNull();
    expect(positionOf(game, 9).captured).toEqual({ black: 1, white: 0 });
  });

  it("takes a whole chain at the edge, and a stone in the corner", () => {
    // White A1-A2 (a chain on the edge) caught by black B1, B2, A3.
    const game = moves(9, ["B1", "A1", "B2", "A2", "A3"]);
    expect(at(9, game, "A1")).toBeNull();
    expect(at(9, game, "A2")).toBeNull();
    expect(positionOf(game, 9).captured.black).toBe(2);
    const corner = moves(9, ["A2", "A1", "B1"]);
    expect(at(9, corner, "A1")).toBeNull();
  });

  it("knows a chain and its liberties", () => {
    const pos = positionOf(moves(9, ["E5", "A1", "E6"]), 9);
    const chain = chainAt(pos.board, 9, 4 * 9 + 4);
    expect(chain.stones.length).toBe(2);
    expect(chain.liberties).toBe(6);
    expect(chainAt(pos.board, 9, 0 + 8 * 9).stones.length).toBe(1);
    expect(chainAt(pos.board, 9, 1).stones).toEqual([]);
  });
});

describe("illegal moves", () => {
  it("refuses a taken point and one off the board", () => {
    const game = moves(9, ["E5"]);
    expect(refusal(game, 9, [4, 4])).toBe("taken");
    expect(refusal(game, 9, [9, 0])).toBe("off-board");
    expect(refusal(game, 9, [-1, 0])).toBe("off-board");
    expect(refusal(game, 9, "nope")).toBe("off-board");
    expect(refusal(game, 9, [0, 0])).toBeNull();
  });

  it("refuses suicide, but not a move that captures to make its liberty", () => {
    // Black A2 and B1 around the corner: white A1 would have no liberty.
    const game = moves(9, ["A2", "J9", "B1"]);
    expect(refusal(game, 9, [0, 8])).toBe("suicide");
    // With white on C1 and B2, black's B1 has A1 as its last liberty: white
    // A1 takes it, and so has a liberty itself (black passes to give white the move).
    const game2 = [...moves(9, ["A2", "C1", "B1", "B2"]), PASS];
    expect(refusal(game2, 9, [0, 8])).toBeNull();
    expect(at(9, [...game2, [0, 8]], "B1")).toBeNull();
  });

  it("refuses taking back a ko at once, and allows it after a move elsewhere", () => {
    // The classic ko shape around D5/E5.
    //   black: D6, C5, D4, F5 (after) ; white: E6, F5?, E4, D5 ...
    const shape = moves(9, ["D6", "E6", "C5", "F5", "D4", "E4", "A1", "D5", "E5"]);
    // Black E5 took white D5; white may not take E5 back at D5 straight away.
    expect(at(9, shape, "D5")).toBeNull();
    expect(positionOf(shape, 9).ko).toBe(4 * 9 + 3);
    expect(refusal(shape, 9, [3, 4])).toBe("ko");
    // A ko threat elsewhere and an answer: then the take-back is allowed.
    const later = [...shape, [8, 0], [7, 0]];
    expect(refusal(later, 9, [3, 4])).toBeNull();
    // A pass also clears the ko.
    expect(positionOf([...shape, PASS], 9).ko).toBeNull();
  });

  it("ends play after two passes in a row, and refuses any move after", () => {
    const game = moves(9, ["E5", "pass", "pass"]);
    expect(playEnded(game)).toBe(true);
    expect(refusal(game, 9, [0, 0])).toBe("ended");
    expect(refusal(game, 9, PASS)).toBe("ended");
    expect(playEnded(moves(9, ["pass", "E5", "pass"]))).toBe(false);
  });
});

describe("checking a game", () => {
  it("believes a game that could have been played", () => {
    expect(isValidGame(moves(9, ["E5", "pass", "D4", "pass", "pass"]), 9)).toBe(true);
    expect(isValidGame([], 19)).toBe(true);
  });

  it("refuses bad moves, moves after the end, bad sizes and lists too long", () => {
    expect(isValidGame(moves(9, ["E5", "E5"]), 9)).toBe(false);
    expect(isValidGame(moves(9, ["pass", "pass", "E5"]), 9)).toBe(false);
    expect(isValidGame([[1]], 9)).toBe(false);
    expect(isValidGame([], 15)).toBe(false);
    expect(isValidGame("E5", 9)).toBe(false);
    expect(isValidGame(Array(maxMoves(9) + 1).fill(PASS), 9)).toBe(false);
    expect(replay(moves(9, ["E5", "D5", "E5"]), 9).bad).toBe(2);
  });
});
