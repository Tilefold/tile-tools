/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Agent Pack — an agent of the user's own
 *
 * The draft the user builds in the panel (a name, a command, what clears
 * its context) and the checks it must pass before it is offered to
 * Tilefold. The checks are the same ones Tilefold makes, so the user hears
 * what to fix while typing, not after a refusal; Tilefold still checks
 * again and has the last word. Pure functions.
 */

/** Longest name Tilefold keeps for an agent. */
export const MAX_NAME = 60;
/** Most words after the program in a command. */
export const MAX_ARGS = 16;
/** Longest single word of a command. */
export const MAX_WORD = 256;
/** What clears an agent's context, in the order a click on that row steps through. */
export const CLEARS = ["/clear", "/new", ""];

/** A word a shell never treats as special. */
const SAFE_WORD = /^[A-Za-z0-9._,:=@%+/~-]+$/;
/** What may hide or reorder text: controls, line separators, bidi controls, the BOM. */
const HIDDEN = new RegExp(
  "[\\u0000-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]",
);

/** Longest text kept from a field (Tilefold sends at most this much). */
export const MAX_TYPED = 4096;

/**
 * Text as kept from a field: a string cut to MAX_TYPED, anything else "".
 *
 * @param {unknown} text
 */
export const typed = (text) => (typeof text === "string" ? text.slice(0, MAX_TYPED) : "");

/**
 * `text` with hidden characters removed, for showing it back to the user.
 *
 * @param {string} text
 */
export const visible = (text) => text.replace(new RegExp(HIDDEN.source, "g"), "");

/** A new, empty draft. */
export const emptyDraft = () => ({ name: "", command: "", clear: "/clear" });

/**
 * Why `name` can't be used (a message key), or null when it can.
 *
 * @param {string} name
 */
export function nameProblem(name) {
  const n = name.trim();
  if (!n) return "own-problem-name-empty";
  if ([...n].length > MAX_NAME || HIDDEN.test(n)) return "own-problem-name";
  return null;
}

/**
 * The words of `command`, separated by spaces.
 *
 * @param {string} command
 */
export const commandWords = (command) => command.trim().split(/\s+/).filter(Boolean);

/**
 * Why `command` can't be used (a message key), or null when it can.
 *
 * @param {string} command
 */
export function commandProblem(command) {
  const words = commandWords(command);
  if (words.length === 0) return "own-problem-command-empty";
  if (words.length > MAX_ARGS + 1) return "own-problem-command-long";
  if (words.some((w) => w.length > MAX_WORD || !SAFE_WORD.test(w))) {
    return "own-problem-command-chars";
  }
  return null;
}

/**
 * The next way to clear the context after `clear`, for a click on its row.
 *
 * @param {string} clear
 */
export const nextClear = (clear) => CLEARS[(CLEARS.indexOf(clear) + 1) % CLEARS.length];

/**
 * The first problem with the draft as a message key, or null when it can
 * be offered. A part not typed yet counts as a problem too.
 *
 * @param {{ name: string, command: string }} draft
 */
export const draftProblem = (draft) => nameProblem(draft.name) ?? commandProblem(draft.command);

/**
 * What `tf.agent.define` takes for the draft: the name trimmed, the
 * command's words joined by single spaces.
 *
 * @param {{ name: string, command: string, clear: string }} draft
 */
export const toDefinition = (draft) => ({
  name: draft.name.trim(),
  command: commandWords(draft.command).join(" "),
  clear: draft.clear,
});
