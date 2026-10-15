// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — card tests
 *
 * The pictures: times read "m:ss" (and "h:mm:ss"), titles wrap over two
 * lines, the card shows the video or a message, the buttons follow
 * playing, muted and the list, and the list says which row a click hit.
 * The layout puts the card in the corner asked for, buttons under it and
 * the list facing into the pane. Pictures are fetched once and refused
 * when too big. End to end in the fake host: opening shows the window and
 * the card; the page's status moves the card; the buttons control the
 * player; the list plays a video; a button with the window closed opens
 * it on the video watched last; and the card can be hidden.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUTTONS,
  actionForClick,
  renderButton,
} from "../../examples/watchpane/src/render/buttons.js";
import {
  CARD_H,
  CARD_W,
  clock,
  renderCard,
  wrapLines,
} from "../../examples/watchpane/src/render/card.js";
import { LIST_H, LIST_W, listHit, renderList } from "../../examples/watchpane/src/render/list.js";
import { svgOf } from "../../examples/watchpane/src/render/svg.js";
import { cardView, cleanStatus } from "../../examples/watchpane/src/tile/card.js";
import { computeLayout } from "../../examples/watchpane/src/tile/scene.js";
import { createThumbs, MAX_THUMB_BYTES } from "../../examples/watchpane/src/tile/thumbs.js";
import { ONE_PANE, startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/watchpane/", import.meta.url));
const ID = "dQw4w9WgXcQ";
const OTHER = "9bZkp7q19f0";
const t = (key, args) => (args ? `${key}(${Object.values(args).join(",")})` : key);

describe("pictures", () => {
  it("reads times and wraps titles", () => {
    expect([clock(0), clock(65), clock(3725), clock(-3), clock("x")]).toEqual([
      "0:00",
      "1:05",
      "1:02:05",
      "0:00",
      "0:00",
    ]);
    const lines = wrapLines("A very long video title that goes on and on and on", 11, 116, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("draws the video, or a message, as text never markup", () => {
    const video = svgOf(
      renderCard({
        mode: "video",
        title: "<b>Hi</b>",
        detail: "1:00 / 2:00",
        progress: 0.5,
        playing: false,
        thumb: "data:image/jpeg;base64,AAAA",
      }),
    );
    expect(video).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    expect(video).toContain('href="data:image/jpeg;base64,AAAA"');
    expect(video).toContain(`viewBox="0 0 ${CARD_W} ${CARD_H}"`);
    const message = svgOf(
      renderCard({ mode: "message", tone: "error", title: "Oops", hint: "Try again" }),
    );
    expect(message).toContain("Oops");
    expect(message).not.toContain("<image");
  });

  it("draws buttons by state, and knows what a click does", () => {
    expect(BUTTONS.map((b) => b.id)).toEqual(["back", "play", "forward", "mute", "list", "window"]);
    expect(svgOf(renderButton("play", { playing: true }))).toContain("<rect");
    expect(svgOf(renderButton("play", { playing: false }))).toContain("<path");
    expect(svgOf(renderButton("mute", { muted: true }))).not.toEqual(
      svgOf(renderButton("mute", {})),
    );
    expect(actionForClick("btn-mute")).toBe("mute");
    expect(actionForClick("btn-play")).toBe("toggle");
    expect(actionForClick("card")).toBeNull();
  });

  it("draws the list and finds the row a click hit", () => {
    const svg = svgOf(
      renderList({
        heading: "Lately",
        empty: "None",
        videos: [{ id: ID, title: "One" }],
        current: ID,
      }),
    );
    expect(svg).toContain("Lately");
    expect(svg).toContain("One");
    expect(
      svgOf(renderList({ heading: "h", empty: "None yet", videos: [], current: null })),
    ).toContain("None yet");
    const rect = { x: 100, y: 50, w: LIST_W, h: LIST_H };
    expect(listHit(rect, 150, 50 + 30, 3)).toBe(0);
    expect(listHit(rect, 150, 50 + 28 + 24 * 2 + 5, 3)).toBe(2);
    expect(listHit(rect, 150, 50 + 28 + 24 * 3 + 5, 3)).toBeNull();
    expect(listHit(rect, 150, 55, 3)).toBeNull();
    expect(listHit(undefined, 0, 0, 3)).toBeNull();
  });
});

describe("layout", () => {
  it("puts the card in the corner asked for, buttons under it, the list facing in", () => {
    const pane = ONE_PANE.panes[0];
    const br = computeLayout(ONE_PANE, "bottom-right", { list: true });
    expect(br.card.x + br.card.w).toBe(pane.x + pane.w - 12);
    expect(br["btn-back"].x).toBe(br.card.x);
    expect(br["btn-window"].x + br["btn-window"].w).toBe(br.card.x + br.card.w);
    expect(br["btn-play"].y).toBe(br.card.y + br.card.h + 6);
    expect(br.list.y + br.list.h).toBe(br.card.y - 6);
    const tl = computeLayout(ONE_PANE, "top-left", { list: true });
    expect(tl.card).toMatchObject({ x: pane.x + 12, y: pane.y + 12 });
    expect(tl.list.y).toBeGreaterThan(tl["btn-play"].y);
    expect(computeLayout(ONE_PANE, "sideways").card).toEqual(br.card);
    expect(computeLayout(null, "bottom-right").list).toBeUndefined();
  });
});

describe("card state", () => {
  it("cleans what the page reports, and shows it", () => {
    expect(cleanStatus({ id: 5 })).toBeNull();
    const s = cleanStatus({
      id: ID,
      title: "T",
      playing: true,
      time: 61.7,
      duration: -1,
      muted: 1,
    });
    expect(s).toEqual({ id: ID, title: "T", playing: true, time: 61, duration: 0, muted: false });
    expect(cardView(t, null, [], null)).toMatchObject({ mode: "message", title: "card-idle" });
    const paused = cardView(t, { ...s, playing: false, duration: 122, muted: true }, [], "pic");
    expect(paused).toMatchObject({
      mode: "video",
      title: "T",
      detail: "card-muted(card-paused(1:01 / 2:02))",
      playing: false,
      thumb: "pic",
    });
    expect(paused.progress).toBeCloseTo(0.5);
    // Without a title from the player, the recent list's is used.
    expect(cardView(t, { ...s, title: "" }, [{ id: ID, title: "Saved" }], null).title).toBe(
      "Saved",
    );
  });

  it("fetches each picture once, and refuses big or odd ones", async () => {
    const fetchFn = vi.fn(async (url) => ({
      ok: true,
      headers: { "content-type": url.includes(OTHER) ? "text/html" : "image/jpeg" },
      bytes: async () => new Uint8Array(url.includes("big") ? MAX_THUMB_BYTES + 1 : 3),
    }));
    const thumbs = createThumbs(fetchFn);
    const [a, b] = await Promise.all([thumbs.get(ID), thumbs.get(ID)]);
    expect(a).toBe("data:image/jpeg;base64,AAAA");
    expect(b).toBe(a);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(`https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
    expect(await thumbs.get(OTHER)).toBeNull();
    expect(await thumbs.get("not an id")).toBeNull();
    expect(thumbs.peek(ID)).toBe(a);
    expect(await createThumbs(null).get(ID)).toBeNull();
  });
});

describe("Watchpane's card, in the fake host", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** The tile with pages, the network (a tiny picture) and a recent list. */
  const start = (opts = {}) =>
    startTile(DIR, {
      page: true,
      net: async () => ({
        status: 200,
        ok: true,
        headers: { "content-type": "image/jpeg" },
        // The fake host's bytes() encodes the body: these are bytes 1, 2, 3.
        body: "\u0001\u0002\u0003",
      }),
      store: {
        recent: [
          { id: ID, title: "First" },
          { id: OTHER, title: "Second" },
        ],
      },
      ...opts,
    });
  /** The page's messages to the tile. */
  const fromPage = (host, message) => host.emit("page.message", { message });
  const posts = (host) => host.page.posted;

  it("shows the card with the window, and moves with the page's status", async () => {
    const host = await start();
    await host.command("open");
    expect(host.page.opens).toEqual([{ origin: "https" }]);
    expect(host.overlay.items.map((i) => i.id)).toEqual([
      "card",
      "btn-back",
      "btn-play",
      "btn-forward",
      "btn-mute",
      "btn-list",
      "btn-window",
    ]);
    expect(svgOf(host.item("card").image)).toContain("Nothing on yet");

    await fromPage(host, {
      type: "status",
      id: ID,
      title: "Song",
      playing: true,
      time: 30,
      duration: 120,
      muted: false,
    });
    await host.advance(0);
    const card = svgOf(host.item("card").image);
    expect(card).toContain("Song");
    expect(card).toContain("0:30 / 2:00");
    // The picture came from YouTube's image host and is drawn in the card.
    expect(host.requests[0].url).toBe(`https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
    expect(card).toContain("data:image/jpeg;base64,AQID");
  });

  it("controls the player from its buttons", async () => {
    const host = await start();
    await host.command("open");
    await fromPage(host, {
      type: "status",
      id: ID,
      playing: true,
      time: 1,
      duration: 9,
      muted: false,
    });
    for (const item of ["btn-play", "btn-back", "btn-forward", "btn-mute"]) {
      await host.emit("overlay.pointer", { item, type: "click", x: 0, y: 0 });
    }
    expect(
      posts(host)
        .filter((m) => m.do === "control")
        .map((m) => m.action),
    ).toEqual(["toggle", "back", "forward", "mute"]);
    await fromPage(host, {
      type: "status",
      id: ID,
      playing: true,
      time: 1,
      duration: 9,
      muted: true,
    });
    await host.command("mute");
    expect(posts(host).at(-1)).toEqual({ do: "control", action: "unmute" });
    // The card itself brings the window forward.
    await host.emit("overlay.pointer", { item: "card", type: "click", x: 0, y: 0 });
    expect(host.page.opens).toHaveLength(2);
  });

  it("plays a video picked from its list", async () => {
    const host = await start();
    await host.command("open");
    await fromPage(host, { type: "hello" });
    await host.emit("overlay.pointer", { item: "btn-list", type: "click", x: 0, y: 0 });
    const list = host.item("list");
    expect(svgOf(list.image)).toContain("Second");
    await host.emit("overlay.pointer", {
      item: "list",
      type: "click",
      x: list.x + 50,
      y: list.y + 28 + 24 + 5,
    });
    expect(posts(host).at(-1)).toEqual({ do: "play", id: OTHER });
    expect(host.item("list")).toBeUndefined();
  });

  it("opens a closed window on the video watched last", async () => {
    const host = await start();
    await host.command("open");
    await host.emit("page.closed");
    expect(svgOf(host.item("card").image)).toContain("Nothing on yet");
    await host.emit("overlay.pointer", { item: "btn-play", type: "click", x: 0, y: 0 });
    expect(host.page.opens).toHaveLength(2);
    await fromPage(host, { type: "hello" });
    expect(posts(host).map((m) => m.do)).toEqual(["setup", "play"]);
    expect(posts(host).at(-1)).toEqual({ do: "play", id: ID });
  });

  it("can be hidden, and stays hidden when the setting says so", async () => {
    const host = await start();
    await host.command("open");
    await host.command("card");
    expect(host.overlay).toBeNull();
    expect(host.audits.map((a) => a.action).sort()).toEqual([
      "card.hidden",
      "card.shown",
      "opened",
    ]);
    const quiet = await start({ settings: { showCard: false } });
    await quiet.command("open");
    expect(quiet.overlay).toBeNull();
  });

  it("docks the video next to the card where Tilefold can, and moves it with the panes", async () => {
    const host = await start({ page: "dock" });
    await host.command("open");
    const spot = computeLayout(ONE_PANE, "bottom-right", { video: true }).video;
    expect(host.page.opens).toEqual([{ origin: "https", dock: spot }]);
    // Above the card, lined up with its right edge.
    const card = host.item("card");
    expect(spot.y + spot.h).toBe(card.y - 6);
    expect(spot.x + spot.w).toBe(card.x + card.w);
    expect(host.audits).toContainEqual({ action: "opened", details: { docked: true } });
    await fromPage(host, { type: "hello" });
    expect(posts(host)[0]).toMatchObject({ do: "setup", docked: true });

    const moved = { ...ONE_PANE, panes: [{ ...ONE_PANE.panes[0], x: 0, w: 700 }] };
    await host.emit("overlay.layout", moved);
    expect(host.page.dock).toEqual(computeLayout(moved, "bottom-right", { video: true }).video);
  });

  it("shows the link box from the card, and closes and opens the docked video", async () => {
    const host = await start({ page: "dock" });
    await host.command("open");
    await host.emit("overlay.pointer", { item: "card", type: "click", x: 0, y: 0 });
    expect(posts(host).at(-1)).toEqual({ do: "paste" });
    await host.emit("overlay.pointer", { item: "btn-window", type: "click", x: 0, y: 0 });
    expect(host.page.closes).toBe(1);
    await host.emit("page.closed");
    await host.emit("overlay.pointer", { item: "btn-window", type: "click", x: 0, y: 0 });
    expect(host.page.opens.at(-1)).toMatchObject({ origin: "https", dock: expect.any(Object) });
  });

  it("closes the docked video with its card", async () => {
    const host = await start({ page: "dock" });
    await host.command("open");
    await host.command("card");
    expect(host.overlay).toBeNull();
    expect(host.page.closes).toBe(1);
  });

  it("plays in a window of its own where Tilefold can't dock", async () => {
    const host = await start();
    await host.command("open");
    expect(host.page.opens).toEqual([{ origin: "https" }]);
    await host.emit("overlay.pointer", { item: "card", type: "click", x: 0, y: 0 });
    expect(host.page.opens).toHaveLength(2);
  });
});
