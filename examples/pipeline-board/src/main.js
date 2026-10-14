/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board
 *
 * The latest CI pipelines of a GitLab project in a corner of the focused
 * pane: passed, failed, running or waiting, on which branch and how long
 * ago, with an optional notice when one finishes.
 *
 * It shows signing in to a service from Tilefold 0.1.6 on. tile.json
 * declares a GitLab sign-in (`oauth2-pkce`) that uses the user's own GitLab
 * application (`"clientId": "user"`), so no client id or secret ships with
 * the tile. Tilefold runs the sign-in in the browser, keeps the token in
 * the keychain, refreshes it, and adds it to requests that name the
 * sign-in; the tile only ever learns whether the user is signed in.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { runPipelineBoard } from "./tile/run.js";
import { registerSettings } from "./tile/settings.js";

export default (tf) => {
  registerSettings(tf);
  runPipelineBoard(tf);
};
