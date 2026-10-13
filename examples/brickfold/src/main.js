/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Brickfold (example tile)
 *
 * A brick breaker in the corner of your pane: keep the ball in play with
 * your paddle and break the wall. Tilefold draws the board and its buttons
 * as an overlay (permission window.overlay), so the game can never take
 * your typing or see your terminal. Play with Ctrl+Alt shortcuts (⌃⌥ on
 * macOS) or the buttons under the board; click the board to start or pause.
 *
 * The game itself (engine/) and its drawing (render/) know nothing about
 * Tilefold. The arcade kit in tile/ connects them to it, and is the same
 * in every arcade example, so this folder works on its own.
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { MOVES, SOUNDS, soundFor } from "./brickfold.js";
import { createGame, H, W } from "./engine/game.js";
import { renderBoard } from "./render/board.js";
import { runArcade } from "./tile/arcade.js";
import { registerSettings } from "./tile/settings.js";

export default (tf) => {
  registerSettings(tf);
  runArcade(tf, {
    board: { w: W, h: H },
    tickMs: 40,
    create: createGame,
    render: renderBoard,
    moves: MOVES,
    toggleKey: { mac: "Ctrl+Alt+F", other: "Ctrl+Alt+F" },
    sounds: SOUNDS,
    soundFor,
  });
};
