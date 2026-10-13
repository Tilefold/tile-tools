/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — settings
 *
 * Every setting the tile registers, and a reader that turns whatever is
 * stored into values the tile can trust. Registered at the top of the
 * tile's function, before any `await`, as Tilefold requires.
 */
import { cleanQuery } from "../weather/openMeteo.js";

/** The corners the card can sit in. */
export const CORNERS = ["top-right", "top-left", "bottom-right", "bottom-left"];

/** How often to check, in minutes. */
export const EVERY = ["15", "30", "60"];

/**
 * Every setting. `choices` lists values with the message key of their label,
 * spelled out so the keys can be found.
 *
 * @type {{ key: string, default: unknown, label: string,
 *          choices?: { value: string, label: string }[] }[]}
 */
export const SETTINGS = [
  { key: "place", default: "", label: "setting-place" },
  {
    key: "units",
    default: "metric",
    label: "setting-units",
    choices: [
      { value: "metric", label: "setting-units-metric" },
      { value: "imperial", label: "setting-units-imperial" },
    ],
  },
  {
    key: "corner",
    default: "top-right",
    label: "setting-corner",
    choices: [
      { value: "top-right", label: "setting-corner-top-right" },
      { value: "top-left", label: "setting-corner-top-left" },
      { value: "bottom-right", label: "setting-corner-bottom-right" },
      { value: "bottom-left", label: "setting-corner-bottom-left" },
    ],
  },
  {
    key: "every",
    default: "30",
    label: "setting-every",
    choices: [
      { value: "15", label: "setting-every-quarter" },
      { value: "30", label: "setting-every-half" },
      { value: "60", label: "setting-every-hour" },
    ],
  },
  { key: "summary", default: false, label: "setting-summary" },
];

/** Settings whose change needs new weather, not just a redraw. */
export const FETCH_KEYS = ["place", "units"];

/**
 * Registers every setting with Tilefold, with translated descriptions.
 *
 * @param {any} tf
 */
export function registerSettings(tf) {
  for (const s of SETTINGS) {
    if (s.choices) {
      const choices = s.choices.map((c) => ({ value: c.value, label: tf.t(c.label) }));
      tf.setting(s.key, s.default, tf.t(s.label), { choices });
    } else {
      tf.setting(s.key, s.default, tf.t(s.label));
    }
  }
}

/**
 * The current settings, cleaned up.
 *
 * @param {{ get: (key: string) => unknown }} settings `tf.settings`.
 * @returns {{ place: string, units: string, corner: string, everyMs: number, summary: boolean }}
 */
export function readSettings(settings) {
  const get = (key) => {
    try {
      return settings.get(key);
    } catch {
      return undefined;
    }
  };
  const units = get("units") === "imperial" ? "imperial" : "metric";
  const corner = CORNERS.includes(String(get("corner"))) ? String(get("corner")) : "top-right";
  const every = EVERY.includes(String(get("every"))) ? Number(get("every")) : 30;
  return {
    place: cleanQuery(get("place")),
    units,
    corner,
    everyMs: every * 60_000,
    summary: get("summary") === true,
  };
}
