// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — picking what to fix on the card, and the user's own cases
 *
 * The card offers the two built-in modes and the cases from the setting.
 * Picking a case checks the prompt again with its instructions (for Claude
 * and for the polish agent) and is kept. Adding a case on the card saves
 * it to the setting through Tilefold and picks it; a case that can't be
 * saved keeps the form, saying why; removing one drops it and its pick. A
 * change of the mode setting wins over the card's pick. Where Tilefold has
 * list settings, the cases are a list saved one case at a time; on a
 * Tilefold that can't save settings, they are one text, from Settings
 * only. From the agent input box, with cases, what to fix is asked before
 * the check: the pick starts it, a saved case too, and closing the menu
 * leaves the prompt to check as set. Audits never carry a case's name or
 * words.
 *
 * Modified 2026-11-07 (pick before checking): the card is opened, then a
 *   pick made, before each check here; tests for the question asked first.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { startTile } from "../fake-host.mjs";
import { HAND_BACK } from "../../examples/prompt-polish/src/agentCheck.js";
import { PICK_KEY } from "../../examples/prompt-polish/src/modes.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "make a video of my cat";
const ANSWER = JSON.stringify({ corrected: "Make a video of my cat.", notes: [] });
const VIDEO = { name: "Video editing", rules: "Say the clip's length." };
/** As Tilefold 0.1.27 keeps it: a list, one case at a time. */
const CASES = [VIDEO];

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, {
    page: "dock",
    ai: () => ANSWER,
    input: { text: PROMPT, language: "en" },
    ...opts,
    settings: { language: "en", cases: CASES, ...opts.settings },
  });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) {
      expect(JSON.stringify(a.details ?? {})).not.toMatch(/Video|Email|clip|short|cat/i);
    }
  }
});

/** Plays a page message, then lets the background work it starts (a new check) finish. */
const say = async (host, message) => {
  await host.emit("page.message", { message });
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
};
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;
/** The system prompt of the last question to Claude. */
const lastSystem = (host) => host.questions.at(-1)?.system ?? "";

/**
 * Opens the card for the prompt, picks what to fix (asked first, as the
 * user has cases), and lets Claude check it.
 */
async function checked(opts, to = "fix") {
  const host = await start(opts);
  await host.clickAction("polish");
  await say(host, { type: "hello" });
  await say(host, { type: "mode", to });
  return host;
}

describe("picking what to fix", () => {
  it("offers the built-in modes and the user's cases", async () => {
    const host = await checked();
    expect(lastView(host)).toMatchObject({
      step: "result",
      modeId: "fix",
      canEditCases: true,
      modes: [
        { id: "fix", label: "Mistakes only" },
        { id: "natural", label: expect.any(String) },
        { id: "case:Video editing", label: "Video editing" },
      ],
    });
  });

  it("checks again with a case's instructions, and keeps the pick", async () => {
    const host = await checked();
    expect(lastSystem(host)).not.toContain("clip's length");
    await say(host, { type: "mode", to: "case:Video editing" });
    expect(host.questions).toHaveLength(2);
    expect(lastSystem(host)).toContain("-----\nSay the clip's length.\n-----");
    expect(lastView(host)).toMatchObject({ modeId: "case:Video editing", mode: "Video editing" });
    expect(host.store.get(PICK_KEY)).toBe("case:Video editing");
    expect(host.audits).toContainEqual({ action: "mode-picked", details: { mode: "case" } });
    // Anything not on the menu is ignored.
    await say(host, { type: "mode", to: "case:Nope" });
    expect(lastView(host).modeId).toBe("case:Video editing");
  });

  it("goes back to the setting when the mode setting changes", async () => {
    const host = await checked();
    await say(host, { type: "mode", to: "natural" });
    await host.setSetting("mode", "fix");
    expect(host.store.has(PICK_KEY)).toBe(false);
    expect(lastView(host).modeId).toBe("fix");
  });

  it("gives the polish agent the case's instructions too", async () => {
    const host = await start({ ai: undefined, agentAsk: true, helper: true });
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    await say(host, { type: "mode", to: "fix" });
    const request = host.helperAsks[0].question.match(/request ([a-z0-9]{10})/)[1];
    await host.command(HAND_BACK, { request, corrected: "Make a video of my cat.", notes: [] });
    await say(host, { type: "mode", to: "case:Video editing" });
    expect(host.helperAsks).toHaveLength(2);
    expect(host.helperAsks[1].question).toContain("follow my instructions");
    expect(host.helperAsks[1].question).toContain("Say the clip's length.");
  });
});

describe("the user's own cases on the card", () => {
  it("adds a case to the setting and picks it", async () => {
    const host = await checked();
    await say(host, { type: "case-edit", was: null });
    expect(lastView(host)).toMatchObject({ step: "case", was: null, name: "", rules: "" });
    await say(host, { type: "case-save", name: "Email:", rules: "Keep it short." });
    expect(host.settingSets.at(-1)).toEqual({
      key: "cases",
      value: [VIDEO, { name: "Email", rules: "Keep it short." }],
    });
    expect(lastView(host)).toMatchObject({ step: "result", modeId: "case:Email" });
    expect(lastSystem(host)).toContain("Keep it short.");
    expect(host.audits).toContainEqual({ action: "case-saved", details: { added: true } });
  });

  it("edits the case in use, keeping the form with the reason when it can't be saved", async () => {
    const host = await checked();
    await say(host, { type: "case-edit", was: "Video editing" });
    expect(lastView(host)).toMatchObject({
      step: "case",
      was: "Video editing",
      rules: "Say the clip's length.",
    });
    await say(host, { type: "case-save", name: "", rules: "Say it." });
    expect(lastView(host)).toMatchObject({
      step: "case",
      why: "Give the case a name.",
      rules: "Say it.",
    });
    expect(host.settingSets).toEqual([]);
    await say(host, { type: "case-save", name: "Video", rules: "Say it." });
    expect(host.settingSets.at(-1).value).toEqual([{ name: "Video", rules: "Say it." }]);
    await say(host, { type: "case-edit", was: null });
    await say(host, { type: "case-cancel" });
    expect(lastView(host).step).toBe("result");
  });

  it("removes a case, and its pick with it", async () => {
    const host = await checked();
    await say(host, { type: "mode", to: "case:Video editing" });
    await say(host, { type: "case-remove", name: "Video editing" });
    expect(host.settingSets.at(-1)).toEqual({ key: "cases", value: [] });
    expect(lastView(host)).toMatchObject({ modeId: "fix" });
    expect(lastView(host).modes).toHaveLength(2);
    expect(host.audits).toContainEqual({ action: "case-removed" });
  });

  it("is a list of cases where Tilefold has them, else one text", async () => {
    const host = await start();
    const reg = host.regs.find((r) => r.kind === "setting" && r.key === "cases");
    expect(reg).toMatchObject({
      default: [],
      list: {
        max: 20,
        title: "name",
        fields: [
          { key: "name", label: "Name", max: 60 },
          { key: "rules", label: "What to do for this kind of prompt", multiline: true, max: 2000 },
        ],
      },
    });
    const old = await start({ settingsSet: false, settings: { cases: "Video editing\nSay it." } });
    const text = old.regs.find((r) => r.kind === "setting" && r.key === "cases");
    expect(text).toMatchObject({ default: "", multiline: true });
    expect(text.list).toBeUndefined();
  });

  it("comes only from Settings on a Tilefold that can't save settings", async () => {
    const host = await checked({
      settingsSet: false,
      settings: { cases: "Video editing\nSay it." },
    });
    expect(lastView(host).canEditCases).toBe(false);
    await say(host, { type: "case-edit", was: null });
    expect(lastView(host).step).toBe("result");
  });
});

describe("what to fix, asked before checking a prompt from the agent input box", () => {
  /** Opens the card from ✦ Polish, without picking yet. */
  async function asked(opts) {
    const host = await start(opts);
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    return host;
  }

  it("opens on the menu with the prompt kept, and checks nothing yet", async () => {
    const host = await asked();
    expect(host.questions).toHaveLength(0);
    expect(lastView(host)).toMatchObject({ step: "write", draft: PROMPT, choose: true });
  });

  it("starts the check with the case picked, and asks no more", async () => {
    const host = await asked();
    await say(host, { type: "mode", to: "case:Video editing" });
    expect(host.questions).toHaveLength(1);
    expect(lastSystem(host)).toContain("Say the clip's length.");
    expect(lastView(host)).toMatchObject({ step: "result", mode: "Video editing" });
    // Back to the prompt: the menu isn't asked again.
    await say(host, { type: "back" });
    expect(lastView(host)).toMatchObject({ step: "write", choose: false });
  });

  it("starts the check for the polish agent too, with the case's instructions", async () => {
    const host = await asked({ ai: undefined, agentAsk: true, helper: true });
    expect(host.helperAsks).toHaveLength(0);
    await say(host, { type: "mode", to: "case:Video editing" });
    expect(host.helperAsks).toHaveLength(1);
    expect(host.helperAsks[0].question).toContain("Say the clip's length.");
  });

  it("closed without a pick, shows the prompt to check as it is set", async () => {
    const host = await asked();
    await say(host, { type: "choose-skip" });
    expect(host.questions).toHaveLength(0);
    expect(lastView(host)).toMatchObject({ step: "write", draft: PROMPT, choose: false });
    await say(host, { type: "check", text: PROMPT });
    expect(host.questions).toHaveLength(1);
  });

  it("starts the check with a case added from the menu", async () => {
    const host = await asked();
    await say(host, { type: "case-edit", was: null });
    expect(lastView(host).step).toBe("case");
    await say(host, { type: "case-cancel" });
    // Cancelling the form goes back to the question.
    expect(lastView(host)).toMatchObject({ step: "write", choose: true });
    await say(host, { type: "case-edit", was: null });
    await say(host, { type: "case-save", name: "Short", rules: "Keep it short." });
    expect(host.questions).toHaveLength(1);
    expect(lastSystem(host)).toContain("Keep it short.");
  });

  it("isn't asked without own cases: the check starts at once", async () => {
    const host = await asked({ settings: { cases: [] } });
    expect(host.questions).toHaveLength(1);
    expect(lastView(host).choose).toBeUndefined();
  });
});
