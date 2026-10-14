/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — activity trail
 *
 * Records what happened in Tilefold's activity log (`tf.audit`) and the
 * tile's own log (`tf.log`): the card shown or hidden, each control the
 * user used, state changes (signed out, no device, playing…), sign-in
 * failures and token rotation, and the player inside Tilefold starting,
 * getting ready, failing (by Spotify's error kind), stopping or closing, and
 * the Library shown, its playlists loaded, one played (where, and whether
 * it worked) and its view changed. Never a token, a client id, a track title, a playlist
 * or anything else about what the user listens to: details are limited to
 * a known set of short keys. Every record is fire-and-forget, so a failing
 * log can never slow down or break the tile.
 */

/** The actions Tuneboard records, so the trail stays a known, small set. */
export const ACTIONS = Object.freeze([
  "view.show",
  "view.hide",
  "control.play",
  "control.pause",
  "control.previous",
  "control.next",
  "control.volume",
  "control.refresh",
  "state.change",
  "auth.failed",
  "auth.connected",
  "auth.legacy-cleared",
  "control.play-here",
  "player.start",
  "player.ready",
  "player.not-ready",
  "player.error",
  "player.stop",
  "player.closed",
  "library.show",
  "library.load",
  "library.play",
  "library.view",
]);

/**
 * The only detail keys that may reach the log. Anything else (a token
 * passed by mistake, a track title) is dropped.
 */
export const DETAIL_KEYS = Object.freeze(["from", "to", "volume", "ok", "code", "via"]);

/**
 * Keeps only allowed keys with plain numbers, booleans and short strings.
 *
 * @param {Record<string, unknown>} details
 * @returns {Record<string, number|boolean|string>}
 */
export function cleanDetails(details) {
  /** @type {Record<string, number|boolean|string>} */
  const out = {};
  for (const [k, v] of Object.entries(details || {})) {
    if (!DETAIL_KEYS.includes(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 24);
  }
  return out;
}

/**
 * Creates the trail.
 *
 * @param {any} tf The tile API.
 * @returns {{ record: (action: string, details?: Record<string, unknown>) => void,
 *             info: (text: string) => void, error: (err: unknown) => void }}
 */
export function createTrail(tf) {
  /** Runs a call to the app and swallows any failure, sync or async. */
  const quiet = (call) => {
    try {
      void Promise.resolve(call()).catch(() => {});
    } catch {
      // Nothing to do: the trail must never break the tile.
    }
  };
  return {
    record(action, details = {}) {
      if (!ACTIONS.includes(action)) return;
      const clean = cleanDetails(details);
      quiet(() => tf.audit(action, clean));
      quiet(() => tf.log.info(`${action} ${JSON.stringify(clean)}`));
    },
    info(text) {
      quiet(() => tf.log.info(String(text)));
    },
    error(err) {
      // Only the error's code or message: Spotify errors never carry tokens.
      const e = /** @type {any} */ (err);
      const text = e && e.code ? `${e.code}: ${e.message ?? ""}` : String((e && e.message) || e);
      quiet(() => tf.log.error(text.slice(0, 200)));
    },
  };
}
