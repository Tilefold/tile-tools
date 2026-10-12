/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — settings
 *
 * The tile's settings, in one table: key, default, the message key of its
 * description and, for drop-downs, its choices. A text default gives a
 * text box (the Spotify client id and refresh token), a boolean a switch.
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
  { key: "clientId", default: "", label: "setting-client-id" },
  { key: "refreshToken", default: "", label: "setting-refresh-token" },
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

/** The keys whose change means signing in to Spotify again. */
export const ACCOUNT_KEYS = ["clientId", "refreshToken"];

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
 * A setting text, trimmed, with anything that is not a string read as "".
 * Pasted tokens often carry a stray space or newline.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The current settings, cleaned up.
 *
 * @param {{ get: (key: string) => unknown }} settings `tf.settings`.
 * @returns {{ clientId: string, refreshToken: string, size: string, corner: string, poll: boolean }}
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
    clientId: cleanText(get("clientId")),
    refreshToken: cleanText(get("refreshToken")),
    size: get("size") === "small" ? "small" : "medium",
    corner: CORNERS.includes(/** @type {string} */ (corner))
      ? /** @type {string} */ (corner)
      : "bottom-right",
    poll: get("poll") !== false,
  };
}
