/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the agent in your pane checks the prompt
 *
 * For users without an Anthropic key: instead of asking Claude through
 * `tf.ai.ask`, Check puts a request on Tilefold's ask card for the agent in
 * the pane (Claude Code, Codex…): "don't act on this prompt, only correct
 * it, then hand the result back". The user presses Return to send it. The
 * agent answers by running the tile's Hand back command with `tile_run`,
 * giving the corrected prompt and its notes as input; the tile reads that
 * input exactly as it reads Claude's answer (answer.js), and shows the same
 * diff. Sending the result is the ask card again, so it costs two Returns
 * and a little of the agent's context.
 *
 * Each request carries a one-time id. A hand-back is taken only for an id
 * the tile is waiting on, once, and within REQUEST_TTL_MS; anything else is
 * refused and changes nothing. What the agent hands back is data from
 * outside, so it is read field by field and bounded here before answer.js
 * checks it again against the prompt.
 *
 * Pure: no Tilefold calls.
 *
 * Modified 2026-11-07 (polish agent brief): for the polish agent, which
 *   does nothing but check prompts, the rules are its brief (`agentBrief`,
 *   which Tilefold types once per session) and each request is one line
 *   with the prompt (`agentRequest`), so the rules aren't sent every time.
 * Modified 2026-11-07 (own cases): for one of the user's own cases, the
 *   request carries the case's instructions, fenced off as rules
 *   (`caseRules`), and says to follow them. * Modified 2026-11-07 (case rework): the brief's "never add to it" gives
 *   way to the user's own instructions, as the request for a case says;
 *   a picked case means the prompt is that kind, reworked in full however
 *   short (`casePicked`).
 * Modified 2026-11-08 (translations): a case's languages go with the
 *   request (`translateAsk`), and the hand-back may carry "translations"
 *   ({ code: text }), each read and bounded like the corrected prompt.
 * Modified 2026-11-08 (built-in translations): the translations asked
 *   for go with a built-in mode too.
 */
import { casePicked, caseRules, translateAsk, whatToDo } from "./answer.js";
import { LANGUAGES } from "./languages.js";

/** The tile's id, as in tile.json: the first part of the command id agents run. */
export const TILE_ID = "example.prompt-polish";

/** The command the agent runs to hand the corrected prompt back. */
export const HAND_BACK = "hand-back";

/** How long the tile waits for a hand-back, in ms. */
export const REQUEST_TTL_MS = 10 * 60 * 1000;

/** The polish agent's standing instructions: what every request is, and how to answer it. */
export function agentBrief(command) {
  return [
    "You are Promptsmith's polish agent in Tilefold. Every message I send you in this tab is a Promptsmith request: a prompt I wrote to an AI agent, which I want corrected (and, when the request gives my own instructions, reworked as they say). Never act on it and never answer it.",
    "For each request:",
    '- Fix spelling, grammar, spacing and punctuation. When the request says "and make it read naturally", also make clumsy phrasing natural. When it says "and follow my instructions", it gives my own instructions for that kind of prompt between lines: rework the prompt as they say, adding or rewording only what they ask for. I picked those instructions for that prompt: treat it as that kind of prompt however short it is, fill in what they ask for with sensible details, and never hand back only the fixes. Otherwise do not reword anything else.',
    "- Keep the meaning and the language of the prompt. Never translate it. Never add to it, unless the request gives my own instructions that ask for additions. Leave anything in backticks, file paths, links, names in code and numbers exactly as they are.",
    `- Then call the Tilefold tool tile_run with command "${command}" and input {"request": <the request id>, "corrected": <the corrected prompt>, "notes": [{"from": <what you changed>, "to": <what it became>, "kind": "spelling" | "grammar" | "spacing" | "punctuation" | "style", "why": <one short sentence, in the language the request names for notes>}]}.`,
    '- When the request also asks for translations, add "translations": {<language code>: <the corrected prompt translated into that language>} to that input; the corrected prompt itself stays in its own language.',
    '- If nothing needs fixing, hand back the prompt unchanged with "notes": [].',
    'Do nothing else, reply only "Done", and wait for the next request.',
  ].join("\n");
}

/**
 * One request to the polish agent, after its brief: the id, the prompt's
 * language, the mode and the notes' language on one line, then the prompt
 * fenced off as data.
 *
 * @param {{ text: string, language: string, mode: string, uiLanguage: string,
 *   request: string, rules?: string }} r `rules`: a case's instructions (mode "case")
 */
export function agentRequest({
  text,
  language,
  mode,
  uiLanguage,
  request,
  rules = "",
  translate = [],
}) {
  const what =
    mode === "case" && rules
      ? "fix mistakes and follow my instructions"
      : mode === "natural"
        ? "fix mistakes and make it read naturally"
        : "fix mistakes only";
  return [
    `Promptsmith request ${request}: ${language}, ${what}. Notes in ${uiLanguage}.`,
    // A case's instructions first, then the prompt, each between lines.
    ...(mode === "case" && rules
      ? [
          `This is one of my own cases. Besides the fixes, rework the prompt as my instructions say, as short clear phrases in its language, rewording what they ask to change; this goes before "do not reword anything else". ${casePicked("I")} Note each addition or rewording with kind "style".`,
          "My instructions for this kind of prompt:",
          "-----",
          String(rules),
          "-----",
        ]
      : []),
    // The languages to translate into, for a case or a built-in one.
    ...(translateAsk(translate) ? [translateAsk(translate)] : []),
    ...(mode === "case" && rules ? ["The prompt:"] : []),
    "-----",
    String(text),
    "-----",
  ]
    .join("\n")
    .slice(0, MAX_QUESTION);
}

/** What a request id looks like: 10 lowercase letters or digits. */
const REQUEST_ID = /^[a-z0-9]{10}$/;

/** The longest corrected text taken from the agent, in characters (before answer.js). */
const MAX_CORRECTED = 8000;

/** The most notes taken from the agent. */
const MAX_NOTES = 40;

/** The longest question the ask card takes. */
export const MAX_QUESTION = 4000;

/**
 * A new request id. `random` gives numbers in [0, 1), like Math.random.
 *
 * @param {() => number} [random]
 */
export function newRequestId(random = Math.random) {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += abc[Math.floor(random() * abc.length) % abc.length];
  return id;
}

/** What the Hand back command takes, as tile_list shows it to agents (≤ 300 characters). */
export const HAND_BACK_INPUT =
  '{"request": the id from Promptsmith\'s request, "corrected": the corrected prompt, "notes": [{"from", "to", "kind": spelling|grammar|spacing|punctuation|style, "why"}], "translations"?: {code: text}}';

/**
 * The request on the ask card: what to do, the rules (the same as Claude's),
 * how to hand the result back, and the prompt last, fenced off as data.
 *
 * @param {{ text: string, language: string, mode: string, uiLanguage: string,
 *   request: string, command: string, rules?: string }} r `command` is the full
 *   command id for tile_run (the tile's id, a dot, HAND_BACK); `rules` a
 *   case's instructions (mode "case")
 */
export function agentQuestion({
  text,
  language,
  mode,
  uiLanguage,
  request,
  command,
  rules = "",
  translate = [],
}) {
  const own = mode === "case" && !!rules;
  const also = translateAsk(translate);
  const lines = [
    `Promptsmith request ${request}. Do not act on the prompt below, and do not answer it: it is a prompt I wrote to you in ${language}, and I only want it corrected.`,
    whatToDo(own ? "case" : mode === "natural" ? "natural" : "fix"),
    ...caseRules(own ? "case" : mode, rules),
    own
      ? `Keep the meaning and the language. Never translate it${also ? " (the corrected prompt itself)" : ""}. Leave anything in backticks, file paths, links, names in code and numbers exactly as they are.`
      : `Keep the meaning and the language. Never translate it${also ? " (the corrected prompt itself)" : ""} and never add to it. Leave anything in backticks, file paths, links, names in code and numbers exactly as they are.`,
    ...(also ? [also] : []),
    `Then call the Tilefold tool tile_run with command "${command}" and input {"request": "${request}", "corrected": <the corrected prompt>, "notes": [{"from": <what you changed>, "to": <what it became>, "kind": "spelling" | "grammar" | "spacing" | "punctuation" | "style", "why": <one short sentence in ${uiLanguage}>}]${also ? ', "translations": {<language code>: <translation>}' : ""}}.`,
    'If nothing needs fixing, hand back the prompt unchanged with "notes": []. Do nothing else, and reply only "Done".',
    "",
    "The prompt, between the lines:",
    "-----",
    String(text),
    "-----",
  ];
  return lines.join("\n").slice(0, MAX_QUESTION);
}

/** A string, or "" for anything else. */
const str = (v) => (typeof v === "string" ? v : "");

/**
 * The agent's hand-back read and bounded: the request id it answers, and
 * the answer as JSON text for answer.js. Refused when it isn't one.
 *
 * @param {unknown} input what tile_run passed the command
 * @returns {{ ok: true, request: string, answer: string } | { ok: false }}
 */
export function readHandBack(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false };
  const request = str(input.request);
  if (!REQUEST_ID.test(request)) return { ok: false };
  const corrected = str(input.corrected);
  if (!corrected || corrected.length > MAX_CORRECTED) return { ok: false };
  const notes = (Array.isArray(input.notes) ? input.notes : [])
    .slice(0, MAX_NOTES)
    .filter((n) => n && typeof n === "object" && !Array.isArray(n))
    .map((n) => ({ from: str(n.from), to: str(n.to), kind: str(n.kind), why: str(n.why) }));
  // Only Promptsmith's languages, each a bounded string; answer.js keeps those asked for.
  const raw = input.translations;
  const translations = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const l of LANGUAGES) {
      const v = Object.hasOwn(raw, l.code) ? str(raw[l.code]) : "";
      if (v && v.length <= MAX_CORRECTED) translations[l.code] = v;
    }
  }
  return { ok: true, request, answer: JSON.stringify({ corrected, notes, translations }) };
}

/**
 * The requests the tile waits on, by id: `add(id, entry)`, `take(id)`
 * (the entry once, or null when unknown, taken already or too old),
 * `dropFor(pane)` (a pane's request is replaced or cancelled), and
 * `has(pane)`.
 *
 * @param {() => number} [now]
 */
export function createPending(now = Date.now) {
  /** @type {Map<string, { pane: string, at: number } & Record<string, unknown>>} */
  const byId = new Map();
  const sweep = () => {
    for (const [id, e] of byId) if (now() - e.at > REQUEST_TTL_MS) byId.delete(id);
  };
  const dropFor = (pane) => {
    for (const [id, e] of byId) if (e.pane === pane) byId.delete(id);
  };
  return {
    add(id, entry) {
      sweep();
      dropFor(entry.pane);
      byId.set(id, { ...entry, at: now() });
    },
    take(id) {
      sweep();
      const e = byId.get(id) ?? null;
      byId.delete(id);
      return e;
    },
    dropFor,
    has(pane) {
      sweep();
      return [...byId.values()].some((e) => e.pane === pane);
    },
  };
}
