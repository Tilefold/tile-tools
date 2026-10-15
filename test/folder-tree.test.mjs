// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — tests
 *
 * The built tile, run against the fake host with panels and folders:
 * Show or hide docks the focused pane's folder as a tree (folders first,
 * hidden names and skipped folders left out until the settings say
 * otherwise) and hides it again; clicking a folder lists and opens it,
 * clicking again closes it without asking again; a file opens in the
 * viewer; a link to a folder is listed and opened like one; errors appear
 * in the tree or as a notice, in the user's language; the tree follows
 * the focused pane while shown; refresh starts over; closing the panel
 * stops the drawing; a pane without a known folder says so; and an older
 * Tilefold gets a notice instead of a crash.
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

/** The tile with a pane in /work/app (and one in /work/other). */
const start = (opts = {}) =>
  startTile(DIR, {
    folders: { cwd: "/work/app", roots: ["/work/app", "/work/other"], files: FILES },
    panel: true,
    ...opts,
  });

/** The docked rows as "depth:label" (notes as "depth:(label)"). */
const lines = (host) =>
  host.panel.content.rows.map((r) => `${r.depth}:${r.muted ? `(${r.label})` : r.label}`);
/** The row with this label. */
const rowOf = (host, label) => host.panel.content.rows.find((r) => r.label === label);
/** Clicks a row as Tilefold reports it. */
const click = (host, label, action = "activate") =>
  host.emit("panel.click", { row: rowOf(host, label).id, action });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Folder Tree", () => {
  it("docks the focused pane's folder as a tree, and hides it again", async () => {
    const host = await start();
    await host.command("toggle");
    expect(host.panel.content).toMatchObject({ title: "app", subtitle: "/work/app" });
    expect(lines(host)).toEqual(["0:src", "0:README.md"]);
    expect(rowOf(host, "src")).toMatchObject({
      id: "/work/app/src",
      icon: "folder",
      expandable: true,
      expanded: false,
    });
    expect(rowOf(host, "README.md")).toMatchObject({ icon: "file", hint: "/work/app/README.md" });
    expect(host.audits).toEqual([{ action: "shown", details: { hasFolder: true, window: false } }]);
    await host.command("toggle");
    expect(host.panel.content).toBeNull();
  });

  it("opens and closes folders, listing each only once", async () => {
    const host = await start();
    await host.command("toggle");
    await click(host, "src", "expand");
    expect(lines(host)).toEqual(["0:src", "1:lib", "1:main.js", "0:README.md"]);
    expect(rowOf(host, "src").expanded).toBe(true);
    await click(host, "src");
    expect(lines(host)).toEqual(["0:src", "0:README.md"]);
    const shows = host.panel.shows;
    await click(host, "src", "expand");
    // Already listed: one redraw, no loading step.
    expect(host.panel.shows).toBe(shows + 1);
    expect(lines(host)).toContain("1:main.js");
  });

  it("opens a clicked file in the viewer", async () => {
    const host = await start();
    await host.command("toggle");
    await click(host, "README.md");
    expect(host.opened).toEqual(["/work/app/README.md"]);
  });

  it("opens a link to a file, and lists a link to a folder like one", async () => {
    const host = await start({
      folders: {
        cwd: "/work/app",
        roots: ["/work/app"],
        files: FILES,
        links: { "/work/app/code": "/work/app/src", "/work/app/notes": "/work/app/README.md" },
      },
    });
    await host.command("toggle");
    expect(rowOf(host, "code")).toMatchObject({ icon: "link", expandable: false });
    await click(host, "notes");
    expect(host.opened).toEqual(["/work/app/README.md"]);
    await click(host, "code");
    expect(rowOf(host, "code")).toMatchObject({ icon: "link", expandable: true, expanded: true });
    expect(lines(host)).toContain("1:main.js");
    await click(host, "code", "collapse");
    expect(lines(host)).not.toContain("1:main.js");
  });

  it("shows errors in the tree, and as a notice for files, in the user's language", async () => {
    const host = await start({ locale: "de" });
    await host.command("toggle");
    host.files.splice(host.files.indexOf("/work/app/src/main.js"), 1);
    host.files.splice(host.files.indexOf("/work/app/src/lib/util.js"), 1);
    await click(host, "src", "expand");
    expect(lines(host)).toContain(
      "1:(Nicht mehr vorhanden: aktualisieren, um den Ordner so zu sehen, wie er jetzt ist)",
    );
    expect(
      rowOf(
        host,
        "Nicht mehr vorhanden: aktualisieren, um den Ordner so zu sehen, wie er jetzt ist",
      ).icon,
    ).toBe("error");
    host.files.splice(host.files.indexOf("/work/app/README.md"), 1);
    await click(host, "README.md");
    expect(host.toasts).toEqual([
      "Nicht mehr vorhanden: aktualisieren, um den Ordner so zu sehen, wie er jetzt ist",
    ]);
    expect(host.opened).toEqual([]);
  });

  it("shows hidden names and skipped folders when the settings say so", async () => {
    const host = await start();
    await host.command("toggle");
    await host.setSetting("showHidden", true);
    expect(lines(host)).toEqual(["0:.git", "0:src", "0:README.md"]);
    await host.setSetting("skipFolders", "src, .git");
    expect(lines(host)).toEqual(["0:node_modules", "0:README.md"]);
  });

  it("follows the focused pane while shown, and starts over on refresh", async () => {
    const host = await start();
    await host.command("toggle");
    await click(host, "src", "expand");
    await host.emit("pane.cwd", { path: "/work/other" });
    expect(host.panel.content).toMatchObject({ title: "other", subtitle: "/work/other" });
    expect(lines(host)).toEqual(["0:notes.txt"]);
    await host.emit("pane.cwd", { path: "/work/app" });
    await click(host, "src", "expand");
    await host.command("refresh");
    expect(lines(host)).toEqual(["0:src", "0:README.md"]);
  });

  it("stops drawing when the user closes the panel", async () => {
    const host = await start();
    await host.command("toggle");
    await host.emit("panel.closed", { by: "user" });
    host.panel.content = null;
    const shows = host.panel.shows;
    await host.emit("pane.cwd", { path: "/work/other" });
    await host.setSetting("showHidden", true);
    expect(host.panel.shows).toBe(shows);
    // Showing again starts from the pane's folder as it is now.
    host.cwd = "/work/other";
    await host.command("toggle");
    expect(host.panel.content.title).toBe("other");
  });

  it("says when the pane's folder isn't known", async () => {
    const host = await start({ folders: { cwd: null, roots: [], files: FILES } });
    await host.command("toggle");
    expect(host.panel.content.title).toBe("No folder");
    expect(host.panel.content.subtitle).toBeUndefined();
    expect(lines(host)).toEqual([
      "0:(Tilefold doesn't know which folder this pane is in yet. Run a command in it, or open a new pane.)",
    ]);
    expect(host.audits).toEqual([
      { action: "shown", details: { hasFolder: false, window: false } },
    ]);
  });

  it("asks for a newer Tilefold where panels or folders are missing", async () => {
    const host = await startTile(DIR, {});
    await host.command("toggle");
    await host.command("refresh");
    expect(host.toasts).toEqual([
      "Folder Tree needs Tilefold 0.1.9 or later.",
      "Folder Tree needs Tilefold 0.1.9 or later.",
    ]);
    // Events from an older Tilefold change nothing.
    await host.emit("pane.cwd", { path: "/x" });
    await host.emit("panel.click", { row: "/x", action: "activate" });
  });
});
