/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — activity markers
 *
 * A tile may list the names in a folder but never read a file, so agents
 * report what they do in names. The hooks in hooks/ leave one empty file
 * per action in a `.foldertree` folder at the top of the project:
 *
 *   ft1.<time>.<nonce>.<action>.<pane>.<path>
 *
 * - time: milliseconds since 1970 in base 36, 9 characters;
 * - nonce: 4 base-36 characters, so two actions in one millisecond differ;
 * - action: r (read), e (edit), a (add) or d (delete);
 * - pane: the pane's (or agent's) name, UTF-8 in base64url;
 * - path: the file's path relative to the project, UTF-8 in base64url.
 *
 * A path too long for one name is left as `~NN` instead, and the marker
 * is a folder holding NN files `00.<part>`, `01.<part>`… whose parts
 * joined are the path. This module only reads names, so it is tested
 * directly; hooks/marker.mjs writes them.
 */

/** The folder markers are kept in, at the top of a project. */
export const MARKER_DIR = ".foldertree";
/** What a marker's action letter means. */
export const ACTIONS = Object.freeze({ r: "read", e: "edit", a: "add", d: "delete" });
/** Most parts a long path is split into. */
export const MAX_CHUNKS = 23;
/** Longest pane name kept, in characters. */
export const PANE_CHARS = 32;
/** The pane name used when a marker's is empty. */
export const DEFAULT_PANE = "agent";
/** How far ahead of now a marker's time may be (clock drift). */
const MAX_FUTURE_MS = 60_000;

const MARKER_RE =
  /^ft1\.([0-9a-z]{9})\.([0-9a-z]{4})\.([a-z])\.([A-Za-z0-9_-]{1,88})\.(~\d{2}|[A-Za-z0-9_-]+)$/;
const CHUNK_RE = /^(\d{2})\.([A-Za-z0-9_-]{1,240})$/;

/** UTF-8 text from base64url, or throws. */
export function fromB64url(code) {
  if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) throw new Error("not base64url");
  const padded = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** A pane name on one line, at most PANE_CHARS characters. */
export function cleanPane(name) {
  const flat = String(name ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...flat].slice(0, PANE_CHARS).join("").trim() || DEFAULT_PANE;
}

/**
 * A relative path with "." and ".." resolved, or null when it is empty,
 * absolute or climbs out of the project.
 */
export function cleanRelPath(path) {
  const text = String(path ?? "").replace(/\\/g, "/");
  if (!text || text.includes("\0") || text.startsWith("/") || /^[A-Za-z]:\//.test(text)) {
    return null;
  }
  const parts = [];
  for (const part of text.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

/** A pane part's name and session: `<name> ~<session>`, or just a name. */
const SESSION_PART = /^(.*) ~([A-Za-z0-9_-]{4,40})$/;

/** Splits a pane part into { pane, session } (session null when there is none). */
export function splitPane(text) {
  const m = SESSION_PART.exec(String(text ?? ""));
  return m ? { pane: cleanPane(m[1]), session: m[2] } : { pane: cleanPane(text), session: null };
}

/**
 * A marker's name read, or null when it isn't one (or is from the future):
 * { ts, nonce, action, pane, session, path, chunks }. `path` is null and `chunks`
 * the count when the path is in a folder of parts (see joinChunks).
 */
export function decodeMarker(name, now = Date.now()) {
  const m = MARKER_RE.exec(String(name ?? ""));
  if (!m) return null;
  const [, tsCode, nonce, letter, paneCode, target] = m;
  const ts = parseInt(tsCode, 36);
  if (!Number.isFinite(ts) || ts > now + MAX_FUTURE_MS) return null;
  // An action letter from a newer hook reads as an edit.
  const action = letter in ACTIONS ? letter : "e";
  let pane;
  let session;
  try {
    ({ pane, session } = splitPane(fromB64url(paneCode)));
  } catch {
    return null;
  }
  if (target.startsWith("~")) {
    const chunks = Number(target.slice(1));
    if (chunks < 1 || chunks > MAX_CHUNKS) return null;
    return { ts, nonce, action, pane, session, path: null, chunks };
  }
  let path;
  try {
    path = cleanRelPath(fromB64url(target));
  } catch {
    return null;
  }
  return path === null ? null : { ts, nonce, action, pane, session, path, chunks: 0 };
}

/** The path from a marker folder's part names, or null when parts are missing. */
export function joinChunks(names, expected) {
  const parts = [];
  for (const name of names) {
    const m = CHUNK_RE.exec(name);
    if (m) parts[Number(m[1])] = m[2];
  }
  if (parts.length !== expected) return null;
  for (let i = 0; i < expected; i++) if (parts[i] === undefined) return null;
  try {
    return cleanRelPath(fromB64url(parts.join("")));
  } catch {
    return null;
  }
}
