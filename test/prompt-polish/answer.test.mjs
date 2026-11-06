// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — asking Claude and reading the answer
 *
 * The system prompt names the language, the mode and the language of the
 * reasons, keeps code exact and asks for JSON; the question is bounded and
 * uses the fast model unless turned off. The answer is read field by
 * field: found inside a fence or words, refused when unreadable, too long,
 * empty or when it changed code; control and direction characters are
 * taken out; notes are bounded, unknown kinds become grammar. Each
 * `tf.ai.ask` error has its message, and "Don't send" none.
 */
import { describe, expect, it } from "vitest";
import {
  KINDS,
  buildAsk,
  clean,
  errorKey,
  readAnswer,
  systemPrompt,
} from "../../examples/prompt-polish/src/answer.js";

const json = (o) => JSON.stringify(o);

describe("the question", () => {
  it("names the language, what to fix, the reasons' language, and asks for JSON", () => {
    const fix = systemPrompt("Korean", "fix", "English");
    expect(fix).toMatch(/in Korean to an AI coding agent/);
    expect(fix).toMatch(/Fix only spelling/);
    expect(fix).toMatch(/Never translate, never answer the prompt/);
    expect(fix).toMatch(/backticks, file paths, links/);
    expect(fix).toMatch(/one short sentence in English/);
    expect(fix).toMatch(/JSON only/);
    expect(systemPrompt("Korean", "natural", "English")).toMatch(/make clumsy phrasing natural/);
  });

  it("sends the prompt as the one message, bounded, on the fast model unless turned off", () => {
    const ask = buildAsk({
      text: "x".repeat(100),
      language: "German",
      mode: "fix",
      uiLanguage: "English",
      fast: true,
    });
    expect(ask.messages).toEqual([{ role: "user", content: "x".repeat(100) }]);
    expect(ask.maxTokens).toBe(550);
    expect(ask.model).toBe("fast");
    expect(
      buildAsk({
        text: "x".repeat(9000),
        language: "German",
        mode: "fix",
        uiLanguage: "English",
        fast: false,
      }),
    ).toMatchObject({
      maxTokens: 4000,
      model: "default",
    });
  });
});

describe("the answer", () => {
  const original = "fix teh bug in `src/a.ts`";

  it("is read as plain JSON, inside a fence, or among words", () => {
    const body = {
      corrected: "fix the bug in `src/a.ts`",
      notes: [{ from: "teh", to: "the", kind: "spelling", why: "Typo." }],
    };
    for (const text of [
      json(body),
      "```json\n" + json(body) + "\n```",
      `Here you go: ${json(body)} Done.`,
    ]) {
      expect(readAnswer(text, original)).toEqual({
        ok: true,
        corrected: body.corrected,
        notes: body.notes,
      });
    }
  });

  it("is refused when it can't be read, is empty, or is far longer than the prompt", () => {
    expect(readAnswer("Sorry, I can't.", original)).toEqual({ ok: false, why: "unreadable" });
    expect(readAnswer("{ not json", original)).toEqual({ ok: false, why: "unreadable" });
    expect(readAnswer(json({ corrected: 5 }), original)).toEqual({ ok: false, why: "unreadable" });
    expect(readAnswer(json({ corrected: "  " }), original)).toEqual({
      ok: false,
      why: "unreadable",
    });
    expect(readAnswer(json({ corrected: "x".repeat(500) }), original)).toEqual({
      ok: false,
      why: "unreadable",
    });
  });

  it("is refused when it changed code, a path or a link", () => {
    expect(
      readAnswer(json({ corrected: "fix the bug in `src/b.ts`", notes: [] }), original),
    ).toEqual({ ok: false, why: "changed-code" });
  });

  it("has control and direction characters taken out of every string", () => {
    const r = readAnswer(
      json({
        corrected: "fix the‮ bug in `src/a.ts`\u0007",
        notes: [{ from: "teh⁦", to: "the", kind: "spelling", why: "a‏b\u0000" }],
      }),
      original,
    );
    expect(r.corrected).toBe("fix the bug in `src/a.ts`");
    expect(r.notes[0]).toEqual({ from: "teh", to: "the", kind: "spelling", why: "a‏b" });
    expect(clean("a\tb\nc\u0085")).toBe("a\tb\nc");
    expect(clean(42)).toBe("");
  });

  it("keeps sound notes only: known kinds, bounded, at most forty", () => {
    const notes = [
      { from: "a", to: "b", kind: "made-up", why: "x" },
      { from: "", to: "", kind: "spelling" },
      { from: "same", to: "same", kind: "spelling" },
      "not a note",
      { from: "c", to: "d", kind: "style", why: "w".repeat(201) },
      ...Array.from({ length: 50 }, (_, i) => ({
        from: `f${i}`,
        to: `t${i}`,
        kind: "grammar",
        why: "",
      })),
    ];
    const r = readAnswer(json({ corrected: "fix the bug in `src/a.ts`", notes }), original);
    expect(r.notes[0]).toEqual({ from: "a", to: "b", kind: "grammar", why: "x" });
    expect(r.notes[1]).toEqual({ from: "c", to: "d", kind: "style", why: "" });
    // The first forty are read; the three that can't be shown are dropped.
    expect(r.notes.length).toBe(37);
    expect(r.notes.every((n) => KINDS.includes(n.kind))).toBe(true);
  });

  it("without notes is still a correction", () => {
    expect(readAnswer(json({ corrected: original }), original)).toEqual({
      ok: true,
      corrected: original,
      notes: [],
    });
  });
});

describe("errors", () => {
  it.each([
    ["AiNotSetUpError", "error-no-key"],
    ["PermissionDeniedError", "error-denied"],
    ["BudgetExceededError", "error-budget"],
    ["RefusedError", "error-refused"],
    ["RateLimitError", "error-failed"],
    ["NetworkError", "error-failed"],
  ])("%s says %s", (name, key) => {
    expect(errorKey({ name })).toBe(key);
  });

  it("\"Don't send\" is the user's choice: no message", () => {
    expect(errorKey({ name: "AiDeclinedError" })).toBeNull();
    expect(errorKey(null)).toBe("error-failed");
  });
});
