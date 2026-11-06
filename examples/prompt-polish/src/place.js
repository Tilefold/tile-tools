/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — where the page shows
 *
 * Three views, chosen in Settings or from the page's header:
 *
 *   corner  a small "Polish" pill at the right end of the pane's bottom
 *           row, by where the user types, drawn as an overlay item; the
 *           card opens above it when clicked (the default)
 *   bottom  the page on a card across the focused pane, right above its
 *           input row, open until closed
 *   side    the page in the dock beside the panes (Tilefold 0.1.20)
 *
 * The card follows the focused pane (`overlay.layout` gives the panes'
 * rectangles and where each one's input row is, never what is in them).
 * Tilefold docks a page only at 120 to 2,000 pixels a side, so a pane too
 * small for the card sends it to the side dock instead.
 *
 * Pure: no Tilefold calls.
 */

/** The views, in the order the setting lists them. */
export const VIEWS = ["corner", "bottom", "side"];

/** Tilefold's limits for a page docked at a spot. */
export const SPOT_MIN = 120;
export const SPOT_MAX = 2000;

/** The gap between the card and the pane's edges. */
export const GAP = 12;

/** The pill's default size (an overlay item may be smaller than a page). */
export const BUTTON = 36;
export const BUTTON_H = 26;

/** The corner card's width, and the tallest card. */
export const CORNER_W = 420;
export const MAX_H = 440;

/** A view checked: one of VIEWS, or the default. */
export const viewOf = (value) => (VIEWS.includes(value) ? value : "corner");

/**
 * The pane with id `paneId` in a layout, or without an id the focused pane
 * (or the first); null when it isn't there (another tab) or has no size.
 */
export function focusedPane(layout, paneId) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const ok = panes.filter((p) => [p.x, p.y, p.w, p.h].every(Number.isFinite));
  if (paneId !== undefined && paneId !== null) return ok.find((p) => p.id === paneId) ?? null;
  return ok.find((p) => p.focused) ?? ok[0] ?? null;
}

/**
 * Where the card (and the corner button) go over the focused pane:
 * `{ card, button }` rectangles in the window's content (`card` null while
 * the corner card is closed, `button` null in the bottom view), or null
 * when the pane can't hold them, meaning "use the side dock".
 *
 * @param {object} layout from `tf.overlay.layout()` or `overlay.layout`
 * @param {"bottom" | "corner"} view
 * @param {{ h?: number, open?: boolean, rtl?: boolean, pane?: string | null }} [opts]
 *   h: the card's wanted height (it shrinks to fit, never under SPOT_MIN);
 *   open: whether the corner card is open; rtl: the corner is on the left;
 *   pane: the pane to place over (by id), else the focused one;
 *   bw: the pill's width (its height is BUTTON_H)
 */
export function placeFor(layout, view, opts = {}) {
  const h = Math.min(MAX_H, Math.max(SPOT_MIN, Number.isFinite(opts.h) ? opts.h : 260));
  const pane = focusedPane(layout, opts.pane);
  if (!pane || (view !== "bottom" && view !== "corner")) return null;
  const top = pane.y + GAP;
  const composer = pane.composer && Number.isFinite(pane.composer.y) ? pane.composer : null;
  const floor = (composer ? composer.y : pane.y + pane.h) - GAP;
  const round = (r) => ({
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.w),
    h: Math.round(r.h),
  });
  if (view === "bottom") {
    const w = Math.min(SPOT_MAX, pane.w - 2 * GAP);
    const ch = Math.min(h, floor - top);
    if (w < SPOT_MIN || ch < SPOT_MIN) return null;
    return { card: round({ x: pane.x + GAP, y: floor - ch, w, h: ch }), button: null };
  }
  const bw = Number.isFinite(opts.bw) ? opts.bw : BUTTON;
  const bx = opts.rtl ? pane.x + GAP : pane.x + pane.w - GAP - bw;
  const button = round({ x: bx, y: floor - BUTTON_H, w: bw, h: BUTTON_H });
  if (button.y < top || pane.w < bw + 2 * GAP) return null;
  if (!opts.open) return { card: null, button };
  const w = Math.min(CORNER_W, pane.w - 2 * GAP);
  const ch = Math.min(h, button.y - GAP - top);
  if (w < SPOT_MIN || ch < SPOT_MIN) return null;
  const x = opts.rtl ? pane.x + GAP : pane.x + pane.w - GAP - w;
  return { card: round({ x, y: button.y - GAP - ch, w, h: ch }), button };
}

/** Whether two rectangles (or nulls) are the same. */
export const sameSpot = (a, b) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
