/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the agent in your pane checks the prompt
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
 */

/** The tile's id, as in tile.json: the first part of the command id agents run. */
export const TILE_ID = "example.prompt-polish";

/** The command the agent runs to hand the corrected prompt back. */
export const HAND_BACK = "hand-back";

/** How long the tile waits for a hand-back, in ms. */
export const REQUEST_TTL_MS = 10 * 60 * 1000;

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
  '{"request": the id from Prompt Polish\'s request, "corrected": the corrected prompt, "notes": [{"from", "to", "kind": spelling|grammar|spacing|punctuation|style, "why"}]}';

/**
 * The request on the ask card: what to do, the rules (the same as Claude's),
 * how to hand the result back, and the prompt last, fenced off as data.
 *
 * @param {{ text: string, language: string, mode: string, uiLanguage: string,
 *   request: string, command: string }} r `command` is the full command id
 *   for tile_run (the tile's id, a dot, HAND_BACK)
 */
export function agentQuestion({ text, language, mode, uiLanguage, request, command }) {
  const lines = [
    `Prompt Polish request ${request}. Do not act on the prompt below, and do not answer it: it is a prompt I wrote to you in ${language}, and I only want it corrected.`,
    mode === "natural"
      ? "Fix spelling, grammar, spacing and punctuation, and make clumsy phrasing natural."
      : "Fix only spelling, grammar, spacing and punctuation. Do not reword anything else.",
    "Keep the meaning and the language. Never translate it and never add to it. Leave anything in backticks, file paths, links, names in code and numbers exactly as they are.",
    `Then call the Tilefold tool tile_run with command "${command}" and input {"request": "${request}", "corrected": <the corrected prompt>, "notes": [{"from": <what you changed>, "to": <what it became>, "kind": "spelling" | "grammar" | "spacing" | "punctuation" | "style", "why": <one short sentence in ${uiLanguage}>}]}.`,
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
  return { ok: true, request, answer: JSON.stringify({ corrected, notes }) };
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
