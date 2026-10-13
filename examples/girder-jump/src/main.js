/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump (example tile)
 *
 * A climb-and-dodge platformer in the corner of your pane: climb the
 * girders to the beacon while a robot rolls crates down at you, and jump
 * them for points. Tilefold draws the board and its buttons as an overlay
 * (permission window.overlay), so the game can never take your typing or
 * see your terminal. Play with Ctrl+Alt+Shift shortcuts (⌃⌥⇧ on macOS) or
 * the buttons under the board; click the board to start or pause.
 *
 * The game itself (engine/) and its drawing (render/) know nothing about
 * Tilefold. The arcade kit in tile/ connects them to it, and is the same
 * in every arcade example, so this folder works on its own.
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { H, W } from "./engine/field.js";
import { createGame } from "./engine/game.js";
import { MOVES, SOUNDS, soundFor } from "./girder.js";
import { renderBoard } from "./render/board.js";
import { runArcade } from "./tile/arcade.js";
import { registerSettings } from "./tile/settings.js";

export default (tf) => {
  registerSettings(tf);
  runArcade(tf, {
    board: { w: W, h: H },
    tickMs: 50,
    create: createGame,
    render: renderBoard,
    moves: MOVES,
    toggleKey: { mac: "Ctrl+Alt+J", other: "Ctrl+Alt+J" },
    sounds: SOUNDS,
    soundFor,
  });
};
