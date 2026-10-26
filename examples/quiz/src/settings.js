/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — settings and commands
 *
 * What the user can choose in Settings → Tiles: how the quiz shows (on a
 * borderless card floating over the panes, or in a panel beside them),
 * which corner of the pane the card starts in, and whether the card is
 * light, dark or follows the system. And the commands the tile adds to the
 * palette, each with a fixed id so its shortcut survives a change of
 * language (the commands AI agents use are in agent.js).
 */
import { APPEARANCES, appearanceOf } from "./appearance.js";
import { CORNERS, cornerOf } from "./scene.js";

/** The ways the quiz can show (docked beside the panes from Tilefold 0.1.20). */
export const SHOW_AS = ["card", "side", "panel"];

/** The label of each way to show it. */
const SHOW_AS_KEYS = {
  card: "setting-show-as-card",
  side: "setting-show-as-side",
  panel: "setting-show-as-panel",
};

/** The label of each corner. */
const CORNER_KEYS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left",
};

/** The label of each appearance. */
const APPEARANCE_KEYS = {
  auto: "setting-appearance-auto",
  light: "setting-appearance-light",
  dark: "setting-appearance-dark",
};

/** The palette commands: their id and title key. */
export const COMMANDS = [
  { id: "open", title: "cmd-open" },
  { id: "list", title: "cmd-list" },
  { id: "close", title: "cmd-close" },
  { id: "restart", title: "cmd-restart" },
  { id: "theme", title: "cmd-theme" },
  { id: "put-back", title: "cmd-put-back" },
];

/** Registers the settings, up front as Tilefold expects. */
export function registerSettings(tf) {
  tf.setting("showAs", "card", tf.t("setting-show-as"), {
    choices: SHOW_AS.map((value) => ({ value, label: tf.t(SHOW_AS_KEYS[value]) })),
  });
  tf.setting("corner", "bottom-right", tf.t("setting-corner"), {
    choices: CORNERS.map((value) => ({ value, label: tf.t(CORNER_KEYS[value]) })),
  });
  tf.setting("appearance", "auto", tf.t("setting-appearance"), {
    choices: APPEARANCES.map((value) => ({ value, label: tf.t(APPEARANCE_KEYS[value]) })),
  });
}

/** Reads a setting; a missing one is undefined. */
const read = (settings, key) => {
  try {
    return settings.get(key);
  } catch {
    return undefined;
  }
};

/** How the quiz shows: "card" (the default), "side" or "panel". */
export const showAsSetting = (settings) => {
  const value = read(settings, "showAs");
  return value === "panel" || value === "side" ? value : "card";
};

/** The card's corner. */
export const cornerSetting = (settings) => cornerOf(read(settings, "corner"));

/** The card's appearance setting: "auto", "light" or "dark". */
export const appearanceSetting = (settings) => appearanceOf(read(settings, "appearance"));
