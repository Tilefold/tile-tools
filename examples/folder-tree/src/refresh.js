/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — keeping the tree current
 *
 * Files and folders an agent (or anyone) adds, renames or removes show up
 * by themselves: while the tree is showing, the folders it shows (its own
 * folder and every open one) are listed again every RELIST_MS, and the tree
 * is drawn again only when a listing changed. Open folders stay open and
 * nothing flickers. The Refresh button in the panel's header (and the
 * Refresh command) does the same at once. At most MAX_RELIST folders are
 * listed in one go, the folder itself first, so a tree with very many open
 * folders doesn't keep the disk busy; a folder that can't be listed any
 * more shows why.
 *
 * @module folder-tree/refresh
 */
import { withError, withListing } from "./model.js";

/** How often the shown folders are listed again, in ms. */
export const RELIST_MS = 5000;
/** Most folders listed again in one go. */
export const MAX_RELIST = 40;

/** The folders the tree shows (its own first, then the open ones), at most `max`. */
export function shownFolders(tree, max = MAX_RELIST) {
  const keys = Object.keys(tree.folders);
  const root = tree.root && keys.includes(tree.root) ? [tree.root] : [];
  const open = keys.filter((k) => k !== tree.root && tree.open.includes(k));
  return [...root, ...open].slice(0, max);
}

/** True when two listings of a folder show the same (names, kinds, cut short). */
export function sameLevel(a, b) {
  if (!a || !b) return a === b;
  if (a.error !== undefined || b.error !== undefined) return a.error === b.error;
  if (!!a.truncated !== !!b.truncated) return false;
  const sig = (level) =>
    (level.entries ?? [])
      .map((e) => `${e.kind ?? ""}\u0000${e.name}`)
      .sort()
      .join("\u0001");
  return sig(a) === sig(b);
}

/**
 * Lists `tree`'s shown folders again with `list` (tf.fs.list); resolves to
 * the new tree, or the same one when nothing changed. `explain` turns an
 * error into the text shown.
 */
export async function relistShown(tree, list, explain) {
  let next = tree;
  for (const key of shownFolders(tree)) {
    let level;
    try {
      level = withListing(next, key, await list(key));
    } catch (err) {
      level = withError(next, key, explain(err));
    }
    if (!sameLevel(next.folders[key], level.folders[key])) next = level;
  }
  return next;
}
