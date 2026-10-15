/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — finding markers below the tree's folder
 *
 * The scanner reads markers in projects inside the tree's folder: in its
 * subfolders (looked into now and then, never hidden or dependency
 * folders, at most PROBE_MAX) and in any listed folder holding a
 * .foldertree. It keeps within Tilefold's listing budget: folders without
 * markers wait MISSING_MS before being asked again, and at most BELOW_MAX
 * folders below are read each time. Moving the tree forgets it all.
 */
import { describe, expect, it } from "vitest";
import { markerName } from "../../examples/folder-tree/hooks/marker.mjs";
import {
  BELOW_MAX,
  createScanner,
  MISSING_MS,
  PROBE_MAX,
  PROBE_MS,
} from "../../examples/folder-tree/src/scan.js";

const NOW = Date.UTC(2026, 9, 15, 12);

/** A marker name for `rel`. */
const name = (rel, n = 0) =>
  markerName({ ts: NOW - 1000, nonce: String(n).padStart(4, "0"), action: "e", pane: "a", rel })
    .name;

/** A fake `tf` whose folders are { path: [entry names] }, counting listings. */
function fakeTf(dirs) {
  const calls = [];
  const tf = {
    log: { warn: () => {} },
    fs: {
      async list(path) {
        calls.push(path);
        if (!(path in dirs)) throw Object.assign(new Error("no"), { name: "NotFoundError" });
        return { path, entries: dirs[path].map((n) => ({ name: n, kind: "file" })) };
      },
    },
  };
  return { tf, calls };
}

/** The tree's listing of `root`, with these subfolders. */
const listed = (root, subfolders) => ({
  [root]: { entries: subfolders.map((n) => ({ name: n, kind: "dir" })) },
});

describe("markers below the tree's folder", () => {
  it("are found in its subfolders, but not hidden or dependency ones", async () => {
    const { tf, calls } = fakeTf({ "/w/app/.foldertree": [name("src/a.js")] });
    const scanner = createScanner(tf);
    const folders = listed("/w", ["app", "lib", ".worktrees", "node_modules"]);
    const found = await scanner.scan("/w", NOW, folders);
    expect(found.map((f) => `${f.root} ${f.marker.path}`)).toEqual(["/w/app src/a.js"]);
    expect(calls).not.toContain("/w/.worktrees/.foldertree");
    expect(calls).not.toContain("/w/node_modules/.foldertree");
  });

  it("keep being read; empty subfolders wait before being asked again", async () => {
    const { tf, calls } = fakeTf({ "/w/app/.foldertree": [name("a.js")] });
    const scanner = createScanner(tf);
    const folders = listed("/w", ["app", "lib"]);
    await scanner.scan("/w", NOW, folders);
    calls.length = 0;
    const again = await scanner.scan("/w", NOW + 2000, folders);
    expect(again).toHaveLength(1);
    expect(calls).toContain("/w/app/.foldertree");
    expect(calls).not.toContain("/w/lib/.foldertree");
    calls.length = 0;
    await scanner.scan("/w", NOW + Math.max(PROBE_MS, MISSING_MS), folders);
    expect(calls).toContain("/w/lib/.foldertree");
  });

  it("are found in a listed folder that holds a .foldertree, at any depth", async () => {
    const { tf } = fakeTf({ "/w/a/b/.foldertree": [name("x.js")] });
    const scanner = createScanner(tf);
    const folders = {
      ...listed("/w", []),
      "/w/a/b": { entries: [{ name: ".foldertree", kind: "dir" }] },
    };
    const found = await scanner.scan("/w", NOW, folders);
    expect(found.map((f) => f.root)).toEqual(["/w/a/b"]);
  });

  it("are looked for in at most PROBE_MAX subfolders, and read from at most BELOW_MAX", async () => {
    const many = Array.from({ length: PROBE_MAX + 5 }, (_, i) => `p${i}`);
    const dirs = Object.fromEntries(many.map((p, i) => [`/w/${p}/.foldertree`, [name("a.js", i)]]));
    const { tf, calls } = fakeTf(dirs);
    const scanner = createScanner(tf);
    const folders = listed("/w", many);
    const first = await scanner.scan("/w", NOW, folders);
    expect(new Set(first.map((f) => f.root)).size).toBe(PROBE_MAX);
    calls.length = 0;
    await scanner.scan("/w", NOW + 2000, folders);
    const below = calls.filter((c) => /^\/w\/p\d+\//.test(c));
    expect(below).toHaveLength(BELOW_MAX);
  });

  it("are forgotten when the tree moves", async () => {
    const { tf, calls } = fakeTf({ "/w/app/.foldertree": [name("a.js")] });
    const scanner = createScanner(tf);
    await scanner.scan("/w", NOW, listed("/w", ["app"]));
    calls.length = 0;
    await scanner.scan("/other", NOW + 1000, {});
    expect(calls).not.toContain("/w/app/.foldertree");
  });
});
