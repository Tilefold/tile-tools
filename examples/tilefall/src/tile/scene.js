/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — scene layout
 *
 * Works out where each overlay item goes. The game is one group — the
 * board on one side and, in a column beside it, the panel with the button
 * keypad under it — placed in a corner of the focused pane (above its
 * Composer when the corner is at the bottom). Pure geometry: it takes the
 * window layout Tilefold reports and the user's size and corner settings,
 * and returns rectangles.
 *
 *     ┌────────┐ ┌──────┐
 *     │        │ │panel │
 *     │ board  │ │      │
 *     │        │ ├──────┤
 *     │        │ │keypad│
 *     └────────┘ └──────┘
 */
import { BOARD_H, BOARD_W } from "../render/board.js";
import { BUTTON, BUTTON_GAP, BUTTONS } from "../render/buttons.js";
import { PANEL_H, PANEL_W } from "../render/panel.js";

/** Display scales for the size setting (logical size × scale). */
export const SIZES = { small: 0.75, medium: 1 };

/** The corners the group can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];

/** Space between the board and the column, and between the panel and the keypad. */
export const GAP = 6;
export const KEYPAD_GAP = BOARD_H - PANEL_H - (BUTTON * 2 + BUTTON_GAP);

/** How far the group keeps from the pane's edges. */
export const MARGIN = 12;

/**
 * The scale for a size setting value (medium for anything unknown).
 *
 * @param {unknown} size
 * @returns {number}
 */
export function scaleOf(size) {
  return SIZES[/** @type {string} */ (size)] ?? SIZES.medium;
}

/**
 * The corner for a setting value (bottom-right for anything unknown).
 *
 * @param {unknown} corner
 * @returns {string}
 */
export function cornerOf(corner) {
  return CORNERS.includes(/** @type {string} */ (corner))
    ? /** @type {string} */ (corner)
    : "bottom-right";
}

/**
 * The pane the game lives in: the focused one, else the first, else none.
 *
 * @param {any} layout What `tf.overlay.layout()` returned.
 * @returns {any|null}
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
 * The size of the whole group at a scale.
 *
 * @param {number} scale
 * @returns {{ w: number, h: number }}
 */
export function groupSize(scale) {
  return { w: Math.round((BOARD_W + GAP + PANEL_W) * scale), h: Math.round(BOARD_H * scale) };
}

/**
 * Every item's rectangle, by item id: `board`, `panel` and `btn-<id>` for
 * each button. Coordinates are whole CSS pixels in the window.
 *
 * @param {any} layout What `tf.overlay.layout()` returned (may be null).
 * @param {{ size?: unknown, corner?: unknown }} [settings]
 * @returns {Record<string, { x: number, y: number, w: number, h: number }>}
 */
export function computeLayout(layout, settings = {}) {
  const scale = scaleOf(settings.size);
  const corner = cornerOf(settings.corner);
  const area = areaOf(layout);
  const group = groupSize(scale);

  // Corner placement, kept inside the window even when the pane is tiny.
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  let gx = right ? area.x + area.w - group.w - MARGIN : area.x + MARGIN;
  let gy = bottom ? area.y + area.h - group.h - MARGIN : area.y + MARGIN;
  gx = Math.max(0, Math.round(gx));
  gy = Math.max(0, Math.round(gy));

  // The board goes on the outer side, the column towards the pane's middle.
  const boardW = Math.round(BOARD_W * scale);
  const colW = Math.round(PANEL_W * scale);
  const gap = Math.round(GAP * scale);
  const boardX = right ? gx + colW + gap : gx;
  const colX = right ? gx : gx + boardW + gap;

  /** @type {Record<string, { x: number, y: number, w: number, h: number }>} */
  const rects = {
    board: { x: boardX, y: gy, w: boardW, h: Math.round(BOARD_H * scale) },
    panel: { x: colX, y: gy, w: colW, h: Math.round(PANEL_H * scale) },
  };
  const keypadY = gy + (PANEL_H + KEYPAD_GAP) * scale;
  const btn = Math.round(BUTTON * scale);
  for (const b of BUTTONS) {
    rects[`btn-${b.id}`] = {
      x: Math.round(colX + b.col * (BUTTON + BUTTON_GAP) * scale),
      y: Math.round(keypadY + b.row * (BUTTON + BUTTON_GAP) * scale),
      w: btn,
      h: btn,
    };
  }
  return rects;
}
