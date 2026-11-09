// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Web View example — panel tests
 *
 * When the recent-pages panel shows: not at startup, only once Web View
 * opens a page. A panel the user closed stays closed, across a restart
 * too, until they run Open or turn the panel setting back on; another
 * tile's panel taking the dock, or leaving a tab, isn't a close.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "./fake-host.mjs";

const DIR = fileURLToPath(new URL("../examples/web-view/", import.meta.url));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the panel", () => {
  /** The tile on a Tilefold with browser and panel, ready. */
  async function ready(opts = {}) {
    const host = await startTile(DIR, { browser: true, panel: true, ...opts });
    await host.emit("app.ready");
    return host;
  }

  it("shows no panel at startup, only once a page opens", async () => {
    const stored = [{ url: "http://localhost:5173/", title: "My app", page: "" }];
    const host = await ready({ store: { recent: stored } });
    expect(host.panel.content).toBeNull();
    expect(host.panel.shows).toBe(0);
    // A page landing (typed in Tilefold's bar, say) opens it too, even
    // when it is already the newest in the list.
    await host.visit("http://localhost:5173/", "My app");
    await host.advance(0);
    expect(host.panel.content.rows.map((r) => r.label)).toEqual(["My app"]);
  });

  it("keeps to the tab where it was opened with Show on, else every tab", async () => {
    const host = await ready();
    await host.visit("http://localhost:5173/", "My app");
    await host.advance(0);
    expect(host.panel.content.perTab).toBe(false);
    await host.setSetting("showOn", "tab");
    await host.advance(0);
    expect(host.panel.content.perTab).toBe(true);
  });

  /** Plays the user closing the panel, as Tilefold does: hidden, then told. */
  async function userCloses(host) {
    host.panel.content = null;
    await host.emit("panel.closed", { by: "user" });
  }

  it("keeps a panel the user closed closed, across a restart, until Open", async () => {
    const host = await ready();
    await host.visit("http://localhost:5173/", "My app");
    await userCloses(host);
    expect(host.store.get("panelClosed")).toBe(true);
    await host.visit("http://localhost:5173/settings", "Settings");
    expect(host.panel.content).toBeNull();
    // Still closed after a restart, even once a page lands.
    const again = await ready({ store: { recent: host.store.get("recent"), panelClosed: true } });
    await again.visit("http://localhost:5173/", "My app");
    expect(again.panel.content).toBeNull();
    // Running Open brings it back, and forgets the close.
    await again.command("open");
    await again.advance(0);
    expect(again.panel.content.rows).toHaveLength(2);
    expect(again.store.get("panelClosed")).toBe(false);
  });

  it("brings a closed panel back when its setting is turned on again", async () => {
    const host = await ready();
    await host.visit("http://localhost:5173/", "My app");
    await userCloses(host);
    await host.setSetting("panel", false);
    expect(host.store.get("panelClosed")).toBe(true);
    await host.setSetting("panel", true);
    await host.advance(0);
    expect(host.store.get("panelClosed")).toBe(false);
    expect(host.panel.content.rows).toHaveLength(1);
  });

  it("doesn't count another panel taking the dock, or leaving a tab, as a close", async () => {
    const host = await ready();
    await host.visit("http://localhost:5173/", "My app");
    for (const by of ["replaced", "tab", undefined]) {
      await host.emit("panel.closed", by ? { by } : undefined);
    }
    expect(host.store.has("panelClosed")).toBe(false);
    await host.visit("http://localhost:5173/settings", "Settings");
    expect(host.panel.content.rows).toHaveLength(2);
  });
});
