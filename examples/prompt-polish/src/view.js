/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — what the page is sent
 *
 * The page draws what the tile sends and says what the user did; it keeps
 * nothing of its own. `setupOf` is sent once when the page says hello: its
 * language, direction and every label. `viewOf` is sent on every change:
 * the step (write, checking, result, sent, problem) with what it shows.
 * All text is already in the user's language. Pure: no Tilefold calls.
 */
import { isUnspaced } from "./languages.js";
import { MAX_CHARS, changeCount } from "./polish.js";

/** The label of each kind of fix. */
const KIND_KEYS = {
  spelling: "kind-spelling",
  grammar: "kind-grammar",
  spacing: "kind-spacing",
  punctuation: "kind-punctuation",
  style: "kind-style",
};

/**
 * What the page needs once: its language and direction, and its labels.
 *
 * @param {(key: string, args?: object) => string} t
 */
export function setupOf(t) {
  return {
    lang: t("page-lang"),
    dir: t("page-dir"),
    labels: {
      name: t("button-label"),
      views: {
        bottom: t("setting-view-bottom"),
        corner: t("setting-view-corner"),
        side: t("setting-view-side"),
      },
      overPane: t("label-over-pane"),
      inDock: t("label-in-dock"),
      fold: t("label-fold"),
      close: t("label-close"),
      hint: t("label-hint"),
      asIs: t("label-as-is"),
      check: t("label-check"),
      showResult: t("label-show-result"),
      showChanges: t("label-show-changes"),
      clickHint: t("label-click-hint"),
      back: t("label-back"),
      send: t("label-send"),
      sent: t("label-sent"),
      again: t("label-again"),
      words: t("label-words", { count: "{count}" }),
      chars: t("label-chars", { count: "{count}" }),
      tooLong: t("label-too-long", { max: MAX_CHARS }),
    },
  };
}

/**
 * The page's view now.
 *
 * @param {object} s the tile's state: step, draft, parts, notes, rejected,
 *   clean, problem (a message key), view, language, mode
 * @param {(key: string, args?: object) => string} t
 */
export function viewOf(s, t) {
  const lang = s.language;
  const head = {
    view: s.view,
    language: lang.native,
    mode: s.mode === "natural" ? t("setting-mode-natural") : t("setting-mode-fix"),
    unspaced: isUnspaced(lang.code),
    langCode: lang.code,
  };
  if (s.step === "checking") {
    return { ...head, step: "checking", text: t("label-checking", { language: lang.native }) };
  }
  if (s.step === "problem") {
    return { ...head, step: "problem", text: t(s.problem) };
  }
  if (s.step === "sent") return { ...head, step: "sent" };
  if (s.step === "result") {
    const total = changeCount(s.parts);
    const undone = s.parts.filter((p) => p.id && s.rejected.has(p.id)).length;
    if (!total) {
      return {
        ...head,
        step: "result",
        nothing: t("label-nothing", { language: lang.native }),
        parts: [],
        notes: [],
      };
    }
    return {
      ...head,
      step: "result",
      summary: t("label-changes", { count: total }),
      undone: undone ? t("label-undone", { count: undone }) : "",
      clean: !!s.clean,
      parts: s.parts.map((p) =>
        "same" in p
          ? { same: p.same }
          : { id: p.id, del: p.del, ins: p.ins, off: s.rejected.has(p.id) },
      ),
      notes: s.notes.map((n) => ({ ...n, kindLabel: t(KIND_KEYS[n.kind] ?? "kind-grammar") })),
    };
  }
  return {
    ...head,
    step: "write",
    draft: s.draft,
    placeholder: t("label-placeholder", { language: lang.native }),
  };
}
