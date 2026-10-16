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
 * the list facing into the pane; the docked player puts the dock right
 * under the video, as wide as it, and the list beside them; a dragged
 * position wins over the corner, kept clear of every Composer row and the
 * bars above the panes (where Tilefold lets no overlay item be clicked).
 * The dock is drawn in two halves within Tilefold's item size, and a click
 * on it finds its button. Pictures are
 * fetched once and refused when too big. End to end in the fake host:
 * opening shows the window and the card; the page's status moves the
 * card; the buttons control the player; the list plays a video; a button
 * with the window closed opens it on the video watched last; the card can
 * be hidden; the docked player is controlled from its dock, and dragged,
 * remembered, and put back.
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
import {
  DOCK_H,
  DOCK_HALF,
  DOCK_W,
  buttonX,
  dockHit,
  renderDock,
} from "../../examples/watchpane/src/render/dock.js";
import {
  LIST_H,
  LIST_W,
  listHeight,
  listHit,
  renderList,
} from "../../examples/watchpane/src/render/list.js";
import { MAX_SIDE, svgOf } from "../../examples/watchpane/src/render/svg.js";
import { cardView, cleanStatus } from "../../examples/watchpane/src/tile/card.js";
import { POSITION_KEY } from "../../examples/watchpane/src/tile/mover.js";
import { cleanStart, readResume, resumePoint } from "../../examples/watchpane/src/tile/resume.js";
import {
  computeLayout,
  DOCK_GAP,
  clickable,
  keepOut,
  settle,
  SIDE_LIST_ROWS,
  VIDEO_H,
  VIDEO_W,
} from "../../examples/watchpane/src/tile/scene.js";
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
    // A taller list beside the video: more rows, the same row maths.
    const tall = { x: 0, y: 0, w: LIST_W, h: listHeight(SIDE_LIST_ROWS) };
    expect(listHit(tall, 50, 28 + 24 * 8 + 5, 12, SIDE_LIST_ROWS)).toBe(8);
    const nine = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, title: `Video ${i}` }));
    const svg9 = svgOf(
      renderList({ heading: "h", empty: "", videos: nine, current: null }, { rows: 9 }),
    );
    expect(svg9).toContain("Video 8");
    expect(svg9).not.toContain("Video 9");
    expect(listHeight(SIDE_LIST_ROWS)).toBeLessThanOrEqual(MAX_SIDE);
  });

  it("draws the dock in two halves within the item size, with the video's title and time", () => {
    const { left, right } = renderDock(
      { mode: "video", title: "<i>Song</i>", detail: "0:30 / 2:00", progress: 0.25 },
      { playing: true },
    );
    const l = svgOf(left);
    const r = svgOf(right);
    expect(DOCK_HALF * 2).toBe(DOCK_W);
    expect(DOCK_HALF).toBeLessThanOrEqual(MAX_SIDE);
    expect(l).toContain(`viewBox="0 0 ${DOCK_HALF} ${DOCK_H}"`);
    expect(r).toContain(`viewBox="${DOCK_HALF} 0 ${DOCK_HALF} ${DOCK_H}"`);
    expect(l).toContain("&lt;i&gt;Song&lt;/i&gt;");
    expect(l).toContain("0:30 / 2:00");
    // Nothing on yet: the hint instead of the progress bar.
    const idle = svgOf(
      renderDock({ mode: "message", tone: "info", title: "Idle", hint: "Paste here" }).left,
    );
    expect(idle).toContain("Idle");
    expect(idle).toContain("Paste here");
  });

  it("finds the dock button a click hit, and pastes for the rest of the bar", () => {
    const rect = { x: 100, y: 400, w: DOCK_W, h: DOCK_H };
    const centre = (i) => [rect.x + buttonX(i) + 14, rect.y + 46 + 14];
    expect(dockHit(rect, ...centre(0))).toBe("back");
    expect(dockHit(rect, ...centre(1))).toBe("toggle");
    expect(dockHit(rect, ...centre(3))).toBe("mute");
    expect(dockHit(rect, ...centre(5))).toBe("window");
    expect(dockHit(rect, rect.x + 30, rect.y + 20)).toBe("paste");
    expect(dockHit(rect, rect.x - 1, rect.y + 20)).toBeNull();
    expect(dockHit(rect, rect.x + 10, rect.y + DOCK_H + 1)).toBeNull();
    expect(dockHit(undefined, 0, 0)).toBeNull();
    expect(dockHit(rect, NaN, 0)).toBeNull();
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

  it("stacks the docked video over a dock as wide as it, with the list on the left", () => {
    const pane = ONE_PANE.panes[0];
    const p = computeLayout(ONE_PANE, "bottom-right", { video: true, list: true });
    expect(p.video).toMatchObject({ w: VIDEO_W, h: VIDEO_H });
    expect(p.video.x + p.video.w).toBe(pane.x + pane.w - 12);
    expect(p.dock).toEqual({
      x: p.video.x,
      y: p.video.y + VIDEO_H + DOCK_GAP,
      w: DOCK_W,
      h: DOCK_H,
    });
    expect(p["dock-l"]).toMatchObject({ x: p.dock.x, w: DOCK_HALF });
    expect(p["dock-r"]).toMatchObject({ x: p.dock.x + DOCK_HALF, w: DOCK_HALF });
    expect(p.card).toBeUndefined();
    expect(p["btn-play"]).toBeUndefined();
    // The list beside the player, on its left, centred on it.
    expect(p.list.x + p.list.w).toBe(p.video.x - 6);
    expect(p.list.y + p.list.h / 2).toBeCloseTo(p.group.y + p.group.h / 2, 0);
    // With no room on the left, on the right.
    const left = computeLayout(ONE_PANE, "bottom-left", { video: true, list: true });
    expect(left.list.x).toBe(left.video.x + left.video.w + 6);
  });

  it("puts a dragged group where the user dropped it, whichever its shape", () => {
    const { w } = ONE_PANE.content;
    const pane = ONE_PANE.panes[0];
    // Dragged to the very top: it stops at the panes, clear of the tab bar.
    const atTopLeft = computeLayout(ONE_PANE, "bottom-right", { position: { fx: 0, fy: 0 } });
    expect(atTopLeft.card).toMatchObject({ x: 0, y: pane.y });
    // Dragged near the top, the list opens below.
    const open = computeLayout(ONE_PANE, "bottom-right", {
      list: true,
      position: { fx: 0, fy: 0 },
    });
    expect(open.list.y).toBeGreaterThan(open["btn-play"].y);
    const player = computeLayout(ONE_PANE, "top-left", {
      video: true,
      position: { fx: 1, fy: 1 },
    });
    expect(player.group.x + player.group.w).toBe(w);
    // Dragged to the very bottom: it stops just above the Composer, clickable.
    expect(player.dock.y + player.dock.h).toBe(pane.composer.y - 6);
  });

  it("keeps a dragged player clear of every Composer row and the bars above the panes", () => {
    const touches = (a, b) =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    expect(keepOut(ONE_PANE)).toEqual({ top: 40, zones: [ONE_PANE.panes[0].composer] });
    // Two panes, one over the other: a Composer row in the middle of the window too.
    const split = {
      content: { w: 1200, h: 800 },
      panes: [
        {
          id: "p1",
          x: 0,
          y: 40,
          w: 1200,
          h: 360,
          focused: true,
          composer: { x: 0, y: 354, w: 1200, h: 46 },
        },
        {
          id: "p2",
          x: 0,
          y: 400,
          w: 1200,
          h: 400,
          focused: false,
          composer: { x: 0, y: 754, w: 1200, h: 46 },
        },
      ],
    };
    for (let fy = 0; fy <= 1; fy += 0.05) {
      for (const video of [true, false]) {
        const r = computeLayout(split, "bottom-right", { video, position: { fx: 1, fy } });
        const hot = video ? [r.dock] : [r.card, r["btn-play"]];
        for (const rect of hot) {
          for (const zone of split.panes.map((p) => p.composer)) {
            expect(touches(rect, zone)).toBe(false);
          }
          expect(rect.y).toBeGreaterThanOrEqual(40);
        }
      }
    }
    // Where above a row has no room, it goes just below it.
    const short = {
      content: { w: 1200, h: 800 },
      panes: [
        {
          id: "p1",
          x: 0,
          y: 40,
          w: 1200,
          h: 300,
          focused: true,
          composer: { x: 0, y: 294, w: 1200, h: 46 },
        },
        {
          id: "p2",
          x: 0,
          y: 340,
          w: 1200,
          h: 460,
          focused: false,
          composer: { x: 0, y: 754, w: 1200, h: 46 },
        },
      ],
    };
    const fy = 100 / (800 - 290);
    const low = computeLayout(short, "bottom-right", { video: true, position: { fx: 0, fy } });
    expect(low.group.y).toBe(340 + 6);
    // A window too small to keep it clear still keeps it inside.
    const tiny = { content: { w: 400, h: 300 }, panes: [{ ...ONE_PANE.panes[0], w: 400, h: 260 }] };
    const r = computeLayout(tiny, "bottom-right", { video: true, position: { fx: 1, fy: 1 } });
    expect(r.group.y).toBeGreaterThanOrEqual(0);
    expect(settle(null, { x: 5, y: 9 }, { w: 10, h: 10 })).toEqual({ x: 5, y: 9 });
    // The small card's list opens on the side where it can be clicked.
    for (let fy = 0; fy <= 1; fy += 0.05) {
      const c = computeLayout(split, "bottom-right", { list: true, position: { fx: 0, fy } });
      if (clickable(split, c.list)) continue;
      // Not clickable: then the other side can't be either (both were tried).
      const g = c.group;
      const other =
        c.list.y > g.y ? { ...c.list, y: g.y - 6 - c.list.h } : { ...c.list, y: g.y + g.h + 6 };
      expect(clickable(split, other)).toBe(false);
    }
  });

  it("frees a player stuck over the Composer from an earlier drag", async () => {
    const host = await startTile(DIR, {
      page: "dock",
      store: { [POSITION_KEY]: { fx: 1, fy: 1 } },
    });
    await host.command("open");
    const composer = ONE_PANE.panes[0].composer;
    const dock = { ...host.item("dock-l") };
    expect(dock.y + dock.h).toBeLessThanOrEqual(composer.y);
    expect(host.page.dock.y + host.page.dock.h).toBeLessThan(dock.y);
  });
});

describe("resume point", () => {
  it("keeps where the video was, from the top once it had ended", () => {
    expect(resumePoint({ id: ID, time: 75, duration: 300 })).toEqual({ id: ID, at: 75 });
    expect(resumePoint({ id: ID, time: 298, duration: 300 })).toEqual({ id: ID, at: 0 });
    // A live stream reports no duration: the time is kept.
    expect(resumePoint({ id: ID, time: 40, duration: 0 })).toEqual({ id: ID, at: 40 });
    expect(resumePoint(null)).toBeNull();
    expect(resumePoint({ id: "bad", time: 4, duration: 9 })).toBeNull();
  });

  it("reads a stored point back, refusing damaged ones", () => {
    expect(readResume({ id: ID, at: 12.7 })).toEqual({ id: ID, at: 12 });
    expect(readResume({ id: ID, at: -3 })).toEqual({ id: ID, at: 0 });
    expect(readResume({ id: "<x>", at: 3 })).toBeNull();
    expect(readResume("nope")).toBeNull();
    expect(cleanStart(10 ** 9)).toBe(24 * 60 * 60);
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

  it("carries on where the video was when it is opened again", async () => {
    const host = await start({ page: "dock" });
    await host.command("open");
    await fromPage(host, { type: "hello" });
    await fromPage(host, {
      type: "status",
      id: OTHER,
      title: "Second",
      playing: true,
      time: 75,
      duration: 300,
      muted: false,
    });
    // The window button closes the video, and opens it again.
    const dock = computeLayout(ONE_PANE, "bottom-right", { video: true }).dock;
    const windowButton = { x: dock.x + buttonX(5) + 14, y: dock.y + 46 + 14 };
    await host.emit("overlay.pointer", { item: "dock-r", type: "click", ...windowButton });
    expect(host.page.closes).toBe(1);
    await host.emit("page.closed");
    expect(host.store.get("resume")).toEqual({ id: OTHER, at: 75 });
    await host.emit("overlay.pointer", { item: "btn-window", type: "click", x: 0, y: 0 });
    await fromPage(host, { type: "hello" });
    expect(posts(host).at(-1)).toEqual({ do: "play", id: OTHER, start: 75 });

    // Remembered across a restart too.
    const again = await start({ store: { resume: { id: OTHER, at: 75 } } });
    await again.command("toggle");
    await fromPage(again, { type: "hello" });
    expect(posts(again).at(-1)).toEqual({ do: "play", id: OTHER, start: 75 });
  });

  it("starts from the top a video that had ended, or one picked from the list", async () => {
    const host = await start();
    await host.command("open");
    await fromPage(host, { type: "hello" });
    await fromPage(host, { type: "status", id: ID, playing: false, time: 119, duration: 120 });
    await host.emit("page.closed");
    await host.emit("overlay.pointer", { item: "btn-play", type: "click", x: 0, y: 0 });
    await fromPage(host, { type: "hello" });
    expect(posts(host).at(-1)).toEqual({ do: "play", id: ID });
    // Picked from the list while closed: from the top, whatever was kept.
    await fromPage(host, { type: "status", id: ID, playing: true, time: 50, duration: 120 });
    await host.emit("page.closed");
    await host.emit("overlay.pointer", { item: "btn-list", type: "click", x: 0, y: 0 });
    const list = host.item("list");
    await host.emit("overlay.pointer", {
      item: "list",
      type: "click",
      x: list.x + 50,
      y: list.y + 28 + 24 + 5,
    });
    await fromPage(host, { type: "hello" });
    expect(posts(host).at(-1)).toEqual({ do: "play", id: OTHER });
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

  it("docks the video over its control dock where Tilefold can, and moves it with the panes", async () => {
    const host = await start({ page: "dock" });
    await host.command("open");
    const layout = computeLayout(ONE_PANE, "bottom-right", { video: true });
    expect(host.page.opens).toEqual([{ origin: "https", dock: layout.video }]);
    // The dock's two halves, right under the video and as wide as it; no card.
    expect(host.overlay.items.map((i) => i.id)).toEqual(["dock-l", "dock-r"]);
    const dl = host.item("dock-l");
    expect(dl.y).toBe(layout.video.y + VIDEO_H + DOCK_GAP);
    expect(dl.x).toBe(layout.video.x);
    expect(host.item("dock-r").x + DOCK_HALF).toBe(layout.video.x + VIDEO_W);
    expect(host.audits).toContainEqual({ action: "opened", details: { docked: true } });
    await fromPage(host, { type: "hello" });
    expect(posts(host)[0]).toMatchObject({ do: "setup", docked: true });

    const moved = { ...ONE_PANE, panes: [{ ...ONE_PANE.panes[0], x: 0, w: 700 }] };
    await host.emit("overlay.layout", moved);
    expect(host.page.dock).toEqual(computeLayout(moved, "bottom-right", { video: true }).video);
  });

  it("plays, skips, mutes and lists from the dock's buttons", async () => {
    const host = await start({ page: "dock" });
    await host.command("open");
    await fromPage(host, { type: "hello" });
    await fromPage(host, {
      type: "status",
      id: ID,
      title: "Song",
      playing: true,
      time: 5,
      duration: 50,
      muted: false,
    });
    expect(svgOf(host.item("dock-l").image)).toContain("Song");
    const dock = computeLayout(ONE_PANE, "bottom-right", { video: true }).dock;
    const at = (i) => ({ x: dock.x + buttonX(i) + 14, y: dock.y + 46 + 14 });
    const click = (i) =>
      host.emit("overlay.pointer", { item: i < 3 ? "dock-l" : "dock-r", type: "click", ...at(i) });
    for (const i of [0, 1, 2, 3]) await click(i);
    expect(
      posts(host)
        .filter((m) => m.do === "control")
        .map((m) => m.action),
    ).toEqual(["back", "toggle", "forward", "mute"]);
    // The list opens beside the player, and a row plays its video.
    await click(4);
    const list = host.item("list");
    expect(list.x + list.w).toBe(dock.x - 6);
    expect(list.h).toBe(listHeight(SIDE_LIST_ROWS));
    await host.emit("overlay.pointer", {
      item: "list",
      type: "click",
      x: list.x + 50,
      y: list.y + 28 + 24 + 5,
    });
    expect(posts(host).at(-1)).toEqual({ do: "play", id: OTHER });
    // Elsewhere on the bar: the box to paste a link.
    await host.emit("overlay.pointer", {
      item: "dock-l",
      type: "click",
      x: dock.x + 20,
      y: dock.y + 20,
    });
    expect(posts(host).at(-1)).toEqual({ do: "paste" });
  });

  it("drags the player by its dock, video and all, and remembers where", async () => {
    const host = await start({ page: "dock" });
    await host.command("open");
    const before = { ...host.item("dock-l") };
    const from = { x: before.x + 40, y: before.y + 10 };
    await host.emit("overlay.pointer", { item: "dock-l", type: "dragstart", ...from });
    await host.emit("overlay.pointer", {
      item: "dock-l",
      type: "drag",
      x: from.x - 100,
      y: from.y - 50,
    });
    // The video follows the dock while it moves.
    expect(host.item("dock-l")).toMatchObject({ x: before.x - 100, y: before.y - 50 });
    expect(host.page.dock).toMatchObject({
      x: before.x - 100,
      y: before.y - 50 - VIDEO_H - DOCK_GAP,
    });
    expect(host.store.has(POSITION_KEY)).toBe(false);
    await host.emit("overlay.pointer", {
      item: "dock-r",
      type: "drop",
      x: from.x - 120,
      y: from.y - 60,
    });
    expect(host.item("dock-l")).toMatchObject({ x: before.x - 120, y: before.y - 60 });
    const saved = host.store.get(POSITION_KEY);
    expect(saved).toMatchObject({ fx: expect.any(Number), fy: expect.any(Number) });
    expect(host.audits).toContainEqual({ action: "card.moved", details: { via: "drag" } });
    // A drop is never taken as a click.
    expect(posts(host).filter((m) => m.do === "paste")).toEqual([]);

    // Remembered: a new start puts the player there.
    const again = await start({ page: "dock", store: { [POSITION_KEY]: saved } });
    await again.command("open");
    expect(again.item("dock-l")).toMatchObject({ x: before.x - 120, y: before.y - 60 });

    // The command puts it back in the pane's corner.
    await host.command("reset");
    expect(host.item("dock-l")).toMatchObject({ x: before.x, y: before.y });
    expect(host.store.get(POSITION_KEY)).toBeNull();
    expect(host.audits).toContainEqual({ action: "card.reset", details: { via: "command" } });
  });

  it("puts a dragged player back when a corner is chosen", async () => {
    const host = await start({ page: "dock", store: { [POSITION_KEY]: { fx: 0, fy: 0 } } });
    await host.command("open");
    expect(host.item("dock-l")).toMatchObject({ x: 0 });
    await host.setSetting("corner", "top-left");
    const want = computeLayout(ONE_PANE, "top-left", { video: true });
    expect(host.item("dock-l")).toMatchObject({ x: want.dock.x, y: want.dock.y });
    expect(host.audits).toContainEqual({ action: "card.reset", details: { via: "corner" } });
  });

  it("drags the small card too", async () => {
    const host = await start();
    await host.command("open");
    const card = { ...host.item("card") };
    await host.emit("overlay.pointer", {
      item: "card",
      type: "dragstart",
      x: card.x + 5,
      y: card.y + 5,
    });
    await host.emit("overlay.pointer", {
      item: "card",
      type: "drop",
      x: card.x - 95,
      y: card.y - 45,
    });
    expect(host.item("card")).toMatchObject({ x: card.x - 100, y: card.y - 50 });
    // A drag on a button doesn't move anything.
    const play = { ...host.item("btn-play") };
    await host.emit("overlay.pointer", {
      item: "btn-play",
      type: "dragstart",
      x: play.x,
      y: play.y,
    });
    await host.emit("overlay.pointer", {
      item: "btn-play",
      type: "drop",
      x: play.x + 50,
      y: play.y,
    });
    expect(host.item("btn-play")).toEqual(play);
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
