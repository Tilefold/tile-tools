/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — what the tile keeps
 *
 * Everything the quiz remembers lives in the tile's own store (`tf.store`),
 * so it survives a restart of Tilefold:
 *
 * - `quizzes`: the library's index (see library.js);
 * - `quiz:<id>`: one quiz an agent added, kept whole;
 * - `progress:<id>`: where the user is in that quiz;
 * - `current`: the quiz shown last, or nothing for the list of quizzes;
 * - `appearance`: light or dark, when the user switched it with the
 *   command or the card's button (a choice in Settings clears it);
 * - `placement`: the card or the dock beside the panes, when the user moved
 *   the quiz between them (a choice in Settings clears it).
 *
 * Every read is checked, so a damaged value falls back to a fresh start
 * instead of breaking the tile.
 */
import { BUILTIN_ID, builtinQuiz, readIndex, readQuiz } from "./library.js";
import { readChosen } from "./place.js";
import { restoreQuiz } from "./quiz.js";

export const KEYS = Object.freeze({
  index: "quizzes",
  current: "current",
  appearance: "appearance",
  placement: "placement",
  quiz: (id) => `quiz:${id}`,
  progress: (id) => `progress:${id}`,
});

/** @param {any} tf */
export function createStore(tf) {
  const get = (key) => tf.store.get(key);
  const set = (key, value) => tf.store.set(key, value);

  return {
    async index() {
      return readIndex(await get(KEYS.index));
    },
    saveIndex: (index) => set(KEYS.index, index),

    /** A quiz by id: the built-in one, or one an agent added (null if gone). */
    async quiz(id) {
      if (id === BUILTIN_ID) return builtinQuiz();
      const q = readQuiz(await get(KEYS.quiz(id)));
      return q ? { id, ...q } : null;
    },
    saveQuiz: (id, quiz) => set(KEYS.quiz(id), { title: quiz.title, questions: quiz.questions }),

    async progress(id, total) {
      return restoreQuiz(await get(KEYS.progress(id)), total);
    },
    saveProgress: (id, state) => set(KEYS.progress(id), state),

    async current() {
      const id = await get(KEYS.current);
      return typeof id === "string" && id ? id : null;
    },
    saveCurrent: (id) => (id ? set(KEYS.current, id) : tf.store.delete(KEYS.current)),

    async appearance() {
      const a = await get(KEYS.appearance);
      return a === "light" || a === "dark" ? a : null;
    },
    saveAppearance: (a) => (a ? set(KEYS.appearance, a) : tf.store.delete(KEYS.appearance)),

    async placement() {
      return readChosen(await get(KEYS.placement));
    },
    savePlacement: (p) => (p ? set(KEYS.placement, p) : tf.store.delete(KEYS.placement)),
  };
}
