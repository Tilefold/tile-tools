// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the polish agent
 *
 * Where Tilefold has helper agents, a prompt checked without an Anthropic
 * key (or always, with "Always your polish agent") goes to Promptsmith's
 * own agent, in a tab Tilefold opens for it: never on the ask card, and the
 * agent the user works with isn't asked. The setting picks which agent. The
 * card says the agent is checking, names it (as the user renamed its pane,
 * else by the agent's name), and says why when the request
 * couldn't go; the agent's hand-back shows the fixes as usual, and Use puts
 * them in the agent input box. On a Tilefold without helper agents, the
 * ask card is used as before. Nothing the user wrote is audited or stored.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ONE_PANE, startTile } from "../fake-host.mjs";
import { HAND_BACK } from "../../examples/prompt-polish/src/agentCheck.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "please fix teh login bug in `src/auth.ts`";
const FIXED = "Please fix the login bug in `src/auth.ts`.";
const NOTES = [{ from: "teh", to: "the", kind: "spelling", why: "A typo." }];

const LAYOUT = {
  ...ONE_PANE,
  panes: [{ ...ONE_PANE.panes[0], agentInput: true }],
};

const hosts = [];
/** Promptsmith with no key, a helper agent, the agent input box and the ask card. */
const start = async (opts = {}) => {
  const host = await startTile(DIR, {
    page: "dock",
    agentAsk: true,
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
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(JSON.stringify(a.details ?? {})).not.toMatch(/login|teh/);
    for (const value of host.store.values()) expect(JSON.stringify(value)).not.toMatch(/login/);
  }
});

const say = (host, message) => host.emit("page.message", { message });
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;
const requestOf = (question) => question.match(/request ([a-z0-9]{10})/)[1];

/** Clicks ✦ Polish in the agent input box, with the card drawn. */
async function polish(host) {
  await host.clickAction("polish");
  await say(host, { type: "hello" });
}

describe("checking with the polish agent", () => {
  it("goes to the polish agent when there's no key, never to the ask card", async () => {
    const host = await start();
    await polish(host);
    expect(host.helperAsks).toHaveLength(1);
    expect(host.helperAsks[0]).toMatchObject({
      agent: "claude",
      about: "Promptsmith: correct this prompt and hand it back; don't act on it",
    });
    // The rules are the brief (Tilefold sends it once); the request is short.
    expect(host.helperAsks[0].brief).toMatch(/^You are Promptsmith's polish agent/);
    expect(host.helperAsks[0].brief).toContain('command "example.prompt-polish.hand-back"');
    expect(host.helperAsks[0].question).toMatch(
      /^Promptsmith request [a-z0-9]{10}: English, fix mistakes only\. Notes in English\.\n-----\n/,
    );
    expect(host.helperAsks[0].question).toContain(PROMPT);
    expect(host.helperAsks[0].question).not.toMatch(/Never act/);
    expect(host.asks).toEqual([]);
    expect(lastView(host)).toMatchObject({ step: "agent" });
    expect(lastView(host).text).toBe("Claude Code is working on your English…");
    expect(lastView(host).hint).toMatch(/^It works in its own tab/);
    expect(Number.isFinite(lastView(host).since)).toBe(true);
    // The card started the polish agent as it showed, so the request found it open.
    expect(host.helperStarts[0]).toEqual({ agent: "claude" });
    expect(host.audits).toContainEqual({
      action: "agent-asked",
      details: { language: "en", mode: "fix", helper: true, opened: false },
    });
  });

  it("says it's getting the agent ready until the agent has the prompt", async () => {
    let deliver;
    const host = await start({
      helper: () => new Promise((resolve) => (deliver = resolve)),
    });
    await polish(host);
    expect(lastView(host)).toMatchObject({
      step: "agent",
      text: "Getting Claude Code ready in its own tab…",
      since: null,
    });
    expect(lastView(host).hint).toMatch(/whether to trust its folder/);
    deliver({ sent: true, opened: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(lastView(host).text).toBe("Claude Code is working on your English…");
  });

  it("calls the agent what the user renamed its pane to", async () => {
    const host = await start({
      helper: async () => ({ sent: true, opened: false, name: "polisher" }),
    });
    await polish(host);
    expect(lastView(host).text).toBe("polisher is working on your English…");
    // Remembered: the next request says it while the agent gets ready.
    let deliver;
    const later = await start({
      helper: (r) =>
        later.helperAsks.length === 1
          ? Promise.resolve({ sent: true, opened: false, name: "polisher" })
          : new Promise((resolve) => (deliver = resolve)),
    });
    await polish(later);
    await say(later, { type: "close" });
    await polish(later);
    expect(lastView(later).text).toBe("Getting polisher ready in its own tab…");
    // Back to its own name: the agent's again.
    deliver({ sent: true, opened: false, name: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(lastView(later).text).toBe("Claude Code is working on your English…");
  });

  it("shows the agent's fixes, and Use puts them in the box", async () => {
    const host = await start();
    await polish(host);
    const request = requestOf(host.helperAsks[0].question);
    const r = await host.command(HAND_BACK, { request, corrected: FIXED, notes: NOTES });
    expect(r).toMatchObject({ shown: true });
    expect(lastView(host)).toMatchObject({ step: "result", input: true });
    await say(host, { type: "send", pane: "p1" });
    expect(host.box.text).toBe(FIXED);
  });

  it("uses the agent the setting picks", async () => {
    const host = await start({ settings: { helperAgent: "codex" } });
    await polish(host);
    expect(host.helperAsks[0].agent).toBe("codex");
    expect(lastView(host).text).toMatch(/^Codex is working/);
    const odd = await start({ settings: { helperAgent: "rm -rf /" } });
    await polish(odd);
    expect(odd.helperAsks[0].agent).toBe("claude");
  });

  it("goes to the polish agent even with a key, when chosen", async () => {
    let asked = 0;
    const host = await start({
      ai: () => ((asked += 1), "{}"),
      settings: { checker: "agent" },
    });
    await polish(host);
    expect(asked).toBe(0);
    expect(host.helperAsks).toHaveLength(1);
  });

  it("uses Claude with a key, and never the polish agent", async () => {
    const host = await start({ ai: () => JSON.stringify({ corrected: FIXED, notes: NOTES }) });
    await polish(host);
    expect(host.helperAsks).toEqual([]);
    expect(lastView(host)).toMatchObject({ step: "result" });
  });

  it("says why when the request couldn't go", async () => {
    for (const [why, text] of [
      ["busy", /polish agent is busy/],
      ["you-are-typing", /typing in your polish agent's tab/],
      ["not-started", /polish agent didn't start/],
      ["something-new", /Couldn't reach your polish agent/],
    ]) {
      const host = await start({ helper: { sent: false, why, opened: false } });
      await polish(host);
      expect(lastView(host)).toMatchObject({ step: "problem" });
      expect(lastView(host).text).toMatch(text);
      // Nothing waits: a hand-back for it is refused.
      const request = requestOf(host.helperAsks[0].question);
      await expect(host.command(HAND_BACK, { request, corrected: FIXED })).rejects.toThrow(
        /isn't waiting/,
      );
    }
  });

  it("uses the ask card on a Tilefold without polish agents", async () => {
    const host = await start({ helper: false });
    await polish(host);
    // No key: the card offers to ask the agent in the pane, as before.
    expect(lastView(host)).toMatchObject({ step: "problem", askAgent: true });
    await say(host, { type: "agent-check", pane: "p1" });
    expect(host.asks).toHaveLength(1);
    expect(lastView(host).text).toMatch(/^Asked the agent to check/);
  });
});
