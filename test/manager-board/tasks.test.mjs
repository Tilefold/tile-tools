// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — tasks
 *
 * A prompt you type, or a manager's message handing a pane work, starts a
 * task; the pane's agent replies belong to it until the next one starts
 * there, and a reply with no prompt loaded makes a task with no request.
 * Only a pane's newest task can still be going: working while its agent
 * works, waiting while it asks you, done otherwise. Tasks filter by state
 * and search, sort newest, oldest, by agent, by project and longest first,
 * group under agents or projects, count by state, and their lengths split
 * into hours, minutes and seconds.
 */
import { describe, expect, it } from "vitest";
import {
  countStates,
  duration,
  groupTasks,
  projectName,
  shownTasks,
  sortTasks,
  TASK_SORTS,
  TASK_STATES,
  tasksOf,
} from "../../examples/manager-board/page-src/tasks.js";
import { API, at, EVENTS, GONE, LEAD, NOW } from "./fixtures.mjs";

/** A turn in `pane`, at minute `m`. */
const turn = (id, m, pane, who, summary, extra = {}) => ({
  id,
  at: at(m),
  kind: "turn",
  pane,
  to: null,
  who,
  summary,
  more: true,
  status: null,
  project: "/w/app",
  detail: {},
  ...extra,
});

const NOW_MS = Date.parse(at(10));
const names = { [LEAD]: "1 · lead", [API]: "2 · api" };
const nameOf = (p) => names[p] || "closed";

describe("tasks from the timeline", () => {
  it("starts a task at your prompt and at a manager's message, and gives each its replies", () => {
    const tasks = tasksOf(EVENTS, NOW, NOW_MS);
    expect(tasks.map((t) => t.id)).toEqual(["message:m1", "turn:t1"]);
    const [handed, asked] = tasks;
    expect(asked).toMatchObject({
      pane: LEAD,
      by: "you",
      request: "Add refunds. Split it up.",
      requestMore: true,
      reply: "Opening a pane for the API.",
      replies: 1,
      end: at(2),
      agent: "claude",
      project: "/w/app",
      state: "done",
      ms: 60_000,
    });
    // The worker was handed work by the lead, hasn't replied, and is asking the user.
    expect(handed).toMatchObject({
      pane: API,
      by: LEAD,
      request: "Your task: POST /refunds",
      reply: null,
      agent: "codex",
      state: "waiting",
      ms: 6 * 60_000,
    });
  });

  it("keeps questions, answers and reports out: they are not work handed out", () => {
    const tasks = tasksOf(EVENTS, NOW, NOW_MS);
    expect(tasks.some((t) => t.id === "message:m2")).toBe(false);
  });

  it("makes a task with no request for replies whose prompt isn't loaded", () => {
    const [t] = tasksOf([turn("turn:r", 5, LEAD, "agent", "Done with it.")], NOW, NOW_MS);
    expect(t).toMatchObject({ request: null, requestId: null, reply: "Done with it.", by: null });
  });

  it("joins every reply to the task under way, the last one shown", () => {
    const [t] = tasksOf(
      [
        turn("turn:a", 1, LEAD, "you", "Do it"),
        turn("turn:b", 2, LEAD, "agent", "Starting"),
        turn("turn:c", 4, LEAD, "agent", "Finished"),
      ],
      NOW,
      NOW_MS,
    );
    expect(t).toMatchObject({ replies: 2, reply: "Finished", replyId: "turn:c", ms: 3 * 60_000 });
  });

  it("is working only while it is its pane's newest task and the agent works", () => {
    const busy = [{ ...NOW[0], state: "busy" }];
    const tasks = tasksOf(
      [turn("turn:a", 1, LEAD, "you", "First"), turn("turn:b", 3, LEAD, "you", "Second")],
      busy,
      NOW_MS,
    );
    expect(tasks.map((t) => [t.request, t.state])).toEqual([
      ["Second", "working"],
      ["First", "done"],
    ]);
    // Still going: its length runs to now.
    expect(tasks[0].ms).toBe(7 * 60_000);
    // Done without a reply: no length.
    expect(tasks[1].ms).toBeNull();
  });

  it("calls a closed pane's task done, and takes the agent from the turn when the pane is gone", () => {
    const [t] = tasksOf(
      [
        turn("turn:a", 1, GONE, "you", "Old work"),
        turn("turn:b", 2, GONE, "agent", "Done", { detail: { cli: "codex" } }),
      ],
      NOW,
      NOW_MS,
    );
    expect(t).toMatchObject({ state: "done", agent: "codex" });
  });

  it("filters by state and by words, pane names, agent and project", () => {
    const tasks = tasksOf(EVENTS, NOW, NOW_MS);
    expect(shownTasks(tasks, "waiting", "", nameOf).map((t) => t.id)).toEqual(["message:m1"]);
    expect(shownTasks(tasks, "done", "", nameOf).map((t) => t.id)).toEqual(["turn:t1"]);
    expect(shownTasks(tasks, "all", "REFUNDS", nameOf)).toHaveLength(2);
    expect(shownTasks(tasks, "all", "codex", nameOf).map((t) => t.id)).toEqual(["message:m1"]);
    expect(shownTasks(tasks, "all", "lead", nameOf)).toHaveLength(2);
    expect(shownTasks(tasks, "all", "nothing like it", nameOf)).toEqual([]);
  });
});

describe("sorting, grouping and counting tasks", () => {
  const t = (id, m, agent, project, ms) => ({
    id,
    at: at(m),
    agent,
    project,
    ms,
    state: "done",
  });
  const list = [
    t("a", 1, "codex", "/w/b", 5000),
    t("b", 2, "claude", "/w/a", null),
    t("c", 3, "", "", 90_000),
    t("d", 4, "claude", "/w/b", 1000),
  ];
  const ids = (l) => l.map((x) => x.id);

  it("offers newest first by default", () => {
    expect(TASK_SORTS[0]).toBe("newest");
    expect(TASK_STATES[0]).toBe("all");
    expect(ids(sortTasks(list, "newest"))).toEqual(["d", "c", "b", "a"]);
    expect(ids(sortTasks(list, "anything"))).toEqual(["d", "c", "b", "a"]);
    expect(ids(sortTasks(list, "oldest"))).toEqual(["a", "b", "c", "d"]);
  });

  it("sorts by agent and by project, newest first within each, unknown last", () => {
    expect(ids(sortTasks(list, "agent"))).toEqual(["d", "b", "a", "c"]);
    expect(ids(sortTasks(list, "project"))).toEqual(["b", "d", "a", "c"]);
  });

  it("sorts longest first, tasks with no length last", () => {
    expect(ids(sortTasks(list, "longest"))).toEqual(["c", "a", "d", "b"]);
  });

  it("groups under each agent or project, and not for the time sorts", () => {
    const g = groupTasks(sortTasks(list, "agent"), "agent");
    expect(g.map((x) => [x.label, ids(x.items)])).toEqual([
      ["claude", ["d", "b"]],
      ["codex", ["a"]],
      ["", ["c"]],
    ]);
    expect(groupTasks(sortTasks(list, "project"), "project").map((x) => x.label)).toEqual([
      "a",
      "b",
      "",
    ]);
    expect(groupTasks(list, "newest")).toEqual([{ label: null, items: list }]);
  });

  it("counts tasks by state", () => {
    expect(
      countStates([
        { state: "working" },
        { state: "done" },
        { state: "waiting" },
        { state: "done" },
      ]),
    ).toEqual({ all: 4, working: 1, waiting: 1, done: 2 });
  });

  it("splits a length into hours, minutes and seconds", () => {
    expect(duration(4_980_000)).toEqual({ h: 1, m: 23, s: 0 });
    expect(duration(65_400)).toEqual({ h: 0, m: 1, s: 5 });
    expect(duration(-1)).toBeNull();
    expect(duration(null)).toBeNull();
    expect(projectName("/Users/me/app")).toBe("app");
    expect(projectName("C:\\work\\api")).toBe("api");
  });
});
