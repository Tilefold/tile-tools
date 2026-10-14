/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Arcade kit — settings
 *
 * The settings every arcade example shares: sounds on or off, the board
 * size, the corner of the pane it sits in, and whether it pauses when you
 * switch to another app. Registered at once with translated labels, and
 * read back cleaned up, so a bad stored value can never break the game.
 *
 * This file is the same in every arcade example (Orbit Guard, Brickfold,
 * Girder Jump), so each example stays a folder you can copy on its own.
 */

/** The corners the game can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];

/** The board sizes and their display scales. */
export const SIZES = { medium: 1, small: 0.75 };

/** Message keys of the corner labels. */
const CORNER_LABELS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left",
};

/**
 * Every setting: key, default, label message, and choices for a drop-down.
 *
 * @type {{ key: string, default: boolean | string, label: string,
 *          choices?: { value: string, label: string }[] }[]}
 */
export const SETTINGS = [
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

/** The keys whose change means the game must be laid out again. */
export const LAYOUT_KEYS = ["size", "corner"];

/**
 * Registers every setting with Tilefold, with translated labels. Call it at
 * the top of the tile's function, before any `await`.
 *
 * @param {any} tf The tile API.
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
 * The current settings, cleaned up: anything unknown falls back to its default.
 *
 * @param {{ get: (key: string) => unknown }} settings `tf.settings`.
 * @returns {{ sounds: boolean, size: "medium" | "small", corner: string, pauseOnBlur: boolean }}
 */
export function readSettings(settings) {
  const get = (key) => {
    try {
      return settings.get(key);
    } catch {
      return undefined;
    }
  };
  const corner = get("corner");
  return {
    sounds: get("sounds") !== false,
    size: get("size") === "small" ? "small" : "medium",
    corner: CORNERS.includes(/** @type {string} */ (corner))
      ? /** @type {string} */ (corner)
      : "bottom-right",
    pauseOnBlur: get("pauseOnBlur") !== false,
  };
}
