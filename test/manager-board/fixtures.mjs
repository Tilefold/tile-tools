/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — sample timeline for the tests
 *
 * A manager pane (1 · lead) and the worker it opened (2 · api): the user's
 * prompt, the lead's reply, its request to open a pane, a message to the
 * worker, the worker's question back (not read yet), a heartbeat's nudge
 * and its end, and a schedule's missed run. Times are on one morning, as
 * Tilefold gives them (ISO, UTC).
 */

export const LEAD = "tilefold:0192f1c2-0000-7000-8000-00000000000a";
export const API = "tilefold:0192f1c2-0000-7000-8000-00000000000b";
export const GONE = "tilefold:0192f1c2-0000-7000-8000-00000000c0de";

export const at = (m) => `2026-11-06T09:${String(m).padStart(2, "0")}:00.000Z`;

const ev = (id, m, kind, pane, who, summary, extra = {}) => ({
  id,
  at: at(m),
  kind,
  pane,
  to: extra.to ?? null,
  who,
  summary,
  more: extra.more ?? false,
  status: extra.status ?? null,
  project: "/w/app",
  detail: extra.detail ?? {},
});

export const EVENTS = [
  ev("turn:t1", 1, "turn", LEAD, "you", "Add refunds. Split it up.", { more: true }),
  ev("turn:t2", 2, "turn", LEAD, "agent", "Opening a pane for the API."),
  ev("ask:r1", 3, "ask", LEAD, "agent", "Add POST /refunds", {
    status: "done",
    detail: { tool: "pane-open", name: "api" },
  }),
  ev("message:m1", 4, "message", LEAD, "agent", "Your task: POST /refunds", {
    to: API,
    status: "read",
    more: true,
    detail: { kind: "message" },
  }),
  ev("message:m2", 6, "message", API, "agent", "Keep the old form?", {
    to: LEAD,
    status: "delivered",
    detail: { kind: "question" },
  }),
  ev("nudge:w1", 7, "nudge", API, "tilefold", "Keep going on edge cases"),
  ev("heartbeat:h1", 8, "heartbeat", API, "tilefold", "Keep going on edge cases", {
    status: "done",
    detail: { reason: "done" },
  }),
  ev("run:n1", 9, "run", GONE, "schedule", "Check dependencies", {
    status: "missed",
    detail: { name: "Nightly", reason: "closed" },
  }),
];

export const FULL = {
  "turn:t1": "Add refunds.\nSplit it up.",
  "message:m1": "Your task:\n- POST /refunds",
};

export const NOW = [
  {
    pane: LEAD,
    name: "1 · lead",
    agent: "claude",
    state: "idle",
    role: "manager",
    project: "/w/app",
    stateAt: at(9),
  },
  {
    pane: API,
    name: "2 · api",
    agent: "codex",
    state: "asking",
    role: "opened",
    project: "/w/app",
    stateAt: at(9),
  },
];

export const FILTERS = {
  managers: [{ pane: LEAD, name: "1 · lead", project: "/w/app" }],
  projects: ["/w/app"],
  folds: [{ id: "f1", name: "Refunds" }],
};
