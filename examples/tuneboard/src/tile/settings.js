/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — settings
 *
 * The tile's settings, in one table: key, default, the message key of its
 * description and, for drop-downs, its choices; a boolean gives a switch.
 * Nothing about the Spotify account is a setting: signing in happens under
 * Keys on the tile's card in Settings → Tiles, run by Tilefold.
 * `registerSettings` hands them to Tilefold (it must run at the top of the
 * tile, before any await); `readSettings` reads them back as clean values,
 * so the rest of the tile never has to guard against a hand-edited setting.
 */
import { CORNERS } from "./scene.js";

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
  { key: "poll", default: true, label: "setting-poll" },
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
 * The current settings, cleaned up.
 *
 * @param {{ get: (key: string) => unknown }} settings `tf.settings`.
 * @returns {{ size: string, corner: string, poll: boolean }}
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
    size: get("size") === "small" ? "small" : "medium",
    corner: CORNERS.includes(/** @type {string} */ (corner))
      ? /** @type {string} */ (corner)
      : "bottom-right",
    poll: get("poll") !== false,
  };
}
