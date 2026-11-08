/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — what the result's buttons do
 *
 * From the agent input box, Use (or Use and send) puts the corrected prompt
 * back in the box and Keep mine leaves it; otherwise Send puts it on the
 * ask card. With `translation` (a language code), the same buttons take
 * that translation instead: only one the result holds, never text from the
 * page. Ask again drops the result. Taken out of run.js so that file stays
 * small.
 */
import { build } from "./polish.js";
import { resetSession } from "./sessions.js";

/**
 * @param {{ inputAction: any, sendToAgent: (id: string, text: string, how: string) => Promise<void>,
 *   agentRun: any, render: (id: string) => Promise<void> }} o
 */
export function createResultActions(o) {
  /**
   * Takes page message `m` about pane `id`'s session `s`; false when it
   * isn't one of these.
   */
  return async (m, id, s) => {
    const result = s.step === "result";
    // A translation: the one the result holds for that language, else nothing.
    // Any `translation` field counts: one that isn't a language held is ignored.
    const asked =
      "translation" in m ? (typeof m.translation === "string" ? m.translation : "") : null;
    const tl = asked ? ((s.translations ?? []).find((x) => x.code === asked)?.text ?? null) : null;
    if (asked !== null && !tl) return m.type === "send" || m.type === "send-now";
    if ((m.type === "send" || m.type === "send-now") && result && s.input) {
      await o.inputAction.use(id, m.type === "send-now", tl);
      return true;
    }
    if (m.type === "keep") {
      await o.inputAction.keep(id);
      return true;
    }
    if (m.type === "send" && result) {
      await o.sendToAgent(id, tl ?? build(s.parts, s.rejected), tl ? "translation" : "corrected");
      return true;
    }
    if (m.type === "again") {
      await o.inputAction.release(id);
      o.agentRun.forget(id);
      resetSession(s);
      await o.render(id);
      return true;
    }
    return false;
  };
}
