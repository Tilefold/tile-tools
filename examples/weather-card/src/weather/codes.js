/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — weather codes
 *
 * Open-Meteo reports the sky as a WMO weather code. The card needs far
 * fewer kinds than the code table has, so each code maps to one of eight
 * kinds, and each kind to the message that names it. Pure.
 */

/** The kinds the card draws and names. */
export const KINDS = Object.freeze([
  "clear",
  "partly",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "storm",
]);

/** The message naming each kind, spelled out so the keys can be found. */
export const KIND_TEXT = Object.freeze({
  clear: "cond-clear",
  partly: "cond-partly",
  cloudy: "cond-cloudy",
  fog: "cond-fog",
  drizzle: "cond-drizzle",
  rain: "cond-rain",
  snow: "cond-snow",
  storm: "cond-storm",
  unknown: "cond-unknown",
});

/**
 * The kind of a WMO weather code, or "unknown".
 *
 * @param {unknown} code
 * @returns {string}
 */
export function kindOf(code) {
  // Number(null) and Number("") are 0, "clear sky": a missing code must not look like sunshine.
  if (code === null || code === undefined || code === "") return "unknown";
  const n = Number(code);
  if (!Number.isInteger(n) || n < 0) return "unknown";
  if (n === 0) return "clear";
  if (n === 1 || n === 2) return "partly";
  if (n === 3) return "cloudy";
  if (n === 45 || n === 48) return "fog";
  if (n >= 51 && n <= 57) return "drizzle";
  if ((n >= 61 && n <= 67) || (n >= 80 && n <= 82)) return "rain";
  if ((n >= 71 && n <= 77) || n === 85 || n === 86) return "snow";
  if (n >= 95 && n <= 99) return "storm";
  return "unknown";
}
