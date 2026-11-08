/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — running a check by Claude, with the user's key
 *
 * `check` asks Claude to correct one pane's prompt (`tf.ai.ask`; Tilefold
 * shows the user the question first), reads the answer (answer.js) and
 * shows the fixes on that pane's card, or a problem: no AI on this
 * Tilefold, no key, a refusal, an answer that changed code. Only counts are
 * audited (`checked`), never the prompt or the fixes.
 * Modified 2026-11-06 (polish agent): without a key (or AI), the polish
 *   agent checks the prompt instead, where Tilefold has one (`noKey`).
 * Modified 2026-11-07 (own cases): a case's instructions (`rules`) go to
 *   Claude with the prompt.
 * Modified 2026-11-08 (translations): a case's languages (`translate`)
 *   are asked for too, and the translations shown with the fixes.
 * Modified 2026-11-08 (built-in translations): the built-in cases'
 *   languages go too.
 */
import { buildAsk, errorKey, readAnswer } from "./answer.js";
import { changeCount, changes, diff } from "./polish.js";

/**
 * @param {any} tf
 * @param {{ sessions: any, render: (id: string) => Promise<void>,
 *   refreshButton: () => Promise<void>, audit: (action: string, details: object) => void,
 *   language: () => { code: string, name: string }, mode: () => string, rules?: () => string,
 *   translate?: () => string[],
 *   fast: () => boolean, noKey?: (id: string, original: string) => Promise<boolean> }} deps
 */
export function createClaudeRun(tf, deps) {
  const { sessions, render, refreshButton, audit, language, mode, fast, noKey } = deps;
  // A case's own instructions (none for the built-in modes).
  const rules = () => (typeof deps.rules === "function" ? deps.rules() : "");
  // The languages to translate into: a case's, or a built-in case's setting.
  const translate = () => (typeof deps.translate === "function" ? deps.translate() : []);

  /** Asks Claude to check pane `id`'s prompt `original`, then shows the fixes there. */
  const check = async (id, original) => {
    const s = sessions.get(id);
    if (!s) return;
    // No way to ask Claude: the polish agent checks it, where there is one.
    if (!tf.ai && (await noKey?.(id, original))) return;
    if (!tf.ai) {
      Object.assign(s, { step: "problem", problem: "error-no-ai" });
      return render(id);
    }
    s.busy = true;
    const lang = language();
    const m = mode();
    const tl = translate();
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
            rules: rules(),
            translate: tl,
            uiLanguage: tf.t("ai-language"),
            fast: fast(),
          }),
        );
      } catch (err) {
        const key = errorKey(err);
        // No key: the polish agent checks it instead, where there is one.
        if (key === "error-no-key" && (await noKey?.(id, original))) return;
        Object.assign(s, key ? { step: "problem", problem: key } : { step: "write" });
        return render(id);
      }
      const r = readAnswer(answer.text, original, m, tl);
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
        translations: r.translations,
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
