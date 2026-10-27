/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz page — double-clicks on the top bar
 *
 * A double-click on the floating card's top bar docks the quiz beside the
 * panes. The bar also drags the card, and its drag takes the pointer, so
 * the page tells a double-click apart itself rather than waiting for the
 * browser's `dblclick`: two presses let go within DOUBLE_MS of each other,
 * neither moving more than DOUBLE_PX between press and release, the second
 * near the first. A drag in between starts over. Pure: no page calls.
 */

/** Longest time between the two releases, in milliseconds. */
export const DOUBLE_MS = 400;
/** Farthest a press may move, or the second land from the first, in pixels. */
export const DOUBLE_PX = 4;

/**
 * A counter of presses on the bar. `down` takes where a press began;
 * `up` takes where and when it was let go, and says whether it finished
 * a double-click.
 *
 * @returns {{
 *   down: (at: { x: number, y: number }) => void,
 *   up: (at: { x: number, y: number, time: number }) => boolean,
 * }}
 */
export function createDoubleTaps() {
  /** Where the current press began, or null. */
  let pressed = null;
  /** The last plain click (no drag), or null. */
  let last = null;
  const near = (a, b) => Math.abs(a.x - b.x) <= DOUBLE_PX && Math.abs(a.y - b.y) <= DOUBLE_PX;

  return {
    down(at) {
      pressed = { x: at.x, y: at.y };
    },
    up(at) {
      const from = pressed;
      pressed = null;
      // A drag, or a release with no press seen: not a click at all.
      if (!from || !near(from, at)) {
        last = null;
        return false;
      }
      const double = !!last && at.time - last.time <= DOUBLE_MS && near(last, at);
      // A double-click is used up; a third click starts a new pair.
      last = double ? null : { x: at.x, y: at.y, time: at.time };
      return double;
    },
  };
}
