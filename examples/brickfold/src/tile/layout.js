/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Arcade kit — layout
 *
 * Where the board and its button row go. The group sits in a corner of the
 * focused pane (above its Composer when the corner is at the bottom), with
 * the board on top and a row of round buttons under it. Pure geometry: it
 * takes the window layout Tilefold reports, the user's size and corner
 * settings and the board's logical size, and returns rectangles.
 *
 *     ┌──────────────┐
 *     │    board     │
 *     └──────────────┘
 *      ( ) ( ) ( ) ( )    buttons
 *
 * This file is the same in every arcade example.
 */
import { SIZES } from "./settings.js";

/** A button's side and the space between buttons, in logical pixels. */
export const BUTTON = 30;
export const BUTTON_GAP = 6;

/** Space between the board and the button row. */
export const GAP = 6;

/** How far the group keeps from the pane's edges. */
export const MARGIN = 12;

/**
 * The pane the game lives in: the focused one, else the first, else none.
 *
 * @param {any} layout What `tf.overlay.layout()` returned.
 * @returns {any | null}
 */
export function homePane(layout) {
  const panes = layout && Array.isArray(layout.panes) ? layout.panes : [];
  return panes.find((p) => p && p.focused) || panes[0] || null;
}

/**
 * The area the group may use: the pane down to its Composer, or the whole
 * window when there are no panes.
 *
 * @param {any} layout
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function areaOf(layout) {
  const pane = homePane(layout);
  if (pane) {
    const bottom = pane.composer ? pane.composer.y : pane.y + pane.h;
    return { x: pane.x, y: pane.y, w: pane.w, h: Math.max(0, bottom - pane.y) };
  }
  const content = (layout && layout.content) || { w: 800, h: 600 };
  return { x: 0, y: 0, w: content.w, h: content.h };
}

/**
 * Every item's rectangle: `board`, and `btn-<id>` for each button, in whole
 * CSS pixels.
 *
 * @param {any} layout What `tf.overlay.layout()` returned (may be null).
 * @param {{ size: string, corner: string }} settings
 * @param {{ w: number, h: number }} board The board's logical size.
 * @param {string[]} buttons Button ids, left to right.
 * @returns {Record<string, { x: number, y: number, w: number, h: number }>}
 */
export function computeLayout(layout, settings, board, buttons) {
  const scale = SIZES[settings.size] ?? 1;
  const area = areaOf(layout);
  const w = Math.round(board.w * scale);
  const boardH = Math.round(board.h * scale);
  const btn = Math.round(BUTTON * scale);
  const h = boardH + Math.round(GAP * scale) + btn;

  const right = settings.corner.endsWith("right");
  const bottom = settings.corner.startsWith("bottom");
  const gx = Math.max(0, Math.round(right ? area.x + area.w - w - MARGIN : area.x + MARGIN));
  const gy = Math.max(0, Math.round(bottom ? area.y + area.h - h - MARGIN : area.y + MARGIN));

  /** @type {Record<string, { x: number, y: number, w: number, h: number }>} */
  const rects = { board: { x: gx, y: gy, w, h: boardH } };
  // The row is centred under the board.
  const rowW = buttons.length * btn + (buttons.length - 1) * Math.round(BUTTON_GAP * scale);
  let x = gx + Math.round((w - rowW) / 2);
  const y = gy + boardH + Math.round(GAP * scale);
  for (const id of buttons) {
    rects[`btn-${id}`] = { x, y, w: btn, h: btn };
    x += btn + Math.round(BUTTON_GAP * scale);
  }
  return rects;
}
