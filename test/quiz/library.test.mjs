// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the library and the appearance
 *
 * A quiz an agent sends is checked and tidied before it's kept, and every
 * problem is named so the agent can fix it. Ids are readable and safe as
 * store keys. The index keeps the built-in quiz first, only marks removed
 * quizzes (they come back), keeps the best score, and drops damaged
 * entries. The card is light or dark as switched, else as set, else as the
 * system is.
 */
import { describe, expect, it } from "vitest";
import {
  BUILTIN_ID,
  LIMITS,
  builtinQuiz,
  checkQuiz,
  entryFor,
  markRemoved,
  markRestored,
  quizId,
  readIndex,
  readQuiz,
  visible,
  withBest,
  withBuiltin,
} from "../../examples/quiz/src/library.js";
import {
  appearanceOf,
  effectiveTheme,
  flipped,
  schemeOf,
} from "../../examples/quiz/src/appearance.js";

/** A good question as an agent sends it. */
const q = (n = 1) => ({
  question: `Question ${n}?`,
  choices: ["Yes", "No", "Maybe"],
  answer: 1,
  why: "Because the notes say so.",
});

describe("a quiz from an agent", () => {
  it("is kept tidied: single spaces, trimmed", () => {
    const quiz = checkQuiz({
      title: "  Biology   notes ",
      questions: [{ ...q(), question: " What  is\nATP? " }],
    });
    expect(quiz.title).toBe("Biology notes");
    expect(quiz.questions[0]).toEqual({
      text: "What is ATP?",
      why: "Because the notes say so.",
      choices: ["Yes", "No", "Maybe"],
      answer: 1,
    });
  });

  it.each([
    [null, /Send an object/],
    [[], /Send an object/],
    [{ questions: [q()] }, /title/],
    [{ title: "x".repeat(LIMITS.title + 1), questions: [q()] }, /title/],
    [{ title: "T", questions: [] }, /at least one question/],
    [
      { title: "T", questions: Array.from({ length: LIMITS.questions + 1 }, (_, i) => q(i)) },
      /split it/,
    ],
    [{ title: "T", questions: [{ ...q(), question: "" }] }, /questions\[0\]\.question/],
    [
      { title: "T", questions: [{ ...q(), choices: ["only"] }] },
      /questions\[0\]\.choices must list/,
    ],
    [{ title: "T", questions: [{ ...q(), choices: ["a", "a"] }] }, /must all differ/],
    [{ title: "T", questions: [{ ...q(), choices: ["a", 3] }] }, /choices\[1\]/],
    [{ title: "T", questions: [{ ...q(), answer: 3 }] }, /answer must be the index/],
    [{ title: "T", questions: [{ ...q(), answer: "1" }] }, /answer must be the index/],
    [{ title: "T", questions: [{ ...q(), why: "" }] }, /why must explain/],
    [{ title: "T", questions: [q(), "nope"] }, /questions\[1\] must be an object/],
  ])("is refused with what to fix: %j", (input, message) => {
    expect(() => checkQuiz(input)).toThrow(message);
  });

  it("gets a readable id that is safe as a store key", () => {
    expect(quizId("Cell Biology: Chapter 2!", 1_700_000_000_000)).toBe(
      `cell-biology-chapter-2-${(1_700_000_000_000).toString(36)}`,
    );
    expect(quizId("日本語", 1)).toBe("quiz-1");
    expect(quizId("x".repeat(80), 1).length).toBeLessThanOrEqual(32 + 2);
  });

  it("reads back from the store, and a damaged one reads as missing", () => {
    const kept = checkQuiz({ title: "T", questions: [q()] });
    expect(readQuiz(kept)).toEqual(kept);
    expect(readQuiz({ title: "T", questions: [{ text: "?" }] })).toBeNull();
    expect(readQuiz(null)).toBeNull();
  });
});

describe("the index", () => {
  const added = entryFor("bio-1", checkQuiz({ title: "Bio", questions: [q(), q(2)] }), 0);

  it("lists a new quiz with its size and no best score yet", () => {
    expect(added).toEqual({
      id: "bio-1",
      title: "Bio",
      count: 2,
      added: "1970-01-01T00:00:00.000Z",
      best: null,
    });
  });

  it("puts the built-in quiz first, once", () => {
    const index = withBuiltin([added]);
    expect(index.map((e) => e.id)).toEqual([BUILTIN_ID, "bio-1"]);
    expect(index[0]).toMatchObject({ builtin: true, count: builtinQuiz().questions.length });
    expect(withBuiltin(index)).toBe(index);
  });

  it("only marks a removed quiz, and brings it back", () => {
    const removed = markRemoved([added], "bio-1");
    expect(removed).toHaveLength(1);
    expect(visible(removed)).toEqual([]);
    expect(visible(markRestored(removed, "bio-1"))).toEqual([added]);
  });

  it("keeps the best score", () => {
    let index = withBest([added], "bio-1", 1);
    expect(index[0].best).toBe(1);
    index = withBest(index, "bio-1", 0);
    expect(index[0].best).toBe(1);
    expect(withBest(index, "bio-1", 2)[0].best).toBe(2);
  });

  it("drops damaged entries", () => {
    expect(readIndex([added, { id: 3 }, null, { ...added, best: "x" }])).toEqual([added]);
    expect(readIndex("nope")).toEqual([]);
  });

  it("has a built-in quiz whose texts are message keys", () => {
    const quiz = builtinQuiz();
    expect(quiz).toMatchObject({ id: BUILTIN_ID, title: "quiz-title", builtin: true });
    for (const question of quiz.questions) expect(question.text).toMatch(/^q-/);
  });
});

describe("light or dark", () => {
  it("follows a switch, then the setting, then the system", () => {
    expect(effectiveTheme("light", "dark", "light")).toBe("dark");
    expect(effectiveTheme("dark", null, "light")).toBe("dark");
    expect(effectiveTheme("auto", null, "dark")).toBe("dark");
    expect(effectiveTheme("auto", null, null)).toBe("light");
    expect(effectiveTheme("bogus", null, "dark")).toBe("dark");
  });

  it("flips, and reads only light or dark", () => {
    expect(flipped("dark")).toBe("light");
    expect(flipped("light")).toBe("dark");
    expect(schemeOf("dark")).toBe("dark");
    expect(schemeOf("blue")).toBeNull();
    expect(appearanceOf("purple")).toBe("auto");
  });
});
