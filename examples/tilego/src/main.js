/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the game of Go against another developer, or an AI agent
 *
 * A Go board (9 × 9, 13 × 13 or 19 × 19) docked beside your panes. Start a
 * game and send the other player its code; they join with it in their own
 * Tilefold, and each move reaches the other board as it's played. Or play
 * an AI agent in one of your panes, which reads the board and plays through
 * the tile's commands. Close the board and open it again (even after
 * quitting Tilefold) and you're back in the same game.
 *
 * Like the Gomoku example, its page keeps a WebSocket open to a room
 * relay, a small server that passes messages between the people in a room
 * and knows nothing about the game. The relay's address is in config.js
 * and its protocol in page-src/relay.js.
 *
 * Needs Tilefold 0.1.7 for the page, 0.1.20 to dock it beside the panes.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 *
 * Modified 2026-11-08 (one tab or every tab): the "Show on" setting.
 */
import { runTileGo } from "./run.js";

export default (tf) => {
  // Beside the panes: on the tab where it was opened (the default), or on every tab.
  tf.setting("showOn", "tab", tf.t("setting-show-on"), {
    choices: [
      { value: "tab", label: tf.t("setting-show-on-tab") },
      { value: "all", label: tf.t("setting-show-on-all") },
    ],
  });
  runTileGo(tf);
};
