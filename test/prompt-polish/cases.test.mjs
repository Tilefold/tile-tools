// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the user's own cases
 *
 * The cases setting is read as blocks (a name, then its instructions, a
 * blank line between): names are cleaned to one line without a trailing
 * colon, blocks without instructions and repeated names are left out, and
 * no more than 20 are kept; the text written back reads the same. Saving
 * adds or renames a case and refuses a missing name or instructions, a name
 * taken, a 21st case or too long a list; removing drops one. Control and
 * direction-changing characters never reach a name or instructions. A
 * case's instructions go to Claude and to the polish agent fenced off as
 * rules, with the "never add to it" rule relaxed only for a case, whose
 * answer may also be longer.
 *
 * Modified 2026-11-07 (case rework): a picked case means the prompt is that
 *   kind, reworked in full however short; waiting names the case.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MAX_CASES,
  MAX_TEXT,
  formatCases,
  nameOf,
  parseCases,
  removeCase,
  rulesOf,
  saveCase,
} from "../../examples/prompt-polish/src/cases.js";
import {
  buildAsk,
  casePicked,
  longestFor,
  readAnswer,
  systemPrompt,
} from "../../examples/prompt-polish/src/answer.js";
import {
  agentBrief,
  agentQuestion,
  agentRequest,
} from "../../examples/prompt-polish/src/agentCheck.js";
import { languageOf } from "../../examples/prompt-polish/src/languages.js";
import { viewOf } from "../../examples/prompt-polish/src/view.js";

const RLO = String.fromCharCode(0x202e);
const BEL = String.fromCharCode(7);
const VIDEO = { name: "Video editing", rules: "Say the clip's length.\nSay its style." };

describe("reading the cases setting", () => {
  it("reads blocks of a name and its instructions", () => {
    const text =
      "Video editing:\nSay the clip's length.\nSay its style.\n\n  \nEmail\nKeep it short.";
    expect(parseCases(text)).toEqual([VIDEO, { name: "Email", rules: "Keep it short." }]);
    expect(parseCases(formatCases(parseCases(text)))).toEqual(parseCases(text));
  });

  it("leaves out blocks without instructions, repeated names, and anything past 20", () => {
    expect(parseCases("Only a name\n\nEmail\nShort.\n\nEmail\nAgain.")).toEqual([
      { name: "Email", rules: "Short." },
    ]);
    const many = Array.from({ length: 30 }, (_, i) => `Case ${i}\nDo ${i}.`).join("\n\n");
    expect(parseCases(many)).toHaveLength(MAX_CASES);
    for (const odd of [null, 42, {}, ""]) expect(parseCases(odd)).toEqual([]);
  });

  it("keeps control and direction-changing characters out", () => {
    expect(nameOf(`Vi${RLO}deo${BEL}  editing:`)).toBe("Video editing");
    expect(rulesOf(`Say${RLO} it.\r\n\r\nShort.`)).toBe("Say it.\nShort.");
  });
});

describe("saving and removing a case", () => {
  it("adds a case, and renames one in place", () => {
    const added = saveCase([], null, VIDEO);
    expect(added).toEqual({ cases: [VIDEO], name: "Video editing" });
    const renamed = saveCase([VIDEO, { name: "Email", rules: "Short." }], "Video editing", {
      name: "Video",
      rules: "Say the length.\n\nSay the style.",
    });
    expect(renamed.cases[0]).toEqual({ name: "Video", rules: "Say the length.\nSay the style." });
    expect(renamed.cases[1].name).toBe("Email");
  });

  it("says why a case can't be saved", () => {
    expect(saveCase([], null, { name: " ", rules: "x" })).toEqual({ why: "case-needs-name" });
    expect(saveCase([], null, { name: "A", rules: "\n" })).toEqual({ why: "case-needs-rules" });
    expect(saveCase([VIDEO], null, { name: "Video editing", rules: "x" })).toEqual({
      why: "case-name-taken",
    });
    const full = Array.from({ length: MAX_CASES }, (_, i) => ({ name: `C${i}`, rules: "x" }));
    expect(saveCase(full, null, { name: "One more", rules: "x" })).toEqual({
      why: "case-too-many",
    });
    const big = Array.from({ length: 3 }, (_, i) => ({ name: `C${i}`, rules: "x".repeat(1999) }));
    expect(formatCases(big).length).toBeLessThan(MAX_TEXT);
    expect(saveCase(big, null, { name: "Four", rules: "y".repeat(1999) })).toEqual({
      why: "case-too-long",
    });
  });

  it("removes a case by name", () => {
    expect(removeCase([VIDEO, { name: "Email", rules: "x" }], "Video editing")).toEqual([
      { name: "Email", rules: "x" },
    ]);
  });
});

describe("a case's instructions in the request", () => {
  it("go to Claude fenced off as rules, and only a case may add to the prompt", () => {
    const own = systemPrompt("English", "case", "English", VIDEO.rules);
    expect(own).toContain(`-----\n${VIDEO.rules}\n-----`);
    expect(own).toContain("rework the prompt as the user's own instructions");
    expect(own).not.toContain("never add to it");
    const fix = systemPrompt("English", "fix", "English", VIDEO.rules);
    expect(fix).toContain("never add to it");
    expect(fix).not.toContain(VIDEO.rules);
  });

  it("may make the prompt longer, and Claude gets room to write it", () => {
    const short = "make a logo reveal";
    const reworked = JSON.stringify({ corrected: `${short}: ${"x".repeat(400)}`, notes: [] });
    expect(readAnswer(reworked, short).ok).toBe(false);
    expect(readAnswer(reworked, short, "case").ok).toBe(true);
    expect(longestFor(short, "case")).toBeGreaterThan(longestFor(short, "fix"));
    expect(longestFor("x".repeat(5000), "case")).toBe(8000);
    const ask = (mode) =>
      buildAsk({ text: short, language: "English", mode, uiLanguage: "English" });
    expect(ask("case").maxTokens).toBeGreaterThan(ask("fix").maxTokens);
  });

  it("go to the polish agent and the ask card before the prompt", () => {
    const base = { text: "make a video", language: "English", uiLanguage: "English" };
    const r = agentRequest({ ...base, mode: "case", rules: VIDEO.rules, request: "abcdefghij" });
    expect(r).toMatch(/fix mistakes and follow my instructions\./);
    // It says plainly that a case may add to the prompt.
    expect(r).toContain("add every point the instructions ask for that it is missing");
    expect(r.indexOf(VIDEO.rules)).toBeLessThan(r.indexOf("make a video"));
    const q = agentQuestion({
      ...base,
      mode: "case",
      rules: VIDEO.rules,
      request: "abcdefghij",
      command: "example.prompt-polish.hand-back",
    });
    expect(q).toContain(VIDEO.rules);
    expect(q).not.toContain("never add to it");
    // A case without instructions is checked as mistakes only.
    expect(agentRequest({ ...base, mode: "case", rules: "", request: "abcdefghij" })).toMatch(
      /fix mistakes only/,
    );
  });
});

describe("a picked case means the prompt is that kind", () => {
  it("is said to Claude and to the polish agent, never for the built-in modes", () => {
    const own = systemPrompt("English", "case", "English", VIDEO.rules);
    expect(own).toContain(casePicked());
    expect(own).toContain("however short it is");
    expect(own).toContain("Never hand back only the fixes.");
    expect(systemPrompt("English", "fix", "English")).not.toContain("however short");
    const base = { text: "for Tilefold?", language: "English", uiLanguage: "English" };
    const r = agentRequest({ ...base, mode: "case", rules: VIDEO.rules, request: "abcdefghij" });
    expect(r).toContain(casePicked("I"));
    expect(r).toContain("never decide my instructions don't fit it");
    expect(agentRequest({ ...base, mode: "fix", request: "abcdefghij" })).not.toContain(
      "however short",
    );
    expect(agentBrief("example.prompt-polish.hand-back")).toContain(
      "never hand back only the fixes",
    );
  });

  it("gives a short prompt room for a full rework", () => {
    const reworked = JSON.stringify({ corrected: "x".repeat(2500), notes: [] });
    expect(readAnswer(reworked, "for Tilefold?", "case").ok).toBe(true);
  });
});

describe("waiting on a case", () => {
  const ftl = readFileSync(
    fileURLToPath(new URL("../../examples/prompt-polish/locales/en/tile.ftl", import.meta.url)),
    "utf8",
  );
  const english = new Map([...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [m[1], m[2]]));
  const t = (key, args = {}) =>
    english.get(key).replace(/\{ \$(\w+) \}/g, (_, n) => String(args[n] ?? ""));
  const at = (s) =>
    viewOf(
      {
        pane: "p1",
        draft: "for Tilefold?",
        parts: [],
        notes: [],
        rejected: new Set(),
        view: "bottom",
        mode: "fix",
        language: languageOf("en", "en"),
        ...s,
      },
      t,
    ).text;
  const CASE = { modeId: "case:Motion", caseName: "Motion" };

  it("names the case, not the language, while it checks or waits", () => {
    expect(at({ step: "checking", ...CASE })).toBe("Reworking your prompt as “Motion”…");
    expect(at({ step: "agent", ...CASE })).toBe(
      "Asked the agent to rework your prompt as “Motion”…",
    );
    expect(
      at({ step: "agent", helper: true, helperStage: "working", helperName: "Polish", ...CASE }),
    ).toBe("Polish is reworking your prompt as “Motion”…");
  });

  it("names the language for the built-in modes", () => {
    expect(at({ step: "checking" })).toBe("Checking your English…");
  });
});
