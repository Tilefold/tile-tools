// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the ✦ Polish button in Tilefold's agent input box
 *
 * Where Tilefold has input actions, the tile adds ✦ Polish in the user's
 * language. A click opens the card for the pane the box is in, with the
 * box's text and the check already running; the result offers Use and Keep
 * mine. Use puts the corrected prompt in the box (and folds the card), and
 * Send to agent has Tilefold send it from there too;
 * Keep mine leaves the box and releases the request; a box edited
 * meanwhile, a late answer or a box that went is said on the card. Closing
 * the card releases the request, and so do the card going away and Close
 * in the palette. The × beside Tilefold's spinning button closes the card.
 * The pill isn't drawn over a pane whose row is the agent input box.
 * Nothing the user wrote is recorded or stored.
 *
 * Modified 2026-11-07 (reworked prompts): a text Tilefold refuses ends the
 *   request and says so.
 * Modified 2026-11-10 (Card button): Card shows the pane's card and folds
 *   it again, reading nothing, also while a check runs; a card folded with
 *   a result waiting brings no pill back over the box.
 * Modified 2026-11-13 (card didn't show): Card places the card over the
 *   panes as they are now, also after they changed while it was closed.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ONE_PANE, startTile } from "../fake-host.mjs";
import { paneAt } from "../../examples/prompt-polish/src/inputAction.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "로그인 하면 토큰이 갱신이 안돼요. `src/auth/session.ts` 를 고쳐 주세요.";
const FIXED = "로그인하면 토큰이 갱신이 안 돼요. `src/auth/session.ts` 를 고쳐 주세요.";
const ANSWER = JSON.stringify({
  corrected: FIXED,
  notes: [{ from: "안돼요", to: "안 돼요", kind: "spacing", why: "안 is its own word." }],
});

/** Two panes: an agent pane whose row is the agent input box, and a shell. */
const LAYOUT = {
  content: { w: 1200, h: 800 },
  panes: [
    {
      id: "p1",
      x: 0,
      y: 40,
      w: 800,
      h: 730,
      focused: true,
      composer: { x: 0, y: 714, w: 800, h: 56 },
      agentInput: true,
    },
    {
      id: "p2",
      x: 800,
      y: 40,
      w: 400,
      h: 730,
      focused: false,
      composer: { x: 800, y: 724, w: 400, h: 46 },
    },
  ],
};
/** Where the box's editor is in pane p1. */
const SPOT = { x: 60, y: 720, w: 600, h: 40 };

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, {
    page: "dock",
    agentAsk: true,
    ai: () => ANSWER,
    layout: LAYOUT,
    input: { text: PROMPT, language: "ko" },
    ...opts,
    settings: { language: "ko", ...opts.settings },
  });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) {
      expect(a.action).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(JSON.stringify(a.details ?? {})).not.toMatch(/로그인|토큰|session/);
    }
    for (const value of host.store.values())
      expect(JSON.stringify(value)).not.toMatch(/로그인|토큰/);
  }
});

const say = (host, message) => host.emit("page.message", { message });
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;

/** Clicks ✦ Polish in pane p1's box and lets the check finish. */
async function clicked(host) {
  const request = await host.clickAction("polish", { spot: SPOT });
  await say(host, { type: "hello" });
  return request;
}

describe("the ✦ Polish button in the agent input box", () => {
  it("is added where Tilefold has input actions, labelled in the user's language", async () => {
    const host = await start();
    expect(host.actions).toEqual([
      { id: "polish", label: "✦ Polish" },
      { id: "card", label: "Card", view: true },
    ]);
    const ko = await start({ locale: "ko" });
    expect(ko.actions.map((a) => a.label)).toEqual(["✦ 다듬기", "카드"]);
  });

  it("isn't added, and nothing breaks, on a Tilefold without them", async () => {
    const host = await start({ input: undefined });
    expect(host.regs.some((r) => r.kind === "action")).toBe(false);
    await host.command("open");
    expect(host.page.open).toBe(true);
  });

  it("opens the card with the box's text and the check already done", async () => {
    const host = await start();
    await clicked(host);
    expect(host.page.open).toBe(true);
    expect(host.questions).toHaveLength(1);
    expect(JSON.stringify(host.questions[0])).toContain("로그인 하면");
    expect(lastView(host)).toMatchObject({ step: "result", pane: "p1", input: true });
    expect(host.audits).toContainEqual({
      action: "opened",
      details: { view: "corner", from: "input" },
    });
  });

  it("puts the corrected prompt back in the box on Use, and folds the card", async () => {
    const host = await start();
    await clicked(host);
    await say(host, { type: "send", pane: "p1" });
    expect(host.box.replaced).toEqual([FIXED]);
    expect(host.box.text).toBe(FIXED);
    expect(host.asks).toEqual([]);
    expect(host.page.open).toBe(false);
    expect(host.box.sent).toEqual([]);
    expect(host.audits).toContainEqual({
      action: "used",
      details: { kept: 2, undone: 0, sent: false, translation: false },
    });
  });

  it("puts it in the box and has Tilefold send it on Send to agent", async () => {
    const host = await start();
    await clicked(host);
    await say(host, { type: "send-now", pane: "p1" });
    expect(host.box.sent).toEqual([FIXED]);
    expect(host.asks).toEqual([]);
    expect(host.page.open).toBe(false);
    expect(host.audits).toContainEqual({
      action: "used",
      details: { kept: 2, undone: 0, sent: true, translation: false },
    });
  });

  it("keeps the user's words on Keep mine, and releases the request", async () => {
    const host = await start();
    const request = await clicked(host);
    await say(host, { type: "keep", pane: "p1" });
    expect(host.box.released).toEqual([request]);
    expect(host.box.text).toBe(PROMPT);
    expect(host.page.open).toBe(false);
  });

  it("says so when the box was edited meanwhile, took too long, or went", async () => {
    for (const [play, text] of [
      [(h) => void (h.box.text = "something else"), /changed the text in the box/],
      [(h) => h.expireInput(), /over 10 minutes/],
      [(h) => h.closeBox(), /box you wrote in is gone/],
    ]) {
      const host = await start();
      await clicked(host);
      play(host);
      await say(host, { type: "send", pane: "p1" });
      expect(host.box.replaced).toEqual([]);
      expect(lastView(host)).toMatchObject({ step: "problem" });
      expect(lastView(host).text).toMatch(text);
    }
  });

  it("says Tilefold refused the text, and ends the request, rather than that the box went", async () => {
    // A Tilefold that takes no replacement this long.
    const host = await start({ input: { text: PROMPT, language: "ko", maxReplace: 3 } });
    const request = await clicked(host);
    await say(host, { type: "send", pane: "p1" });
    expect(host.box.replaced).toEqual([]);
    expect(host.box.released).toEqual([request]);
    expect(lastView(host)).toMatchObject({ step: "problem" });
    expect(lastView(host).text).toMatch(/didn't take this text/);
    expect(lastView(host).text).not.toMatch(/is gone/);
  });

  it("releases the request when the card is closed", async () => {
    const host = await start();
    const request = await clicked(host);
    await say(host, { type: "close" });
    expect(host.box.released).toEqual([request]);
  });

  it("draws no pill over the agent input box, and the pill over other panes", async () => {
    const host = await start();
    expect(host.overlay?.items ?? []).toEqual([]);
    // Its overlay stays, empty, so it hears when you go to another tab.
    await clicked(host);
    expect(host.overlay).toMatchObject({ items: [] });
    const shell = await start({ layout: ONE_PANE });
    expect(shell.item("polish-button")).toBeTruthy();
  });
});

describe("stopping", () => {
  it("closes the card when the user presses × beside the spinning button", async () => {
    const host = await start({ settings: { checker: "agent" } });
    await clicked(host);
    expect(lastView(host)).toMatchObject({ step: "agent" });
    await host.stopAction();
    expect(host.page.open).toBe(false);
    expect(host.box.replaced).toEqual([]);
    // A fresh click works again.
    await clicked(host);
    expect(host.page.open).toBe(true);
    expect(host.asks).toHaveLength(2);
  });

  it("ends the request when the card goes away or everything is closed", async () => {
    const host = await start();
    const first = await clicked(host);
    await host.emit("page.closed", {});
    expect(host.box.released).toEqual([first]);
    const second = await clicked(host);
    await host.command("close");
    expect(host.box.released).toEqual([first, second]);
  });
});

describe("paneAt", () => {
  it("finds the pane whose row holds the box, else the focused one", () => {
    expect(paneAt(LAYOUT, SPOT)).toBe("p1");
    expect(paneAt(LAYOUT, { x: 900, y: 730, w: 200, h: 30 })).toBe("p2");
    expect(paneAt(LAYOUT, null)).toBe("p1");
    expect(paneAt(LAYOUT, { x: 0, y: 0, w: 1, h: 1 })).toBe("p1");
    expect(paneAt({ panes: [] }, SPOT)).toBeNull();
  });
});

describe("the Card button", () => {
  it("shows the pane's card and folds it again, reading nothing", async () => {
    const host = await start();
    expect(await host.clickAction("card", { spot: SPOT })).toBeNull();
    await say(host, { type: "hello" });
    expect(host.page.open).toBe(true);
    expect(host.questions).toHaveLength(0);
    expect(host.audits).toContainEqual({ action: "card-toggled", details: { shown: true } });
    await host.clickAction("card", { spot: SPOT });
    expect(host.page.open).toBe(false);
    expect(host.audits).toContainEqual({ action: "card-toggled", details: { shown: false } });
  });

  it("shows over the panes as they are now, after they changed while it was closed", async () => {
    const host = await start();
    await host.clickAction("card", { spot: SPOT });
    await say(host, { type: "hello" });
    await host.command("close");
    // Closed, Promptsmith shows no overlay, so Tilefold tells it nothing when
    // the panes change: here, another tab with one agent pane, p3.
    host.layout = {
      content: { w: 1200, h: 800 },
      panes: [
        {
          id: "p3",
          x: 300,
          y: 40,
          w: 900,
          h: 730,
          focused: true,
          composer: { x: 300, y: 714, w: 900, h: 56 },
          agentInput: true,
        },
      ],
    };
    await host.clickAction("card", { spot: { x: 360, y: 720, w: 600, h: 40 } });
    await say(host, { type: "hello" });
    expect(host.page.open).toBe(true);
    expect(lastView(host)).toMatchObject({ pane: "p3" });
    // Docked inside p3, not where p1 was.
    expect(host.page.dock.x).toBeGreaterThanOrEqual(300);
  });

  it("brings back a check under way", async () => {
    const host = await start();
    await clicked(host);
    await host.clickAction("card", { spot: SPOT });
    expect(host.page.open).toBe(false);
    // Folded with a result waiting: the box's Card button brings it back, so no pill shows.
    expect(host.item("polish-button")).toBeFalsy();
    await host.clickAction("card", { spot: SPOT });
    await say(host, { type: "hello" });
    expect(host.page.open).toBe(true);
    expect(lastView(host)).toMatchObject({ step: "result", pane: "p1", input: true });
  });
});
