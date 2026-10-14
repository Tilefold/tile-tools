// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — tests
 *
 * The built tile, run against the fake host: Show opens the window and
 * sends the focused pane's folder as a tree, with the page's text, hidden
 * names and skipped folders left out (until the settings say otherwise);
 * the page's `ready`, `expand`, `open` and `refresh` are answered; a file
 * opens in the viewer, a link to a folder is listed instead; errors reach
 * the page in the user's language; the tree follows the focused pane while
 * the window is open, and not after it closed; a pane without a known
 * folder says so; and an older Tilefold gets a notice instead of a crash.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";

const DIR = fileURLToPath(new URL("../examples/folder-tree/", import.meta.url));

/** A project in /work/app with a hidden folder, node_modules and a few files. */
const FILES = [
  "/work/app/README.md",
  "/work/app/src/main.js",
  "/work/app/src/lib/util.js",
  "/work/app/.git/HEAD",
  "/work/app/node_modules/x/index.js",
  "/work/other/notes.txt",
  "/home/secret.txt",
];

/** The tile with a pane in /work/app (and one in /work/other), and its page. */
const start = (opts = {}) =>
  startTile(DIR, {
    folders: { cwd: "/work/app", roots: ["/work/app", "/work/other"], files: FILES },
    page: true,
    ...opts,
  });

/** The names in a posted listing. */
const names = (message) => message.listing.entries.map((e) => e.name);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Folder Tree", () => {
  it("shows the focused pane's folder as a tree, with its text", async () => {
    const host = await start();
    await host.command("show");
    expect(host.page.opens).toEqual([{ keepRunning: false }]);
    const tree = host.page.posted.at(-1);
    expect(tree).toMatchObject({
      do: "tree",
      lang: "en",
      dir: "ltr",
      root: "/work/app",
      name: "app",
    });
    expect(tree.strings).toEqual({
      refresh: "Refresh",
      loading: "Loading…",
      empty: "Empty folder",
      truncated: "Only the first 2,000 entries are shown",
      noFolder: expect.stringContaining("doesn't know which folder"),
    });
    // Folders first; hidden names and node_modules left out.
    expect(names(tree)).toEqual(["src", "README.md"]);
    expect(host.audits).toEqual([{ action: "shown", details: { hasFolder: true } }]);
  });

  it("answers the page: ready, expand, open and refresh", async () => {
    const host = await start();
    await host.command("show");
    await host.emit("page.message", { message: { do: "expand", path: "/work/app/src" } });
    expect(host.page.posted.at(-1)).toMatchObject({ do: "children", path: "/work/app/src" });
    expect(names(host.page.posted.at(-1))).toEqual(["lib", "main.js"]);
    await host.emit("page.message", { message: { do: "open", path: "/work/app/src/main.js" } });
    expect(host.opened).toEqual(["/work/app/src/main.js"]);
    const before = host.page.posted.length;
    await host.emit("page.message", { message: { do: "ready" } });
    await host.emit("page.message", { message: { do: "refresh" } });
    expect(host.page.posted.slice(before).map((m) => m.do)).toEqual(["tree", "tree"]);
    // Anything else is ignored.
    await host.emit("page.message", { message: { do: "expand" } });
    await host.emit("page.message", { message: "nonsense" });
    expect(host.page.posted).toHaveLength(before + 2);
  });

  it("lists a link that leads to a folder instead of opening it", async () => {
    const host = await start();
    await host.command("show");
    // The fake viewer refuses folders the way Tilefold does.
    await host.emit("page.message", { message: { do: "open", path: "/work/app/src/lib" } });
    expect(host.opened).toEqual([]);
    expect(host.page.posted.at(-1)).toMatchObject({ do: "children", path: "/work/app/src/lib" });
    expect(names(host.page.posted.at(-1))).toEqual(["util.js"]);
  });

  it("explains refusals in the page, in the user's language", async () => {
    const host = await start({ locale: "de" });
    await host.command("show");
    await host.emit("page.message", { message: { do: "expand", path: "/home" } });
    expect(host.page.posted.at(-1)).toEqual({
      do: "children",
      path: "/home",
      error: "Nicht in einem Ordner Ihrer Bereiche",
    });
    await host.emit("page.message", { message: { do: "open", path: "/work/app/gone.txt" } });
    expect(host.page.posted.at(-1).error).toMatch(/Nicht mehr vorhanden/);
    expect(host.opened).toEqual([]);
  });

  it("shows hidden names and skipped folders when the settings say so", async () => {
    const host = await start();
    await host.command("show");
    await host.setSetting("showHidden", true);
    expect(names(host.page.posted.at(-1))).toEqual([".git", "src", "README.md"]);
    await host.setSetting("skipFolders", "src, .git");
    expect(names(host.page.posted.at(-1))).toEqual(["node_modules", "README.md"]);
  });

  it("follows the focused pane while the window is open", async () => {
    const host = await start();
    await host.command("show");
    await host.emit("pane.cwd", { path: "/work/other" });
    expect(host.page.posted.at(-1)).toMatchObject({
      do: "tree",
      root: "/work/other",
      name: "other",
    });
    expect(names(host.page.posted.at(-1))).toEqual(["notes.txt"]);
    // The same folder again sends nothing; after closing, nothing is sent.
    const sent = host.page.posted.length;
    await host.emit("pane.cwd", { path: "/work/other" });
    await host.emit("page.closed");
    host.page.open = false;
    await host.emit("pane.cwd", { path: "/work/app" });
    expect(host.page.posted).toHaveLength(sent);
  });

  it("says when the pane's folder isn't known", async () => {
    const host = await start({ folders: { cwd: null, roots: [], files: FILES } });
    await host.command("show");
    const tree = host.page.posted.at(-1);
    expect(tree).toMatchObject({ do: "tree", root: null, name: "No folder" });
    expect(tree.listing).toBeUndefined();
    expect(host.audits).toEqual([{ action: "shown", details: { hasFolder: false } }]);
  });

  it("asks for a newer Tilefold where folders or pages are missing", async () => {
    const host = await startTile(DIR, {});
    await host.command("show");
    expect(host.toasts).toEqual(["Folder Tree needs Tilefold 0.1.9 or later."]);
    // Events from an older Tilefold change nothing.
    await host.emit("pane.cwd", { path: "/x" });
    await host.emit("page.message", { message: { do: "ready" } });
  });
});
