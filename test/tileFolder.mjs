/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — test tile folders
 *
 * Writes small tiles to temporary folders for the tests and removes them
 * afterwards.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Folders made by `tile` and not yet removed. */
const made = [];

/**
 * A temporary tile folder holding `files` (relative path → text). A
 * tile.json is added unless `files` gives one, or gives `null` for none.
 *
 * @param {Record<string, string | null>} files
 * @returns {string} The folder's absolute path.
 */
export function tile(files) {
  const root = mkdtempSync(join(tmpdir(), "tile-tools-"));
  made.push(root);
  const all = { "tile.json": '{ "id": "test.tile" }', ...files };
  for (const [path, text] of Object.entries(all)) {
    if (text === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** Removes every folder `tile` made. */
export function removeTiles() {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true });
}
