/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — what to show
 *
 * Small pure helpers the tile uses before anything reaches the page:
 * reading the "folders to skip" setting, leaving out hidden names and
 * skipped folders, and naming a folder for the window's title. Nothing
 * here touches `tf`, so it is tested directly.
 */

/** Most names the "folders to skip" setting keeps. */
export const MAX_SKIP = 50;

/** The folder names in the "folders to skip" setting (commas or spaces between). */
export function parseSkip(text) {
  const names = String(text ?? "")
    .split(/[\s,]+/)
    .map((n) => n.trim())
    .filter((n) => n && !n.includes("/") && !n.includes("\\"));
  return new Set(names.slice(0, MAX_SKIP));
}

/**
 * The entries to show: hidden names (starting with ".") only when asked
 * for, and never a folder named in `skip`. Order is kept (folders first,
 * then by name, as Tilefold lists them).
 */
export function visibleEntries(entries, { showHidden = false, skip = new Set() } = {}) {
  return entries.filter((e) => {
    if (!showHidden && e.name.startsWith(".")) return false;
    return !(e.kind === "dir" && skip.has(e.name));
  });
}

/** The last part of a folder's path, for titles ("/" for the top). */
export function folderName(path) {
  const parts = String(path ?? "")
    .split(/[\\/]+/)
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "/";
}
