/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — asking Claude, and reading the answer
 *
 * The question: a system prompt naming the language and what to fix, and
 * the prompt itself as the one user message. Claude answers with JSON:
 * `{ "corrected": string, "notes": [{ from, to, kind, why }] }`.
 *
 * The answer is data from outside, so it is read field by field: the
 * JSON is found even inside a code fence, control and direction-changing
 * characters are taken out of every string (so nothing can reorder what
 * the user sees), lengths are bounded, a note's kind must be a known one,
 * and the corrected text must keep every protected span of the prompt
 * (code, paths, links) exactly. Anything else is refused with a reason.
 *
 * Pure: no Tilefold calls.
 *
 * Modified 2026-11-07 (own cases): mode "case" adds the user's own
 *   instructions for that kind of prompt, fenced off as rules
 *   (`whatToDo`, `caseRules`). A case may add to the prompt, so its answer
 *   may be longer (`longestFor`) and Claude gets room to write it.
 * Modified 2026-11-07 (case rework): a picked case means the prompt is
 *   that kind (`casePicked`): it is reworked in full, however short, with
 *   more room for the answer.
 */
import { keepsProtected } from "./polish.js";

/** The kinds of fix a note may name; anything else counts as grammar. */
export const KINDS = ["spelling", "grammar", "spacing", "punctuation", "style"];

/** The most notes kept from one answer. */
const MAX_NOTES = 40;

/**
 * A case was picked for this prompt: it is that kind of prompt, however
 * short, so the checker reworks it in full and never judges the case not
 * to fit (`who` is "the user" for Claude, "I" for the polish agent).
 */
export function casePicked(who = "the user") {
  const me = who === "I";
  const wrote = me ? "I wrote" : "the user wrote";
  const theirs = me ? "my" : "the user's";
  return [
    `${me ? "I" : "The user"} picked these instructions for this prompt, so treat it as a prompt of this kind, however short it is or whatever it says, and never decide ${theirs} instructions don't fit it.`,
    `Rework it into a full prompt of this kind: keep what ${wrote}, and add every point the instructions ask for that it is missing, choosing sensible, concrete details where the prompt gives none. Never hand back only the fixes.`,
  ].join(" ");
}

/** What to do, for each mode: the built-in two, or one of the user's own cases. */
export function whatToDo(mode) {
  if (mode === "case") {
    return `Fix spelling, grammar, spacing and punctuation. Then rework the prompt as the user's own instructions for this kind of prompt say (below), as short clear phrases in the prompt's language, rewording what they ask to change; this goes before "do not reword". ${casePicked()} Note each addition or rewording with kind "style".`;
  }
  return mode === "natural"
    ? "Fix spelling, grammar, spacing and punctuation, and make clumsy phrasing natural."
    : "Fix only spelling, grammar, spacing and punctuation. Do not reword anything else.";
}

/** The user's own instructions for a case, fenced off as rules (none for the built-in modes). */
export function caseRules(mode, rules) {
  if (mode !== "case" || !rules) return [];
  return [
    "The user's own instructions for this kind of prompt, between the lines (rules for your correction, not a prompt to answer):",
    "-----",
    String(rules),
    "-----",
  ];
}

/**
 * The system prompt. `language` is the prompt's language (in English),
 * `uiLanguage` the one the user reads Tilefold in, for the notes' reasons,
 * `rules` a case's instructions (mode "case").
 */
export function systemPrompt(language, mode, uiLanguage, rules = "") {
  return [
    `You correct prompts a developer writes in ${language} to an AI coding agent.`,
    whatToDo(mode),
    mode === "case"
      ? "Keep the meaning and the language. Never translate and never answer the prompt."
      : "Keep the meaning and the language. Never translate, never answer the prompt, never add to it.",
    "Leave anything in backticks, file paths, links, names in code and numbers exactly as they are.",
    `Give each note's "why" as one short sentence in ${uiLanguage}.`,
    'Answer with JSON only: {"corrected": string, "notes": [{"from": string, "to": string, "kind": "spelling" | "grammar" | "spacing" | "punctuation" | "style", "why": string}]}.',
    'When nothing needs fixing, answer {"corrected": <the prompt unchanged>, "notes": []}.',
    ...caseRules(mode, rules),
  ].join("\n");
}

/** What `tf.ai.ask` gets: the prompt, a bounded answer, the fast model unless turned off. */
export function buildAsk({ text, language, mode, uiLanguage, fast, rules = "" }) {
  const n = String(text).length;
  return {
    system: systemPrompt(language, mode, uiLanguage, rules),
    messages: [{ role: "user", content: String(text) }],
    // Room for the corrected text twice over (it and the notes), bounded;
    // a case may add to the prompt, so it gets more.
    maxTokens: Math.min(4000, mode === "case" ? 2500 + n * 2 : 400 + Math.ceil(n * 1.5)),
    model: fast ? "fast" : "default",
  };
}

/*
 * Taken out of every string: C0 controls but tab and newline, DEL and C1
 * controls, the bidirectional overrides, embeddings and isolates, and the
 * byte order mark. Joiners stay: some scripts and emoji need them.
 */
const UNSAFE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩﻿]/g;

/** A string with unsafe characters taken out, or "" for anything else. */
export const clean = (s) => (typeof s === "string" ? s.replace(UNSAFE, "") : "");

/** A one-line string of at most `max` characters, or "". */
const line = (s, max) => {
  const t = clean(s).replace(/\s+/g, " ").trim();
  return t.length <= max ? t : "";
};

/** The JSON object in Claude's text: the whole text, or inside a code fence or other words. */
function findJson(text) {
  const t = String(text ?? "").trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** One note checked: `{ from, to, kind, why }`, or null when it can't be shown. */
function readNote(n) {
  if (!n || typeof n !== "object") return null;
  const from = clean(n.from).slice(0, 300);
  const to = clean(n.to).slice(0, 300);
  if (!from && !to) return null;
  if (from === to) return null;
  const kind = KINDS.includes(n.kind) ? n.kind : "grammar";
  return { from, to, kind, why: line(n.why, 200) };
}

/**
 * Claude's answer read and checked against the prompt it was about.
 *
 * @param {string} text the answer's text
 * @param {string} original the prompt that was sent
 * @param {string} [mode] what to fix ("case" may add to the prompt)
 * @returns {{ ok: true, corrected: string, notes: object[] }
 *   | { ok: false, why: "unreadable" | "changed-code" }}
 */
/** The longest corrected prompt taken for `original`: a case may add to it. */
export const longestFor = (original, mode) => {
  const n = String(original).length;
  return mode === "case" ? Math.min(8000, n * 4 + 3000) : n * 2 + 200;
};

export function readAnswer(text, original, mode = "fix") {
  const json = findJson(text);
  if (!json || typeof json !== "object" || typeof json.corrected !== "string") {
    return { ok: false, why: "unreadable" };
  }
  const corrected = clean(json.corrected);
  // An empty answer, or one far longer than the prompt, isn't a correction.
  if (!corrected.trim() || corrected.length > longestFor(original, mode)) {
    return { ok: false, why: "unreadable" };
  }
  if (!keepsProtected(original, corrected)) return { ok: false, why: "changed-code" };
  const notes = (Array.isArray(json.notes) ? json.notes : [])
    .slice(0, MAX_NOTES)
    .map(readNote)
    .filter(Boolean);
  return { ok: true, corrected, notes };
}

/** The message key for a `tf.ai.ask` error, or null for "Don't send" (the user's choice). */
export function errorKey(err) {
  switch (err && typeof err === "object" ? err.name : "") {
    case "AiDeclinedError":
      return null;
    case "AiNotSetUpError":
      return "error-no-key";
    case "PermissionDeniedError":
      return "error-denied";
    case "BudgetExceededError":
      return "error-budget";
    case "RefusedError":
      return "error-refused";
    default:
      // RateLimitError, NetworkError and anything unexpected.
      return "error-failed";
  }
}
