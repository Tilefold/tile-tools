/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Package tests
 *
 * The tile as Tilefold will load it: tile.json follows Tilefold's rules,
 * main.js is a fresh build of the sources and has the shape Tilefold
 * accepts, every message the code asks for exists in English (and every
 * English message is used), and every source file carries its copyright
 * header and stays under 500 lines.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleTile, checkMain } from "@tilefold/tile-tools";
import { describe, expect, it } from "vitest";
import { ROOT, messagesOf } from "./support/fake-tf.js";

/** Every .js file under a folder. */
function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsFiles(path);
    return name.endsWith(".js") ? [path] : [];
  });
}

const tile = JSON.parse(readFileSync(join(ROOT, "tile.json"), "utf8"));
const sources = jsFiles(join(ROOT, "src"));
const sourceText = sources.map((f) => readFileSync(f, "utf8")).join("\n");

describe("tile.json", () => {
  it("has only the fields Tilefold allows", () => {
    const allowed = ["id", "version", "name", "description", "permissions"];
    expect(Object.keys(tile).every((k) => allowed.includes(k))).toBe(true);
  });

  it("has a valid id and version", () => {
    expect(tile.id).toMatch(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/);
    expect(tile.id.startsWith("tilefold.")).toBe(false);
    expect(tile.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("takes its name and description from the locale files", () => {
    const en = messagesOf("en");
    expect(tile.name).toBe("%tile-name%");
    expect(tile.description).toBe("%tile-description%");
    expect(en.get("tile-name")).toBe("Tilefall");
    expect(en.get("tile-description").length).toBeGreaterThan(20);
  });

  it("asks only for the permissions it uses, each with a reason", () => {
    const perms = tile.permissions.map((p) => Object.entries(p)[0]);
    expect(perms.map(([name]) => name).sort()).toEqual(["sound.play", "window.overlay"]);
    for (const [, reason] of perms) expect(reason.length).toBeGreaterThan(10);
    expect(sourceText).toContain("tf.overlay.show");
    expect(sourceText).toContain("tf.sound.play");
  });
});

describe("main.js", () => {
  const main = readFileSync(join(ROOT, "main.js"), "utf8");

  it("is a fresh build of the sources", async () => {
    const { code } = await bundleTile(ROOT);
    expect(main).toBe(code);
  });

  it("has the shape Tilefold accepts", () => {
    expect(checkMain(main)).toEqual([]);
  });

  it("starts with the copyright header", () => {
    expect(main.startsWith("/**\n * Copyright (c) 2026 Tilefold")).toBe(true);
  });
});

describe("messages", () => {
  const en = messagesOf("en");

  /** Keys built at run time from a prefix (the rest comes from a table or a status). */
  const DYNAMIC = ["board-label-", "setting-corner-"];

  it("has every key the code names", () => {
    const named = new Set(
      [
        ...sourceText.matchAll(/["'`]((?:cmd|setting|panel|banner|button|tile)-[a-z0-9-]+)["'`]/g),
      ].map((m) => m[1]),
    );
    expect(named.size).toBeGreaterThan(30);
    for (const key of named) expect(en.has(key), key).toBe(true);
  });

  it("uses every English message", () => {
    for (const key of en.keys()) {
      if (key === "tile-name" || key === "tile-description") continue;
      const used =
        sourceText.includes(`"${key}"`) ||
        DYNAMIC.some((p) => key.startsWith(p) && sourceText.includes(p));
      expect(used, key).toBe(true);
    }
  });

  it("has every dynamic key the code can build", () => {
    for (const status of ["none", "playing", "paused", "over"])
      expect(en.has(`board-label-${status}`)).toBe(true);
    for (const corner of ["bottom-right", "bottom-left", "top-right", "top-left"]) {
      expect(en.has(`setting-corner-${corner}`)).toBe(true);
    }
  });
});

describe("sources", () => {
  it("carry a copyright header and stay under 500 lines", () => {
    const files = [...sources, ...jsFiles(fileURLToPath(new URL(".", import.meta.url)))];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const name = relative(ROOT, file);
      expect(text.startsWith("/**\n * Copyright (c) 2026 Tilefold"), name).toBe(true);
      expect(text.split("\n").length, name).toBeLessThan(500);
    }
  });

  it("never point at documentation from code comments", () => {
    for (const file of sources) {
      expect(readFileSync(file, "utf8"), relative(ROOT, file)).not.toMatch(/see docs\/|\.md\b|§\d/);
    }
  });
});
