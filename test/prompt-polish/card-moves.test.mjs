// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — moving, filling and folding the card
 *
 * Over the pane the user drags the card by its header: it moves as far as
 * the pointer went, never out of its pane or over the input row, and the
 * next drag starts where it was left. ▢ (or a double click) makes it fill
 * the pane and brings it back where it was. Choosing another view puts it
 * back in place. Folded over Tilefold's agent input box, a card with fixes
 * leaves the pill, which opens it again. Audits carry no positions.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { startTile } from "../fake-host.mjs";
import { createCardMoves } from "../../examples/prompt-polish/src/cardMoves.js";
import { GAP } from "../../examples/prompt-polish/src/place.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "please fix teh login bug";
const ANSWER = JSON.stringify({
  corrected: "Please fix the login bug.",
  notes: [{ from: "teh", to: "the", kind: "spelling", why: "A typo." }],
});

/** One agent pane whose row is Tilefold's agent input box. */
const PANE = { x: 0, y: 40, w: 1000, h: 730 };
const LAYOUT = {
  content: { w: 1000, h: 800 },
  panes: [
    {
      id: "p1",
      ...PANE,
      focused: true,
      composer: { x: 0, y: 714, w: 1000, h: 56 },
      agentInput: true,
    },
  ],
};
const FLOOR = 714 - GAP;

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, {
    page: "dock",
    ai: () => ANSWER,
    layout: LAYOUT,
    input: { text: PROMPT, language: "en" },
    ...opts,
    settings: { language: "en", ...opts.settings },
  });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits)
      expect(JSON.stringify(a.details ?? {})).not.toMatch(/login|"d?[xy]"/);
  }
});

const say = (host, message) => host.emit("page.message", { message });
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;
const drag = async (host, dx, dy) => {
  await say(host, { type: "drag", phase: "start", dx: 0, dy: 0 });
  await say(host, { type: "drag", phase: "move", dx: dx / 2, dy: dy / 2 });
  await say(host, { type: "drag", phase: "end", dx, dy });
};

/** Clicks ✦ Polish in the box and lets the check finish. */
async function opened() {
  const host = await start();
  await host.clickAction("polish", { spot: { x: 60, y: 720, w: 600, h: 40 } });
  await say(host, { type: "hello" });
  return host;
}

describe("dragging the card", () => {
  it("moves it as far as the pointer went, and the next drag starts there", async () => {
    const host = await opened();
    const home = { ...host.page.dock };
    await drag(host, -200, -150);
    expect(host.page.dock).toEqual({ ...home, x: home.x - 200, y: home.y - 150 });
    await drag(host, 50, 0);
    expect(host.page.dock).toEqual({ ...home, x: home.x - 150, y: home.y - 150 });
    expect(host.audits.filter((a) => a.action === "card-moved")).toHaveLength(2);
  });

  it("never takes it out of its pane or over the input row", async () => {
    const host = await opened();
    await drag(host, -5000, -5000);
    expect(host.page.dock).toMatchObject({ x: PANE.x + GAP, y: PANE.y + GAP });
    // From where it stopped, not from where the pointer went.
    await drag(host, 0, 10);
    expect(host.page.dock.y).toBe(PANE.y + GAP + 10);
    await drag(host, 5000, 5000);
    const d = host.page.dock;
    expect(d.x + d.w).toBe(PANE.x + PANE.w - GAP);
    expect(d.y + d.h).toBe(FLOOR);
  });

  it("goes back in place when another view is chosen", async () => {
    const host = await opened();
    await say(host, { type: "view", to: "bottom" });
    const home = { ...host.page.dock };
    await drag(host, 0, -100);
    await say(host, { type: "view", to: "corner" });
    await say(host, { type: "view", to: "bottom" });
    expect(host.page.dock).toEqual(home);
  });
});

describe("filling the pane", () => {
  it("fills the pane above its input row, then goes back where it was", async () => {
    const host = await opened();
    await drag(host, -100, -100);
    const moved = { ...host.page.dock };
    await say(host, { type: "max" });
    expect(host.page.dock).toEqual({
      x: PANE.x + GAP,
      y: PANE.y + GAP,
      w: PANE.w - 2 * GAP,
      h: FLOOR - (PANE.y + GAP),
    });
    expect(lastView(host).max).toBe(true);
    // No dragging while it fills the pane.
    await drag(host, 30, 30);
    expect(host.page.dock.x).toBe(PANE.x + GAP);
    await say(host, { type: "max" });
    expect(host.page.dock).toEqual(moved);
    expect(lastView(host).max).toBe(false);
    expect(host.audits).toContainEqual({ action: "card-filled", details: { on: true } });
    expect(host.audits).toContainEqual({ action: "card-filled", details: { on: false } });
  });
});

describe("folding over the agent input box", () => {
  it("leaves the pill while the card has fixes, and the pill opens it again", async () => {
    const host = await opened();
    expect(host.item("polish-button")).toBeFalsy();
    await say(host, { type: "fold" });
    expect(host.page.open).toBe(false);
    expect(host.item("polish-button")).toBeTruthy();
    await host.emit("overlay.pointer", { item: "polish-button", type: "click" });
    expect(host.page.open).toBe(true);
    expect(lastView(host)).toMatchObject({ step: "result" });
  });
});

describe("drag messages", () => {
  it("place only the latest move while one is being placed", async () => {
    let release;
    let placed = 0;
    const moves = createCardMoves({
      place: () => new Promise((r) => ((release = r), (placed += 1))),
      audit: () => {},
      render: async () => {},
      kept: () => ({ dx: 0, dy: 0 }),
    });
    moves.hear({ type: "drag", phase: "start", dx: 0, dy: 0 });
    for (let i = 1; i <= 5; i += 1) moves.hear({ type: "drag", phase: "move", dx: i, dy: 0 });
    release();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(placed).toBe(2);
    expect(moves.state().offset).toEqual({ dx: 5, dy: 0 });
  });

  it("takes only numbers, within reason", async () => {
    const moves = createCardMoves({
      place: async () => {},
      audit: () => {},
      render: async () => {},
      kept: () => ({ dx: 0, dy: 0 }),
    });
    expect(await moves.hear({ type: "drag", phase: "move", dx: "x", dy: 1e9 })).toBe(true);
    expect(moves.state().offset).toEqual({ dx: 0, dy: 10_000 });
    expect(await moves.hear({ type: "view" })).toBe(false);
  });
});
