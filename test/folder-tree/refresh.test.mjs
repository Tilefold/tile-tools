// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — keeping the tree current (refresh.js)
 *
 * The folders listed again are the tree's own and the open ones, the tree's
 * first, at most MAX_RELIST; two listings are the same when their names,
 * kinds and cut-short mark match, in any order; listing again returns the
 * same tree when nothing changed, a new one when something did, and an
 * error in place of a folder that can't be listed any more.
 */
import { describe, expect, it } from "vitest";
import { emptyTree, opened, withListing } from "../../examples/folder-tree/src/model.js";
import {
  MAX_RELIST,
  relistShown,
  sameLevel,
  shownFolders,
} from "../../examples/folder-tree/src/refresh.js";

const listing = (path, names) => ({
  path,
  entries: names.map((n) =>
    n.endsWith("/") ? { name: n.slice(0, -1), kind: "dir" } : { name: n, kind: "file" },
  ),
});

/** /w with src open and docs listed but closed. */
function tree() {
  let t = withListing(emptyTree("/w"), "/w", listing("/w", ["src/", "docs/", "a.md"]));
  t = opened(withListing(t, "/w/src", listing("/w/src", ["main.js"])), "/w/src");
  return withListing(t, "/w/docs", listing("/w/docs", ["x.md"]));
}

describe("keeping the tree current", () => {
  it("lists the tree's own folder and the open ones, capped", () => {
    expect(shownFolders(tree())).toEqual(["/w", "/w/src"]);
    let big = tree();
    for (let i = 0; i < MAX_RELIST + 5; i++) {
      big = opened(withListing(big, `/w/d${i}`, listing(`/w/d${i}`, [])), `/w/d${i}`);
    }
    const shown = shownFolders(big);
    expect(shown).toHaveLength(MAX_RELIST);
    expect(shown[0]).toBe("/w");
  });

  it("compares listings by names, kinds and cut-short, in any order", () => {
    const a = {
      path: "/w",
      entries: [
        { name: "a", kind: "file" },
        { name: "b", kind: "dir" },
      ],
    };
    expect(sameLevel(a, { ...a, entries: [...a.entries].reverse() })).toBe(true);
    expect(sameLevel(a, { ...a, entries: [{ name: "a", kind: "dir" }, a.entries[1]] })).toBe(false);
    expect(sameLevel(a, { ...a, truncated: true })).toBe(false);
    expect(sameLevel({ error: "x" }, { error: "x" })).toBe(true);
    expect(sameLevel({ error: "x" }, a)).toBe(false);
    expect(sameLevel(undefined, undefined)).toBe(true);
  });

  it("keeps the same tree when nothing changed, and a new one when something did", async () => {
    const t = tree();
    const same = await relistShown(
      t,
      async (k) => listing(k, k === "/w" ? ["a.md", "docs/", "src/"] : ["main.js"]),
      String,
    );
    expect(same).toBe(t);
    const asked = [];
    const next = await relistShown(
      t,
      async (k) => {
        asked.push(k);
        return listing(k, k === "/w" ? ["src/", "docs/", "a.md", "new.md"] : ["main.js"]);
      },
      String,
    );
    expect(asked).toEqual(["/w", "/w/src"]);
    expect(next).not.toBe(t);
    expect(next.folders["/w"].entries.map((e) => e.name)).toContain("new.md");
    expect(next.open).toEqual(t.open);
  });

  it("shows why a folder can't be listed any more", async () => {
    const next = await relistShown(
      tree(),
      async (k) => {
        if (k === "/w/src") throw Object.assign(new Error("gone"), { name: "NotFoundError" });
        return listing(k, ["src/", "docs/", "a.md"]);
      },
      () => "Not there any more",
    );
    expect(next.folders["/w/src"]).toEqual({ error: "Not there any more" });
  });
});
