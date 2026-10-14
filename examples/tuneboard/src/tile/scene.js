/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — scene layout
 *
 * Works out where each overlay item goes: the card, with the row of
 * buttons (the volume control is wider) spread evenly under it, placed in a corner of the focused pane
 * (above its Composer when the corner is at the bottom), and, while it is
 * open, the playlist panel on the side facing into the pane: above the card
 * in a bottom corner, below the buttons in a top corner. Pure geometry: it
 * takes the window layout Tilefold reports and the size and corner
 * settings, and returns rectangles.
 *
 *     ┌──────────────────────────┐
 *     │           card           │
 *     └──────────────────────────┘
 *      [⏮]  [⏯]  [⏭]  [− 🔇 +]  [☰]
 */
import { BUTTON, BUTTONS } from "../render/buttons.js";
import { CARD_H, CARD_W } from "../render/card.js";
import { PANEL_H, PANEL_W } from "../render/panel.js";

/** Display scales for the size setting (logical size × scale). */
export const SIZES = { small: 0.8, medium: 1 };

/** The corners the group can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];

/** Space between the card and the button row. */
export const GAP = 6;

/** How far the group keeps from the pane's edges. */
export const MARGIN = 12;

/** The group's logical size. */
export const GROUP_W = CARD_W;
export const GROUP_H = CARD_H + GAP + BUTTON;

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
 * The pane the card lives in: the focused one, else the first, else none.
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
 * Every item's rectangle, by item id: `card`, `btn-<id>` for each button
 * and, with `panel`, `panel`. Coordinates are whole CSS pixels in the window.
 *
 * @param {any} layout What `tf.overlay.layout()` returned (may be null).
 * @param {{ size?: unknown, corner?: unknown }} [settings]
 * @param {{ panel?: boolean }} [options]
 * @returns {Record<string, { x: number, y: number, w: number, h: number }>}
 */
export function computeLayout(layout, settings = {}, options = {}) {
  const scale = scaleOf(settings.size);
  const corner = cornerOf(settings.corner);
  const area = areaOf(layout);
  const w = Math.round(GROUP_W * scale);
  const h = Math.round(GROUP_H * scale);

  // Corner placement, kept inside the window even when the pane is tiny.
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  const gx = Math.max(0, Math.round(right ? area.x + area.w - w - MARGIN : area.x + MARGIN));
  const gy = Math.max(0, Math.round(bottom ? area.y + area.h - h - MARGIN : area.y + MARGIN));

  /** @type {Record<string, { x: number, y: number, w: number, h: number }>} */
  const rects = { card: { x: gx, y: gy, w, h: Math.round(CARD_H * scale) } };

  // Buttons spread evenly across the card's width, the outer ones flush with its edges.
  const btn = Math.round(BUTTON * scale);
  const rowY = Math.round(gy + (CARD_H + GAP) * scale);
  const widths = BUTTONS.map((b) => Math.round(b.w * scale));
  const used = widths.reduce((a, b) => a + b, 0);
  const gap = BUTTONS.length > 1 ? (w - used) / (BUTTONS.length - 1) : 0;
  let left = gx;
  BUTTONS.forEach((b, i) => {
    const last = i === BUTTONS.length - 1;
    // The last one ends exactly at the card's edge, whatever the rounding.
    const x = last ? gx + w - widths[i] : Math.round(left);
    rects[`btn-${b.id}`] = { x, y: rowY, w: widths[i], h: btn };
    left += widths[i] + gap;
  });
  if (options.panel) {
    const pw = Math.round(PANEL_W * scale);
    const ph = Math.round(PANEL_H * scale);
    const py = bottom ? gy - Math.round(GAP * scale) - ph : gy + h + Math.round(GAP * scale);
    rects.panel = { x: gx, y: Math.max(0, py), w: pw, h: ph };
  }
  return rects;
}
