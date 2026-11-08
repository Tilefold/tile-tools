// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — a case's translations
 *
 * A case may name languages to translate the corrected prompt into, as
 * codes or names (only Promptsmith's languages, each once, at most eight),
 * in the list's own field or on a "Translate:" line of the text. Claude and
 * the polish agent are asked for them, the corrected prompt staying in its
 * own language; what comes back is read like the corrected prompt (only
 * the languages asked for, cleaned, bounded, keeping the prompt's code).
 * The card shows them under the fixes; Use this puts one in the agent
 * input box and Send this puts one on the ask card, taken from the result,
 * never from the page. The built-in modes never ask for translations.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { startTile } from "../fake-host.mjs";
import {
  agentQuestion,
  agentRequest,
  readHandBack,
} from "../../examples/prompt-polish/src/agentCheck.js";
import {
  buildAsk,
  readTranslations,
  translateAsk,
} from "../../examples/prompt-polish/src/answer.js";
import {
  MAX_TRANSLATE,
  casesOf,
  formatCases,
  parseCases,
  saveCase,
  translateOf,
} from "../../examples/prompt-polish/src/cases.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "fix the login in `src/auth.ts`";
const FIXED = "Fix the login in `src/auth.ts`.";
const JA = "`src/auth.ts` のログインを直してください。";
const KO = "`src/auth.ts` 의 로그인을 고쳐 주세요.";

describe("a case's languages", () => {
  it("are codes or names, known ones only, each once", () => {
    expect(translateOf("ja, Korean, 简体中文; FR, klingon, ja")).toEqual([
      "ja",
      "ko",
      "zh-CN",
      "fr",
    ]);
    expect(translateOf(["es", "pt-BR", 3])).toEqual(["es", "pt-BR"]);
    expect(translateOf("")).toEqual([]);
    expect(translateOf(null)).toEqual([]);
    expect(translateOf("ar de en es fr hi it ja ko ru".split(" "))).toHaveLength(MAX_TRANSLATE);
  });

  it("are read from a Translate line of the text, and written back the same", () => {
    const text = "Video\nSay the length.\nTranslate: ja, ko\n\nEmail\nShort.";
    const cases = parseCases(text);
    expect(cases).toEqual([
      { name: "Video", rules: "Say the length.", translate: ["ja", "ko"] },
      { name: "Email", rules: "Short.", translate: [] },
    ]);
    expect(parseCases(formatCases(cases))).toEqual(cases);
  });

  it("are read from the list's field and kept when saved", () => {
    const [c] = casesOf([{ name: "Video", rules: "Say it.", translate: "ja, es" }]);
    expect(c.translate).toEqual(["ja", "es"]);
    const saved = saveCase([], null, { name: "Mail", rules: "Short.", translate: "French" });
    expect(saved.cases[0].translate).toEqual(["fr"]);
  });
});

describe("asking for translations", () => {
  it("names each language and keeps the corrected prompt in its own", () => {
    const ask = translateAsk(["ja", "ko"]);
    expect(ask).toContain("Japanese (ja), Korean (ko)");
    expect(ask).toContain("stays in its own language");
    expect(translateAsk([])).toBe("");
    expect(translateAsk(["xx"])).toBe("");
  });

  it("goes to Claude with room for each, only for a case", () => {
    const base = { text: PROMPT, language: "English", uiLanguage: "English", fast: true };
    const plain = buildAsk({ ...base, mode: "case", rules: "Say it." });
    const both = buildAsk({ ...base, mode: "case", rules: "Say it.", translate: ["ja", "ko"] });
    expect(both.system).toContain('"translations"');
    expect(both.system).toContain("Japanese (ja)");
    expect(plain.system).not.toContain('"translations"');
    expect(both.maxTokens).toBeGreaterThan(plain.maxTokens);
  });

  it("goes to the agent in the pane and to the polish agent", () => {
    const r = { text: PROMPT, language: "English", uiLanguage: "English", request: "abcde12345" };
    const q = agentQuestion({
      ...r,
      mode: "case",
      rules: "Say it.",
      command: "x.y",
      translate: ["ja"],
    });
    expect(q).toContain("Japanese (ja)");
    expect(q).toContain('"translations"');
    const one = agentRequest({ ...r, mode: "case", rules: "Say it.", translate: ["ko"] });
    expect(one).toContain("Korean (ko)");
    // A built-in case translates too when its setting names languages, and only then.
    const fix = agentQuestion({ ...r, mode: "fix", command: "x.y", translate: ["ja"] });
    expect(fix).toContain("Japanese (ja)");
    expect(fix).toContain("Never translate it (the corrected prompt itself)");
    expect(agentQuestion({ ...r, mode: "fix", command: "x.y", translate: [] })).not.toContain(
      "translations",
    );
    const natural = agentRequest({ ...r, mode: "natural", translate: ["fr"] });
    expect(natural).toContain("French (fr)");
    // The translation ask comes before the prompt.
    expect(natural.indexOf("French (fr)")).toBeLessThan(natural.indexOf("-----"));
  });
});

describe("reading translations", () => {
  it("keeps only those asked for, in that order, cleaned", () => {
    const raw = { ko: KO, ja: `${JA}‮`, fr: "Corrige", es: 42 };
    expect(readTranslations(raw, PROMPT, "case", ["ja", "ko", "es"])).toEqual([
      { code: "ja", text: JA },
      { code: "ko", text: KO },
    ]);
  });

  it("drops one that changed code, is far too long, or isn't text", () => {
    const raw = { ja: "ログインを直して", ko: "x".repeat(9000) };
    expect(readTranslations(raw, PROMPT, "case", ["ja", "ko"])).toEqual([]);
    for (const odd of [null, [], "ja", 3])
      expect(readTranslations(odd, PROMPT, "case", ["ja"])).toEqual([]);
  });

  it("from the agent: only Promptsmith's languages, as text", () => {
    const h = readHandBack({
      request: "abcde12345",
      corrected: FIXED,
      translations: { ja: JA, xx: "no", ko: 5, __proto__: { fr: "inherited" } },
    });
    expect(JSON.parse(h.answer).translations).toEqual({ ja: JA });
  });
});

describe("translations on the card", () => {
  const hosts = [];
  afterEach(() => {
    for (const host of hosts.splice(0)) {
      // Never the prompt, a translation or a case's words in an audit.
      for (const a of host.audits)
        expect(JSON.stringify(a.details ?? {})).not.toMatch(/login|ログ|로그/);
    }
  });
  const ANSWER = JSON.stringify({ corrected: FIXED, notes: [], translations: { ja: JA, ko: KO } });
  const start = async (opts = {}) => {
    const host = await startTile(DIR, {
      page: "dock",
      ai: () => ANSWER,
      input: { text: PROMPT, language: "en" },
      ...opts,
      settings: {
        language: "en",
        cases: [{ name: "Code", rules: "Name the file.", translate: "ja, ko" }],
        ...opts.settings,
      },
    });
    hosts.push(host);
    return host;
  };
  const say = async (host, message) => {
    await host.emit("page.message", { message });
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  };
  const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;
  /** The card from ✦ Polish, the case picked and applied. */
  const applied = async (opts) => {
    const host = await start(opts);
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    await say(host, { type: "mode", to: "case:Code" });
    await say(host, { type: "check", text: PROMPT });
    return host;
  };

  it("are asked for with the case, and shown under the fixes", async () => {
    const host = await applied();
    expect(host.questions.at(-1).system).toContain("Japanese (ja), Korean (ko)");
    expect(lastView(host)).toMatchObject({
      step: "result",
      translations: [
        { code: "ja", native: "日本語 · ja", text: JA },
        { code: "ko", native: "한국어 · ko", text: KO },
      ],
    });
  });

  it("Use this puts that translation in the box", async () => {
    const host = await applied();
    await say(host, { type: "send", translation: "ko" });
    expect(host.box.text).toBe(KO);
    expect(host.audits).toContainEqual(
      expect.objectContaining({
        action: "used",
        details: expect.objectContaining({ translation: true }),
      }),
    );
  });

  it("ignores a language the result doesn't hold", async () => {
    const host = await applied();
    await say(host, { type: "send", translation: "fr" });
    await say(host, { type: "send", translation: { evil: 1 } });
    expect(host.box.text).toBe(PROMPT);
    expect(lastView(host).step).toBe("result");
  });

  it("are never asked for with a built-in mode", async () => {
    const host = await start();
    await host.clickAction("polish");
    await say(host, { type: "hello" });
    await say(host, { type: "mode", to: "fix" });
    expect(host.questions.at(-1).system).not.toContain("translations");
    expect(lastView(host).translations).toEqual([]);
  });
});
