/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — command line
 *
 * Reads the `tilefold-tile` arguments, prints help and the version, and
 * hands off to the commands. Kept apart from the executable so tests can run
 * the whole CLI in-process.
 *
 * @module @tilefold/tile-tools/cli
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { build, consoleLogger, validate, watch } from "./commands.mjs";

/** The help text `tilefold-tile help` prints. */
export const HELP = `tilefold-tile — build Tilefold tiles

Usage:
  tilefold-tile build [folder] [--entry <file>] [--minify] [--watch] [--check]
  tilefold-tile validate [folder]
  tilefold-tile help | --help
  tilefold-tile --version

Commands:
  build      Bundle the tile's sources into the main.js Tilefold loads.
             The entry is the first of src/main.ts, src/main.js, src/index.ts,
             src/index.js (or --entry). Imports of your own files and of npm
             packages are bundled in.
  validate   Check an existing main.js against Tilefold's rules.

Options:
  --entry <file>  Entry file, relative to the tile folder.
  --minify        Smaller output. Readable output is easier for people
                  reviewing a tile, so it is the default.
  --watch         Rebuild on every save until Ctrl+C. Then use Reload tiles
                  in Tilefold (Settings → Tiles) to load the new build.
  --check         Write nothing; fail if main.js is not a fresh build of its
                  sources. Use it in CI.

The folder defaults to the current one and must contain tile.json.`;

/**
 * The package version, read from its own package.json.
 *
 * @returns {string}
 */
export function version() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  return pkg.version;
}

/**
 * Runs the CLI with the given arguments.
 *
 * @param {string[]} argv The arguments after the program name.
 * @param {{ log?: import("./commands.mjs").Logger, onWatch?: (stop: () => Promise<void>) => void }} [io]
 *   Where to report, and who receives the stop function of a watch (the
 *   executable wires it to Ctrl+C).
 * @returns {Promise<number>} The exit code; a running watch returns 0 at once.
 */
export async function run(argv, { log = consoleLogger, onWatch } = {}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        entry: { type: "string" },
        minify: { type: "boolean" },
        watch: { type: "boolean" },
        check: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (e) {
    log.error(e.message);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, folder, ...extra] = positionals;
  if (values.version) {
    log.info(version());
    return 0;
  }
  if (values.help || !command || command === "help") {
    log.info(HELP);
    return command && command !== "help" ? 2 : 0;
  }
  if (extra.length) {
    log.error(`unexpected argument: ${extra[0]}`);
    return 2;
  }
  if (command === "validate") return validate({ folder, log });
  if (command !== "build") {
    log.error(`unknown command: ${command} (try \`tilefold-tile help\`)`);
    return 2;
  }
  if (values.watch && values.check) {
    log.error("--watch and --check can't be used together");
    return 2;
  }
  const options = { folder, entry: values.entry, minify: values.minify, log };
  if (!values.watch) return build({ ...options, check: values.check });
  const started = await watch(options);
  if (started.code === 0) onWatch?.(started.stop);
  return started.code;
}
