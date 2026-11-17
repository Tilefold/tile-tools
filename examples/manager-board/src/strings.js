/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — the page's strings
 *
 * The page shows only text the tile sends it, in the user's language. A
 * message with a variable reaches the page with the variable's mark in its
 * place (`{pane}`, `{name}`…), which the page fills in.
 *
 * Modified 2026-11-15 (Tasks view): the Tasks view's labels, and the
 *   `{count}` mark.
 * Modified 2026-11-15 (one pane only): the labels for narrowing the board
 *   to one pane.
 * Modified 2026-11-15 (cards open in place): opening and folding a card,
 *   and how many more lines a folded reply holds.
 *
 * Modified 2026-11-16 (Now modes): the Now heading, its modes and the
 *   flow diagram's labels.
 *
 * Last updated by: Tilefold
 */

/** The page's message keys. */
export const PAGE_KEYS = [
  "page-lang",
  "page-dir",
  "page-title",
  "page-close",
  "view-label",
  "view-timeline",
  "view-lanes",
  "view-tasks",
  "task-sort-label",
  "task-sort-newest",
  "task-sort-oldest",
  "task-sort-agent",
  "task-sort-project",
  "task-sort-longest",
  "task-state-label",
  "task-show-all",
  "task-show-working",
  "task-show-waiting",
  "task-show-done",
  "task-state-working",
  "task-state-waiting",
  "task-state-done",
  "task-by-you",
  "task-by-pane",
  "task-earlier",
  "task-no-reply",
  "task-show-reply",
  "task-took",
  "task-unknown",
  "task-count",
  "task-count-working",
  "task-count-waiting",
  "tasks-empty",
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
  "now-count",
  "now-mode-label",
  "now-mode-cards",
  "now-mode-compact",
  "now-mode-flow",
  "flow-label",
  "flow-edge",
  "flow-legend",
  "flow-none",
  "only-pane",
  "only-pane-pick",
  "only-pane-clear",
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
  "card-open",
  "card-close",
  "more-lines",
  "did-count",
  "actions-label",
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
  "error-failed",
];

/** Each variable's mark, as the page fills it in. */
const MARKS = {
  pane: "{pane}",
  from: "{from}",
  to: "{to}",
  target: "{target}",
  name: "{name}",
  id: "{id}",
  count: "{count}",
};

/** The page's labels in the user's language. */
export const pageLabels = (tf) =>
  Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));
