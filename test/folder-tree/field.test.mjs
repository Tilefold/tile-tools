/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the folder field
 *
 * On a Tilefold with tf.fs.chooseFolder the Folders section starts with a
 * folder field (with Browse…); without it, as on 0.1.24, there is none. A
 * folder Tilefold gave through the field is kept and pinned, shown, and
 * reached like a pane's folder even though no pane is in it; a refusal is
 * only recorded, with the reason; another row's input is ignored; the
 * kept list is checked when read back; the log never holds a path.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fieldRow,
  FIELD_ROW,
  MAX_GRANTED,
  restoreGranted,
} from "../../examples/folder-tree/src/folder-field.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/folder-tree/", import.meta.url));

const start = (choose, opts = {}) =>
  startTile(DIR, {
    folders: {
      cwd: "/work/app",
      roots: ["/work/app"],
      files: ["/work/app/README.md", "/elsewhere/notes/todo.md"],
      panes: [{ session: "s1", name: "api", folder: "/work/app", focused: true }],
      choose,
    },
    panel: true,
    ...opts,
  });
const ids = (host) => host.panel.content.rows.map((r) => r.id);
const rowOf = (host, id) => host.panel.content.rows.find((r) => r.id === id);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the folder field's rules", () => {
  it("draws a folder field with Browse…", () => {
    expect(fieldRow((k) => k)).toEqual({
      id: FIELD_ROW,
      label: "pins-add-label",
      depth: 1,
      input: { kind: "folder", placeholder: "pins-add-placeholder", browse: true },
    });
  });

  it("checks the folders kept: usable paths, once each, the newest 12", () => {
    expect(restoreGranted(["/a", "/a", "rel", 3, "/b"])).toEqual(["/a", "/b"]);
    const many = Array.from({ length: 20 }, (_, i) => `/g${i}`);
    expect(restoreGranted(many)).toEqual(many.slice(-MAX_GRANTED));
    expect(restoreGranted("nope")).toEqual([]);
  });
});

describe("Folder Tree's folder field", () => {
  it("shows no field where Tilefold can't give folders", async () => {
    const host = await start(false);
    await host.command("toggle");
    expect(ids(host)).not.toContain(FIELD_ROW);
  });

  it("pins and shows the folder Tilefold gave, reached though no pane is in it", async () => {
    const host = await start(true);
    await host.command("toggle");
    expect(ids(host).slice(0, 2)).toEqual(["folders", FIELD_ROW]);
    expect(rowOf(host, FIELD_ROW).input).toMatchObject({ kind: "folder", browse: true });
    // Tilefold gave it: from now on the tile may reach it.
    host.roots.push("/elsewhere/notes");
    await host.emit("panel.input", { row: FIELD_ROW, path: "/elsewhere/notes", via: "typed" });
    expect(host.store.get("pins")).toEqual(["/elsewhere/notes"]);
    expect(host.store.get("granted")).toEqual(["/elsewhere/notes"]);
    expect(host.panel.content.title).toBe("notes");
    expect(rowOf(host, "pin:/elsewhere/notes")).toMatchObject({ tone: "accent", trail: "shown" });
    expect(ids(host)).toContain("/elsewhere/notes/todo.md");
    const pinned = host.audits.find((a) => a.action === "pinned");
    expect(pinned.details).toMatchObject({ from: "typed", count: 1 });
    expect(JSON.stringify(host.audits)).not.toContain("elsewhere");
  });

  it("a folder picked with Browse… is pinned the same way", async () => {
    const host = await start(true);
    await host.command("toggle");
    host.roots.push("/elsewhere/notes");
    await host.emit("panel.input", { row: FIELD_ROW, path: "/elsewhere/notes", via: "dialog" });
    expect(host.audits.find((a) => a.action === "pinned").details.from).toBe("dialog");
  });

  it("only records a refusal, and ignores another row's input", async () => {
    const host = await start(true);
    await host.command("toggle");
    await host.emit("panel.input", { row: FIELD_ROW, error: "in-git", via: "typed" });
    await host.emit("panel.input", { row: "other", path: "/elsewhere/notes" });
    expect(host.store.get("pins") ?? []).toEqual([]);
    expect(host.audits.filter((a) => a.action === "pin-refused")).toEqual([
      expect.objectContaining({ details: { from: "typed", reason: "in-git" } }),
    ]);
  });
});
