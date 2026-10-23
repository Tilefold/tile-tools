// @vitest-environment jsdom
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree's window — file tools (tests)
 *
 * The window's own page code (page-src/) in a DOM, with a fake bridge: the
 * toolbar shows only where Tilefold can change files and follows the chosen
 * row; New file and New folder send the chosen row; renaming happens in
 * place (Enter sends the new name, Escape sends nothing) and the tree isn't
 * redrawn under it; the tile can ask for a rename before the row is drawn;
 * dropping a row on a folder or the Files heading moves it; F2 and ⌘⌫ work
 * on the chosen row; and names only ever arrive as text.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// jsdom has its own URL; Node's is the one fileURLToPath takes.
const PAGE = fileURLToPath(new NodeURL("../../examples/folder-tree/page/", import.meta.url));

const sent = [];
let deliver = null;

/** Strings as the tile posts them (only what the page reads). */
const STRINGS = {
  type: "strings",
  lang: "en",
  dir: "ltr",
  now: "Now",
  files: "Files",
  recent: "Recent",
  live: "Agents at work",
  idle: "Quiet",
  emptyNow: "No agent",
  emptyRecent: "Nothing yet",
  showAll: "Show all §",
  showFewer: "Show fewer",
  panes: "§ panes",
  busy: "§ files",
  doing: { r: "reading", e: "editing", a: "adding", d: "deleting" },
  ago: { s: "§s", m: "§m", h: "§h", d: "§d" },
  edit: {
    newFile: "New file",
    newFolder: "New folder",
    rename: "Rename",
    edit: "Edit",
    trash: "Move to Trash",
    nameLabel: "New name",
    tools: "File tools",
  },
  setup: {
    title: "t",
    intro: "i",
    claude: "c",
    codex: "x",
    other: "o",
    copy: "Copy",
    copied: "Copied",
    close: "Done",
    open: "Set up",
    command: "node hooks/install.mjs",
  },
};

/** A state with a folder and two files; `selected` is the chosen row. */
const state = (over = {}) => ({
  type: "state",
  title: "app",
  root: "/work/app",
  live: false,
  now: [],
  recent: [],
  panes: 0,
  activity: false,
  canEdit: true,
  selected: null,
  tree: [
    { id: "/work/app/src", name: "src", depth: 0, kind: "dir", expandable: true, expanded: false },
    { id: "/work/app/README.md", name: "README.md", depth: 0, kind: "file" },
    { id: "/work/app/<b>x</b>.md", name: "<b>x</b>.md", depth: 0, kind: "file" },
  ],
  ...over,
});

const post = async (m) => {
  deliver(m);
  await Promise.resolve();
};
const button = (id) => document.querySelector(`[data-id="${CSS.escape(id)}"]`);
const drop = (target, id) => {
  const data = new Map([["application/x-folder-tree-row", id]]);
  const dataTransfer = {
    types: [...data.keys()],
    getData: (t) => data.get(t) ?? "",
    setData: (t, v) => data.set(t, v),
  };
  for (const type of ["dragover", "drop"]) {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, "dataTransfer", { value: dataTransfer });
    target.dispatchEvent(e);
  }
};

beforeAll(async () => {
  const html = readFileSync(`${PAGE}index.html`, "utf8");
  document.body.innerHTML = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
  globalThis.CSS ??= { escape: (s) => s.replace(/["\\]/g, "\\$&") };
  HTMLDialogElement.prototype.showModal ??= function () {};
  window.tilefold = {
    post: async (m) => void sent.push(m),
    onMessage: (fn) => void (deliver = fn),
  };
  await import("../../examples/folder-tree/page-src/main.js");
  await post(STRINGS);
});

beforeEach(() => {
  sent.length = 0;
});

describe("Folder Tree window tools", () => {
  it("show only where Tilefold can change files, and follow the chosen row", async () => {
    await post(state({ canEdit: false }));
    expect(document.getElementById("tools").hidden).toBe(true);
    expect(button("/work/app/README.md").draggable).toBe(false);
    await post(state());
    expect(document.getElementById("tools").hidden).toBe(false);
    expect(document.getElementById("tool-rename").disabled).toBe(true);
    await post(state({ selected: "/work/app/README.md" }));
    expect(document.getElementById("tool-edit").disabled).toBe(false);
    expect(button("/work/app/README.md").classList.contains("chosen")).toBe(true);
    await post(state({ selected: "/work/app/src" }));
    expect(document.getElementById("tool-edit").disabled).toBe(true);
    expect(document.getElementById("tool-trash").disabled).toBe(false);
  });

  it("send New file and New folder for the chosen row", async () => {
    await post(state({ selected: "/work/app/src" }));
    document.getElementById("tool-new-file").click();
    document.getElementById("tool-new-folder").click();
    expect(sent).toEqual([
      { type: "new-file", id: "/work/app/src" },
      { type: "new-folder", id: "/work/app/src" },
    ]);
  });

  it("rename in place: Enter sends the name, Escape nothing", async () => {
    await post(state({ selected: "/work/app/README.md" }));
    document.getElementById("tool-rename").click();
    let field = document.querySelector("input.rename");
    expect(field.value).toBe("README.md");
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 6]);
    // A redraw while typing leaves the field alone.
    await post(state({ selected: "/work/app/README.md" }));
    expect(document.querySelector("input.rename")).toBe(field);
    field.value = "NOTES.md";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(sent).toEqual([{ type: "rename", id: "/work/app/README.md", name: "NOTES.md" }]);
    expect(document.querySelector("input.rename")).toBeNull();
    document.getElementById("tool-rename").click();
    field = document.querySelector("input.rename");
    field.value = "other.md";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(sent).toHaveLength(1);
  });

  it("start a rename the tile asked for, once the row is drawn", async () => {
    await post({ type: "rename", id: "/work/app/later.md" });
    expect(document.querySelector("input.rename")).toBeNull();
    const tree = state().tree;
    await post(
      state({
        tree: [...tree, { id: "/work/app/later.md", name: "later.md", depth: 0, kind: "file" }],
      }),
    );
    await Promise.resolve();
    expect(document.querySelector("input.rename")?.value).toBe("later.md");
    document
      .querySelector("input.rename")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

  it("move a dropped row into a folder, or into the tree's folder", async () => {
    await post(state());
    drop(button("/work/app/src"), "/work/app/README.md");
    drop(document.getElementById("files-title"), "/work/app/src/main.js");
    expect(sent).toEqual([
      { type: "move", id: "/work/app/README.md", to: "/work/app/src" },
      { type: "move", id: "/work/app/src/main.js", to: null },
    ]);
  });

  it("rename with F2 and trash with ⌘⌫ or Delete", async () => {
    await post(state({ selected: "/work/app/README.md" }));
    const tree = document.getElementById("tree");
    tree.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", metaKey: true, bubbles: true }),
    );
    tree.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    tree.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(sent).toEqual([
      { type: "trash", id: "/work/app/README.md" },
      { type: "trash", id: "/work/app/README.md" },
    ]);
    tree.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
    const field = document.querySelector("input.rename");
    expect(field).not.toBeNull();
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

  it("show names as text, never as markup", async () => {
    await post(state());
    const row = button("/work/app/<b>x</b>.md");
    expect(row.querySelector("b")).toBeNull();
    expect(row.textContent).toContain("<b>x</b>.md");
  });
});
