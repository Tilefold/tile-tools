// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — agent activity, end to end
 *
 * The built tile, run against the fake host with markers in the project's
 * .foldertree folder: the panel shows "Now", the marked tree and "Recent"
 * as its footer; a new marker shows up at the next read, two seconds on;
 * "Show all" and closing Recent are remembered; clicking a recent file
 * opens it; reading stops when nothing is showing. The window gets its
 * strings and the same state, its clicks open folders and files, and the
 * setup command opens it on the setup help. Activity can be turned off.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markerName } from "../../examples/folder-tree/hooks/marker.mjs";
import { POLL_MS } from "../../examples/folder-tree/src/session.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/folder-tree/", import.meta.url));
const NOW = Date.UTC(2026, 9, 14, 12);
let nonce = 0;

/** A marker file for `rel`, `secondsAgo` before NOW. */
const marker = (rel, action, secondsAgo, pane = "api") =>
  `/work/app/.foldertree/${
    markerName({
      ts: NOW - secondsAgo * 1000,
      nonce: String(nonce++).padStart(4, "0"),
      action,
      pane,
      rel,
    }).name
  }`;

/** The project, with an agent editing src/main.js now and README.md read earlier. */
const files = () => [
  "/work/app/README.md",
  "/work/app/src/main.js",
  marker("src/main.js", "e", 2),
  marker("README.md", "r", 300, "web"),
];

const start = (opts = {}) =>
  startTile(DIR, {
    folders: { cwd: "/work/app", roots: ["/work/app"], files: files() },
    panel: true,
    page: true,
    ...opts,
  });
/** Row ids of the panel's rows, or of its footer. */
const ids = (host) => host.panel.content.rows.map((r) => r.id);
const footerIds = (host) => host.panel.content.footer?.rows.map((r) => r.id) ?? [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("Folder Tree with agent activity", () => {
  it("shows Now, the marked tree and Recent pinned to the bottom", async () => {
    const host = await start();
    await host.command("toggle");
    // Now keeps at least NOW_MIN rows (blank ones after the file), so the tree stays put.
    expect(ids(host)).toEqual([
      "now",
      "now:/work/app/src/main.js",
      "now-pad-1",
      "now-pad-2",
      "files",
      "/work/app/src",
      "/work/app/README.md",
    ]);
    expect(host.panel.content.subtitle).toBe("api is editing src/main.js");
    expect(host.panel.content.rows[1]).toMatchObject({
      pulse: true,
      tone: "warning",
      badge: "api",
    });
    expect(host.panel.content.rows[5]).toMatchObject({ label: "src", pulse: true, badge: "1" });
    expect(footerIds(host)).toEqual([
      "recent",
      "recent:/work/app/src/main.js",
      "recent:/work/app/README.md",
    ]);
    // Markers are names only: the hidden folder never shows in the tree.
    expect(ids(host).some((id) => id.includes(".foldertree"))).toBe(false);
  });

  it("finds an agent working in a project inside the tree's folder", async () => {
    // The pane is on a workspace holding the project; the agent's markers are the project's.
    const host = await start({
      folders: { cwd: "/work", roots: ["/work"], files: files() },
    });
    await host.command("toggle");
    expect(ids(host)).toContain("now:/work/app/src/main.js");
    expect(host.panel.content.subtitle).toBe("api is editing app/src/main.js");
    // A new marker there shows at the next read.
    host.files.push(marker("README.md", "e", 0, "docs"));
    await host.advance(POLL_MS);
    expect(host.panel.content.subtitle).toBe("docs is editing app/README.md (+1 more)");
  });

  it("shows agents in every pane, by the names the user gave the panes", async () => {
    const hud = `/game/.foldertree/${
      markerName({
        ts: NOW - 1000,
        nonce: "g001",
        action: "e",
        pane: "Claude Code",
        session: "sess-game",
        rel: "src/hud.js",
      }).name
    }`;
    const panes = [
      { session: "sess-app", name: null, folder: "/work/app", focused: true },
      { session: "sess-game", name: "Winnie", folder: "/game", focused: false },
    ];
    const host = await start({
      folders: {
        cwd: "/work/app",
        roots: ["/work/app", "/game"],
        files: [...files(), "/game/src/hud.js", hud],
        panes,
      },
    });
    await host.command("toggle");
    await host.advance(POLL_MS);
    // The agent in the other pane, called by the pane's name, its path after the folder's.
    expect(ids(host)).toContain("now:/game/src/hud.js");
    expect(host.panel.content.subtitle).toBe("Winnie is editing game/src/hud.js (+1 more)");
    // Renamed: the next list says so.
    await host.emit("pane.list", { panes: [panes[0], { ...panes[1], name: "Pooh" }] });
    expect(host.panel.content.subtitle).toBe("Pooh is editing game/src/hud.js (+1 more)");
  });

  it("picks up a new marker at the next read, and opens recent files", async () => {
    const host = await start();
    await host.command("toggle");
    host.files.push(marker("README.md", "e", 0, "docs"));
    await host.advance(POLL_MS);
    expect(host.panel.content.subtitle).toBe("docs is editing README.md (+1 more)");
    await host.emit("panel.click", { row: "recent:/work/app/README.md", action: "activate" });
    expect(host.opened).toEqual(["/work/app/README.md"]);
    expect(host.audits.at(-1)).toEqual({ action: "file-opened", details: { from: "panel" } });
  });

  it("remembers Show all and a closed Recent", async () => {
    const extra = Array.from({ length: 7 }, (_, i) => marker(`f${i}.js`, "a", 60 + i));
    const host = await start({
      folders: { cwd: "/work/app", roots: ["/work/app"], files: [...files(), ...extra] },
    });
    await host.command("toggle");
    expect(footerIds(host).filter((id) => id.startsWith("recent:"))).toHaveLength(5);
    await host.emit("panel.click", { row: "recent-more", action: "activate" });
    expect(footerIds(host).filter((id) => id.startsWith("recent:"))).toHaveLength(9);
    await host.emit("panel.click", { row: "recent", action: "collapse" });
    expect(footerIds(host)).toEqual(["recent"]);
    expect(host.store.get("ui")).toEqual({ recentOpen: false, recentAll: true });

    const again = await start({
      folders: { cwd: "/work/app", roots: ["/work/app"], files: files() },
      store: { ui: { recentOpen: true, recentAll: true } },
    });
    await again.command("toggle");
    expect(again.panel.content.footer.rows[0]).toMatchObject({ expanded: true });
  });

  it("stops reading markers when nothing is showing", async () => {
    const host = await start();
    await host.command("toggle");
    const shows = host.panel.shows;
    await host.emit("panel.closed", { by: "user" });
    host.files.push(marker("README.md", "e", 0));
    await host.advance(POLL_MS * 3);
    expect(host.panel.shows).toBe(shows);
  });

  it("can leave activity out", async () => {
    const host = await start({ settings: { showActivity: false } });
    await host.command("toggle");
    expect(ids(host)).toEqual(["/work/app/src", "/work/app/README.md"]);
    expect(host.panel.content.footer).toBeUndefined();
  });

  it("opens a window with the strings and the same state, and acts on its clicks", async () => {
    const host = await start();
    await host.command("window");
    expect(host.page.opens).toEqual([{ visible: true }]);
    const [strings] = host.page.posted;
    expect(strings).toMatchObject({ type: "strings", now: "Now", recent: "Recent", dir: "ltr" });
    expect(strings.setup.command).toBe("node hooks/install.mjs");
    const state = host.page.posted.findLast((m) => m.type === "state");
    expect(state.now.map((e) => e.id)).toEqual(["now:/work/app/src/main.js"]);
    expect(state.recent).toHaveLength(2);

    await host.emit("page.message", {
      message: { type: "toggle", id: "/work/app/src", open: true },
    });
    const opened = host.page.posted.findLast((m) => m.type === "state");
    expect(opened.tree.map((r) => r.name)).toEqual(["src", "main.js", "README.md"]);
    await host.emit("page.message", {
      message: { type: "open", id: "recent:/work/app/README.md" },
    });
    expect(host.opened).toEqual(["/work/app/README.md"]);

    // A reloaded window says it is ready and gets everything again.
    const before = host.page.posted.length;
    await host.emit("page.message", { message: { type: "ready" } });
    expect(host.page.posted.slice(before).map((m) => m.type)).toEqual(["strings", "state"]);

    await host.emit("page.closed");
    const posted = host.page.posted.length;
    host.files.push(marker("README.md", "e", 0));
    await host.advance(POLL_MS * 2);
    expect(host.page.posted.length).toBe(posted);
  });

  it("opens the window on the setup help", async () => {
    const host = await start();
    await host.command("setup");
    expect(host.page.posted.map((m) => m.type).slice(0, 2)).toEqual(["strings", "setup"]);
    expect(host.audits).toContainEqual({ action: "window-opened", details: { setup: true } });
  });
});
