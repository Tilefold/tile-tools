/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — where the floating card goes, and how big it is
 *
 * The card is the quiz page, docked in Tilefold's window with no frame,
 * and right above it a thin grip drawn as overlay items. The user moves the
 * card by its own top bar or by the grip, and resizes it by its corner
 * (the page reports those drags; see card.js). An overlay item is at most
 * 256 pixels wide, so the grip is as many pieces as the card's width needs:
 *
 *     ┌──── grip-0 ────┬──── grip-1 ────┐
 *     └────────────────┴────────────────┘
 *     ┌──────────────────────────────────┐
 *     │ ☰  Quizzes             ☾  ×      │ ← drag here too
 *     │   question, choices, why, next   │
 *     │                                ◢ │ ← resize
 *     └──────────────────────────────────┘
 *
 * Pure geometry: the window layout Tilefold reports, the corner setting,
 * the saved position and the page's size in; the grip's pieces, the page's
 * spot and the whole card (`card`) out.
 */
import { contentOf, placeAt } from "./position.js";

/** The corners the card can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
/** How far the card keeps from the pane's edges. */
export const MARGIN = 12;
/** The page's size to start with, and the smallest and largest it may be. */
export const PAGE = Object.freeze({ w: 360, h: 340 });
export const MIN_PAGE = Object.freeze({ w: 280, h: 240 });
export const MAX_PAGE = Object.freeze({ w: 900, h: 1000 });
/** The grip's height, and the space between it and the page. */
export const GRIP_H = 14;
export const GRIP_GAP = 2;
/** The widest piece of the grip (an overlay item is at most 256 pixels wide). */
export const GRIP_PIECE = 256;

/** The whole card for a page size: the grip and the page under it. */
export const cardOf = (page) => ({ w: page.w, h: GRIP_H + GRIP_GAP + page.h });

/** The corner for a setting value (bottom-right for anything unknown). */
export const cornerOf = (corner) => (CORNERS.includes(corner) ? corner : "bottom-right");

/** Keeps a number between `lo` and `hi`, rounded. */
const clamp = (n, lo, hi) => Math.round(Math.min(hi, Math.max(lo, n)));

/**
 * A page size checked: within the smallest and largest, and never larger
 * than the window leaves room for. Anything unusable is the starting size.
 *
 * @param {unknown} value
 * @param {any} [layout]
 * @returns {{ w: number, h: number }}
 */
export function readSize(value, layout) {
  const v = /** @type {any} */ (value);
  const ok = v && Number.isFinite(v.w) && Number.isFinite(v.h);
  const content = contentOf(layout);
  const maxW = Math.max(MIN_PAGE.w, Math.min(MAX_PAGE.w, content.w - 2 * MARGIN));
  const maxH = Math.max(
    MIN_PAGE.h,
    Math.min(MAX_PAGE.h, content.h - GRIP_H - GRIP_GAP - 2 * MARGIN),
  );
  const w = ok ? v.w : PAGE.w;
  const h = ok ? v.h : PAGE.h;
  return { w: clamp(w, MIN_PAGE.w, maxW), h: clamp(h, MIN_PAGE.h, maxH) };
}

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
 * Composer row (`zones`). A grip touching one can't be dragged, and a card
 * over a Composer would hide what the user types.
 */
export function keepOut(layout) {
  const panes = (Array.isArray(layout?.panes) ? layout.panes : []).filter(rectOrNull);
  const top = panes.length ? Math.max(0, Math.min(...panes.map((p) => p.y))) : 0;
  const zones = panes.map((p) => rectOrNull(p.composer)).filter(Boolean);
  return { top, zones };
}

/**
 * Moves a card (`size`) at top-left `o` clear of where it shouldn't be:
 * never above the panes' top; off a Composer row it covers, to just above
 * it or, without room there, just below. A window too small keeps it
 * inside the window.
 */
export function settle(layout, o, size) {
  const content = contentOf(layout);
  const { top, zones } = keepOut(layout);
  const maxY = Math.max(top, content.h - size.h);
  let y = Math.min(maxY, Math.max(top, o.y));
  // Each pass clears one row; a card can't cover more rows than there are.
  for (let pass = 0; pass <= zones.length; pass++) {
    const hit = zones.find((z) => overlaps({ x: o.x, y, w: size.w, h: size.h }, z));
    if (!hit) break;
    const above = hit.y - MARGIN - size.h;
    y = above >= top ? above : Math.min(maxY, hit.y + hit.h + MARGIN);
  }
  const x = Math.min(Math.max(0, content.w - size.w), Math.max(0, o.x));
  return { x: Math.round(x), y: Math.round(y) };
}

/** The card's top-left in a corner of the area. */
function cornerOrigin(area, corner, size) {
  const left = corner.endsWith("left");
  const topCorner = corner.startsWith("top");
  return {
    x: left ? area.x + MARGIN : area.x + area.w - MARGIN - size.w,
    y: topCorner ? area.y + MARGIN : area.y + area.h - MARGIN - size.h,
  };
}

/** The grip's pieces across a card at `o`, each at most GRIP_PIECE wide. */
export function gripPieces(o, width) {
  const count = Math.max(1, Math.ceil(width / GRIP_PIECE));
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round((width * i) / count);
    const next = Math.round((width * (i + 1)) / count);
    pieces.push({ x: o.x + x, y: o.y, w: next - x, h: GRIP_H, from: x });
  }
  return pieces;
}

/**
 * Where everything goes: at the saved position in the window, or in the
 * focused pane's corner; either way clear of where it shouldn't be.
 *
 * @param {any} layout
 * @param {string} corner
 * @param {{ fx: number, fy: number } | null} position
 * @param {{ w: number, h: number }} [page] the page's size
 */
export function cardSpots(layout, corner, position, page = PAGE) {
  const size = cardOf(page);
  const at = position
    ? placeAt(contentOf(layout), size.w, size.h, position)
    : cornerOrigin(areaOf(layout), cornerOf(corner), size);
  const o = settle(layout, at, size);
  return {
    card: { x: o.x, y: o.y, w: size.w, h: size.h },
    grip: gripPieces(o, size.w),
    page: { x: o.x, y: o.y + GRIP_H + GRIP_GAP, w: page.w, h: page.h },
  };
}
