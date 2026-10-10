/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — type declarations
 *
 * Types for the functions behind the `tilefold-tile` command, for build
 * scripts written in TypeScript.
 *
 * @module @tilefold/tile-tools
 */

/** Where a command reports, one line per event. */
export interface Logger {
  info(line: string): void;
  warn(line: string): void;
  error(line: string): void;
}

/** A build problem worth showing the author as-is. */
export declare class TileBuildError extends Error {
  constructor(message: string);
}

/** Entry files looked for, in order, when none is named. */
export declare const ENTRY_CANDIDATES: readonly string[];

/** Largest `main.js` Tilefold accepts, in characters. */
export declare const MAX_CODE_CHARS: number;

/** Problems with a finished `main.js`; empty when Tilefold will accept its shape. */
export declare function checkMain(code: string): string[];

/** The absolute path of a tile's entry file. Throws TileBuildError when there is none. */
export declare function findEntry(folder: string, entry?: string): string;

/** Finishes esbuild's ESM output as a Tilefold `main.js`. Throws TileBuildError. */
export declare function finishBundle(raw: string, info: { header?: string; entry: string }): string;

/** Bundles a tile folder in memory. Rejects with TileBuildError on any build problem. */
export declare function bundleTile(
  folder: string,
  options?: { entry?: string; minify?: boolean },
): Promise<{ code: string; entry: string; warnings: string[] }>;

/** `build`: writes `main.js` (or, with `check`, compares). Resolves to an exit code. */
export declare function build(options?: {
  folder?: string;
  entry?: string;
  minify?: boolean;
  check?: boolean;
  log?: Logger;
}): Promise<number>;

/** `build --watch`: rebuilds on every save until `stop()`. */
export declare function watch(options?: {
  folder?: string;
  entry?: string;
  minify?: boolean;
  log?: Logger;
}): Promise<{ code: number; stop: () => Promise<void> }>;

/** `validate`: checks an existing `main.js`. Returns an exit code. */
export declare function validate(options?: { folder?: string; log?: Logger }): number;

/** Runs the CLI with the arguments after the program name. Resolves to an exit code. */
export declare function run(
  argv: string[],
  io?: { log?: Logger; onWatch?: (stop: () => Promise<void>) => void },
): Promise<number>;
