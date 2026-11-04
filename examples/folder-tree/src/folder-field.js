/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the folder field
 *
 * On a Tilefold that lets tiles ask for folders, the Folders section starts
 * with a field Tilefold draws: the user types or pastes a folder's path and
 * presses Enter, or picks one with Browse…; Tilefold gives that folder to
 * the tile and tells it (`panel.input`), and the folder is pinned. The tile
 * never sees what is typed before Enter. The folders given are kept (at
 * most MAX_GRANTED, checked when read back) so the tree knows it may reach
 * them, like a pane's folder. Plain data in and out, so it is tested
 * directly.
 */
import { usable } from "./view.js";

/** The field's row id. */
export const FIELD_ROW = "pins-add";
/** Where the folders given are kept. */
export const GRANTED_KEY = "granted";
/** Most folders kept (as many as Tilefold gives one tile). */
export const MAX_GRANTED = 12;

/** The folders given, as kept: usable paths only, each once, the newest last, at most MAX_GRANTED. */
export function restoreGranted(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const p of saved) if (usable(p) && !out.includes(p)) out.push(p);
  return out.slice(-MAX_GRANTED);
}

/** The field's row, in `t`'s words. */
export function fieldRow(t) {
  return {
    id: FIELD_ROW,
    label: t("pins-add-label"),
    depth: 1,
    input: { kind: "folder", placeholder: t("pins-add-placeholder"), browse: true },
  };
}
