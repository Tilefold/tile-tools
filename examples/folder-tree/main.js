/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree
 *
 * A window with the folder the focused pane is in, as a tree: open folders
 * one level at a time, click a file to read it in Tilefold's document
 * viewer. The tree follows you when you switch panes or `cd` elsewhere.
 *
 * It shows what a tile can do with the user's folders from Tilefold 0.1.9
 * on, each with a permission and a reason:
 * - `tf.pane.cwd()` and the `pane.cwd` event (`pane.cwd`);
 * - `tf.fs.list` for one level of names, never file contents (`fs.list`);
 * - `tf.viewer.open` to show a file (`viewer.open`);
 * and, from 0.1.7, a page of its own (`page`) that only draws the tree.
 * Tilefold lets it reach only folders the user's panes are in.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/tree.js
var MAX_SKIP = 50;
function parseSkip(text) {
  const names = String(text ?? "").split(/[\s,]+/).map((n) => n.trim()).filter((n) => n && !n.includes("/") && !n.includes("\\"));
  return new Set(names.slice(0, MAX_SKIP));
}
function visibleEntries(entries, { showHidden = false, skip = /* @__PURE__ */ new Set() } = {}) {
  return entries.filter((e) => {
    if (!showHidden && e.name.startsWith(".")) return false;
    return !(e.kind === "dir" && skip.has(e.name));
  });
}
function folderName(path) {
  const parts = String(path ?? "").split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "/";
}

// src/session.js
var STRINGS = {
  refresh: "page-refresh",
  loading: "page-loading",
  empty: "page-empty",
  truncated: "page-truncated",
  noFolder: "page-no-folder"
};
var ERROR_KEYS = {
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  UnreadableError: "error-unreadable",
  RateLimitError: "error-busy"
};
function createFolderTree(tf) {
  let root = null;
  let pageOpen = false;
  const post = (message) => tf.page.post(message).catch(() => {
  });
  const filters = () => ({
    showHidden: tf.settings.get("showHidden") === true,
    skip: parseSkip(tf.settings.get("skipFolders"))
  });
  const explain = (err) => {
    const key = ERROR_KEYS[err?.name];
    if (!key) void tf.log.warn(`Folder Tree: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
    return tf.t(key ?? "error-other");
  };
  const listing = async (path) => {
    try {
      const l = await tf.fs.list(path);
      return { listing: { ...l, entries: visibleEntries(l.entries, filters()) } };
    } catch (err) {
      return { error: explain(err) };
    }
  };
  const sendTree = async () => {
    const strings = {};
    for (const [k, key] of Object.entries(STRINGS)) strings[k] = tf.t(key);
    const base = {
      do: "tree",
      lang: tf.t("page-lang"),
      dir: tf.t("page-dir") === "rtl" ? "rtl" : "ltr",
      strings,
      root,
      name: root ? folderName(root) : tf.t("page-title-none")
    };
    await post(root ? { ...base, ...await listing(root) } : base);
  };
  const openPath = async (path) => {
    try {
      await tf.viewer.open(path);
    } catch (err) {
      if (err?.name === "NotAFileError") {
        return post({ do: "children", path, ...await listing(path) });
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
        return post({ do: "children", path: m.path, ...await listing(m.path) });
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
    settingChanged: () => pageOpen ? sendTree() : null,
    /** The user closed the window. */
    closed() {
      pageOpen = false;
    }
  };
}

// src/main.js
var main_default = (tf) => {
  tf.setting("showHidden", false, tf.t("setting-show-hidden"));
  tf.setting("skipFolders", "node_modules", tf.t("setting-skip-folders"));
  const supported = Boolean(tf.pane && tf.fs && tf.viewer && tf.page);
  const tree = supported ? createFolderTree(tf) : null;
  tf.command(
    tf.t("cmd-show"),
    () => tree ? tree.show() : tf.toast(tf.t("needs-newer-tilefold")),
    { id: "show" }
  );
  tf.on("pane.cwd", (e) => tree?.paneChanged(e.path ?? null));
  tf.on("page.message", (e) => tree?.fromPage(e.message));
  tf.on("page.closed", () => tree?.closed());
  tf.on("setting.changed", () => tree?.settingChanged());
};
export default main_default;
