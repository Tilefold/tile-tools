/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — settings and commands
 *
 * What the user chooses in Settings → Tiles → Prompt Polish: the language
 * they write prompts in, whether to fix mistakes only or also make the
 * prompt read naturally, where the page shows, and whether to use the
 * faster, cheaper model. And the palette commands, each with a fixed id.
 */
import { LANGUAGES } from "./languages.js";
import { VIEWS, viewOf } from "./place.js";

/** The modes: fix mistakes only, or also make it natural. */
export const MODES = ["fix", "natural"];

/** The label of each mode and view. */
const MODE_KEYS = { fix: "setting-mode-fix", natural: "setting-mode-natural" };
const VIEW_KEYS = {
  bottom: "setting-view-bottom",
  corner: "setting-view-corner",
  side: "setting-view-side",
};

/** The palette commands: their id and title key. */
export const COMMANDS = [
  { id: "open", title: "cmd-open" },
  { id: "close", title: "cmd-close" },
];

/** Registers the settings, up front as Tilefold expects. */
export function registerSettings(tf) {
  tf.setting("language", "auto", tf.t("setting-language"), {
    choices: [
      { value: "auto", label: tf.t("setting-language-auto") },
      ...LANGUAGES.map((l) => ({ value: l.code, label: l.native })),
    ],
  });
  tf.setting("mode", "fix", tf.t("setting-mode"), {
    choices: MODES.map((value) => ({ value, label: tf.t(MODE_KEYS[value]) })),
  });
  tf.setting("view", "bottom", tf.t("setting-view"), {
    choices: VIEWS.map((value) => ({ value, label: tf.t(VIEW_KEYS[value]) })),
  });
  tf.setting("fast", true, tf.t("setting-fast"));
}

/** Reads a setting; a missing one is undefined. */
const read = (settings, key) => {
  try {
    return settings.get(key);
  } catch {
    return undefined;
  }
};

/** The settings as the tile uses them, each checked. */
export function settingsOf(settings) {
  const mode = read(settings, "mode");
  return {
    language: read(settings, "language"),
    mode: mode === "natural" ? "natural" : "fix",
    view: viewOf(read(settings, "view")),
    fast: read(settings, "fast") !== false,
  };
}

/** The view setting's label, for the page's view switch. */
export const viewLabelKey = (view) => VIEW_KEYS[viewOf(view)];
