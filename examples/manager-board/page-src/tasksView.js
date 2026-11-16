/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — the Tasks view
 *
 * One row per task (see tasks.js): the request, who asked which pane, the
 * agent, the project, when it started, how long it took and its state, then
 * the agent's last reply. Rows sit under a heading per agent or project
 * when that is the sort. A count of tasks by state heads the list, and
 * Load older reaches further back, as in the Timeline.
 *
 * `ctx` is the views' context (see views.js) with `whenOf(at)` (the day,
 * when not today, and the time) and `durationOf(ms)` (a length in the
 * user's language). Every text is set as text.
 */
import { h } from "./dom.js";
import { countStates, groupTasks, projectName } from "./tasks.js";

const STATE_TONE = { working: "info", waiting: "warning", done: "success" };

/** The event `onFull` opens for one side of a task. */
const asEvent = (t, side) =>
  side === "request"
    ? { id: t.requestId, at: t.at, pane: t.pane, summary: t.request || "" }
    : { id: t.replyId, at: t.end || t.at, pane: t.pane, summary: t.reply || "" };

/** Who asked which pane: "You asked 2 · api" or "1 · lead asked 2 · api". */
function askedLine(t, ctx, nameOf) {
  const pane = nameOf(t.pane);
  if (t.by === "you") return ctx.L("task-by-you", { pane });
  if (t.by) return ctx.L("task-by-pane", { from: nameOf(t.by), to: pane });
  return pane;
}

/** One task's row. */
export function taskRow(t, ctx, nameOf) {
  const tone = STATE_TONE[t.state] || "muted";
  const length = t.ms === null ? "" : ctx.durationOf(t.ms);
  return h(
    "article",
    { class: `task ${t.state}${ctx.fresh.has(t.id) ? " fresh" : ""}`, "data-task": t.id },
    h(
      "div",
      { class: "task-head" },
      h(
        "p",
        { class: `task-ask${t.request === null ? " muted" : ""}` },
        t.request === null ? ctx.L("task-earlier") : t.request,
      ),
      h("span", { class: `status ${tone}` }, ctx.L(`task-state-${t.state}`)),
    ),
    h(
      "div",
      { class: "task-meta" },
      h("span", {}, askedLine(t, ctx, nameOf)),
      t.agent && h("span", { class: "chip" }, t.agent),
      t.project && h("span", { class: "muted", title: t.project }, projectName(t.project)),
      h("time", { datetime: t.at }, ctx.whenOf(t.at)),
      length &&
        h(
          "span",
          { class: "muted", title: ctx.L("task-took") },
          t.state === "done" ? length : `${length} …`,
        ),
    ),
    h(
      "p",
      { class: `task-reply${t.reply === null ? " muted" : ""}` },
      t.reply === null ? ctx.L("task-no-reply") : t.reply,
    ),
    (t.requestMore || (t.reply !== null && t.replyId)) &&
      h(
        "div",
        { class: "task-links" },
        t.requestMore &&
          h(
            "button",
            { type: "button", class: "link", onclick: () => ctx.onFull(asEvent(t, "request")) },
            ctx.L("show-full"),
          ),
        t.reply !== null &&
          t.replyId &&
          h(
            "button",
            { type: "button", class: "link", onclick: () => ctx.onFull(asEvent(t, "reply")) },
            ctx.L("task-show-reply"),
          ),
      ),
  );
}

/**
 * The view: the count, then the groups. `all` are every loaded task (for
 * the count), `list` the ones shown, sorted by `sort`.
 */
export function tasksView(all, list, ctx, { sort, nameOf, more, onOlder, loading }) {
  const n = countStates(all);
  const count = h(
    "p",
    { class: "task-count muted", role: "status" },
    [
      ctx.L("task-count", { count: n.all }),
      n.working && ctx.L("task-count-working", { count: n.working }),
      n.waiting && ctx.L("task-count-waiting", { count: n.waiting }),
    ]
      .filter(Boolean)
      .join(" · "),
  );
  const body = list.length
    ? groupTasks(list, sort).map((g) =>
        h(
          "section",
          { class: "task-group" },
          g.label !== null && h("h3", {}, g.label || ctx.L("task-unknown")),
          g.items.map((t) => taskRow(t, ctx, nameOf)),
        ),
      )
    : [h("p", { class: "empty muted" }, ctx.L("tasks-empty"))];
  const end = more
    ? h(
        "button",
        { type: "button", class: "older", id: "older", disabled: loading, onclick: onOlder },
        loading ? ctx.L("loading-text") : ctx.L("load-older"),
      )
    : h("p", { class: "start muted" }, ctx.L("history-start"));
  return h("div", { class: "tasks" }, count, ...body, end);
}
