/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the playlist panel on the card
 *
 * The Playlists button (or its command) opens a panel next to the card,
 * within the overlay's eight-item limit, and closes it again, removing it
 * from the scene. It lists the user's playlists with room for five rows;
 * dragging scrolls them (settling on a whole row, stopping at the ends) and
 * the arrows scroll a page, loading more as needed; a row plays its playlist
 * where music plays, or inside Tilefold when nothing does; "Show all" opens
 * the Library window. Errors show in the panel or as a notice. It works
 * without tile pages too, minus "Show all". Steps are recorded without
 * names or URIs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_H } from "../../../examples/tuneboard/src/render/panel.js";
import { svgOf } from "../../../examples/tuneboard/src/render/svg.js";
import { runTuneboard } from "../../../examples/tuneboard/src/tile/run.js";
import { registerSettings } from "../../../examples/tuneboard/src/tile/settings.js";
import { createFactory, playlist } from "../support/fake-spotify.js";
import { createHost, drain, messagesOf } from "../support/fake-tf.js";

const EN = messagesOf("en");

/** Starts Tuneboard with the card shown and `count` playlists. */
async function start({ count = 7, page = true, track } = {}) {
  const { host, tf } = createHost({ net: true, page });
  const factory = createFactory({
    track,
    playlists: Array.from({ length: count }, (_, i) => playlist(i + 1)),
  });
  registerSettings(tf);
  const handles = runTuneboard(tf, { createSpotify: factory.createSpotify });
  await drain();
  await host.command("toggle");
  await host.advance(0);
  return { host, tf, factory, ...handles };
}

/** Clicks a point of the panel, in its own logical units (PANEL_W × PANEL_H). */
async function clickPanel(host, lx, ly) {
  const p = host.item("panel");
  const scale = p.h / PANEL_H;
  await host.click("panel", p.x + lx * scale, p.y + ly * scale);
  await host.advance(0);
}

const row = (i) => [150, 6 + 34 * i + 10];

/** The panel's range text in English. */
const range = (from, to, total) =>
  EN.get("panel-range")
    .replace("{ $from }", from)
    .replace("{ $to }", to)
    .replace("{ $total }", total);

/** Sends a pointer event at a point of the panel, in its own units. */
async function pointPanel(host, type, lx, ly) {
  const p = host.item("panel");
  const scale = p.h / PANEL_H;
  await host.emit("overlay.pointer", {
    item: "panel",
    type,
    x: p.x + lx * scale,
    y: p.y + ly * scale,
  });
  await host.advance(0);
}

/** Drags across the panel from one point to another, in its own units. */
async function dragPanel(host, [x0, y0], [x1, y1]) {
  await pointPanel(host, "dragstart", x0, y0);
  await pointPanel(host, "drag", (x0 + x1) / 2, (y0 + y1) / 2);
  await pointPanel(host, "drag", x1, y1);
  await pointPanel(host, "drop", x1, y1);
}
const FOOT = PANEL_H - 6 - 13;

/** The panel's picture, as SVG. */
const panelSvg = (host) => svgOf(host.item("panel").image);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the playlist panel", () => {
  it("opens from the button above the card, within the overlay's limits, and closes", async () => {
    const { host } = await start();
    await host.click("btn-playlists");
    await host.advance(0);
    const panel = host.item("panel");
    const card = host.item("card");
    expect(panel).toBeDefined();
    // In a bottom corner the panel sits above the card.
    expect(panel.y + panel.h).toBeLessThanOrEqual(card.y);
    expect(panel.x).toBe(card.x);
    expect(host.overlay.items.length).toBeLessThanOrEqual(8);
    expect(panelSvg(host)).toContain("Playlist 1");
    expect(panelSvg(host)).toContain("Playlist 5");
    // Six are drawn: the sixth waits just below, clipped, for scrolling.
    expect(panelSvg(host)).not.toContain("Playlist 7");
    expect(panel.label).toContain(EN.get("library-title"));
    await host.click("btn-playlists");
    await host.advance(0);
    expect(host.item("panel")).toBeUndefined();
    expect(host.actions()).toEqual(expect.arrayContaining(["panel.show", "panel.hide"]));
  });

  it("scrolls a page with the arrows, loading more and stopping at the ends", async () => {
    const { host, factory } = await start({ count: 12 });
    await host.command("playlists");
    await host.advance(0);
    expect(host.item("panel").label).toContain(range(1, 5, 12));
    await clickPanel(host, 50, FOOT);
    expect(host.item("panel").label).toContain(range(6, 10, 12));
    expect(panelSvg(host)).toContain("Playlist 10");
    // The fake serves two at a time, so scrolling on asked for more.
    expect(factory.client.calls.filter((c) => c.startsWith("playlists:")).length).toBeGreaterThan(
      2,
    );
    await clickPanel(host, 50, FOOT);
    await clickPanel(host, 50, FOOT);
    // The last page ends with the last playlist, not with empty rows.
    expect(host.item("panel").label).toContain(range(8, 12, 12));
    await clickPanel(host, 20, FOOT);
    await clickPanel(host, 20, FOOT);
    await clickPanel(host, 20, FOOT);
    expect(host.item("panel").label).toContain(range(1, 5, 12));
  });

  it("scrolls by dragging the rows, settling on a whole row, and plays the right one", async () => {
    const { host, factory } = await start({ count: 12 });
    await host.command("playlists");
    await host.advance(0);
    // Drag up by two and a bit rows: the list follows, then settles.
    await dragPanel(host, [150, 120], [150, 120 - 34 * 2 - 10]);
    expect(host.item("panel").label).toContain(range(3, 7, 12));
    expect(panelSvg(host)).toContain("Playlist 3");
    // A click now plays what is drawn there.
    await clickPanel(host, ...row(0));
    expect(factory.client.calls).toContain("playContext:spotify:playlist:pl3:active");
    // Dragging down past the top stops at the top.
    await dragPanel(host, [150, 40], [150, 400]);
    expect(host.item("panel").label).toContain(range(1, 5, 12));
    // A drag that starts on the footer doesn't scroll.
    await dragPanel(host, [90, FOOT], [90, FOOT - 100]);
    expect(host.item("panel").label).toContain(range(1, 5, 12));
  });

  it("shows the list moving while it is dragged", async () => {
    const { host } = await start({ count: 12 });
    await host.command("playlists");
    await host.advance(0);
    const before = panelSvg(host);
    await pointPanel(host, "dragstart", 150, 120);
    await pointPanel(host, "drag", 150, 103);
    // Half a row up: the first row's cover is drawn 17 pixels higher.
    expect(panelSvg(host)).not.toBe(before);
    expect(panelSvg(host)).toContain(`y="${6 + 4 - 17}"`);
    await pointPanel(host, "drop", 150, 103);
    // Exactly half a row rounds on to the next row.
    expect(host.item("panel").label).toContain(range(2, 6, 12));
  });

  it("plays a row where music plays, highlighting it", async () => {
    const { host, factory } = await start();
    await host.command("playlists");
    await host.advance(0);
    await clickPanel(host, ...row(1));
    expect(factory.client.calls).toContain("playContext:spotify:playlist:pl2:active");
    expect(panelSvg(host)).toContain('fill-opacity="0.18"');
    const played = host.audits.find((a) => a.action === "library.play");
    expect(played.details).toEqual({ ok: true, via: "device", from: "panel" });
  });

  it("starts the player inside Tilefold when nothing plays", async () => {
    const { host, factory } = await start({ track: null });
    await host.command("playlists");
    await host.advance(0);
    void clickPanel(host, ...row(0));
    await host.advance(0);
    await host.fromPage({ type: "ready", deviceId: "dev-3" });
    await host.advance(0);
    expect(factory.client.calls).toContain("playContext:spotify:playlist:pl1:dev-3");
  });

  it("opens the Library window from Show all", async () => {
    const { host } = await start();
    await host.command("playlists");
    await host.advance(0);
    await clickPanel(host, 180, FOOT);
    expect(host.page).toMatchObject({ open: true, visible: true });
  });

  it("shows failures in the panel or as a notice", async () => {
    const { host, factory } = await start();
    factory.client.failNext("scope");
    await host.command("playlists");
    await host.advance(0);
    expect(panelSvg(host)).toContain(EN.get("library-error-scope").slice(0, 20));
    const empty = await start({ count: 0 });
    await empty.host.command("playlists");
    await empty.host.advance(0);
    expect(panelSvg(empty.host)).toContain(
      EN.get("library-empty").split(" ").slice(0, 3).join(" "),
    );
    const { host: h2, factory: f2 } = await start();
    await h2.command("playlists");
    await h2.advance(0);
    f2.client.failNext("premium");
    await clickPanel(h2, ...row(0));
    expect(h2.toasts).toContain(EN.get("player-error-premium"));
  });

  it("works without tile pages, without Show all", async () => {
    const { host, factory } = await start({ page: false });
    await host.command("playlists");
    await host.advance(0);
    expect(panelSvg(host)).not.toContain(EN.get("panel-show-all"));
    await clickPanel(host, ...row(0));
    expect(factory.client.calls).toContain("playContext:spotify:playlist:pl1:active");
  });

  it("shows the card first when the command opens the panel", async () => {
    const { host, tf, factory } = await (async () => {
      const { host, tf } = createHost({ net: true, page: true });
      const factory = createFactory({ playlists: [playlist(1)] });
      registerSettings(tf);
      runTuneboard(tf, { createSpotify: factory.createSpotify });
      await drain();
      return { host, tf, factory };
    })();
    expect(host.overlay).toBeNull();
    await host.command("playlists");
    await host.advance(0);
    expect(host.item("card")).toBeDefined();
    expect(host.item("panel")).toBeDefined();
    expect(tf).toBeDefined();
    expect(factory.clients.length).toBe(1);
  });
});
