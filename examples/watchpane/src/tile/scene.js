/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — where the card goes
 *
 * The card sits in a corner of the focused pane (above its Composer when
 * the corner is at the bottom), with its row of buttons under it and,
 * while it is open, the recent list on the side facing into the pane:
 * above the card in a bottom corner, below the buttons in a top corner.
 * Pure geometry: the window layout Tilefold reports and the corner
 * setting in, rectangles out, by overlay item id.
 *
 *     ┌──────────────────────────────┐
 *     │             card             │
 *     └──────────────────────────────┘
 *      [↺]  [▶]  [↻]  [🔊]  [☰]  [⧉]
 */
import { BUTTON, BUTTONS } from "../render/buttons.js";
import { CARD_H, CARD_W } from "../render/card.js";
import { LIST_H, LIST_W } from "../render/list.js";

/** The corners the card can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
/** Space between the card, its buttons and the list. */
export const GAP = 6;
/** How far the card keeps from the pane's edges. */
export const MARGIN = 12;

/** The corner for a setting value (bottom-right for anything unknown). */
export const cornerOf = (corner) => (CORNERS.includes(corner) ? corner : "bottom-right");

/** The area the card may use: the focused pane down to its Composer, or the window. */
export function areaOf(layout) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const pane = panes.find((p) => p?.focused) ?? panes[0];
  if (pane) {
    const bottom = pane.composer ? pane.composer.y : pane.y + pane.h;
    return { x: pane.x, y: pane.y, w: pane.w, h: Math.max(0, bottom - pane.y) };
  }
  const content = layout?.content ?? { w: 800, h: 600 };
  return { x: 0, y: 0, w: content.w, h: content.h };
}

/**
 * Every item's rectangle: `card`, `btn-<id>` for each button and, with
 * `list`, `list`. Whole CSS pixels, kept inside the window.
 */
export function computeLayout(layout, corner, { list = false } = {}) {
  const at = cornerOf(corner);
  const area = areaOf(layout);
  const groupH = CARD_H + GAP + BUTTON;
  const right = at.endsWith("right");
  const bottom = at.startsWith("bottom");
  const gx = Math.max(0, Math.round(right ? area.x + area.w - CARD_W - MARGIN : area.x + MARGIN));
  const gy = Math.max(0, Math.round(bottom ? area.y + area.h - groupH - MARGIN : area.y + MARGIN));
  const rects = { card: { x: gx, y: gy, w: CARD_W, h: CARD_H } };
  // The buttons spread evenly under the card, the outer ones flush with its edges.
  const step = (CARD_W - BUTTON) / (BUTTONS.length - 1);
  BUTTONS.forEach((b, i) => {
    rects[`btn-${b.id}`] = {
      x: Math.round(gx + i * step),
      y: gy + CARD_H + GAP,
      w: BUTTON,
      h: BUTTON,
    };
  });
  if (list) {
    const ly = bottom ? gy - GAP - LIST_H : gy + groupH + GAP;
    rects.list = { x: gx, y: Math.max(0, ly), w: LIST_W, h: LIST_H };
  }
  return rects;
}
