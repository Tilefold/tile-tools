#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — executable
 *
 * The `tilefold-tile` command. Runs the CLI and exits with its code; a
 * `build --watch` keeps running until Ctrl+C, which stops the watcher first.
 */
import { run } from "../lib/cli.mjs";

const code = await run(process.argv.slice(2), {
  onWatch(stop) {
    process.once("SIGINT", () => {
      stop().then(() => process.exit(0));
    });
  },
});
if (code !== 0) process.exit(code);
