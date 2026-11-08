// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — translations into any language (tests)
 *
 * A case (or a built-in one) translates into any language the runtime
 * has a name for, named by a code in any case (kept in its standard form)
 * or by its name in English or in the language itself; anything else
 * (unknown codes, long or odd words, hidden characters) names none. The
 * question names each as "Vietnamese (vi)"; the hand-back keeps only
 * language codes, a few at most, and the answer only those asked for. The
 * card shows each with its own name and code.
 */
import { describe, expect, it } from "vitest";
import { translateAsk, readTranslations } from "../../examples/prompt-polish/src/answer.js";
import { readHandBack } from "../../examples/prompt-polish/src/agentCheck.js";
import { translateOf } from "../../examples/prompt-polish/src/cases.js";
import {
  askName,
  languageCode,
  nativeName,
  shownName,
} from "../../examples/prompt-polish/src/translateLanguages.js";

describe("naming a language", () => {
  it("takes a code in any case, in its standard form", () => {
    expect(languageCode("vi")).toBe("vi");
    expect(languageCode("PT-pt")).toBe("pt-PT");
    expect(languageCode("zh-tw")).toBe("zh-TW");
    expect(languageCode("zh-cn")).toBe("zh-CN");
    expect(languageCode("es-419")).toBe("es-419");
    expect(languageCode("tlh")).toBe("tlh");
  });

  it("takes a name in English or in the language itself", () => {
    expect(languageCode("Vietnamese")).toBe("vi");
    expect(languageCode("tiếng việt")).toBe("vi");
    expect(languageCode("Traditional Chinese")).toBe("zh-Hant");
    expect(languageCode("Kiswahili")).toBe("sw");
    expect(languageCode("日本語")).toBe("ja");
    expect(languageCode("Brazilian Portuguese")).toBe("pt-BR");
  });

  it("names nothing for anything else", () => {
    for (const bad of [
      "",
      "xx",
      "qq-ZZ",
      "Elvish",
      "ja; rm -rf ~",
      "ja‮",
      "x".repeat(41),
      "__proto__",
      "constructor",
      "vi-",
      "-vi",
      42,
      null,
      { toString: () => "ja" },
    ]) {
      expect(languageCode(bad), String(bad)).toBeNull();
    }
  });

  it("is shown with its own name and code, and asked for by its English name", () => {
    expect(shownName("vi")).toBe("Tiếng Việt · vi");
    expect(shownName("ja")).toBe("日本語 · ja");
    expect(nativeName("zh-Hant")).toBe("繁體中文");
    expect(askName("vi")).toBe("Vietnamese (vi)");
    expect(askName("pt-BR")).toBe("Brazilian Portuguese (pt-BR)");
  });
});

describe("a case's languages", () => {
  it("are any languages, each once, at most eight", () => {
    expect(translateOf("vi, Vietnamese, sw; Traditional Chinese、fr，de\nxx")).toEqual([
      "vi",
      "sw",
      "zh-Hant",
      "fr",
      "de",
    ]);
    expect(translateOf("vi, th, id, ms, tl, sw, am, yo, zu, xh")).toHaveLength(8);
    expect(translateOf(["vi", 5, null, "PT-pt"])).toEqual(["vi", "pt-PT"]);
  });

  it("are asked for by name and code", () => {
    const ask = translateAsk(["vi", "zh-Hant"]);
    expect(ask).toContain("Vietnamese (vi), Traditional Chinese (zh-Hant)");
    expect(ask).toContain('{"vi": string}');
    // A code that isn't in standard form, or isn't a language, is never asked for.
    expect(translateAsk(["xx", "zh-tw"])).toBe("");
  });

  it("come back from the polish agent by code, a few at most", () => {
    const translations = {
      vi: "Sửa lỗi đăng nhập.",
      "zh-Hant": "修正登入錯誤。",
      xx: "nope",
      __proto__x: "nope",
      ["x".repeat(30)]: "nope",
      "vi; rm": "nope",
    };
    const r = readHandBack({ request: "abcde12345", corrected: "Fix the login.", translations });
    expect(JSON.parse(r.answer).translations).toEqual({
      vi: "Sửa lỗi đăng nhập.",
      "zh-Hant": "修正登入錯誤。",
    });
    const many = Object.fromEntries(
      [
        "vi",
        "th",
        "id",
        "ms",
        "sw",
        "am",
        "yo",
        "zu",
        "xh",
        "ha",
        "ig",
        "so",
        "ne",
        "si",
        "km",
        "lo",
        "my",
        "mn",
      ].map((c) => [c, "x"]),
    );
    const lots = readHandBack({ request: "abcde12345", corrected: "x", translations: many });
    expect(Object.keys(JSON.parse(lots.answer).translations).length).toBeLessThanOrEqual(16);
  });

  it("are read back only as asked for", () => {
    const raw = { vi: "Sửa lỗi.", th: "แก้ไข", ja: "直して" };
    expect(readTranslations(raw, "Fix it.", "fix", ["vi", "ja"]).map((x) => x.code)).toEqual([
      "vi",
      "ja",
    ]);
  });
});
