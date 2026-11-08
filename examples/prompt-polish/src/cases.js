/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the user's own cases
 *
 * Besides its two built-in ways to check a prompt (mistakes only, or also
 * making it read naturally), the user can keep cases of their own, such as
 * "Video editing": a name and instructions for that kind of prompt ("say
 * the clip's length, style and music"). They live in one setting of
 * several lines, written as the user would on paper:
 *
 *   Video editing
 *   Say the clip's length, style and music.
 *
 *   Email to a client
 *   Keep it short and polite.
 *
 * Each case is a block: its name on the first line, its instructions on
 * the lines under it, a blank line between cases. A block with no
 * instructions, or a name seen before, is left out. The card writes the
 * same text back when the user adds, edits or removes a case there, so a
 * blank line inside instructions becomes a single line break.
 *
 * Where Tilefold has list settings (0.1.27), the setting is instead a
 * list of { name, rules }, one case at a time (`CASE_FIELDS`); `casesOf`
 * reads either.
 *
 * Pure: no Tilefold calls.
 */

/** The most cases kept. */
export const MAX_CASES = 20;
/** The longest case name, in characters. */
export const MAX_NAME = 60;
/** The longest instructions, in characters. */
export const MAX_RULES = 2000;
/** The longest the whole setting may be (Tilefold's multiline limit). */
export const MAX_TEXT = 8000;

/*
 * Taken out of names and instructions: C0 controls but tab and newline,
 * DEL and C1 controls, the bidirectional overrides, embeddings and
 * isolates, and the byte order mark.
 */
const UNSAFE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** A case's name, cleaned to one line: no trailing colon, at most MAX_NAME characters. */
export const nameOf = (v) =>
  String(v ?? "")
    .replace(UNSAFE, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:：]$/, "")
    .trim()
    .slice(0, MAX_NAME);

/** Instructions, cleaned: no blank lines inside, at most MAX_RULES characters. */
export const rulesOf = (v) =>
  String(v ?? "")
    .replace(UNSAFE, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .join("\n")
    .trim()
    .slice(0, MAX_RULES);

/**
 * The cases in the setting's text: `[{ name, rules }]`, in order.
 *
 * @param {unknown} text
 */
export function parseCases(text) {
  const out = [];
  const blocks = String(typeof text === "string" ? text : "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[^\S\n]*\n/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;
    const name = nameOf(lines[0]);
    const rules = rulesOf(lines.slice(1).join("\n"));
    if (!name || !rules || out.some((c) => c.name === name)) continue;
    out.push({ name, rules });
    if (out.length === MAX_CASES) break;
  }
  return out;
}

/** The fields of each case where the setting is a list (labels are message keys). */
export const CASE_FIELDS = [
  { key: "name", label: "label-case-name", max: MAX_NAME },
  { key: "rules", label: "label-case-rules", multiline: true, max: MAX_RULES },
];

/** The cases in the setting, a list of { name, rules } or the text of several lines. */
export function casesOf(value) {
  if (!Array.isArray(value)) return parseCases(value);
  const out = [];
  for (const e of value) {
    const name = nameOf(e?.name);
    const rules = rulesOf(e?.rules);
    if (!name || !rules || out.some((c) => c.name === name)) continue;
    out.push({ name, rules });
    if (out.length === MAX_CASES) break;
  }
  return out;
}

/** The setting's text for `cases`. */
export const formatCases = (cases) => cases.map((c) => `${c.name}\n${c.rules}`).join("\n\n");

/**
 * `cases` with case `was` (a name, or null for a new one) saved as
 * `{ name, rules }` (the whole within `maxText` when the setting is one
 * text); or why not: "case-needs-name", "case-needs-rules",
 * "case-name-taken", "case-too-many" or "case-too-long".
 */
export function saveCase(cases, was, input, maxText = MAX_TEXT) {
  const name = nameOf(input?.name);
  const rules = rulesOf(input?.rules);
  if (!name) return { why: "case-needs-name" };
  if (!rules) return { why: "case-needs-rules" };
  if (cases.some((c) => c.name === name && c.name !== was)) return { why: "case-name-taken" };
  const at = was === null ? -1 : cases.findIndex((c) => c.name === was);
  if (at < 0 && cases.length >= MAX_CASES) return { why: "case-too-many" };
  const next =
    at < 0 ? [...cases, { name, rules }] : cases.map((c, i) => (i === at ? { name, rules } : c));
  if (formatCases(next).length > maxText) return { why: "case-too-long" };
  return { cases: next, name };
}

/** `cases` without case `name`. */
export const removeCase = (cases, name) => cases.filter((c) => c.name !== name);
