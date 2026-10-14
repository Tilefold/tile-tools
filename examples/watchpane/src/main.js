/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane
 *
 * Plays YouTube videos in a window of its own: paste a link, or pick one of
 * the videos watched lately. The window is the tile's page (`page/`), which
 * runs YouTube's own embedded player; the tile opens and closes it, keeps
 * the recent list and the settings, and passes them to the page by
 * messages.
 *
 * It shows how a tile page can host a third party's embedded player:
 * - `page` plus `script:www.youtube.com` for YouTube's IFrame Player API;
 * - `net:` hosts for the player's frame (www.youtube-nocookie.com in
 *   private mode) and the thumbnails (i.ytimg.com);
 * - no keys and no sign-in: the tile never talks to YouTube itself.
 *
 * Needs Tilefold 0.1.7 or later (tile pages). Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
import { runWatchpane } from "./tile/run.js";
import { registerSettings } from "./tile/settings.js";

export default (tf) => {
  registerSettings(tf);
  runWatchpane(tf);
};
