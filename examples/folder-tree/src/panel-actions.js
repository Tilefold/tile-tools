/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the panel's right-click menus
 *
 * What a right-click offers in the panel (Tilefold 0.1.16 draws the menus
 * from these lists): on a folder, New file, New folder, Rename… and Move to
 * Trash, all about that folder; on a file, Open, Edit, Rename… and Move to
 * Trash; on the empty space under the tree, New file and New folder in the
 * tree's own folder. So every action is about the thing that was clicked.
 * A folder also offers Show only this folder and Pin this folder, and the
 * empty space Pin this folder (or Follow the pane, when pinned). A pinned
 * folder in the Folders section offers Show this folder, Move up, Move
 * down and Unpin; a folder shown without being pinned offers Pin.
 * Only on a Tilefold that can change files; older ones ignore menus. Plain
 * data in and out, so it is tested directly.
 *
 * Modified 2026-11-03 (pinned folders list): Pin this folder on folders,
 *   and the menus of a pinned folder and of a folder shown unpinned.
 */

/** The menu each kind of tree row opens. */
export const ROW_MENU = { dir: "dir", file: "file", link: "file" };

/** The panel's menus, in the user's language, or none where files can't change. */
export function panelMenus(t, canEdit, pinned = false) {
  if (!canEdit) return null;
  const item = (id, key, extra = {}) => ({ id, label: t(key), ...extra });
  const trash = item("trash", "page-trash", { tone: "error" });
  return {
    dir: [
      item("show-only", "menu-show-only"),
      item("pin", "menu-pin"),
      { separator: true },
      item("new-file", "page-new-file"),
      item("new-folder", "page-new-folder"),
      { separator: true },
      item("rename", "menu-rename"),
      trash,
    ],
    file: [
      item("open", "menu-open"),
      item("edit", "page-edit"),
      { separator: true },
      item("rename", "menu-rename"),
      trash,
    ],
    space: [
      item("new-file", "page-new-file"),
      item("new-folder", "page-new-folder"),
      { separator: true },
      pinned ? item("follow", "view-follow") : item("pin", "menu-pin"),
    ],
    pin: [
      item("pin-show", "menu-pin-show"),
      { separator: true },
      item("pin-up", "menu-move-up"),
      item("pin-down", "menu-move-down"),
      { separator: true },
      item("unpin", "menu-unpin"),
    ],
    shown: [item("pin", "menu-pin"), item("follow", "view-follow")],
  };
}
