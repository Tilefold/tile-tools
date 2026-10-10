// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — bundling and rules tests
 *
 * The main.js rules, the entry lookup, the opening-comment keeper, the finishing step, and real
 * esbuild builds of small tiles written to a temporary folder.
 */
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ENTRY_CANDIDATES,
  TileBuildError,
  bundleTile,
  findEntry,
  finishBundle,
  leadingComment,
} from "../lib/bundle.mjs";
import { MAX_CODE_CHARS, checkMain } from "../lib/rules.mjs";
import { removeTiles, tile } from "./tileFolder.mjs";

afterEach(removeTiles);

describe("checkMain", () => {
  it("accepts one default export and nothing else", () => {
    expect(checkMain("export default function (tf) {}\n")).toEqual([]);
    expect(checkMain("var a = 1;\nexport default a;\n")).toEqual([]);
  });

  it("reports each broken rule", () => {
    expect(checkMain("const x = 1;")[0]).toMatch(/exactly one `export default`; it has 0/);
    expect(checkMain("export default 1;\nexport default 2;")[0]).toMatch(/it has 2/);
    expect(checkMain('import x from "y";\nexport default x;')[0]).toMatch(/bundle it/);
    expect(checkMain("export const a = 1;\nexport default a;")[0]).toMatch(/named `export`/);
    const big = `export default 1;\n${"x".repeat(MAX_CODE_CHARS)}`;
    expect(checkMain(big)[0]).toMatch(/the limit is/);
  });
});

describe("findEntry", () => {
  it("takes the first conventional entry that exists", () => {
    const root = tile({ "src/index.js": "", "src/main.ts": "" });
    expect(findEntry(root)).toBe(join(root, "src/main.ts"));
    expect(ENTRY_CANDIDATES[0]).toBe("src/main.ts");
  });

  it("uses a named entry inside the folder", () => {
    const root = tile({ "lib/start.js": "" });
    expect(findEntry(root, "lib/start.js")).toBe(join(root, "lib/start.js"));
  });

  it("refuses a missing entry, a missing named one, and one outside the folder", () => {
    const root = tile({});
    expect(() => findEntry(root)).toThrow(/No entry file found/);
    expect(() => findEntry(root, "nope.js")).toThrow(/does not exist/);
    expect(() => findEntry(root, "../elsewhere.js")).toThrow(/outside the tile folder/);
    expect(() => findEntry(root, "nope.js")).toThrow(TileBuildError);
  });
});

describe("leadingComment", () => {
  it("keeps the comments a file opens with", () => {
    const src = "/**\n * Copyright\n */\n// more\nimport x from './x';\n// not this\n";
    expect(leadingComment(src)).toBe("/**\n * Copyright\n */\n// more");
  });

  it("is empty when the file opens with code", () => {
    expect(leadingComment("const a = 1; // trailing\n")).toBe("");
  });
});

describe("finishBundle", () => {
  const raw =
    "// src/main.js\nfunction main_default(tf) {}\nexport {\n  main_default as default\n};\n";

  it("rewrites the export, adds the header and the built-from line", () => {
    const code = finishBundle(raw, { header: "/* (c) */", entry: "src/main.js" });
    expect(code.split("\n").slice(0, 2)).toEqual([
      "/* (c) */",
      "// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.",
    ]);
    expect(code).toMatch(/^export default main_default;$/m);
    expect(code).not.toMatch(/export \{/);
    expect(code.endsWith("\n")).toBe(true);
  });

  it("keeps a legal comment once", () => {
    const legal = "/*! (c) Tilefold */";
    const code = finishBundle(`${legal}\n${raw}`, { header: legal, entry: "src/main.js" });
    expect(code.split(legal).length - 1).toBe(1);
  });

  it("refuses named exports and a missing default", () => {
    const named = "var a = 1, b = 2;\nexport {\n  a as default,\n  b\n};\n";
    expect(() => finishBundle(named, { entry: "src/main.js" })).toThrow(/also exports b/);
    expect(() => finishBundle("var a = 1;\n", { entry: "src/main.js" })).toThrow(
      /needs `export default/,
    );
    expect(() => finishBundle("var a;\nexport { a };\n", { entry: "e.js" })).toThrow(
      /may export only/,
    );
  });
});

describe("bundleTile", () => {
  it("bundles local imports and npm packages into one accepted file", async () => {
    const root = tile({
      "src/main.js": [
        "/**\n * Copyright (c) 2026 Someone\n */",
        'import { greet } from "./greet.js";',
        'import pad from "left-pad-ish";',
        "export default function (tf) {",
        '  tf.setting("hello", pad(greet("Ünï")), "");',
        "}",
      ].join("\n"),
      "src/greet.js": "export const greet = (n) => `hi ${n}`;\nexport const unused = 1;\n",
      "node_modules/left-pad-ish/package.json": '{ "name": "left-pad-ish", "main": "index.js" }',
      "node_modules/left-pad-ish/index.js": "module.exports = (s) => ' ' + s;\n",
    });
    const { code, entry, warnings } = await bundleTile(root);
    expect(entry).toBe("src/main.js");
    expect(warnings).toEqual([]);
    expect(code.startsWith("/**\n * Copyright (c) 2026 Someone\n */\n// Built by")).toBe(true);
    expect(checkMain(code)).toEqual([]);
    // Non-ASCII is escaped, so no invisible characters can reach the file.
    expect([...code].every((c) => c.charCodeAt(0) < 128)).toBe(true);
    expect(code).not.toContain("unused");
  });

  it("compiles TypeScript", async () => {
    const root = tile({
      "src/main.ts":
        "type Tf = { log(s: string): void };\nexport default (tf: Tf): void => tf.log('x');\n",
    });
    const { code } = await bundleTile(root);
    expect(code).not.toContain(": Tf");
    expect(checkMain(code)).toEqual([]);
  });

  it("reports a syntax error with its place", async () => {
    const root = tile({ "src/main.js": "export default function (tf) {\n  let = ;\n}\n" });
    await expect(bundleTile(root)).rejects.toThrow(/src\/main\.js:2:\d+: /);
  });

  it("reports an import that can't be found", async () => {
    const root = tile({ "src/main.js": 'import x from "./missing.js";\nexport default x;\n' });
    await expect(bundleTile(root)).rejects.toThrow(/Could not resolve "\.\/missing\.js"/);
  });

  it("minifies when asked", async () => {
    const src = "export default function (tf) {\n  const longName = 1;\n  tf.log(longName);\n}\n";
    const plain = await bundleTile(tile({ "src/main.js": src }));
    const small = await bundleTile(tile({ "src/main.js": src }), { minify: true });
    expect(small.code.length).toBeLessThan(plain.code.length);
    expect(checkMain(small.code)).toEqual([]);
  });
});
