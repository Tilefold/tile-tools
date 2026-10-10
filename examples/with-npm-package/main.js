/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * ID Maker (example tile)
 *
 * Shows an npm package inside a tile: `nanoid` is installed with npm like
 * in any project, imported here, and bundled into main.js by Tile Tools, so
 * the tile still ships as one file. Only packages that run in a browser
 * Web Worker work in a tile (no Node.js built-ins, no DOM, no network);
 * nanoid uses crypto.getRandomValues, which tiles have.
 *
 * Build:  npm install && npm run build
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// ../../node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "57X6y3wQZNzYjJB2L_10pxbackgroundhimselfUTF-8DEMOGRAPHICSVqvt4KW9";

// ../../node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => {
  var id = "";
  var bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id += urlAlphabet[bytes[size] & 63];
  }
  return id;
};

// src/main.js
var main_default = (tf) => {
  tf.setting("length", 12, tf.t("setting-length"));
  tf.command(
    tf.t("cmd-new"),
    () => {
      const n = Math.round(Number(tf.settings.get("length")));
      const length = Number.isFinite(n) ? Math.min(64, Math.max(4, n)) : 12;
      return tf.toast(tf.t("toast-id", { id: nanoid(length) }));
    },
    { id: "new-id" }
  );
};
export default main_default;
