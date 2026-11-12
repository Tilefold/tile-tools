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
 * on the chosen row; a click only ever opens (a double-click opens twice);
 * a right-click on a file or folder opens its menu (Open and Edit for a
 * file, Rename… and Move to Trash), which acts on that row, closes with
 * Escape or a press outside, and opens from Shift+F10 too; and names only
 * ever arrive as text.
 *
 * Modified 2026-11-11 (rename from the menu): renaming moved from the
 *   second click to the right-click menu.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
    renameMenu: "Rename…",
    open: "Open",
    edit: "Edit",
    trash: "Move to Trash",
    nameLabel: "New name",
    tools: "File tools",
  },
  view: {
    label: "What the tree shows",
    following: "Following the pane",
    pinned: "Pinned on this folder",
    gone: "No pane is in this folder any more",
    up: "Up to §",
    follow: "Follow the pane",
    pin: "Pin this folder",
    showOnly: "Show only this folder",
    elsewhere: "Elsewhere",
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
  // A menu left open by the test before doesn't carry over.
  document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  for (const box of document.querySelectorAll(".row-menu")) box.remove();
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

  it("open on every click, never rename: a double-click opens twice", async () => {
    await post(state());
    button("/work/app/README.md").click();
    await post(state({ selected: "/work/app/README.md" }));
    button("/work/app/README.md").click();
    button("/work/app/src").click();
    button("/work/app/src").click();
    expect(document.querySelector("input.rename")).toBeNull();
    expect(sent.filter((m) => m.type === "open")).toHaveLength(2);
    expect(sent.filter((m) => m.type === "toggle")).toHaveLength(2);
  });

  /** Right-clicks row `id`, and returns the menu's item labels. */
  const rightClick = (id) => {
    button(id).dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 30, clientY: 40 }),
    );
    const box = document.querySelector('.row-menu[role="menu"]');
    return box ? [...box.querySelectorAll(".row-menu__item")].map((b) => b.textContent) : null;
  };
  const item = (label) =>
    [...document.querySelectorAll(".row-menu__item")].find((b) => b.textContent === label);

  it("offer Open, Edit, Rename… and Move to Trash on a file's right-click", async () => {
    await post(state());
    expect(rightClick("/work/app/README.md")).toEqual(["Open", "Edit", "Rename…", "Move to Trash"]);
    item("Open").click();
    expect(sent.at(-1)).toEqual({ type: "open", id: "/work/app/README.md" });
    expect(document.querySelector(".row-menu")).toBeNull();
  });

  it("rename a file or a folder from its right-click menu", async () => {
    await post(state());
    expect(rightClick("/work/app/src")).toEqual(["Rename…", "Move to Trash"]);
    item("Rename…").click();
    const field = document.querySelector("input.rename");
    expect(field.value).toBe("src");
    field.value = "lib";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(sent.at(-1)).toEqual({ type: "rename", id: "/work/app/src", name: "lib" });
    rightClick("/work/app/README.md");
    item("Rename…").click();
    const again = document.querySelector("input.rename");
    expect(again.value).toBe("README.md");
    // While a name is typed, no menu opens over it; Escape ends the rename.
    expect(rightClick("/work/app/src")).toBeNull();
    again.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

  it("send Move to Trash and Edit for the row right-clicked, not the chosen one", async () => {
    await post(state({ selected: "/work/app/src" }));
    rightClick("/work/app/README.md");
    item("Move to Trash").click();
    expect(sent.at(-1)).toEqual({ type: "trash", id: "/work/app/README.md" });
    expect(rightClick("/work/app/README.md")).toContain("Edit");
    item("Edit").click();
    expect(sent.at(-1)).toEqual({ type: "edit", id: "/work/app/README.md" });
  });

  it("close the menu with Escape or a press outside it, and open it with Shift+F10", async () => {
    await post(state({ selected: "/work/app/README.md" }));
    rightClick("/work/app/README.md");
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(document.querySelector(".row-menu")).toBeNull();
    expect(document.activeElement).toBe(button("/work/app/README.md"));
    rightClick("/work/app/README.md");
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(document.querySelector(".row-menu")).toBeNull();
    button("/work/app/README.md").dispatchEvent(
      new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }),
    );
    expect(document.querySelector(".row-menu")).not.toBeNull();
  });

  it("show no menu where the tile can't change files", async () => {
    await post(state({ canEdit: false }));
    expect(rightClick("/work/app/README.md")).toBeNull();
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

  it("say whether the tree follows the pane or is pinned, and send the bar's choices", async () => {
    await post(state({ view: { pinned: false }, selected: null, selectedDir: false }));
    expect(document.getElementById("view-text").textContent).toBe("Following the pane");
    expect(document.getElementById("view-up").hidden).toBe(true);
    expect(document.getElementById("view-show-only").disabled).toBe(true);
    document.getElementById("view-pin").click();
    expect(sent.at(-1)).toEqual({ type: "pin" });

    await post(state({ selected: "/work/app/src", selectedDir: true }));
    document.getElementById("view-show-only").click();
    expect(sent.at(-1)).toEqual({ type: "show-only", id: "/work/app/src" });

    await post(state({ view: { pinned: true, gone: false, up: "work" } }));
    expect(document.getElementById("view").classList.contains("pinned")).toBe(true);
    expect(document.getElementById("view-text").textContent).toBe("Pinned on this folder");
    const up = document.getElementById("view-up");
    expect([up.hidden, up.textContent]).toEqual([false, "Up to work"]);
    up.click();
    expect(sent.at(-1)).toEqual({ type: "up" });
    expect(document.getElementById("view-pin").textContent).toBe("Follow the pane");
    document.getElementById("view-pin").click();
    expect(sent.at(-1)).toEqual({ type: "follow" });

    await post(state({ view: { pinned: true, gone: true, up: null } }));
    expect(document.getElementById("view-text").textContent).toBe(
      "No pane is in this folder any more",
    );
  });

  it("list recent files outside the shown folder after an Elsewhere line", async () => {
    const line = (id, extra = {}) => ({
      id,
      file: id,
      dir: "",
      pane: "api",
      action: "e",
      ts: 1,
      ...extra,
    });
    await post(
      state({
        activity: true,
        recent: [
          line("recent:a"),
          line("recent:b", { elsewhere: true }),
          line("recent:c", { elsewhere: true }),
        ],
      }),
    );
    const items = [...document.querySelectorAll("#recent > li")];
    const marks = items.filter((li) => li.classList.contains("elsewhere"));
    expect(marks.map((li) => li.textContent)).toEqual(["Elsewhere"]);
    expect(items.indexOf(marks[0])).toBe(1);
  });

  it("show names as text, never as markup", async () => {
    await post(state());
    const row = button("/work/app/<b>x</b>.md");
    expect(row.querySelector("b")).toBeNull();
    expect(row.textContent).toContain("<b>x</b>.md");
  });
});
