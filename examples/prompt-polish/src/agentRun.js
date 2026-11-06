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
 */
import {
  agentQuestion,
  createPending,
  HAND_BACK,
  newRequestId,
  readHandBack,
  TILE_ID,
} from "./agentCheck.js";
import { readAnswer } from "./answer.js";
import { changeCount, changes, diff } from "./polish.js";

/**
 * @param {any} tf
 * @param {{ sessions: any, render: (id: string) => Promise<void>,
 *   refreshButton: () => Promise<void>, audit: (action: string, details: object) => void,
 *   warn: (err: unknown) => void, language: () => { code: string, name: string, native: string },
 *   mode: () => string }} deps
 */
export function createAgentRun(tf, deps) {
  const { sessions, render, refreshButton, audit, warn, language, mode } = deps;
  const pending = createPending();

  /** Shows a problem on pane `id`'s card. */
  const problem = (id, s, key) => {
    Object.assign(s, { step: "problem", problem: key });
    return render(id);
  };

  /** Asks the agent in the pane to check pane `id`'s prompt `original`. */
  const check = async (id, original) => {
    const s = sessions.get(id);
    if (!s) return;
    if (typeof tf.agent?.ask !== "function") return problem(id, s, "error-no-agent-ask");
    const request = newRequestId();
    const lang = language();
    const m = mode();
    const question = agentQuestion({
      text: original,
      language: lang.name,
      mode: m,
      uiLanguage: tf.t("ai-language"),
      request,
      command: `${TILE_ID}.${HAND_BACK}`,
    });
    let r;
    try {
      r = await tf.agent.ask({ question, about: tf.t("agent-check-about") });
    } catch (err) {
      warn(err);
      return problem(id, s, "error-ask-failed");
    }
    if (!r?.shown)
      return problem(id, s, r?.why === "busy" ? "error-ask-busy" : "error-ask-no-pane");
    pending.add(request, { pane: id, original, language: lang.code, mode: m });
    Object.assign(s, { step: "agent", draft: original, problem: "" });
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
    const r = readAnswer(h.answer, e.original);
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

  return { check, handBack, cancel, forget };
}
