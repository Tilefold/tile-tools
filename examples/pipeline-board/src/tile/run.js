/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — the tile
 *
 * Wires everything to Tilefold:
 *
 * - Commands: **Show or hide** (⌃⌥G) and **Refresh**; clicking the board
 *   refreshes too.
 * - While shown, it asks GitLab every 30 seconds while a pipeline is
 *   running or waiting, and every 2 minutes otherwise; while hidden it
 *   sends nothing.
 * - Signed out, it checks every few seconds whether the user has signed in
 *   (in Settings → Tiles, under Keys) and starts at once when they have.
 * - When a pipeline it saw running finishes, it can say so in a notice
 *   (a setting), and records the result, never the project, in the
 *   activity log.
 * - Tilefold's refusals, a refused sign-in, an unknown project, GitLab's
 *   rate limit and an older Tilefold each get their own message.
 *
 * The tile never sees a token: requests name the `gitlab` sign-in and
 * Tilefold adds it. Registration comes first, with no `await` before it.
 */
import { SIGN_IN, failureOf, parsePipelines, pipelinesUrl } from "../gitlab/api.js";
import { finishedSince, isActive } from "../gitlab/status.js";
import { FETCH_KEYS, readSettings } from "./settings.js";
import { BOARD_ID, boardItem } from "./view.js";

/** How often to check while something is going, otherwise, and for a sign-in. */
export const ACTIVE_MS = 30_000;
export const IDLE_MS = 120_000;
export const SIGN_IN_MS = 5_000;

/** After GitLab's rate limit, wait this long. */
export const RATE_MS = 300_000;

/** Keys in `tf.store`. */
export const KEYS = { visible: "visible" };

/** Commands: stable ids, message keys of their titles, default shortcuts. */
export const COMMANDS = [
  { id: "toggle", title: "cmd-toggle", key: { mac: "Ctrl+Alt+G", other: "Ctrl+Alt+G" } },
  { id: "refresh", title: "cmd-refresh" },
];

/** The notice for each way a pipeline can finish, spelled out so the keys can be found. */
const NOTICE = {
  success: "notice-success",
  failed: "notice-failed",
  canceled: "notice-canceled",
  manual: "notice-manual",
};

/**
 * Starts the tile.
 *
 * @param {any} tf
 */
export function runPipelineBoard(tf) {
  let visible = false;
  let shown = null;
  let layout = null;
  let status = "no-project";
  /** @type {ReturnType<typeof parsePipelines>} */
  let pipelines = [];
  /** Status by pipeline id at the last answer, for the notices. */
  let seen = new Map();
  /** The project the list belongs to, so a new project doesn't announce old pipelines. */
  let seenFor = "";
  let busy = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  const settings = () => readSettings(tf.settings);
  const quiet = (fn) =>
    Promise.resolve()
      .then(fn)
      .catch(() => {});
  const warn = (text) => quiet(() => tf.log.warn(String(text).slice(0, 300)));
  const audit = (action, details) => quiet(() => tf.audit(action, details));
  const networked = () =>
    Boolean(
      tf.net && typeof tf.net.fetch === "function" && tf.auth && typeof tf.auth.has === "function",
    );

  // ------------------------------------------------------------ drawing
  const draw = async () => {
    if (!visible) return;
    const s = settings();
    const item = boardItem({
      status,
      project: s.project,
      pipelines,
      now: Date.now(),
      corner: s.corner,
      layout,
      t: (key, args) => tf.t(key, args),
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items: [item] });
      shown = ok === false ? null : item;
      return;
    }
    if (JSON.stringify(item) === JSON.stringify(shown)) return;
    shown = item;
    await tf.overlay.update({ items: [item] });
  };

  // ------------------------------------------------------------ checking
  /** The wait before the next check, by state. */
  const nextWait = () => {
    if (status === "signed-out") return SIGN_IN_MS;
    if (status === "rate") return RATE_MS;
    if (status === "no-network" || status === "no-project") return null;
    return pipelines.some((p) => isActive(p.status)) ? ACTIVE_MS : IDLE_MS;
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const wait = visible ? nextWait() : null;
    if (wait !== null) timer = setTimeout(() => void refresh(), wait);
  };

  /** Tells the user about pipelines that finished since the last check. */
  const announce = async (finished) => {
    for (const f of finished) {
      void audit("finished", { result: f.group });
      const key = NOTICE[f.group];
      if (key && settings().notify) await tf.toast(tf.t(key, { n: f.iid, ref: f.ref }));
    }
  };

  /** Asks GitLab for the latest pipelines. */
  const refresh = async () => {
    if (busy) return;
    busy = true;
    const s = settings();
    try {
      if (!networked()) {
        status = "no-network";
        return;
      }
      if (!s.project) {
        status = "no-project";
        return;
      }
      if (!(await tf.auth.has(SIGN_IN))) {
        status = "signed-out";
        return;
      }
      if (status !== "ready") {
        status = "loading";
        await draw();
      }
      const res = await tf.net.fetch(pipelinesUrl(s.project, s.ref), { auth: SIGN_IN });
      if (!res.ok) {
        status = failureOf(null, res.status);
        void audit("check", { ok: false, code: `http-${res.status}` });
        return;
      }
      const next = parsePipelines(await res.json());
      const key = `${s.project}|${s.ref}`;
      const finished = seenFor === key ? finishedSince(seen, next) : [];
      seen = new Map(next.map((p) => [p.id, p.status]));
      seenFor = key;
      pipelines = next;
      status = "ready";
      await announce(finished);
    } catch (err) {
      status = failureOf(err);
      void audit("check", { ok: false, code: String((err && err.name) || "Error") });
      if (status === "error") void warn(`check failed: ${err && err.name}: ${err && err.message}`);
    } finally {
      busy = false;
      await draw();
      schedule();
    }
  };

  // ------------------------------------------------------------ showing
  const show = async () => {
    visible = true;
    shown = null;
    try {
      layout = await tf.overlay.layout();
    } catch {
      layout = null;
    }
    void quiet(() => tf.store.set(KEYS.visible, true));
    void audit("shown", {});
    await refresh();
  };

  const hide = async () => {
    visible = false;
    shown = null;
    schedule();
    await tf.overlay.hide();
    void quiet(() => tf.store.set(KEYS.visible, false));
    void audit("hidden", {});
  };

  /** Runs a handler's work in the background, so the handler returns at once. */
  const background = (fn) => (e) =>
    void Promise.resolve()
      .then(() => fn(e))
      .catch((err) => warn(err));

  // ------------------------------------------------------------ registration (nothing awaited above)
  for (const c of COMMANDS) {
    const run =
      c.id === "toggle"
        ? background(() => (visible ? hide() : show()))
        : background(() => (visible ? refresh() : show()));
    tf.command(tf.t(c.title), run, c.key ? { id: c.id, key: c.key } : { id: c.id });
  }
  tf.on(
    "app.ready",
    background(async () => {
      if (await tf.store.get(KEYS.visible).catch(() => false)) await show();
    }),
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (visible && e && e.item === BOARD_ID && e.type === "click") await refresh();
    }),
  );
  tf.on(
    "overlay.layout",
    background(async (next) => {
      if (next && typeof next === "object") layout = next;
      await draw();
    }),
  );
  tf.on(
    "overlay.hidden",
    background(async () => {
      shown = null;
    }),
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      if (FETCH_KEYS.includes(e && e.key)) {
        pipelines = [];
        status = "loading";
        if (visible) await refresh();
        return;
      }
      await draw();
    }),
  );

  return { refresh, state: () => ({ status, visible, pipelines }) };
}
