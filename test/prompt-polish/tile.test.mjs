// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the tile in a fake Tilefold
 *
 * The built tile, driven as Tilefold would drive it: it opens on a card
 * over the focused pane, right above its input, and follows focus; the
 * page gets its labels and the step to draw; Check asks Claude in the
 * chosen language and shows the fixes; changes are undone from the page;
 * Send to agent puts the result on the ask card. "Don't send", a missing
 * key, an answer that changed code, a busy ask card, a pane too small, the
 * corner button (opened, folded, clicked), the side dock, a window on
 * older Tilefolds and a change of setting are covered. The prompt is never
 * stored and never recorded: actions are one word, with counts only.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ONE_PANE, startTile } from "../fake-host.mjs";
import { placeFor } from "../../examples/prompt-polish/src/place.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "로그인 하면 토큰이 갱신이 안돼요. `src/auth/session.ts` 를 고쳐 주세요.";
const FIXED = "로그인하면 토큰이 갱신이 안 돼요. `src/auth/session.ts` 를 고쳐 주세요.";
const ANSWER = JSON.stringify({
  corrected: FIXED,
  notes: [
    {
      from: "로그인 하면",
      to: "로그인하면",
      kind: "spacing",
      why: "Verbs with 하다 are written together.",
    },
    { from: "안돼요", to: "안 돼요", kind: "spacing", why: "안 is its own word." },
  ],
});

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, {
    page: "dock",
    agentAsk: true,
    ai: () => ANSWER,
    settings: { language: "ko" },
    ...opts,
  });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) {
      // Tilefold refuses a tile action with a dot: each is one word.
      expect(a.action).toMatch(/^[a-z][a-z0-9-]*$/);
      // Nothing the user wrote is ever recorded.
      expect(JSON.stringify(a.details ?? {})).not.toMatch(/로그인|토큰|session/);
    }
    // Nothing the user wrote is ever stored.
    for (const value of host.store.values())
      expect(JSON.stringify(value)).not.toMatch(/로그인|토큰/);
  }
});

const say = (host, message) => host.emit("page.message", { message });
const hello = (host) => say(host, { type: "hello" });
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;
const setup = (host) => host.page.posted.find((m) => m.do === "setup");

/** Opens the card and checks the prompt. */
async function checked(host, text = PROMPT) {
  await host.command("open");
  await hello(host);
  await say(host, { type: "check", text });
}

describe("over the agent's pane", () => {
  it("opens on a card across the focused pane, right above its input", async () => {
    const host = await start();
    await host.command("open");
    expect(host.page.open).toBe(true);
    expect(host.page.dock).toEqual(placeFor(ONE_PANE, "bottom", { h: 260 }).card);
    expect(host.overlay).toBeNull();
    expect(host.audits).toContainEqual({ action: "opened", details: { view: "bottom" } });
  });

  it("sends the page its language and labels, then the step to write in", async () => {
    const host = await start();
    await host.command("open");
    await hello(host);
    expect(setup(host)).toMatchObject({ lang: "en", dir: "ltr" });
    expect(setup(host).labels.words).toBe("Words: {count}");
    expect(lastView(host)).toMatchObject({
      step: "write",
      view: "bottom",
      language: "한국어",
      unspaced: false,
    });
    expect(lastView(host).placeholder).toBe("Write your prompt in 한국어…");
  });

  it("follows the focused pane, and fits the height the page asks for", async () => {
    const host = await start();
    await host.command("open");
    const two = {
      content: { w: 1200, h: 800 },
      panes: [
        { ...ONE_PANE.panes[0], w: 599, focused: false, composer: { x: 0, y: 724, w: 599, h: 46 } },
        {
          id: "p2",
          x: 601,
          y: 40,
          w: 599,
          h: 730,
          focused: true,
          composer: { x: 601, y: 724, w: 599, h: 46 },
        },
      ],
    };
    host.layout = two;
    await host.emit("overlay.layout", two);
    expect(host.page.dock).toEqual(placeFor(two, "bottom", { h: 260 }).card);
    await say(host, { type: "size", h: 330 });
    expect(host.page.dock.h).toBe(330);
    expect(host.page.dock.x).toBe(601 + 12);
  });
});

describe("checking a prompt", () => {
  it("asks Claude in the chosen language and shows the fixes as changes with reasons", async () => {
    const host = await start();
    await checked(host);
    expect(host.questions).toHaveLength(1);
    expect(host.questions[0].system).toMatch(/in Korean to an AI coding agent/);
    expect(host.questions[0].messages).toEqual([{ role: "user", content: PROMPT }]);
    expect(host.questions[0].model).toBe("fast");
    const v = lastView(host);
    expect(v.step).toBe("result");
    expect(v.summary).toBe("Changes: 2");
    expect(v.parts.filter((p) => p.id)).toEqual([
      { id: 1, del: " ", ins: "", off: false },
      { id: 2, del: "", ins: " ", off: false },
    ]);
    expect(v.notes.map((n) => n.kindLabel)).toEqual(["spacing", "spacing"]);
    expect(host.audits).toContainEqual({
      action: "checked",
      details: {
        language: "ko",
        mode: "fix",
        changes: 2,
        model: "claude-opus-5-5",
        outputTokens: 1,
      },
    });
  });

  it("shows the page that it is checking while Claude answers", async () => {
    let answer;
    const host = await start({ ai: () => new Promise((r) => (answer = r)) });
    await checked(host);
    expect(lastView(host)).toMatchObject({ step: "checking", text: "Checking your 한국어…" });
    answer(ANSWER);
    await host.emit("noop");
    expect(lastView(host).step).toBe("result");
  });

  it("undoes a change from the page, and sends the result to the ask card", async () => {
    const host = await start();
    await checked(host);
    await say(host, { type: "toggle", id: 2 });
    expect(lastView(host).undone).toBe("Kept yours: 1");
    await say(host, { type: "send" });
    expect(host.asks).toEqual([
      {
        question: "로그인하면 토큰이 갱신이 안돼요. `src/auth/session.ts` 를 고쳐 주세요.",
        about: "Prompt Polish: a prompt the user wrote in 한국어 and checked for mistakes",
      },
    ]);
    expect(lastView(host).step).toBe("sent");
    expect(host.audits).toContainEqual({
      action: "sent",
      details: { how: "corrected", kept: 1, undone: 1 },
    });
  });

  it("says when there is nothing to fix", async () => {
    const host = await start({ ai: () => JSON.stringify({ corrected: FIXED, notes: [] }) });
    await checked(host, FIXED);
    expect(lastView(host).nothing).toBe("Nothing to fix: your 한국어 reads well as it is.");
  });

  it('goes back to writing after "Don\'t send", with no message', async () => {
    const host = await start({
      ai: () => {
        throw Object.assign(new Error("declined"), { name: "AiDeclinedError" });
      },
    });
    await checked(host);
    expect(lastView(host)).toMatchObject({ step: "write", draft: PROMPT });
    expect(host.toasts).toEqual([]);
  });

  it("tells the user to add a key, or why an answer wasn't used", async () => {
    const noKey = await start({ ai: undefined });
    await checked(noKey);
    expect(lastView(noKey)).toMatchObject({
      step: "problem",
      text: "Add your Anthropic API key in Settings → AI to check prompts.",
    });
    const changed = await start({
      ai: () => JSON.stringify({ corrected: "로그인하면 `src/b.ts`", notes: [] }),
    });
    await checked(changed);
    expect(lastView(changed).text).toMatch(/^Claude changed code, a path or a link/);
    const words = await start({ ai: () => "I can't help with that." });
    await checked(words);
    expect(lastView(words).text).toBe("Claude's answer couldn't be read. Try again.");
  });

  it("doesn't check an empty prompt, and sends one as is when asked", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "check", text: "   " });
    expect(host.questions).toEqual([]);
    await say(host, { type: "as-is", text: PROMPT });
    expect(host.asks[0].question).toBe(PROMPT);
    expect(host.audits).toContainEqual({
      action: "sent",
      details: { how: "as-is", kept: 0, undone: 0 },
    });
  });

  it("keeps the prompt when the ask card is busy, and says so", async () => {
    const host = await start({ agentAsk: { shown: false, why: "busy" } });
    await checked(host);
    await say(host, { type: "send" });
    expect(host.toasts).toEqual([
      "Tilefold's ask card is already open. Send or drop it, then try again.",
    ]);
    expect(lastView(host).step).toBe("result");
  });
});

describe("the corner button", () => {
  it("shows a button in the pane's corner with the card above it, and remembers the choice", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "view", to: "corner" });
    const spots = placeFor(ONE_PANE, "corner", { h: 260, open: true });
    expect(host.item("polish-button")).toMatchObject({
      ...spots.button,
      hit: true,
      cursor: "pointer",
      label: "Prompt Polish",
    });
    expect(host.page.dock).toEqual(spots.card);
    expect(host.store.get("view")).toBe("corner");
    expect(host.audits).toContainEqual({ action: "view-changed", details: { to: "corner" } });
  });

  it("folds the card into the button, and a click on the button opens it again", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "fold" });
    expect(host.page.open).toBe(false);
    expect(host.item("polish-button")).toBeTruthy();
    await host.emit("overlay.pointer", { item: "polish-button", type: "click", x: 0, y: 0 });
    expect(host.page.open).toBe(true);
    await host.emit("overlay.pointer", { item: "polish-button", type: "click", x: 0, y: 0 });
    expect(host.page.open).toBe(false);
  });

  it("folds back into the button after sending, with the draft gone", async () => {
    const host = await start({ store: { view: "corner" } });
    await checked(host);
    await say(host, { type: "send" });
    expect(host.page.open).toBe(false);
    expect(host.item("polish-button")).toBeTruthy();
  });
});

describe("other places and Tilefolds", () => {
  it("docks beside the panes when chosen, and comes back over the pane on Undock", async () => {
    const host = await start({
      page: "side",
      theme: { mode: "dark", name: "Night", colors: { accent: "#8b6cff" } },
    });
    await host.command("open");
    await say(host, { type: "view", to: "side" });
    expect(host.page.side).toBe(true);
    await host.undock();
    expect(host.page.open).toBe(true);
    expect(host.page.dock).toEqual(placeFor(ONE_PANE, "bottom", { h: 260 }).card);
  });

  it("goes beside the panes when the pane is too small for the card", async () => {
    const tiny = {
      content: { w: 400, h: 200 },
      panes: [{ id: "p", x: 0, y: 0, w: 400, h: 140, focused: true, composer: null }],
    };
    const host = await start({
      page: "side",
      theme: { mode: "light", name: "Day", colors: {} },
      layout: tiny,
    });
    await host.command("open");
    expect(host.page.side).toBe(true);
    expect(host.toasts).toEqual([
      "The pane is too small for Prompt Polish, so it opened beside the panes.",
    ]);
  });

  it("opens in a window of its own where pages can't dock", async () => {
    const host = await start({ page: true });
    await host.command("open");
    expect(host.page.open).toBe(true);
    expect(host.page.dock).toBeNull();
  });

  it("says it needs a newer Tilefold without pages", async () => {
    const host = await start({ page: undefined });
    await host.command("open");
    expect(host.toasts).toEqual(["Prompt Polish needs a newer Tilefold to show its page."]);
  });

  it("a change of the view setting wins over the page's last choice", async () => {
    const host = await start({
      store: { view: "corner" },
      settings: { language: "ko", view: "side" },
    });
    await host.command("open");
    // The page's choice (the corner button) wins over the setting until it changes.
    expect(host.item("polish-button")).toBeTruthy();
    await host.setSetting("view", "bottom");
    expect(host.store.has("view")).toBe(false);
    expect(host.overlay).toBeNull();
    expect(host.page.dock).toEqual(placeFor(ONE_PANE, "bottom", { h: 260 }).card);
  });

  it("closes the page and the button, and records it", async () => {
    const host = await start({ store: { view: "corner" } });
    await host.command("open");
    await host.command("close");
    expect(host.page.open).toBe(false);
    expect(host.overlay).toBeNull();
    expect(host.audits.at(-1)).toEqual({ action: "closed", details: {} });
  });
});
