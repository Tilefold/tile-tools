/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall game engine
 *
 * Advances a falling-block game without browser or rendering dependencies.
 */

import { createBoard, collides, mergePiece, clearLines } from "./board.js";
import { KINDS, cellsFor, kickTests } from "./pieces.js";
import { createBag } from "./rng.js";
import { clearScore, dropScore, levelForLines } from "./scoring.js";

/** A piece has a spawn-box origin and one of four rotation states. */
function placedCells(piece) {
  return cellsFor(piece.kind, piece.rotation).map(([x, y]) => [x + piece.x, y + piece.y]);
}

/** Copy a board without exposing its mutable row arrays. */
function copyBoard(board) {
  return board.map((row) => [...row]);
}

/**
 * Create a fresh game, or resume every gameplay field from a JSON snapshot.
 * Snapshots are plain data and can be stored with JSON.stringify(toJSON()).
 */
export function createGame({ seed, startLevel = 1, snapshot } = {}) {
  if (!Number.isInteger(startLevel) || startLevel < 1) {
    throw new RangeError("startLevel must be a positive integer");
  }

  let board = snapshot ? copyBoard(snapshot.board) : createBoard();
  let bag = createBag(seed, snapshot?.bag);
  let queue = snapshot ? [...snapshot.queue] : [];
  let active = snapshot?.active ? { ...snapshot.active } : null;
  let held = snapshot?.hold ?? null;
  let canHold = snapshot?.canHold ?? true;
  let score = snapshot?.score ?? 0;
  let lines = snapshot?.lines ?? 0;
  let levelStart = snapshot?.startLevel ?? startLevel;
  let level = snapshot?.level ?? levelStart;
  let over = snapshot?.over ?? false;
  let clears = snapshot?.clears ?? 0;
  let lastClear = snapshot?.lastClear ? { ...snapshot.lastClear } : null;
  let lockResets = snapshot?.lockResets ?? 0;
  let grace = snapshot?.grace ?? 0;

  /** Refill after shifting so the player always sees exactly three kinds. */
  function fillQueue() {
    while (queue.length < 3) queue.push(bag.next());
  }

  /** A blocked spawn immediately ends the game and leaves no active piece. */
  function spawn(kind) {
    active = { kind, rotation: 0, x: 3, y: 0 };
    lockResets = 0;
    grace = 0;
    if (collides(board, placedCells(active))) {
      active = null;
      over = true;
    }
  }

  /** Consume the queue only when the next piece really enters play. */
  function spawnNext() {
    const kind = queue.shift();
    fillQueue();
    spawn(kind);
  }

  if (!snapshot) {
    fillQueue();
    spawnNext();
  }

  function grounded() {
    return collides(board, placedCells({ ...active, y: active.y + 1 }));
  }

  /** A successful grounded move may postpone one lock, at most 15 times. */
  function resetLockIfGrounded(wasGrounded) {
    if (wasGrounded && lockResets < 15) {
      lockResets += 1;
      grace = 1;
    }
  }

  function translate(dx) {
    if (over || !active) return false;
    const wasGrounded = grounded();
    const candidate = { ...active, x: active.x + dx };
    if (collides(board, placedCells(candidate))) return false;
    active = candidate;
    resetLockIfGrounded(wasGrounded);
    return true;
  }

  function rotate(direction) {
    if (over || !active) return false;
    const wasGrounded = grounded();
    const nextRotation = (active.rotation + direction + 4) % 4;
    for (const [dx, dy] of kickTests(active.kind, active.rotation, nextRotation)) {
      const candidate = {
        ...active,
        rotation: nextRotation,
        x: active.x + dx,
        y: active.y + dy,
      };
      if (!collides(board, placedCells(candidate))) {
        active = candidate;
        resetLockIfGrounded(wasGrounded);
        return true;
      }
    }
    return false;
  }

  /** Merge, score, clear rows, and enter the next piece. */
  function lock() {
    const cells = placedCells(active);
    mergePiece(board, cells, KINDS.indexOf(active.kind) + 1);
    const removed = clearLines(board);
    score += clearScore(removed, level);
    lines += removed;
    level = levelForLines(lines, levelStart);
    if (removed > 0) clears += 1;
    lastClear = removed ? { lines: removed } : null;
    canHold = true;
    // A piece that locked above the board topped out even if rows were cleared.
    if (cells.some(([, y]) => y < 0)) {
      active = null;
      over = true;
    } else {
      spawnNext();
    }
  }

  /** Return only fresh objects and arrays, including each cell coordinate. */
  function getState() {
    let ghost = [];
    if (active) {
      const projection = { ...active };
      while (!collides(board, placedCells({ ...projection, y: projection.y + 1 }))) {
        projection.y += 1;
      }
      ghost = placedCells(projection);
    }
    return {
      board: copyBoard(board),
      active: active ? { kind: active.kind, cells: placedCells(active) } : null,
      ghost,
      next: [...queue],
      hold: held,
      canHold,
      score,
      lines,
      level,
      over,
      clears,
      lastClear: lastClear ? { ...lastClear } : null,
    };
  }

  /** Save the randomizer and lock timer as well as visible game state. */
  function toJSON() {
    return {
      version: 1,
      board: copyBoard(board),
      bag: bag.toJSON(),
      queue: [...queue],
      active: active ? { ...active } : null,
      hold: held,
      canHold,
      score,
      lines,
      startLevel: levelStart,
      level,
      over,
      clears,
      lastClear: lastClear ? { ...lastClear } : null,
      lockResets,
      grace,
    };
  }

  return {
    moveLeft: () => translate(-1),
    moveRight: () => translate(1),
    rotateCW: () => rotate(1),
    rotateCCW: () => rotate(-1),
    softDrop() {
      if (over || !active || grounded()) return false;
      active.y += 1;
      score += dropScore(1);
      grace = 0;
      return true;
    },
    hardDrop() {
      if (over || !active) return false;
      let rows = 0;
      while (!grounded()) {
        active.y += 1;
        rows += 1;
      }
      score += dropScore(rows, true);
      lock();
      return true;
    },
    hold() {
      if (over || !active || !canHold) return false;
      const outgoing = active.kind;
      if (held === null) {
        held = outgoing;
        spawnNext();
      } else {
        const incoming = held;
        held = outgoing;
        spawn(incoming);
      }
      canHold = false;
      return true;
    },
    tick() {
      if (over || !active) return false;
      if (!grounded()) {
        active.y += 1;
        grace = 0;
      } else if (grace > 0) {
        grace -= 1;
      } else {
        lock();
      }
      return true;
    },
    getState,
    toJSON,
  };
}
