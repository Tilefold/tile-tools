// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — page script tests
 *
 * A tile with `page-src/` gets one self-contained `page/main.js`: built with
 * `main.js`, checked by `--check`, rebuilt by `--watch`, in JavaScript or
 * TypeScript, with its copyright comment kept and no imports left. Tiles
 * without `page-src/` are left alone.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build, watch } from "../lib/commands.mjs";
import { bundlePage, findPageEntry, PAGE_OUTPUT } from "../lib/page.mjs";
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

const MAIN = "export default function (tf) {}\n";
const PAGE =
  '/**\n * Copyright (c) 2026 Someone\n */\nimport { greet } from "./greet.js";\ngreet();\n';
const GREET = 'export function greet() {\n  document.title = "hi";\n}\n';

/** A tile with a page written as two files. */
const withPage = (extra = {}) =>
  tile({ "src/main.js": MAIN, "page-src/main.js": PAGE, "page-src/greet.js": GREET, ...extra });

describe("page script", () => {
  it("is built into one page/main.js with no imports left and the notice on top", async () => {
    const root = withPage();
    const log = recorder();
    expect(await build({ folder: root, log })).toBe(0);
    const code = readFileSync(join(root, PAGE_OUTPUT), "utf8");
    expect(
      code.startsWith(
        "/**\n * Copyright (c) 2026 Someone\n */\n// Built by @tilefold/tile-tools from page-src/main.js.",
      ),
    ).toBe(true);
    expect(code).toContain('document.title = "hi"');
    expect(code).not.toMatch(/^\s*(import|export)\s/m);
    expect(code.match(/Copyright/g)).toHaveLength(1);
    expect(log.lines).toEqual([
      expect.stringMatching(/^info built main\.js \(\d+\.\d kB\) from src\/main\.js in \d+ ms$/),
      expect.stringMatching(
        /^info built page\/main\.js \(\d+\.\d kB\) from page-src\/main\.js in \d+ ms$/,
      ),
    ]);
  });

  it("is left alone for a tile without page-src/", async () => {
    const root = tile({ "src/main.js": MAIN, "page/index.html": "<p>hi</p>" });
    expect(findPageEntry(root)).toBeNull();
    expect(await bundlePage(root)).toBeNull();
    expect(await build({ folder: root, log: recorder() })).toBe(0);
    expect(existsSync(join(root, PAGE_OUTPUT))).toBe(false);
  });

  it("may be TypeScript", async () => {
    const root = tile({
      "src/main.js": MAIN,
      "page-src/main.ts": "const n: number = 2;\ndocument.title = String(n);\n",
    });
    const result = await bundlePage(root);
    expect(result?.entry).toBe("page-src/main.ts");
    expect(result?.code).not.toContain(": number");
  });

  it("is checked by --check alongside main.js", async () => {
    const root = withPage();
    const log = recorder();
    await build({ folder: root, log });
    expect(await build({ folder: root, check: true, log })).toBe(0);
    writeFileSync(join(root, "page-src/greet.js"), GREET.replace("hi", "hello"));
    expect(await build({ folder: root, check: true, log })).toBe(1);
    expect(log.lines.slice(-2)).toEqual([
      "info main.js is up to date with src/main.js",
      "error page/main.js is out of date with page-src/main.js; run `tilefold-tile build`.",
    ]);
  });

  it("reports a build error with its place and writes nothing", async () => {
    const root = withPage({ "page-src/greet.js": "export function greet( {\n" });
    const log = recorder();
    expect(await build({ folder: root, log })).toBe(1);
    expect(log.lines.join("\n")).toMatch(/page-src\/greet\.js:\d+:\d+: /);
    expect(existsSync(join(root, PAGE_OUTPUT))).toBe(false);
  });

  it("is rebuilt by --watch on every save", async () => {
    const root = withPage();
    const log = recorder();
    const out = join(root, PAGE_OUTPUT);
    const started = await watch({ folder: root, log });
    try {
      await vi.waitFor(() => expect(readFileSync(out, "utf8")).toContain('"hi"'), 5000);
      writeFileSync(join(root, "page-src/greet.js"), GREET.replace("hi", "hello"));
      await vi.waitFor(() => expect(readFileSync(out, "utf8")).toContain('"hello"'), 5000);
      expect(log.lines).toContain(
        "info watching page-src/main.js and its imports; press Ctrl+C to stop",
      );
    } finally {
      await started.stop();
    }
  });
});
