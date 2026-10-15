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
 * in base64url. A path too long for one name becomes `~NN`: the marker is
 * then a folder of NN files `00.<part>`… holding it, written under a
 * temporary name first so the tile never sees half of it.
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
 * The project a file belongs to: the nearest folder above `start` holding
 * `.foldertree` or `.git`, or `start` itself when there is none.
 */
export function projectRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, MARKER_DIR)) || existsSync(join(dir, ".git"))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(start);
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
export function markerName({ ts, nonce, action, pane, rel }) {
  const head = `ft1.${ts.toString(36).padStart(9, "0")}.${nonce}.${action}.${b64url(cleanPane(pane)).slice(0, 88)}`;
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
export function writeMarker(root, { action, pane, file, now = Date.now() }) {
  if (!ACTIONS.has(action)) return null;
  const rel = relPath(root, file);
  if (rel === null || rel.split("/")[0] === MARKER_DIR) return null;
  const marker = markerName({ ts: now, nonce: nonce(), action, pane, rel });
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
