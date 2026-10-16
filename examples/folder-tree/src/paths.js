/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — paths
 *
 * Plain string helpers for the "/"-separated absolute paths Tilefold gives
 * the tile: tidy a path, join a relative one onto a folder, take a parent
 * or a last part, tell whether one path is inside another and how, and
 * list the folders above a path. No file system here: the tile only ever
 * sees paths, so this is tested directly.
 */

/** `path` with "." and ".." resolved and no doubled or trailing "/". */
export function normalize(path) {
  const text = String(path ?? "");
  const absolute = text.startsWith("/");
  const parts = [];
  for (const part of text.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else if (!absolute) parts.push("..");
      continue;
    }
    parts.push(part);
  }
  const joined = parts.join("/");
  return absolute ? `/${joined}` : joined || ".";
}

/** `rel` joined onto the folder `dir`. */
export const join = (dir, rel) => normalize(`${dir}/${rel}`);

/** The folder `path` is in ("/" for the top). */
export function parent(path) {
  const p = normalize(path);
  const at = p.lastIndexOf("/");
  return at <= 0 ? "/" : p.slice(0, at);
}

/** The last part of `path`. */
export function basename(path) {
  const p = normalize(path);
  return p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1);
}

/** Whether `path` is `dir` or inside it. */
export function isInside(path, dir) {
  const p = normalize(path);
  const d = normalize(dir);
  if (d === "/") return p.startsWith("/");
  return p === d || p.startsWith(`${d}/`);
}

/** `path` relative to `dir` ("" for `dir` itself), or null when outside it. */
export function relativeTo(path, dir) {
  if (!isInside(path, dir)) return null;
  const p = normalize(path);
  const d = normalize(dir);
  if (p === d) return "";
  return d === "/" ? p.slice(1) : p.slice(d.length + 1);
}

/** `path` as shown under `root`: relative when inside it, else whole. */
export function shownPath(path, root) {
  const rel = root ? relativeTo(path, root) : null;
  return rel === null || rel === "" ? normalize(path) : rel;
}

/**
 * A path as shown beside activity: relative to the tree's folder `root`
 * when inside it; otherwise inside the deepest of `places` (the other
 * panes' folders) holding it, after that folder's name ("game/src/a.js");
 * otherwise in full.
 */
export function placedPath(path, root, places = []) {
  const rel = root ? relativeTo(path, root) : null;
  if (rel) return rel;
  const place = places
    .filter((p) => p && relativeTo(path, p))
    .sort((a, b) => b.length - a.length)[0];
  return place ? `${basename(place)}/${relativeTo(path, place)}` : normalize(path);
}

/** The folders above `path`, nearest first, at most `limit`. */
export function ancestors(path, limit = 8) {
  const out = [];
  let p = normalize(path);
  while (p !== "/" && out.length < limit) {
    p = parent(p);
    out.push(p);
  }
  return out;
}
