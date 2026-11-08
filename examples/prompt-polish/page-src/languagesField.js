/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith page — the languages to translate into
 *
 * The field of a case's form (the user's own or a built-in one) where the
 * user names the languages the corrected prompt is also translated into:
 * any language, as codes or names, separated by commas. Under it, a line
 * on how to name them, and, as the user types, what the field reads: each
 * language with its own name and code ("Tiếng Việt · vi"), what it doesn't
 * recognize, and a note past the eighth. Read the same way as the tile
 * reads it (translateLanguages.js). Text is set with textContent only.
 */
import { languageCode, shownName } from "../src/translateLanguages.js";

/** The most languages a case translates into. */
const MAX = 8;

/**
 * What `text` names: the languages' codes (each once) and the words that
 * name none.
 *
 * @param {string} text
 */
export function readLanguages(text) {
  const codes = [];
  const unknown = [];
  for (const w of String(text)
    .slice(0, 200)
    .split(/[,;、，\n]+/)) {
    const word = w.trim();
    if (!word) continue;
    const code = languageCode(word);
    if (!code) unknown.push(word);
    else if (!codes.includes(code)) codes.push(code);
  }
  return { codes, unknown };
}

/**
 * The field with its label, help and what it reads, as one element.
 *
 * @param {any} L the labels
 * @param {(tag: string, className?: string, text?: string) => HTMLElement} el
 * @param {string} value what the field holds now
 */
export function languagesField(L, el, value) {
  const input = el("input");
  Object.assign(input, { name: "translate", type: "text", maxLength: 200, value, dir: "ltr" });
  input.placeholder = L.caseTranslateHint;
  const wrap = el("label", "case-field");
  const help = el("span", "muted tl-help", L.caseTranslateHelp);
  const reads = el("span", "tl-reads");
  reads.setAttribute("aria-live", "polite");
  wrap.append(el("span", "muted", L.caseTranslate), input, help, reads);
  const show = () => {
    const { codes, unknown } = readLanguages(input.value);
    const parts = [];
    if (codes.length) {
      parts.push(`${L.translatePreview} ${codes.slice(0, MAX).map(shownName).join(", ")}`);
    }
    if (codes.length > MAX) parts.push(L.translateTooMany);
    if (unknown.length) {
      parts.push(String(L.translateUnknown).replace("{words}", unknown.join(", ")));
    }
    reads.textContent = parts.join(" ");
    reads.classList.toggle("warn", unknown.length > 0 || codes.length > MAX);
  };
  input.addEventListener("input", show);
  show();
  return { wrap, input };
}
