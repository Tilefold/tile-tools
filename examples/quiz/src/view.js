/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — what the user sees
 *
 * Turns the quiz's state into what each way of showing it draws, with
 * every string already in the user's language:
 *
 * - `cardView`: the floating card's page gets a plain object (the
 *   progress, the question, each choice and how it's marked, the answer
 *   and why once one was picked, the next step, or the score at the end).
 *   The page draws it and sends back what the user clicked.
 * - `panelView`: the panel beside the panes gets rows that Tilefold draws
 *   in the user's theme (the question, a row per choice, then whether it
 *   was right, why, and a row to go on). A row's text is at most 256
 *   characters and its hint is only a tooltip, so why gets a row of its own.
 *
 * `t` is `tf.t`. Pure: no Tilefold calls.
 */

/** Letters put before the choices: A, B, C… */
export const letter = (i) => String.fromCharCode(65 + i);

/**
 * How a choice is marked: `right` (the answer, once one was picked),
 * `wrong` (picked, but not the answer) or `none`.
 */
export function markOf(state, q, i) {
  if (state.picked === null) return "none";
  if (i === q.answer) return "right";
  return i === state.picked ? "wrong" : "none";
}

/** The score at the end, as words. */
const scoreLine = (t, state) => t("quiz-score", { score: state.score, total: state.total });

/** The label to go on: to the next question, or to the score after the last. */
const nextLabel = (t, state) => t(state.index + 1 >= state.total ? "quiz-finish" : "quiz-next");

/**
 * The card page's view of the quiz.
 *
 * @param {import("./quiz.js").QuizState} state
 * @param {readonly import("./questions.js").Question[]} questions
 * @param {(key: string, args?: object) => string} t
 */
export function cardView(state, questions, t) {
  if (state.done) {
    return { done: true, score: scoreLine(t, state), again: t("quiz-again") };
  }
  const q = questions[state.index];
  const answered = state.picked !== null;
  return {
    done: false,
    progress: t("quiz-progress", { n: state.index + 1, total: state.total }),
    question: t(q.text),
    choices: q.choices.map((text, i) => ({ letter: letter(i), text, mark: markOf(state, q, i) })),
    picked: state.picked,
    result: answered ? t(state.picked === q.answer ? "quiz-right" : "quiz-wrong") : null,
    correct: answered ? state.picked === q.answer : null,
    why: answered ? t(q.why) : null,
    next: answered ? nextLabel(t, state) : null,
  };
}

/** Row ids the panel uses; a choice row is `choice-<index>`. */
export const ROW = Object.freeze({
  question: "question",
  result: "result",
  why: "why",
  next: "next",
  score: "score",
  again: "again",
});

/** The choice index of a panel row id, or null for any other row. */
export function choiceOfRow(id) {
  const m = /^choice-(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : null;
}

/**
 * The panel's content: its title, the progress as its subtitle, and rows.
 *
 * @param {import("./quiz.js").QuizState} state
 * @param {readonly import("./questions.js").Question[]} questions
 * @param {(key: string, args?: object) => string} t
 */
export function panelView(state, questions, t) {
  const title = t("quiz-title");
  if (state.done) {
    return {
      title,
      subtitle: t("quiz-over"),
      rows: [
        { id: ROW.score, label: scoreLine(t, state), icon: "info", tone: "success" },
        { id: ROW.again, label: t("quiz-again"), icon: "link" },
      ],
    };
  }
  const q = questions[state.index];
  const answered = state.picked !== null;
  const tones = { right: "success", wrong: "error" };
  const rows = [
    { id: ROW.question, label: t(q.text), icon: "info" },
    ...q.choices.map((text, i) => {
      const mark = markOf(state, q, i);
      return {
        id: `choice-${i}`,
        label: `${letter(i)}. ${text}`,
        icon: "none",
        ...(mark !== "none" ? { tone: tones[mark] } : {}),
        // Once answered, the choices that don't matter step back.
        ...(answered && mark === "none" ? { muted: true } : {}),
      };
    }),
  ];
  if (answered) {
    const correct = state.picked === q.answer;
    rows.push({
      id: ROW.result,
      label: t(correct ? "quiz-right" : "quiz-wrong"),
      icon: "info",
      tone: correct ? "success" : "error",
    });
    rows.push({ id: ROW.why, label: t(q.why), icon: "none", muted: true });
    rows.push({ id: ROW.next, label: nextLabel(t, state), icon: "link" });
  }
  return {
    title,
    subtitle: t("quiz-progress", { n: state.index + 1, total: state.total }),
    rows,
  };
}
