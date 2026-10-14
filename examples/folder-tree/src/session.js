/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the tile's side
 *
 * Follows the folder the focused pane is in and answers the page, which
 * only draws. The page never touches the user's files: it asks, and the
 * tile lists (`tf.fs.list`) or opens (`tf.viewer.open`) through Tilefold,
 * which only reaches folders the user's panes are in.
 *
 * Messages, all plain JSON:
 * - page → tile: `ready` (the page has loaded), `expand {path}` (a folder
 *   was opened in the tree), `open {path}` (a file was clicked; a link is
 *   listed if it leads to a folder, else opened), `refresh`.
 * - tile → page: `tree {lang, dir, strings, root, name, listing | error}`
 *   (start again from this folder), `children {path, listing | error}`.
 *
 * Listings are filtered here (hidden names, folders to skip) so the page
 * gets only what it shows. Errors reach the page as a short message in the
 * user's language; anything unexpected is also written to the tile's log.
 */
import { folderName, parseSkip, visibleEntries } from "./tree.js";

/** Keys of the strings the page shows, by the page's own names. */
const STRINGS = {
  refresh: "page-refresh",
  loading: "page-loading",
  empty: "page-empty",
  truncated: "page-truncated",
  noFolder: "page-no-folder",
};

/** The message for an error from Tilefold, by its name. */
const ERROR_KEYS = {
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  UnreadableError: "error-unreadable",
  RateLimitError: "error-busy",
};

/** Starts the Folder Tree for `tf`; returns its handlers (for main.js and tests). */
export function createFolderTree(tf) {
  /** The folder the tree starts from (the focused pane's), or null. */
  let root = null;
  /** Whether the page is open, so changes are worth sending. */
  let pageOpen = false;

  const post = (message) => tf.page.post(message).catch(() => {});

  /** The user's choices about what to leave out. */
  const filters = () => ({
    showHidden: tf.settings.get("showHidden") === true,
    skip: parseSkip(tf.settings.get("skipFolders")),
  });

  /** A short message for an error, in the user's language. */
  const explain = (err) => {
    const key = ERROR_KEYS[err?.name];
    if (!key) void tf.log.warn(`Folder Tree: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
    return tf.t(key ?? "error-other");
  };

  /** One level of `path`, filtered, or an error message. */
  const listing = async (path) => {
    try {
      const l = await tf.fs.list(path);
      return { listing: { ...l, entries: visibleEntries(l.entries, filters()) } };
    } catch (err) {
      return { error: explain(err) };
    }
  };

  /** Sends the whole tree again, from the current root. */
  const sendTree = async () => {
    const strings = {};
    for (const [k, key] of Object.entries(STRINGS)) strings[k] = tf.t(key);
    const base = {
      do: "tree",
      lang: tf.t("page-lang"),
      dir: tf.t("page-dir") === "rtl" ? "rtl" : "ltr",
      strings,
      root,
      name: root ? folderName(root) : tf.t("page-title-none"),
    };
    await post(root ? { ...base, ...(await listing(root)) } : base);
  };

  /** A clicked file, or a link that may lead to a folder. */
  const openPath = async (path) => {
    try {
      await tf.viewer.open(path);
    } catch (err) {
      // A link to a folder: list it in place instead.
      if (err?.name === "NotAFileError") {
        return post({ do: "children", path, ...(await listing(path)) });
      }
      return post({ do: "children", path, error: explain(err) });
    }
    return null;
  };

  return {
    /** Opens the window (or brings it forward) and draws the tree. */
    async show() {
      root = await tf.pane.cwd();
      await tf.page.open({ keepRunning: false });
      pageOpen = true;
      await tf.audit("shown", { hasFolder: root !== null });
      // The page asks with `ready` once it has loaded; a page already open
      // gets the tree now.
      await sendTree();
    },
    /** A message from the page. */
    async fromPage(message) {
      const m = message && typeof message === "object" ? message : {};
      if (m.do === "ready" || m.do === "refresh") {
        pageOpen = true;
        return sendTree();
      }
      if (typeof m.path !== "string" || !m.path) return null;
      if (m.do === "expand")
        return post({ do: "children", path: m.path, ...(await listing(m.path)) });
      if (m.do === "open") return openPath(m.path);
      return null;
    },
    /** The focused pane's folder changed. */
    async paneChanged(path) {
      if (path === root) return null;
      root = path;
      return pageOpen ? sendTree() : null;
    },
    /** A setting changed: draw again with the new filters. */
    settingChanged: () => (pageOpen ? sendTree() : null),
    /** The user closed the window. */
    closed() {
      pageOpen = false;
    },
  };
}
