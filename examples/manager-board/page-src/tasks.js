/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — tasks (no DOM)
 *
 * The Tasks view turns the timeline's events into one row per task: what
 * an agent was asked, by whom, when, what it last replied, whether it is
 * still working, waiting on you or done, and how long it took.
 *
 *   tasksOf      the tasks in the loaded events (any order in, newest first out)
 *   shownTasks   the tasks in one state and matching a search
 *   sortTasks    newest, oldest, by agent, by project or longest first
 *   groupTasks   headings for the sorts by agent or project
 *   countStates  how many tasks are working, waiting and done
 *   duration     a task's length as hours, minutes and seconds
 *
 * A task starts when you type a prompt in a pane, or when another agent
 * sends that pane a message (a manager handing out work). The pane's agent
 * replies then belong to it until the next one starts there. Replies whose
 * prompt is older than what is loaded make a task with no request
 * (`request: null`); Load older fills it in. Only the newest task of a pane
 * can still be going: it is working while the pane's agent works, waiting
 * while the agent asks you something, and done otherwise (also once the
 * pane is closed).
 */

/** The sorts and the states the view offers, the first of each the default. */
export const TASK_SORTS = ["newest", "oldest", "agent", "project", "longest"];
export const TASK_STATES = ["all", "working", "waiting", "done"];

/** Oldest first; ties in time by id. */
const byTime = (a, b) =>
  a.at === b.at ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.at < b.at ? -1 : 1;

/** True for a message that hands a pane work (not a question, answer or report). */
const isAssignment = (e) =>
  e.kind === "message" &&
  typeof e.to === "string" &&
  e.to !== "" &&
  (!e.detail || !e.detail.kind || e.detail.kind === "message");

/** The CLI a turn names (`claude`, `codex`), or "". */
const cliOf = (e) =>
  e.detail && typeof e.detail.cli === "string" ? e.detail.cli.slice(0, 40) : "";

/** The folder's last name, for a project path. */
export const projectName = (p) => (typeof p === "string" ? p.split(/[\\/]/).pop() || p : "");

/**
 * The tasks in `events`, newest first. `panes` are the open panes (Now),
 * `now` the time in ms, for a task still going.
 */
export function tasksOf(events, panes, now = Date.now()) {
  const open = new Map(panes.map((p) => [p.pane, p]));
  /** The task under way in each pane. */
  const current = new Map();
  const tasks = [];
  const start = (e, pane, by) => {
    const t = {
      id: e.id,
      pane,
      by,
      at: e.at,
      request: e.summary,
      requestId: e.id,
      requestMore: !!e.more,
      reply: null,
      replyId: null,
      replyMore: false,
      replies: 0,
      end: null,
      agent: "",
      project: typeof e.project === "string" ? e.project : "",
    };
    tasks.push(t);
    current.set(pane, t);
    return t;
  };
  for (const e of [...events].sort(byTime)) {
    if (e.kind === "turn" && e.who === "you") {
      start(e, e.pane, "you");
    } else if (isAssignment(e)) {
      start(e, e.to, e.pane);
    } else if (e.kind === "turn" && e.who === "agent") {
      // A reply with no prompt loaded: a task whose request is further back.
      let t = current.get(e.pane);
      if (!t) {
        t = start(e, e.pane, null);
        t.request = null;
        t.requestId = null;
        t.requestMore = false;
      }
      t.reply = e.summary;
      t.replyId = e.id;
      t.replyMore = !!e.more;
      t.replies += 1;
      t.end = e.at;
      t.agent = t.agent || cliOf(e);
      if (!t.project && typeof e.project === "string") t.project = e.project;
    }
  }
  const nowMs = Number(now);
  for (const t of tasks) {
    const pane = open.get(t.pane);
    if (!t.agent && pane && typeof pane.agent === "string") t.agent = pane.agent;
    if (!t.project && pane && typeof pane.project === "string") t.project = pane.project;
    const newest = current.get(t.pane) === t;
    t.state =
      newest && pane && pane.state === "busy"
        ? "working"
        : newest && pane && pane.state === "asking"
          ? "waiting"
          : "done";
    const from = Date.parse(t.at);
    const to = t.state === "done" ? (t.end ? Date.parse(t.end) : NaN) : nowMs;
    t.ms = Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from : null;
  }
  return sortTasks(tasks, "newest");
}

/** The tasks in `state` ("all" for every one) whose words, pane, agent or project match `query`. */
export function shownTasks(tasks, state, query, nameOf) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  return tasks.filter((t) => {
    if (state !== "all" && t.state !== state) return false;
    if (!q) return true;
    return [t.request, t.reply, nameOf(t.pane), t.by ? nameOf(t.by) : "", t.agent, t.project].some(
      (s) => typeof s === "string" && s.toLowerCase().includes(q),
    );
  });
}

/** Newest first (ties by id, newest id first). */
const newestFirst = (a, b) => -byTime(a, b);

/** Text order that puts empty values last. */
const textOrder = (a, b) => (!a ? (b ? 1 : 0) : !b ? -1 : a.localeCompare(b));

/** The tasks sorted by `sort` (one of TASK_SORTS; anything else is newest). */
export function sortTasks(tasks, sort) {
  const list = [...tasks];
  if (sort === "oldest") return list.sort(byTime);
  if (sort === "agent")
    return list.sort((a, b) => textOrder(a.agent, b.agent) || newestFirst(a, b));
  if (sort === "project")
    return list.sort(
      (a, b) => textOrder(projectName(a.project), projectName(b.project)) || newestFirst(a, b),
    );
  if (sort === "longest")
    return list.sort(
      (a, b) =>
        (a.ms === null ? (b.ms === null ? 0 : 1) : b.ms === null ? -1 : b.ms - a.ms) ||
        newestFirst(a, b),
    );
  return list.sort(newestFirst);
}

/**
 * Groups for a sorted list: one per agent or project when that is the sort
 * (`label` is the agent or the project's folder name, "" when unknown), else
 * a single group with no label.
 */
export function groupTasks(sorted, sort) {
  if (sort !== "agent" && sort !== "project") return [{ label: null, items: sorted }];
  const keyOf = (t) => (sort === "agent" ? t.agent : projectName(t.project));
  const groups = [];
  for (const t of sorted) {
    const label = keyOf(t) || "";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  }
  return groups;
}

/** How many tasks are in each state. */
export function countStates(tasks) {
  const n = { all: tasks.length, working: 0, waiting: 0, done: 0 };
  for (const t of tasks) n[t.state] += 1;
  return n;
}

/** `ms` as whole hours, minutes and seconds: { h, m, s }, or null. */
export function duration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  const total = Math.round(ms / 1000);
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
