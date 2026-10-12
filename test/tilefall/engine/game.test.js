/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Game tests
 *
 * Checks movement, locking, hold, scoring, game over, and save restoration.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "../../../examples/tilefall/src/engine/game.js";
import { cellsFor } from "../../../examples/tilefall/src/engine/pieces.js";

function withActive(kind, x, y, rotation = 0) {
  const snapshot = createGame({ seed: 7 }).toJSON();
  snapshot.active = { kind, rotation, x, y };
  return createGame({ snapshot });
}

describe("movement and locking", () => {
  it("spawns at the top center with three upcoming pieces", () => {
    const game = createGame({ seed: 5 });
    const state = game.getState();
    expect(state.next).toHaveLength(3);
    expect(state.active.cells.every(([x, y]) => x >= 3 && x <= 6 && y <= 2)).toBe(true);
    expect(state.board).toHaveLength(20);
  });

  it("moves, drops, and reports blocked actions", () => {
    const game = withActive("O", -1, 0);
    expect(game.moveLeft()).toBe(false);
    expect(game.moveRight()).toBe(true);
    const before = game.getState().score;
    expect(game.softDrop()).toBe(true);
    expect(game.getState().score).toBe(before + 1);
    const bottom = withActive("O", 3, 18);
    expect(bottom.softDrop()).toBe(false);
  });

  it("projects the ghost onto the floor and updates it after a move", () => {
    const game = withActive("O", 3, 0);
    expect(game.getState().ghost).toEqual([
      [4, 18],
      [5, 18],
      [4, 19],
      [5, 19],
    ]);
    game.moveRight();
    expect(game.getState().ghost).toEqual([
      [5, 18],
      [6, 18],
      [5, 19],
      [6, 19],
    ]);
  });

  it("locks immediately on hard drop and adds two points per row", () => {
    const game = withActive("O", 3, 0);
    expect(game.hardDrop()).toBe(true);
    expect(game.getState().score).toBe(36);
    expect(game.getState().board[19][4]).toBe(2);
    expect(game.getState().active).not.toBeNull();
  });

  it("locks on a grounded tick without grace", () => {
    const game = withActive("O", 3, 18);
    expect(game.tick()).toBe(true);
    expect(game.getState().board[19][4]).toBe(2);
  });

  it("gives a grounded move one extra tick before locking", () => {
    const game = withActive("O", 3, 18);
    expect(game.moveRight()).toBe(true);
    expect(game.tick()).toBe(true);
    expect(game.getState().board[19][5]).toBe(0);
    expect(game.tick()).toBe(true);
    expect(game.getState().board[19][5]).toBe(2);
  });

  it("caps grounded move resets at fifteen", () => {
    const game = withActive("O", 3, 18);
    for (let i = 0; i < 15; i += 1) {
      expect(i % 2 === 0 ? game.moveRight() : game.moveLeft()).toBe(true);
      expect(game.tick()).toBe(true); // Consume the one-tick grace.
      expect(game.getState().board[19].every((cell) => cell === 0)).toBe(true);
    }
    expect(game.moveLeft()).toBe(true);
    expect(game.tick()).toBe(true);
    expect(game.getState().board[19].some((cell) => cell === 2)).toBe(true);
  });

  it("also grants grace on a grounded rotation", () => {
    const game = withActive("T", 3, 18);
    expect(game.rotateCW()).toBe(true);
    expect(game.tick()).toBe(true);
    expect(game.getState().board[19].every((cell) => cell === 0)).toBe(true);
  });
});

describe("hold and progression", () => {
  it("permits hold once per piece and resets after locking", () => {
    const game = createGame({ seed: 3 });
    const first = game.getState().active.kind;
    const next = game.getState().next[0];
    expect(game.hold()).toBe(true);
    expect(game.getState()).toMatchObject({ hold: first, canHold: false });
    expect(game.getState().active.kind).toBe(next);
    expect(game.hold()).toBe(false);
    expect(game.hardDrop()).toBe(true);
    expect(game.getState().canHold).toBe(true);
    expect(game.hold()).toBe(true);
    expect(game.getState().active.kind).toBe(first);
    expect(game.getState().canHold).toBe(false);
  });

  it("scores a clear at the old level and levels up at ten lines", () => {
    const snapshot = createGame({ seed: 4, startLevel: 2 }).toJSON();
    snapshot.lines = 9;
    snapshot.active = { kind: "I", rotation: 0, x: 3, y: 18 };
    snapshot.board[19].fill(1);
    for (let x = 3; x <= 6; x += 1) snapshot.board[19][x] = 0;
    const game = createGame({ snapshot });
    expect(game.hardDrop()).toBe(true);
    expect(game.getState()).toMatchObject({
      score: 200,
      lines: 10,
      level: 3,
      clears: 1,
      lastClear: { lines: 1 },
    });
  });

  it("sets game over on a blocked next spawn and rejects all actions", () => {
    const snapshot = createGame({ seed: 8 }).toJSON();
    snapshot.active = { kind: "O", rotation: 0, x: 0, y: 18 };
    const [x, y] = cellsFor(snapshot.queue[0], 0)[0];
    snapshot.board[y][x + 3] = 4;
    const game = createGame({ snapshot });
    expect(game.hardDrop()).toBe(true);
    expect(game.getState()).toMatchObject({ over: true, active: null });
    for (const action of [
      "moveLeft",
      "moveRight",
      "rotateCW",
      "rotateCCW",
      "softDrop",
      "hardDrop",
      "hold",
      "tick",
    ]) {
      expect(game[action]()).toBe(false);
    }
  });

  it("restores a snapshot and continues the same random sequence", () => {
    const original = createGame({ seed: "save", startLevel: 3 });
    original.hold();
    original.softDrop();
    original.rotateCW();
    const snapshot = JSON.parse(JSON.stringify(original.toJSON()));
    const resumed = createGame({ snapshot });
    expect(resumed.getState()).toEqual(original.getState());
    for (let i = 0; i < 12; i += 1) {
      original.hardDrop();
      resumed.hardDrop();
      expect(resumed.getState()).toEqual(original.getState());
    }
  });

  it("returns copies of all visible state and snapshots", () => {
    const game = createGame({ seed: 9 });
    const state = game.getState();
    const original = game.getState();
    state.board[0][0] = 7;
    state.active.cells[0][0] = -99;
    state.ghost[0][0] = -99;
    state.next[0] = "bad";
    const snapshot = game.toJSON();
    snapshot.board[0][0] = 7;
    snapshot.queue[0] = "bad";
    snapshot.bag.remaining.push("bad");
    expect(game.getState()).toEqual(original);
  });
});
