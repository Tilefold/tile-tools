/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — side panel picture
 *
 * Draws the panel beside the board: the next pieces, the held piece (dimmed
 * while holding is not allowed), the score, the best score, the level and
 * the lines cleared. Labels arrive translated; numbers are formatted by the
 * caller so the panel never guesses a locale.
 *
 * The panel shows pieces in their spawn orientation from its own small
 * table, so it depends on nothing in the engine but the kind letters.
 */
import { THEME, blockEl, colorOf, svgUrl, textEl } from "./svg.js";

/** The panel's logical size. */
export const PANEL_W = 84;
export const PANEL_H = 186;

/** Each kind's cells in spawn orientation, inside a 4×2 box. */
export const PREVIEW_CELLS = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};

/**
 * One piece centred in a box.
 *
 * @param {string|null|undefined} kind
 * @param {number} cx Centre x of the box.
 * @param {number} cy Centre y.
 * @param {number} cell Block size.
 * @param {number} [opacity]
 * @returns {string}
 */
export function previewEl(kind, cx, cy, cell, opacity = 1) {
  const cells = kind ? PREVIEW_CELLS[kind] : null;
  if (!cells) return "";
  const maxX = Math.max(...cells.map(([x]) => x));
  const maxY = Math.max(...cells.map(([, y]) => y));
  const left = cx - ((maxX + 1) * cell) / 2;
  const top = cy - ((maxY + 1) * cell) / 2;
  return cells
    .map(([x, y]) => blockEl(left + x * cell, top + y * cell, cell, colorOf(kind), opacity))
    .join("");
}

/**
 * A small label above a value.
 *
 * @param {number} y Baseline of the label.
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function stat(y, label, value) {
  return (
    textEl({
      x: 8,
      y,
      text: label,
      size: 8,
      fill: THEME.muted,
      weight: 600,
      maxWidth: PANEL_W - 16,
    }) +
    textEl({
      x: PANEL_W - 8,
      y: y + 13,
      text: value,
      size: 12,
      weight: 700,
      anchor: "end",
      maxWidth: PANEL_W - 16,
    })
  );
}

/**
 * Draws the panel.
 *
 * @param {{ next?: string[], hold?: string|null, canHold?: boolean,
 *           score: string, best: string, level: string, lines: string }} view
 *   Pieces and already-formatted numbers.
 * @param {{ next: string, hold: string, score: string, best: string,
 *           level: string, lines: string }} labels Translated labels.
 * @param {{ displayW?: number, displayH?: number }} [opts]
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderPanel(view, labels, opts = {}) {
  const next = Array.isArray(view.next) ? view.next : [];
  let body =
    `<rect x="0.5" y="0.5" width="${PANEL_W - 1}" height="${PANEL_H - 1}" rx="6" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`;

  // Next: the first piece large, the two after it small, side by side.
  body += textEl({
    x: 8,
    y: 13,
    text: labels.next,
    size: 8,
    fill: THEME.muted,
    weight: 600,
    maxWidth: PANEL_W - 16,
  });
  body += previewEl(next[0], PANEL_W / 2, 28, 7);
  body += previewEl(next[1], PANEL_W / 4 + 2, 48, 4, 0.75);
  body += previewEl(next[2], (PANEL_W * 3) / 4 - 2, 48, 4, 0.75);

  // Hold: dimmed while the held piece cannot be swapped back in.
  body += textEl({
    x: 8,
    y: 68,
    text: labels.hold,
    size: 8,
    fill: THEME.muted,
    weight: 600,
    maxWidth: PANEL_W - 16,
  });
  body += previewEl(view.hold, PANEL_W / 2, 82, 6, view.canHold === false ? 0.35 : 1);

  body += stat(104, labels.score, view.score);
  body += stat(130, labels.best, view.best);
  body += stat(156, labels.level, view.level);
  // Lines share the level's row on the left, to keep the panel short.
  body += textEl({
    x: 8,
    y: 169,
    text: `${labels.lines} ${view.lines}`,
    size: 9,
    fill: THEME.text,
    maxWidth: 46,
  });

  return svgUrl(PANEL_W, PANEL_H, body, opts.displayW, opts.displayH);
}

/**
 * A short text summary of the panel for screen readers (the item label).
 *
 * @param {{ score: string, level: string, lines: string }} view
 * @param {{ score: string, level: string, lines: string }} labels
 * @returns {string}
 */
export function panelLabel(view, labels) {
  return `${labels.score} ${view.score}, ${labels.level} ${view.level}, ${labels.lines} ${view.lines}`.slice(
    0,
    80,
  );
}
