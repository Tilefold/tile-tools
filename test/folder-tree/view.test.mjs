// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — what the tree shows
 *
 * The view's rules: only an absolute path without control or bidirectional
 * characters can be pinned; a kept view is checked before use; Up and
 * "reachable" go no further than a pane's folder; activity splits into the
 * shown folder and elsewhere. And the built tile: Pin keeps the folder
 * while the pane moves, Follow the pane goes back, Show only this folder
 * (right-click or palette) shows a folder on its own with Up and Follow
 * rows, a pinned folder no pane reaches says so, the view is kept between
 * launches, the window can do the same, agents in every pane are still
 * seen and Recent lists the rest under "Elsewhere", and the activity log
 * never gets a path.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markerName } from "../../examples/folder-tree/hooks/marker.mjs";
import {
  followView,
  pinView,
  reachable,
  restoreView,
  rootFor,
  splitByRoot,
  upFrom,
} from "../../examples/folder-tree/src/view.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/folder-tree/", import.meta.url));
const NOW = Date.UTC(2026, 10, 2, 12);
let nonce = 0;

/** A marker in `project`'s .foldertree for `rel`, `secondsAgo` before NOW. */
const marker = (project, rel, action, secondsAgo, pane) =>
  `${project}/.foldertree/${
    markerName({
      ts: NOW - secondsAgo * 1000,
      nonce: String(nonce++).padStart(4, "0"),
      action,
      pane,
      rel,
    }).name
  }`;

const PANES = [
  { session: "s1", name: "api", folder: "/work/app", focused: true },
  { session: "s2", name: "game", folder: "/work/game", focused: false },
];

const files = () => [
  "/work/app/README.md",
  "/work/app/src/main.js",
  "/work/app/src/lib/util.js",
  "/work/game/src/hud.js",
  marker("/work/app", "src/main.js", "e", 400, "api"),
  marker("/work/game", "src/hud.js", "e", 200, "game"),
];

const start = (opts = {}) =>
  startTile(DIR, {
    folders: {
      cwd: "/work/app",
      roots: ["/work/app", "/work/game"],
      files: files(),
      panes: PANES,
      write: true,
    },
    panel: true,
    page: true,
    ...opts,
  });
const ids = (host) => host.panel.content.rows.map((r) => r.id);
const rowOf = (host, id) => host.panel.content.rows.find((r) => r.id === id);
const footer = (host) => host.panel.content.footer?.rows.map((r) => r.id) ?? [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("the view's rules", () => {
  it("pins only absolute paths without control or bidirectional characters", () => {
    expect(pinView("/work/app/")).toEqual({ mode: "pinned", folder: "/work/app" });
    for (const bad of [
      "work/app",
      "",
      null,
      42,
      "/work/a\u0007pp",
      "/work/‮ppa",
      "/" + "a".repeat(5000),
    ]) {
      expect(pinView(bad)).toEqual(followView());
    }
  });

  it("checks a kept view before using it", () => {
    expect(restoreView({ mode: "pinned", folder: "/work/app" })).toEqual(pinView("/work/app"));
    expect(restoreView({ mode: "pinned", folder: "relative" })).toEqual(followView());
    expect(restoreView({ mode: "other", folder: "/x" })).toEqual(followView());
    expect(restoreView(null)).toEqual(followView());
    expect(restoreView("pinned")).toEqual(followView());
  });

  it("shows the pinned folder, else the pane's", () => {
    expect(rootFor(followView(), "/work/app")).toBe("/work/app");
    expect(rootFor(pinView("/work/game"), "/work/app")).toBe("/work/game");
  });

  it("reaches and goes up no further than a pane's folder", () => {
    const places = ["/work/app", "/work/game"];
    expect(reachable("/work/app/src", places)).toBe(true);
    expect(reachable("/work", places)).toBe(false);
    expect(reachable("/work/app", [])).toBeNull();
    expect(upFrom("/work/app/src/lib", places)).toBe("/work/app/src");
    expect(upFrom("/work/app", places)).toBeNull();
    expect(upFrom("/", places)).toBeNull();
  });

  it("splits activity into the shown folder and elsewhere", () => {
    const e = (abs) => ({ abs });
    const events = [e("/work/game/a"), e("/work/app/b"), e("/work/app2/c")];
    const { here, elsewhere } = splitByRoot(events, "/work/app");
    expect(here.map((x) => x.abs)).toEqual(["/work/app/b"]);
    expect(elsewhere.map((x) => x.abs)).toEqual(["/work/game/a", "/work/app2/c"]);
    expect(splitByRoot(events, null).here).toBe(events);
  });
});

describe("Folder Tree pinned on a folder", () => {
  it("keeps a pinned folder while the pane moves, and follows it again on request", async () => {
    const host = await start();
    await host.command("toggle");
    expect(host.panel.content.title).toBe("app");
    expect(ids(host)).not.toContain("view-pinned");
    await host.command("pin");
    expect(ids(host).slice(0, 2)).toEqual(["view-pinned", "view-follow"]);
    host.cwd = "/work/game";
    await host.emit("pane.cwd", { path: "/work/game" });
    expect(host.panel.content.title).toBe("app");
    await host.emit("panel.click", { row: "view-follow", action: "activate" });
    expect(host.panel.content.title).toBe("game");
    expect(ids(host)).not.toContain("view-pinned");
    expect(host.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["pinned", "followed"]),
    );
    expect(JSON.stringify(host.audits)).not.toContain("/work");
  });

  it("shows only a folder from its right-click menu, with Up while a pane reaches it", async () => {
    const host = await start();
    await host.command("toggle");
    await host.emit("panel.click", { row: "/work/app/src", action: "expand" });
    await host.menu("/work/app/src", "show-only");
    expect(host.panel.content.title).toBe("src");
    expect(rowOf(host, "view-up").label).toBe("Up to app");
    expect(ids(host)).toContain("/work/app/src/lib");
    await host.emit("panel.click", { row: "view-up", action: "activate" });
    expect(host.panel.content.title).toBe("app");
    // The pane's own folder: nothing above it is reachable.
    expect(ids(host)).not.toContain("view-up");
    expect(host.panel.content.menus.space.at(-1).id).toBe("follow");
  });

  it("asks for a folder when Show only has none chosen", async () => {
    const host = await start();
    await host.command("toggle");
    await host.command("show-only");
    await host.emit("panel.click", { row: "/work/app/README.md", action: "activate" });
    await host.command("show-only");
    expect(host.toasts).toEqual([
      "Click a folder in the tree first",
      "Click a folder in the tree first",
    ]);
    expect(ids(host)).not.toContain("view-pinned");
  });

  it("says when no pane reaches a pinned folder any more", async () => {
    const host = await start();
    await host.command("toggle");
    await host.command("pin");
    host.panes = [{ ...PANES[1], focused: true }];
    host.cwd = "/work/game";
    await host.emit("pane.list", { panes: host.panes });
    await host.emit("pane.cwd", { path: "/work/game" });
    expect(ids(host)).toContain("view-gone");
  });

  it("keeps the view between launches, and starts on the pinned folder", async () => {
    const first = await start();
    await first.command("toggle");
    await first.emit("panel.click", { row: "/work/app/src", action: "expand" });
    await first.menu("/work/app/src", "show-only");
    const kept = first.store.get("view");
    expect(kept).toEqual({ mode: "pinned", folder: "/work/app/src" });
    const again = await start({ store: { view: kept } });
    await again.command("toggle");
    expect(again.panel.content.title).toBe("src");
    // A kept view that isn't a usable path is ignored.
    const bad = await start({ store: { view: { mode: "pinned", folder: "src\u0000" } } });
    await bad.command("toggle");
    expect(bad.panel.content.title).toBe("app");
  });

  it("still sees every pane's agents, listing the rest under Elsewhere", async () => {
    const host = await start();
    await host.command("toggle");
    await host.command("pin");
    expect(footer(host)).toEqual([
      "recent",
      "recent:/work/app/src/main.js",
      "recent-elsewhere",
      "recent:/work/game/src/hud.js",
    ]);
  });

  it("does the same from the window", async () => {
    const host = await start();
    await host.command("window");
    await host.emit("page.message", { message: { type: "pin" } });
    const state = host.page.posted.filter((m) => m.type === "state").at(-1);
    expect(state.view).toEqual({ pinned: true, gone: false, up: null });
    expect(state.recent.map((e) => [e.id, e.elsewhere === true])).toEqual([
      ["recent:/work/app/src/main.js", false],
      ["recent:/work/game/src/hud.js", true],
    ]);
    await host.emit("page.message", { message: { type: "follow" } });
    expect(host.page.posted.filter((m) => m.type === "state").at(-1).view).toEqual({
      pinned: false,
    });
  });
});
