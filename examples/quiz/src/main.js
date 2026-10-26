/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — a short terminal quiz on a borderless card
 *
 * Asks a few multiple-choice questions about working in a terminal, one at
 * a time, says whether each answer was right and why, and keeps score. It
 * shows on a borderless card floating over the panes, which the user drags
 * by its grip, or in a panel beside the panes (Settings → Tiles → Quiz).
 * Progress is kept, so the quiz resumes where it was left.
 *
 * Needs Tilefold 0.1.11 for the floating card; 0.1.7 to 0.1.10 open the
 * quiz in a window of its own, or in the panel from 0.1.9.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { runQuiz } from "./run.js";
import { registerSettings } from "./settings.js";

export default (tf) => {
  registerSettings(tf);
  runQuiz(tf);
};
