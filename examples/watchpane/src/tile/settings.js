/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — settings
 *
 * Every setting the tile registers, and a reader that turns whatever is
 * stored into values the page can trust. Registered at the top of the
 * tile's function, before any `await`, as Tilefold requires.
 */

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
