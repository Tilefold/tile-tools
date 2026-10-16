// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web Preview example — tests
 *
 * The recent-pages logic on its own, then the built tile against the fake
 * Tilefold: Open uses the address setting, the other commands steer the
 * window, pages the window lands on are remembered (newest first, once
 * each) and listed in the docked panel, a click on a row opens that page,
 * the list survives a restart and can be forgotten, refusals and an older
 * Tilefold become notices.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";
import {
  MAX_RECENT,
  ROW_PREFIX,
  errorKey,
  isPage,
  panelRows,
  readRecent,
  remember,
  shortAddress,
} from "../examples/web-preview/src/recent.js";

const DIR = fileURLToPath(new URL("../examples/web-preview/", import.meta.url));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("recent pages", () => {
  it("remembers web pages newest first, once each, keeping an earlier title", () => {
    let list = remember([], { url: "http://localhost:5173/", title: "App" });
    list = remember(list, { url: "http://localhost:5173/login", title: "Sign in" });
    list = remember(list, { url: "http://localhost:5173/", title: "" });
    expect(list).toEqual([
      { url: "http://localhost:5173/", title: "App" },
      { url: "http://localhost:5173/login", title: "Sign in" },
    ]);
    expect(remember(list, { url: "about:blank", title: "" })).toBe(list);
    expect(remember(list, null)).toBe(list);
  });

  it("keeps at most MAX_RECENT", () => {
    let list = [];
    for (let i = 0; i < MAX_RECENT + 5; i++)
      list = remember(list, { url: `http://h/${i}`, title: "" });
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].url).toBe(`http://h/${MAX_RECENT + 4}`);
  });

  it("reads a stored list back safely", () => {
    expect(readRecent(null)).toEqual([]);
    expect(readRecent("x")).toEqual([]);
    expect(
      readRecent([
        { url: "https://a.dev/", title: "A" },
        { url: "javascript:alert(1)", title: "bad" },
        { url: "https://b.dev/" },
        null,
        { url: "https://c.dev/", title: "t".repeat(500) },
      ]),
    ).toEqual([
      { url: "https://a.dev/", title: "A" },
      { url: "https://c.dev/", title: "t".repeat(120) },
    ]);
  });

  it("turns the list into panel rows that open each page", () => {
    const rows = panelRows([
      { url: "http://localhost:5173/", title: "" },
      { url: "https://tilefold.com/docs", title: "Docs" },
    ]);
    expect(rows).toEqual([
      {
        id: `${ROW_PREFIX}http://localhost:5173/`,
        label: "localhost:5173",
        icon: "link",
        hint: "http://localhost:5173/",
      },
      {
        id: `${ROW_PREFIX}https://tilefold.com/docs`,
        label: "Docs",
        icon: "link",
        hint: "https://tilefold.com/docs",
      },
    ]);
    expect(shortAddress("https://x.dev/")).toBe("x.dev");
    expect(isPage("ftp://x")).toBe(false);
  });

  it("names messages by error name", () => {
    expect(errorKey(Object.assign(new Error("x"), { name: "BrowserError" }))).toBe("error-refused");
    expect(errorKey(new Error("x"))).toBe("error-failed");
    expect(errorKey(undefined)).toBe("error-failed");
  });
});

describe("the tile", () => {
  /** The tile on a Tilefold with browser and panel, ready. */
  async function ready(opts = {}) {
    const host = await startTile(DIR, { browser: true, panel: true, ...opts });
    await host.emit("app.ready");
    return host;
  }

  it("opens the address from its settings", async () => {
    const host = await ready();
    await host.command("open");
    await host.advance(0);
    expect(host.browser.calls[0]).toEqual(["open", "localhost:5173"]);
    expect(host.browser.open).toBe(true);
    await host.setSetting("address", "localhost:3000/admin");
    await host.command("open");
    await host.advance(0);
    expect(host.browser.calls[1]).toEqual(["open", "localhost:3000/admin"]);
  });

  it("steers the window with its commands", async () => {
    const host = await ready();
    await host.command("open");
    for (const id of ["reload", "back", "forward", "close"]) await host.command(id);
    await host.advance(0);
    expect(host.browser.calls.map((c) => c[0])).toEqual([
      "open",
      "reload",
      "back",
      "forward",
      "close",
    ]);
  });

  it("lists pages it lands on in the panel, and a click opens one", async () => {
    const host = await ready();
    expect(host.panel.content).toBeNull();
    await host.command("open");
    await host.advance(0);
    await host.visit("http://localhost:5173/", "My app");
    await host.visit("http://localhost:5173/settings", "Settings");
    expect(host.panel.content.title).toBe("Web Preview");
    expect(host.panel.content.rows.map((r) => r.label)).toEqual(["Settings", "My app"]);
    await host.emit("panel.click", {
      row: `${ROW_PREFIX}http://localhost:5173/`,
      action: "activate",
    });
    await host.advance(0);
    expect(host.browser.calls.at(-1)).toEqual(["open", "http://localhost:5173/"]);
    await host.emit("panel.click", { row: "other", action: "activate" });
    await host.advance(0);
    expect(host.browser.calls.at(-1)).toEqual(["open", "http://localhost:5173/"]);
  });

  it("keeps the list across a restart, and forgets it on request", async () => {
    const first = await ready();
    await first.visit("http://localhost:5173/", "My app");
    const stored = first.store.get("recent");
    expect(stored).toEqual([{ url: "http://localhost:5173/", title: "My app" }]);
    const again = await ready({ store: { recent: stored } });
    expect(again.panel.content.rows).toHaveLength(1);
    await again.command("clear");
    expect(again.store.get("recent")).toEqual([]);
    expect(again.panel.content).toBeNull();
    expect(again.toasts.at(-1)).toBe("Recent pages forgotten.");
  });

  it("hides the panel when its setting is off", async () => {
    const host = await ready();
    await host.visit("http://localhost:5173/", "My app");
    expect(host.panel.content).not.toBeNull();
    await host.setSetting("panel", false);
    await host.advance(0);
    expect(host.panel.content).toBeNull();
  });

  it("tells a refused address and an older Tilefold apart", async () => {
    const host = await ready();
    await host.setSetting("address", "file:///etc/hosts");
    await host.command("open");
    await host.advance(0);
    expect(host.toasts.at(-1)).toMatch(/^Web Preview couldn't open that: /);
    const old = await startTile(DIR, {});
    await old.command("open");
    await old.advance(0);
    expect(old.toasts.at(-1)).toMatch(/^This Tilefold can't open a browser/);
  });
});
