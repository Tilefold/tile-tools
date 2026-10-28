/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the quiz library
 *
 * The quizzes the user can take: the built-in terminal quiz, whose strings
 * are translated (its texts are message keys), and the quizzes an AI agent
 * made from the user's own files and handed over with the `add-quiz`
 * command (their texts are written out, in whatever language the agent
 * used). This module checks what an agent sends before anything is kept,
 * and says plainly what to fix, since the message goes back to the agent.
 *
 * The library's index lists each quiz once: its id, title, how many
 * questions it has, when it was added, the best score so far, and
 * `removed` once the user or an agent removes it. A removed quiz is only
 * marked, never deleted, so it can be brought back. Pure: no Tilefold calls.
 */
import { QUESTIONS } from "./questions.js";

/** The built-in quiz's id. */
export const BUILTIN_ID = "terminal";

/** What a quiz from an agent may hold. */
export const LIMITS = Object.freeze({
  title: 80,
  questions: 30,
  question: 240,
  choice: 120,
  why: 240,
  minChoices: 2,
  maxChoices: 6,
  quizzes: 50,
});

/**
 * @typedef {{ text: string, why: string, choices: string[], answer: number }} QuizQuestion
 * @typedef {{ id: string, title: string, builtin?: boolean, questions: QuizQuestion[] }} Quiz
 * @typedef {{ id: string, title: string, count: number, added: string, best: number | null, removed?: boolean }} IndexEntry
 */

/** The built-in quiz: its title and texts are message keys. */
export function builtinQuiz() {
  return {
    id: BUILTIN_ID,
    title: "quiz-title",
    builtin: true,
    questions: QUESTIONS.map((q) => ({
      text: q.text,
      why: q.why,
      choices: [...q.choices],
      answer: q.answer,
    })),
  };
}

/** One line of plain text, trimmed, or null when it isn't text or is too long. */
function line(value, max) {
  if (typeof value !== "string") return null;
  const s = value.replace(/\s+/g, " ").trim();
  return s && s.length <= max ? s : null;
}

/** An error whose message tells the agent what to fix. */
const fix = (message) => Object.assign(new Error(message), { name: "TypeError" });

/**
 * A quiz an agent sent, checked and tidied: `{ title, questions }`, each
 * question `{ question, choices, answer, why }`. Throws with what to fix.
 *
 * @param {unknown} input
 * @returns {{ title: string, questions: QuizQuestion[] }}
 */
export function checkQuiz(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw fix("Send an object: { title, questions: [{ question, choices, answer, why }] }.");
  }
  const raw = /** @type {any} */ (input);
  const title = line(raw.title, LIMITS.title);
  if (!title) throw fix(`title must be text of 1 to ${LIMITS.title} characters.`);
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw fix("questions must be a list with at least one question.");
  }
  if (raw.questions.length > LIMITS.questions) {
    throw fix(`A quiz holds at most ${LIMITS.questions} questions; split it into several quizzes.`);
  }
  const questions = raw.questions.map((q, i) => {
    const at = `questions[${i}]`;
    if (!q || typeof q !== "object") throw fix(`${at} must be an object.`);
    const text = line(q.question, LIMITS.question);
    if (!text) throw fix(`${at}.question must be text of 1 to ${LIMITS.question} characters.`);
    if (
      !Array.isArray(q.choices) ||
      q.choices.length < LIMITS.minChoices ||
      q.choices.length > LIMITS.maxChoices
    ) {
      throw fix(`${at}.choices must list ${LIMITS.minChoices} to ${LIMITS.maxChoices} answers.`);
    }
    const choices = q.choices.map((c, j) => {
      const s = line(c, LIMITS.choice);
      if (!s) throw fix(`${at}.choices[${j}] must be text of 1 to ${LIMITS.choice} characters.`);
      return s;
    });
    if (new Set(choices).size !== choices.length) throw fix(`${at}.choices must all differ.`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= choices.length) {
      throw fix(`${at}.answer must be the index (from 0) of the right choice.`);
    }
    const why = line(q.why, LIMITS.why);
    if (!why) throw fix(`${at}.why must explain the answer in 1 to ${LIMITS.why} characters.`);
    return { text, why, choices, answer: q.answer };
  });
  return { title, questions };
}

/** A new quiz id from its title and the time: short, readable, safe as a store key. */
export function quizId(title, now) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${slug || "quiz"}-${now.toString(36)}`;
}

/**
 * The index with the built-in quiz in it, first, the first time round
 * (its entry keeps its best score like any other quiz's).
 */
export function withBuiltin(index) {
  if (index.some((e) => e.id === BUILTIN_ID)) return index;
  const entry = {
    id: BUILTIN_ID,
    title: "quiz-title",
    builtin: true,
    count: QUESTIONS.length,
    added: "",
    best: null,
  };
  return [entry, ...index];
}

/** The quizzes the user can take, in the order added (removed ones left out). */
export const visible = (index) => index.filter((e) => !e.removed);

/** The index entry for a newly added quiz. */
export function entryFor(id, quiz, now) {
  return {
    id,
    title: quiz.title,
    count: quiz.questions.length,
    added: new Date(now).toISOString(),
    best: null,
  };
}

/** The index with a quiz marked removed (only marked: it can come back). */
export const markRemoved = (index, id) =>
  index.map((e) => (e.id === id ? { ...e, removed: true } : e));

/** The index with a quiz brought back. */
export const markRestored = (index, id) =>
  index.map((e) => {
    if (e.id !== id) return e;
    const { removed, ...rest } = e;
    void removed;
    return rest;
  });

/** The index with a new best score for a quiz, if it beats the old one. */
export const withBest = (index, id, score) =>
  index.map((e) =>
    e.id === id && (e.best === null || score > e.best) ? { ...e, best: score } : e,
  );

/** A stored index checked: only well-formed entries are kept. */
export function readIndex(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e) =>
      e &&
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      Number.isInteger(e.count) &&
      typeof e.added === "string" &&
      (e.best === null || Number.isInteger(e.best)),
  );
}

/** A stored quiz checked, or null when it's missing or damaged. */
export function readQuiz(value) {
  try {
    const q = checkQuiz(value && { title: value.title, questions: value.questions?.map(toInput) });
    return q;
  } catch {
    return null;
  }
}

/** A kept question back in the shape an agent sends, to check it again. */
const toInput = (q) => ({ question: q?.text, choices: q?.choices, answer: q?.answer, why: q?.why });
