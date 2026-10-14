/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — bundling a tile's page script
 *
 * A tile page opened with a web address (`tf.page.open({ origin: "https" })`)
 * is put together by Tilefold as one self-contained document: its scripts
 * are inlined, and it can't load any other file of the page folder, so a
 * module can't import its neighbours at run time. A tile that wants to
 * write its page code as several files keeps them in `page-src/`, with the
 * entry `page-src/main.ts` or `page-src/main.js`, and the build bundles them
 * into the one `page/main.js` the page's HTML names. Tiles without
 * `page-src/` are left as they are.
 *
 * The bundle is a plain script (an immediately run function), so it works
 * as `<script src>` and as `<script type="module" src>` alike, and keeps the
 * entry's opening comment (the copyright notice) at the top.
 *
 * @module @tilefold/tile-tools/page
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as esbuild from "esbuild";
import { TileBuildError, displayPath, formatMessages, leadingComment } from "./bundle.mjs";

/** Page entry files looked for, in order. */
export const PAGE_ENTRY_CANDIDATES = ["page-src/main.ts", "page-src/main.js"];

/** The page script a build writes, relative to the tile folder. */
export const PAGE_OUTPUT = "page/main.js";

/**
 * The absolute path of the tile's page entry, or null when it has none.
 *
 * @param {string} folder The tile folder.
 * @returns {string | null}
 */
export function findPageEntry(folder) {
  for (const candidate of PAGE_ENTRY_CANDIDATES) {
    const path = join(folder, candidate);
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * The esbuild options for a page script: one browser script with no
 * imports left, nothing written to disk, non-ASCII escaped.
 *
 * @param {string} folder The tile folder.
 * @param {string} entry The absolute entry path.
 * @param {{ minify?: boolean }} [options]
 * @returns {import("esbuild").BuildOptions}
 */
export function pageEsbuildOptions(folder, entry, { minify = false } = {}) {
  return {
    absWorkingDir: folder,
    entryPoints: [entry],
    outfile: join(folder, PAGE_OUTPUT),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify,
    legalComments: "eof",
    write: false,
    logLevel: "silent",
  };
}

/**
 * The finished `page/main.js`: the entry's opening comment, a "built from"
 * line, then the bundle.
 *
 * @param {string} raw esbuild's output.
 * @param {{ header?: string, entry: string }} info
 * @returns {string}
 */
export function finishPage(raw, { header = "", entry }) {
  let body = raw;
  if (header && body.includes(header)) body = body.replace(header, "").replace(/^\s+/, "");
  const banner = `// Built by @tilefold/tile-tools from ${entry}. Edit the sources, then rebuild.`;
  return `${header ? `${header}\n` : ""}${banner}\n${body.trimEnd()}\n`;
}

/**
 * Bundles the tile's page script in memory.
 *
 * @param {string} folder The tile folder.
 * @param {{ minify?: boolean }} [options]
 * @returns {Promise<{ code: string, entry: string, warnings: string[] } | null>}
 *   The finished `page/main.js`, or null when the tile has no `page-src/` entry.
 * @throws {TileBuildError} On any build problem.
 */
export async function bundlePage(folder, options = {}) {
  const root = resolve(folder);
  const entryFile = findPageEntry(root);
  if (!entryFile) return null;
  const entry = displayPath(root, entryFile);
  let result;
  try {
    result = await esbuild.build(pageEsbuildOptions(root, entryFile, options));
  } catch (e) {
    throw new TileBuildError(formatMessages(e.errors ?? [{ text: String(e) }]).join("\n"));
  }
  const header = leadingComment(readFileSync(entryFile, "utf8"));
  const code = finishPage(result.outputFiles[0].text, { header, entry });
  return { code, entry, warnings: formatMessages(result.warnings) };
}
