/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree
 *
 * The folder the focused pane is in, as a tree in a panel docked beside
 * your panes: open folders one level at a time, click a file to read it in
 * Tilefold's document viewer, which opens right next to the tree. The tree
 * follows you when you switch panes or `cd` elsewhere.
 *
 * It shows what a tile can do from Tilefold 0.1.9 on, each with a
 * permission and a reason:
 * - a docked panel Tilefold draws from rows (`tf.panel`, `window.panel`);
 * - `tf.pane.cwd()` and the `pane.cwd` event (`pane.cwd`);
 * - `tf.fs.list` for one level of names, never file contents (`fs.list`);
 * - `tf.viewer.open` to show a file (`viewer.open`).
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

// src/model.js
function emptyTree(root) {
  return { root, folders: {}, open: [], loading: [] };
}
function childPath(dir, name) {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}
var without = (list, item) => list.filter((x) => x !== item);
var adding = (list, item) => list.includes(item) ? list : [...list, item];
function startLoading(tree, path) {
  return { ...tree, open: adding(tree.open, path), loading: adding(tree.loading, path) };
}
function withListing(tree, path, listing) {
  const level = {
    path: listing.path ?? path,
    entries: listing.entries,
    truncated: !!listing.truncated
  };
  return {
    ...tree,
    folders: { ...tree.folders, [path]: level },
    loading: without(tree.loading, path)
  };
}
function withError(tree, path, message) {
  return {
    ...tree,
    folders: { ...tree.folders, [path]: { error: message } },
    loading: without(tree.loading, path)
  };
}
var opened = (tree, path) => ({ ...tree, open: adding(tree.open, path) });
var closed = (tree, path) => ({ ...tree, open: without(tree.open, path) });
var isLoaded = (tree, path) => path in tree.folders;
function treeRows(tree, { strings, filters }) {
  const rows = [];
  const targets = /* @__PURE__ */ new Map();
  const note = (key, depth, icon, label) => rows.push({ id: `note:${key}`, label, icon, depth, muted: true });
  const walk = (path, depth) => {
    const level = tree.folders[path];
    if (!level) {
      if (tree.loading.includes(path)) note(`${path}:loading`, depth, "loading", strings.loading);
      return;
    }
    if (level.error !== void 0) return note(`${path}:error`, depth, "error", level.error);
    const entries = visibleEntries(level.entries, filters);
    if (entries.length === 0) note(`${path}:empty`, depth, "info", strings.empty);
    for (const entry of entries) {
      const child = childPath(level.path, entry.name);
      const isOpen = tree.open.includes(child);
      const folderLike = entry.kind === "dir" || entry.kind === "link" && isLoaded(tree, child);
      rows.push({
        id: child,
        label: entry.name,
        icon: entry.kind === "dir" ? "folder" : entry.kind === "link" ? "link" : "file",
        depth,
        expandable: folderLike,
        expanded: folderLike && isOpen,
        hint: child
      });
      targets.set(child, { kind: folderLike ? "dir" : entry.kind, path: child });
      if (folderLike && isOpen) walk(child, depth + 1);
    }
    if (level.truncated) note(`${path}:truncated`, depth, "info", strings.truncated);
    return void 0;
  };
  if (tree.root) walk(tree.root, 0);
  else note("no-folder", 0, "info", strings.noFolder);
  return { rows, targets };
}

// src/session.js
var ERROR_KEYS = {
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  UnreadableError: "error-unreadable",
  RateLimitError: "error-busy"
};
function createFolderTree(tf) {
  let tree = emptyTree(null);
  let shown = false;
  let targets = /* @__PURE__ */ new Map();
  const explain = (err) => {
    const key = ERROR_KEYS[err?.name];
    if (!key) void tf.log.warn(`Folder Tree: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
    return tf.t(key ?? "error-other");
  };
  const draw = async () => {
    if (!shown) return;
    const built = treeRows(tree, {
      strings: {
        loading: tf.t("row-loading"),
        empty: tf.t("row-empty"),
        truncated: tf.t("row-truncated"),
        noFolder: tf.t("row-no-folder")
      },
      filters: {
        showHidden: tf.settings.get("showHidden") === true,
        skip: parseSkip(tf.settings.get("skipFolders"))
      }
    });
    targets = built.targets;
    await tf.panel.show({
      title: tree.root ? folderName(tree.root) : tf.t("title-no-folder"),
      ...tree.root ? { subtitle: tree.root } : {},
      rows: built.rows
    });
  };
  const load = async (path) => {
    tree = startLoading(tree, path);
    await draw();
    try {
      tree = withListing(tree, path, await tf.fs.list(path));
    } catch (err) {
      tree = withError(tree, path, explain(err));
    }
    await draw();
  };
  const start = async (root) => {
    tree = emptyTree(root);
    if (root) await load(root);
    else await draw();
  };
  const toggle = async (path, open) => {
    if (!open) {
      tree = closed(tree, path);
      return draw();
    }
    if (isLoaded(tree, path)) {
      tree = opened(tree, path);
      return draw();
    }
    return load(path);
  };
  const openFile = async (path, isLink) => {
    try {
      await tf.viewer.open(path);
    } catch (err) {
      if (isLink && err?.name === "NotAFileError") return load(path);
      await tf.toast(explain(err));
    }
    return void 0;
  };
  return {
    /** Shows the panel, or hides it when it is shown. */
    async toggleShown() {
      if (shown) {
        shown = false;
        return tf.panel.hide();
      }
      shown = true;
      const root = await tf.pane.cwd();
      await tf.audit("shown", { hasFolder: root !== null });
      return start(root);
    },
    /** Lists everything again from the top. */
    refresh: () => shown ? start(tree.root) : void 0,
    /** A click (or key) on a row of the panel. */
    async clicked({ row, action } = {}) {
      const target = targets.get(row);
      if (!target) return void 0;
      if (target.kind === "dir") {
        const open = action === "expand" || action === "activate" && !tree.open.includes(row);
        return toggle(target.path, open);
      }
      if (target.kind === "file" || target.kind === "link") {
        return openFile(target.path, target.kind === "link");
      }
      return void 0;
    },
    /** The focused pane's folder changed. */
    async paneChanged(path) {
      if (path === tree.root) return void 0;
      if (shown) return start(path);
      tree = emptyTree(path);
      return void 0;
    },
    /** A setting changed: draw again with the new filters. */
    settingChanged: () => draw(),
    /** The user closed the panel (or another tile's took its place). */
    closed() {
      shown = false;
    }
  };
}

// src/main.js
var main_default = (tf) => {
  tf.setting("showHidden", false, tf.t("setting-show-hidden"));
  tf.setting("skipFolders", "node_modules", tf.t("setting-skip-folders"));
  const supported = Boolean(tf.panel && tf.pane && tf.fs && tf.viewer);
  const tree = supported ? createFolderTree(tf) : null;
  const unsupported = () => tf.toast(tf.t("needs-newer-tilefold"));
  tf.command(tf.t("cmd-toggle"), () => tree ? tree.toggleShown() : unsupported(), {
    id: "toggle",
    key: { mac: "Ctrl+Alt+T", other: "Ctrl+Alt+Shift+Y" }
  });
  tf.command(tf.t("cmd-refresh"), () => tree ? tree.refresh() : unsupported(), {
    id: "refresh"
  });
  tf.on("pane.cwd", (e) => tree?.paneChanged(e.path ?? null));
  tf.on("panel.click", (e) => tree?.clicked(e));
  tf.on("panel.closed", () => tree?.closed());
  tf.on("setting.changed", () => tree?.settingChanged());
};
export default main_default;
