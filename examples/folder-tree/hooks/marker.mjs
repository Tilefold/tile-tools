/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree hooks — writing markers
 *
 * Leaves one empty file per agent action in `.foldertree` at the top of
 * the project, named so the Folder Tree tile can read the action from the
 * name alone (the tile never reads files):
 *
 *   ft1.<time>.<nonce>.<action>.<pane>.<path>
 *
 * time in base 36 (9 characters), a 4-character nonce, the action letter
 * (r, e, a, d), and the pane's name and the file's project-relative path
 * in base64url. Inside Tilefold the pane part also carries the pane's
 * session, as `<name> ~<TILEFOLD_SESSION_ID>`, so the tile can call the
 * pane by the name the user gave it. A path too long for one name becomes `~NN`: the marker is
 * then a folder of NN files `00.<part>`… holding it, written under a
 * temporary name first so the tile never sees half of it.
 *
 * The same marker can be left in more than one folder (writeMarkers): the
 * project's top and the agent's own folder, so a tree opened in either
 * finds it. It has the same name in each, and the tile counts it once.
 *
 * The folder keeps the newest KEEP markers from the last week; older ones
 * are removed when a new one is written. A `.gitignore` inside keeps them
 * out of the project's commits.
 */
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** The folder markers go in, at the top of a project. */
export const MARKER_DIR = ".foldertree";
/** Marker folders (Folder Tree's and other tiles'), never marked themselves. */
const MARKER_FOLDERS = new Set([MARKER_DIR, ".trailtree"]);
/** Most markers kept. */
export const KEEP = 300;
/** Markers older than this are removed. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Longest base64url path kept in the name itself. */
const INLINE_MAX = 120;
/** Longest part of a long path. */
const CHUNK = 200;
/** Most parts (the tile reads no more). */
const MAX_CHUNKS = 23;
/** Longest pane name, in characters. */
const PANE_CHARS = 32;
/** Longest pane part, in bytes (88 base64url characters, as the tile reads). */
const PANE_BYTES = 66;
/** What a session id looks like (Tilefold's are UUIDs). */
const SESSION_RE = /^[A-Za-z0-9_-]{4,40}$/;
/** Action letters. */
export const ACTIONS = new Set(["r", "e", "a", "d"]);

/** UTF-8 text in base64url (no padding). */
export const b64url = (text) => Buffer.from(String(text), "utf8").toString("base64url");

/** A pane name on one line, at most PANE_CHARS characters ("agent" when empty). */
export function cleanPane(name) {
  const flat = String(name ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...flat].slice(0, PANE_CHARS).join("").trim() || "agent";
}

/**
 * The pane part of a marker's name: the pane's name, and ` ~<session>`
 * when the session looks like one, the name shortened so the whole fits
 * in PANE_BYTES.
 */
export function paneField(pane, session) {
  const suffix = SESSION_RE.test(String(session ?? "")) ? ` ~${session}` : "";
  let name = [...cleanPane(pane)];
  while (name.length > 1 && Buffer.byteLength(`${name.join("")}${suffix}`) > PANE_BYTES) {
    name = name.slice(0, -1);
  }
  return `${name.join("").trim() || "agent"}${suffix}`;
}

/**
 * The project a file belongs to: the nearest folder above `start` holding
 * `.git`; outside a repository, the nearest holding `.foldertree`; or
 * `start` itself when there is neither. A repository wins over a nearer
 * `.foldertree`, because the hook also leaves markers in the agent's own
 * folder, which may be inside the repository.
 */
export function projectRoot(start) {
  let dir = resolve(start);
  let marked = null;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (!marked && existsSync(join(dir, MARKER_DIR))) marked = dir;
    const up = dirname(dir);
    if (up === dir) return marked ?? resolve(start);
    dir = up;
  }
}

/** `file` relative to `root` with "/" between parts, or null when outside it. */
export function relPath(root, file) {
  const rel = relative(root, resolve(root, file));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel.split(sep).join("/");
}

/**
 * The marker's name, and its parts when the path is too long for the
 * name: { name, chunks } (chunks: [] for a plain marker). Null when the
 * path is too long even for parts.
 */
export function markerName({ ts, nonce, action, pane, session = null, rel }) {
  const head = `ft1.${ts.toString(36).padStart(9, "0")}.${nonce}.${action}.${b64url(paneField(pane, session))}`;
  const code = b64url(rel);
  if (code.length <= INLINE_MAX) return { name: `${head}.${code}`, chunks: [] };
  const parts = [];
  for (let i = 0; i < code.length; i += CHUNK) parts.push(code.slice(i, i + CHUNK));
  if (parts.length > MAX_CHUNKS) return null;
  const count = String(parts.length).padStart(2, "0");
  return {
    name: `${head}.~${count}`,
    chunks: parts.map((p, i) => `${String(i).padStart(2, "0")}.${p}`),
  };
}

/** A fresh 4-character nonce. */
const nonce = () => (randomBytes(4).readUInt32BE(0) % 36 ** 4).toString(36).padStart(4, "0");

/** The marker folder at `root`, made (with its .gitignore) when missing. */
function markerDir(root) {
  const dir = join(root, MARKER_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "# Folder Tree's agent activity markers\n*\n");
  return dir;
}

/**
 * Records that `pane` did `action` to `file` in the project at `root`.
 * Returns the marker's name, or null when the file is outside the
 * project or the action unknown.
 */
export function writeMarker(
  root,
  { action, pane, session = null, file, now = Date.now(), id = nonce() },
) {
  if (!ACTIONS.has(action)) return null;
  const rel = relPath(root, file);
  // Markers themselves (anywhere in the path, when a search lists them) are no activity.
  if (rel === null || rel.split("/").some((part) => MARKER_FOLDERS.has(part))) return null;
  const marker = markerName({ ts: now, nonce: id, action, pane, session, rel });
  if (!marker) return null;
  const dir = markerDir(root);
  if (!marker.chunks.length) {
    writeFileSync(join(dir, marker.name), "");
  } else {
    const temp = join(dir, `.tmp-${nonce()}${nonce()}`);
    mkdirSync(temp);
    for (const part of marker.chunks) writeFileSync(join(temp, part), "");
    renameSync(temp, join(dir, marker.name));
  }
  prune(dir, now);
  return marker.name;
}

/**
 * Records one action in each of `roots` the file is inside, with the same
 * time and nonce everywhere (so the tile, which keys events on both and
 * the file, shows it once). Folders that can't be written to are skipped.
 * Returns the markers written, one per folder.
 */
export function writeMarkers(roots, { action, pane, session = null, file, now = Date.now() }) {
  const id = nonce();
  const written = [];
  for (const root of new Set(roots.map((r) => resolve(r)))) {
    try {
      const name = writeMarker(root, { action, pane, session, file, now, id });
      if (name) written.push(name);
    } catch {
      // A folder that can't be written to: the others still get the marker.
    }
  }
  return written;
}

/** A temporary folder this old was left by a hook that stopped half way. */
const STALE_TEMP_MS = 60_000;

/** Removes markers past KEEP or older than MAX_AGE_MS, and stale temporary folders. */
export function prune(dir, now = Date.now()) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return 0;
  }
  const markers = [];
  let removed = 0;
  for (const name of names) {
    const m = /^ft1\.([0-9a-z]{9})\./.exec(name);
    if (m) markers.push({ name, ts: parseInt(m[1], 36) });
    else if (name.startsWith(".tmp-")) {
      // Another hook may be writing this one right now: only old ones go.
      try {
        if (now - statSync(join(dir, name)).mtimeMs < STALE_TEMP_MS) continue;
      } catch {
        continue;
      }
      rmSync(join(dir, name), { recursive: true, force: true });
      removed += 1;
    }
  }
  markers.sort((a, b) => b.ts - a.ts);
  markers.forEach((m, i) => {
    if (i < KEEP && now - m.ts <= MAX_AGE_MS) return;
    rmSync(join(dir, m.name), { recursive: true, force: true });
    removed += 1;
  });
  return removed;
}
