/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — finding markers
 *
 * Looks for the `.foldertree` folders the hooks write to and reads the
 * markers' names with `tf.fs.list`:
 *
 * - in the tree's folder and the folders above it (an agent may work from
 *   the project's top while the pane is further down);
 * - below it, because the tree is often opened on a folder that holds
 *   several projects while an agent works inside one of them: any folder
 *   the tree has listed that has a `.foldertree` in it, and the tree
 *   folder's own subfolders, which are looked into every PROBE_MS (at
 *   most PROBE_MAX of them, hidden and dependency folders left out).
 *
 * Tilefold allows a tile a limited number of listings, which opening
 * folders needs too, so a folder found to have no markers is asked again
 * only after MISSING_MS, at most BELOW_MAX folders below are read each
 * time, and folders Tilefold won't let the tile list (outside every
 * pane's folder) are not asked again until the tree moves. A long path's
 * parts never change, so they are listed once and remembered.
 */
import { decodeMarker, joinChunks, MARKER_DIR } from "./marker.js";
import { ancestors, join } from "./paths.js";

/** How many folders above the tree's are searched. */
export const SEARCH_UP = 6;
/** Most folders below the tree's whose markers are read each time. */
export const BELOW_MAX = 8;
/** Most subfolders of the tree's folder looked into for markers. */
export const PROBE_MAX = 12;
/** How often the tree folder's subfolders are looked into. */
export const PROBE_MS = 30_000;
/** How long a folder found without markers is left alone. */
export const MISSING_MS = 30_000;
/** Subfolders never looked into: dependencies and build output. */
const NOT_PROJECTS = new Set(["node_modules", "target", "dist", "build", "vendor", "Pods"]);
/** Most long-path folders remembered. */
const CHUNK_CACHE = 1000;
/** Errors that only mean "no markers here". */
const QUIET = new Set(["NotFoundError", "PathNotAllowedError", "NotADirectoryError"]);

/** A scanner for `tf`: `scan(root, now)` → [{ root, marker }]. */
export function createScanner(tf) {
  /** Marker folder name → its path, once read. */
  const chunks = new Map();
  /**
   * What is known for the current tree (forgotten when it moves): folders
   * Tilefold refused, folders without markers (→ when to ask again),
   * folders below with markers, and when the subfolders were last looked
   * into.
   */
  let known = fresh(null);

  /** One folder's markers, or none (and what that says about the folder). */
  const markersIn = async (projectRoot, now) => {
    const dir = join(projectRoot, MARKER_DIR);
    let listing;
    try {
      listing = await tf.fs.list(dir);
    } catch (err) {
      if (err?.name === "PathNotAllowedError") known.denied.add(projectRoot);
      else if (QUIET.has(err?.name)) known.missing.set(projectRoot, now + MISSING_MS);
      if (!QUIET.has(err?.name)) void tf.log.warn(`Folder Tree: ${err?.name}: ${err?.message}`);
      known.below.delete(projectRoot);
      return [];
    }
    known.missing.delete(projectRoot);
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

  /** Whether `dir` is worth asking now (not refused, not recently empty). */
  const askable = (dir, now) => !known.denied.has(dir) && !(known.missing.get(dir) > now);

  return {
    /**
     * Every marker for the tree at `root`: its folder, those above, and
     * those below it with markers. `folders` is the tree's listings
     * (path → { entries }), for finding folders below.
     */
    async scan(root, now = Date.now(), folders = {}) {
      if (!root) return [];
      if (known.root !== root) known = fresh(root);
      const found = [];
      // The tree's own folder is always asked: an agent may start there any time.
      found.push(...(await markersIn(root, now)));
      for (const dir of ancestors(root, SEARCH_UP)) {
        if (askable(dir, now)) found.push(...(await markersIn(dir, now)));
      }
      // Listed folders that hold a .foldertree are folders below with markers.
      for (const [path, level] of Object.entries(folders)) {
        if (path === root || !Array.isArray(level?.entries)) continue;
        if (level.entries.some((e) => e.name === MARKER_DIR && e.kind === "dir")) {
          known.below.add(path);
        }
      }
      // Now and then, the tree folder's subfolders are looked into.
      if (now - known.probed >= PROBE_MS && Array.isArray(folders[root]?.entries)) {
        known.probed = now;
        const subfolders = folders[root].entries
          .filter((e) => e.kind === "dir" && !e.name.startsWith(".") && !NOT_PROJECTS.has(e.name))
          .slice(0, PROBE_MAX)
          .map((e) => join(root, e.name));
        for (const dir of subfolders) {
          if (known.below.has(dir) || !askable(dir, now)) continue;
          const markers = await markersIn(dir, now);
          if (!known.missing.has(dir) && !known.denied.has(dir)) known.below.add(dir);
          found.push(...markers);
        }
      }
      let read = 0;
      for (const dir of known.below) {
        if (read >= BELOW_MAX) break;
        if (found.some((f) => f.root === dir) || !askable(dir, now)) continue;
        read += 1;
        found.push(...(await markersIn(dir, now)));
      }
      return found;
    },
  };
}

/** Nothing known yet about the tree at `root`. */
const fresh = (root) => ({
  root,
  denied: new Set(),
  missing: new Map(),
  below: new Set(),
  probed: -Infinity,
});
