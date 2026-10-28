/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — where the user is in the quiz
 *
 * The quiz's state, shared by both ways of showing it (the floating card
 * and the panel): which question is up, the choice picked for it (null
 * until one is), how many were right so far, and whether the quiz is over.
 * Every change returns a new state; a step that doesn't apply (picking
 * twice, moving on before picking) returns the state unchanged, so a
 * double click or a stale message from the page can't skip a question.
 *
 * The state is saved after each step, so closing the quiz, or restarting
 * Tilefold, resumes where the user left off. Pure: no Tilefold calls.
 */

/**
 * @typedef {{ index: number, picked: number | null, score: number, done: boolean, total: number }} QuizState
 */

/** A quiz of `total` questions, at the first one. */
export function startQuiz(total) {
  return { index: 0, picked: null, score: 0, done: false, total };
}

/** Whether a number is a whole number in [min, max]. */
const within = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

/**
 * A saved state checked against a quiz of `total` questions, or a fresh
 * quiz when nothing usable was saved (nothing yet, a damaged value, or a
 * quiz whose length changed since).
 *
 * @param {unknown} value
 * @param {number} total
 * @returns {QuizState}
 */
export function restoreQuiz(value, total) {
  const s = /** @type {any} */ (value);
  const ok =
    s &&
    typeof s === "object" &&
    s.total === total &&
    within(s.index, 0, Math.max(0, total - 1)) &&
    within(s.score, 0, total) &&
    (s.picked === null || within(s.picked, 0, 63)) &&
    typeof s.done === "boolean";
  if (!ok) return startQuiz(total);
  return { index: s.index, picked: s.picked, score: s.score, done: s.done, total };
}

/**
 * Picks `choice` for the current question. Returns the new state and
 * whether the choice was right (`correct` is null when nothing changed).
 *
 * @param {QuizState} state
 * @param {readonly { choices: string[], answer: number }[]} questions
 * @param {number} choice
 * @returns {{ state: QuizState, correct: boolean | null }}
 */
export function pickChoice(state, questions, choice) {
  const q = questions[state.index];
  if (state.done || state.picked !== null || !q || !within(choice, 0, q.choices.length - 1)) {
    return { state, correct: null };
  }
  const correct = choice === q.answer;
  return { state: { ...state, picked: choice, score: state.score + (correct ? 1 : 0) }, correct };
}

/**
 * Moves on from an answered question: to the next one, or to the end of
 * the quiz after the last. Unchanged until the current one is answered.
 *
 * @param {QuizState} state
 * @returns {QuizState}
 */
export function nextQuestion(state) {
  if (state.done || state.picked === null) return state;
  if (state.index + 1 >= state.total) return { ...state, done: true };
  return { ...state, index: state.index + 1, picked: null };
}
