/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — settings
 *
 * The tile's settings, in one table: key, default, the message key of its
 * description and, for drop-downs, its choices. `registerSettings` hands
 * them to Tilefold (it must run at the top of the tile, before any await);
 * `readSettings` reads them back as clean values, so the rest of the tile
 * never has to guard against a hand-edited or out-of-range setting.
 */
import { CORNERS } from "./scene.js";

/** Lowest and highest level a game may start at. */
export const MIN_START_LEVEL = 1;
export const MAX_START_LEVEL = 15;

/** Message for each corner choice, spelled out so the keys can be found. */
const CORNER_LABELS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left",
};

/**
 * Every setting. `choices` lists values with the message key of their label.
 *
 * @type {{ key: string, default: unknown, label: string,
 *          choices?: { value: string, label: string }[] }[]}
 */
export const SETTINGS = [
  { key: "startLevel", default: 1, label: "setting-start-level" },
  { key: "ghost", default: true, label: "setting-ghost" },
  { key: "sounds", default: true, label: "setting-sounds" },
  {
    key: "size",
    default: "medium",
    label: "setting-size",
    choices: [
      { value: "medium", label: "setting-size-medium" },
      { value: "small", label: "setting-size-small" },
    ],
  },
  {
    key: "corner",
    default: "bottom-right",
    label: "setting-corner",
    choices: CORNERS.map((c) => ({ value: c, label: CORNER_LABELS[c] })),
  },
  { key: "pauseOnBlur", default: true, label: "setting-pause-on-blur" },
];

/** The keys whose change means the scene must be laid out again. */
export const LAYOUT_KEYS = ["size", "corner"];

/**
 * Registers every setting with Tilefold, with translated descriptions.
 *
 * @param {any} tf The tile API.
 */
export function registerSettings(tf) {
  for (const s of SETTINGS) {
    const options = s.choices
      ? { choices: s.choices.map((c) => ({ value: c.value, label: tf.t(c.label) })) }
      : undefined;
    if (options) tf.setting(s.key, s.default, tf.t(s.label), options);
    else tf.setting(s.key, s.default, tf.t(s.label));
  }
}

/**
 * A whole number within [min, max], or `fallback` when it is not a number.
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * The current settings, cleaned up.
 *
 * @param {{ get: (key: string) => unknown }} settings `tf.settings`.
 * @returns {{ startLevel: number, ghost: boolean, sounds: boolean,
 *             size: string, corner: string, pauseOnBlur: boolean }}
 */
export function readSettings(settings) {
  const get = (key) => {
    try {
      return settings.get(key);
    } catch {
      return undefined;
    }
  };
  const size = get("size");
  const corner = get("corner");
  return {
    startLevel: clampInt(get("startLevel"), MIN_START_LEVEL, MAX_START_LEVEL, 1),
    ghost: get("ghost") !== false,
    sounds: get("sounds") !== false,
    size: size === "small" ? "small" : "medium",
    corner: CORNERS.includes(/** @type {string} */ (corner))
      ? /** @type {string} */ (corner)
      : "bottom-right",
    pauseOnBlur: get("pauseOnBlur") !== false,
  };
}
