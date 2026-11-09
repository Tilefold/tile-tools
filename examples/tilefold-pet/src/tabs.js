/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — one tab or every tab
 *
 * With "Show on" at "the tab where it was opened", the pet is shown with
 * `perTab` (Tilefold 0.1.27) and keeps to the tab in front when it
 * appeared. Tilefold says when the user leaves or comes back to that tab
 * (`overlay.tab`); this keeps whether the pet is away on another tab, so
 * Show brings it to the tab in front instead of sending it away.
 */

/**
 * Watches the pet's tab: `away()` says whether it is on another tab now,
 * `here()` that it was just shown on the tab in front.
 *
 * @param {any} tf The tile API.
 * @param {(fn: (e: any) => Promise<void> | void) => (e: any) => void} background
 */
export function watchTab(tf, background) {
  let away = false;
  tf.on(
    "overlay.tab",
    background(async (e) => {
      away = !(e && e.shown === true);
    }),
  );
  return {
    away: () => away,
    here: () => {
      away = false;
    },
  };
}
