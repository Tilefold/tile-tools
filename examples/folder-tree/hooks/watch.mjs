#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree hooks — a folder watcher, for any agent
 *
 *   node hooks/watch.mjs [folder] [--pane "name"]
 *
 * For an agent without hooks: run it in a pane beside the agent, and each
 * file added, changed or deleted in the folder (the current one when left
 * out) is marked for Folder Tree, as `name` (the folder's name when left
 * out). It can't see reads. `.git`, `node_modules` and `.foldertree` are
 * ignored, and a file changing many times in a row is marked once per
 * half second. Stop it with Ctrl+C.
 */
import { statSync, watch } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MARKER_DIR, projectRoot, writeMarkers } from "./marker.mjs";

/** Folders whose changes are never marked. */
export const IGNORED = new Set([".git", "node_modules", MARKER_DIR]);
/** Changes to one file closer together than this are marked once. */
export const SETTLE_MS = 500;

/** Whether a changed path (relative, any separator) is worth marking. */
export const watched = (rel) =>
  !String(rel)
    .split(/[\\/]/)
    .some((part) => IGNORED.has(part));

/**
 * Watches `folder`, marking changes as `pane`. Returns a stop function.
 * `onMark(name)` hears each marker written (for the tests).
 */
export function startWatching(
  folder,
  // No session by default: the watcher runs in a pane beside the agent, not the agent's own.
  { pane, session = null, onMark = () => {} } = {},
) {
  const dir = resolve(folder);
  const root = projectRoot(dir);
  const name = pane || basename(dir);
  /** Files seen to exist, so a new one reads as added. */
  const known = new Set();
  const pending = new Map();

  const mark = (abs) => {
    pending.delete(abs);
    let exists = false;
    try {
      exists = statSync(abs).isFile();
    } catch {
      exists = false;
    }
    const action = !exists ? "d" : known.has(abs) ? "e" : "a";
    if (exists) known.add(abs);
    else known.delete(abs);
    // The project's top and the watched folder, as the agent hook does.
    try {
      for (const written of writeMarkers([root, dir], { action, pane: name, session, file: abs })) {
        onMark(written);
      }
    } catch {
      // A folder that can't be written to: keep watching.
    }
  };

  const watcher = watch(dir, { recursive: true }, (_event, rel) => {
    if (!rel || !watched(rel)) return;
    const abs = join(dir, String(rel));
    // A file that existed before it changed is an edit, not an addition.
    if (!pending.has(abs)) {
      try {
        if (statSync(abs).isFile() && _event === "change") known.add(abs);
      } catch {
        // Gone already: it will read as deleted.
      }
    }
    clearTimeout(pending.get(abs));
    pending.set(
      abs,
      setTimeout(() => mark(abs), SETTLE_MS),
    );
  });
  return () => {
    watcher.close();
    for (const t of pending.values()) clearTimeout(t);
  };
}

// Run as a command (not when imported by the tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--pane");
  const pane = at >= 0 ? args[at + 1] : undefined;
  const folder =
    args.find((a, i) => !a.startsWith("--") && (at < 0 || i !== at + 1)) ?? process.cwd();
  startWatching(folder, { pane });
  console.log(`Folder Tree is watching ${resolve(folder)}. Ctrl+C stops it.`);
}
