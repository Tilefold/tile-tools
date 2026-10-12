/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — Spotify's now playing as a Tilefold tile
 *
 * Shows what Spotify is playing in a card in the corner of your pane, with
 * buttons for previous, play/pause, next and volume, and Ctrl+Alt
 * shortcuts (⌃⌥ on macOS) that work even while the card is hidden.
 * Tilefold draws the card as an overlay (permission window.overlay), so
 * the tile never sees your typing or your terminal.
 *
 * Talking to Spotify needs network access, which Tilefold does not grant
 * tiles yet; until it does, the card says so and nothing is sent anywhere.
 *
 * This entry registers the settings, then hands over to the tile code
 * with the Spotify client plugged in. Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
import { createSpotify } from "./spotify/index.js";
import { registerSettings } from "./tile/settings.js";
import { runTuneboard } from "./tile/run.js";

export default (tf) => {
  registerSettings(tf);
  runTuneboard(tf, { createSpotify });
};
