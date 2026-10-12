/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — a falling-blocks game as a Tilefold tile
 *
 * Play a falling-blocks game in the corner of your pane while you wait on
 * a build. Tilefold draws the board, the score panel and the on-screen
 * buttons as an overlay (permission window.overlay), so the game can never
 * take your typing or see your terminal. Play with the commands and their
 * Ctrl+Alt shortcuts (⌃⌥ on macOS), or click the buttons; click the board
 * to pause.
 *
 * This entry registers the settings, then hands over to the tile code with
 * the engine plugged in. Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
import { createGame, gravityMs } from "./engine/index.js";
import { registerSettings } from "./tile/settings.js";
import { runTilefall } from "./tile/run.js";

export default (tf) => {
  registerSettings(tf);
  runTilefall(tf, { createGame, gravityMs });
};
