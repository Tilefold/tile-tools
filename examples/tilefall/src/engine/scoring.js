/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Score and gravity
 *
 * Calculates line-clear points, levels, and falling intervals.
 */

const CLEAR_POINTS = [0, 100, 300, 500, 800];

/** Points for one lock, using the level before its cleared lines count. */
export function clearScore(lines, level) {
  return CLEAR_POINTS[lines] * level;
}

/** Distance points are earned only for rows actually descended. */
export function dropScore(rows, hard = false) {
  return rows * (hard ? 2 : 1);
}

/** Every ten total cleared lines advances one level from the chosen start. */
export function levelForLines(lines, startLevel = 1) {
  return startLevel + Math.floor(lines / 10);
}

/** Guideline gravity in milliseconds, with a playable lower bound. */
export function gravityMs(level) {
  return Math.max(30, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000);
}
