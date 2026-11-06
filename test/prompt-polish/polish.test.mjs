// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the text
 *
 * Code, links and paths are found and must survive a correction; the diff
 * keeps Latin words whole and splits other scripts by letter (so a Korean
 * spacing fix is one change), rebuilds both texts, gives up on detail for
 * a huge middle; changes are numbered in reading order and undone one by
 * one; empty and over-long prompts aren't checked.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CHARS,
  blocker,
  build,
  changeCount,
  changes,
  diff,
  keepsProtected,
  protectedSpans,
  tokenize,
} from "../../examples/prompt-polish/src/polish.js";

const before = (ops) =>
  ops
    .filter((o) => o.op !== "ins")
    .map((o) => o.text)
    .join("");
const after = (ops) =>
  ops
    .filter((o) => o.op !== "del")
    .map((o) => o.text)
    .join("");

describe("protected spans", () => {
  it("finds code spans, fenced blocks, links and paths, in order", () => {
    const t =
      "fix `a b` in src/app/main.ts, see https://x.dev/a?b and ~/notes/todo.md\n```\nls\n```";
    expect(protectedSpans(t).map((s) => s.text)).toEqual([
      "`a b`",
      "src/app/main.ts",
      "https://x.dev/a?b",
      "~/notes/todo.md",
      "```\nls\n```",
    ]);
    expect(protectedSpans(undefined)).toEqual([]);
  });

  it("a correction must keep each of them, in the same order", () => {
    const o = "fix `x` in src/a.ts";
    expect(keepsProtected(o, "Fix `x` in src/a.ts.")).toBe(true);
    expect(keepsProtected(o, "fix `y` in src/a.ts")).toBe(false);
    expect(keepsProtected(o, "fix in src/b.ts")).toBe(false);
    expect(keepsProtected("`a` then `b`", "`b` then `a`")).toBe(false);
    expect(keepsProtected("no code here", "No code here.")).toBe(true);
  });
});

describe("the diff", () => {
  it("keeps Latin words whole and splits Hangul and kana by letter", () => {
    expect(tokenize("don't  é-tat")).toEqual(["don't", "  ", "é-tat"]);
    expect(tokenize("로그인하면")).toEqual(["로", "그", "인", "하", "면"]);
    expect(tokenize("修正 `a b`")).toEqual(["修", "正", " ", "`a b`"]);
    expect(tokenize(null)).toEqual([]);
  });

  it("rebuilds both texts and merges runs", () => {
    const ops = diff("Can you fixed it", "Can you fix it");
    expect(ops).toEqual([
      { op: "same", text: "Can you " },
      { op: "del", text: "fixed" },
      { op: "ins", text: "fix" },
      { op: "same", text: " it" },
    ]);
  });

  it.each([
    [
      "ko",
      "사용자가 로그아웃 한 후 다시 로그인 하면 안돼요",
      "사용자가 로그아웃한 후 다시 로그인하면 안 돼요",
    ],
    ["ja", "トークンを更新されません", "トークンが更新されません"],
    ["es", "Puedes arreglar la sesion?", "¿Puedes arreglar la sesión?"],
    ["en", "it dont work", "it doesn't work"],
    ["same", "nothing changes", "nothing changes"],
    ["empty", "", "new text"],
  ])("rebuilds %s exactly both ways", (_, a, b) => {
    const ops = diff(a, b);
    expect(before(ops)).toBe(a);
    expect(after(ops)).toBe(b);
  });

  it("shows a Korean spacing fix as one change of a space", () => {
    const parts = changes(diff("로그인 하면", "로그인하면"));
    expect(changeCount(parts)).toBe(1);
    expect(parts[1]).toEqual({ id: 1, del: " ", ins: "" });
  });

  it("gives up on detail for a middle too big to compare, still rebuilding both", () => {
    const a = Array.from({ length: 2100 }, (_, i) => `a${i}`).join(" ");
    const b = Array.from({ length: 2100 }, (_, i) => `b${i}`).join(" ");
    const ops = diff(a, b);
    expect(ops.map((o) => o.op)).toEqual(["del", "ins"]);
    expect(before(ops)).toBe(a);
    expect(after(ops)).toBe(b);
  });
});

describe("changes", () => {
  it("are numbered in reading order and undone one by one", () => {
    const parts = changes(diff("teh cat sat on teh mat", "the cat sat on the mat"));
    expect(changeCount(parts)).toBe(2);
    expect(build(parts, [])).toBe("the cat sat on the mat");
    expect(build(parts, [1, 2])).toBe("teh cat sat on teh mat");
    expect(build(parts, new Set([2]))).toBe("the cat sat on teh mat");
  });

  it("pure additions and removals are changes too", () => {
    expect(changes(diff("Puedes venir?", "¿Puedes venir?"))[0]).toEqual({
      id: 1,
      del: "",
      ins: "¿",
    });
    const del = changes(diff("思いますです", "思います"));
    expect(build(del, [1])).toBe("思いますです");
  });
});

describe("what can be checked", () => {
  it("not an empty prompt, nor one over the limit", () => {
    expect(blocker("   ")).toBe("empty");
    expect(blocker(null)).toBe("empty");
    expect(blocker("x".repeat(MAX_CHARS + 1))).toBe("too-long");
    expect(blocker("ok")).toBe("");
  });
});
