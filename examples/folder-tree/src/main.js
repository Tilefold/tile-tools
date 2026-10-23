/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree
 *
 * The folder the focused pane is in, as a tree in a panel docked beside
 * your panes, with what your coding agents are doing on it: the files
 * they are reading, editing, adding and deleting pulse in the action's
 * colour with the pane's name, busy folders say how many, and the recent
 * files sit pinned at the bottom of the panel. Click a file to read it in
 * Tilefold's document viewer, which opens right next to the tree. The
 * tree follows you when you switch panes or `cd` elsewhere, and opens in a
 * window of its own too.
 *
 * Agents report through small hooks (Claude Code, Codex) or a folder
 * watcher, in hooks/, which leave empty marker files whose names say what
 * happened; the tile only ever reads names, never what is in a file.
 *
 * It shows what a tile can do from Tilefold 0.1.11 on, each with a
 * permission and a reason:
 * - a docked panel Tilefold draws from rows, with sections, colours,
 *   pulses and a pinned footer (`tf.panel`, `window.panel`);
 * - `tf.pane.cwd()` and the `pane.cwd` event (`pane.cwd`);
 * - `tf.pane.list()` and the `pane.list` event (`pane.list`, Tilefold
 *   0.1.11): every pane's folder and the name the user gave it;
 * - `tf.fs.list` for one level of names, never file contents (`fs.list`);
 * - `tf.viewer.open` to show a file (`viewer.open`);
 * - a page in a window of its own (`tf.page`, `page`);
 * - from Tilefold 0.1.16, new files and folders, renames, moves and the
 *   Trash (`tf.fs.create`, `mkdir`, `rename`, `move`, `trash`; `fs.write`),
 *   with new files opened ready to edit (`tf.viewer.open(path, { edit })`).
 * On Tilefold 0.1.9 and 0.1.10 the panel shows the tree without the
 * colours and the pinned Recent list; the window has everything.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 *
 * Modified 2026-10-23 (changing files): New file, New folder, Rename and
 *   Move to Trash commands, and the panel's right-click menus (panel.menu).
 *
 * Last updated by: Tilefold
 */
import { createFolderTree } from "./session.js";

export default (tf) => {
  tf.setting("showActivity", true, tf.t("setting-show-activity"));
  tf.setting("activeSeconds", 20, tf.t("setting-active-seconds"));
  tf.setting("recentMinutes", 30, tf.t("setting-recent-minutes"));
  tf.setting("showHidden", false, tf.t("setting-show-hidden"));
  tf.setting("skipFolders", "node_modules", tf.t("setting-skip-folders"));

  // An older Tilefold has no panels or folder access: say so instead of failing.
  const supported = Boolean(tf.panel && tf.pane && tf.fs && tf.viewer);
  const tree = supported ? createFolderTree(tf) : null;
  const unsupported = () => tf.toast(tf.t("needs-newer-tilefold"));

  tf.command(tf.t("cmd-toggle"), () => (tree ? tree.toggleShown() : unsupported()), {
    id: "toggle",
    key: { mac: "Ctrl+Alt+T", other: "Ctrl+Alt+Shift+Y" },
  });
  tf.command(tf.t("cmd-window"), () => (tree ? tree.openWindow() : unsupported()), {
    id: "window",
  });
  tf.command(tf.t("cmd-setup"), () => (tree ? tree.openWindow(true) : unsupported()), {
    id: "setup",
  });
  tf.command(tf.t("cmd-refresh"), () => (tree ? tree.refresh() : unsupported()), {
    id: "refresh",
  });
  // Changing files (Tilefold 0.1.16, fs.write): where the user last chose in the tree.
  tf.command(tf.t("cmd-new-file"), () => (tree ? tree.newFile() : unsupported()), {
    id: "new-file",
  });
  tf.command(tf.t("cmd-new-folder"), () => (tree ? tree.newFolder() : unsupported()), {
    id: "new-folder",
  });
  tf.command(tf.t("cmd-rename"), () => (tree ? tree.renameSelected() : unsupported()), {
    id: "rename",
  });
  tf.command(tf.t("cmd-trash"), () => (tree ? tree.trashSelected() : unsupported()), {
    id: "trash",
  });
  tf.on("pane.cwd", (e) => tree?.paneChanged(e.path ?? null));
  tf.on("pane.list", (e) => tree?.panesChanged(e.panes));
  tf.on("panel.click", (e) => tree?.clicked(e));
  tf.on("panel.closed", () => tree?.closed());
  tf.on("panel.menu", (e) => tree?.menuChosen(e));
  tf.on("page.message", (e) => tree?.message(e));
  tf.on("page.closed", () => tree?.pageClosed());
  tf.on("setting.changed", () => tree?.settingChanged());
};
