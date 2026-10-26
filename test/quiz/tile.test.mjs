// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the tile in a fake Tilefold
 *
 * The built tile, driven as Tilefold would drive it: the quiz opens on a
 * borderless card (its page docked over the focused pane, with a grip to
 * drag it) at the list of quizzes; a quiz taken from the list is answered
 * from the page, its progress is kept and resumed, and finishing keeps the
 * best score. Dragging the card's top bar or its grip moves the page and
 * keeps the spot, and dragging its corner resizes it and keeps the size; the
 * card switches between light and dark; the panel shows the same as rows;
 * older Tilefolds get a window or a notice instead. Every action recorded
 * is one word, as Tilefold requires, and nothing the user typed.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cardSpots } from "../../examples/quiz/src/scene.js";
import { ONE_PANE, startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/quiz/", import.meta.url));
const SPOT = cardSpots(ONE_PANE, "bottom-right", null);

/** Every host a test started, to check what it recorded afterwards. */
const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, { page: "dock", panel: true, ...opts });
  hosts.push(host);
  return host;
};

afterEach(() => {
  // Tilefold refuses a tile action with a dot: each is one word.
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(a.action).toMatch(/^[a-z][a-z0-9-]*$/);
  }
});

/** The last view the tile sent the page. */
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;

/** The page loads and says hello, with the system's light or dark. */
const hello = (host, scheme = "light") =>
  host.emit("page.message", { message: { type: "hello", scheme } });

/** The user clicks something on the page. */
const say = (host, message) => host.emit("page.message", { message });

/** Opens the card and takes the built-in quiz. */
async function takeBuiltin(host) {
  await host.command("open");
  await hello(host);
  await say(host, { type: "open-quiz", id: "terminal" });
}

/** The actions recorded, in order. */
const actions = (host) => host.audits.map((a) => a.action);

describe("the quiz on a card", () => {
  it("opens as a borderless page docked in the pane's corner, with a grip above it", async () => {
    const host = await start();
    await host.command("open");
    expect(host.page.open).toBe(true);
    expect(host.page.dock).toEqual(SPOT.page);
    expect(host.overlay.items).toHaveLength(SPOT.grip.length);
    SPOT.grip.forEach((r, i) => {
      const { from, ...rect } = r;
      void from;
      expect(host.item(`grip-${i}`)).toMatchObject({ ...rect, hit: true, cursor: "grab" });
    });
    expect(host.item("grip-0").label).toBe("Drag to move the quiz");
    expect(host.audits).toContainEqual({ action: "opened", details: { as: "card" } });
  });

  it("sends the page its language, labels and appearance, then the list of quizzes", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    expect(host.page.posted[0]).toEqual({
      do: "setup",
      lang: "en",
      dir: "ltr",
      theme: "light",
      docked: true,
      labels: {
        close: "Close the quiz",
        list: "All quizzes",
        theme: "Switch light or dark",
        resize: "Drag to resize the quiz",
      },
    });
    expect(lastView(host)).toMatchObject({
      screen: "list",
      title: "Quizzes",
      quizzes: [{ id: "terminal", title: "Terminal quiz", detail: "Questions: 6" }],
    });
  });

  it("takes a quiz from the list, at its first question", async () => {
    const host = await start();
    await takeBuiltin(host);
    expect(lastView(host)).toMatchObject({
      screen: "quiz",
      title: "Terminal quiz",
      progress: "Question 1 of 6",
      question: "Which character sends one command's output into another command?",
    });
    expect(host.store.get("current")).toBe("terminal");
  });

  it("marks an answer, records whether it was right, and keeps the progress", async () => {
    const host = await start();
    await takeBuiltin(host);
    await say(host, { type: "pick", choice: 1 });
    const v = lastView(host);
    expect(v.choices.map((c) => c.mark)).toEqual(["right", "wrong", "none", "none"]);
    expect(v).toMatchObject({ result: "Not quite.", next: "Next question" });
    expect(host.audits).toContainEqual({
      action: "answered",
      details: { quiz: "terminal", question: 1, correct: false },
    });
    expect(host.store.get("progress:terminal")).toMatchObject({ index: 0, picked: 1, score: 0 });
    // A second pick for the same question changes nothing.
    await say(host, { type: "pick", choice: 0 });
    expect(host.store.get("progress:terminal")).toMatchObject({ picked: 1, score: 0 });
  });

  it("goes through every question to the score, keeps the best, and starts over", async () => {
    const host = await start();
    await takeBuiltin(host);
    for (const choice of [0, 1, 2, 0, 2, 0]) {
      await say(host, { type: "pick", choice });
      await say(host, { type: "next" });
    }
    expect(lastView(host)).toMatchObject({ done: true, score: "You got 6 of 6 right." });
    await say(host, { type: "next" });
    expect(actions(host).filter((a) => a === "finished")).toHaveLength(1);
    expect(host.store.get("quizzes").find((e) => e.id === "terminal").best).toBe(6);
    await say(host, { type: "again" });
    expect(lastView(host)).toMatchObject({ done: false, progress: "Question 1 of 6" });
    expect(host.audits).toContainEqual({ action: "restarted", details: { quiz: "terminal" } });
    await say(host, { type: "list" });
    expect(lastView(host).quizzes[0].detail).toBe("Questions: 6 · best: 6");
  });

  it("resumes the quiz being taken, where it was left", async () => {
    const saved = { index: 2, picked: null, score: 2, done: false, total: 6 };
    const host = await start({ store: { current: "terminal", "progress:terminal": saved } });
    await host.command("open");
    await hello(host);
    expect(lastView(host).progress).toBe("Question 3 of 6");
  });

  it("closes from its own button, keeping everything", async () => {
    const host = await start();
    await takeBuiltin(host);
    await say(host, { type: "pick", choice: 0 });
    await say(host, { type: "close" });
    expect(host.page.open).toBe(false);
    expect(host.overlay).toBeNull();
    expect(host.store.get("progress:terminal")).toMatchObject({ picked: 0 });
    expect(host.audits).toContainEqual({ action: "closed", details: { as: "card" } });
  });

  it("closes with the tile's overlays when the user hides them", async () => {
    const host = await start();
    await host.command("open");
    await host.emit("overlay.hidden", { by: "user" });
    expect(host.page.open).toBe(false);
  });

  it("forgets the card when the page is closed elsewhere", async () => {
    const host = await start();
    await host.command("open");
    host.page.open = false;
    await host.emit("page.closed", {});
    expect(host.overlay).toBeNull();
    expect(host.audits).toContainEqual({ action: "closed", details: { as: "page" } });
  });
});

describe("light or dark", () => {
  it("follows the system the page reports, on the card and its grip", async () => {
    const host = await start();
    await host.command("open");
    await hello(host, "dark");
    expect(host.page.posted[0].theme).toBe("dark");
    expect(decodeURIComponent(host.item("grip-0").image)).toContain("#262833");
    await say(host, { type: "scheme", scheme: "light" });
    expect(host.page.posted.at(-1)).toEqual({ do: "theme", theme: "light" });
    expect(decodeURIComponent(host.item("grip-0").image)).toContain("#f3f4f8");
  });

  it("switches with the command or the card's button, and remembers it", async () => {
    const host = await start();
    await host.command("open");
    await hello(host, "light");
    await host.command("theme");
    expect(host.page.posted.at(-1)).toEqual({ do: "theme", theme: "dark" });
    expect(host.store.get("appearance")).toBe("dark");
    await say(host, { type: "theme" });
    expect(host.page.posted.at(-1)).toEqual({ do: "theme", theme: "light" });
    expect(host.audits).toContainEqual({ action: "theme-switched", details: { to: "light" } });
  });

  it("uses the setting, which wins over the last switch", async () => {
    const host = await start({ store: { appearance: "light" } });
    await host.command("open");
    await hello(host, "light");
    await host.setSetting("appearance", "dark");
    expect(host.page.posted.at(-1)).toEqual({ do: "theme", theme: "dark" });
    expect(host.store.has("appearance")).toBe(false);
  });
});

describe("moving the card", () => {
  it("moves the page with the grip while dragging, and keeps the spot only on the drop", async () => {
    const host = await start();
    await host.command("open");
    const from = { x: SPOT.grip[0].x, y: SPOT.grip[0].y };
    const at = { x: from.x - 300, y: from.y - 200 };
    await host.emit("overlay.pointer", { item: "grip-0", type: "dragstart", ...from });
    await host.emit("overlay.pointer", { item: "grip-0", type: "drag", ...at });
    expect(host.page.dock).toMatchObject({ x: SPOT.page.x - 300, y: SPOT.page.y - 200 });
    expect(host.item("grip-0")).toMatchObject(at);
    expect(host.store.has("position")).toBe(false);
    await host.emit("overlay.pointer", { item: "grip-1", type: "drop", ...at });
    expect(host.store.get("position")).toEqual({ fx: expect.any(Number), fy: expect.any(Number) });
    expect(host.audits).toContainEqual({ action: "card-moved", details: { via: "grip" } });
  });

  it("moves by the card's own top bar, as the page reports the drag", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    await say(host, { type: "move", phase: "start" });
    await say(host, { type: "move", phase: "move", dx: -250, dy: -150 });
    expect(host.page.dock).toMatchObject({ x: SPOT.page.x - 250, y: SPOT.page.y - 150 });
    expect(host.item("grip-0")).toMatchObject({ x: SPOT.card.x - 250, y: SPOT.card.y - 150 });
    expect(host.store.has("position")).toBe(false);
    await say(host, { type: "move", phase: "end", dx: -260, dy: -150 });
    expect(host.page.dock).toMatchObject({ x: SPOT.page.x - 260 });
    expect(host.store.get("position")).toEqual({ fx: expect.any(Number), fy: expect.any(Number) });
    expect(host.audits).toContainEqual({ action: "card-moved", details: { via: "card" } });
  });

  it("ignores a page drag that never started, or a bad one", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "move", phase: "move", dx: 50, dy: 50 });
    await say(host, { type: "move", phase: "sideways", dx: 50, dy: 50 });
    await say(host, { type: "resize", phase: "end", dw: 50, dh: 50 });
    expect(host.page.docks).toHaveLength(0);
  });

  it("resizes by its corner from the top-left, and keeps the size", async () => {
    const host = await start({ store: { position: { fx: 0, fy: 0 } } });
    await host.command("open");
    await hello(host);
    const before = { ...host.page.dock };
    await say(host, { type: "resize", phase: "start" });
    await say(host, { type: "resize", phase: "move", dw: 120, dh: -40 });
    expect(host.page.dock).toEqual({
      x: before.x,
      y: before.y,
      w: before.w + 120,
      h: before.h - 40,
    });
    expect(host.overlay.items.map((i) => i.id)).toEqual(["grip-0", "grip-1"]);
    await say(host, { type: "resize", phase: "end", dw: 200, dh: -40 });
    expect(host.page.dock).toMatchObject({ x: before.x, w: before.w + 200 });
    // The grip grows with the card: three pieces for 560 pixels.
    expect(host.overlay.items).toHaveLength(3);
    expect(host.store.get("size")).toEqual({ w: before.w + 200, h: before.h - 40 });
    expect(host.audits).toContainEqual({
      action: "card-resized",
      details: { w: before.w + 200, h: before.h - 40 },
    });
  });

  it("stays inside the window when it grows against an edge", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "resize", phase: "start" });
    await say(host, { type: "resize", phase: "end", dw: 120, dh: 0 });
    const dock = host.page.dock;
    expect(dock.w).toBe(SPOT.page.w + 120);
    expect(dock.x + dock.w).toBeLessThanOrEqual(ONE_PANE.content.w);
  });

  it("keeps the size between the smallest and the largest", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "resize", phase: "start" });
    await say(host, { type: "resize", phase: "end", dw: -1000, dh: -1000 });
    expect(host.page.dock).toMatchObject({ w: 280, h: 240 });
  });

  it("comes back at the size it was left", async () => {
    const host = await start({ store: { size: { w: 500, h: 420 } } });
    await host.command("open");
    expect(host.page.dock).toMatchObject({ w: 500, h: 420 });
  });

  it("goes back to the pane's corner with the command", async () => {
    const host = await start({ store: { position: { fx: 0, fy: 0 } } });
    await host.command("open");
    expect(host.page.dock).toMatchObject({ x: 0 });
    await host.command("put-back");
    expect(host.page.dock).toEqual(SPOT.page);
    expect(host.store.has("position")).toBe(false);
    expect(host.audits).toContainEqual({ action: "card-reset", details: { via: "command" } });
  });

  it("follows the focused pane as the layout changes", async () => {
    const host = await start();
    await host.command("open");
    const layout = {
      content: { w: 1200, h: 800 },
      panes: [
        { id: "a", x: 0, y: 40, w: 600, h: 730, focused: true, composer: null },
        { id: "b", x: 600, y: 40, w: 600, h: 730, focused: false, composer: null },
      ],
    };
    host.layout = layout;
    await host.emit("overlay.layout", layout);
    expect(host.page.dock).toEqual(cardSpots(layout, "bottom-right", null).page);
  });

  it("ignores pointer events that aren't a drag of the grip", async () => {
    const host = await start();
    await host.command("open");
    await host.emit("overlay.pointer", { item: "grip-0", type: "drag", x: 10, y: 10 });
    await host.emit("overlay.pointer", { item: "other", type: "dragstart", x: 10, y: 10 });
    await host.emit("overlay.pointer", { item: "other", type: "drop", x: 10, y: 10 });
    expect(host.page.docks).toHaveLength(0);
    expect(host.store.has("position")).toBe(false);
  });
});

describe("the quiz in a panel", () => {
  it("lists the quizzes, then shows a question's choices as rows and answers a click", async () => {
    const host = await start({ settings: { showAs: "panel" } });
    await host.command("open");
    expect(host.page.open).toBe(false);
    expect(host.panel.content.title).toBe("Quizzes");
    expect(host.panel.content.rows.map((r) => r.id)).toEqual(["quiz:terminal"]);
    await host.emit("panel.click", { row: "quiz:terminal", action: "activate" });
    expect(host.panel.content.subtitle).toBe("Question 1 of 6");
    await host.emit("panel.click", { row: "choice-0", action: "activate" });
    const ids = host.panel.content.rows.map((r) => r.id);
    expect(ids).toContain("result");
    expect(ids).toContain("why");
    await host.emit("panel.click", { row: "next", action: "activate" });
    expect(host.panel.content.subtitle).toBe("Question 2 of 6");
    await host.emit("panel.click", { row: "list", action: "activate" });
    expect(host.panel.content.title).toBe("Quizzes");
    expect(host.audits).toContainEqual({ action: "opened", details: { as: "panel" } });
  });

  it("forgets the panel when the user closes it", async () => {
    const host = await start({ settings: { showAs: "panel" } });
    await host.command("open");
    await host.emit("panel.closed", { by: "user" });
    await host.emit("panel.click", { row: "quiz:terminal", action: "activate" });
    expect(host.store.has("current")).toBe(false);
  });

  it("moves between the card and the panel when the setting changes", async () => {
    const host = await start();
    await host.command("open");
    await host.setSetting("showAs", "panel");
    expect(host.page.open).toBe(false);
    expect(host.overlay).toBeNull();
    expect(host.panel.content).not.toBeNull();
    await host.setSetting("showAs", "card");
    expect(host.panel.content).toBeNull();
    expect(host.page.open).toBe(true);
  });
});

describe("older Tilefolds", () => {
  it("open the page in a window of its own when pages can't dock", async () => {
    const host = await start({ page: true, panel: false });
    await host.command("open");
    expect(host.page.open).toBe(true);
    expect(host.page.dock).toBeNull();
    expect(host.overlay).toBeNull();
    expect(host.audits).toContainEqual({ action: "opened", details: { as: "window" } });
  });

  it("use the panel without tile pages, and say so with neither", async () => {
    const panelOnly = await start({ page: false });
    await panelOnly.command("open");
    expect(panelOnly.panel.content).not.toBeNull();
    const neither = await start({ page: false, panel: false });
    await neither.command("open");
    expect(neither.toasts).toEqual(["Quiz needs Tilefold 0.1.7 or later."]);
  });
});

describe("its strings", () => {
  it("arrive in the user's language", async () => {
    const host = await start({ locale: "de" });
    await takeBuiltin(host);
    expect(host.page.posted[0].lang).toBe("de");
    expect(lastView(host).question).not.toMatch(/Which character/);
  });
});
