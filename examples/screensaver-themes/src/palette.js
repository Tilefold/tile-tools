/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Screensaver Themes — colors and speeds
 *
 * The choices behind the tile's two settings: the color the themes draw
 * in (a fixed green, amber or blue, or the accent color of the user's
 * Tilefold theme) and how fast they move.
 */

/** Colors to pick from; `theme` takes the user's Tilefold accent color. */
export const COLORS = {
  green: "#39ff6a",
  amber: "#ffb000",
  blue: "#4fc3ff",
  theme: null,
};

/** How fast the themes move, as a factor of the normal speed. */
export const SPEEDS = { slow: 0.6, normal: 1, fast: 1.6 };

/**
 * The CSS color for a `color` setting value, given the frame's colors.
 *
 * @param {unknown} choice The setting's value.
 * @param {{ accent?: string }} colors The user's Tilefold colors.
 * @returns {string}
 */
export function colorFor(choice, colors) {
  if (choice === "theme") return colors.accent || COLORS.green;
  return Object.hasOwn(COLORS, choice) && COLORS[choice] ? COLORS[choice] : COLORS.green;
}

/**
 * The speed factor for a `speed` setting value (normal for anything unknown).
 *
 * @param {unknown} choice The setting's value.
 * @returns {number}
 */
export function speedFor(choice) {
  return Object.hasOwn(SPEEDS, choice) ? SPEEDS[choice] : SPEEDS.normal;
}
