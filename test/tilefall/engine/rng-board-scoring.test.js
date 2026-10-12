/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Core helper tests
 *
 * Checks random bags, board boundaries, line clearing, and score math.
 */

import { describe, expect, it } from "vitest";
import { KINDS } from "../../../examples/tilefall/src/engine/pieces.js";
import { createBag } from "../../../examples/tilefall/src/engine/rng.js";
import {
  createBoard,
  collides,
  mergePiece,
  clearLines,
} from "../../../examples/tilefall/src/engine/board.js";
import {
  clearScore,
  dropScore,
  levelForLines,
  gravityMs,
} from "../../../examples/tilefall/src/engine/scoring.js";

it("each consecutive seven draws contains every kind once", () => {
  const bag = createBag(42);
  for (let run = 0; run < 20; run += 1) {
    expect(Array.from({ length: 7 }, () => bag.next()).sort()).toEqual([...KINDS].sort());
  }
});

it("seeded bags and restored partial bags produce identical sequences", () => {
  const first = createBag("seed");
  const second = createBag("seed");
  expect(Array.from({ length: 30 }, () => first.next())).toEqual(
    Array.from({ length: 30 }, () => second.next()),
  );
  const checkpoint = first.toJSON();
  const restored = createBag(999, checkpoint);
  expect(Array.from({ length: 20 }, () => first.next())).toEqual(
    Array.from({ length: 20 }, () => restored.next()),
  );
});

describe("board", () => {
  it("rejects walls and floor but permits cells above the top", () => {
    const board = createBoard();
    expect(collides(board, [[-1, 0]])).toBe(true);
    expect(collides(board, [[10, 0]])).toBe(true);
    expect(collides(board, [[0, 20]])).toBe(true);
    expect(collides(board, [[0, -1]])).toBe(false);
    mergePiece(board, [[3, 4]], 6);
    expect(collides(board, [[3, 4]])).toBe(true);
    expect(board[4][3]).toBe(6);
  });

  it.each([1, 2, 3, 4])("clears %i adjacent full lines", (count) => {
    const board = createBoard();
    for (let y = 20 - count; y < 20; y += 1) board[y].fill(1);
    board[19 - count][0] = 5;
    expect(clearLines(board)).toBe(count);
    expect(board).toHaveLength(20);
    expect(board[19][0]).toBe(5);
    expect(board[0]).toEqual(Array(10).fill(0));
  });

  it("clears non-adjacent rows without skipping shifted rows", () => {
    const board = createBoard();
    board[19].fill(1);
    board[17].fill(2);
    board[18][2] = 3;
    expect(clearLines(board)).toBe(2);
    expect(board[19][2]).toBe(3);
    expect(board[18]).toEqual(Array(10).fill(0));
  });
});

describe("scoring", () => {
  it.each([
    [1, 100],
    [2, 300],
    [3, 500],
    [4, 800],
  ])("awards %i-line points at each level", (count, base) => {
    expect(clearScore(count, 1)).toBe(base);
    expect(clearScore(count, 4)).toBe(base * 4);
  });

  it("awards distance points and advances each ten lines", () => {
    expect(dropScore(6)).toBe(6);
    expect(dropScore(6, true)).toBe(12);
    expect(levelForLines(9, 3)).toBe(3);
    expect(levelForLines(10, 3)).toBe(4);
    expect(levelForLines(20, 3)).toBe(5);
  });

  it("matches guideline gravity and applies its lower bound", () => {
    expect(gravityMs(1)).toBe(1000);
    expect(gravityMs(2)).toBeCloseTo(793);
    expect(gravityMs(3)).toBeCloseTo(Math.pow(0.786, 2) * 1000);
    expect(gravityMs(100)).toBe(30);
  });
});
