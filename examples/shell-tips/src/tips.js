/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Shell Tips — the question and the answer. A plain module: it builds what
 * the tile sends to `tf.ai.ask` and cleans up what comes back, and knows
 * nothing about Tilefold, so it is easy to test on its own.
 */

/** Topics offered in settings: the stored value and its label's message key. */
export const TOPICS = Object.freeze([
  { value: "git", key: "topic-git" },
  { value: "shell", key: "topic-shell" },
  { value: "docker", key: "topic-docker" },
  { value: "npm", key: "topic-npm" },
  { value: "ssh", key: "topic-ssh" },
]);

/** What each topic is about, in the words Claude is asked about. */
const SUBJECTS = {
  git: "git",
  shell: "zsh and bash in the terminal",
  docker: "Docker on the command line",
  npm: "npm and Node.js on the command line",
  ssh: "ssh and remote servers",
};

/** The most a tip may cost in output tokens. A tip is one or two sentences. */
export const MAX_TOKENS = 300;

/** The longest tip shown. A notice holds at most 300 characters. */
export const MAX_TIP = 280;

/**
 * The question for `tf.ai.ask`. With an earlier tip on the same topic, it
 * becomes a short conversation (user, assistant, user), so Claude gives a
 * different one.
 *
 * @param {{ topic: string, language: string, fast: boolean, previous?: string | null }} o
 * @returns {{ system: string, messages: Array<{ role: string, content: string }>,
 *             maxTokens: number, model: "default" | "fast" }}
 */
export function buildAsk({ topic, language, fast, previous = null }) {
  const subject = Object.hasOwn(SUBJECTS, topic) ? SUBJECTS[topic] : SUBJECTS.shell;
  const messages = [{ role: "user", content: `Give me one tip about ${subject}.` }];
  if (previous) {
    messages.push(
      { role: "assistant", content: previous },
      { role: "user", content: "Another one, please, different from that." },
    );
  }
  return {
    system:
      "You give developers one practical, little-known tip for working in a terminal. " +
      `Answer in ${language}, in one or two sentences and at most 200 characters, ` +
      "as plain text without Markdown. Name the exact command when there is one.",
    messages,
    maxTokens: MAX_TOKENS,
    model: fast ? "fast" : "default",
  };
}

/**
 * A tip ready for a notice: Markdown marks and line breaks removed, spaces
 * collapsed, cut to MAX_TIP characters (with an ellipsis when cut).
 *
 * @param {unknown} text
 * @returns {string}
 */
export function cleanTip(text) {
  const plain = String(text ?? "")
    .replace(/```[a-z]*|`|\*\*|__|^#+\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > MAX_TIP ? `${plain.slice(0, MAX_TIP - 1).trimEnd()}…` : plain;
}

/**
 * The message key for an error `tf.ai.ask` threw, by the error's name, or
 * null when the user chose not to send (nothing needs saying).
 *
 * @param {unknown} err
 * @returns {string | null}
 */
export function errorKey(err) {
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
      // RateLimitError, NetworkError and anything unexpected.
      return "error-failed";
  }
}
