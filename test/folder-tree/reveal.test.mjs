// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — showing the viewer's file — tests
 *
 * The folders from the tree's folder down to a file are worked out (none
 * for a file outside it or a path that climbs out); when the document
 * viewer shows a file (`viewer.opened`) the shown tree opens the folders
 * down to it, listing those it hadn't, and chooses it; a file outside the
 * tree's folder, a hidden tree, or a bad event changes nothing.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { foldersTo } from "../../examples/folder-tree/src/reveal.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/folder-tree/", import.meta.url));

const FILES = [
  "/work/app/README.md",
  "/work/app/src/main.js",
  "/work/app/src/lib/util.js",
  "/work/other/notes.txt",
];

const start = () =>
  startTile(DIR, {
    folders: { cwd: "/work/app", roots: ["/work/app", "/work/other"], files: FILES },
    panel: true,
  });

/** The tree's rows (after the "Now" section, when it is there). */
const treeRows = (host) => {
  const rows = host.panel.content.rows;
  const files = rows.findIndex((r) => r.id === "files");
  return files < 0 ? rows : rows.slice(files + 1);
};
const lines = (host) => treeRows(host).map((r) => `${r.depth}:${r.label}`);
const rowOf = (host, label) => host.panel.content.rows.find((r) => r.label === label);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the folders down to a file", () => {
  it("runs from the tree's folder to the file's own", () => {
    expect(foldersTo("/work/app", "/work/app/src/lib/util.js")).toEqual([
      "/work/app",
      "/work/app/src",
      "/work/app/src/lib",
    ]);
    expect(foldersTo("/work/app/", "/work/app/README.md")).toEqual(["/work/app/"]);
  });

  it("has none for a file outside, or a path that climbs out", () => {
    expect(foldersTo("/work/app", "/work/other/notes.txt")).toBeNull();
    expect(foldersTo("/work/app", "/work/apple/x.js")).toBeNull();
    expect(foldersTo("/work/app", "/work/app/../other/notes.txt")).toBeNull();
    expect(foldersTo(null, "/work/app/a.js")).toBeNull();
    expect(foldersTo("/work/app", 5)).toBeNull();
  });
});

describe("the viewer's file in the tree", () => {
  it("opens the folders down to it and chooses it", async () => {
    const host = await start();
    await host.command("toggle");
    expect(lines(host)).toEqual(["0:src", "0:README.md"]);
    await host.emit("viewer.opened", { path: "/work/app/src/lib/util.js" });
    expect(lines(host)).toEqual(["0:src", "1:lib", "2:util.js", "1:main.js", "0:README.md"]);
    expect(rowOf(host, "util.js").tone).toBe("accent");
  });

  it("leaves the tree alone for a file outside it, a bad event, or while hidden", async () => {
    const host = await start();
    await host.command("toggle");
    await host.emit("viewer.opened", { path: "/work/other/notes.txt" });
    await host.emit("viewer.opened", {});
    await host.emit("viewer.opened", { path: "/work/app/../other/notes.txt" });
    expect(lines(host)).toEqual(["0:src", "0:README.md"]);
    await host.command("toggle");
    await host.emit("viewer.opened", { path: "/work/app/src/main.js" });
    await host.command("toggle");
    expect(lines(host)).toEqual(["0:src", "0:README.md"]);
  });
});
