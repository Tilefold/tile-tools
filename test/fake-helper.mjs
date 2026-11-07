/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold — tf.agent.helper
 *
 * The helper agent part of the fake Tilefold in fake-host.mjs (Tilefold
 * 0.1.27): `tf.agent.helper({ agent, question, about })` checks what
 * Tilefold checks (a known agent, a question of plain text), keeps each
 * request in `host.helperAsks`, and answers `{ sent: true, opened }`
 * (`opened` only the first time for each agent), or the object the test
 * gives (such as `{ sent: false, why: "busy", opened: false }`), or what a
 * function it gives resolves to (to hold the answer back, as a helper
 * that is still starting does). Tests play
 * the helper agent's answer by running the tile's command themselves.
 */

/** The agents Tilefold can start as a helper. */
export const HELPER_AGENTS = ["claude", "codex", "gemini", "cursor", "agy", "opencode"];

/**
 * Adds `tf.agent.helper` to `tf` (keeping `tf.agent.ask` if there is one).
 *
 * @param {any} tf
 * @param {any} host
 * @param {(name: string, message: string) => Error} named
 * @param {true | object | ((request: object) => Promise<object>)} answer what
 *   each request answers (true: sent)
 */
export function addHelper(tf, host, named, answer) {
  host.helperAsks = [];
  const started = new Set();
  tf.agent = {
    ...tf.agent,
    async helper(request) {
      if (!HELPER_AGENTS.includes(request?.agent))
        throw named("TypeError", `agent: one of ${HELPER_AGENTS.join(", ")}`);
      if (typeof request.question !== "string" || !request.question.trim())
        throw named("TypeError", "question: text to ask");
      host.helperAsks.push(structuredClone(request));
      if (typeof answer === "function") return answer(request);
      if (typeof answer === "object") return { ...answer };
      const opened = !started.has(request.agent);
      started.add(request.agent);
      return { sent: true, opened };
    },
  };
}
