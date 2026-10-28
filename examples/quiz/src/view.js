/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — what the user sees
 *
 * Turns the quiz library and the quiz being taken into what each way of
 * showing them draws, with every string ready to show:
 *
 * - `cardView` / `listCardView`: the floating card's page gets a plain
 *   object (a question, its choices and how each is marked, whether the
 *   answer was right and why, the next step or the score; or the list of
 *   quizzes). The page draws it and sends back what the user clicked.
 * - `panelView` / `listPanelView`: the panel beside the panes gets rows
 *   Tilefold draws in the user's theme. A row's text is at most 256
 *   characters and its hint is only a tooltip, so why gets a row of its own.
 *
 * The built-in quiz's texts are message keys, translated with `t` (tf.t);
 * a quiz an agent made is written out already. Pure: no Tilefold calls.
 */

/** Letters put before the choices: A, B, C… */
export const letter = (i) => String.fromCharCode(65 + i);

/** A quiz's own text: translated for the built-in quiz, as written otherwise. */
export const say = (quiz, t, text) => (quiz.builtin ? t(text) : text);

/** A quiz's title, for the list and the card. */
export const titleOf = (entry, t) => (entry.builtin ? t(entry.title) : entry.title);

/** The longest a panel row's text may be. */
const ROW_MAX = 256;
/** Text cut to fit a panel row. */
const fit = (s) => (s.length > ROW_MAX ? `${s.slice(0, ROW_MAX - 1)}…` : s);

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

/** How far into a quiz the user is, as words. */
const progressLine = (t, state) => t("quiz-progress", { n: state.index + 1, total: state.total });

/**
 * The card page's view of a quiz being taken.
 *
 * @param {import("./quiz.js").QuizState} state
 * @param {import("./library.js").Quiz} quiz
 * @param {(key: string, args?: object) => string} t
 */
export function cardView(state, quiz, t) {
  const title = say(quiz, t, quiz.title);
  if (state.done) {
    return {
      screen: "quiz",
      title,
      done: true,
      score: scoreLine(t, state),
      again: t("quiz-again"),
    };
  }
  const q = quiz.questions[state.index];
  const answered = state.picked !== null;
  return {
    screen: "quiz",
    title,
    done: false,
    progress: progressLine(t, state),
    question: say(quiz, t, q.text),
    choices: q.choices.map((text, i) => ({ letter: letter(i), text, mark: markOf(state, q, i) })),
    picked: state.picked,
    result: answered ? t(state.picked === q.answer ? "quiz-right" : "quiz-wrong") : null,
    correct: answered ? state.picked === q.answer : null,
    why: answered ? say(quiz, t, q.why) : null,
    next: answered ? nextLabel(t, state) : null,
  };
}

/** One line under a quiz in the list: its size, and the best score so far. */
const detailOf = (entry, t) =>
  entry.best === null
    ? t("list-count", { count: entry.count })
    : t("list-best", { count: entry.count, best: entry.best });

/**
 * The card page's list of quizzes.
 *
 * @param {import("./library.js").IndexEntry[]} entries the quizzes to show
 * @param {(key: string, args?: object) => string} t
 */
export function listCardView(entries, t) {
  return {
    screen: "list",
    title: t("list-title"),
    quizzes: entries.map((e) => ({ id: e.id, title: titleOf(e, t), detail: detailOf(e, t) })),
    hint: t("list-hint"),
  };
}

/** Row ids the panel uses; a choice row is `choice-<index>`, a quiz `quiz:<id>`. */
export const ROW = Object.freeze({
  list: "list",
  question: "question",
  result: "result",
  why: "why",
  next: "next",
  score: "score",
  again: "again",
  hint: "hint",
});

/** The choice index of a panel row id, or null for any other row. */
export function choiceOfRow(id) {
  const m = /^choice-(\d+)$/.exec(String(id));
  return m ? Number(m[1]) : null;
}

/** The quiz id of a panel row id, or null for any other row. */
export function quizOfRow(id) {
  const m = /^quiz:(.+)$/.exec(String(id));
  return m ? m[1] : null;
}

/** The row that leads back to the list of quizzes. */
const backRow = (t) => ({ id: ROW.list, label: t("list-back"), icon: "link", muted: true });

/**
 * The panel's content for a quiz being taken.
 *
 * @param {import("./quiz.js").QuizState} state
 * @param {import("./library.js").Quiz} quiz
 * @param {(key: string, args?: object) => string} t
 */
export function panelView(state, quiz, t) {
  const title = fit(say(quiz, t, quiz.title));
  if (state.done) {
    return {
      title: title.slice(0, 120),
      subtitle: t("quiz-over"),
      rows: [
        backRow(t),
        { id: ROW.score, label: scoreLine(t, state), icon: "info", tone: "success" },
        { id: ROW.again, label: t("quiz-again"), icon: "link" },
      ],
    };
  }
  const q = quiz.questions[state.index];
  const answered = state.picked !== null;
  const tones = { right: "success", wrong: "error" };
  const rows = [
    backRow(t),
    { id: ROW.question, label: fit(say(quiz, t, q.text)), icon: "info" },
    ...q.choices.map((text, i) => {
      const mark = markOf(state, q, i);
      return {
        id: `choice-${i}`,
        label: fit(`${letter(i)}. ${text}`),
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
    rows.push({ id: ROW.why, label: fit(say(quiz, t, q.why)), icon: "none", muted: true });
    rows.push({ id: ROW.next, label: nextLabel(t, state), icon: "link" });
  }
  return { title: title.slice(0, 120), subtitle: progressLine(t, state), rows };
}

/**
 * The panel's list of quizzes, with a note on making more from your files.
 *
 * @param {import("./library.js").IndexEntry[]} entries
 * @param {(key: string, args?: object) => string} t
 */
export function listPanelView(entries, t) {
  return {
    title: t("list-title"),
    rows: entries.map((e) => ({
      id: `quiz:${e.id}`,
      label: fit(titleOf(e, t)),
      icon: "link",
      trail: detailOf(e, t).slice(0, 32),
    })),
    footer: { rows: [{ id: ROW.hint, label: fit(t("list-hint")), icon: "info", muted: true }] },
  };
}
