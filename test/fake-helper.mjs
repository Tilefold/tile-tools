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
 * request in `host.helperAsks`, and answers `{ sent: true, opened, name }`
 * (`opened` only the first time for each agent; `name` null, the pane
 * not renamed), or the object the test
 * gives (such as `{ sent: false, why: "busy", opened: false }`), or what a
 * function it gives resolves to (to hold the answer back, as a helper
 * that is still starting does). Tests play
 * the helper agent's answer by running the tile's command themselves.
 *
 * Unless `control` is false (a Tilefold before helper control),
 * `tf.agent.helperStatus({ agent })` answers `host.helperState` when a test
 * set it, else "ready" for an agent started or asked before and "none"
 * otherwise; `tf.agent.helperStart({ agent, show, restart })` keeps each
 * request in `host.helperStarts` and answers `host.helperStartAnswer` when
 * set (or what it returns, when a function: it may throw), else
 * `{ state: "ready", opened, name: null }`.
 *
 * Modified 2026-11-08 (helper start): helperStatus and helperStart.
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
export function addHelper(tf, host, named, answer, control = true) {
  host.helperAsks = [];
  host.helperStarts = [];
  host.helperState = null;
  host.helperStartAnswer = null;
  const started = new Set();
  /** A known agent in `request`, or a TypeError. */
  const agentIn = (request) => {
    if (!HELPER_AGENTS.includes(request?.agent))
      throw named("TypeError", `agent: one of ${HELPER_AGENTS.join(", ")}`);
    return request.agent;
  };
  const more = control
    ? {
        async helperStatus(request) {
          const agent = agentIn(request);
          return { state: host.helperState ?? (started.has(agent) ? "ready" : "none"), name: null };
        },
        async helperStart(request) {
          const agent = agentIn(request);
          for (const f of ["show", "restart"])
            if (request[f] !== undefined && typeof request[f] !== "boolean")
              throw named("TypeError", `${f}: true or false`);
          host.helperStarts.push(structuredClone(request));
          if (typeof host.helperStartAnswer === "function") return host.helperStartAnswer(request);
          if (host.helperStartAnswer) return { ...host.helperStartAnswer };
          const opened = request.restart === true || !started.has(agent);
          started.add(agent);
          return { state: "ready", opened, name: null };
        },
      }
    : {};
  tf.agent = {
    ...tf.agent,
    ...more,
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
      return { sent: true, opened, name: null };
    },
  };
}
