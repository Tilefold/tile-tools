// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web View example — tests
 *
 * The recent-pages logic on its own, then the built tile against the fake
 * Tilefold: Open uses the address setting and opens beside the panes
 * unless the docked setting is off, Move switches between the dock and a
 * window, the other commands steer the page, pages the window lands on are remembered (newest first, once
 * each) and listed in the docked panel, a click on a row opens that page,
 * the list survives a restart and can be forgotten, refusals and an older
 * Tilefold become notices. Several addresses open one page each (the
 * first on the tile's first page, the others named after their ports),
 * which the commands move, reload and close together; a Tilefold with one
 * page per tile opens the first and says why. Each address is remembered
 * with the browser page it was seen in, its row names that page, and a
 * click reopens it there.
 *
 * Modified 2026-10-17 (each tab's panel lists its own pages).
 *
 * Modified 2026-10-18 (renamed): Web Preview is now Web View (example.web-view).
 *
 * Last updated by: Tilefold
 */
import { fileURLToPath } from "node:url";
import {
  MAX_PAGES,
  expandAddress,
  planPages,
  readAddresses,
} from "../examples/web-view/src/addresses.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";
import {
  MAX_RECENT,
  ROW_PREFIX,
  errorKey,
  isPage,
  panelRows,
  readRowId,
  readRecent,
  remember,
  shortAddress,
} from "../examples/web-view/src/recent.js";

const DIR = fileURLToPath(new URL("../examples/web-view/", import.meta.url));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("recent pages", () => {
  it("remembers web pages newest first, once each, keeping an earlier title", () => {
    let list = remember([], { url: "http://localhost:5173/", title: "App" });
    list = remember(list, { url: "http://localhost:5173/login", title: "Sign in" });
    list = remember(list, { url: "http://localhost:5173/", title: "" });
    expect(list).toEqual([
      { url: "http://localhost:5173/", title: "App", page: "" },
      { url: "http://localhost:5173/login", title: "Sign in", page: "" },
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
      { url: "https://a.dev/", title: "A", page: "" },
      { url: "https://c.dev/", title: "t".repeat(120), page: "" },
    ]);
    // A page name is kept; a bad one counts as the first page.
    expect(
      readRecent([
        { url: "https://a.dev/", title: "", page: "3000" },
        { url: "https://b.dev/", title: "", page: "Bad Name" },
      ]).map((e) => e.page),
    ).toEqual(["3000", ""]);
  });

  it("keeps each browser page's addresses apart, at most MAX_RECENT each", () => {
    let list = remember([], { url: "http://localhost:3000/", title: "A", page: "" });
    list = remember(list, { url: "http://localhost:3000/", title: "A again", page: "3000" });
    expect(list.map((e) => e.page)).toEqual(["3000", ""]);
    for (let i = 0; i < MAX_RECENT + 3; i++)
      list = remember(list, { url: `http://h/${i}`, title: "", page: "3001" });
    expect(list.filter((e) => e.page === "3001")).toHaveLength(MAX_RECENT);
    // The other pages keep theirs.
    expect(list.filter((e) => e.page !== "3001")).toHaveLength(2);
  });

  it("reads a row id back, old ones included", () => {
    expect(readRowId(`${ROW_PREFIX}3001|http://localhost:3001/a|b`)).toEqual({
      page: "3001",
      url: "http://localhost:3001/a|b",
    });
    expect(readRowId(`${ROW_PREFIX}|http://x/`)).toEqual({ page: "", url: "http://x/" });
    // From before pages were kept: the first page.
    expect(readRowId(`${ROW_PREFIX}http://x/`)).toEqual({ page: "", url: "http://x/" });
    expect(readRowId("other")).toBeNull();
    expect(readRowId(5)).toBeNull();
  });

  it("turns the list into panel rows that open each page", () => {
    const rows = panelRows([
      { url: "http://localhost:5173/", title: "", page: "" },
      { url: "https://tilefold.com/docs", title: "Docs", page: "3000" },
    ]);
    expect(rows).toEqual([
      {
        id: `${ROW_PREFIX}|http://localhost:5173/`,
        label: "localhost:5173",
        icon: "link",
        hint: "http://localhost:5173/",
        page: "",
      },
      {
        id: `${ROW_PREFIX}3000|https://tilefold.com/docs`,
        label: "Docs",
        icon: "link",
        hint: "https://tilefold.com/docs",
        page: "3000",
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

describe("the addresses", () => {
  it("reads several, separated by commas, spaces or lines, once each", () => {
    expect(readAddresses("localhost:5173, localhost:3000\nlocalhost:5173  api.test")).toEqual([
      "localhost:5173",
      "localhost:3000",
      "api.test",
    ]);
    // A port alone is that port on this computer.
    expect(readAddresses("5173, :3000, 8080/x, 0, 70000")).toEqual([
      "localhost:5173",
      "localhost:3000",
      "8080/x",
      "0",
      "70000",
    ]);
    // The same page written two ways opens once.
    expect(readAddresses("3000 localhost:3000")).toEqual(["localhost:3000"]);
    expect(expandAddress("api.test")).toBe("api.test");
    expect(readAddresses("")).toEqual([]);
    expect(readAddresses(null)).toEqual([]);
    const many = Array.from({ length: MAX_PAGES + 3 }, (_, i) => `localhost:${3000 + i}`);
    expect(readAddresses(many.join(","))).toHaveLength(MAX_PAGES);
  });

  it("puts the first on the first page and names the others", () => {
    expect(
      planPages([
        "localhost:5173",
        "localhost:3000",
        "http://localhost:3000/admin",
        "api.example.test",
        "https://Staging_Box.local",
      ]),
    ).toEqual([
      { address: "localhost:5173", page: null },
      { address: "localhost:3000", page: "3000" },
      { address: "http://localhost:3000/admin", page: "3000-2" },
      { address: "api.example.test", page: "api" },
      { address: "https://Staging_Box.local", page: "staging-box" },
    ]);
    expect(planPages([])).toEqual([]);
    for (const { page } of planPages(["a", `x${"y".repeat(50)}.test`, "%%"])) {
      if (page) expect(page).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/);
    }
  });
});

describe("the tile", () => {
  /** The tile on a Tilefold with browser and panel, ready. */
  async function ready(opts = {}) {
    const host = await startTile(DIR, { browser: true, panel: true, ...opts });
    await host.emit("app.ready");
    return host;
  }

  it("names its commands and settings in the user's language, not by key", async () => {
    const host = await ready();
    const titles = host.regs.filter((r) => r.kind === "command").map((r) => r.title);
    expect(titles).toContain("Web View: Open");
    expect(titles.every((t) => !t.startsWith("cmd-"))).toBe(true);
    const de = await ready({ locale: "de" });
    expect(de.regs.find((r) => r.id === "open").title).toBe("Webansicht: Öffnen");
  });

  it("opens the address from its settings", async () => {
    const host = await ready();
    await host.command("open");
    await host.advance(0);
    expect(host.browser.calls[0]).toEqual(["open", "localhost:5173", { docked: true }]);
    expect(host.browser.docked).toBe(true);
    expect(host.browser.open).toBe(true);
    await host.setSetting("address", "localhost:3000/admin");
    await host.command("open");
    await host.advance(0);
    expect(host.browser.calls[1]).toEqual(["open", "localhost:3000/admin", { docked: true }]);
  });

  it("opens in a window of its own when the docked setting is off", async () => {
    const host = await ready({ settings: { docked: false } });
    await host.command("open");
    await host.advance(0);
    expect(host.browser.calls[0]).toEqual(["open", "localhost:5173", { docked: false }]);
    expect(host.browser.docked).toBe(false);
  });

  it("moves the page between the dock and a window, opening it docked when closed", async () => {
    const host = await ready({ settings: { docked: false } });
    await host.command("move");
    await host.advance(0);
    expect(host.browser.calls.at(-1)).toEqual(["open", "localhost:5173", { docked: true }]);
    expect(host.browser.docked).toBe(true);
    await host.command("move");
    await host.advance(0);
    expect(host.browser.calls.at(-1)).toEqual(["dock", false]);
    expect(host.browser.docked).toBe(false);
    await host.command("move");
    await host.advance(0);
    expect(host.browser.calls.at(-1)).toEqual(["dock", true]);
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

  it("opens one page per address, and moves, reloads and closes them together", async () => {
    const host = await ready({ settings: { address: "5173, 3000" } });
    await host.command("open");
    await host.advance(0);
    expect(host.browser.calls[0]).toEqual(["open", "localhost:5173", { docked: true }]);
    const api = host.browser.pages["3000"];
    expect(api.calls[0]).toEqual(["open", "localhost:3000", { docked: true }]);
    expect(api.open && api.docked).toBe(true);
    await host.command("move");
    await host.advance(0);
    expect([host.browser.docked, api.docked]).toEqual([false, false]);
    await host.command("reload");
    await host.advance(0);
    expect(api.calls.at(-1)).toEqual(["reload"]);
    await host.command("close");
    await host.advance(0);
    expect([host.browser.open, api.open]).toEqual([false, false]);
    // A named page's visits are remembered too.
    await host.visit("http://localhost:3000/health", "API", "3000");
    await host.advance(0);
    expect(host.panel.content.rows.some((r) => r.id.endsWith("localhost:3000/health"))).toBe(true);
  });

  it("opens only the first address on a Tilefold with one page per tile, and says why", async () => {
    const host = await ready({
      browser: "one-page",
      settings: { address: "localhost:5173, localhost:3000" },
    });
    await host.command("open");
    await host.advance(0);
    expect(host.browser.calls).toEqual([["open", "localhost:5173", { docked: true }]]);
    expect(host.toasts.at(-1)).toMatch(/one page at a time/);
  });

  it("lists pages it lands on in the panel, and a click opens one", async () => {
    const host = await ready();
    expect(host.panel.content).toBeNull();
    await host.command("open");
    await host.advance(0);
    await host.visit("http://localhost:5173/", "My app");
    await host.visit("http://localhost:5173/settings", "Settings");
    expect(host.panel.content.title).toBe("Web View");
    expect(host.panel.content.rows.map((r) => r.label)).toEqual(["Settings", "My app"]);
    await host.emit("panel.click", {
      row: `${ROW_PREFIX}|http://localhost:5173/`,
      action: "activate",
    });
    await host.advance(0);
    const again = ["open", "http://localhost:5173/", { docked: true }];
    expect(host.browser.calls.at(-1)).toEqual(again);
    await host.emit("panel.click", { row: "other", action: "activate" });
    await host.advance(0);
    expect(host.browser.calls.at(-1)).toEqual(again);
  });

  it("ties each row to its browser page, and reopens it there", async () => {
    const host = await ready({ settings: { address: "localhost:3000, localhost:3001" } });
    await host.command("open");
    await host.advance(0);
    await host.visit("http://localhost:3000/", "App");
    await host.visit("http://localhost:3001/", "API", "3001");
    await host.advance(0);
    expect(host.panel.content.rows.map((r) => [r.label, r.page])).toEqual([
      ["API", "3001"],
      ["App", ""],
    ]);
    await host.emit("panel.click", { row: host.panel.content.rows[0].id, action: "activate" });
    await host.advance(0);
    expect(host.browser.pages["3001"].calls.at(-1)).toEqual([
      "open",
      "http://localhost:3001/",
      { docked: true },
    ]);
  });

  it("keeps the list across a restart, and forgets it on request", async () => {
    const first = await ready();
    await first.visit("http://localhost:5173/", "My app");
    const stored = first.store.get("recent");
    expect(stored).toEqual([{ url: "http://localhost:5173/", title: "My app", page: "" }]);
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
    expect(host.toasts.at(-1)).toMatch(/^Web View couldn't open that: /);
    const old = await startTile(DIR, {});
    await old.command("open");
    await old.advance(0);
    expect(old.toasts.at(-1)).toMatch(/^This Tilefold can't open a browser/);
  });
});
