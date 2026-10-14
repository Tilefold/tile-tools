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
 *   visible      whether the card was on screen, so it comes back the same
 *   libraryView  how the Library lists playlists: "grid" (thumbnails) or "list"
 *
 * Signing in to Spotify is Tilefold's job: the token lives in the system
 * keychain and never reaches the tile. Earlier versions of Tuneboard kept
 * a refresh token under `auth`; `clearLegacyAuth` overwrites it with null
 * so no copy of it stays in the tile's storage.
 *
 * Everything read back is checked, so a damaged value falls back to a
 * sensible default. A failed write is logged and otherwise ignored.
 */

/** Storage keys. */
/** `auth` is only read to clear what earlier versions saved there. */
export const KEYS = { visible: "visible", auth: "auth", libraryView: "libraryView" };

/** The Library's ways of listing playlists; the first is the default. */
export const LIBRARY_VIEWS = Object.freeze(["grid", "list"]);

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
    /** How the Library lists playlists (default: thumbnails). */
    async libraryView() {
      const view = await read(KEYS.libraryView);
      return LIBRARY_VIEWS.includes(view) ? view : LIBRARY_VIEWS[0];
    },
    /** Remembers how the Library lists playlists; refuses unknown views. */
    async setLibraryView(view) {
      if (!LIBRARY_VIEWS.includes(view)) return false;
      return write(KEYS.libraryView, view);
    },
    /**
     * Overwrites a refresh token an earlier version saved, if there is one.
     * Returns true when there was one to clear.
     */
    async clearLegacyAuth() {
      if ((await read(KEYS.auth)) === null) return false;
      await write(KEYS.auth, null);
      return true;
    },
  };
}
