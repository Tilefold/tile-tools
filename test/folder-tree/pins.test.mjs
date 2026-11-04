// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the pinned folders
 *
 * The list's rules: a kept list is checked (unusable and repeated folders
 * dropped, at most 12) and a 2.2.0 pinned view becomes the first pin;
 * pins go last, repeats and a full list are refused; moving stays inside
 * the list; two pins with one name show the folder they are in. The
 * Folders section: Follow the pane, each pin (shown, busy, gone), a folder
 * shown without being pinned, the note while nothing is pinned, and the
 * section closed. And the built tile: Pin this folder on a folder, a click
 * on a pin, Follow the pane, Move up / down and Unpin from a pin's menu,
 * the list kept between launches, a full list, a pin no pane reaches, the
 * section remembered closed, the window's picker, and an activity log
 * that never gets a path.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markerName } from "../../examples/folder-tree/hooks/marker.mjs";
import { foldersRows } from "../../examples/folder-tree/src/folders-view.js";
import {
  addPin,
  MAX_PINS,
  movePin,
  pinLabels,
  removePin,
  restorePins,
} from "../../examples/folder-tree/src/pins.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/folder-tree/", import.meta.url));
const NOW = Date.UTC(2026, 10, 3, 12);
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

const start = (opts = {}) =>
  startTile(DIR, {
    folders: {
      cwd: "/work/app",
      roots: ["/work/app", "/work/game"],
      files: [
        "/work/app/README.md",
        "/work/app/src/main.js",
        "/work/game/src/hud.js",
        // An agent in the game pane is editing hud.js right now.
        marker("/work/game", "src/hud.js", "e", 3, "game"),
      ],
      panes: PANES,
      write: true,
    },
    panel: true,
    page: true,
    ...opts,
  });
const ids = (host) => host.panel.content.rows.map((r) => r.id);
const rowOf = (host, id) => host.panel.content.rows.find((r) => r.id === id);
const lastState = (host) => host.page.posted.filter((m) => m.type === "state").at(-1);
/** `t` that shows the key and its arguments, so rows are checked exactly. */
const t = (key, args) => (args ? `${key}(${Object.values(args).join(",")})` : key);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("the pinned folders' rules", () => {
  it("checks a kept list: unusable and repeated folders go, at most 12 stay", () => {
    expect(restorePins(["/a", "/a/", "rel", 7, "/b\u0007", "/c/../d"])).toEqual(["/a", "/d"]);
    const many = Array.from({ length: 20 }, (_, i) => `/p${i}`);
    expect(restorePins(many)).toHaveLength(MAX_PINS);
    expect(restorePins("nope")).toEqual([]);
  });

  it("makes a 2.2.0 pinned view the first pin, when no list is kept yet", () => {
    expect(restorePins(undefined, { mode: "pinned", folder: "/work/app/" })).toEqual(["/work/app"]);
    expect(restorePins(null, { mode: "follow", folder: null })).toEqual([]);
    expect(restorePins(null, { mode: "pinned", folder: "rel" })).toEqual([]);
    // A kept list wins over the old view, even an empty one.
    expect(restorePins([], { mode: "pinned", folder: "/work/app" })).toEqual([]);
  });

  it("adds a pin last, and refuses repeats, a full list and unusable paths", () => {
    expect(addPin(["/a"], "/b/")).toEqual({ pins: ["/a", "/b"] });
    expect(addPin(["/a"], "/a")).toEqual({ error: "already" });
    const full = Array.from({ length: MAX_PINS }, (_, i) => `/p${i}`);
    expect(addPin(full, "/x")).toEqual({ error: "full" });
    expect(addPin([], "relative")).toEqual({ error: "unusable" });
  });

  it("moves inside the list and removes only what it names", () => {
    const pins = ["/a", "/b", "/c"];
    expect(movePin(pins, "/c", -1)).toEqual(["/a", "/c", "/b"]);
    expect(movePin(pins, "/a", -1)).toBe(pins);
    expect(movePin(pins, "/zzz", 1)).toBe(pins);
    expect(removePin(pins, "/b")).toEqual(["/a", "/c"]);
  });

  it("tells two pins with one name apart by the folder they are in", () => {
    const labels = pinLabels(["/w/api/src", "/w/site/src", "/w/docs"]);
    expect([...labels.values()]).toEqual(["src · api", "src · site", "docs"]);
  });
});

describe("the Folders section", () => {
  const pins = [
    { path: "/work/game", shown: false, gone: false },
    { path: "/work/app/src", shown: true, gone: false },
    { path: "/old/place", shown: false, gone: true },
  ];
  const active = [{ abs: "/work/game/src/hud.js" }, { abs: "/old/place/x.js" }];

  it("lists Follow the pane and every pin: shown, busy and gone", () => {
    const view = { pinned: true, listed: true, up: "/work/app", gone: false, pins };
    const { rows, targets } = foldersRows(t, {
      root: "/work/app/src",
      view,
      active,
      open: true,
      menus: true,
    });
    expect(rows.map((r) => r.id)).toEqual([
      "folders",
      "view-follow",
      "pin:/work/game",
      "pin:/work/app/src",
      "pin:/old/place",
      "view-up",
    ]);
    expect(rows[0]).toMatchObject({ section: true, expanded: true, badge: "3" });
    expect(rows[1].tone).toBeUndefined();
    expect(rows[2]).toMatchObject({
      tone: "info",
      pulse: true,
      badge: "1",
      trail: "/work",
      menu: "pin",
    });
    expect(rows[2].hint).toBe("/work/game\nhint-busy(1)");
    expect(rows[3]).toMatchObject({ tone: "accent", trail: "pin-shown", label: "src" });
    // Nothing an agent does in a folder no pane reaches is counted.
    expect(rows[4]).toMatchObject({ icon: "error", tone: "warning", muted: true });
    expect(rows[4].pulse).toBeUndefined();
    expect(targets.get("pin:/work/game")).toEqual({ kind: "pin", path: "/work/game" });
    expect(targets.get("view-up")).toEqual({ kind: "view-up" });
  });

  it("marks Follow the pane, and says how to pin while nothing is", () => {
    const { rows } = foldersRows(t, {
      root: "/work/app",
      view: { pinned: false, pins: [] },
      active: [],
      open: true,
      menus: false,
    });
    expect(rows.map((r) => r.id)).toEqual(["folders", "view-follow", "pins-empty"]);
    expect(rows[0].badge).toBeUndefined();
    expect(rows[1]).toMatchObject({ tone: "accent", trail: "pin-shown" });
  });

  it("names a folder shown without being pinned, and says when no pane reaches it", () => {
    const { rows } = foldersRows(t, {
      root: "/work/app/src",
      view: { pinned: true, listed: false, up: null, gone: true, pins: [] },
      active: [],
      open: true,
      menus: true,
    });
    expect(rows.map((r) => r.id)).toEqual([
      "folders",
      "view-follow",
      "view-pinned",
      "view-gone",
      "pins-empty",
    ]);
    expect(rows[2]).toMatchObject({ label: "view-showing(src)", menu: "shown", tone: "accent" });
  });

  it("cuts a long folder at the row's end from the left, and closes", () => {
    const deep = `/${"d".repeat(40)}/leaf`;
    const open = foldersRows(t, {
      root: null,
      view: { pinned: false, pins: [{ path: deep, shown: false, gone: false }] },
      active: [],
      open: true,
      menus: false,
    });
    const trail = open.rows.find((r) => r.id === `pin:${deep}`).trail;
    expect(trail).toHaveLength(32);
    expect(trail.startsWith("…")).toBe(true);
    const closed = foldersRows(t, {
      root: null,
      view: { pinned: false, pins: [] },
      active: [],
      open: false,
    });
    expect(closed.rows.map((r) => r.id)).toEqual(["folders"]);
  });
});

describe("Folder Tree's pinned folders", () => {
  it("pins a folder from its menu, shows a pin with a click, and follows again", async () => {
    const host = await start();
    await host.command("toggle");
    expect(ids(host).slice(0, 3)).toEqual(["folders", "view-follow", "pins-empty"]);
    await host.menu("/work/app/src", "pin");
    expect(host.panel.content.title).toBe("src");
    expect(host.store.get("pins")).toEqual(["/work/app/src"]);
    // In the game pane, following it, Pin keeps the pane's folder.
    await host.emit("panel.click", { row: "view-follow", action: "activate" });
    host.cwd = "/work/game";
    await host.emit("pane.cwd", { path: "/work/game" });
    await host.command("pin");
    host.cwd = "/work/app";
    await host.emit("pane.cwd", { path: "/work/app" });
    expect(host.store.get("pins")).toEqual(["/work/app/src", "/work/game"]);
    await host.emit("panel.click", { row: "pin:/work/app/src", action: "activate" });
    expect(host.panel.content.title).toBe("src");
    expect(rowOf(host, "pin:/work/app/src").trail).toBe("shown");
    // The game pane's agent is busy: its pin pulses while src is shown.
    expect(rowOf(host, "pin:/work/game")).toMatchObject({ pulse: true, badge: "1", tone: "info" });
    await host.emit("panel.click", { row: "view-follow", action: "activate" });
    expect(host.panel.content.title).toBe("app");
    expect(host.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["pinned", "shown", "followed"]),
    );
    expect(JSON.stringify(host.audits)).not.toContain("/work");
  });

  it("moves and unpins from a pin's menu; unpinning the shown one follows the pane", async () => {
    const host = await start({ store: { pins: ["/work/app/src", "/work/game"] } });
    await host.command("toggle");
    expect(host.panel.content.menus.pin.map((i) => i.id ?? "—")).toEqual([
      "pin-show",
      "—",
      "pin-up",
      "pin-down",
      "—",
      "unpin",
    ]);
    await host.menu("pin:/work/game", "pin-up");
    expect(host.store.get("pins")).toEqual(["/work/game", "/work/app/src"]);
    expect(ids(host).slice(2, 4)).toEqual(["pin:/work/game", "pin:/work/app/src"]);
    await host.menu("pin:/work/game", "pin-show");
    expect(host.panel.content.title).toBe("game");
    await host.menu("pin:/work/game", "unpin");
    expect(host.store.get("pins")).toEqual(["/work/app/src"]);
    expect(host.panel.content.title).toBe("app");
    expect(rowOf(host, "view-follow").tone).toBe("accent");
    expect(host.audits.map((a) => a.action)).toEqual(expect.arrayContaining(["moved", "unpinned"]));
  });

  it("carries a 2.2.0 pinned folder into the list", async () => {
    const host = await start({ store: { view: { mode: "pinned", folder: "/work/game" } } });
    await host.command("toggle");
    expect(host.panel.content.title).toBe("game");
    expect(rowOf(host, "pin:/work/game")).toMatchObject({ tone: "accent", trail: "shown" });
  });

  it("shows a folder pinned already instead of adding it twice, and stops at 12", async () => {
    const twelve = Array.from({ length: MAX_PINS }, (_, i) => `/work/app/p${i}`);
    const full = await start({ store: { pins: twelve } });
    await full.command("toggle");
    await full.menu("/work/app/src", "pin");
    expect(full.toasts.at(-1)).toBe(
      "You've pinned 12 folders, the most there can be. Unpin one first",
    );
    const host = await start({ store: { pins: ["/work/app"] } });
    await host.command("toggle");
    await host.command("pin");
    expect(host.store.get("pins")).toEqual(["/work/app"]);
    expect(host.panel.content.title).toBe("app");
    expect(rowOf(host, "pin:/work/app").trail).toBe("shown");
  });

  it("won't show a pin no pane reaches any more", async () => {
    const host = await start({ store: { pins: ["/elsewhere/old"] } });
    await host.command("toggle");
    expect(rowOf(host, "pin:/elsewhere/old")).toMatchObject({ icon: "error", muted: true });
    await host.emit("panel.click", { row: "pin:/elsewhere/old", action: "activate" });
    expect(host.toasts).toEqual(["No pane is in this folder any more"]);
    expect(host.panel.content.title).toBe("app");
  });

  it("remembers the Folders section closed", async () => {
    const host = await start({ store: { pins: ["/work/game"] } });
    await host.command("toggle");
    await host.emit("panel.click", { row: "folders", action: "collapse" });
    expect(ids(host)[0]).toBe("folders");
    expect(ids(host)).not.toContain("pin:/work/game");
    expect(host.store.get("ui").foldersOpen).toBe(false);
    const again = await start({ store: { ui: host.store.get("ui"), pins: ["/work/game"] } });
    await again.command("toggle");
    await vi.advanceTimersByTimeAsync(0);
    expect(rowOf(again, "folders").expanded).toBe(false);
  });

  it("picks and unpins from the window, ignoring folders that aren't pinned", async () => {
    const host = await start({ store: { pins: ["/work/game"] } });
    await host.command("window");
    await host.emit("page.message", { message: { type: "show-pin", id: "/work/app/src" } });
    expect(lastState(host).view.pinned).toBe(false);
    await host.emit("page.message", { message: { type: "show-pin", id: "/work/game" } });
    expect(lastState(host).view).toMatchObject({
      pinned: true,
      listed: true,
      pins: [{ id: "/work/game", label: "game", shown: true }],
    });
    await host.emit("page.message", { message: { type: "unpin", id: "/work/game" } });
    expect(lastState(host).view).toEqual({ pinned: false, pins: [] });
    expect(host.store.get("pins")).toEqual([]);
  });

  it("gives the window the list's labels", async () => {
    const host = await start();
    await host.command("window");
    const strings = host.page.posted.find((m) => m.type === "strings");
    expect(strings.view).toMatchObject({
      pins: "Pinned folders",
      showing: "Showing §",
      unpin: "Unpin",
    });
  });
});
