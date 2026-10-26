// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the quiz, its views, keys, grip and card geometry
 *
 * The quiz moves one question at a time and can't be skipped or answered
 * twice; saved progress is checked before it's trusted. The card's view
 * and the panel's rows show the same thing (marks, why, the next step,
 * the score). Keys pick, go on and close. The grip's picture is a safe SVG
 * in two halves. The card sits in the focused pane's corner, or where it
 * was dropped, always clear of the Composer and the bars above the panes.
 */
import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../../examples/quiz/src/questions.js";
import { nextQuestion, pickChoice, restoreQuiz, startQuiz } from "../../examples/quiz/src/quiz.js";
import {
  ROW,
  cardView,
  choiceOfRow,
  listCardView,
  listPanelView,
  markOf,
  panelView,
  quizOfRow,
} from "../../examples/quiz/src/view.js";
import { builtinQuiz, withBuiltin } from "../../examples/quiz/src/library.js";
import { keyAction } from "../../examples/quiz/page-src/keys.js";
import { fitTitle, gripImages, xml } from "../../examples/quiz/src/grip.js";
import {
  CARD,
  GRIP_HALF,
  MARGIN,
  PAGE_H,
  PAGE_W,
  areaOf,
  cardSpots,
  cornerOf,
  settle,
} from "../../examples/quiz/src/scene.js";
import {
  createDrag,
  placeAt,
  positionFor,
  readPosition,
} from "../../examples/quiz/src/position.js";
import { ONE_PANE } from "../fake-host.mjs";

/** A stand-in for tf.t: the key, with its arguments. */
const t = (key, args) => (args ? `${key}:${JSON.stringify(args)}` : key);

/** Two questions, to test the quiz without the real ones. */
const QS = [
  { id: "a", text: "qa", why: "wa", choices: ["x", "y", "z"], answer: 1 },
  { id: "b", text: "qb", why: "wb", choices: ["p", "q"], answer: 0 },
];
/** A quiz an agent made of them: its texts are shown as written. */
const QUIZ = { id: "mine", title: "My quiz", questions: QS };

describe("the questions", () => {
  it("each have choices, a valid answer and their own string keys", () => {
    expect(QUESTIONS.length).toBeGreaterThan(0);
    const ids = new Set();
    for (const q of QUESTIONS) {
      expect(ids.has(q.id), q.id).toBe(false);
      ids.add(q.id);
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.choices.length).toBeLessThanOrEqual(9);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(q.text).toMatch(/^q-[a-z]+$/);
      expect(q.why).toBe(`${q.text}-why`);
    }
  });
});

describe("the quiz", () => {
  it("starts at the first question with nothing picked", () => {
    expect(startQuiz(2)).toEqual({ index: 0, picked: null, score: 0, done: false, total: 2 });
  });

  it("counts a right pick, and a wrong one not", () => {
    const right = pickChoice(startQuiz(2), QS, 1);
    expect(right.correct).toBe(true);
    expect(right.state).toMatchObject({ picked: 1, score: 1 });
    const wrong = pickChoice(startQuiz(2), QS, 0);
    expect(wrong.correct).toBe(false);
    expect(wrong.state).toMatchObject({ picked: 0, score: 0 });
  });

  it("can't be answered twice, out of range, or skipped", () => {
    const s = pickChoice(startQuiz(2), QS, 1).state;
    expect(pickChoice(s, QS, 0)).toEqual({ state: s, correct: null });
    expect(pickChoice(startQuiz(2), QS, 3).correct).toBeNull();
    expect(pickChoice(startQuiz(2), QS, -1).correct).toBeNull();
    const fresh = startQuiz(2);
    expect(nextQuestion(fresh)).toBe(fresh);
  });

  it("moves to the next question, then ends after the last", () => {
    let s = pickChoice(startQuiz(2), QS, 1).state;
    s = nextQuestion(s);
    expect(s).toMatchObject({ index: 1, picked: null, done: false, score: 1 });
    s = nextQuestion(pickChoice(s, QS, 0).state);
    expect(s).toMatchObject({ index: 1, done: true, score: 2 });
    expect(nextQuestion(s)).toBe(s);
    expect(pickChoice(s, QS, 0).correct).toBeNull();
  });

  it("restores saved progress only when it fits the quiz", () => {
    const saved = { index: 1, picked: 0, score: 1, done: false, total: 2 };
    expect(restoreQuiz(saved, 2)).toEqual(saved);
    expect(restoreQuiz(null, 2)).toEqual(startQuiz(2));
    expect(restoreQuiz({ ...saved, total: 3 }, 2)).toEqual(startQuiz(2));
    expect(restoreQuiz({ ...saved, index: 5 }, 2)).toEqual(startQuiz(2));
    expect(restoreQuiz({ ...saved, score: 9 }, 2)).toEqual(startQuiz(2));
    expect(restoreQuiz({ ...saved, done: "yes" }, 2)).toEqual(startQuiz(2));
    expect(restoreQuiz("garbage", 2)).toEqual(startQuiz(2));
  });
});

describe("the card's view", () => {
  it("shows the question and unmarked choices before a pick", () => {
    const v = cardView(startQuiz(2), QUIZ, t);
    expect(v).toMatchObject({
      done: false,
      question: "qa",
      picked: null,
      result: null,
      next: null,
    });
    expect(v.progress).toBe('quiz-progress:{"n":1,"total":2}');
    expect(v.choices).toEqual([
      { letter: "A", text: "x", mark: "none" },
      { letter: "B", text: "y", mark: "none" },
      { letter: "C", text: "z", mark: "none" },
    ]);
  });

  it("marks the answer and a wrong pick, and says why and what's next", () => {
    const v = cardView(pickChoice(startQuiz(2), QS, 2).state, QUIZ, t);
    expect(v.choices.map((c) => c.mark)).toEqual(["none", "right", "wrong"]);
    expect(v).toMatchObject({ result: "quiz-wrong", correct: false, why: "wa", next: "quiz-next" });
  });

  it("offers the score after the last question, then the score and start over", () => {
    const last = pickChoice(nextQuestion(pickChoice(startQuiz(2), QS, 1).state), QS, 0).state;
    expect(cardView(last, QUIZ, t)).toMatchObject({ result: "quiz-right", next: "quiz-finish" });
    expect(cardView(nextQuestion(last), QUIZ, t)).toEqual({
      screen: "quiz",
      title: "My quiz",
      done: true,
      score: 'quiz-score:{"score":2,"total":2}',
      again: "quiz-again",
    });
  });

  it("marks only once something is picked", () => {
    expect(markOf(startQuiz(2), QS[0], 1)).toBe("none");
  });
});

describe("the panel's rows", () => {
  it("lists the question and a row per choice, with ids that come back on click", () => {
    const p = panelView(startQuiz(2), QUIZ, t);
    expect(p.title).toBe("My quiz");
    expect(p.subtitle).toBe('quiz-progress:{"n":1,"total":2}');
    expect(p.rows.map((r) => r.id)).toEqual([
      ROW.list,
      ROW.question,
      "choice-0",
      "choice-1",
      "choice-2",
    ]);
    expect(p.rows[1].label).toBe("qa");
    expect(p.rows[2].label).toBe("A. x");
    expect(choiceOfRow("choice-2")).toBe(2);
    expect(choiceOfRow("next")).toBeNull();
  });

  it("colors the answer and a wrong pick, mutes the rest, and adds why and next", () => {
    const p = panelView(pickChoice(startQuiz(2), QS, 0).state, QUIZ, t);
    const byId = Object.fromEntries(p.rows.map((r) => [r.id, r]));
    expect(byId["choice-0"].tone).toBe("error");
    expect(byId["choice-1"].tone).toBe("success");
    expect(byId["choice-2"].muted).toBe(true);
    expect(byId[ROW.result]).toMatchObject({ label: "quiz-wrong", tone: "error" });
    expect(byId[ROW.why]).toMatchObject({ label: "wa", muted: true });
    expect(byId[ROW.next].label).toBe("quiz-next");
  });

  it("ends with the score and a row to start over", () => {
    const done = { index: 1, picked: 0, score: 1, done: true, total: 2 };
    const p = panelView(done, QUIZ, t);
    expect(p.subtitle).toBe("quiz-over");
    expect(p.rows.map((r) => r.id)).toEqual([ROW.list, ROW.score, ROW.again]);
  });

  it("translates the built-in quiz's texts, and shows an agent's as written", () => {
    const builtin = builtinQuiz();
    const p = panelView(startQuiz(builtin.questions.length), builtin, t);
    expect(p.title).toBe("quiz-title");
    expect(p.rows[1].label).toBe("q-pipe");
    expect(cardView(startQuiz(2), QUIZ, (k) => `T(${k})`).question).toBe("qa");
  });

  it("cuts an agent's long texts to fit a row", () => {
    const long = {
      ...QUIZ,
      questions: [{ ...QS[0], text: "w".repeat(240), choices: ["c".repeat(300), "d"] }],
    };
    const p = panelView(startQuiz(1), long, t);
    for (const r of p.rows) expect(r.label.length).toBeLessThanOrEqual(256);
  });

  it("keeps every label within Tilefold's 256 characters, with the real strings", () => {
    const long = (key) => `${key} `.repeat(4);
    for (let i = 0; i < QUESTIONS.length; i++) {
      const s = { index: i, picked: 0, score: 0, done: false, total: QUESTIONS.length };
      for (const r of panelView(s, builtinQuiz(), long).rows)
        expect(r.label.length).toBeLessThanOrEqual(256);
    }
  });
});

describe("the list of quizzes", () => {
  const entries = withBuiltin([{ id: "bio-1", title: "Bio", count: 4, added: "", best: 3 }]);

  it("lists each quiz on the card, with its size and best score", () => {
    const v = listCardView(entries, t);
    expect(v).toMatchObject({ screen: "list", title: "list-title", hint: "list-hint" });
    expect(v.quizzes).toEqual([
      { id: "terminal", title: "quiz-title", detail: 'list-count:{"count":6}' },
      { id: "bio-1", title: "Bio", detail: 'list-best:{"count":4,"best":3}' },
    ]);
  });

  it("lists each quiz in the panel, with a note on making more", () => {
    const p = listPanelView(entries, t);
    expect(p.rows.map((r) => r.id)).toEqual(["quiz:terminal", "quiz:bio-1"]);
    expect(quizOfRow("quiz:bio-1")).toBe("bio-1");
    expect(quizOfRow("choice-1")).toBeNull();
    expect(p.footer.rows[0]).toMatchObject({ id: ROW.hint, muted: true });
    for (const r of p.rows) expect(r.trail.length).toBeLessThanOrEqual(32);
  });
});

describe("the page's keys", () => {
  const open = cardView(startQuiz(2), QUIZ, t);
  const answered = cardView(pickChoice(startQuiz(2), QS, 1).state, QUIZ, t);

  it("pick with a number or a letter while the question is open", () => {
    expect(keyAction({ key: "2" }, open)).toEqual({ type: "pick", choice: 1 });
    expect(keyAction({ key: "c" }, open)).toEqual({ type: "pick", choice: 2 });
    expect(keyAction({ key: "4" }, open)).toBeNull();
    expect(keyAction({ key: "Enter" }, open)).toBeNull();
  });

  it("go on with Enter once answered, start over at the end, close with Escape", () => {
    expect(keyAction({ key: "Enter" }, answered)).toEqual({ type: "next" });
    expect(keyAction({ key: "1" }, answered)).toBeNull();
    expect(keyAction({ key: "Enter" }, { done: true })).toEqual({ type: "again" });
    expect(keyAction({ key: "Escape" }, null)).toEqual({ type: "close" });
  });

  it("open a quiz from the list with its number", () => {
    const list = { screen: "list", quizzes: [{ id: "terminal" }, { id: "bio-1" }] };
    expect(keyAction({ key: "2" }, list)).toEqual({ type: "open-quiz", id: "bio-1" });
    expect(keyAction({ key: "3" }, list)).toBeNull();
    expect(keyAction({ key: "a" }, list)).toBeNull();
  });

  it("leave shortcuts with Ctrl, Alt or ⌘ alone", () => {
    expect(keyAction({ key: "1", metaKey: true }, open)).toBeNull();
    expect(keyAction({ key: "a", ctrlKey: true }, open)).toBeNull();
  });
});

describe("the grip", () => {
  it("is two SVG halves of one drawing, with the title escaped", () => {
    const { left, right } = gripImages("Quiz <&>");
    for (const url of [left, right]) {
      expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
      expect(decodeURIComponent(url)).toContain(`width="${GRIP_HALF}"`);
    }
    expect(decodeURIComponent(left)).toContain('viewBox="0 0');
    expect(decodeURIComponent(right)).toContain(`viewBox="${GRIP_HALF} 0`);
    expect(decodeURIComponent(left)).toContain("Quiz &lt;&amp;&gt;");
    expect(decodeURIComponent(left)).not.toContain("<script");
  });

  it("is drawn light or dark, like the card", () => {
    expect(decodeURIComponent(gripImages("Q", false, "light").left)).toContain("#f3f4f8");
    expect(decodeURIComponent(gripImages("Q", false, "dark").left)).toContain("#262833");
  });

  it("shortens a long title, and puts it at the right for right-to-left", () => {
    expect(fitTitle("A very long quiz title indeed")).toHaveLength(18);
    expect(decodeURIComponent(gripImages("Q", true).left)).toContain('text-anchor="end"');
    expect(xml('"')).toBe("&quot;");
  });
});

describe("where the card goes", () => {
  it("sits in the focused pane's corner, above its Composer", () => {
    const s = cardSpots(ONE_PANE, "bottom-right", null);
    const composer = ONE_PANE.panes[0].composer;
    expect(s.card).toEqual({
      x: 1200 - MARGIN - CARD.w,
      y: composer.y - MARGIN - CARD.h,
      w: CARD.w,
      h: CARD.h,
    });
    expect(s.page).toEqual({ x: s.card.x, y: s.card.y + CARD.h - PAGE_H, w: PAGE_W, h: PAGE_H });
    expect(s.gripL.x + s.gripL.w).toBe(s.gripR.x);
    expect(s.gripL.w).toBeLessThanOrEqual(256);
    expect(cardSpots(ONE_PANE, "top-left", null).card).toMatchObject({ x: MARGIN, y: 40 + MARGIN });
  });

  it("stays where it was dropped, inside the window", () => {
    const s = cardSpots(ONE_PANE, "bottom-right", { fx: 0, fy: 0 });
    expect(s.card).toMatchObject({ x: 0, y: 40 });
  });

  it("keeps off a Composer row and out of the bars above the panes", () => {
    const composer = ONE_PANE.panes[0].composer;
    expect(settle(ONE_PANE, { x: 10, y: composer.y - 10 }).y).toBe(composer.y - MARGIN - CARD.h);
    expect(settle(ONE_PANE, { x: 10, y: 0 }).y).toBe(40);
    expect(settle(ONE_PANE, { x: 5000, y: 100 }).x).toBe(1200 - CARD.w);
  });

  it("uses the whole window without panes, and the default corner for anything unknown", () => {
    expect(areaOf({ content: { w: 900, h: 700 }, panes: [] })).toEqual({
      x: 0,
      y: 0,
      w: 900,
      h: 700,
    });
    expect(cornerOf("middle")).toBe("bottom-right");
  });

  it("keeps a dragged position as fractions of the room", () => {
    const content = { w: 1000, h: 800 };
    expect(positionFor(content, 200, 100, 400, 350)).toEqual({ fx: 0.5, fy: 0.5 });
    expect(placeAt(content, 200, 100, { fx: 0.5, fy: 0.5 })).toEqual({ x: 400, y: 350 });
    expect(readPosition({ fx: 2, fy: -1 })).toEqual({ fx: 1, fy: 0 });
    expect(readPosition({ fx: "a" })).toBeNull();
    const drag = createDrag();
    expect(drag.move(1, 1, content, 200, 100)).toBeNull();
    drag.start(100, 100, { x: 0, y: 0 });
    expect(drag.end(500, 450, content, 200, 100)).toEqual({ fx: 0.5, fy: 0.5 });
    expect(drag.active()).toBe(false);
  });
});
