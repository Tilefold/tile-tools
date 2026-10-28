// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — docked beside the panes, and in Tilefold's theme
 *
 * On a Tilefold that docks tile pages beside the panes and gives its theme
 * (0.1.20): the quiz can show docked there, from the setting or by the
 * card's dock button; the docked page's float button and Tilefold's own
 * Undock put it back on the card; the user's move is remembered until the
 * setting changes. The card and its grip are drawn in Tilefold's colors,
 * and follow its theme as it changes; the card's own light and dark switch
 * steps aside. On an older Tilefold none of this shows.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ONE_PANE, startTile } from "../fake-host.mjs";
import { cardSpots } from "../../examples/quiz/src/scene.js";

const DIR = fileURLToPath(new URL("../../examples/quiz/", import.meta.url));
const SPOT = cardSpots(ONE_PANE, "bottom-right", null);

/** Tilefold's theme, as tf.theme() gives it. */
const THEME = {
  mode: "dark",
  name: "deep-sea",
  colors: { pane: "#10141c", surfaceRaised: "#1a2030", border: "#2a3346", textMuted: "#8090a8" },
};

const start = (opts = {}) => startTile(DIR, { page: "side", panel: true, theme: THEME, ...opts });

/** The page says hello, and the setup it got back. */
async function hello(host) {
  await host.emit("page.message", { message: { type: "hello", scheme: "light" } });
  return host.page.posted.filter((m) => m.do === "setup").at(-1);
}

const say = (host, message) => host.emit("page.message", { message });

describe("docked beside the panes", () => {
  it("opens there when the setting says so, with no grip, and offers to float", async () => {
    const host = await start({ settings: { showAs: "side" } });
    await host.command("open");
    expect(host.page.side).toBe(true);
    expect(host.overlay).toBeNull();
    expect(host.audits).toContainEqual({ action: "opened", details: { as: "side" } });
    const setup = await hello(host);
    expect(setup).toMatchObject({ place: "side", docked: false, themed: true });
    expect(setup.labels.float).toBe("Float over the panes");
  });

  it("moves from the card to the dock and back, and remembers the move", async () => {
    const host = await start();
    await host.command("open");
    expect(await hello(host)).toMatchObject({ place: "card", docked: true });
    await say(host, { type: "place", to: "side" });
    expect(host.page.side).toBe(true);
    expect(host.overlay).toBeNull();
    expect(host.store.get("placement")).toBe("side");
    expect(host.audits).toContainEqual({ action: "moved", details: { to: "side" } });
    await say(host, { type: "place", to: "card" });
    expect(host.page.side).toBe(false);
    expect(host.page.dock).toEqual(SPOT.page);
    expect(host.item("grip-0")).toBeTruthy();
    expect(host.store.get("placement")).toBe("card");
  });

  it("goes back on the card when the user presses Undock on the dock's bar", async () => {
    const host = await start({ settings: { showAs: "side" } });
    await host.command("open");
    await host.undock();
    expect(host.page.open).toBe(true);
    expect(host.page.side).toBe(false);
    expect(host.page.dock).toEqual(SPOT.page);
    expect(host.store.get("placement")).toBe("card");
  });

  it("opens where the user last moved it, until the setting changes", async () => {
    const host = await start({ store: { placement: "side" } });
    await host.command("open");
    expect(host.page.side).toBe(true);
    // Choosing in Settings wins: the panel, then the card again.
    await host.setSetting("showAs", "panel");
    expect(host.store.has("placement")).toBe(false);
    expect(host.panel.content).not.toBeNull();
    await host.setSetting("showAs", "card");
    expect(host.page.side).toBe(false);
    expect(host.page.dock).toEqual(SPOT.page);
  });

  it("forgets the docked page when it is closed from the dock", async () => {
    const host = await start({ settings: { showAs: "side" } });
    await host.command("open");
    host.page.open = false;
    host.page.side = false;
    await host.emit("page.closed", {});
    expect(host.audits).toContainEqual({ action: "closed", details: { as: "side" } });
  });
});

describe("in Tilefold's theme", () => {
  it("draws the card in the theme's mode and the grip in its colors", async () => {
    const host = await start();
    await host.command("open");
    const setup = await hello(host);
    expect(setup).toMatchObject({ theme: "dark", themed: true });
    const grip = decodeURIComponent(host.item("grip-0").image);
    expect(grip).toContain("#1a2030");
    expect(grip).toContain("#2a3346");
  });

  it("follows the theme as it changes", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    await host.setTheme({ mode: "light", name: "paper", colors: { surfaceRaised: "#fafafa" } });
    expect(host.page.posted.at(-1)).toEqual({ do: "theme", theme: "light" });
    expect(decodeURIComponent(host.item("grip-0").image)).toContain("#fafafa");
  });

  it("leaves out a theme color that isn't a plain color", async () => {
    const host = await start({
      theme: { mode: "dark", name: "x", colors: { surfaceRaised: '"><script>' } },
    });
    await host.command("open");
    expect(decodeURIComponent(host.item("grip-0").image)).not.toContain("<script>");
  });

  it("steps its own light and dark switch aside", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    const before = host.page.posted.length;
    await host.command("theme");
    expect(host.page.posted.length).toBe(before);
    expect(host.store.has("appearance")).toBe(false);
  });
});

describe("on an older Tilefold", () => {
  it("never docks beside the panes, nor offers to", async () => {
    const host = await startTile(DIR, { page: "dock", panel: true, settings: { showAs: "side" } });
    await host.command("open");
    expect(host.page.side).toBe(false);
    expect(host.page.dock).toEqual(SPOT.page);
    expect(await hello(host)).toMatchObject({ place: null, themed: false });
    await say(host, { type: "place", to: "side" });
    expect(host.page.dock).toEqual(SPOT.page);
  });
});
