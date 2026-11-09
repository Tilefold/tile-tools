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
};

/** The page's labels in the user's language. */
export const pageLabels = (tf) =>
  Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));
