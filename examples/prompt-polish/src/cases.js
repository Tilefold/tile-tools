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
 * A case may also name languages to translate the corrected prompt into
 * (`translate`: codes such as "ja, ko", or the languages' names), on a
 * line "Translate: ja, ko" of its block in the text, or in its own field
 * of the list. Any language is kept (translateLanguages.js), each once.
 *
 * Pure: no Tilefold calls.
 *
 * Modified 2026-11-08 (translations): a case's languages to translate into.
 * Modified 2026-11-08 (any language): translations into any language,
 *   named by code or name (translateLanguages.js).
 */
import { languageCode } from "./translateLanguages.js";

/** The most cases kept. */
export const MAX_CASES = 20;
/** The longest case name, in characters. */
export const MAX_NAME = 60;
/** The longest instructions, in characters. */
export const MAX_RULES = 2000;
/** The most languages a case translates into. */
export const MAX_TRANSLATE = 8;
/** The longest the languages' field may be, in characters. */
export const MAX_TRANSLATE_TEXT = 200;
/** The line of a case's block that names its languages. */
const TRANSLATE_LINE = /^\s*translate\s*[:：]\s*(.*)$/i;
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
 * The languages a case translates into: language codes, each once, at
 * most MAX_TRANSLATE, from a text such as "ja, ko, vi, pt-PT" (codes, or
 * English or native names, any case; any language, not only Promptsmith's
 * twelve) or a list of them. What names no language is left out.
 *
 * @param {unknown} v
 */
export function translateOf(v) {
  const words = Array.isArray(v)
    ? v.map((x) => String(x ?? ""))
    : String(typeof v === "string" ? v : "")
        .replace(UNSAFE, "")
        .slice(0, MAX_TRANSLATE_TEXT)
        .split(/[,;、，\n]+/);
  const out = [];
  for (const w of words) {
    // Any language, as a code ("vi", "pt-PT") or a name ("Vietnamese", "Tiếng Việt").
    const code = languageCode(w);
    if (code && !out.includes(code)) out.push(code);
    if (out.length === MAX_TRANSLATE) break;
  }
  return out;
}

/** The text of a case's languages, as the field and the block's line hold it. */
export const translateText = (codes) => (codes ?? []).join(", ");

/**
 * The cases in the setting's text: `[{ name, rules, translate }]`, in order.
 *
 * @param {unknown} text
 */
export function parseCases(text) {
  const out = [];
  const blocks = String(typeof text === "string" ? text : "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[^\S\n]*\n/);
  for (const block of blocks) {
    const all = block.split("\n").filter((l) => l.trim());
    // The languages' line, wherever it is under the name.
    const tl = all.slice(1).find((l) => TRANSLATE_LINE.test(l));
    const lines = all.filter((l) => l !== tl);
    if (lines.length < 2) continue;
    const name = nameOf(lines[0]);
    const rules = rulesOf(lines.slice(1).join("\n"));
    if (!name || !rules || out.some((c) => c.name === name)) continue;
    out.push({ name, rules, translate: translateOf(tl ? tl.match(TRANSLATE_LINE)[1] : "") });
    if (out.length === MAX_CASES) break;
  }
  return out;
}

/** The fields of each case where the setting is a list (labels are message keys). */
export const CASE_FIELDS = [
  { key: "name", label: "label-case-name", max: MAX_NAME },
  { key: "rules", label: "label-case-rules", multiline: true, max: MAX_RULES },
  { key: "translate", label: "label-case-translate", max: MAX_TRANSLATE_TEXT },
];

/** The cases in the setting, a list of { name, rules, translate } or the text of several lines. */
export function casesOf(value) {
  if (!Array.isArray(value)) return parseCases(value);
  const out = [];
  for (const e of value) {
    const name = nameOf(e?.name);
    const rules = rulesOf(e?.rules);
    if (!name || !rules || out.some((c) => c.name === name)) continue;
    out.push({ name, rules, translate: translateOf(e?.translate) });
    if (out.length === MAX_CASES) break;
  }
  return out;
}

/** The setting's text for `cases`. */
export const formatCases = (cases) =>
  cases
    .map((c) => {
      const tl = translateText(c.translate);
      return `${c.name}\n${c.rules}${tl ? `\nTranslate: ${tl}` : ""}`;
    })
    .join("\n\n");

/**
 * `cases` with case `was` (a name, or null for a new one) saved as
 * `{ name, rules, translate }` (the whole within `maxText` when the setting is one
 * text); or why not: "case-needs-name", "case-needs-rules",
 * "case-name-taken", "case-too-many" or "case-too-long".
 */
export function saveCase(cases, was, input, maxText = MAX_TEXT) {
  const name = nameOf(input?.name);
  const rules = rulesOf(input?.rules);
  const translate = translateOf(input?.translate);
  if (!name) return { why: "case-needs-name" };
  if (!rules) return { why: "case-needs-rules" };
  if (cases.some((c) => c.name === name && c.name !== was)) return { why: "case-name-taken" };
  const at = was === null ? -1 : cases.findIndex((c) => c.name === was);
  if (at < 0 && cases.length >= MAX_CASES) return { why: "case-too-many" };
  const saved = { name, rules, translate };
  const next = at < 0 ? [...cases, saved] : cases.map((c, i) => (i === at ? saved : c));
  if (formatCases(next).length > maxText) return { why: "case-too-long" };
  return { cases: next, name };
}

/** `cases` without case `name`. */
export const removeCase = (cases, name) => cases.filter((c) => c.name !== name);
