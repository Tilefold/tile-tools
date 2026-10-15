/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree hooks — what a shell command really changed and read
 *
 * Guessing from a command's text misses most of what agents do in a shell
 * (a script that rewrites ten files names none of them). So the hook takes
 * a stamp just before the command runs (PreToolUse) and, once it has run
 * (PostToolUse), looks for the files under the project changed since the
 * stamp: those are the command's edits, or additions when they were made
 * after it too. Search commands (rg, grep, find, fd, git grep, git
 * ls-files) print the files they found; those count as read.
 *
 * Stamps are empty files in the system's temporary folder, one per tool
 * call, named by the call's id and removed when the call ends; any left
 * behind by a call that never ended are removed after STAMP_MAX_AGE_MS.
 * The scan skips folders that only hold tools' output (PRUNE) and stops
 * after MAX_CHANGED files, MAX_SEEN entries or SCAN_BUDGET_MS.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

/** Where stamps are kept. */
export const STAMP_DIR = join(tmpdir(), "foldertree-stamps");
/** A stamp this old belongs to a call that never ended. */
export const STAMP_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Folders never scanned: version control, dependencies, build output, markers. */
export const PRUNE = Object.freeze([
  ".git",
  ".hg",
  ".svn",
  ".foldertree",
  ".trailtree",
  ".worktrees",
  "node_modules",
  "target",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
  ".dart_tool",
  "Pods",
]);
/** Most changed files taken from one command. */
export const MAX_CHANGED = 40;
/** Most entries the scan looks at (the walker; find has its own time limit). */
export const MAX_SEEN = 60_000;
/** Longest a scan may take. */
export const SCAN_BUDGET_MS = 4000;
/** Commands whose output lists files they found. */
const SEARCHERS = new Set(["rg", "grep", "egrep", "fgrep", "ag", "ack", "find", "fd", "fdfind"]);
/** Most found files taken from one command's output. */
const MAX_FOUND = 30;

/** The stamp file for a tool call (null without an id). */
export function stampPath(id, dir = STAMP_DIR) {
  const name = String(id ?? "")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 120);
  return name ? join(dir, name) : null;
}

/**
 * Takes the stamp for call `id` at `now`, and clears stamps left behind.
 * Returns the stamp's path, or null when there is no id or no room.
 */
export function startStamp(id, { dir = STAMP_DIR, now = Date.now() } = {}) {
  const file = stampPath(id, dir);
  if (!file) return null;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, "");
    utimesSync(file, now / 1000, now / 1000);
    clearStale(dir, now);
    return file;
  } catch {
    return null;
  }
}

/** The time of call `id`'s stamp, removing it; null when there is none. */
export function takeStamp(id, { dir = STAMP_DIR } = {}) {
  const file = stampPath(id, dir);
  if (!file) return null;
  try {
    const ms = statSync(file).mtimeMs;
    rmSync(file, { force: true });
    return ms;
  } catch {
    return null;
  }
}

/** Removes stamps older than STAMP_MAX_AGE_MS. */
function clearStale(dir, now) {
  for (const name of readdirSync(dir)) {
    try {
      if (now - statSync(join(dir, name)).mtimeMs > STAMP_MAX_AGE_MS) {
        rmSync(join(dir, name), { force: true });
      }
    } catch {
      // Gone already, or another hook's: leave it.
    }
  }
}

/** Whether a file born at `ms` was made after `since` (some systems report 0). */
const born = (ms, since) => Number.isFinite(ms) && ms > 0 && ms > since;

/**
 * Files under `root` changed at or after `since`, as [{ file, made }]
 * (made: the file itself is new since then). Uses `find` where there is
 * one, walking the folders itself otherwise or when told to (`walk`).
 */
export function changedSince(root, since, { walk = process.platform === "win32" } = {}) {
  const found = walk ? walkChanged(root, since) : findChanged(root, since);
  const out = [];
  for (const file of found) {
    try {
      const st = statSync(file);
      if (!st.isFile()) continue;
      out.push({ file, made: born(st.birthtimeMs, since) });
    } catch {
      // Removed again since: nothing to mark.
    }
    if (out.length >= MAX_CHANGED) break;
  }
  return out;
}

/** `find` for files newer than `since` under `root`, pruning PRUNE. */
function findChanged(root, since) {
  const prune = PRUNE.flatMap((name, i) => (i ? ["-o", "-name", name] : ["-name", name]));
  // find compares whole seconds with -newermt on some systems, so it is
  // given a reference file instead, dated `since`.
  const ref = startStamp(`scan-${process.pid}-${since}`, { now: since });
  if (!ref) return walkChanged(root, since);
  try {
    const run = spawnSync(
      "find",
      [
        "-H",
        root,
        "-xdev",
        "-mindepth",
        "1",
        "(",
        ...prune,
        ")",
        "-prune",
        "-o",
        "-type",
        "f",
        "-newer",
        ref,
        "-print0",
      ],
      { encoding: "utf8", timeout: SCAN_BUDGET_MS, maxBuffer: 4 * 1024 * 1024 },
    );
    if (run.error && run.error.code === "ENOENT") return walkChanged(root, since);
    return String(run.stdout ?? "")
      .split("\0")
      .filter(Boolean)
      .slice(0, MAX_CHANGED * 2);
  } finally {
    rmSync(ref, { force: true });
  }
}

/** The same as findChanged, by walking the folders (Windows, tests). */
export function walkChanged(root, since, { now = Date.now } = {}) {
  const skip = new Set(PRUNE);
  const stop = now() + SCAN_BUDGET_MS;
  const out = [];
  let seen = 0;
  const queue = [root];
  while (queue.length && out.length < MAX_CHANGED * 2) {
    const dir = queue.shift();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (++seen > MAX_SEEN || now() > stop) return out;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) queue.push(path);
      } else if (entry.isFile()) {
        try {
          if (statSync(path).mtimeMs >= since) out.push(path);
        } catch {
          // Gone: skip.
        }
      }
    }
  }
  return out;
}

/** The command word of a simple part, without env assignments or a path. */
function head(part) {
  const tokens = part.trim().split(/\s+/);
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  const [cmd = "", sub = ""] = tokens;
  const name = cmd.split("/").pop();
  return name === "git" ? `git ${sub}` : name;
}

/**
 * Files a search command printed, as absolute paths: each output line's
 * path (up to the first `:` that a line number follows, for grep -n and
 * rg output) when the command is a search and the path is a file that
 * `isFile` confirms.
 */
export function outputReads(command, stdout, dir, isFile) {
  const searched = String(command ?? "")
    .split(/&&|\|\||;|\||\n/)
    .some((part) => SEARCHERS.has(head(part)) || ["git grep", "git ls-files"].includes(head(part)));
  if (!searched || typeof stdout !== "string" || !stdout) return [];
  const out = new Set();
  for (const line of stdout.split("\n").slice(0, 400)) {
    const m = /^([^\0:]+?)(?::\d+[:-]|:|$)/.exec(line.trim());
    const path = m?.[1]?.trim();
    if (!path || path.length > 1024) continue;
    const abs = isAbsolute(path) ? path : resolve(dir, path);
    if (!out.has(abs) && isFile(abs)) out.add(abs);
    if (out.size >= MAX_FOUND) break;
  }
  return [...out];
}
