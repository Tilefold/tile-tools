/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz page — keys
 *
 * What a key press on the card does, so the quiz works without the mouse:
 * on the list of quizzes, 1–9 open that quiz; in a quiz, 1–9 or A–I pick
 * that choice while the question is open, Enter goes on once it's answered
 * (or starts over at the end); Escape closes the card.
 * Keys typed with Ctrl, Alt or ⌘ are left alone. Pure: no page calls.
 */

/**
 * The message a key sends to the tile, or null for none.
 *
 * @param {{ key: string, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean }} e
 * @param {any} view the view last drawn, or null before the first
 * @returns {{ type: string, choice?: number } | null}
 */
export function keyAction(e, view) {
  if (!e || e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.key === "Escape") return { type: "close" };
  if (!view) return null;
  if (view.screen === "list") {
    const n = /^[1-9]$/.test(String(e.key)) ? Number(e.key) - 1 : -1;
    const quiz = Array.isArray(view.quizzes) ? view.quizzes[n] : undefined;
    return quiz ? { type: "open-quiz", id: quiz.id } : null;
  }
  if (view.done) return e.key === "Enter" ? { type: "again" } : null;
  if (view.picked !== null && view.picked !== undefined) {
    return e.key === "Enter" ? { type: "next" } : null;
  }
  const count = Array.isArray(view.choices) ? view.choices.length : 0;
  const key = String(e.key);
  let choice = -1;
  if (/^[1-9]$/.test(key)) choice = Number(key) - 1;
  else if (/^[a-i]$/i.test(key)) choice = key.toUpperCase().charCodeAt(0) - 65;
  return choice >= 0 && choice < count ? { type: "pick", choice } : null;
}
