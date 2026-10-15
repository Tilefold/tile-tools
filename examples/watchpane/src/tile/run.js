/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the tile
 *
 * Wires the page to Tilefold:
 *
 * - Commands: **Open** (⌃⌥Y) shows the window and the card, **Play or
 *   pause** opens it when it's closed, **Back / Forward 10 seconds**,
 *   **Mute or unmute**, **Show or hide the card**, **Close** closes the
 *   window (closing stops the video).
 * - The card (card.js) sits over the panes like a music player's: the
 *   video's picture, title and progress, and buttons for playback, the
 *   recent videos and the window. The video plays in the window, which
 *   YouTube asks to stay visible.
 * - Messages, page → tile: `hello` (the page has loaded), `watching
 *   {id, title, from}` (a video started), `status {id, title, playing,
 *   time, duration, muted}` (for the card), `error {code}` (YouTube's
 *   player refused or failed). Tile → page: `setup {lang, dir, strings,
 *   options, recent}`, `recent {recent}`, `toggle`, `play {id}`, `control
 *   {action}`.
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
import { createCard } from "./card.js";
import { addRecent, readRecent } from "./recent.js";
import { cornerSetting, readOptions, showCardSetting } from "./settings.js";

/** Keys in `tf.store`. */
export const KEYS = { recent: "recent" };

/** Commands: stable ids, message keys of their titles, default shortcuts. */
export const COMMANDS = [
  { id: "open", title: "cmd-open", key: { mac: "Ctrl+Alt+Y", other: "Ctrl+Alt+Y" } },
  { id: "toggle", title: "cmd-toggle" },
  { id: "back", title: "cmd-back" },
  { id: "forward", title: "cmd-forward" },
  { id: "mute", title: "cmd-mute" },
  { id: "card", title: "cmd-card" },
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
  /** A video to play once the window has loaded, or null. */
  let pending = null;
  /** The card over the panes (needs window.overlay). */
  const card = tf.overlay
    ? createCard(tf, {
        post: (m) => post(m),
        openWindow: () => show({ resume: true }),
        play: (id) => play(id),
        recent: () => recent ?? [],
        isOpen: () => open,
        corner: () => cornerSetting(tf.settings),
      })
    : null;

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
  /**
   * Opens the window (or brings it forward), with the card. `resume`: a
   * closed window starts the video watched last again.
   */
  const show = async ({ resume = false } = {}) => {
    if (!tf.page) {
      await tf.toast(tf.t("toast-no-pages"));
      return;
    }
    if (!open && resume && !pending) pending = (await loadRecent())[0]?.id ?? null;
    // A web address of its own: YouTube's player plays only in a page that has one.
    await tf.page.open({ origin: "https" });
    if (!open) void audit("opened", {});
    open = true;
    if (card && showCardSetting(tf.settings)) await card.show();
  };

  /** Plays video `id`: in the open window, or once the window has opened. */
  const play = async (id) => {
    if (open) return post({ do: "play", id });
    pending = id;
    return show();
  };

  /** One of the card's playback actions, from the palette. */
  const control = async (action) => {
    if (card) return card.run(action);
    if (!open) return show({ resume: true });
    return post({ do: "control", action: action === "mute" ? "mute" : action });
  };

  /** Shows the card, or hides it. */
  const toggleCard = async () => {
    if (!card) return;
    if (card.visible) await card.hide();
    else await card.show();
  };

  const close = async () => {
    if (!tf.page || !open) return;
    await tf.page.close();
  };

  const toggle = async () => {
    if (open) await post({ do: "toggle" });
    else await show({ resume: true });
  };

  // ------------------------------------------------------------ the page
  const hear = async (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      await setup();
      if (pending) {
        const id = pending;
        pending = null;
        await post({ do: "play", id });
      }
    } else if (message.type === "status") {
      await card?.status(message);
    } else if (message.type === "watching") {
      const before = await loadRecent();
      const after = addRecent(before, message);
      if (after === before) return;
      recent = after;
      await tf.store.set(KEYS.recent, recent).catch(() => {});
      await card?.redraw();
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
  const runs = {
    open: () => show(),
    toggle,
    close,
    back: () => control("back"),
    forward: () => control("forward"),
    mute: () => control("mute"),
    card: toggleCard,
  };
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
      await card?.stopped();
    }),
  );
  tf.on(
    "overlay.pointer",
    background((e) => card?.pointer(e)),
  );
  tf.on(
    "overlay.layout",
    background((e) => card?.moved(e)),
  );
  tf.on(
    "overlay.hidden",
    background(() => card?.hide(true)),
  );
  tf.on(
    "setting.changed",
    background(async () => {
      if (open) await setup();
      await card?.redraw();
    }),
  );

  return { state: () => ({ open, recent, card: card?.visible ?? false }) };
}
