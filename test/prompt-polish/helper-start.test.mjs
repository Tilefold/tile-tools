// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — keeping the polish agent running (tests)
 *
 * When the card shows and the polish agent will check (the checker set to
 * the agent, no Claude at all, or the agent used before), Promptsmith asks
 * whether it runs and starts it in the background if not (a tab with no
 * agent in it counts as not running), at most once
 * every thirty seconds; with Claude to ask it never does. Show and Restart
 * the polish agent, from the palette or the card, start it with its tab
 * in front (Restart afresh) and say how it went; the card offers them
 * while the agent starts or works and when it didn't start, and from a
 * problem goes back to the prompt. An older Tilefold is told it needs a
 * newer one; failures are told, never thrown. Audits carry no prompt.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ONE_PANE, startTile } from "../fake-host.mjs";
import { START_GAP_MS, USED_KEY } from "../../examples/prompt-polish/src/helperTab.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "please fix teh login bug";
const ANSWER = JSON.stringify({ corrected: "Please fix the login bug.", notes: [] });
const LAYOUT = { ...ONE_PANE, panes: [{ ...ONE_PANE.panes[0], agentInput: true }] };

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, {
    page: "dock",
    helper: true,
    layout: LAYOUT,
    input: { text: PROMPT, language: "en" },
    ...opts,
    settings: { language: "en", ...opts.settings },
  });
  hosts.push(host);
  return host;
};

afterEach(() => {
  vi.useRealTimers();
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(JSON.stringify(a.details ?? {})).not.toMatch(/login|teh/);
  }
});

const say = async (host, message) => {
  await host.emit("page.message", { message });
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
};
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;
/** Opens the card from the palette and lets its first drawing happen. */
const openCard = async (host) => {
  await host.command("open");
  await say(host, { type: "hello" });
};

describe("starting the polish agent ahead of time", () => {
  it("starts it when the card shows, once the agent has checked a prompt before", async () => {
    const host = await start({ store: { [USED_KEY]: true } });
    await openCard(host);
    expect(host.helperStarts).toEqual([{ agent: "claude" }]);
    expect(host.audits).toContainEqual({
      action: "helper-started",
      details: { how: "auto", state: "ready" },
    });
  });

  it("starts the agent the settings name, and not again within thirty seconds", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const host = await start({ settings: { helperAgent: "codex", checker: "agent" } });
    host.helperState = "none";
    await openCard(host);
    await say(host, { type: "hello" });
    expect(host.helperStarts).toEqual([{ agent: "codex" }]);
    now += START_GAP_MS + 1;
    await say(host, { type: "hello" });
    expect(host.helperStarts).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("starts it afresh when its tab is there with no agent in it", async () => {
    const host = await start({ settings: { checker: "agent" } });
    host.helperState = "stopped";
    await openCard(host);
    expect(host.helperStarts).toEqual([{ agent: "claude" }]);
  });

  it("leaves a running agent alone", async () => {
    const host = await start({ settings: { checker: "agent" } });
    host.helperState = "starting";
    await openCard(host);
    expect(host.helperStarts).toEqual([]);
  });

  it("never starts it while Claude checks, until the agent has checked once", async () => {
    const host = await start({ ai: () => ANSWER });
    // Not on a first run without a key either: the first check starts it.
    const fresh = await start();
    await openCard(fresh);
    expect(fresh.helperStarts).toEqual([]);
    await openCard(host);
    expect(host.helperStarts).toEqual([]);
    // Set to check with the agent: it starts.
    const agent = await start({ ai: () => ANSWER, settings: { checker: "agent" } });
    await openCard(agent);
    expect(agent.helperStarts).toEqual([{ agent: "claude" }]);
  });

  it("remembers that the polish agent checked a prompt", async () => {
    const host = await start();
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    expect(host.helperAsks).toHaveLength(1);
    expect(host.store.get(USED_KEY)).toBe(true);
  });

  it("says nothing when an automatic start fails", async () => {
    const host = await start({ settings: { checker: "agent" } });
    host.helperStartAnswer = () => {
      throw Object.assign(new Error("x"), { name: "RateLimitError" });
    };
    await openCard(host);
    expect(host.toasts).toEqual([]);
    expect(host.helperStarts).toHaveLength(1);
  });
});

describe("showing and restarting the polish agent", () => {
  it("shows its tab from the palette and says it's ready", async () => {
    const host = await start();
    await host.command("helper-show");
    expect(host.helperStarts.at(-1)).toEqual({ agent: "claude", show: true });
    expect(host.toasts.at(-1)).toBe("Your polish agent is ready.");
    expect(host.audits).toContainEqual({
      action: "helper-started",
      details: { how: "show", state: "ready" },
    });
  });

  it("restarts it from the palette", async () => {
    const host = await start();
    await host.command("helper-restart");
    expect(host.helperStarts.at(-1)).toEqual({ agent: "claude", show: true, restart: true });
    expect(host.audits).toContainEqual({
      action: "helper-started",
      details: { how: "restart", state: "ready" },
    });
  });

  it("says when it is busy, didn't start, or couldn't be started", async () => {
    const host = await start();
    host.helperStartAnswer = { state: "busy", opened: false, name: null };
    await host.command("helper-show");
    expect(host.toasts.at(-1)).toBe("Your polish agent is running and busy right now.");
    host.helperStartAnswer = { state: "not-started", opened: true, name: null };
    await host.command("helper-show");
    expect(host.toasts.at(-1)).toMatch(/^Your polish agent didn't start/);
    host.helperStartAnswer = () => {
      throw Object.assign(new Error("x"), { name: "Rate‮LimitError".repeat(20) });
    };
    await host.command("helper-restart");
    const last = host.toasts.at(-1);
    expect(last).toMatch(/^Couldn't start the polish agent/);
    // The reason is cut short.
    expect(last.length).toBeLessThan(140);
  });

  it("tells an older Tilefold it needs a newer one, and still checks prompts", async () => {
    const host = await start({ helperControl: false });
    await host.command("helper-show");
    expect(host.toasts.at(-1)).toBe("Starting the polish agent needs a newer Tilefold.");
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    expect(host.helperAsks).toHaveLength(1);
    expect(lastView(host).showHelper).toBe(false);
  });

  it("offers its tab on the card while it starts or works", async () => {
    const host = await start({ helper: () => new Promise(() => {}) });
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    expect(lastView(host)).toMatchObject({ step: "agent", showHelper: true });
    await say(host, { type: "helper-show", pane: lastView(host).pane });
    expect(host.helperStarts.at(-1)).toEqual({ agent: "claude", show: true });
  });

  it("offers Show and Restart when it didn't start, and goes back to the prompt", async () => {
    const host = await start({
      helper: { sent: false, why: "not-started", opened: true, name: null },
    });
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    expect(lastView(host)).toMatchObject({ step: "problem", helperFix: true });
    await say(host, { type: "helper-restart", pane: lastView(host).pane });
    expect(host.helperStarts.at(-1)).toEqual({ agent: "claude", show: true, restart: true });
    expect(lastView(host)).toMatchObject({ step: "write" });
  });

  it("ignores malformed messages", async () => {
    const host = await start();
    for (const m of [
      { type: "helper-show", pane: 5 },
      { type: "helper-show", pane: "nope" },
      { type: "helper-restart", pane: { toString: () => "p1" } },
    ]) {
      await say(host, m);
    }
    expect(host.helperStarts.every((r) => r.agent === "claude")).toBe(true);
  });
});
