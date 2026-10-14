/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — settings
 *
 * Every setting the tile registers, and a reader that turns whatever is
 * stored into values the tile can trust. Registered at the top of the
 * tile's function, before any `await`, as Tilefold requires.
 */
import { cleanProject, cleanRef } from "../gitlab/api.js";

/** The corners the board can sit in. */
export const CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];

/**
 * Every setting. `choices` lists values with the message key of their label,
 * spelled out so the keys can be found.
 *
 * @type {{ key: string, default: unknown, label: string,
 *          choices?: { value: string, label: string }[] }[]}
 */
export const SETTINGS = [
  { key: "project", default: "", label: "setting-project" },
  { key: "ref", default: "", label: "setting-ref" },
  {
    key: "corner",
    default: "bottom-right",
    label: "setting-corner",
    choices: [
      { value: "bottom-right", label: "setting-corner-bottom-right" },
      { value: "bottom-left", label: "setting-corner-bottom-left" },
      { value: "top-right", label: "setting-corner-top-right" },
      { value: "top-left", label: "setting-corner-top-left" },
    ],
  },
  { key: "notify", default: true, label: "setting-notify" },
];

/** Settings whose change means asking GitLab again, not just a redraw. */
export const FETCH_KEYS = ["project", "ref"];

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
 * @returns {{ project: string, ref: string, corner: string, notify: boolean }}
 */
export function readSettings(settings) {
  const get = (key) => {
    try {
      return settings.get(key);
    } catch {
      return undefined;
    }
  };
  const corner = String(get("corner"));
  return {
    project: cleanProject(get("project")),
    ref: cleanRef(get("ref")),
    corner: CORNERS.includes(corner) ? corner : "bottom-right",
    notify: get("notify") !== false,
  };
}
