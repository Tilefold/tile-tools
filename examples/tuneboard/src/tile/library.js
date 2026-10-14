/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the Library window
 *
 * Shows the user's Spotify playlists in Tuneboard's page, as a window, and
 * plays the one they pick. The page is the same one that runs the player
 * inside Tilefold, so it is opened with `keepRunning`: closing the window
 * only hides it and the music goes on.
 *
 * The tile does every Spotify request itself (through Tilefold's network,
 * with the sign-in Tilefold adds); the page only shows what the tile sends
 * and says what the user clicked. Messages between them:
 *
 * - page → tile: `hello` (the page has loaded), `want-playlists {offset}`,
 *   `play-playlist {uri}`, `set-view {view}` (thumbnails or list, which the
 *   tile remembers);
 * - tile → page: `library {lang, dir, view, strings}` (show the Library, in
 *   the user's language and the view they chose last), `playlists {offset, items, total, nextOffset}`,
 *   `library-error {message}`, `playing {uri, message}`.
 *
 * A pick plays as the picker decides (pick.js): on the device Spotify is
 * already using, or inside Tilefold when there is none. Handlers return at
 * once and work in the background (Tilefold gives them half a second).
 * Each step is recorded without names or URIs: only whether it worked, the
 * error code and where it played.
 *
 * Its listeners are registered when it is created, so create it at the top
 * of the tile's function, before any `await`.
 */
import { isPlaylistUri } from "../spotify/playlists.js";
import { codeOf, messageFor } from "./pick.js";
import { LIBRARY_VIEWS } from "./store.js";

/** The page's text, by the key the page uses, from the tile's messages. */
const STRINGS = {
  title: "library-title",
  refresh: "library-refresh",
  loading: "library-loading",
  empty: "library-empty",
  more: "library-more",
  viewGrid: "library-view-grid",
  viewList: "library-view-list",
};

/**
 * Creates the Library.
 *
 * @param {any} tf The tile API.
 * @param {{ trail: { record: Function, error: Function },
 *           store: { libraryView: () => Promise<string>, setLibraryView: (v: string) => Promise<boolean> },
 *           picker: { play: (uri: string, from: string) => Promise<void> },
 *           client: () => Promise<any>,
 *           afterPlay?: () => void }} deps
 *   `client` resolves to the connected Spotify client (or null when the user
 *   isn't signed in); `afterPlay` lets the card catch up after a pick.
 */
export function createLibrary(tf, { trail, store, picker, client, afterPlay = () => {} }) {
  /** Whether the user asked for the Library since the page last opened. */
  let wanted = false;

  /** Sends a message to the page; a closed page just drops it. */
  const post = async (message) => {
    try {
      await tf.page.post(message);
    } catch {
      // The page closed or hasn't loaded yet; its "hello" asks again.
    }
  };

  /** The user's language as the page should use it (each locale names its own). */
  const language = () => ({
    lang: tf.t("library-lang"),
    dir: tf.t("library-dir") === "rtl" ? "rtl" : "ltr",
  });

  /** Tells the page to show the Library, with its text. */
  const open = async () => {
    const strings = {};
    for (const [k, key] of Object.entries(STRINGS)) strings[k] = tf.t(key);
    return post({ do: "library", ...language(), view: await store.libraryView(), strings });
  };

  /** Says what went wrong, in the page. */
  const fail = (err) =>
    post({
      do: "library-error",
      message: tf.t(messageFor(err)),
    });

  /** Sends one page of playlists. */
  const load = async (offset) => {
    const spotify = await client();
    if (!spotify) {
      trail.record("library.load", { ok: false, code: "auth" });
      return fail({ code: "auth" });
    }
    try {
      const page = await spotify.playlists(offset);
      trail.record("library.load", { ok: true });
      // Each playlist's "by <owner>" line, in the user's language.
      const items = page.items.map((p) => ({
        ...p,
        byline: p.owner ? tf.t("library-by", { owner: p.owner }) : "",
      }));
      await post({ do: "playlists", offset, ...page, items });
    } catch (err) {
      trail.record("library.load", { ok: false, code: codeOf(err) });
      await fail(err);
    }
  };

  /** Plays a playlist where music already plays, or inside Tilefold. */
  const play = async (uri) => {
    try {
      await picker.play(uri, "window");
      await post({ do: "playing", uri, message: tf.t("library-playing") });
      afterPlay();
    } catch (err) {
      await fail(err);
    }
  };

  /** Handles one message from the page. */
  const hear = async (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      if (wanted) await open();
    } else if (message.type === "want-playlists") {
      const offset =
        Number.isSafeInteger(message.offset) && message.offset >= 0 ? message.offset : 0;
      await load(offset);
    } else if (message.type === "play-playlist") {
      if (isPlaylistUri(message.uri)) await play(message.uri);
    } else if (message.type === "set-view") {
      if (!LIBRARY_VIEWS.includes(message.view)) return;
      await store.setLibraryView(message.view);
      trail.record("library.view", { to: message.view });
    }
  };

  if (tf.page) {
    tf.on("page.message", (e) => {
      void hear(e && e.message).catch((err) => trail.error(err));
    });
    tf.on("page.closed", () => {
      wanted = false;
    });
  }

  return {
    /** Whether this Tilefold can show the Library (it has tile pages). */
    available: () => Boolean(tf.page && typeof tf.page.open === "function"),

    /** Opens the Library window (or brings it back) and fills it. */
    async show() {
      wanted = true;
      await tf.page.open({ visible: true, keepRunning: true });
      trail.record("library.show", {});
      // An already loaded page gets this at once; a new one says hello first.
      await open();
    },
  };
}
