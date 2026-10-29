/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo page — the board
 *
 * The board's points as a grid of buttons, so it works with the keyboard
 * and a screen reader as well as the mouse: one point at a time is in the
 * tab order, the arrow keys (and Home/End) move between points, and Enter
 * or Space plays the one in focus (or, while the dead stones are marked,
 * marks the chain there). Each point says its name and what's on it
 * ("E5, black"). The last move is ringed, the star points dotted, and
 * while marking, dead stones fade under a cross and each side's area shows
 * as a small square of its color. The board is built again when the game's
 * size changes; the lines are drawn by each point's own background.
 * Around it, the frame shows the column letters (without I) above and below
 * and the row numbers on both sides, counted from the bottom, as the
 * points are named; screen readers skip them, since each point says its
 * own name.
 */
import { COLUMNS, cellName } from "./game.js";

/** The star points (hoshi) on each board size, as [x, y]. */
const STARS = {
  9: [2, 6].flatMap((a) => [2, 6].map((b) => [a, b])).concat([[4, 4]]),
  13: [3, 6, 9].flatMap((a) => [3, 6, 9].map((b) => [a, b])),
  19: [3, 9, 15].flatMap((a) => [3, 9, 15].map((b) => [a, b])),
};

/**
 * Builds the board in `root`. `onPoint(x, y)` is called for a click, or
 * Enter or Space on a point. `frame`, when given, holds the board and its
 * `.coords.cols` and `.coords.rows` strips, which get the coordinates.
 *
 * @param {HTMLElement} root
 * @param {{ onPoint: (x: number, y: number) => void, frame?: HTMLElement | null }} options
 */
export function createBoard(root, { onPoint, frame = null }) {
  /** @type {HTMLButtonElement[]} */
  let points = [];
  let size = 0;
  let focusIndex = 0;
  root.setAttribute("role", "grid");

  /** Builds the points of a board of `n` × `n`. */
  function build(n) {
    size = n;
    points = [];
    root.textContent = "";
    root.style.setProperty("--n", String(n));
    if (frame) labelFrame(n);
    const stars = new Set((STARS[n] ?? []).map(([x, y]) => y * n + x));
    for (let y = 0; y < n; y++) {
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      row.className = "board-row";
      for (let x = 0; x < n; x++) {
        const point = document.createElement("button");
        point.type = "button";
        point.className = "point";
        point.setAttribute("role", "gridcell");
        point.dataset.x = String(x);
        point.dataset.y = String(y);
        // Edges and corners draw only the inner half of their lines.
        if (x === 0) point.classList.add("edge-left");
        if (x === n - 1) point.classList.add("edge-right");
        if (y === 0) point.classList.add("edge-top");
        if (y === n - 1) point.classList.add("edge-bottom");
        if (stars.has(y * n + x)) point.classList.add("star");
        point.tabIndex = -1;
        point.addEventListener("click", () => onPoint(x, y));
        points.push(point);
        row.append(point);
      }
      root.append(row);
    }
    focusIndex = Math.floor((n * n) / 2); // the middle point
    points[focusIndex].tabIndex = 0;
  }

  /** Writes the coordinates of a board of `n` into the frame's strips. */
  function labelFrame(n) {
    frame.style.setProperty("--n", String(n));
    const fill = (strip, names) => {
      strip.textContent = "";
      strip.setAttribute("aria-hidden", "true");
      for (const name of names) {
        const label = document.createElement("span");
        label.textContent = name;
        strip.append(label);
      }
    };
    const columns = [...COLUMNS.slice(0, n)];
    const rows = Array.from({ length: n }, (_, y) => String(n - y));
    for (const strip of frame.querySelectorAll(".coords.cols")) fill(strip, columns);
    for (const strip of frame.querySelectorAll(".coords.rows")) fill(strip, rows);
  }

  /** Moves the keyboard's point to `index`. */
  const focusOn = (index) => {
    points[focusIndex].tabIndex = -1;
    focusIndex = index;
    points[index].tabIndex = 0;
    points[index].focus();
  };

  root.addEventListener("keydown", (e) => {
    if (!size) return;
    const x = focusIndex % size;
    const y = Math.floor(focusIndex / size);
    const to = {
      ArrowLeft: [Math.max(0, x - 1), y],
      ArrowRight: [Math.min(size - 1, x + 1), y],
      ArrowUp: [x, Math.max(0, y - 1)],
      ArrowDown: [x, Math.min(size - 1, y + 1)],
      Home: [0, y],
      End: [size - 1, y],
    }[e.key];
    if (!to) return;
    e.preventDefault();
    focusOn(to[1] * size + to[0]);
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
     * Draws `board` (one entry per point: "black", "white" or null) on a
     * board of `n`, ringing point `last`. Points can be played when
     * `playable`, and stones clicked to mark them when `marking`; `dead` is
     * the set of points marked dead, `area` (while marking) whose area each
     * point is. `label(name, stone, dead, owner)` words a point for screen
     * readers.
     */
    draw({ size: n, board, last, playable, marking, dead, area, label }) {
      if (n !== size) build(n);
      root.classList.toggle("playable", playable);
      root.classList.toggle("marking", marking);
      points.forEach((point, i) => {
        const stone = board[i];
        const isDead = dead.has(i);
        const owner = area ? area[i] : null;
        point.dataset.stone = stone ?? "";
        point.dataset.area = owner && (!stone || isDead) ? owner : "";
        point.classList.toggle("last", last === i);
        point.classList.toggle("dead", isDead);
        point.setAttribute(
          "aria-label",
          label(cellName(n, i % n, Math.floor(i / n)), stone, isDead, owner),
        );
        const usable = (playable && !stone) || (marking && !!stone);
        point.setAttribute("aria-disabled", String(!usable));
      });
    },
  };
}
