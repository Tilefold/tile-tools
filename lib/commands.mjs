/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — commands
 *
 * What `tilefold-tile` does for each command: build once, check that the
 * committed `main.js` matches its sources, watch and rebuild on every save,
 * or validate a hand-written `main.js`. Each step is reported through a
 * logger, one line per event, so the CLI, tests and editor tasks all see
 * the same trail. Every command returns an exit code instead of exiting.
 *
 * @module @tilefold/tile-tools/commands
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as esbuild from "esbuild";
import {
  OUTPUT,
  TileBuildError,
  bundleTile,
  displayPath,
  esbuildOptions,
  finishBundle,
  findEntry,
  formatMessages,
  leadingComment,
} from "./bundle.mjs";
import { checkMain } from "./rules.mjs";

/**
 * Where a command reports. `info` for progress, `warn` for problems that
 * don't stop the command, `error` for ones that do.
 *
 * @typedef {{ info(line: string): void, warn(line: string): void, error(line: string): void }} Logger
 */

/** A logger writing to the terminal. */
export const consoleLogger = {
  info: (line) => console.log(line),
  warn: (line) => console.warn(`warning: ${line}`),
  error: (line) => console.error(`error: ${line}`),
};

/**
 * Size of a text as kilobytes with one decimal.
 *
 * @param {string} text
 * @returns {string}
 */
export function size(text) {
  return `${(Buffer.byteLength(text) / 1024).toFixed(1)} kB`;
}

/**
 * Stops with a non-zero code unless the folder holds a `tile.json`, so a
 * build in the wrong folder doesn't scatter a `main.js` somewhere.
 *
 * @param {string} folder
 * @param {Logger} log
 * @returns {boolean} Whether the folder is a tile.
 */
function isTile(folder, log) {
  if (existsSync(join(folder, "tile.json"))) return true;
  log.error(`${folder} has no tile.json; run this in a tile folder or pass its path.`);
  return false;
}

/**
 * Reports a failure: a TileBuildError line by line, anything else whole.
 *
 * @param {unknown} e
 * @param {Logger} log
 */
function report(e, log) {
  if (e instanceof TileBuildError) for (const line of e.message.split("\n")) log.error(line);
  else log.error(String(e?.stack ?? e));
}

/**
 * `build` — bundles the tile and writes `main.js`. With `check`, writes
 * nothing and fails when `main.js` differs from a fresh build.
 *
 * @param {{ folder?: string, entry?: string, minify?: boolean, check?: boolean, log?: Logger }} options
 * @returns {Promise<number>} The exit code.
 */
export async function build({ folder = ".", entry, minify, check, log = consoleLogger } = {}) {
  const root = resolve(folder);
  if (!isTile(root, log)) return 1;
  const started = Date.now();
  try {
    const result = await bundleTile(root, { entry, minify });
    for (const w of result.warnings) log.warn(w);
    const out = join(root, OUTPUT);
    if (check) {
      const current = existsSync(out) ? readFileSync(out, "utf8") : null;
      if (current === result.code) {
        log.info(`${OUTPUT} is up to date with ${result.entry}`);
        return 0;
      }
      log.error(`${OUTPUT} is out of date with ${result.entry}; run \`tilefold-tile build\`.`);
      return 1;
    }
    writeFileSync(out, result.code);
    const ms = Date.now() - started;
    log.info(`built ${OUTPUT} (${size(result.code)}) from ${result.entry} in ${ms} ms`);
    return 0;
  } catch (e) {
    report(e, log);
    return 1;
  }
}

/**
 * `build --watch` — builds, then rebuilds whenever a source file changes,
 * until `stop()` is called. A failed rebuild keeps the last good `main.js`.
 * In Tilefold, Settings → Tiles → Reload tiles picks up each new build.
 *
 * @param {{ folder?: string, entry?: string, minify?: boolean, log?: Logger }} options
 * @returns {Promise<{ code: number, stop: () => Promise<void> }>}
 */
export async function watch({ folder = ".", entry, minify, log = consoleLogger } = {}) {
  const root = resolve(folder);
  const none = { code: 1, stop: async () => {} };
  if (!isTile(root, log)) return none;
  let entryFile;
  try {
    entryFile = findEntry(root, entry);
  } catch (e) {
    report(e, log);
    return none;
  }
  const shown = displayPath(root, entryFile);
  const finisher = {
    name: "tilefold-finish",
    setup(b) {
      let started = 0;
      b.onStart(() => {
        started = Date.now();
      });
      b.onEnd((result) => {
        if (result.errors.length) {
          for (const line of formatMessages(result.errors)) log.error(line);
          return;
        }
        for (const line of formatMessages(result.warnings)) log.warn(line);
        try {
          const header = leadingComment(readFileSync(entryFile, "utf8"));
          const code = finishBundle(result.outputFiles[0].text, { header, entry: shown });
          writeFileSync(join(root, OUTPUT), code);
          log.info(`built ${OUTPUT} (${size(code)}) from ${shown} in ${Date.now() - started} ms`);
        } catch (e) {
          report(e, log);
        }
      });
    },
  };
  const ctx = await esbuild.context({
    ...esbuildOptions(root, entryFile, { minify }),
    plugins: [finisher],
  });
  await ctx.watch();
  log.info(`watching ${shown} and its imports; press Ctrl+C to stop`);
  return { code: 0, stop: () => ctx.dispose() };
}

/**
 * `validate` — checks an existing `main.js` (hand-written or built) against
 * Tilefold's rules without building anything.
 *
 * @param {{ folder?: string, log?: Logger }} options
 * @returns {number} The exit code.
 */
export function validate({ folder = ".", log = consoleLogger } = {}) {
  const root = resolve(folder);
  if (!isTile(root, log)) return 1;
  const out = join(root, OUTPUT);
  if (!existsSync(out)) {
    log.error(`${OUTPUT} is missing; Tilefold loads the tile's code only from ${OUTPUT}.`);
    return 1;
  }
  const problems = checkMain(readFileSync(out, "utf8"));
  for (const p of problems) log.error(p);
  if (!problems.length) log.info(`${OUTPUT} has the shape Tilefold expects`);
  return problems.length ? 1 : 0;
}
