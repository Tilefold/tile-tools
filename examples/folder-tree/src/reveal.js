/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — showing the viewer's file
 *
 * When Tilefold's document viewer shows a file (`viewer.opened`, Tilefold
 * 0.1.26: you clicked it, or an AI agent opened it to point at something),
 * the tree opens the folders down to it, listing any it hasn't yet, and
 * chooses the file, so you see where it lives. Only a file inside the
 * folder the tree shows counts; a tree pinned elsewhere, or not showing,
 * stays as it is.
 */
import { isLoaded, opened } from "./model.js";

/**
 * The folders from `root` down to the folder holding `file`, top first;
 * null when `file` isn't inside `root`.
 */
export function foldersTo(root, file) {
  if (!root || typeof file !== "string") return null;
  const base = root.endsWith("/") ? root : `${root}/`;
  if (!file.startsWith(base)) return null;
  const parts = file.slice(base.length).split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  const out = [root];
  let at = root;
  for (const name of parts.slice(0, -1)) {
    at = `${at.endsWith("/") ? at : `${at}/`}${name}`;
    out.push(at);
  }
  return out;
}

/**
 * Opens the folders down to `file` and chooses it. `ctx` reaches the
 * tile's tree: `tree()` and `setTree(next)`, `load(path)` (lists a folder,
 * showing it open), `select(path)`, `draw()` and `showing()`.
 */
export async function revealFile(ctx, file) {
  if (!ctx.showing()) return false;
  const folders = foldersTo(ctx.tree().root, file);
  if (!folders) return false;
  for (const folder of folders) {
    if (isLoaded(ctx.tree(), folder)) ctx.setTree(opened(ctx.tree(), folder));
    else await ctx.load(folder);
  }
  ctx.select(file);
  await ctx.draw();
  return true;
}
