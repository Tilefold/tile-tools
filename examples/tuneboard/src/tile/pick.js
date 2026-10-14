/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — playing a picked playlist
 *
 * Shared by the Library window and the card's playlist panel. A pick plays
 * on the device Spotify is already using; when there is none, it starts the
 * player inside Tilefold (when this Tilefold has tile pages) and plays
 * there. Each pick is recorded with where it played and whether it worked,
 * never with the playlist. `messageFor` gives the user's message for a
 * failed request, by error code.
 */

/** The message key for a failed playlist request, by error code. */
const ERROR_MESSAGE = {
  auth: "player-error-sign-in",
  scope: "library-error-scope",
  premium: "player-error-premium",
  denied: "state-denied-hint",
  network: "library-error-network",
  "rate-limit": "library-error-network",
  "no-device": "state-no-device-hint",
  timeout: "player-error-other",
  account_error: "player-error-premium",
  authentication_error: "player-error-sign-in",
  token: "player-error-sign-in",
  initialization_error: "player-error-unsupported",
};

/** A short, known error code for the trail. */
export const codeOf = (err) => String(err?.code ?? "unknown").slice(0, 24);

/**
 * The message key for an error.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function messageFor(err) {
  return ERROR_MESSAGE[codeOf(err)] ?? "library-error-other";
}

/**
 * Creates the picker.
 *
 * @param {{ trail: { record: Function },
 *           player: { available: () => boolean, start: () => Promise<string> },
 *           client: () => Promise<any> }} deps
 *   `client` resolves to the connected Spotify client, or null when the
 *   user isn't signed in.
 */
export function createPicker({ trail, player, client }) {
  return {
    /**
     * Plays a playlist; resolves when Spotify took it, rejects with a coded
     * error otherwise.
     *
     * @param {string} uri A playlist URI the caller has checked.
     * @param {string} from Where the pick came from: "window" or "panel".
     */
    async play(uri, from) {
      const spotify = await client();
      if (!spotify) {
        trail.record("library.play", { ok: false, code: "auth", from });
        throw Object.assign(new Error("not signed in"), { code: "auth" });
      }
      let via = "device";
      try {
        try {
          await spotify.playContext(uri);
        } catch (err) {
          if (err?.code !== "no-device" || !player.available()) throw err;
          via = "tilefold";
          await spotify.playContext(uri, await player.start());
        }
        trail.record("library.play", { ok: true, via, from });
      } catch (err) {
        trail.record("library.play", { ok: false, code: codeOf(err), via, from });
        throw err;
      }
    },
  };
}
