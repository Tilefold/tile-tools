/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Piece tests
 *
 * Checks tetromino rotations and wall-kick behavior.
 */

import { describe, expect, it } from "vitest";
import { KINDS, cellsFor, kickTests } from "../../../examples/tilefall/src/engine/pieces.js";
import { createGame } from "../../../examples/tilefall/src/engine/game.js";

function gameWithPiece(kind, rotation, x, y) {
  const snapshot = createGame({ seed: 1 }).toJSON();
  snapshot.active = { kind, rotation, x, y };
  return createGame({ snapshot });
}

describe("tetrominoes", () => {
  it("uses the specified kind and board-code order", () => {
    expect(KINDS).toEqual(["I", "O", "T", "S", "Z", "J", "L"]);
  });

  it.each(KINDS)("%s has four states of four distinct cells", (kind) => {
    for (let state = 0; state < 4; state += 1) {
      const cells = cellsFor(kind, state);
      expect(cells).toHaveLength(4);
      expect(new Set(cells.map(String)).size).toBe(4);
    }
  });

  it("rotates T around its fixed 3 by 3 box", () => {
    expect(cellsFor("T", 0)).toEqual([
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
    expect(cellsFor("T", 1)).toEqual([
      [2, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(cellsFor("T", 2)).toEqual([
      [1, 2],
      [2, 1],
      [1, 1],
      [0, 1],
    ]);
  });

  it("keeps O in place through rotation and gives it no kicks", () => {
    expect(cellsFor("O", 0)).toEqual(cellsFor("O", 3));
    expect(kickTests("O", 0, 1)).toEqual([[0, 0]]);
  });

  it("kicks a T away from the right wall", () => {
    const game = gameWithPiece("T", 3, 8, 4);
    expect(game.rotateCW()).toBe(true);
    expect(Math.max(...game.getState().active.cells.map(([x]) => x))).toBe(9);
    expect(game.toJSON().active.x).toBe(7);
  });

  it("uses the I-specific two-cell kick at the left wall", () => {
    const game = gameWithPiece("I", 1, -2, 5);
    expect(game.rotateCCW()).toBe(true);
    expect(game.toJSON().active).toMatchObject({ rotation: 0, x: 0 });
    expect(Math.min(...game.getState().active.cells.map(([x]) => x))).toBe(0);
  });

  it("uses the I-specific kick at the right wall", () => {
    const game = gameWithPiece("I", 1, 7, 5);
    expect(game.rotateCW()).toBe(true);
    expect(game.toJSON().active).toMatchObject({ rotation: 2, x: 6 });
  });
});
