/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the runner's timings and tables
 *
 * How often the runner moves the clock, confirms a control and checks for
 * a sign-in, and the tables it reads: the audit action for each control,
 * and the message for each error from the player inside Tilefold. Plain
 * data, kept apart from run.js so that file stays readable.
 */

/** How often the progress bar moves while a track plays, in ms. */
export const CLOCK_MS = 1000;

/** How long after a control to ask Spotify for the result, in ms. */
export const CONFIRM_MS = 800;

/** How often to check for a sign-in while signed out and on screen, in ms. */
export const SIGN_IN_CHECK_MS = 5000;

/**
 * How long to wait before trying again after Spotify refused the sign-in
 * Tilefold holds, in ms (the user may sign in again meanwhile; Refresh
 * tries at once).
 */
export const AUTH_RETRY_MS = 60000;

/** The sign-in Tuneboard declares in tile.json. */
export const SIGN_IN = "spotify";

/** The audit action for each control result. */
export const CONTROL_ACTION = {
  play: "control.play",
  pause: "control.pause",
  next: "control.next",
  previous: "control.previous",
  volume: "control.volume",
};

/** The message shown when playing in Tilefold fails, by error code. */
export const PLAYER_MESSAGE = {
  account_error: "player-error-premium",
  authentication_error: "player-error-sign-in",
  token: "player-error-sign-in",
  initialization_error: "player-error-unsupported",
};

/** The audit action recorded for a control that did not go through. */
export const FAILED_ACTION = {
  playPause: "control.play",
  next: "control.next",
  previous: "control.previous",
  volumeUp: "control.volume",
  volumeDown: "control.volume",
  mute: "control.volume",
};
