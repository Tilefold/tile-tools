/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — Send to agent
 *
 * Puts a prompt (corrected, or as the user wrote it) on Tilefold's ask
 * card (`tf.agent.ask`), where the user presses Return to send it to the
 * agent in the pane they work in: the tile never types into a pane. A busy
 * card, no pane, or no ask card on this Tilefold is said in a notice. Only
 * counts are audited (`sent`), never the prompt. Taken out of run.js so
 * that file stays small.
 */
import { changeCount } from "./polish.js";
import { resetSession } from "./sessions.js";

/**
 * @param {any} tf
 * @param {{ sessions: any, render: (id: string) => Promise<void>,
 *   audit: (action: string, details: object) => void, warn: (err: unknown) => void,
 *   language: () => { native: string }, afterSend: (s: object) => Promise<void> }} deps
 */
export function createSendToAgent(tf, deps) {
  const { sessions, render, audit, warn, language, afterSend } = deps;

  /** Sends `text` for pane `id`; `how` is "corrected" or "as-is". */
  return async (id, text, how) => {
    const s = sessions.get(id);
    const question = String(text ?? "").trim();
    if (!s || !question) return;
    if (typeof tf.agent?.ask !== "function") return tf.toast(tf.t("error-no-agent-ask"));
    let r;
    try {
      r = await tf.agent.ask({
        question,
        about: tf.t("ask-about", { language: language().native }),
      });
    } catch (err) {
      warn(err);
      return tf.toast(tf.t("error-ask-failed"));
    }
    if (!r?.shown)
      return tf.toast(tf.t(r?.why === "busy" ? "error-ask-busy" : "error-ask-no-pane"));
    const total = how === "corrected" ? changeCount(s.parts) : 0;
    const undone =
      how === "corrected" ? s.parts.filter((p) => p.id && s.rejected.has(p.id)).length : 0;
    audit("sent", { how, kept: total - undone, undone });
    resetSession(s).step = "sent";
    await render(id);
    await afterSend(s);
  };
}
