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
 * Modified 2026-11-07 (polish agent progress): getting it ready, then
 *   working on it (`helperStage`), with a hint for each and the time since
 *   it got the prompt (`since`, counted on the page).
 * Modified 2026-11-07 (see-through card): `solid`.
 * Modified 2026-11-07 (move and fill): `max` (the card fills the pane) and
 *   the labels to fill, restore and move it; `collapsed` (only its header
 *   bar shows).
 * Modified 2026-11-07 (own cases): what to fix as the card picked it, the
 *   menu's entries (`modes`: the built-in two, then the user's own cases;
 *   `modeId`, the one picked), whether cases can be edited here, and the
 *   `case` step: the form to add or edit a case, over whatever was there.
 * Modified 2026-11-07 (pick before checking): `choose` on the write step,
 *   and the menu's heading for it.
 * Modified 2026-11-07 (case rework): while a case is picked, checking and
 *   waiting name the case, not the language; its result is a `rework`,
 *   whose changes are undone with their own buttons.
 */
import { isUnspaced } from "./languages.js";
import { MAX_CHARS, changeCount } from "./polish.js";

/** Problems the agent in the pane can get around: no Claude, or no key for it. */
const AGENT_CAN_HELP = new Set(["error-no-ai", "error-no-key"]);

/** Each waiting text, as it reads while one of the user's own cases is picked. */
const CASE_KEYS = {
  "label-checking": "label-checking-case",
  "label-agent-waiting": "label-agent-waiting-case",
  "label-helper-working": "label-helper-working-case",
};

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
      fill: t("label-fill"),
      restore: t("label-restore"),
      move: t("label-move"),
      close: t("label-close"),
      hint: t("label-hint"),
      asIs: t("label-as-is"),
      check: t("label-check"),
      showResult: t("label-show-result"),
      showChanges: t("label-show-changes"),
      clickHint: t("label-click-hint"),
      // A case's rework: each change has its own button to undo or bring it back.
      clickHintRework: t("label-click-hint-rework"),
      undoChange: t("label-undo-change"),
      restoreChange: t("label-restore-change"),
      back: t("label-back"),
      send: t("label-send"),
      sent: t("label-sent"),
      again: t("label-again"),
      cancel: t("label-cancel"),
      askAgent: t("label-ask-agent"),
      use: t("label-use"),
      keep: t("label-keep"),
      agentHint: t("label-agent-hint"),
      // The time a check has taken; the page puts the seconds in place of {n}.
      elapsed: t("label-elapsed", { seconds: "{n}" }),
      words: t("label-words", { count: "{count}" }),
      chars: t("label-chars", { count: "{count}" }),
      tooLong: t("label-too-long", { max: MAX_CHARS }),
      // What to fix: the chip's menu and the form for the user's own cases.
      modeMenu: t("label-mode-menu"),
      modeChoose: t("label-mode-choose"),
      addCase: t("label-add-case"),
      editCase: t("label-edit-case", { name: "{name}" }),
      casesInSettings: t("label-cases-in-settings"),
      caseNew: t("label-case-new"),
      caseEdit: t("label-case-edit"),
      caseName: t("label-case-name"),
      caseRules: t("label-case-rules"),
      caseRulesHint: t("label-case-rules-hint"),
      caseSave: t("label-case-save"),
      caseRemove: t("label-case-remove"),
    },
  };
}

/** What to fix, as the chip says it: a case's own name, else the mode's label. */
function modeLabel(s, t) {
  if (typeof s.modeId === "string" && s.modeId.startsWith("case:") && s.caseName) return s.caseName;
  const id = typeof s.modeId === "string" ? s.modeId : s.mode;
  return id === "natural" ? t("setting-mode-natural") : t("setting-mode-fix");
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
    // What to fix, as the card picked it (a case shows its own name).
    mode: modeLabel(s, t),
    modeId: typeof s.modeId === "string" ? s.modeId : s.mode === "natural" ? "natural" : "fix",
    modes: [
      { id: "fix", label: t("setting-mode-fix") },
      { id: "natural", label: t("setting-mode-natural") },
      ...(Array.isArray(s.cases) ? s.cases : []).map((name) => ({
        id: `case:${name}`,
        label: name,
      })),
    ],
    canEditCases: !!s.canEditCases,
    unspaced: isUnspaced(lang.code),
    langCode: lang.code,
    // From the agent input box: Use puts the result back there.
    input: !!s.input,
    // How solid the card's background is over the pane (100: not see-through).
    solid: Number.isFinite(s.solid) ? s.solid : 100,
    // The card fills the pane (its ▢ button is pressed).
    max: !!s.max,
    // Folded to its header bar.
    collapsed: !!s.collapsed,
  };
  // The form to add or edit a case shows over whatever step was there.
  if (s.editing) {
    const e = s.editing;
    return {
      ...head,
      step: "case",
      was: typeof e.was === "string" ? e.was : null,
      name: String(e.name ?? ""),
      rules: String(e.rules ?? ""),
      why: e.why ? t(e.why) : "",
    };
  }
  // While a case is picked, the waiting text names it rather than the language.
  const own = String(head.modeId).startsWith("case:") && s.caseName ? s.caseName : "";
  const waitText = (key, args = {}) =>
    own ? t(CASE_KEYS[key], { ...args, name: own }) : t(key, { ...args, language: lang.native });
  if (s.step === "checking") {
    return { ...head, step: "checking", text: waitText("label-checking") };
  }
  if (s.step === "agent") {
    if (!s.helper) {
      const text = waitText("label-agent-waiting");
      return { ...head, step: "agent", text, hint: t("label-agent-hint"), since: null };
    }
    // The polish agent: getting ready (it may be asking the user something
    // in its tab), then working on it, with the time since it got the prompt.
    const agent = s.helperName ?? "";
    const working = s.helperStage === "working";
    return {
      ...head,
      step: "agent",
      text: working
        ? waitText("label-helper-working", { agent })
        : t("label-helper-starting", { agent }),
      hint: t(working ? "label-helper-working-hint" : "label-helper-starting-hint"),
      since: working && Number.isFinite(s.helperSince) ? s.helperSince : null,
    };
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
      // A case's rework: undone with each change's button, never by a click on the text.
      rework: String(head.modeId).startsWith("case:"),
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
    // From the agent input box with own cases: what to fix is picked first.
    choose: !!s.choosing,
    placeholder: t("label-placeholder", { language: lang.native }),
  };
}
