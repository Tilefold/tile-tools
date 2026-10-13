/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Shell Tips (example tile)
 *
 * A tile that asks Claude. It asks for the `ai.ask` permission and calls
 * `tf.ai.ask` with a system prompt, the conversation so far and a small
 * token limit. Tilefold uses the user's own Anthropic key (Settings → AI),
 * masks anything that looks like a secret, shows the user exactly what will
 * be sent, and only sends it if they agree. The tile never sees the key.
 *
 * Shown on purpose:
 * - the command starts the question and returns at once: the user may take
 *   a while to answer Tilefold's dialog, and a command that takes longer
 *   than ten seconds stops the tile;
 * - `model: "fast"` for a short, cheap answer (a setting turns it off);
 * - errors told apart by `name`, and a "Don't send" choice treated as a
 *   normal outcome, not a failure;
 * - Claude answers in the user's language, named in the tile's own strings;
 * - the last tip is kept with `tf.store`, so it can be shown again without
 *   asking.
 *
 * Build:  npx @tilefold/tile-tools build
 */
import { TOPICS, buildAsk, cleanTip, errorKey } from "./tips.js";

export default (tf) => {
  /** True while a question is waiting or under way, so only one is asked at a time. */
  let busy = false;

  /** Asks Claude for a tip on the chosen topic and shows it. */
  async function newTip() {
    if (busy) return;
    busy = true;
    try {
      if (!tf.ai) {
        await tf.toast(tf.t("error-no-ai"));
        return;
      }
      const topic = String(tf.settings.get("topic"));
      const last = await tf.store.get("last");
      const ask = buildAsk({
        topic,
        language: tf.t("ai-language"),
        fast: tf.settings.get("fast") !== false,
        previous: last && last.topic === topic ? last.text : null,
      });
      let answer;
      try {
        answer = await tf.ai.ask(ask);
      } catch (err) {
        const key = errorKey(err);
        if (key) await tf.toast(tf.t(key));
        else await tf.log.info("the user chose not to send the question");
        return;
      }
      const text = cleanTip(answer.text);
      if (!text) {
        await tf.toast(tf.t("error-refused"));
        return;
      }
      await tf.store.set("last", { topic, text });
      // The record says what was asked about and what it cost, not the tip itself.
      await tf.audit("tip-asked", {
        topic,
        model: answer.model,
        outputTokens: answer.usage?.outputTokens ?? 0,
      });
      await tf.toast(text);
    } finally {
      busy = false;
    }
  }

  /** Shows the last tip again, without asking Claude. */
  async function lastTip() {
    const last = await tf.store.get("last");
    await tf.toast(last && last.text ? last.text : tf.t("no-tip-yet"));
  }

  // Register everything at the top, before any `await`.
  tf.setting("topic", "git", tf.t("setting-topic"), {
    choices: TOPICS.map((t) => ({ value: t.value, label: tf.t(t.key) })),
  });
  tf.setting("fast", true, tf.t("setting-fast"));

  tf.command(
    tf.t("cmd-new-tip"),
    () => {
      // Start the question and return: the user decides in Tilefold's dialog, in their own time.
      void newTip();
    },
    { id: "new-tip" },
  );
  tf.command(tf.t("cmd-last-tip"), () => lastTip(), { id: "last-tip" });
};
