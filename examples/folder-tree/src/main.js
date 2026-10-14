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
import { createFolderTree } from "./session.js";

export default (tf) => {
  tf.setting("showHidden", false, tf.t("setting-show-hidden"));
  tf.setting("skipFolders", "node_modules", tf.t("setting-skip-folders"));

  // An older Tilefold has no folder access or pages: say so instead of failing.
  const supported = Boolean(tf.pane && tf.fs && tf.viewer && tf.page);
  const tree = supported ? createFolderTree(tf) : null;

  tf.command(
    tf.t("cmd-show"),
    () => (tree ? tree.show() : tf.toast(tf.t("needs-newer-tilefold"))),
    { id: "show" },
  );
  tf.on("pane.cwd", (e) => tree?.paneChanged(e.path ?? null));
  tf.on("page.message", (e) => tree?.fromPage(e.message));
  tf.on("page.closed", () => tree?.closed());
  tf.on("setting.changed", () => tree?.settingChanged());
};
