// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tile Tools — package manifest tests
 *
 * The package stays publishable: public, MIT-licensed with its LICENSE
 * shipped, a working bin and exports, only built files in the tarball, and
 * every shipped source file carrying the copyright and MIT lines.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("package.json", () => {
  it("is public, scoped and MIT-licensed", () => {
    expect(pkg.name).toBe("@tilefold/tile-tools");
    expect(pkg.private).toBeUndefined();
    expect(pkg.publishConfig).toEqual({ access: "public" });
    expect(pkg.license).toBe("MIT");
    expect(readFileSync(join(ROOT, "LICENSE"), "utf8")).toMatch(
      /^MIT License\n\nCopyright \(c\) \d{4}/,
    );
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.repository.url).toBe("git+https://github.com/Tilefold/tile-tools.git");
    expect(pkg.engines.node).toBe(">=22");
  });

  it("points bin, exports and types at files that exist", () => {
    for (const file of [
      pkg.bin["tilefold-tile"],
      pkg.exports["."].default,
      pkg.exports["."].types,
      pkg.exports["./tf"].types,
      pkg.types,
    ]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
    }
    expect(readFileSync(join(ROOT, pkg.bin["tilefold-tile"]), "utf8")).toMatch(
      /^#!\/usr\/bin\/env node\n/,
    );
  });

  it("ships only built files, the README and the LICENSE", () => {
    expect(pkg.files).toEqual(["bin", "lib/*.mjs", "lib/*.d.ts", "README.md", "LICENSE"]);
  });

  it("marks every shipped source file as MIT", () => {
    const files = [
      "bin/tilefold-tile.mjs",
      "lib/bundle.mjs",
      "lib/cli.mjs",
      "lib/commands.mjs",
      "lib/index.mjs",
      "lib/rules.mjs",
      "lib/index.d.ts",
      "lib/tf.d.ts",
    ];
    for (const f of files) {
      const head = readFileSync(join(ROOT, f), "utf8").slice(0, 300);
      expect(head, f).toMatch(/Copyright \(c\) \d{4} Tilefold/);
      expect(head, f).toMatch(/Released under the MIT License\./);
    }
  });
});
