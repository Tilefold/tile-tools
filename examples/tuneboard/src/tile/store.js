/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — saved data
 *
 * What Tuneboard keeps between sessions in `tf.store` (the tile's own
 * storage, which nothing else can read):
 *
 *   visible  whether the card was on screen, so it comes back the same
 *   auth     the newest refresh token Spotify handed out, with a
 *            fingerprint of the token pasted into Settings that it grew
 *            from. Spotify may replace a refresh token each time it is
 *            used, after which the pasted one stops working; keeping the
 *            newest one here lets the tile sign in again after a restart.
 *            When the user pastes a different token, the fingerprint no
 *            longer matches and the pasted one wins again.
 *
 * Nothing is ever removed: forgetting the saved token overwrites it with
 * null. Everything read back is checked, so a damaged value falls back to
 * a sensible default. A failed write is logged and otherwise ignored.
 */

/** Storage keys. */
export const KEYS = { visible: "visible", auth: "auth" };

/** The auth record format this version writes and understands. */
export const AUTH_VERSION = 1;

/**
 * A short, stable fingerprint of a string (32-bit FNV-1a, as hex). Used to
 * tell whether the pasted token changed without keeping a second copy of
 * it; it is not a security measure.
 *
 * @param {string} text
 * @returns {string}
 */
export function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Wraps `tf.store` with checked reads and forgiving writes.
 *
 * @param {any} tf The tile API.
 */
export function createStore(tf) {
  /** Reads a key; null when missing or when the store fails. */
  const read = async (key) => {
    try {
      return await tf.store.get(key);
    } catch (err) {
      void Promise.resolve(
        tf.log.warn(`store read ${key} failed: ${String((err && err.message) || err)}`),
      ).catch(() => {});
      return null;
    }
  };
  /** Writes a key; logs and carries on when the store fails. */
  const write = async (key, value) => {
    try {
      await tf.store.set(key, value);
      return true;
    } catch (err) {
      void Promise.resolve(
        tf.log.warn(`store write ${key} failed: ${String((err && err.message) || err)}`),
      ).catch(() => {});
      return false;
    }
  };

  return {
    /** Whether the card was last left on screen (default: hidden). */
    async visible() {
      return (await read(KEYS.visible)) === true;
    },
    /** Remembers whether the card is on screen. */
    async setVisible(on) {
      return write(KEYS.visible, Boolean(on));
    },
    /**
     * The refresh token to sign in with: the saved newer one when it grew
     * from the token now in Settings, else the one in Settings itself.
     *
     * @param {string} pasted The refresh token from Settings ("" for none).
     * @returns {Promise<string>}
     */
    async refreshToken(pasted) {
      if (!pasted) return "";
      const saved = await read(KEYS.auth);
      if (
        saved &&
        typeof saved === "object" &&
        saved.v === AUTH_VERSION &&
        saved.seed === fingerprint(pasted) &&
        typeof saved.token === "string" &&
        saved.token
      ) {
        return saved.token;
      }
      return pasted;
    },
    /**
     * Saves a newer refresh token that grew from the pasted one.
     *
     * @param {string} pasted The refresh token from Settings.
     * @param {string} token The newer token Spotify returned.
     */
    async saveRefreshToken(pasted, token) {
      return write(KEYS.auth, { v: AUTH_VERSION, seed: fingerprint(pasted), token: String(token) });
    },
    /** Forgets the saved token (overwritten with null; the key stays). */
    async forgetRefreshToken() {
      return write(KEYS.auth, null);
    },
  };
}
