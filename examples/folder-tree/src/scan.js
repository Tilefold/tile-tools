/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — finding markers
 *
 * Looks for the `.foldertree` folder the hooks write to, in the tree's
 * folder and the folders above it (an agent may work from the project's
 * top while the pane is further down), and reads the markers' names with
 * `tf.fs.list`. Folders Tilefold won't let the tile list (outside every
 * pane's folder) are not asked again until the tree moves; folders with
 * no markers yet are skipped quietly. A long
 * path's parts never change, so they are listed once and remembered.
 */
import { decodeMarker, joinChunks, MARKER_DIR } from "./marker.js";
import { ancestors, join } from "./paths.js";

/** How many folders above the tree's are searched. */
export const SEARCH_UP = 6;
/** Most long-path folders remembered. */
const CHUNK_CACHE = 1000;
/** Errors that only mean "no markers here". */
const QUIET = new Set(["NotFoundError", "PathNotAllowedError", "NotADirectoryError"]);

/** A scanner for `tf`: `scan(root, now)` → [{ root, marker }]. */
export function createScanner(tf) {
  /** Marker folder name → its path, once read. */
  const chunks = new Map();
  /** Folders Tilefold refused, for the current tree (asked again on a new one). */
  let denied = { root: null, dirs: new Set() };

  /** One folder's markers, or none. */
  const markersIn = async (projectRoot, now) => {
    const dir = join(projectRoot, MARKER_DIR);
    let listing;
    try {
      listing = await tf.fs.list(dir);
    } catch (err) {
      if (err?.name === "PathNotAllowedError") denied.dirs.add(projectRoot);
      if (!QUIET.has(err?.name)) void tf.log.warn(`Folder Tree: ${err?.name}: ${err?.message}`);
      return [];
    }
    const out = [];
    for (const entry of listing.entries) {
      const marker = decodeMarker(entry.name, now);
      if (!marker) continue;
      if (marker.chunks && entry.kind === "dir") {
        marker.path = await longPath(dir, entry.name, marker.chunks);
      }
      if (marker.path) out.push({ root: projectRoot, marker });
    }
    return out;
  };

  /** A long path from its folder of parts (remembered). */
  const longPath = async (dir, name, expected) => {
    const key = `${dir}/${name}`;
    if (chunks.has(key)) return chunks.get(key);
    let path = null;
    try {
      const parts = await tf.fs.list(join(dir, name));
      path = joinChunks(
        parts.entries.map((e) => e.name),
        expected,
      );
    } catch {
      return null;
    }
    // A folder still being written has missing parts: try again next time.
    if (path === null) return null;
    if (chunks.size >= CHUNK_CACHE) chunks.delete(chunks.keys().next().value);
    chunks.set(key, path);
    return path;
  };

  return {
    /** Every marker for the tree at `root` (its folder and those above). */
    async scan(root, now = Date.now()) {
      if (!root) return [];
      if (denied.root !== root) denied = { root, dirs: new Set() };
      const found = [];
      for (const dir of [root, ...ancestors(root, SEARCH_UP)]) {
        if (denied.dirs.has(dir)) continue;
        found.push(...(await markersIn(dir, now)));
      }
      return found;
    },
  };
}
