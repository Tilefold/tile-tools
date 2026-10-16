/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — where the user put the player
 *
 * By default the card (or, while a video plays docked, the video with its
 * control dock) sits in a corner of the focused pane and moves with it.
 * Once the user drags it, it stays where they dropped it in the window
 * instead, whichever pane is focused, until they put it back with the "Put
 * the player back in the pane" command or by choosing a corner.
 *
 * The spot is kept as two fractions of the room the window leaves for the
 * group (`fx` 0 = left edge, 1 = right edge; `fy` 0 = top, 1 = bottom),
 * not as pixels. So a player dropped against the right edge stays against
 * it when the window grows or shrinks, can never end up outside a smaller
 * window, and the small card and the larger video-with-dock land on the
 * same spot when one replaces the other. Pure: no Tilefold calls.
 */

/** The window's content size when Tilefold hasn't reported one yet. */
const FALLBACK_CONTENT = { w: 800, h: 600 };

/**
 * The window's content size from a Tilefold layout.
 *
 * @param {any} layout
 * @returns {{ w: number, h: number }}
 */
export function contentOf(layout) {
  const c = layout && layout.content;
  // A missing or damaged size falls back rather than placing at NaN.
  if (c && Number.isFinite(c.w) && Number.isFinite(c.h) && c.w > 0 && c.h > 0)
    return { w: c.w, h: c.h };
  return FALLBACK_CONTENT;
}

/** Keeps a number between 0 and 1. */
const unit = (n) => Math.min(1, Math.max(0, n));

/**
 * A saved position checked: `{ fx, fy }` with both in [0, 1], or null for
 * anything else (nothing saved, or a damaged value), meaning "follow the pane".
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

/**
 * Where a group of size `w`×`h` goes for a saved position: its top-left
 * corner, in whole pixels, always inside the window. A group bigger than
 * the window is pinned to its top-left.
 *
 * @param {{ w: number, h: number }} content
 * @param {number} w
 * @param {number} h
 * @param {{ fx: number, fy: number }} pos
 * @returns {{ x: number, y: number }}
 */
export function placeAt(content, w, h, pos) {
  const roomX = Math.max(0, content.w - w);
  const roomY = Math.max(0, content.h - h);
  return { x: Math.round(roomX * unit(pos.fx)), y: Math.round(roomY * unit(pos.fy)) };
}

/**
 * The position a group dragged to `x`,`y` (its new top-left, possibly off
 * screen) is kept as. Off-screen spots are pulled back to the edge; with no
 * room to move along an axis, that fraction is 0.
 *
 * @param {{ w: number, h: number }} content
 * @param {number} w
 * @param {number} h
 * @param {number} x
 * @param {number} y
 * @returns {{ fx: number, fy: number }}
 */
export function positionFor(content, w, h, x, y) {
  const roomX = Math.max(0, content.w - w);
  const roomY = Math.max(0, content.h - h);
  return { fx: roomX > 0 ? unit(x / roomX) : 0, fy: roomY > 0 ? unit(y / roomY) : 0 };
}

/**
 * Follows one drag of the card. `start` takes the pointer where the drag
 * began and the group's top-left at that moment; `move` takes the pointer
 * now and returns the position the group is at, or null when no drag is
 * under way (a drag that began elsewhere, or after `end`). `end` returns
 * the final position (null if there was no drag) and forgets the drag.
 *
 * @returns {{
 *   start: (px: number, py: number, origin: { x: number, y: number }) => void,
 *   move: (px: number, py: number, content: { w: number, h: number }, w: number, h: number) => ({ fx: number, fy: number } | null),
 *   end: (px: number, py: number, content: { w: number, h: number }, w: number, h: number) => ({ fx: number, fy: number } | null),
 *   active: () => boolean,
 *   cancel: () => void,
 * }}
 */
export function createDrag() {
  /** @type {{ px: number, py: number, x: number, y: number } | null} */
  let from = null;

  const move = (px, py, content, w, h) => {
    if (!from || !Number.isFinite(px) || !Number.isFinite(py)) return null;
    // The group moves by as much as the pointer did since the drag began.
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
