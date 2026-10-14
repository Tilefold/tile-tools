/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the tile
 *
 * Wires the page to Tilefold:
 *
 * - Commands: **Open** (⌃⌥Y) shows the window, **Play or pause** opens it
 *   when it's closed, **Close** closes it (closing stops the video).
 * - Messages, page → tile: `hello` (the page has loaded), `watching
 *   {id, title, from}` (a video started), `error {code}` (YouTube's player
 *   refused or failed). Tile → page: `setup {lang, dir, strings, options,
 *   recent}`, `recent {recent}`, `toggle`.
 * - The videos watched lately are kept in `tf.store` (recent.js).
 * - Settings changes reach an open page at once; the player uses them for
 *   the next video.
 *
 * Audit entries never name a video: only that one started and where it was
 * picked from, or the error code YouTube gave. Handlers return at once and
 * work in the background, as Tilefold gives them half a second. A Tilefold
 * without tile pages (0.1.6 and earlier) gets a plain message.
 *
 * The page opens with `origin: "https"`: Tilefold then serves it at a web
 * address of the tile's own, which YouTube's player requires (in a
 * `tilepage:` page it refuses to play, with error 153). Such a page is one
 * self-contained document, so its script is built from page-src/ into the
 * single page/main.js.
 *
 * Registration comes first, with no `await` before it.
 */
import { addRecent, readRecent } from "./recent.js";
import { readOptions } from "./settings.js";

/** Keys in `tf.store`. */
export const KEYS = { recent: "recent" };

/** Commands: stable ids, message keys of their titles, default shortcuts. */
export const COMMANDS = [
  { id: "open", title: "cmd-open", key: { mac: "Ctrl+Alt+Y", other: "Ctrl+Alt+Y" } },
  { id: "toggle", title: "cmd-toggle" },
  { id: "close", title: "cmd-close" },
];

/** The page's text, by the key the page uses, from the tile's messages. */
export const STRINGS = {
  title: "page-title",
  link: "page-link",
  play: "page-play",
  recent: "page-recent",
  empty: "page-empty",
  loading: "page-loading",
  noPlayer: "page-no-player",
  badLink: "page-bad-link",
  errNotFound: "error-not-found",
  errNoEmbed: "error-no-embed",
  errConfig: "error-config",
  errOther: "error-other",
};

/** Where a video was picked from, as the page reports it. */
const FROM = ["link", "recent", "tile"];

/**
 * Starts the tile.
 *
 * @param {any} tf
 */
export function runWatchpane(tf) {
  /** Whether the page is open (shown), as far as the tile knows. */
  let open = false;
  /** @type {{ id: string, title: string }[] | null} null until read from the store. */
  let recent = null;

  const quiet = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch(() => {});
  const warn = (text) => quiet(() => tf.log.warn(String(text).slice(0, 300)));
  const audit = (action, details) => quiet(() => tf.audit(action, details));

  /** The recent list, read from the store the first time it's needed. */
  const loadRecent = async () => {
    if (recent === null) recent = readRecent(await tf.store.get(KEYS.recent).catch(() => null));
    return recent;
  };

  /** Sends a message to the page; a closed page just drops it. */
  const post = async (message) => {
    try {
      await tf.page.post(message);
    } catch {
      // The page closed or hasn't loaded yet; its "hello" asks again.
    }
  };

  /** Everything the page needs to draw itself, in the user's language. */
  const setup = async () => {
    const strings = {};
    // `{code}` stays in the error texts; the page puts YouTube's code there.
    for (const [k, key] of Object.entries(STRINGS)) strings[k] = tf.t(key, { code: "{code}" });
    return post({
      do: "setup",
      lang: tf.t("page-lang"),
      dir: tf.t("page-dir") === "rtl" ? "rtl" : "ltr",
      strings,
      options: readOptions(tf.settings),
      recent: await loadRecent(),
    });
  };

  // ------------------------------------------------------------ the window
  const show = async () => {
    if (!tf.page) {
      await tf.toast(tf.t("toast-no-pages"));
      return;
    }
    // A web address of its own: YouTube's player plays only in a page that has one.
    await tf.page.open({ origin: "https" });
    if (!open) void audit("opened", {});
    open = true;
  };

  const close = async () => {
    if (!tf.page || !open) return;
    await tf.page.close();
  };

  const toggle = async () => {
    if (open) await post({ do: "toggle" });
    else await show();
  };

  // ------------------------------------------------------------ the page
  const hear = async (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      await setup();
    } else if (message.type === "watching") {
      const before = await loadRecent();
      const after = addRecent(before, message);
      if (after === before) return;
      recent = after;
      await tf.store.set(KEYS.recent, recent).catch(() => {});
      void audit("video.start", { from: FROM.includes(message.from) ? message.from : "link" });
      await post({ do: "recent", recent });
    } else if (message.type === "error") {
      const code = message.code === "api" ? "api" : Number(message.code) || 0;
      void audit("video.error", { code });
      void warn(`player error ${code}`);
    }
  };

  /** Runs a handler's work in the background, so the handler returns at once. */
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch((err) => warn(err));

  // ------------------------------------------------------------ registration (nothing awaited above)
  const runs = { open: show, toggle, close };
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      background(() => runs[c.id]()),
      c.key ? { id: c.id, key: c.key } : { id: c.id },
    );
  }
  tf.on(
    "page.message",
    background((e) => hear(e && e.message)),
  );
  tf.on(
    "page.closed",
    background(async () => {
      if (open) void audit("closed", {});
      open = false;
    }),
  );
  tf.on(
    "setting.changed",
    background(async () => {
      if (open) await setup();
    }),
  );

  return { state: () => ({ open, recent }) };
}
