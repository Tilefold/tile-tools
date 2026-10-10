/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — main.js rules
 *
 * The shape Tilefold requires of a tile's `main.js`, checked here so an
 * author hears about a problem when building rather than when Tilefold
 * refuses the tile. These rules mirror the app's own loader: one file of at
 * most 2 MiB, exactly one `export default`, and no other `import` / `export`
 * statement. Keep the two in step when either changes.
 *
 * @module @tilefold/tile-tools/rules
 */

/** Largest `main.js` Tilefold accepts, in characters. */
export const MAX_CODE_CHARS = 2 * 1024 * 1024;

/** `export default` at the start of a line. */
const EXPORT_DEFAULT = /^export\s+default\s+/gm;

/**
 * Any other module statement at the start of a line: `import x from`,
 * `import { … }`, `import * as`, `import "x"`, or an `export` that is not the
 * default. `importScripts` and a dynamic `import(…)` are not statements.
 */
const MODULE_STATEMENT = /^\s*(?:import(?=[\s{*'"])\s*(?!\()|export\s+(?!default\s))/m;

/**
 * Problems with a finished `main.js`, as short English sentences; an empty
 * list means Tilefold will accept the file's shape.
 *
 * @param {string} code The text of `main.js`.
 * @returns {string[]} One sentence per problem.
 */
export function checkMain(code) {
  const problems = [];
  if (code.length > MAX_CODE_CHARS) {
    problems.push(`main.js is ${code.length} characters; the limit is ${MAX_CODE_CHARS}.`);
  }
  const defaults = code.match(EXPORT_DEFAULT)?.length ?? 0;
  if (defaults !== 1) {
    problems.push(`main.js must have exactly one \`export default\`; it has ${defaults}.`);
  }
  if (MODULE_STATEMENT.test(code)) {
    problems.push("main.js still has an `import` or a named `export`; bundle it into one file.");
  }
  return problems;
}
