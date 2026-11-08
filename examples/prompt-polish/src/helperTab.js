/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — keeping the polish agent running
 *
 * Where Tilefold can start a tile's helper agent without a request
 * (`tf.agent.helperStatus` and `tf.agent.helperStart`, Tilefold 0.1.27):
 *
 * - when the card opens and the polish agent is the one that will check
 *   (the `checker` setting is "agent", there is no Claude to ask, or a
 *   check already went to the agent once), Promptsmith asks whether it is
 *   running and, if not, starts it in the background, so it is ready by
 *   the time the prompt is written. At most once every START_GAP_MS;
 * - **Show the polish agent** brings its tab to the front (starting it if
 *   it isn't running), to answer its first questions or see what it does;
 * - **Restart the polish agent** closes its tab and starts a new one, for
 *   when it is stuck.
 *
 * Both are palette commands, and buttons on the card while the agent
 * starts or works and when it didn't start. A notice says how it went. On
 * an older Tilefold the commands say a newer one is needed.
 *
 * Audited: `helper-started` ({ how: "auto", "show" or "restart", state }),
 * never a prompt.
 */

/** The least time between two automatic starts, in ms. */
export const START_GAP_MS = 30_000;
/** The store key noting that the polish agent has checked a prompt before. */
export const USED_KEY = "helper-used";

/** The notice for each outcome of a start the user asked for. */
const RESULT_KEYS = {
  ready: "toast-helper-ready",
  busy: "toast-helper-busy",
  "not-started": "error-helper-not-started",
};

/** The card's problems that a working polish agent would solve. */
export const HELPER_PROBLEMS = new Set(["error-helper-not-started", "error-helper-failed"]);

/**
 * @param {any} tf
 * @param {{ current: () => { checker: string, helperAgent: string },
 *   sessions: { get: (id: string) => any }, render: (id?: string) => Promise<void>,
 *   audit: (action: string, details?: object) => void, warn: (err: unknown) => void,
 *   now?: () => number }} o
 */
export function createHelperTab(tf, o) {
  const now = o.now ?? Date.now;
  /** When the last automatic start began (0: never). */
  let lastAuto = 0;
  /** Whether a start is under way. */
  let starting = false;
  /** Whether the polish agent has checked a prompt (kept across runs). */
  let used = null;

  const supported = () =>
    typeof tf.agent?.helperStart === "function" && typeof tf.agent?.helperStatus === "function";

  const wasUsed = async () => {
    if (used === null) used = (await tf.store.get(USED_KEY).catch(() => null)) === true;
    return used;
  };

  /** Whether the polish agent, not Claude, will check the next prompt. */
  const willCheck = async () =>
    o.current().checker === "agent" || typeof tf.ai?.ask !== "function" || (await wasUsed());

  /** Starts the agent as `how` asks; its state, or null when it couldn't be asked. */
  const start = async (how) => {
    starting = true;
    try {
      const r = await tf.agent.helperStart({
        agent: o.current().helperAgent,
        ...(how === "auto" ? {} : { show: true }),
        ...(how === "restart" ? { restart: true } : {}),
      });
      const state = typeof r?.state === "string" ? r.state : "not-started";
      o.audit("helper-started", { how, state });
      return state;
    } catch (err) {
      o.warn(err);
      if (how !== "auto") {
        const reason = String((err && err.name) || err).slice(0, 64);
        await tf.toast(tf.t("toast-helper-failed", { reason })).catch(o.warn);
      }
      return null;
    } finally {
      starting = false;
    }
  };

  return {
    /** Whether the card can offer to show or restart the agent. */
    view: () => ({ canShowHelper: supported() }),

    /** The polish agent checked a prompt: start it ahead of time from now on. */
    async noteUsed() {
      if (used === true) return;
      used = true;
      await tf.store.set(USED_KEY, true).catch(o.warn);
    },

    /**
     * The card opened: starts the polish agent in the background when it
     * will check and isn't running. Never awaited by the card.
     */
    async ensure() {
      if (!supported() || starting || now() - lastAuto < START_GAP_MS) return;
      if (!(await willCheck())) return;
      lastAuto = now();
      let status;
      try {
        status = await tf.agent.helperStatus({ agent: o.current().helperAgent });
      } catch (err) {
        return o.warn(err);
      }
      if (status?.state === "none") await start("auto");
    },

    /** Shows the agent's tab (`restart`: after starting it afresh) and says how it went. */
    async show(restart = false) {
      if (!supported()) return tf.toast(tf.t("toast-helper-unsupported"));
      if (starting && !restart) return;
      const state = await start(restart ? "restart" : "show");
      if (state) await tf.toast(tf.t(RESULT_KEYS[state] ?? "error-helper-not-started"));
    },

    /**
     * Takes a message from the page about the agent; false for any other.
     * From a problem card, the card goes back to the prompt, to try again.
     */
    async hear(m) {
      if (m.type !== "helper-show" && m.type !== "helper-restart") return false;
      const id = typeof m.pane === "string" ? m.pane : null;
      const s = id ? o.sessions.get(id) : null;
      if (s?.step === "problem" && HELPER_PROBLEMS.has(s.problem)) {
        Object.assign(s, { step: "write", problem: "" });
        await o.render(id);
      }
      await this.show(m.type === "helper-restart");
      return true;
    },
  };
}
