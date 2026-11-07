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
 * the step (write, checking, agent, result, sent, problem) with what it
 * shows. All text is already in the user's language. Pure: no Tilefold
 * calls.
 *
 * Modified 2026-11-06 (no-key mode): the `agent` step (waiting for the
 *   agent in the pane), and a problem that can offer to ask it instead.
 * Modified 2026-11-06 (input actions): `input` (the prompt came from the
 *   agent input box, so the result offers Use and Keep mine); their labels.
 * Modified 2026-11-06 (polish agent): waiting for the polish agent, named
 *   (`helper`, `helperName`).
 */
import { isUnspaced } from "./languages.js";
import { MAX_CHARS, changeCount } from "./polish.js";

/** Problems the agent in the pane can get around: no Claude, or no key for it. */
const AGENT_CAN_HELP = new Set(["error-no-ai", "error-no-key"]);

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
      cancel: t("label-cancel"),
      askAgent: t("label-ask-agent"),
      use: t("label-use"),
      keep: t("label-keep"),
      agentHint: t("label-agent-hint"),
      words: t("label-words", { count: "{count}" }),
      chars: t("label-chars", { count: "{count}" }),
      tooLong: t("label-too-long", { max: MAX_CHARS }),
    },
  };
}

/**
 * The page's view now.
 *
 * @param {object} s one pane's session (step, draft, parts, notes, rejected,
 *   clean, problem: a message key) with its pane id, the view, language and mode
 * @param {(key: string, args?: object) => string} t
 */
export function viewOf(s, t) {
  const lang = s.language;
  const head = {
    // Whose prompt this is: the page sends it back with what the user does.
    pane: typeof s.pane === "string" ? s.pane : null,
    view: s.view,
    language: lang.native,
    mode: s.mode === "natural" ? t("setting-mode-natural") : t("setting-mode-fix"),
    unspaced: isUnspaced(lang.code),
    langCode: lang.code,
    // From the agent input box: Use puts the result back there.
    input: !!s.input,
  };
  if (s.step === "checking") {
    return { ...head, step: "checking", text: t("label-checking", { language: lang.native }) };
  }
  if (s.step === "agent") {
    const text = s.helper
      ? t("label-helper-waiting", { language: lang.native, agent: s.helperName ?? "" })
      : t("label-agent-waiting", { language: lang.native });
    return { ...head, step: "agent", text };
  }
  if (s.step === "problem") {
    // With a prompt to check, the agent in the pane can do it instead.
    const offer = AGENT_CAN_HELP.has(s.problem) && !!String(s.draft ?? "").trim();
    return { ...head, step: "problem", text: t(s.problem), askAgent: offer };
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
