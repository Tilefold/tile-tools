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
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/tips.js
var TOPICS = Object.freeze([
  { value: "git", key: "topic-git" },
  { value: "shell", key: "topic-shell" },
  { value: "docker", key: "topic-docker" },
  { value: "npm", key: "topic-npm" },
  { value: "ssh", key: "topic-ssh" }
]);
var SUBJECTS = {
  git: "git",
  shell: "zsh and bash in the terminal",
  docker: "Docker on the command line",
  npm: "npm and Node.js on the command line",
  ssh: "ssh and remote servers"
};
var MAX_TOKENS = 300;
var MAX_TIP = 280;
function buildAsk({ topic, language, fast, previous = null }) {
  const subject = Object.hasOwn(SUBJECTS, topic) ? SUBJECTS[topic] : SUBJECTS.shell;
  const messages = [{ role: "user", content: `Give me one tip about ${subject}.` }];
  if (previous) {
    messages.push(
      { role: "assistant", content: previous },
      { role: "user", content: "Another one, please, different from that." }
    );
  }
  return {
    system: `You give developers one practical, little-known tip for working in a terminal. Answer in ${language}, in one or two sentences and at most 200 characters, as plain text without Markdown. Name the exact command when there is one.`,
    messages,
    maxTokens: MAX_TOKENS,
    model: fast ? "fast" : "default"
  };
}
function cleanTip(text) {
  const plain = String(text ?? "").replace(/```[a-z]*|`|\*\*|__|^#+\s*/gim, "").replace(/\s+/g, " ").trim();
  return plain.length > MAX_TIP ? `${plain.slice(0, MAX_TIP - 1).trimEnd()}\u2026` : plain;
}
function errorKey(err) {
  switch (err && typeof err === "object" ? err.name : "") {
    case "AiDeclinedError":
      return null;
    case "AiNotSetUpError":
      return "error-no-key";
    case "PermissionDeniedError":
      return "error-denied";
    case "BudgetExceededError":
      return "error-budget";
    case "RefusedError":
      return "error-refused";
    default:
      return "error-failed";
  }
}

// src/main.js
var main_default = (tf) => {
  let busy = false;
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
        previous: last && last.topic === topic ? last.text : null
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
      await tf.audit("tip-asked", {
        topic,
        model: answer.model,
        outputTokens: answer.usage?.outputTokens ?? 0
      });
      await tf.toast(text);
    } finally {
      busy = false;
    }
  }
  async function lastTip() {
    const last = await tf.store.get("last");
    await tf.toast(last && last.text ? last.text : tf.t("no-tip-yet"));
  }
  tf.setting("topic", "git", tf.t("setting-topic"), {
    choices: TOPICS.map((t) => ({ value: t.value, label: tf.t(t.key) }))
  });
  tf.setting("fast", true, tf.t("setting-fast"));
  tf.command(
    tf.t("cmd-new-tip"),
    () => {
      void newTip();
    },
    { id: "new-tip" }
  );
  tf.command(tf.t("cmd-last-tip"), () => lastTip(), { id: "last-tip" });
};
export default main_default;
