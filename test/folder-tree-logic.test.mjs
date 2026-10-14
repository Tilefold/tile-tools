// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree's logic — tests
 *
 * The tile's helpers: the "folders to skip" setting, what is left out, and
 * folder names for titles. The page's model: a `tree` message starts over;
 * opening a folder asks the tile once and shows the answer; closing and
 * opening again needs no new request; files and links are passed to the
 * tile to open; refresh asks again; and the rows to draw show depth, open
 * folders, and notes for loading, empty, cut-short and failed folders.
 */
import { describe, expect, it } from "vitest";
import { folderName, parseSkip, visibleEntries } from "../examples/folder-tree/src/tree.js";
import {
  childPath,
  initialState,
  pick,
  receive,
  refresh,
  rows,
  toggle,
} from "../examples/folder-tree/page/tree-model.js";

const dir = (name) => ({ name, kind: "dir" });
const file = (name) => ({ name, kind: "file" });

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

describe("Folder Tree page: the model", () => {
  /** The page after the tile sent /work/app with `src` and `README.md`. */
  const started = () =>
    receive(initialState(), {
      do: "tree",
      lang: "ar",
      dir: "rtl",
      strings: { empty: "Empty" },
      root: "/work/app",
      name: "app",
      listing: { path: "/work/app", entries: [dir("src"), file("README.md")], truncated: false },
    });

  it("builds child paths with the folder's own separator", () => {
    expect(childPath("/work", "a")).toBe("/work/a");
    expect(childPath("/", "a")).toBe("/a");
    expect(childPath("C:\\work", "a")).toBe("C:\\work\\a");
  });

  it("starts over from a tree message, in the tile's language", () => {
    const s = started();
    expect(s).toMatchObject({
      ready: true,
      lang: "ar",
      dir: "rtl",
      root: "/work/app",
      name: "app",
    });
    expect(rows(s).map((r) => r.path)).toEqual(["/work/app/src", "/work/app/README.md"]);
    // A tree without a folder shows nothing to click.
    const none = receive(s, { do: "tree", root: null, name: "No folder" });
    expect(none.root).toBeNull();
    expect(rows(none)).toEqual([]);
  });

  it("asks the tile for a folder once, then opens and closes it locally", () => {
    let step = toggle(started(), "/work/app/src");
    expect(step.send).toEqual({ do: "expand", path: "/work/app/src" });
    expect(rows(step.state)).toContainEqual({ note: "loading", depth: 1 });
    // A second click while it loads asks nothing more.
    expect(toggle(step.state, "/work/app/src").send).toBeUndefined();
    let s = receive(step.state, {
      do: "children",
      path: "/work/app/src",
      listing: { path: "/work/app/src", entries: [file("main.js")], truncated: true },
    });
    expect(rows(s).map((r) => r.note ?? `${r.depth}:${r.entry.name}`)).toEqual([
      "0:src",
      "1:main.js",
      "truncated",
      "0:README.md",
    ]);
    step = toggle(s, "/work/app/src");
    expect(step.send).toBeUndefined();
    expect(rows(step.state)).toHaveLength(2);
    s = toggle(step.state, "/work/app/src").state;
    expect(rows(s)).toHaveLength(4);
  });

  it("shows empty and failed folders as notes", () => {
    let s = receive(started(), {
      do: "children",
      path: "/work/app/src",
      listing: { path: "/work/app/src", entries: [], truncated: false },
    });
    expect(rows(s)).toContainEqual({ note: "empty", depth: 1 });
    s = receive(s, { do: "children", path: "/work/app/src", error: "Not allowed" });
    expect(rows(s)).toContainEqual({ note: "error", text: "Not allowed", depth: 1 });
  });

  it("passes files and links to the tile to open", () => {
    const s = started();
    expect(pick(s, "/work/app", file("README.md")).send).toEqual({
      do: "open",
      path: "/work/app/README.md",
    });
    expect(pick(s, "/work/app", { name: "docs", kind: "link" }).send).toEqual({
      do: "open",
      path: "/work/app/docs",
    });
    expect(pick(s, "/work/app", dir("src")).send).toEqual({ do: "expand", path: "/work/app/src" });
    expect(pick(s, "/work/app", { name: "sock", kind: "other" }).send).toBeUndefined();
  });

  it("asks for everything again on refresh, and ignores unknown messages", () => {
    const step = refresh(started());
    expect(step.send).toEqual({ do: "refresh" });
    expect(step.state.loading).toEqual(["/work/app"]);
    expect(receive(started(), { do: "dance" })).toEqual(started());
    expect(receive(started(), null)).toEqual(started());
  });
});
