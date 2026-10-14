// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree's logic — tests
 *
 * The helpers: the "folders to skip" setting, what is left out, folder
 * names for titles. The tree model: child paths keep the folder's
 * separator; a folder being listed shows open with a loading note; a
 * listing or an error replaces the note; folders open and close; the rows
 * carry ids, icons, indent and hints, notes for empty, cut-short and failed
 * folders and for no folder at all, filters apply, a link becomes a folder
 * once it has been listed as one; and the targets map each clickable row.
 */
import { describe, expect, it } from "vitest";
import {
  childPath,
  closed,
  emptyTree,
  isLoaded,
  opened,
  startLoading,
  treeRows,
  withError,
  withListing,
} from "../examples/folder-tree/src/model.js";
import { folderName, parseSkip, visibleEntries } from "../examples/folder-tree/src/tree.js";

const dir = (name) => ({ name, kind: "dir" });
const file = (name) => ({ name, kind: "file" });
const link = (name) => ({ name, kind: "link" });

const STRINGS = { loading: "Loading", empty: "Empty", truncated: "Cut", noFolder: "None" };
const FILTERS = { showHidden: false, skip: new Set(["node_modules"]) };
/** The rows as "depth:label" (notes as "depth:(label)"). */
const lines = (tree, filters = FILTERS) =>
  treeRows(tree, { strings: STRINGS, filters }).rows.map(
    (r) => `${r.depth}:${r.muted ? `(${r.label})` : r.label}`,
  );

describe("Folder Tree: what to show", () => {
  it("reads the folders to skip, ignoring paths and blanks", () => {
    expect([...parseSkip(" node_modules, target  dist,,")]).toEqual([
      "node_modules",
      "target",
      "dist",
    ]);
    expect([...parseSkip("a/b, ..\\x, ok")]).toEqual(["ok"]);
    expect(parseSkip(undefined).size).toBe(0);
    expect(parseSkip(Array.from({ length: 80 }, (_, i) => `f${i}`).join(",")).size).toBe(50);
  });

  it("leaves out hidden names and skipped folders, but not skipped files", () => {
    const entries = [
      dir(".git"),
      dir("node_modules"),
      dir("src"),
      file(".env"),
      file("node_modules"),
    ];
    expect(visibleEntries(entries, { skip: new Set(["node_modules"]) }).map((e) => e.name)).toEqual(
      ["src", "node_modules"],
    );
    expect(visibleEntries(entries, { showHidden: true }).map((e) => e.name)).toEqual([
      ".git",
      "node_modules",
      "src",
      ".env",
      "node_modules",
    ]);
  });

  it("names folders by their last part", () => {
    expect(folderName("/work/app")).toBe("app");
    expect(folderName("/work/app/")).toBe("app");
    expect(folderName("C:\\work\\app")).toBe("app");
    expect(folderName("/")).toBe("/");
  });
});

describe("Folder Tree: the tree", () => {
  /** /work/app listed with src, node_modules, .git and README.md. */
  const listed = () =>
    withListing(startLoading(emptyTree("/work/app"), "/work/app"), "/work/app", {
      path: "/work/app",
      entries: [dir(".git"), dir("node_modules"), dir("src"), file("README.md")],
      truncated: false,
    });

  it("builds child paths with the folder's own separator", () => {
    expect(childPath("/work", "a")).toBe("/work/a");
    expect(childPath("/", "a")).toBe("/a");
    expect(childPath("C:\\work", "a")).toBe("C:\\work\\a");
  });

  it("shows a folder loading, then its entries with filters applied", () => {
    const loading = startLoading(emptyTree("/work/app"), "/work/app");
    expect(lines(loading)).toEqual(["0:(Loading)"]);
    expect(lines(listed())).toEqual(["0:src", "0:README.md"]);
    expect(lines(listed(), { showHidden: true, skip: new Set() })).toEqual([
      "0:.git",
      "0:node_modules",
      "0:src",
      "0:README.md",
    ]);
  });

  it("opens and closes folders, with notes for empty, cut-short and failed ones", () => {
    let tree = startLoading(listed(), "/work/app/src");
    expect(lines(tree)).toEqual(["0:src", "1:(Loading)", "0:README.md"]);
    tree = withListing(tree, "/work/app/src", {
      path: "/work/app/src",
      entries: [],
      truncated: true,
    });
    expect(lines(tree)).toEqual(["0:src", "1:(Empty)", "1:(Cut)", "0:README.md"]);
    tree = withError(tree, "/work/app/src", "Gone");
    expect(lines(tree)).toEqual(["0:src", "1:(Gone)", "0:README.md"]);
    expect(isLoaded(tree, "/work/app/src")).toBe(true);
    tree = closed(tree, "/work/app/src");
    expect(lines(tree)).toEqual(["0:src", "0:README.md"]);
    expect(lines(opened(tree, "/work/app/src"))).toContain("1:(Gone)");
  });

  it("gives each row its id, icon, hint and state, and maps the clickable ones", () => {
    let tree = startLoading(listed(), "/work/app/src");
    tree = withListing(tree, "/work/app/src", {
      path: "/work/app/src",
      entries: [file("main.rs"), link("shared")],
      truncated: false,
    });
    const { rows, targets } = treeRows(tree, { strings: STRINGS, filters: FILTERS });
    expect(rows[0]).toEqual({
      id: "/work/app/src",
      label: "src",
      icon: "folder",
      depth: 0,
      expandable: true,
      expanded: true,
      hint: "/work/app/src",
    });
    expect(rows[1]).toMatchObject({
      id: "/work/app/src/main.rs",
      icon: "file",
      depth: 1,
      expandable: false,
    });
    expect(rows[2]).toMatchObject({ id: "/work/app/src/shared", icon: "link", expandable: false });
    expect([...targets]).toEqual([
      ["/work/app/src", { kind: "dir", path: "/work/app/src" }],
      ["/work/app/src/main.rs", { kind: "file", path: "/work/app/src/main.rs" }],
      ["/work/app/src/shared", { kind: "link", path: "/work/app/src/shared" }],
      ["/work/app/README.md", { kind: "file", path: "/work/app/README.md" }],
    ]);
    // A link listed as a folder opens like one.
    tree = withListing(startLoading(tree, "/work/app/src/shared"), "/work/app/src/shared", {
      path: "/work/lib",
      entries: [file("x.js")],
      truncated: false,
    });
    const after = treeRows(tree, { strings: STRINGS, filters: FILTERS });
    expect(after.rows.find((r) => r.label === "shared")).toMatchObject({
      icon: "link",
      expandable: true,
      expanded: true,
    });
    expect(after.targets.get("/work/app/src/shared").kind).toBe("dir");
    // Children of a link are built from where it leads.
    expect(after.rows.find((r) => r.label === "x.js").id).toBe("/work/lib/x.js");
  });

  it("says so when no folder is known", () => {
    expect(lines(emptyTree(null))).toEqual(["0:(None)"]);
    expect(treeRows(emptyTree(null), { strings: STRINGS, filters: FILTERS }).targets.size).toBe(0);
  });
});
