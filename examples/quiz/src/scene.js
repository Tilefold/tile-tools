/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — where the floating card goes
 *
 * The card is the quiz page, docked in Tilefold's window with no frame,
 * and right above it a grip, drawn as overlay items, to drag it by (a
 * docked page keeps the pointer, so the page itself can't be dragged).
 * An overlay item is at most 256 pixels wide, so the grip is two halves:
 *
 *     ┌────── grip-l ──────┬────── grip-r ──────┐
 *     └────────────────────┴────────────────────┘
 *     ┌─────────────────────────────────────────┐
 *     │                 the page                │
 *     │   question, choices, why, next step     │
 *     └─────────────────────────────────────────┘
 *
 * Pure geometry: the window layout Tilefold reports, the corner setting
 * and the saved position in; the grip halves, the page's spot and the
 * whole card (`card`, which a drag moves) out.
 */
import { contentOf, placeAt } from "./position.js";

/** The corners the card can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
/** How far the card keeps from the pane's edges. */
export const MARGIN = 12;
/** The page's size (a docked page is 120 to 2,000 pixels a side). */
export const PAGE_W = 360;
export const PAGE_H = 340;
/** The grip's height, and the space between it and the page. */
export const GRIP_H = 22;
export const GRIP_GAP = 2;
/** Each half of the grip (an overlay item is at most 256 pixels wide). */
export const GRIP_HALF = PAGE_W / 2;
/** The whole card: the grip and the page under it. */
export const CARD = { w: PAGE_W, h: GRIP_H + GRIP_GAP + PAGE_H };

/** The corner for a setting value (bottom-right for anything unknown). */
export const cornerOf = (corner) => (CORNERS.includes(corner) ? corner : "bottom-right");

/** A rectangle with a usable size, or null. */
const rectOrNull = (r) =>
  r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0 ? r : null;

/** Whether two rectangles overlap. */
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The area the card may use: the focused pane down to its Composer, or the window. */
export function areaOf(layout) {
  const panes = (Array.isArray(layout?.panes) ? layout.panes : []).filter(rectOrNull);
  const pane = panes.find((p) => p.focused) ?? panes[0];
  if (pane) {
    const bottom = rectOrNull(pane.composer) ? pane.composer.y : pane.y + pane.h;
    return { x: pane.x, y: pane.y, w: pane.w, h: Math.max(0, bottom - pane.y) };
  }
  const content = contentOf(layout);
  return { x: 0, y: 0, w: content.w, h: content.h };
}

/**
 * Where Tilefold never lets an overlay item take a click: the bars above
 * the panes (`top`, the band above the highest pane) and every pane's
 * Composer row (`zones`). A grip touching one can't be dragged.
 */
export function keepOut(layout) {
  const panes = (Array.isArray(layout?.panes) ? layout.panes : []).filter(rectOrNull);
  const top = panes.length ? Math.max(0, Math.min(...panes.map((p) => p.y))) : 0;
  const zones = panes.map((p) => rectOrNull(p.composer)).filter(Boolean);
  return { top, zones };
}

/**
 * Moves a card at top-left `o` clear of where its grip couldn't be
 * dragged: never above the panes' top; off a Composer row it covers, to
 * just above it or, without room there, just below. A window too small
 * keeps it inside the window.
 */
export function settle(layout, o) {
  const content = contentOf(layout);
  const { top, zones } = keepOut(layout);
  const maxY = Math.max(top, content.h - CARD.h);
  let y = Math.min(maxY, Math.max(top, o.y));
  // Each pass clears one row; a card can't cover more rows than there are.
  for (let pass = 0; pass <= zones.length; pass++) {
    const hit = zones.find((z) => overlaps({ x: o.x, y, w: CARD.w, h: CARD.h }, z));
    if (!hit) break;
    const above = hit.y - MARGIN - CARD.h;
    y = above >= top ? above : Math.min(maxY, hit.y + hit.h + MARGIN);
  }
  const x = Math.min(Math.max(0, content.w - CARD.w), Math.max(0, o.x));
  return { x: Math.round(x), y: Math.round(y) };
}

/** The card's top-left in a corner of the area. */
function cornerOrigin(area, corner) {
  const left = corner.endsWith("left");
  const topCorner = corner.startsWith("top");
  return {
    x: left ? area.x + MARGIN : area.x + area.w - MARGIN - CARD.w,
    y: topCorner ? area.y + MARGIN : area.y + area.h - MARGIN - CARD.h,
  };
}

/**
 * Where everything goes: at the saved position in the window, or in the
 * focused pane's corner; either way clear of where the grip couldn't be
 * dragged.
 *
 * @param {any} layout
 * @param {string} corner
 * @param {{ fx: number, fy: number } | null} position
 */
export function cardSpots(layout, corner, position) {
  const at = position
    ? placeAt(contentOf(layout), CARD.w, CARD.h, position)
    : cornerOrigin(areaOf(layout), cornerOf(corner));
  const o = settle(layout, at);
  return {
    card: { x: o.x, y: o.y, w: CARD.w, h: CARD.h },
    gripL: { x: o.x, y: o.y, w: GRIP_HALF, h: GRIP_H },
    gripR: { x: o.x + GRIP_HALF, y: o.y, w: GRIP_HALF, h: GRIP_H },
    page: { x: o.x, y: o.y + GRIP_H + GRIP_GAP, w: PAGE_W, h: PAGE_H },
  };
}
