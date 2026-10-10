/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Hello (example tile)
 *
 * The smallest useful multi-file tile: this entry registers a setting and a
 * command, and imports the greeting logic from ./greeting.js. Tile Tools
 * bundles both files into main.js.
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { greetingKey } from "./greeting.js";

export default (tf) => {
  // Register everything at the top, before any `await`: Tilefold checks
  // what a tile adds once, before it runs.
  tf.setting("name", "", tf.t("setting-name"));

  tf.command(
    tf.t("cmd-hello"),
    () => {
      const name = String(tf.settings.get("name") || "").trim() || tf.t("greeting-anonymous");
      return tf.toast(tf.t(greetingKey(new Date().getHours()), { name }));
    },
    // An id keeps the command (and any shortcut to it) stable when its title is translated.
    { id: "say-hello" },
  );
};
