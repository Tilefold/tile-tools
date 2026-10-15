/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — finding markers
 *
 * Looks for the `.foldertree` folders the hooks write to and reads the
 * markers' names with `tf.fs.list`. It looks around every folder it is
 * given: the tree's, and (from Tilefold 0.1.11) every pane's, so agents in
 * all of the user's panes are seen at once. Around each of those folders:
 *
 * - the folder itself and the folders above it (an agent may work from the
 *   project's top while the pane is further down);
 * - the folders below it, because a pane is often in a folder that holds
 *   several projects while an agent works inside one of them: its
 *   subfolders (hidden and dependency folders left out, at most PROBE_MAX)
 *   are looked into every PROBE_MS, and any folder the tree has listed
 *   that has a `.foldertree` in it counts too.
 *
 * Tilefold allows a tile 60 listings every 10 seconds, which opening
 * folders needs too, so each scan lists at most SCAN_BUDGET folders: up
 * to READ_MAX folders known to have markers (the longest unread first),
 * and the rest (at least DISCOVER_MIN) looking for new ones, the longest
 * unasked first: each folder itself and its subfolders before the
 * folders above it. A folder found without
 * markers, or one Tilefold refused, is asked again only after MISSING_MS.
 * A long path's parts never change, so they are listed once and
 * remembered.
 */
import { decodeMarker, joinChunks, MARKER_DIR } from "./marker.js";
import { ancestors, isInside, join } from "./paths.js";

/** How many folders above each folder are searched. */
export const SEARCH_UP = 6;
/** Most listings in one scan (a scan runs every two seconds). */
export const SCAN_BUDGET = 8;
/** Most reads of folders known to have markers in one scan. */
export const READ_MAX = 6;
/** Fewest looks for new marker folders in one scan. */
export const DISCOVER_MIN = 2;
/** Most subfolders of a folder looked into for markers. */
export const PROBE_MAX = 12;
/** How often a folder's subfolders are looked into. */
export const PROBE_MS = 30_000;
/** How long a folder found without markers (or refused) is left alone. */
export const MISSING_MS = 30_000;
/** Subfolders never looked into: dependencies and build output. */
const NOT_PROJECTS = new Set(["node_modules", "target", "dist", "build", "vendor", "Pods"]);
/** Most long-path folders remembered. */
const CHUNK_CACHE = 1000;
/** Errors that only mean "no markers here". */
const QUIET = new Set(["NotFoundError", "PathNotAllowedError", "NotADirectoryError"]);

/** Subfolders of a listing worth looking into for markers. */
const subfoldersOf = (dir, entries) =>
  entries
    .filter((e) => e.kind === "dir" && !e.name.startsWith(".") && !NOT_PROJECTS.has(e.name))
    .slice(0, PROBE_MAX)
    .map((e) => join(dir, e.name));

/**
 * A scanner for `tf`: `scan(root, now, folders, others)` →
 * [{ root, marker }] (root: the folder holding that .foldertree).
 */
export function createScanner(tf) {
  /** Marker folder name → its path, once read. */
  const chunks = new Map();
  /** Folders known to have markers. */
  const marked = new Set();
  /** Folders without markers or refused → when to ask again. */
  const missing = new Map();
  /** When each folder was last read or asked (to take turns). */
  const lastAsked = new Map();
  /** Each looked-around folder → { at, subfolders } from its last look. */
  const probes = new Map();

  /** One folder's markers, or none (and what that says about the folder). */
  const markersIn = async (projectRoot, now) => {
    const dir = join(projectRoot, MARKER_DIR);
    lastAsked.set(projectRoot, now);
    let listing;
    try {
      listing = await tf.fs.list(dir);
    } catch (err) {
      if (QUIET.has(err?.name)) missing.set(projectRoot, now + MISSING_MS);
      else void tf.log.warn(`Folder Tree: ${err?.name}: ${err?.message}`);
      marked.delete(projectRoot);
      return [];
    }
    missing.delete(projectRoot);
    marked.add(projectRoot);
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

  /** Whether `dir` may be asked now (not recently found empty or refused). */
  const askable = (dir, now) => !(missing.get(dir) > now);
  /** Longest unasked first. */
  const byTurn = (a, b) => (lastAsked.get(a) ?? -Infinity) - (lastAsked.get(b) ?? -Infinity);

  /**
   * The subfolders of `dir` to look into, from the tree's listing when it
   * has one, otherwise by listing `dir` (once every PROBE_MS). Returns
   * null when none are due, and counts a listing in `spent`.
   */
  const dueSubfolders = async (dir, now, folders, spent, budget) => {
    const last = probes.get(dir);
    if (last && now - last.at < PROBE_MS) return null;
    let entries = folders[dir]?.entries;
    if (!Array.isArray(entries)) {
      if (spent.n >= budget) return null;
      spent.n += 1;
      try {
        entries = (await tf.fs.list(dir)).entries;
      } catch {
        // Can't list it now: look again later (its own markers are another matter).
        probes.set(dir, { at: now, subfolders: [] });
        return null;
      }
    }
    const subfolders = subfoldersOf(dir, entries);
    probes.set(dir, { at: now, subfolders });
    return subfolders;
  };

  return {
    /**
     * Every marker found now around `root` (the tree's folder) and
     * `others` (the other panes' folders). `folders` is the tree's
     * listings (path → { entries }).
     */
    async scan(root, now = Date.now(), folders = {}, others = []) {
      const places = [...new Set([root, ...others].filter(Boolean))];
      if (!places.length) return [];
      const found = [];
      // Listed folders that hold a .foldertree have markers.
      for (const [path, level] of Object.entries(folders)) {
        if (Array.isArray(level?.entries) && level.entries.some((e) => e.name === MARKER_DIR)) {
          marked.add(path);
        }
      }
      // 1. Folders known to have markers, the longest unread first: those
      // inside one of the places or above it (not ones left behind).
      const near = (dir) => places.some((p) => isInside(dir, p) || isInside(p, dir));
      const reads = [...marked].filter(near).sort(byTurn).slice(0, READ_MAX);
      for (const dir of reads) found.push(...(await markersIn(dir, now)));
      // 2. Looking for new ones with what is left: each place and its
      // subfolders first, then the folders above it (the sort keeps this
      // order among folders never asked).
      const budget = Math.max(DISCOVER_MIN, SCAN_BUDGET - reads.length);
      const spent = { n: 0 };
      const candidates = new Set(places);
      for (const place of places) {
        const subfolders = (await dueSubfolders(place, now, folders, spent, budget)) ?? [];
        for (const dir of subfolders) candidates.add(dir);
        for (const dir of probes.get(place)?.subfolders ?? []) candidates.add(dir);
      }
      for (const place of places) {
        for (const dir of ancestors(place, SEARCH_UP)) candidates.add(dir);
      }
      const due = [...candidates].filter((d) => !marked.has(d) && askable(d, now)).sort(byTurn);
      for (const dir of due) {
        if (spent.n >= budget) break;
        spent.n += 1;
        found.push(...(await markersIn(dir, now)));
      }
      return found;
    },
  };
}
