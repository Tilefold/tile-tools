/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — playing inside Tilefold
 *
 * Tuneboard's page (page/index.html, permission `page`) runs Spotify's Web
 * Playback SDK, which makes Tilefold itself a Spotify device called
 * "Tilefold". This part opens that page hidden (it only makes sound), waits
 * for the page to say the device is ready, and hears the page's errors.
 * The page asks Tilefold for the Spotify sign-in itself (the sign-in is
 * declared with `"page": true`), so the tile still never sees a token.
 *
 * Its listeners are registered when it is created, so create it at the top
 * of the tile's function, before any `await`.
 */

/** How long to wait for the page's player to be ready, in ms. */
export const READY_TIMEOUT_MS = 15000;

/** What the page reports when the SDK fails, by Spotify's error kind. */
export const PLAYER_ERRORS = Object.freeze([
  "initialization_error",
  "authentication_error",
  "account_error",
  "playback_error",
  "token",
]);

/** An error from the page's player, with Spotify's kind as `code`. */
function playerError(code) {
  return Object.assign(new Error(`the player in Tilefold failed (${code})`), { code });
}

/**
 * Creates the page player.
 *
 * @param {any} tf The tile API.
 * @param {{ trail: { record: (action: string, details: object) => void } }} deps
 */
export function createPagePlayer(tf, { trail }) {
  /** The device id of the ready player, or null. */
  let deviceId = null;
  /** Starts waiting for the player to be ready. */
  let waiting = [];

  const settle = (fn) => {
    const pending = waiting;
    waiting = [];
    for (const w of pending) fn(w);
  };

  /** Handles one message from the page. */
  const hear = (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "ready" && typeof message.deviceId === "string") {
      deviceId = message.deviceId;
      trail.record("player.ready", {});
      settle((w) => w.resolve(message.deviceId));
    } else if (message.type === "not-ready") {
      deviceId = null;
      trail.record("player.not-ready", {});
    } else if (message.type === "error") {
      const code = PLAYER_ERRORS.includes(message.kind) ? message.kind : "unknown";
      trail.record("player.error", { code });
      settle((w) => w.reject(playerError(code)));
    }
  };

  if (tf.page) {
    tf.on("page.message", (e) => hear(e && e.message));
    tf.on("page.closed", () => {
      deviceId = null;
      trail.record("player.closed", {});
      settle((w) => w.reject(playerError("closed")));
    });
  }

  return {
    /** Whether this Tilefold can run the player (it has tile pages). */
    available: () => Boolean(tf.page && typeof tf.page.open === "function"),

    /** Whether the player is running and ready. */
    ready: () => deviceId !== null,

    /**
     * Starts the player (or reuses the running one); resolves to its device id.
     *
     * @returns {Promise<string>}
     */
    async start() {
      if (deviceId) return deviceId;
      const ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting = waiting.filter((w) => w.resolve !== resolve);
          reject(playerError("timeout"));
        }, READY_TIMEOUT_MS);
        waiting.push({
          resolve: (id) => {
            clearTimeout(timer);
            resolve(id);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        });
      });
      await tf.page.open({ visible: false });
      trail.record("player.start", {});
      return ready;
    },

    /** Stops the player and closes its page. */
    async stop() {
      deviceId = null;
      await tf.page.close();
      trail.record("player.stop", {});
    },
  };
}
