/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the questions
 *
 * A short quiz about working in a terminal. Each question names its
 * strings by key (translated in locales/<language>/tile.ftl): `text`, the
 * question, and `why`, the explanation shown once it's answered. The
 * choices are commands and symbols, the same in every language, so they
 * are written here. `answer` is the index of the right choice.
 *
 * To make your own quiz, replace this list (and the strings it names):
 * nothing else in the tile depends on what the questions are or how many.
 */

/**
 * @typedef {{ id: string, text: string, why: string, choices: string[], answer: number }} Question
 */

/** @type {readonly Question[]} */
export const QUESTIONS = Object.freeze([
  {
    id: "pipe",
    text: "q-pipe",
    why: "q-pipe-why",
    choices: ["|", ">", "&", ";"],
    answer: 0,
  },
  {
    id: "append",
    text: "q-append",
    why: "q-append-why",
    choices: [">", ">>", "<", "2>"],
    answer: 1,
  },
  {
    id: "status",
    text: "q-status",
    why: "q-status-why",
    choices: ["$!", "$#", "$?", "$$"],
    answer: 2,
  },
  {
    id: "background",
    text: "q-background",
    why: "q-background-why",
    choices: ["&", "&&", "||", "!"],
    answer: 0,
  },
  {
    id: "and",
    text: "q-and",
    why: "q-and-why",
    choices: [
      "make; make install",
      "make || make install",
      "make && make install",
      "make | make install",
    ],
    answer: 2,
  },
  {
    id: "history",
    text: "q-history",
    why: "q-history-why",
    choices: ["Ctrl+R", "Ctrl+C", "Ctrl+D", "Ctrl+Z"],
    answer: 0,
  },
]);
