/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane
 *
 * Plays YouTube videos over the panes, like a music player's card: where
 * Tilefold can dock a page (0.1.11), the video sits in Tilefold's window
 * with a control dock right under it (title, progress, and buttons to
 * play or pause, skip ten seconds, mute, pick one of the videos watched
 * lately, and close the video), the list opening beside them; the user
 * can drag the player anywhere. Older Tilefolds show the video in a small
 * window of its own, with a card over the panes. The video is the tile's
 * page (`page/`), which runs YouTube's own embedded player and stays
 * visible while it plays, as YouTube asks; the tile opens and closes it,
 * keeps the recent list, the settings and where the player was put, draws
 * the card and the dock (`window.overlay`), and talks to the page by
 * messages.
 *
 * It shows how a tile page can host a third party's embedded player:
 * - `page` plus `script:www.youtube.com` for YouTube's IFrame Player API;
 * - `net:` hosts for the player's frame (www.youtube-nocookie.com in
 *   private mode) and the thumbnails (i.ytimg.com);
 * - an overlay card the tile draws itself, controlling the page's player;
 * - no keys and no sign-in: the tile never talks to YouTube itself.
 *
 * Needs Tilefold 0.1.10 or later (tile pages with a web address; 0.1.9
 * opened them without one). Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
import { runWatchpane } from "./tile/run.js";
import { registerSettings } from "./tile/settings.js";

export default (tf) => {
  registerSettings(tf);
  runWatchpane(tf);
};
