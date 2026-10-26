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
 * drag it), answers come back from the page, progress is saved and
 * resumed, dragging the grip moves the page and keeps the spot, the panel
 * shows the same quiz as rows, and older Tilefolds get a window or a
 * notice instead. What the user does is recorded, and nothing they typed.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cardSpots } from "../../examples/quiz/src/scene.js";
import { ONE_PANE, startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/quiz/", import.meta.url));
const SPOT = cardSpots(ONE_PANE, "bottom-right", null);

const start = (opts = {}) => startTile(DIR, { page: "dock", panel: true, ...opts });

/** The last view the tile sent the page. */
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;

/** The page loads and says hello. */
const hello = (host) => host.emit("page.message", { message: { type: "hello" } });

/** The user clicks something on the page. */
const say = (host, message) => host.emit("page.message", { message });

/** The actions recorded, in order. */
const actions = (host) => host.audits.map((a) => a.action);

describe("the quiz on a card", () => {
  it("opens as a borderless page docked in the pane's corner, with a grip above it", async () => {
    const host = await start();
    await host.command("open");
    expect(host.page.open).toBe(true);
    expect(host.page.dock).toEqual(SPOT.page);
    expect(host.item("grip-l")).toMatchObject({ ...SPOT.gripL, hit: true, cursor: "grab" });
    expect(host.item("grip-r")).toMatchObject({ ...SPOT.gripR, hit: true, cursor: "grab" });
    expect(host.item("grip-l").label).toBe("Drag to move the quiz");
    expect(host.audits).toContainEqual({ action: "quiz.opened", details: { as: "card" } });
  });

  it("sends the page its language and the first question when it loads", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    expect(host.page.posted[0]).toEqual({
      do: "setup",
      lang: "en",
      dir: "ltr",
      title: "Terminal quiz",
      close: "Close the quiz",
    });
    expect(lastView(host)).toMatchObject({
      done: false,
      progress: "Question 1 of 6",
      question: "Which character sends one command's output into another command?",
    });
  });

  it("marks an answer, records whether it was right, and saves the progress", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    await say(host, { type: "pick", choice: 1 });
    const v = lastView(host);
    expect(v.choices.map((c) => c.mark)).toEqual(["right", "wrong", "none", "none"]);
    expect(v).toMatchObject({ result: "Not quite.", next: "Next question" });
    expect(host.audits).toContainEqual({
      action: "quiz.answered",
      details: { question: "pipe", correct: false },
    });
    expect(host.store.get("progress")).toMatchObject({ index: 0, picked: 1, score: 0 });
    // A second pick for the same question changes nothing.
    await say(host, { type: "pick", choice: 0 });
    expect(host.store.get("progress")).toMatchObject({ picked: 1, score: 0 });
  });

  it("goes through every question to the score, once, and starts over", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    const answers = [0, 1, 2, 0, 2, 0];
    for (const choice of answers) {
      await say(host, { type: "pick", choice });
      await say(host, { type: "next" });
    }
    expect(lastView(host)).toEqual({
      done: true,
      score: "You got 6 of 6 right.",
      again: "Start over",
    });
    await say(host, { type: "next" });
    expect(actions(host).filter((a) => a === "quiz.finished")).toHaveLength(1);
    expect(host.audits.find((a) => a.action === "quiz.finished").details).toEqual({
      score: 6,
      total: 6,
    });
    await say(host, { type: "again" });
    expect(lastView(host)).toMatchObject({ done: false, progress: "Question 1 of 6" });
    expect(actions(host)).toContain("quiz.restarted");
  });

  it("resumes saved progress", async () => {
    const saved = { index: 2, picked: null, score: 2, done: false, total: 6 };
    const host = await start({ store: { progress: saved } });
    await host.command("open");
    await hello(host);
    expect(lastView(host).progress).toBe("Question 3 of 6");
  });

  it("closes from its own button, keeping the progress", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    await say(host, { type: "pick", choice: 0 });
    await say(host, { type: "close" });
    expect(host.page.open).toBe(false);
    expect(host.overlay).toBeNull();
    expect(host.store.get("progress")).toMatchObject({ picked: 0 });
    expect(host.audits).toContainEqual({ action: "quiz.closed", details: { as: "card" } });
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
    expect(host.audits).toContainEqual({ action: "quiz.closed", details: { as: "page" } });
  });
});

describe("moving the card", () => {
  it("moves the page with the grip while dragging, and keeps the spot only on the drop", async () => {
    const host = await start();
    await host.command("open");
    const from = SPOT.gripL;
    await host.emit("overlay.pointer", { item: "grip-l", type: "dragstart", x: from.x, y: from.y });
    await host.emit("overlay.pointer", {
      item: "grip-l",
      type: "drag",
      x: from.x - 300,
      y: from.y - 200,
    });
    expect(host.page.dock).toMatchObject({ x: SPOT.page.x - 300, y: SPOT.page.y - 200 });
    expect(host.item("grip-l")).toMatchObject({ x: from.x - 300, y: from.y - 200 });
    expect(host.store.has("position")).toBe(false);
    await host.emit("overlay.pointer", {
      item: "grip-r",
      type: "drop",
      x: from.x - 300,
      y: from.y - 200,
    });
    expect(host.store.get("position")).toEqual({
      fx: expect.any(Number),
      fy: expect.any(Number),
    });
    expect(host.audits).toContainEqual({ action: "card.moved", details: { via: "drag" } });
  });

  it("goes back to the pane's corner with the command", async () => {
    const host = await start({ store: { position: { fx: 0, fy: 0 } } });
    await host.command("open");
    expect(host.page.dock).toMatchObject({ x: 0 });
    await host.command("put-back");
    expect(host.page.dock).toEqual(SPOT.page);
    expect(host.store.has("position")).toBe(false);
    expect(host.audits).toContainEqual({ action: "card.reset", details: { via: "command" } });
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
    await host.emit("overlay.pointer", { item: "grip-l", type: "drag", x: 10, y: 10 });
    await host.emit("overlay.pointer", { item: "other", type: "dragstart", x: 10, y: 10 });
    await host.emit("overlay.pointer", { item: "other", type: "drop", x: 10, y: 10 });
    expect(host.page.docks).toHaveLength(0);
    expect(host.store.has("position")).toBe(false);
  });
});

describe("the quiz in a panel", () => {
  it("shows the question and choices as rows, and answers from a click", async () => {
    const host = await start({ settings: { showAs: "panel" } });
    await host.command("open");
    expect(host.page.open).toBe(false);
    expect(host.panel.content.title).toBe("Terminal quiz");
    expect(host.panel.content.subtitle).toBe("Question 1 of 6");
    expect(host.panel.content.rows.map((r) => r.id)).toEqual([
      "question",
      "choice-0",
      "choice-1",
      "choice-2",
      "choice-3",
    ]);
    await host.emit("panel.click", { row: "choice-0", action: "activate" });
    const ids = host.panel.content.rows.map((r) => r.id);
    expect(ids).toContain("result");
    expect(ids).toContain("why");
    await host.emit("panel.click", { row: "next", action: "activate" });
    expect(host.panel.content.subtitle).toBe("Question 2 of 6");
    expect(host.audits).toContainEqual({ action: "quiz.opened", details: { as: "panel" } });
  });

  it("forgets the panel when the user closes it", async () => {
    const host = await start({ settings: { showAs: "panel" } });
    await host.command("open");
    await host.emit("panel.closed", { by: "user" });
    await host.emit("panel.click", { row: "choice-0", action: "activate" });
    expect(host.store.has("progress")).toBe(false);
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
    expect(host.audits).toContainEqual({ action: "quiz.opened", details: { as: "window" } });
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
    await host.command("open");
    await hello(host);
    expect(host.page.posted[0].lang).toBe("de");
    expect(lastView(host).question).not.toMatch(/Which character/);
  });
});
