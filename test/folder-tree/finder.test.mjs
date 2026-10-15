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
 * markers wait MISSING_MS before being asked again, a scan lists at most
 * SCAN_BUDGET folders and scans WINDOW_BUDGET in any WINDOW_MS, and they
 * wait BACKOFF_MS when Tilefold says they list too fast. It watches every pane's folder it is given,
 * and stops reading folders left behind when the tree and panes move.
 */
import { describe, expect, it } from "vitest";
import { markerName } from "../../examples/folder-tree/hooks/marker.mjs";
import {
  createScanner,
  MISSING_MS,
  PROBE_MAX,
  PROBE_MS,
  SCAN_BUDGET,
  WINDOW_BUDGET,
  WINDOW_MS,
  BACKOFF_MS,
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
        if (path in dirs)
          return { path, entries: dirs[path].map((n) => ({ name: n, kind: "file" })) };
        // A folder holding a known one exists too, listing what is below it.
        const below = Object.keys(dirs)
          .filter((d) => d.startsWith(`${path}/`))
          .map((d) => d.slice(path.length + 1).split("/")[0]);
        if (!below.length) throw Object.assign(new Error("no"), { name: "NotFoundError" });
        return { path, entries: [...new Set(below)].map((n) => ({ name: n, kind: "dir" })) };
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

  it("are looked for in at most PROBE_MAX subfolders, within the scan and window budgets", async () => {
    const many = Array.from({ length: PROBE_MAX + 5 }, (_, i) => `p${i}`);
    const dirs = Object.fromEntries(many.map((p, i) => [`/w/${p}/.foldertree`, [name("a.js", i)]]));
    const { tf, calls } = fakeTf(dirs);
    const scanner = createScanner(tf);
    const folders = listed("/w", many);
    const roots = new Set();
    const times = [];
    for (let i = 0; i < 40; i++) {
      const before = calls.length;
      const at = NOW + i * 2000;
      for (const f of await scanner.scan("/w", at, folders)) roots.add(f.root);
      expect(calls.length - before).toBeLessThanOrEqual(SCAN_BUDGET);
      for (let k = before; k < calls.length; k++) times.push(at);
      const inWindow = times.filter((t) => at - t < WINDOW_MS).length;
      expect(inWindow).toBeLessThanOrEqual(WINDOW_BUDGET);
    }
    // In time every subfolder looked into was found, and none past PROBE_MAX.
    expect(roots.size).toBe(PROBE_MAX);
  });

  it("wait a while when Tilefold says they list too fast", async () => {
    const { tf, calls } = fakeTf({ "/w/.foldertree": [name("a.js")] });
    const real = tf.fs.list;
    let refuse = true;
    tf.fs.list = async (path) => {
      if (refuse) {
        calls.push(path);
        throw Object.assign(new Error("slow down"), { name: "RateLimitError" });
      }
      return real(path);
    };
    const scanner = createScanner(tf);
    await scanner.scan("/w", NOW, listed("/w", []));
    refuse = false;
    calls.length = 0;
    await scanner.scan("/w", NOW + BACKOFF_MS - 1, listed("/w", []));
    expect(calls).toEqual([]);
    const found = await scanner.scan("/w", NOW + BACKOFF_MS, listed("/w", []));
    expect(found).toHaveLength(1);
  });

  it("are found around every pane's folder, not only the tree's", async () => {
    const { tf } = fakeTf({
      "/game/.foldertree": [name("hud.js")],
      "/work/app/.foldertree": [name("main.js")],
    });
    const scanner = createScanner(tf);
    const roots = new Set();
    for (let i = 0; i < 3; i++) {
      const found = await scanner.scan("/work", NOW + i * 2000, listed("/work", ["app"]), [
        "/game",
      ]);
      for (const f of found) roots.add(f.root);
    }
    expect([...roots].sort()).toEqual(["/game", "/work/app"]);
  });

  it("are no longer read once the tree and panes have moved away", async () => {
    const { tf, calls } = fakeTf({ "/w/app/.foldertree": [name("a.js")] });
    const scanner = createScanner(tf);
    await scanner.scan("/w", NOW, listed("/w", ["app"]));
    calls.length = 0;
    await scanner.scan("/other", NOW + 1000, {});
    expect(calls).not.toContain("/w/app/.foldertree");
  });
});
