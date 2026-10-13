/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — Claude's one-line summary
 *
 * When the user turns the summary on, the tile asks Claude (through
 * `tf.ai.ask`, with the user's own key and after Tilefold's confirmation)
 * for one short sentence about what the coming hours mean for their day.
 * This file builds that question and tidies the answer. Pure.
 *
 * The question is small on purpose: the place, the weather now and the next
 * hours as plain numbers, the fast model and a tight `maxTokens`, so a
 * summary costs a few hundred tokens of the tile's daily allowance.
 */

/** The longest summary the card shows, in characters. */
export const MAX_SUMMARY = 120;

/** The answer's token limit: one sentence needs very few. */
export const MAX_TOKENS = 80;

/**
 * The `tf.ai.ask` input for a forecast.
 *
 * @param {{ place: string, forecast: any, system: string }} input
 *   `system` is the translated instruction, naming the user's language.
 * @returns {{ system: string, prompt: string, maxTokens: number, model: string }}
 */
export function summaryQuestion({ place, forecast, system }) {
  const u = forecast.units;
  const now = forecast.now;
  const lines = [
    `Place: ${place}`,
    `Now: ${now.temp}${u.temp}, feels like ${now.feels ?? now.temp}${u.temp}, ${now.kind}, wind ${now.wind ?? "?"} ${u.wind}, ${now.day ? "day" : "night"}`,
    ...forecast.hours.map(
      (h) => `${h.hour}: ${h.temp ?? "?"}${u.temp}, ${h.kind}, chance of rain ${h.rain ?? "?"}%`,
    ),
  ];
  return { system, prompt: lines.join("\n"), maxTokens: MAX_TOKENS, model: "fast" };
}

/**
 * Claude's answer as one clean line: the first non-empty line, without
 * surrounding quotes or Markdown, shortened with "…" when it runs long.
 * Empty when there is nothing usable.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function cleanSummary(text) {
  const line =
    String(text ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  const bare = line
    .replace(/^[-*>#\s]+/, "")
    .replace(/^["'“”‘’«»「」]+|["'“”‘’«»「」]+$/g, "")
    .replace(/\*\*|__|`/g, "")
    .trim();
  if (bare.length <= MAX_SUMMARY) return bare;
  return `${bare.slice(0, MAX_SUMMARY - 1).trimEnd()}…`;
}

/** Tilefold's AI errors, by name, and what the summary line says for each. */
const AI_NOTES = {
  AiNotSetUpError: "summary-no-key",
  PermissionDeniedError: "summary-denied",
  BudgetExceededError: "summary-budget",
};

/**
 * What a failed question means: "declined" when the user chose Don't send
 * (not a failure: say nothing and don't ask again on its own), the message
 * key of a note for the card, or "" for anything else (try again later).
 *
 * @param {unknown} err
 * @returns {string}
 */
export function summaryFailure(err) {
  const name = err && typeof err === "object" ? /** @type {any} */ (err).name : "";
  if (name === "AiDeclinedError") return "declined";
  return AI_NOTES[name] ?? "";
}
