/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — light or dark
 *
 * Whether the card is drawn light or dark. The Appearance setting is
 * `auto` (follow the system, which is what the card's page sees: a tile
 * can't see Tilefold's own theme), `light` or `dark`. The "Switch light or
 * dark" command and the card's button flip what the user sees now and
 * remember it; choosing an appearance in Settings afterwards wins again.
 * Pure: no Tilefold calls.
 */

/** The Appearance setting's choices. */
export const APPEARANCES = ["auto", "light", "dark"];

/** The setting's value, `auto` for anything unknown. */
export const appearanceOf = (value) => (APPEARANCES.includes(value) ? value : "auto");

/**
 * What the card is drawn in: the switched choice if there is one, else
 * the setting, with `auto` resolved to what the page reported for the
 * system (`light` until it has).
 *
 * @param {string} setting
 * @param {"light" | "dark" | null} switched
 * @param {"light" | "dark" | null} system
 * @returns {"light" | "dark"}
 */
export function effectiveTheme(setting, switched, system) {
  if (switched) return switched;
  const s = appearanceOf(setting);
  if (s !== "auto") return s;
  return system === "dark" ? "dark" : "light";
}

/** The other of light and dark. */
export const flipped = (theme) => (theme === "dark" ? "light" : "dark");

/** The system's scheme as the page reported it, or null for anything else. */
export const schemeOf = (value) => (value === "dark" || value === "light" ? value : null);
