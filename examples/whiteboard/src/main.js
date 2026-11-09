/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — a board your AI agent draws on to explain things
 *
 * Ask the AI agent in one of your panes to explain something (a file, a
 * function, an error, an idea) and it shows it on a board docked beside
 * your panes, then draws over it as it explains: boxes and arrows pointing
 * at exact lines, notes, highlights, small diagrams and 3D scenes you turn
 * by dragging, one step at a time. Step back and on through the
 * explanation, point at a line or a drawing, and ask about it; the agent
 * hears your question when it next reads the board.
 *
 * The agent draws through the tile's commands (Tilefold's tile_run), as
 * data the tile checks, never code. Needs Tilefold 0.1.14 for agents'
 * commands with data, 0.1.20 to dock the board beside the panes.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 *
 * Modified 2026-11-08 (one tab or every tab): the "Show on" setting.
 */
import { runWhiteboard } from "./run.js";

export default (tf) => {
  // Beside the panes: on the tab where it was opened (the default), or on every tab.
  tf.setting("showOn", "tab", tf.t("setting-show-on"), {
    choices: [
      { value: "tab", label: tf.t("setting-show-on-tab") },
      { value: "all", label: tf.t("setting-show-on-all") },
    ],
  });
  runWhiteboard(tf);
};
