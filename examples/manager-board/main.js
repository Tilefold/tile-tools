/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — what you and your agents said and did, as a timeline
 *
 * A board docked beside your panes that shows, as one timeline, what
 * happens between you, your manager agents and the agents they start: what
 * you asked and what they replied, messages between panes, the panes an
 * agent asked to open and what you answered, heartbeat nudges and schedule
 * runs. Two views: Timeline (newest first, by hour) and Lanes (one lane per
 * participant, across time). Narrow it to a manager's team, a project or a
 * fold; read a long text in full; export the view as Markdown or JSON.
 *
 * It shows how a tile reads Tilefold's agents' timeline (tf.timeline, the
 * agent.timeline permission) and draws it on a page of its own.
 *
 * Needs Tilefold 0.1.27.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/strings.js
var PAGE_KEYS = [
  "page-lang",
  "page-dir",
  "page-title",
  "page-close",
  "view-label",
  "view-timeline",
  "view-lanes",
  "scope-label",
  "scope-all",
  "scope-team",
  "scope-project",
  "scope-fold",
  "kinds-label",
  "kind-turn",
  "kind-message",
  "kind-ask",
  "kind-nudge",
  "kind-heartbeat",
  "kind-run",
  "search-label",
  "window-label",
  "window-hour",
  "window-two-hours",
  "window-four-hours",
  "export-label",
  "export-markdown",
  "export-json",
  "now-title",
  "now-none",
  "waiting-title",
  "waiting-asking",
  "waiting-question",
  "state-ready",
  "state-idle",
  "state-busy",
  "state-asking",
  "role-manager",
  "who-you",
  "who-tilefold",
  "who-schedules",
  "pane-closed",
  "h-you",
  "h-agent",
  "h-typed",
  "h-message",
  "h-question",
  "h-answer",
  "h-report",
  "h-ask-open",
  "h-ask-heartbeat",
  "h-ask-schedule",
  "h-nudge",
  "h-heartbeat",
  "h-run",
  "st-ask-new",
  "st-ask-running",
  "st-ask-done",
  "st-ask-denied",
  "st-ask-expired",
  "st-msg-sending",
  "st-msg-held",
  "st-msg-delivered",
  "st-msg-read",
  "st-msg-refused",
  "st-hb-done",
  "st-hb-stopped",
  "st-hb-expired",
  "st-run-started",
  "st-run-missed",
  "st-run-skipped",
  "st-failed",
  "show-full",
  "full-close",
  "load-older",
  "history-start",
  "empty-title",
  "empty-text",
  "picked-event",
  "now-line",
  "loading-text",
  "error-not-allowed",
  "error-slow",
  "error-failed"
];
var MARKS = {
  pane: "{pane}",
  from: "{from}",
  to: "{to}",
  target: "{target}",
  name: "{name}",
  id: "{id}"
};
var pageLabels = (tf) => Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));

// src/run.js
var CALLS = ["events", "fullText", "filters", "now", "export"];
var VIEWS = ["timeline", "lanes"];
var FILTER_KINDS = ["all", "team", "project", "fold"];
var EVENT_KINDS = ["turn", "message", "ask", "nudge", "heartbeat", "run"];
var WINDOWS = [60, 120, 240];
var KEPT = "kept";
function checkKept(raw) {
  const k = raw && typeof raw === "object" ? raw : {};
  const f = k.filter && typeof k.filter === "object" ? k.filter : {};
  const filter = FILTER_KINDS.includes(f.kind) && f.kind !== "all" && typeof f.value === "string" && f.value.length > 0 && f.value.length <= 1024 ? { kind: f.kind, value: f.value } : { kind: "all" };
  const kinds = Array.isArray(k.kinds) ? EVENT_KINDS.filter((x) => k.kinds.includes(x)) : [];
  return {
    view: VIEWS.includes(k.view) ? k.view : "timeline",
    filter,
    kinds: kinds.length ? kinds : [...EVENT_KINDS],
    windowMin: WINDOWS.includes(k.windowMin) ? k.windowMin : 120
  };
}
function reasonOf(err) {
  const name = err && err.name;
  if (name === "PermissionDeniedError") return "not-allowed";
  if (name === "RateLimitError") return "slow";
  return "failed";
}
function runBoard(tf) {
  const warn = (err) => void Promise.resolve().then(() => tf.log.warn(String(err && err.message ? err.message : err))).catch(() => {
  });
  const audit = (action, details) => void Promise.resolve().then(() => tf.audit(action, details)).catch(warn);
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch(warn);
  let where = null;
  let view = null;
  const canSide = () => !!tf.page && typeof tf.theme === "function";
  const canRun = () => !!tf.page && !!tf.timeline;
  async function open() {
    if (!canRun()) return tf.toast(tf.t("toast-needs-tilefold"));
    const side = canSide();
    await tf.page.open(side ? { side: true } : {});
    if (!where) audit("opened", { as: side ? "side" : "window" });
    where = side ? "side" : "window";
  }
  async function close() {
    if (!tf.page || !where) return;
    where = null;
    await tf.page.close();
    audit("closed");
  }
  async function hello() {
    const kept = checkKept(await tf.store.get(KEPT));
    view = kept.view;
    await tf.page.post({ do: "setup", labels: pageLabels(tf), kept });
  }
  async function keep(m) {
    const kept = checkKept(m.kept);
    await tf.store.set(KEPT, kept);
    if (kept.view !== view) {
      view = kept.view;
      audit("view", { view });
    }
  }
  async function call(m) {
    if (typeof m.id !== "string" || !/^[a-z0-9-]{1,32}$/.test(m.id)) return;
    if (!CALLS.includes(m.call)) {
      return tf.page.post({ do: "reply", id: m.id, error: "failed" });
    }
    const args = m.args && typeof m.args === "object" && !Array.isArray(m.args) ? m.args : {};
    let value;
    try {
      if (m.call === "fullText") value = await tf.timeline.fullText(String(args.id ?? ""));
      else if (m.call === "events") value = await tf.timeline.events(args);
      else if (m.call === "export") value = await exportView(args);
      else value = await tf.timeline[m.call]();
    } catch (err) {
      return tf.page.post({ do: "reply", id: m.id, error: reasonOf(err) });
    }
    await tf.page.post({ do: "reply", id: m.id, value: value ?? null });
  }
  async function exportView(args) {
    const format = args.format === "json" ? "json" : "markdown";
    const reply = await tf.timeline.export({ filter: args.filter, format });
    if (reply && typeof reply.saved === "string") {
      const name = reply.saved.slice(0, 200);
      const count = Number(reply.events) || 0;
      const key = reply.truncated ? "toast-exported-truncated" : "toast-exported";
      await tf.toast(tf.t(key, { name, count }));
      audit("exported", { format, truncated: !!reply.truncated });
    }
    return reply;
  }
  async function hear(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") return hello();
    if (m.type === "call") return call(m);
    if (m.type === "keep") return keep(m);
    if (m.type === "close") return close();
  }
  tf.command(tf.t("cmd-open"), () => open().catch(warn), { id: "open" });
  tf.command(tf.t("cmd-close"), () => close().catch(warn), { id: "close" });
  tf.on(
    "page.message",
    background((e) => hear(e && e.message))
  );
  tf.on(
    "page.closed",
    background(() => {
      if (!where) return;
      where = null;
      audit("closed");
    })
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: the board moves to a window of its own.
    background(async () => {
      if (where !== "side") return;
      await tf.page.open();
      where = "window";
    })
  );
}

// src/main.js
var main_default = (tf) => {
  runBoard(tf);
};
export default main_default;
