/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku page — the board
 *
 * The 15 × 15 points as a grid of buttons, so the board works with the
 * keyboard and a screen reader as well as the mouse: one point at a time
 * is in the tab order, the arrow keys (and Home/End) move between points,
 * and Enter or Space plays the one in focus. Each point says its name and
 * what's on it ("H8, black"). The last move is ringed and a winning line
 * marked; the lines of the board are drawn by each point's own background.
 */
import { SIZE, boardOf, cellName } from "./game.js";

/**
 * Builds the board in `root`. `onPlay(x, y)` is called for a click, or
 * Enter or Space on a point.
 *
 * @param {HTMLElement} root
 * @param {{ onPlay: (x: number, y: number) => void }} options
 */
export function createBoard(root, { onPlay }) {
  /** @type {HTMLButtonElement[]} */
  const points = [];
  let focusIndex = Math.floor((SIZE * SIZE) / 2); // the middle point, H8
  root.setAttribute("role", "grid");
  for (let y = 0; y < SIZE; y++) {
    const row = document.createElement("div");
    row.setAttribute("role", "row");
    row.className = "board-row";
    for (let x = 0; x < SIZE; x++) {
      const point = document.createElement("button");
      point.type = "button";
      point.className = "point";
      point.setAttribute("role", "gridcell");
      point.dataset.x = String(x);
      point.dataset.y = String(y);
      // Edges and corners draw only the inner half of their lines.
      if (x === 0) point.classList.add("edge-left");
      if (x === SIZE - 1) point.classList.add("edge-right");
      if (y === 0) point.classList.add("edge-top");
      if (y === SIZE - 1) point.classList.add("edge-bottom");
      point.tabIndex = -1;
      point.addEventListener("click", () => onPlay(x, y));
      points.push(point);
      row.append(point);
    }
    root.append(row);
  }
  points[focusIndex].tabIndex = 0;

  /** Moves the keyboard's point to `index`. */
  const focusOn = (index) => {
    points[focusIndex].tabIndex = -1;
    focusIndex = index;
    points[index].tabIndex = 0;
    points[index].focus();
  };

  root.addEventListener("keydown", (e) => {
    const x = focusIndex % SIZE;
    const y = Math.floor(focusIndex / SIZE);
    const to = {
      ArrowLeft: [Math.max(0, x - 1), y],
      ArrowRight: [Math.min(SIZE - 1, x + 1), y],
      ArrowUp: [x, Math.max(0, y - 1)],
      ArrowDown: [x, Math.min(SIZE - 1, y + 1)],
      Home: [0, y],
      End: [SIZE - 1, y],
    }[e.key];
    if (!to) return;
    e.preventDefault();
    focusOn(to[1] * SIZE + to[0]);
  });
  // A click moves the keyboard's point there too.
  root.addEventListener("focusin", (e) => {
    const index = points.indexOf(/** @type {any} */ (e.target));
    if (index >= 0 && index !== focusIndex) {
      points[focusIndex].tabIndex = -1;
      focusIndex = index;
      points[index].tabIndex = 0;
    }
  });

  return {
    /**
     * Draws `moves`, ringing the last one and marking `line` (a win), with
     * points clickable only when `playable`. `label(name, stone)` words a
     * point for screen readers; `stone` is "black", "white" or null.
     */
    draw({ moves, line, playable, label }) {
      const board = boardOf(moves);
      const last = moves.length ? moves[moves.length - 1] : null;
      const winning = new Set((line ?? []).map(([x, y]) => y * SIZE + x));
      root.classList.toggle("playable", playable);
      points.forEach((point, i) => {
        const x = i % SIZE;
        const y = Math.floor(i / SIZE);
        const stone = board[i];
        point.dataset.stone = stone ?? "";
        point.classList.toggle("last", !!last && last[0] === x && last[1] === y);
        point.classList.toggle("win", winning.has(i));
        point.setAttribute("aria-label", label(cellName(x, y), stone));
        point.setAttribute("aria-disabled", String(!playable || !!stone));
      });
    },
  };
}
