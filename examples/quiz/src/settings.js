/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — settings and commands
 *
 * What the user can choose in Settings → Tiles: how the quiz shows (on a
 * borderless card floating over the panes, or in a panel beside them) and
 * which corner of the pane the card starts in. And the commands the tile
 * adds to the palette, each with a fixed id so its shortcut survives a
 * change of language.
 */
import { CORNERS, cornerOf } from "./scene.js";

/** The ways the quiz can show. */
export const SHOW_AS = ["card", "panel"];

/** The label of each way to show it. */
const SHOW_AS_KEYS = { card: "setting-show-as-card", panel: "setting-show-as-panel" };

/** The label of each corner. */
const CORNER_KEYS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left",
};

/** The palette commands: their id and title key. */
export const COMMANDS = [
  { id: "open", title: "cmd-open" },
  { id: "close", title: "cmd-close" },
  { id: "restart", title: "cmd-restart" },
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
}

/** How the quiz shows: "card" (the default) or "panel". */
export function showAsSetting(settings) {
  try {
    return settings.get("showAs") === "panel" ? "panel" : "card";
  } catch {
    return "card";
  }
}

/** The card's corner. */
export function cornerSetting(settings) {
  try {
    return cornerOf(settings.get("corner"));
  } catch {
    return "bottom-right";
  }
}
