/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — quizzes on a borderless card
 *
 * Multiple-choice quizzes, one question at a time: says whether each answer
 * was right and why, keeps score and the best score. A short terminal quiz
 * comes with it; AI agents in the user's panes add more, made from the
 * user's own files. It shows on a borderless card floating over the panes,
 * light or dark, which the user drags by its grip, or in a panel beside the
 * panes (Settings → Tiles → Quiz). Each quiz resumes where it was left.
 *
 * Needs Tilefold 0.1.11 for the floating card and 0.1.14 for agents'
 * quizzes; 0.1.7 to 0.1.10 open the quiz in a window of its own, or in the
 * panel from 0.1.9.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { runQuiz } from "./run.js";
import { registerSettings } from "./settings.js";

export default (tf) => {
  registerSettings(tf);
  runQuiz(tf);
};
