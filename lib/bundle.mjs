/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — bundling
 *
 * Turns a tile written as several files (an entry such as `src/main.js` that
 * imports helpers, data or npm packages, in JavaScript or TypeScript) into
 * the one `main.js` Tilefold runs. esbuild does the bundling; this module
 * picks the entry, keeps the entry's opening comment (the copyright notice)
 * at the top, rewrites esbuild's `export { x as default }` into the
 * `export default x;` every Tilefold version accepts, and checks the result
 * against the same rules Tilefold applies when it loads the tile.
 *
 * @module @tilefold/tile-tools/bundle
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import * as esbuild from "esbuild";
import { checkMain } from "./rules.mjs";

/** Entry files looked for, in order, when none is named. */
export const ENTRY_CANDIDATES = [
  "src/main.ts",
  "src/main.js",
  "src/main.mjs",
  "src/index.ts",
  "src/index.js",
  "src/index.mjs",
];

/** The file a build writes, relative to the tile folder. */
export const OUTPUT = "main.js";

/** A build problem worth showing the author as-is (no stack trace). */
export class TileBuildError extends Error {
  /**
   * @param {string} message What went wrong, in one or more lines.
   */
  constructor(message) {
    super(message);
    this.name = "TileBuildError";
  }
}

/**
 * The entry file for a tile folder, as an absolute path.
 *
 * @param {string} folder The tile folder (holds `tile.json`).
 * @param {string} [entry] An entry named by the author, relative to the folder.
 * @returns {string} The absolute path of the entry.
 * @throws {TileBuildError} When the entry is missing or outside the folder.
 */
export function findEntry(folder, entry) {
  if (entry) {
    const file = resolve(folder, entry);
    const rel = relative(folder, file);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new TileBuildError(`The entry ${entry} is outside the tile folder.`);
    }
    if (!existsSync(file)) throw new TileBuildError(`The entry ${entry} does not exist.`);
    return file;
  }
  const found = ENTRY_CANDIDATES.map((c) => join(folder, c)).find((f) => existsSync(f));
  if (!found) {
    throw new TileBuildError(
      `No entry file found. Create one of ${ENTRY_CANDIDATES.join(", ")}, or pass --entry.`,
    );
  }
  return found;
}

/**
 * The block of comments a source file opens with (a copyright notice, a
 * description), without the code after it; "" when the file opens with code.
 *
 * @param {string} source The entry file's text.
 * @returns {string} The leading comments, trimmed.
 */
export function leadingComment(source) {
  const match = source.match(/^(?:\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$)))+/);
  return match ? match[0].trim() : "";
}

/**
 * An `export { … };` block. esbuild writes exactly one, as the last
 * statement of its ESM output: on its own lines normally, mid-line when
 * minified, and followed only by legal comments.
 */
const EXPORT_BLOCK = /export\s*\{([^}]*)\}\s*;?/g;

/**
 * Finishes esbuild's output as a Tilefold `main.js`: the entry's opening
 * comment and a "built from" line on top, and the exports reduced to one
 * `export default`.
 *
 * @param {string} raw esbuild's ESM output.
 * @param {{ header?: string, entry: string }} info The entry's opening
 *   comment and its path relative to the tile folder (forward slashes).
 * @returns {string} The finished `main.js`.
 * @throws {TileBuildError} When the entry exports anything but a default, or
 *   the result breaks Tilefold's rules.
 */
export function finishBundle(raw, { header = "", entry }) {
  let body = raw;
  const block = [...raw.matchAll(EXPORT_BLOCK)].pop();
  if (block) {
    const names = block[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const defaults = names.filter((n) => /\sas\s+default$/.test(n));
    const others = names.filter((n) => !/\sas\s+default$/.test(n));
    if (others.length) {
      throw new TileBuildError(
        `${entry} may export only its default function; it also exports ${others.join(", ")}.`,
      );
    }
    if (defaults.length !== 1) throw new TileBuildError(`${entry} has no default export.`);
    const local = defaults[0].replace(/\s+as\s+default$/, "");
    // Tilefold looks for `export default` at the start of a line.
    const before = raw.slice(0, block.index);
    const lead = before === "" || before.endsWith("\n") ? "" : "\n";
    body = `${before}${lead}export default ${local};${raw.slice(block.index + block[0].length)}`;
  }
  // A legal comment (/*! … */) at the top of the entry is also kept by
  // esbuild; drop that copy so the notice appears once.
  if (header && body.includes(header)) body = body.replace(header, "").replace(/^\s+/, "");
  const banner = `// Built by @tilefold/tile-tools from ${entry}. Edit the sources, then rebuild.`;
  const code = `${header ? `${header}\n` : ""}${banner}\n${body.trimEnd()}\n`;
  if (!/^export\s+default\s/m.test(code)) {
    throw new TileBuildError(`${entry} needs \`export default function (tf) { … }\`.`);
  }
  const problems = checkMain(code);
  if (problems.length) throw new TileBuildError(problems.join("\n"));
  return code;
}

/**
 * The esbuild options for a tile: one ESM file for a Web Worker, nothing
 * written to disk (the caller finishes and writes it), non-ASCII escaped so
 * invisible characters can't slip into the file.
 *
 * @param {string} folder The tile folder.
 * @param {string} entry The absolute entry path.
 * @param {{ minify?: boolean }} [options]
 * @returns {import("esbuild").BuildOptions}
 */
export function esbuildOptions(folder, entry, { minify = false } = {}) {
  return {
    absWorkingDir: folder,
    entryPoints: [entry],
    outfile: join(folder, OUTPUT),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify,
    legalComments: "eof",
    write: false,
    logLevel: "silent",
  };
}

/**
 * esbuild messages as "file:line:column: text" lines.
 *
 * @param {import("esbuild").Message[]} messages
 * @returns {string[]}
 */
export function formatMessages(messages) {
  return messages.map((m) =>
    m.location
      ? `${m.location.file}:${m.location.line}:${m.location.column + 1}: ${m.text}`
      : m.text,
  );
}

/**
 * The entry path relative to the tile folder, with forward slashes, as
 * shown to the author and written into the "built from" line.
 *
 * @param {string} folder
 * @param {string} entry
 * @returns {string}
 */
export function displayPath(folder, entry) {
  return relative(folder, entry).split(sep).join("/");
}

/**
 * Bundles a tile folder in memory.
 *
 * @param {string} folder The tile folder.
 * @param {{ entry?: string, minify?: boolean }} [options]
 * @returns {Promise<{ code: string, entry: string, warnings: string[] }>}
 *   The finished `main.js`, the entry used, and esbuild's warnings.
 * @throws {TileBuildError} On any build problem.
 */
export async function bundleTile(folder, options = {}) {
  const root = resolve(folder);
  const entryFile = findEntry(root, options.entry);
  const entry = displayPath(root, entryFile);
  let result;
  try {
    result = await esbuild.build(esbuildOptions(root, entryFile, options));
  } catch (e) {
    throw new TileBuildError(formatMessages(e.errors ?? [{ text: String(e) }]).join("\n"));
  }
  const header = leadingComment(readFileSync(entryFile, "utf8"));
  const code = finishBundle(result.outputFiles[0].text, { header, entry });
  return { code, entry, warnings: formatMessages(result.warnings) };
}
