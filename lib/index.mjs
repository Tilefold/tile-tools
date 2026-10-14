/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — package entry point
 *
 * The functions behind the `tilefold-tile` command, for build scripts that
 * would rather call them than spawn the CLI.
 *
 * @module @tilefold/tile-tools
 */
export {
  bundleTile,
  findEntry,
  finishBundle,
  TileBuildError,
  ENTRY_CANDIDATES,
} from "./bundle.mjs";
export { build, validate, watch } from "./commands.mjs";
export { bundlePage, findPageEntry, PAGE_ENTRY_CANDIDATES, PAGE_OUTPUT } from "./page.mjs";
export { checkMain, MAX_CODE_CHARS } from "./rules.mjs";
export { run } from "./cli.mjs";
