/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the tree
 *
 * What the tree knows, as plain data, and the steps that change it: start
 * from a folder, mark a folder loading, store its listing (or the error
 * that came instead), open and close it. `treeRows` turns it into the rows
 * Tilefold draws in the panel (folders open or closed, files, links, and
 * quiet notes for loading, empty, cut-short and failed folders), plus a
 * map from each row's id to what it stands for, for clicks; `decorate`
 * may add to each folder and file row (the activity marks). No `tf` here,
 * so it is tested directly.
 *
 * Folders are kept by the path that was asked for; child paths are built
 * from the path Tilefold returned (links resolved). `parentKey` finds the
 * folder an entry was listed in, for listing it again after a change.
 *
 * Modified 2026-10-23 (changing files): `parentKey`, the folder an entry
 *   was listed in.
 *
 * Last updated by: Tilefold
 */
import { visibleEntries } from "./tree.js";

/** A tree starting at `root` (null: no folder known), nothing loaded. */
export function emptyTree(root) {
  return { root, folders: {}, open: [], loading: [] };
}

/** The path of `name` inside `dir`, with the separator `dir` already uses. */
export function childPath(dir, name) {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

const without = (list, item) => list.filter((x) => x !== item);
const adding = (list, item) => (list.includes(item) ? list : [...list, item]);

/** `path` is being listed: shown open, with a loading note. */
export function startLoading(tree, path) {
  return { ...tree, open: adding(tree.open, path), loading: adding(tree.loading, path) };
}

/** `path` was listed. */
export function withListing(tree, path, listing) {
  const level = {
    path: listing.path ?? path,
    entries: listing.entries,
    truncated: !!listing.truncated,
  };
  return {
    ...tree,
    folders: { ...tree.folders, [path]: level },
    loading: without(tree.loading, path),
  };
}

/** Listing `path` failed with this message. */
export function withError(tree, path, message) {
  return {
    ...tree,
    folders: { ...tree.folders, [path]: { error: message } },
    loading: without(tree.loading, path),
  };
}

/** Opens a folder that is already loaded. */
export const opened = (tree, path) => ({ ...tree, open: adding(tree.open, path) });
/** Closes a folder. */
export const closed = (tree, path) => ({ ...tree, open: without(tree.open, path) });
/** Whether `path` has been listed (or failed). */
export const isLoaded = (tree, path) => path in tree.folders;

/** The key of the listed folder that holds entry `path`, or null. */
export function parentKey(tree, path) {
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? "";
  for (const [key, level] of Object.entries(tree.folders)) {
    if (level.path && childPath(level.path, name) === path) return key;
  }
  return null;
}

/**
 * The panel rows for the tree, and `targets`: row id → { kind, path } for
 * folders, files and links (notes aren't clickable). `strings` holds the
 * notes' text (loading, empty, truncated, noFolder); `filters` what to
 * leave out (see tree.js); `decorate(row, { kind, path, open })`, when
 * given, returns fields to add to a folder's or file's row.
 */
export function treeRows(tree, { strings, filters, decorate = null }) {
  const rows = [];
  const targets = new Map();
  const note = (key, depth, icon, label) =>
    rows.push({ id: `note:${key}`, label, icon, depth, muted: true });

  const walk = (path, depth) => {
    const level = tree.folders[path];
    if (!level) {
      if (tree.loading.includes(path)) note(`${path}:loading`, depth, "loading", strings.loading);
      return;
    }
    if (level.error !== undefined) return note(`${path}:error`, depth, "error", level.error);
    const entries = visibleEntries(level.entries, filters);
    if (entries.length === 0) note(`${path}:empty`, depth, "info", strings.empty);
    for (const entry of entries) {
      const child = childPath(level.path, entry.name);
      const isOpen = tree.open.includes(child);
      // A link that turned out to be a folder opens like one.
      const folderLike = entry.kind === "dir" || (entry.kind === "link" && isLoaded(tree, child));
      const row = {
        id: child,
        label: entry.name,
        icon: entry.kind === "dir" ? "folder" : entry.kind === "link" ? "link" : "file",
        depth,
        expandable: folderLike,
        expanded: folderLike && isOpen,
        hint: child,
      };
      const kind = folderLike ? "dir" : entry.kind;
      rows.push(decorate ? { ...row, ...decorate(row, { kind, path: child, open: isOpen }) } : row);
      targets.set(child, { kind, path: child });
      if (folderLike && isOpen) walk(child, depth + 1);
    }
    if (level.truncated) note(`${path}:truncated`, depth, "info", strings.truncated);
    return undefined;
  };

  if (tree.root) walk(tree.root, 0);
  else note("no-folder", 0, "info", strings.noFolder);
  return { rows, targets };
}
