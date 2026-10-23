/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the panel's file actions
 *
 * A panel has no buttons (Tilefold draws it from rows), so the file
 * changes show as clickable rows above the tree: "New file in src", "New
 * folder in src", and, once a file or folder is chosen, "Rename main.js…"
 * and "Move main.js to Trash". The folder they name follows the row the
 * user last chose (its folder for a file), or the tree's own folder, so it
 * is always clear where a new file goes. Only on a Tilefold that can change
 * files. Plain data in and out, so it is tested directly.
 */
import { parentKey } from "./model.js";
import { folderName } from "./tree.js";

/** The row ids of the actions, and what each does. */
export const ACTION_IDS = {
  "action:new-file": "new-file",
  "action:new-folder": "new-folder",
  "action:rename": "rename",
  "action:trash": "trash",
};

/** The name of the folder changes go to, for the chosen row `target`. */
function targetFolder(tree, target) {
  if (target?.kind === "dir") return folderName(target.path);
  if (target) return folderName(parentKey(tree, target.path) ?? tree.root);
  return folderName(tree.root);
}

/**
 * The action rows and their targets. `chosen` is what the chosen row
 * stands for ({ kind, path }), or null; `clamp(text, max)` keeps labels
 * within Tilefold's limits.
 */
export function actionRows({ t, tree, chosen, canEdit, clamp }) {
  const rows = [];
  const targets = new Map();
  if (!canEdit || !tree.root) return { rows, targets };
  const add = (id, label, extra) => {
    rows.push({ id, label: clamp(label, 256), ...extra });
    targets.set(id, { kind: "action", action: ACTION_IDS[id] });
  };
  const folder = targetFolder(tree, chosen);
  add("action:new-file", `＋ ${t("panel-new-file", { folder })}`, { icon: "none", tone: "accent" });
  add("action:new-folder", `＋ ${t("panel-new-folder", { folder })}`, {
    icon: "none",
    tone: "accent",
  });
  if (chosen && (chosen.kind === "dir" || chosen.kind === "file" || chosen.kind === "link")) {
    const name = folderName(chosen.path);
    add("action:rename", `✎ ${t("panel-rename", { name })}`, { icon: "none" });
    add("action:trash", `🗑 ${t("panel-trash", { name })}`, { icon: "none", tone: "error" });
  }
  return { rows, targets };
}
