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
import { createFolderTree } from "./session.js";

export default (tf) => {
  tf.setting("showHidden", false, tf.t("setting-show-hidden"));
  tf.setting("skipFolders", "node_modules", tf.t("setting-skip-folders"));

  // An older Tilefold has no panels or folder access: say so instead of failing.
  const supported = Boolean(tf.panel && tf.pane && tf.fs && tf.viewer);
  const tree = supported ? createFolderTree(tf) : null;
  const unsupported = () => tf.toast(tf.t("needs-newer-tilefold"));

  tf.command(tf.t("cmd-toggle"), () => (tree ? tree.toggleShown() : unsupported()), {
    id: "toggle",
    key: { mac: "Ctrl+Alt+T", other: "Ctrl+Alt+Y" },
  });
  tf.command(tf.t("cmd-refresh"), () => (tree ? tree.refresh() : unsupported()), {
    id: "refresh",
  });
  tf.on("pane.cwd", (e) => tree?.paneChanged(e.path ?? null));
  tf.on("panel.click", (e) => tree?.clicked(e));
  tf.on("panel.closed", () => tree?.closed());
  tf.on("setting.changed", () => tree?.settingChanged());
};
