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
import { nanoid } from "nanoid";

export default (tf) => {
  tf.setting("length", 12, tf.t("setting-length"));

  tf.command(
    tf.t("cmd-new"),
    () => {
      const n = Math.round(Number(tf.settings.get("length")));
      const length = Number.isFinite(n) ? Math.min(64, Math.max(4, n)) : 12;
      return tf.toast(tf.t("toast-id", { id: nanoid(length) }));
    },
    { id: "new-id" },
  );
};
