/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — running a check by Claude, with the user's key
 *
 * `check` asks Claude to correct one pane's prompt (`tf.ai.ask`; Tilefold
 * shows the user the question first), reads the answer (answer.js) and
 * shows the fixes on that pane's card, or a problem: no AI on this
 * Tilefold, no key, a refusal, an answer that changed code. Only counts are
 * audited (`checked`), never the prompt or the fixes.
 */
import { buildAsk, errorKey, readAnswer } from "./answer.js";
import { changeCount, changes, diff } from "./polish.js";

/**
 * @param {any} tf
 * @param {{ sessions: any, render: (id: string) => Promise<void>,
 *   refreshButton: () => Promise<void>, audit: (action: string, details: object) => void,
 *   language: () => { code: string, name: string }, mode: () => string,
 *   fast: () => boolean }} deps
 */
export function createClaudeRun(tf, deps) {
  const { sessions, render, refreshButton, audit, language, mode, fast } = deps;

  /** Asks Claude to check pane `id`'s prompt `original`, then shows the fixes there. */
  const check = async (id, original) => {
    const s = sessions.get(id);
    if (!s) return;
    if (!tf.ai) {
      Object.assign(s, { step: "problem", problem: "error-no-ai" });
      return render(id);
    }
    s.busy = true;
    const lang = language();
    const m = mode();
    s.step = "checking";
    await render(id);
    try {
      let answer;
      try {
        answer = await tf.ai.ask(
          buildAsk({
            text: original,
            language: lang.name,
            mode: m,
            uiLanguage: tf.t("ai-language"),
            fast: fast(),
          }),
        );
      } catch (err) {
        const key = errorKey(err);
        Object.assign(s, key ? { step: "problem", problem: key } : { step: "write" });
        return render(id);
      }
      const r = readAnswer(answer.text, original);
      if (!r.ok) {
        Object.assign(s, {
          step: "problem",
          problem: r.why === "changed-code" ? "error-changed-code" : "error-unreadable",
        });
        return render(id);
      }
      Object.assign(s, {
        step: "result",
        parts: changes(diff(original, r.corrected)),
        notes: r.notes,
        rejected: new Set(),
        clean: false,
      });
      // Counts only: never the prompt or the fixes.
      audit("checked", {
        language: lang.code,
        mode: m,
        changes: changeCount(s.parts),
        model: String(answer.model ?? ""),
        outputTokens: Number(answer.usage?.outputTokens ?? 0),
      });
      await render(id);
      await refreshButton();
    } finally {
      s.busy = false;
    }
  };

  return { check };
}
