/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — where the user put the card
 *
 * By default the card sits in a corner of the focused pane and moves with
 * it. Once the user drags it by its grip, it stays where they dropped it,
 * whichever pane is focused, until they put it back with the "Put the
 * card back in the pane" command or by choosing a corner.
 *
 * The spot is kept as two fractions of the room the window leaves for the
 * card (`fx` 0 = left edge, 1 = right edge; `fy` 0 = top, 1 = bottom), not
 * as pixels, so a card dropped against an edge stays against it when the
 * window is resized and can never end up outside a smaller window.
 * Pure: no Tilefold calls.
 */

/** The window's content size when Tilefold hasn't reported one yet. */
const FALLBACK_CONTENT = { w: 800, h: 600 };

/** The window's content size from a Tilefold layout. */
export function contentOf(layout) {
  const c = layout && layout.content;
  if (c && Number.isFinite(c.w) && Number.isFinite(c.h) && c.w > 0 && c.h > 0) {
    return { w: c.w, h: c.h };
  }
  return FALLBACK_CONTENT;
}

/** Keeps a number between 0 and 1. */
const unit = (n) => Math.min(1, Math.max(0, n));

/**
 * A saved position checked: `{ fx, fy }` in [0, 1], or null for anything
 * else (nothing saved, a damaged value), meaning "follow the pane".
 *
 * @param {unknown} value
 * @returns {{ fx: number, fy: number } | null}
 */
export function readPosition(value) {
  if (!value || typeof value !== "object") return null;
  const { fx, fy } = /** @type {any} */ (value);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  return { fx: unit(fx), fy: unit(fy) };
}

/** The top-left of a `w`×`h` card at a saved position, inside the window. */
export function placeAt(content, w, h, pos) {
  const roomX = Math.max(0, content.w - w);
  const roomY = Math.max(0, content.h - h);
  return { x: Math.round(roomX * unit(pos.fx)), y: Math.round(roomY * unit(pos.fy)) };
}

/** The position a card dragged to top-left `x`,`y` is kept as. */
export function positionFor(content, w, h, x, y) {
  const roomX = Math.max(0, content.w - w);
  const roomY = Math.max(0, content.h - h);
  return { fx: roomX > 0 ? unit(x / roomX) : 0, fy: roomY > 0 ? unit(y / roomY) : 0 };
}

/**
 * Follows one drag of the card: `start` takes the pointer and the card's
 * top-left when the drag began; `move` and `end` take the pointer now and
 * return the position the card is at (null when no drag is under way);
 * `end` also forgets the drag.
 */
export function createDrag() {
  /** @type {{ px: number, py: number, x: number, y: number } | null} */
  let from = null;

  const move = (px, py, content, w, h) => {
    if (!from || !Number.isFinite(px) || !Number.isFinite(py)) return null;
    // The card moves by as much as the pointer did since the drag began.
    return positionFor(content, w, h, from.x + (px - from.px), from.y + (py - from.py));
  };

  return {
    start(px, py, origin) {
      from =
        Number.isFinite(px) && Number.isFinite(py) ? { px, py, x: origin.x, y: origin.y } : null;
    },
    move,
    end(px, py, content, w, h) {
      const pos = move(px, py, content, w, h);
      from = null;
      return pos;
    },
    active: () => from !== null,
    cancel() {
      from = null;
    },
  };
}
