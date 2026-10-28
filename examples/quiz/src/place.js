/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — where the quiz shows
 *
 * The "Show the quiz" setting picks the way: on a card floating over the
 * panes, docked beside the panes (Tilefold 0.1.20, where the panes make
 * room for it), or as rows in a panel. Between the card and the dock the
 * user also moves it themselves, with the card's dock button, the docked
 * page's float button or Tilefold's Undock: that choice is remembered
 * (`chosen`) until the setting changes. A Tilefold that can't dock pages
 * beside the panes gets the card instead. Pure: no Tilefold calls.
 */

/** The places the quiz can show. */
export const PLACES = ["card", "side", "panel"];

/** Whether a place is the card or the dock (the user moves between them). */
export const isMovable = (place) => place === "card" || place === "side";

/**
 * Where the quiz goes: the panel when the setting says so; otherwise the
 * user's last move, or the setting; the card where docking is missing.
 *
 * @param {string} setting "card", "side" or "panel"
 * @param {"card" | "side" | null} chosen
 * @param {boolean} canSide
 * @returns {"card" | "side" | "panel"}
 */
export function placeOf(setting, chosen, canSide) {
  if (setting === "panel") return "panel";
  const place = chosen ?? (setting === "side" ? "side" : "card");
  return place === "side" && !canSide ? "card" : place;
}

/** A remembered move checked: "card", "side", or null. */
export const readChosen = (value) => (value === "card" || value === "side" ? value : null);

/** Whether the quiz showing at `where` is already at `place` (a window counts as the card). */
export const showsAt = (where, place) => (where === "window" ? "card" : where) === place;
