/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the tile
 *
 * Shows the folder the focused pane is in as a tree, in a panel Tilefold
 * docks beside the panes (`tf.panel`), and keeps it current: it follows
 * the pane (`pane.cwd`), lists a folder the first time it is opened
 * (`tf.fs.list`), and opens a clicked file in the document viewer
 * (`tf.viewer.open`). Tilefold lets it reach only folders the user's panes
 * are in, and draws the panel itself from the rows built in model.js.
 *
 * Clicks arrive as `panel.click` with the row's id and an action:
 * `expand` / `collapse` for folders, `activate` for anything (a folder
 * toggles, a file opens, a link opens or, when it leads to a folder, is
 * listed and opened like one). Errors listing a folder show inside the
 * tree; errors opening a file are a notice. Both are in the user's
 * language; anything unexpected also goes to the tile's log.
 */
import {
  closed,
  emptyTree,
  isLoaded,
  opened,
  startLoading,
  treeRows,
  withError,
  withListing,
} from "./model.js";
import { folderName, parseSkip } from "./tree.js";

/** The message for an error from Tilefold, by its name. */
const ERROR_KEYS = {
  PathNotAllowedError: "error-not-allowed",
  NotFoundError: "error-not-found",
  UnreadableError: "error-unreadable",
  RateLimitError: "error-busy",
};

/** Starts the Folder Tree for `tf`; returns its handlers (for main.js and tests). */
export function createFolderTree(tf) {
  let tree = emptyTree(null);
  /** Whether the panel is shown (the user may close it any time). */
  let shown = false;
  /** Row id → what it stands for, from the last drawing. */
  let targets = new Map();

  /** A short message for an error, in the user's language. */
  const explain = (err) => {
    const key = ERROR_KEYS[err?.name];
    if (!key) void tf.log.warn(`Folder Tree: ${err?.name ?? "Error"}: ${err?.message ?? err}`);
    return tf.t(key ?? "error-other");
  };

  /** Draws the tree in the panel (only while it is shown). */
  const draw = async () => {
    if (!shown) return;
    const built = treeRows(tree, {
      strings: {
        loading: tf.t("row-loading"),
        empty: tf.t("row-empty"),
        truncated: tf.t("row-truncated"),
        noFolder: tf.t("row-no-folder"),
      },
      filters: {
        showHidden: tf.settings.get("showHidden") === true,
        skip: parseSkip(tf.settings.get("skipFolders")),
      },
    });
    targets = built.targets;
    await tf.panel.show({
      title: tree.root ? folderName(tree.root) : tf.t("title-no-folder"),
      ...(tree.root ? { subtitle: tree.root } : {}),
      rows: built.rows,
    });
  };

  /** Lists `path` (showing it open and loading meanwhile). */
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

  /** Starts again from `root`. */
  const start = async (root) => {
    tree = emptyTree(root);
    if (root) await load(root);
    else await draw();
  };

  /** Opens or closes a folder, listing it the first time. */
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

  /** A file, or a link that may lead to a folder. */
  const openFile = async (path, isLink) => {
    try {
      await tf.viewer.open(path);
    } catch (err) {
      if (isLink && err?.name === "NotAFileError") return load(path);
      await tf.toast(explain(err));
    }
    return undefined;
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
    refresh: () => (shown ? start(tree.root) : undefined),
    /** A click (or key) on a row of the panel. */
    async clicked({ row, action } = {}) {
      const target = targets.get(row);
      if (!target) return undefined;
      if (target.kind === "dir") {
        const open = action === "expand" || (action === "activate" && !tree.open.includes(row));
        return toggle(target.path, open);
      }
      if (target.kind === "file" || target.kind === "link") {
        return openFile(target.path, target.kind === "link");
      }
      return undefined;
    },
    /** The focused pane's folder changed. */
    async paneChanged(path) {
      if (path === tree.root) return undefined;
      if (shown) return start(path);
      tree = emptyTree(path);
      return undefined;
    },
    /** A setting changed: draw again with the new filters. */
    settingChanged: () => draw(),
    /** The user closed the panel (or another tile's took its place). */
    closed() {
      shown = false;
    },
  };
}
