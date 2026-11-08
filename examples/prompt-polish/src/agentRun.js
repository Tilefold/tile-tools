/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — running a check by the agent in the pane
 *
 * Ties agentCheck.js to the tile: `check` puts the request on Tilefold's
 * ask card and shows "waiting for the agent" on the pane's card;
 * `handBack` is the Hand back command the agent runs with `tile_run`: it
 * takes the answer only for a request the tile waits on, reads it like
 * Claude's (answer.js), and shows the fixes on that pane's card; `cancel`
 * stops waiting. The command's errors go back to the agent as its reason,
 * so they say what to do, never what the prompt was.
 *
 * Only counts are audited (`agent-asked`, `checked` with `checker:
 * "agent"`), never the prompt or the fixes.
 *
 * Modified 2026-11-06 (polish agent): where Tilefold has helper agents
 *   (`tf.agent.helper`, Tilefold 0.1.27), the request goes to the polish
 *   agent instead, in a tab of its own that Tilefold opens the first time:
 *   no ask card, and the agent the user works with is never interrupted.
 *   The card says it's waiting at once (starting the agent takes a while)
 *   and why when the request couldn't go.
 * Modified 2026-11-07 (helper names): the card calls the polish agent what
 *   the user renamed its pane to (`calledName`), as Tilefold reports it.
 * Modified 2026-11-07 (own cases): a case's instructions go with the
 *   request (`rules`); audits name only the mode.
 */
import {
  agentBrief,
  agentQuestion,
  agentRequest,
  createPending,
  HAND_BACK,
  newRequestId,
  readHandBack,
  TILE_ID,
} from "./agentCheck.js";
import { readAnswer } from "./answer.js";
import { changeCount, changes, diff } from "./polish.js";

/** Longest pane name the card shows for the polish agent. */
const MAX_NAME = 40;

/** Why the polish agent didn't get the request, as the card's problem message. */
const HELPER_WHY = {
  busy: "error-helper-busy",
  "you-are-typing": "error-helper-typing",
  "not-started": "error-helper-not-started",
};

/**
 * @param {any} tf
 * @param {{ sessions: any, render: (id: string) => Promise<void>,
 *   refreshButton: () => Promise<void>, audit: (action: string, details: object) => void,
 *   warn: (err: unknown) => void, language: () => { code: string, name: string, native: string },
 *   mode: () => string, helperAgent: () => string }} deps
 */
export function createAgentRun(tf, deps) {
  const { sessions, render, refreshButton, audit, warn, language, mode, helperAgent } = deps;
  // A case's own instructions (none for the built-in modes).
  const rules = () => (typeof deps.rules === "function" ? deps.rules() : "");
  /** True where Tilefold can give the tile a polish agent of its own. */
  const hasHelper = () => typeof tf.agent?.helper === "function";
  const pending = createPending();

  /** Shows a problem on pane `id`'s card. */
  const problem = (id, s, key) => {
    Object.assign(s, { step: "problem", problem: key });
    return render(id);
  };

  /** What the user renamed each polish agent's pane to, by agent (Tilefold says, from 0.1.27). */
  const called = new Map();
  /** The current polish agent's name as the user gave it, or null. */
  const calledName = () => called.get(helperAgent()) ?? null;

  /** Has the polish agent check pane `id`'s prompt: `question` for `request`. */
  const viaHelper = async (id, s, entry, request) => {
    // Waiting shows at once: the first time, the agent's tab takes a while to start.
    pending.add(request, entry);
    Object.assign(s, {
      step: "agent",
      helper: true,
      helperStage: "starting",
      helperSince: null,
      draft: entry.original,
      problem: "",
    });
    await render(id);
    let r;
    try {
      // The rules go once per session (Tilefold sends the brief); each request is short.
      r = await tf.agent.helper({
        agent: helperAgent(),
        brief: agentBrief(`${TILE_ID}.${HAND_BACK}`),
        question: agentRequest({
          text: entry.original,
          language: language().name,
          mode: entry.mode,
          rules: entry.rules,
          uiLanguage: tf.t("ai-language"),
          request,
        }),
        about: tf.t("agent-check-about"),
      });
    } catch (err) {
      warn(err);
      r = null;
    }
    // Kept even if the card moved on: the next request says it while starting.
    if (r && "name" in r) {
      const name = typeof r.name === "string" ? r.name.trim().slice(0, MAX_NAME) : "";
      called.set(helperAgent(), name || null);
    }
    // Cancelled, closed or asked again meanwhile: that is the card's state now.
    if (s.step !== "agent" || !pending.has(id)) return;
    if (!r?.sent) {
      pending.dropFor(id);
      return problem(id, s, HELPER_WHY[r?.why] ?? "error-helper-failed");
    }
    audit("agent-asked", {
      language: entry.language,
      mode: entry.mode,
      helper: true,
      opened: !!r.opened,
    });
    // It has the prompt: the card says it's working on it, and for how long.
    Object.assign(s, { helperStage: "working", helperSince: Date.now() });
    await render(id);
  };

  /** Asks the polish agent (else the agent in the pane) to check pane `id`'s prompt `original`. */
  const check = async (id, original) => {
    const s = sessions.get(id);
    if (!s) return;
    if (!hasHelper() && typeof tf.agent?.ask !== "function")
      return problem(id, s, "error-no-agent-ask");
    const request = newRequestId();
    const lang = language();
    const m = mode();
    const own = rules();
    const question = agentQuestion({
      text: original,
      language: lang.name,
      mode: m,
      rules: own,
      uiLanguage: tf.t("ai-language"),
      request,
      command: `${TILE_ID}.${HAND_BACK}`,
    });
    const entry = { pane: id, original, language: lang.code, mode: m, rules: own };
    if (hasHelper()) return viaHelper(id, s, entry, request);
    let r;
    try {
      r = await tf.agent.ask({ question, about: tf.t("agent-check-about") });
    } catch (err) {
      warn(err);
      return problem(id, s, "error-ask-failed");
    }
    if (!r?.shown)
      return problem(id, s, r?.why === "busy" ? "error-ask-busy" : "error-ask-no-pane");
    pending.add(request, entry);
    Object.assign(s, { step: "agent", helper: false, draft: original, problem: "" });
    audit("agent-asked", { language: lang.code, mode: m });
    await render(id);
  };

  /**
   * The Hand back command: the agent's corrected prompt for a request.
   * Throws (back to the agent) when it can't be taken.
   */
  const handBack = async (input) => {
    if (input === null || input === undefined) throw new Error("run by agents only, with input");
    const h = readHandBack(input);
    if (!h.ok) {
      throw new Error(
        'input: {"request": the id from the request, "corrected": the corrected prompt, "notes": [{"from", "to", "kind", "why"}]}',
      );
    }
    const e = pending.take(h.request);
    if (!e) {
      throw new Error(
        "Prompt Polish isn't waiting for this request: it was handed back already, cancelled, or is over 10 minutes old",
      );
    }
    const s = sessions.get(e.pane);
    if (!s || s.step !== "agent") throw new Error("the user closed this prompt in Prompt Polish");
    const r = readAnswer(h.answer, e.original, e.mode);
    if (!r.ok) {
      const changedCode = r.why === "changed-code";
      await problem(e.pane, s, changedCode ? "error-agent-changed-code" : "error-agent-unreadable");
      throw new Error(
        changedCode
          ? "the correction changed code, a file path or a link, so it was not shown; the user can ask again"
          : "the correction could not be read, so it was not shown; the user can ask again",
      );
    }
    Object.assign(s, {
      step: "result",
      parts: changes(diff(e.original, r.corrected)),
      notes: r.notes,
      rejected: new Set(),
      clean: false,
    });
    const count = changeCount(s.parts);
    // Counts only: never the prompt or the fixes.
    audit("checked", { language: e.language, mode: e.mode, changes: count, checker: "agent" });
    await render(e.pane);
    await refreshButton();
    return { shown: true, changes: count };
  };

  /** Stops waiting for pane `id`'s hand-back; its card goes back to the prompt. */
  const cancel = async (id) => {
    pending.dropFor(id);
    const s = sessions.get(id);
    if (s && s.step === "agent") s.step = "write";
    await render(id);
  };

  /** Forgets whatever pane `id` waited on (its prompt was closed or reset). */
  const forget = (id) => pending.dropFor(id);

  /** Checks it by the polish agent when Claude can't (no key): true if it did. */
  const takeOver = async (id, original) => {
    if (!hasHelper()) return false;
    await check(id, original);
    return true;
  };

  return { check, handBack, cancel, forget, takeOver, calledName };
}
