// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — changing files (tests)
 *
 * The built tile against the fake host with file changes: New file makes a
 * free "untitled" name where the user last clicked and opens it ready to
 * edit; New folder likewise; the window renames, moves (by drag) and
 * trashes, and asks Tilefold, which asks the user, before the Trash;
 * refusals are notices in the user's language; the panel tints the chosen
 * row and offers the file actions as rows above the tree, naming the folder
 * they work in; nothing is recorded with a name; and an older Tilefold says
 * what it needs. Also the pure helpers: free names and finding an entry's folder.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "../fake-host.mjs";
import { freeName } from "../../examples/folder-tree/src/edits.js";
import { emptyTree, parentKey, withListing } from "../../examples/folder-tree/src/model.js";

const DIR = fileURLToPath(new URL("../../examples/folder-tree/", import.meta.url));

const FILES = ["/work/app/README.md", "/work/app/untitled.md", "/work/app/src/main.js"];

/** The tile with a pane in /work/app, able to change files, panel and window. */
const start = (opts = {}) =>
  startTile(DIR, {
    folders: { cwd: "/work/app", roots: ["/work/app"], files: FILES, write: true },
    panel: true,
    page: true,
    ...opts,
  });

const rowOf = (host, label) => host.panel.content.rows.find((r) => r.label === label);
const click = (host, label, action = "activate") =>
  host.emit("panel.click", { row: rowOf(host, label).id, action });
const message = (host, m) => host.emit("page.message", { message: m });
const lastState = (host) => host.page.posted.findLast((m) => m.type === "state");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Folder Tree changing files", () => {
  it("makes a new file with a free name where the user clicked, ready to edit", async () => {
    const host = await start();
    await host.command("toggle");
    await host.command("new-file");
    expect(host.changes).toEqual([["create", "/work/app/untitled 2.md"]]);
    expect(host.editing).toEqual(["/work/app/untitled 2.md"]);
    expect(rowOf(host, "untitled 2.md")).toBeDefined();
    // In a folder after clicking it, and next to a file after clicking that.
    await click(host, "src", "expand");
    await host.command("new-file");
    expect(host.changes.at(-1)).toEqual(["create", "/work/app/src/untitled.md"]);
    await click(host, "main.js");
    await host.command("new-folder");
    expect(host.changes.at(-1)).toEqual(["mkdir", "/work/app/src/untitled folder"]);
    expect(rowOf(host, "untitled folder")).toMatchObject({ icon: "folder", depth: 1 });
    expect(host.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["file-created", "folder-created"]),
    );
    expect(JSON.stringify(host.audits)).not.toContain("untitled");
  });

  it("tints the row the user last chose in the panel", async () => {
    const host = await start();
    await host.command("toggle");
    await click(host, "README.md");
    expect(rowOf(host, "README.md").tone).toBe("accent");
    expect(rowOf(host, "src").tone).toBeUndefined();
  });

  it("renames, moves and trashes from the window", async () => {
    const host = await start();
    await host.command("window");
    await message(host, { type: "rename", id: "/work/app/README.md", name: "NOTES.md" });
    expect(host.changes).toEqual([["rename", "/work/app/README.md", "/work/app/NOTES.md"]]);
    await message(host, { type: "move", id: "/work/app/NOTES.md", to: "/work/app/src" });
    expect(host.changes.at(-1)).toEqual(["move", "/work/app/NOTES.md", "/work/app/src/NOTES.md"]);
    await message(host, { type: "toggle", id: "/work/app/src", open: true });
    expect(lastState(host).tree.map((r) => r.name)).toContain("NOTES.md");
    await message(host, { type: "trash", id: "/work/app/src/NOTES.md" });
    expect(host.trashAsked).toEqual(["NOTES.md"]);
    expect(host.files).not.toContain("/work/app/src/NOTES.md");
    expect(lastState(host).tree.map((r) => r.name)).not.toContain("NOTES.md");
    expect(host.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["renamed", "moved", "trashed"]),
    );
  });

  it("leaves everything in place when the user keeps it", async () => {
    const host = await start();
    host.trashAnswer = false;
    await host.command("toggle");
    await click(host, "README.md");
    await host.command("trash");
    expect(host.trashAsked).toEqual(["README.md"]);
    expect(host.files).toContain("/work/app/README.md");
    expect(host.audits.map((a) => a.action)).not.toContain("trashed");
  });

  it("says why a change was refused, in the user's language", async () => {
    const host = await start();
    await host.command("window");
    await message(host, { type: "rename", id: "/work/app/README.md", name: "untitled.md" });
    expect(host.toasts.at(-1)).toBe("Something with that name is already there");
    await message(host, { type: "rename", id: "/work/app/README.md", name: "a/b" });
    expect(host.toasts.at(-1)).toBe("That name can't be used");
    expect(host.files).toContain("/work/app/README.md");
  });

  it("ignores window messages that don't name a known row", async () => {
    const host = await start();
    await host.command("window");
    await message(host, { type: "trash", id: "/home/secret.txt" });
    await message(host, { type: "rename", id: 42, name: "x" });
    await message(host, { type: "move", id: "/work/app/README.md".repeat(400), to: null });
    expect(host.trashAsked).toEqual([]);
    expect(host.changes).toEqual([]);
  });

  it("opens a file ready to edit from the window, and asks to rename from the palette", async () => {
    const host = await start();
    await host.command("window");
    await message(host, { type: "edit", id: "/work/app/README.md" });
    expect(host.editing).toEqual(["/work/app/README.md"]);
    await host.command("rename");
    expect(host.toasts.at(-1)).toBe("Click a file or folder in the tree first");
    await message(host, { type: "open", id: "/work/app/README.md" });
    await host.command("rename");
    expect(host.page.posted.at(-1)).toEqual({ type: "rename", id: "/work/app/README.md" });
    expect(lastState(host)).toMatchObject({ selected: "/work/app/README.md", canEdit: true });
  });

  it("says what it needs on a Tilefold that can't change files", async () => {
    const host = await start({
      folders: { cwd: "/work/app", roots: ["/work/app"], files: FILES },
    });
    await host.command("toggle");
    await host.command("new-file");
    expect(host.toasts.at(-1)).toBe(
      "Creating, renaming and moving files needs Tilefold 0.1.16 or later.",
    );
    await host.command("window");
    expect(lastState(host).canEdit).toBe(false);
  });
});

describe("Folder Tree's file actions in the panel", () => {
  const labels = (host) =>
    host.panel.content.rows.filter((r) => r.id.startsWith("action:")).map((r) => r.label);

  it("offers New file and New folder where the user last clicked", async () => {
    const host = await start();
    await host.command("toggle");
    expect(labels(host)).toEqual(["＋ New file in app", "＋ New folder in app"]);
    await click(host, "src", "expand");
    expect(labels(host)).toEqual([
      "＋ New file in src",
      "＋ New folder in src",
      "✎ Rename src…",
      "🗑 Move src to Trash",
    ]);
    await click(host, "README.md");
    expect(labels(host)[0]).toBe("＋ New file in app");
    expect(labels(host)[3]).toBe("🗑 Move README.md to Trash");
  });

  it("runs each action on the chosen row, without changing the choice", async () => {
    const host = await start();
    await host.command("toggle");
    await click(host, "src", "expand");
    await click(host, "＋ New file in src");
    expect(host.changes).toEqual([["create", "/work/app/src/untitled.md"]]);
    expect(host.editing).toEqual(["/work/app/src/untitled.md"]);
    await click(host, "＋ New folder in src");
    expect(host.changes.at(-1)).toEqual(["mkdir", "/work/app/src/untitled folder"]);
    expect(labels(host)[2]).toBe("✎ Rename src…");
    await click(host, "✎ Rename src…");
    expect(host.page.posted.at(-1)).toEqual({ type: "rename", id: "/work/app/src" });
    host.trashAnswer = false;
    await click(host, "🗑 Move src to Trash");
    expect(host.trashAsked).toEqual(["src"]);
  });

  it("are left out where Tilefold can't change files", async () => {
    const host = await start({
      folders: { cwd: "/work/app", roots: ["/work/app"], files: FILES },
    });
    await host.command("toggle");
    expect(labels(host)).toEqual([]);
  });
});

describe("Folder Tree edit helpers", () => {
  it("find a free name, as Finder numbers them, without case", () => {
    expect(freeName([], "untitled.md")).toBe("untitled.md");
    expect(freeName(["untitled.md"], "untitled.md")).toBe("untitled 2.md");
    expect(freeName(["Untitled.md", "untitled 2.md"], "untitled.md")).toBe("untitled 3.md");
    expect(freeName(["untitled folder"], "untitled folder")).toBe("untitled folder 2");
    expect(freeName([".env"], ".env")).toBe(".env 2");
  });

  it("find the folder an entry was listed in", () => {
    let tree = emptyTree("/work/app");
    tree = withListing(tree, "/work/app", { path: "/real/app", entries: [] });
    tree = withListing(tree, "/real/app/src", { path: "/real/app/src", entries: [] });
    expect(parentKey(tree, "/real/app/README.md")).toBe("/work/app");
    expect(parentKey(tree, "/real/app/src/main.js")).toBe("/real/app/src");
    expect(parentKey(tree, "/elsewhere/x")).toBeNull();
  });
});
