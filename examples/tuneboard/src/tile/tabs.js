/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — one tab or every tab
 *
 * With the "Show on" setting at "the tab where it was opened", the card is
 * shown with `perTab` (Tilefold 0.1.27): it stays on the tab in front when
 * it was opened, and Tilefold says when the user leaves or comes back to
 * that tab (`overlay.tab`) and when the tab closes (`overlay.hidden` with
 * `by: "tab"`). This keeps whether the card is away on another tab, so
 * Show brings it to the tab in front instead of hiding it. Older Tilefolds
 * ignore `perTab` and show it on every tab.
 */

/** The "Show on" choices: every tab, or the tab where it was opened. */
export const SHOW_ON = ["tab", "all"];

/**
 * Watches the card's tab. `lost(by)` runs when Tilefold took the scene
 * away (`by`: "user" or "tab"); `away()` says whether the card is on
 * another tab now.
 *
 * @param {any} tf The tile API.
 * @param {(fn: (e: any) => Promise<void>) => (e: any) => void} background
 * @param {(by: string) => Promise<void>} lost
 */
export function watchTab(tf, background, lost) {
  let away = false;
  tf.on(
    "overlay.tab",
    background(async (e) => {
      away = !(e && e.shown === true);
    }),
  );
  tf.on(
    "overlay.hidden",
    background(async (e) => {
      away = false;
      await lost(e && e.by === "tab" ? "tab" : "user");
    }),
  );
  return {
    away: () => away,
    /** The card was shown again (on the tab in front). */
    here: () => {
      away = false;
    },
  };
}
