// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — command and CLI tests
 *
 * build (write, --check, failures), validate, watch (rebuilds on save and
 * keeps the last good build on an error), and the argument handling of the
 * `tilefold-tile` command, all with a logger that records each line.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build, validate, watch } from "../lib/commands.mjs";
import { HELP, run, version } from "../lib/cli.mjs";
import { removeTiles, tile } from "./tileFolder.mjs";

afterEach(removeTiles);

/** A logger that keeps every line, tagged with its level. */
function recorder() {
  const lines = [];
  return {
    lines,
    info: (l) => lines.push(`info ${l}`),
    warn: (l) => lines.push(`warn ${l}`),
    error: (l) => lines.push(`error ${l}`),
  };
}

const ENTRY = 'import { n } from "./n.js";\nexport default function (tf) {\n  tf.log(n);\n}\n';

describe("build", () => {
  it("writes main.js and says what it built", async () => {
    const root = tile({ "src/main.js": ENTRY, "src/n.js": "export const n = 1;\n" });
    const log = recorder();
    expect(await build({ folder: root, log })).toBe(0);
    expect(readFileSync(join(root, "main.js"), "utf8")).toMatch(/^export default main_default;$/m);
    expect(log.lines).toEqual([
      expect.stringMatching(/^info built main\.js \(\d+\.\d kB\) from src\/main\.js in \d+ ms$/),
    ]);
  });

  it("--check passes on a fresh build and fails on a stale or missing one", async () => {
    const root = tile({ "src/main.js": ENTRY, "src/n.js": "export const n = 1;\n" });
    const log = recorder();
    expect(await build({ folder: root, check: true, log })).toBe(1);
    expect(existsSync(join(root, "main.js"))).toBe(false);
    await build({ folder: root, log });
    expect(await build({ folder: root, check: true, log })).toBe(0);
    writeFileSync(join(root, "src/n.js"), "export const n = 2;\n");
    expect(await build({ folder: root, check: true, log })).toBe(1);
    expect(log.lines.filter((l) => l.startsWith("error"))).toEqual([
      "error main.js is out of date with src/main.js; run `tilefold-tile build`.",
      "error main.js is out of date with src/main.js; run `tilefold-tile build`.",
    ]);
  });

  it("refuses a folder without tile.json and reports build errors", async () => {
    const log = recorder();
    expect(await build({ folder: tile({ "tile.json": null }), log })).toBe(1);
    expect(log.lines[0]).toMatch(/has no tile\.json/);
    const broken = tile({ "src/main.js": 'import x from "./gone.js";\nexport default x;\n' });
    expect(await build({ folder: broken, log })).toBe(1);
    expect(log.lines.at(-1)).toMatch(/^error src\/main\.js:1:\d+: Could not resolve/);
    expect(existsSync(join(broken, "main.js"))).toBe(false);
  });
});

describe("validate", () => {
  it("passes a good main.js and lists what is wrong with a bad one", () => {
    const log = recorder();
    expect(validate({ folder: tile({ "main.js": "export default () => {};\n" }), log })).toBe(0);
    expect(validate({ folder: tile({ "main.js": "export const a = 1;\n" }), log })).toBe(1);
    expect(validate({ folder: tile({}), log })).toBe(1);
    expect(log.lines).toEqual([
      "info main.js has the shape Tilefold expects",
      "error main.js must have exactly one `export default`; it has 0.",
      "error main.js still has an `import` or a named `export`; bundle it into one file.",
      "error main.js is missing; Tilefold loads the tile's code only from main.js.",
    ]);
  });
});

describe("watch", () => {
  it("rebuilds on save and keeps the last good build after an error", async () => {
    const root = tile({ "src/main.js": ENTRY, "src/n.js": "export const n = 1;\n" });
    const log = recorder();
    const out = join(root, "main.js");
    const started = await watch({ folder: root, log });
    try {
      expect(started.code).toBe(0);
      await vi.waitFor(() => expect(readFileSync(out, "utf8")).toContain("n = 1"));
      writeFileSync(join(root, "src/n.js"), "export const n = 2;\n");
      await vi.waitFor(() => expect(readFileSync(out, "utf8")).toContain("n = 2"), 5000);
      writeFileSync(join(root, "src/n.js"), "export const n = ;\n");
      await vi.waitFor(() => expect(log.lines.some((l) => l.startsWith("error"))).toBe(true), 5000);
      expect(readFileSync(out, "utf8")).toContain("n = 2");
      expect(log.lines).toContain(
        "info watching src/main.js and its imports; press Ctrl+C to stop",
      );
    } finally {
      await started.stop();
    }
  });

  it("does not start without an entry", async () => {
    const log = recorder();
    const started = await watch({ folder: tile({}), log });
    expect(started.code).toBe(1);
    expect(log.lines[0]).toMatch(/No entry file found/);
  });
});

describe("tilefold-tile", () => {
  it("prints help and the version", async () => {
    const log = recorder();
    expect(await run([], { log })).toBe(0);
    expect(await run(["--help"], { log })).toBe(0);
    expect(await run(["--version"], { log })).toBe(0);
    expect(log.lines).toEqual([`info ${HELP}`, `info ${HELP}`, `info ${version()}`]);
    expect(version()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("rejects unknown commands, options and extra arguments", async () => {
    const log = recorder();
    expect(await run(["bake"], { log })).toBe(2);
    expect(await run(["build", "--fast"], { log })).toBe(2);
    expect(await run(["build", "a", "b"], { log })).toBe(2);
    expect(await run(["build", "--watch", "--check"], { log })).toBe(2);
    expect(log.lines).toEqual([
      "error unknown command: bake (try `tilefold-tile help`)",
      expect.stringMatching(/^error .*--fast/),
      "error unexpected argument: b",
      "error --watch and --check can't be used together",
    ]);
  });

  it("builds, checks and validates a folder", async () => {
    const root = tile({ "src/main.js": ENTRY, "src/n.js": "export const n = 1;\n" });
    const log = recorder();
    expect(await run(["build", root, "--minify"], { log })).toBe(0);
    expect(await run(["build", root, "--check", "--minify"], { log })).toBe(0);
    expect(await run(["build", root, "--check"], { log })).toBe(1);
    expect(await run(["validate", root], { log })).toBe(0);
  });

  it("hands a running watch's stop function to the caller", async () => {
    const root = tile({ "src/main.js": ENTRY, "src/n.js": "export const n = 1;\n" });
    let stop;
    const code = await run(["build", root, "--watch"], {
      log: recorder(),
      onWatch: (s) => (stop = s),
    });
    expect(code).toBe(0);
    expect(typeof stop).toBe("function");
    await stop();
  });

  it("uses a named entry", async () => {
    const root = tile({ "lib/go.js": "export default () => {};\n" });
    const log = recorder();
    expect(await run(["build", root, "--entry", "lib/go.js"], { log })).toBe(0);
    expect(readFileSync(join(root, "main.js"), "utf8")).toContain("from lib/go.js.");
  });
});
