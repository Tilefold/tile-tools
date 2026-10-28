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
 * Only on a Tilefold that can change files; older ones ignore menus. Plain
 * data in and out, so it is tested directly.
 */

/** The menu each kind of tree row opens. */
export const ROW_MENU = { dir: "dir", file: "file", link: "file" };

/** The panel's menus, in the user's language, or none where files can't change. */
export function panelMenus(t, canEdit) {
  if (!canEdit) return null;
  const item = (id, key, extra = {}) => ({ id, label: t(key), ...extra });
  const trash = item("trash", "page-trash", { tone: "error" });
  return {
    dir: [
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
    space: [item("new-file", "page-new-file"), item("new-folder", "page-new-folder")],
  };
}
