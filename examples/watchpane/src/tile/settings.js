/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — settings
 *
 * Every setting the tile registers, and a reader that turns whatever is
 * stored into values the page can trust. Registered at the top of the
 * tile's function, before any `await`, as Tilefold requires. The card's
 * settings (shown when the window opens, and its corner) are read by the
 * tile itself; the rest go to the page as the player's options.
 */
import { CORNERS, cornerOf } from "./scene.js";

/** Each corner's message key, written out so each can be found in the code. */
const CORNER_KEYS = {
  "bottom-right": "corner-bottom-right",
  "bottom-left": "corner-bottom-left",
  "top-right": "corner-top-right",
  "top-left": "corner-top-left",
};

/**
 * Every setting, with the message key of its description.
 *
 * @type {{ key: string, default: boolean, label: string }[]}
 */
export const SETTINGS = [
  { key: "autoplay", default: true, label: "setting-autoplay" },
  { key: "captions", default: false, label: "setting-captions" },
  { key: "private", default: true, label: "setting-private" },
];

/**
 * Registers every setting with Tilefold, with translated descriptions.
 *
 * @param {any} tf
 */
export function registerSettings(tf) {
  for (const s of SETTINGS) tf.setting(s.key, s.default, tf.t(s.label));
  tf.setting("showCard", true, tf.t("setting-show-card"));
  tf.setting("corner", "bottom-right", tf.t("setting-corner"), {
    choices: CORNERS.map((value) => ({ value, label: tf.t(CORNER_KEYS[value]) })),
  });
}

/** Whether the card shows when the window opens. */
export function showCardSetting(settings) {
  try {
    return settings.get("showCard") !== false;
  } catch {
    return true;
  }
}

/** The card's corner setting. */
export function cornerSetting(settings) {
  try {
    return cornerOf(settings.get("corner"));
  } catch {
    return cornerOf(null);
  }
}

/**
 * The current settings, as the page's player options. A value that isn't
 * a true or false falls back to the setting's default.
 *
 * @param {{ get: (key: string) => unknown }} settings `tf.settings`.
 * @returns {{ autoplay: boolean, captions: boolean, private: boolean }}
 */
export function readOptions(settings) {
  const out = {};
  for (const s of SETTINGS) {
    let value;
    try {
      value = settings.get(s.key);
    } catch {
      value = undefined;
    }
    out[s.key] = typeof value === "boolean" ? value : s.default;
  }
  return /** @type {any} */ (out);
}
