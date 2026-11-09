// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the built-in cases' languages (tests)
 *
 * "Mistakes only" and "Mistakes, and make it read naturally" each have a
 * setting naming languages to also translate into, read like a case's
 * (known codes or names, each once, at most eight). With a built-in case in
 * use, Edit opens a form for just those; Save writes its setting and picks
 * it, and the next check asks Claude (or the polish agent) for those
 * translations, reading them back like a case's. Audits carry a count,
 * never a language or a prompt.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { startTile } from "../fake-host.mjs";
import { settingsOf } from "../../examples/prompt-polish/src/settings.js";

const DIR = fileURLToPath(new URL("../../examples/prompt-polish/", import.meta.url));
const PROMPT = "make a video of my cat";
const ANSWER = JSON.stringify({
  corrected: "Make a video of my cat.",
  notes: [],
  translations: { ja: "猫の動画を作って。", ko: "고양이 영상을 만들어 줘.", fr: "Fais une vidéo." },
});

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, {
    page: "dock",
    ai: () => ANSWER,
    input: { text: PROMPT, language: "en" },
    ...opts,
    settings: { language: "en", ...opts.settings },
  });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(JSON.stringify(a.details ?? {})).not.toMatch(/cat|ja|ko/);
  }
});

const say = async (host, message) => {
  await host.emit("page.message", { message });
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
};
const lastView = (host) => host.page.posted.filter((m) => m.do === "show").at(-1)?.view;
const lastSystem = (host) => host.questions.at(-1)?.system ?? "";

/** Opens the card for the prompt and lets Claude check it. */
async function checked(opts) {
  const host = await start(opts);
  await host.clickAction("polish");
  await say(host, { type: "hello" });
  return host;
}

describe("the built-in cases' languages", () => {
  it("are read from their settings like a case's", () => {
    const get = (v) => ({ get: (k) => v[k] });
    expect(
      settingsOf(get({ fixTranslate: "ja, Korean, 日本語, xx", naturalTranslate: 5 }))
        .builtinTranslate,
    ).toEqual({ fix: ["ja", "ko"], natural: [] });
    const many = "ja, ko, zh-CN, fr, es, de, it, pt-BR, ru, ar, hi";
    expect(settingsOf(get({ naturalTranslate: many })).builtinTranslate.natural).toHaveLength(8);
    expect(settingsOf(get({ fixTranslate: "ja‮, k\u0000o" })).builtinTranslate.fix).toEqual([
      "ja",
      "ko",
    ]);
  });

  it("go to Claude with the built-in case, and come back as translations", async () => {
    const host = await checked({ settings: { fixTranslate: "ja, ko" } });
    expect(lastSystem(host)).toContain("Japanese (ja)");
    expect(lastSystem(host)).toContain("Never translate the corrected prompt itself");
    expect(lastView(host).translations.map((x) => x.code)).toEqual(["ja", "ko"]);
  });

  it("ask for none while the setting is empty", async () => {
    const host = await checked();
    expect(lastSystem(host)).not.toContain("translations");
    expect(lastView(host).translations ?? []).toEqual([]);
  });

  it("are edited on the card: the form, Save, and the next check", async () => {
    const host = await checked();
    await say(host, { type: "case-edit", builtin: "fix" });
    expect(lastView(host)).toMatchObject({
      step: "case",
      builtin: "fix",
      name: "Mistakes only",
      translate: "",
    });
    await say(host, { type: "case-save", translate: "Japanese, fr, nonsense" });
    expect(host.settingSets.at(-1)).toEqual({ key: "fixTranslate", value: "ja, fr" });
    expect(host.audits).toContainEqual({
      action: "builtin-saved",
      details: { mode: "fix", languages: 2 },
    });
    // Checked again with the languages, the built-in case still in use.
    expect(lastSystem(host)).toContain("French (fr)");
    expect(lastView(host)).toMatchObject({ step: "result", modeId: "fix" });
    // The form shows what is saved next time.
    await say(host, { type: "case-edit", builtin: "fix" });
    expect(lastView(host).translate).toBe("ja, fr");
  });

  it("are edited for the natural case too, and picks it", async () => {
    const host = await checked();
    await say(host, { type: "case-edit", builtin: "natural" });
    await say(host, { type: "case-save", translate: "ko" });
    expect(host.settingSets.at(-1)).toEqual({ key: "naturalTranslate", value: "ko" });
    expect(lastView(host).modeId).toBe("natural");
  });

  it("can be cleared, and a cancel changes nothing", async () => {
    const host = await checked({ settings: { fixTranslate: "ja" } });
    await say(host, { type: "case-edit", builtin: "fix" });
    await say(host, { type: "case-cancel" });
    expect(host.settingSets).toEqual([]);
    await say(host, { type: "case-edit", builtin: "fix" });
    await say(host, { type: "case-save", translate: "" });
    expect(host.settingSets.at(-1)).toEqual({ key: "fixTranslate", value: "" });
  });

  it("aren't editable on an older Tilefold, and odd messages do nothing", async () => {
    const old = await checked({ settingsSet: false });
    await say(old, { type: "case-edit", builtin: "fix" });
    expect(lastView(old).step).not.toBe("case");
    const host = await checked();
    for (const m of [
      { type: "case-save", translate: "ja" },
      { type: "case-edit", builtin: "__proto__" },
      { type: "case-edit", builtin: { toString: () => "fix" } },
    ]) {
      await say(host, m);
    }
    expect(host.settingSets.filter((x) => x.key.endsWith("Translate"))).toEqual([]);
    await say(host, { type: "case-edit", builtin: "fix" });
    await say(host, { type: "case-save", translate: { evil: true } });
    expect(host.settingSets.at(-1)).toEqual({ key: "fixTranslate", value: "" });
    expect({}.evil).toBeUndefined();
  });
});
