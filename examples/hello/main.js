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
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/greeting.js
function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return "greeting-morning";
  if (hour >= 12 && hour < 18) return "greeting-afternoon";
  return "greeting-evening";
}

// src/main.js
var main_default = (tf) => {
  tf.setting("name", "", tf.t("setting-name"));
  tf.command(
    tf.t("cmd-hello"),
    () => {
      const name = String(tf.settings.get("name") || "").trim() || tf.t("greeting-anonymous");
      return tf.toast(tf.t(greetingKey((/* @__PURE__ */ new Date()).getHours()), { name }));
    },
    // An id keeps the command (and any shortcut to it) stable when its title is translated.
    { id: "say-hello" }
  );
};
export default main_default;
