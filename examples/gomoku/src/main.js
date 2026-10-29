/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — five in a row against another developer
 *
 * A Gomoku board docked beside your panes. Start a game and send the other
 * player its code; they join with it in their own Tilefold, and each move
 * reaches the other board as it's played. Close the board and open it again
 * (even after quitting Tilefold) and you're back in the same game.
 *
 * It shows how a tile can do something live with other people: its page
 * keeps a WebSocket open to a room relay, a small server that passes
 * messages between the people in a room and knows nothing about the game.
 * The relay's address is in config.js and its protocol in
 * page-src/relay.js, so the tile can play through any relay that speaks it.
 *
 * Needs Tilefold 0.1.7 for the page, 0.1.20 to dock it beside the panes.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { runGomoku } from "./run.js";

export default (tf) => {
  runGomoku(tf);
};
