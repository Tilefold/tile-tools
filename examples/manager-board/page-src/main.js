/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page
 *
 * The board: a header with the view switch (Timeline, Lanes, Tasks) and Export,
 * the scope (everything, a manager's team, a project, a fold), the kinds
 * and a search, then Waiting on you, Now (the open agent panes) and the
 * view. Long texts open in full in a sheet over the board.
 *
 * Messages with the tile: the page says `hello` when it loads and gets
 * `setup` (the labels in the user's language and the choices kept from last
 * time). It asks for timeline calls with `call` ({ id, call, args }) and
 * gets `reply` ({ id, value } or { id, error }: not-allowed, slow, failed),
 * sends `keep` when a choice changes and `close` for its close button.
 * While the page is visible it asks for what's new every POLL_MS; older
 * pages load on Load older. Labels hold `{pane}`, `{from}`, `{to}`,
 * `{target}`, `{name}` or `{id}` where those go.
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 *
 * Modified 2026-11-15 (Tasks view): a third view lists one row per task
 *   (tasks.js, tasksView.js), with its own sort and state choices, kept like
 *   the others; labels may hold `{count}` too.
 * Modified 2026-11-15 (cards open in place): clicking a card opens it in
 *   place with its whole text (asked for once with `fullText`, then kept),
 *   and the Timeline joins an agent's reply lines into one card that opens
 *   to show them all. Which cards are open isn't kept.
 * Modified 2026-11-15 (one pane only): clicking a Now card narrows every
 *   view to that pane (`onlyPane`), with a chip above the view to show every
 *   pane again; not kept, since panes come and go.
 *
 * Last updated by: Tilefold
 */
import { h } from "./dom.js";
import { involving, merge, paneName, replies, shown } from "./model.js";
import { lanesView, windowOf } from "./lanes.js";
import { now as nowView, timeline } from "./views.js";
import { TASK_SORTS, TASK_STATES, duration, shownTasks, sortTasks, tasksOf } from "./tasks.js";
import { tasksView } from "./tasksView.js";
import { createCards, onlyChip } from "./cards.js";

/** How often a visible page asks for what's new, in ms. */
export const POLL_MS = 6000;
/** How long the page waits for the tile's answer, in ms. */
const REPLY_MS = 15000;
/** Events in one page. */
const PAGE = 100;
const KINDS = ["turn", "message", "ask", "nudge", "heartbeat", "run"];
/** The label of each time window, by its minutes. */
const WINDOW_KEYS = { 60: "window-hour", 120: "window-two-hours", 240: "window-four-hours" };

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);

let labels = {};
/** A label with its `{marks}` filled in. */
const L = (key, vars = {}) =>
  String(labels[key] ?? "").replace(/\{(pane|from|to|target|name|id|count)\}/g, (_, k) =>
    String(vars[k] ?? ""),
  );

const st = {
  kept: {
    view: "timeline",
    filter: { kind: "all" },
    kinds: [...KINDS],
    windowMin: 120,
    taskSort: TASK_SORTS[0],
    taskState: TASK_STATES[0],
  },
  events: [],
  next: null,
  panes: [],
  filters: { managers: [], projects: [], folds: [] },
  query: "",
  picked: null,
  fresh: new Set(),
  loading: false,
  error: null,
  started: false,
  /** The pane the board is narrowed to (its Now card clicked), or null. */
  onlyPane: null,
  /** The cards open in place, by key. */
  expanded: new Set(),
  /** Whole texts already fetched, by event id. */
  full: new Map(),
};

/* ------------------------------ The tile ------------------------------- */
const waits = new Map();
let nextId = 0;

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (bridge) bridge.post(message).catch(() => {});
};

/** One timeline call through the tile. */
function call(name, args = {}) {
  const id = `c${++nextId}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waits.delete(id);
      reject(new Error("failed"));
    }, REPLY_MS);
    waits.set(id, { resolve, reject, timer });
    send({ type: "call", id, call: name, args });
  });
}

function replied(m) {
  const w = typeof m.id === "string" && waits.get(m.id);
  if (!w) return;
  waits.delete(m.id);
  clearTimeout(w.timer);
  if (m.error) w.reject(new Error(String(m.error)));
  else w.resolve(m.value);
}

const keep = () => send({ type: "keep", kept: st.kept });

/* ------------------------------- Times --------------------------------- */
let timeFormat = null;
const timeOf = (at) => {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : timeFormat.format(d);
};
/** The hour an event falls in, on its day, in the user's time zone. */
const hourOf = (at) => {
  const d = new Date(at);
  d.setMinutes(0, 0, 0);
  const day =
    d.toDateString() === new Date().toDateString()
      ? ""
      : `${d.toLocaleDateString(labels["page-lang"])} `;
  return `${day}${timeFormat.format(d)}`;
};

/** The day (when not today) and the time, for a task's start. */
const whenOf = (at) => {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const today = d.toDateString() === new Date().toDateString();
  return today
    ? timeFormat.format(d)
    : `${d.toLocaleDateString(labels["page-lang"])} ${timeFormat.format(d)}`;
};

/** A length in the user's language: hours and minutes, minutes, or seconds. */
const durationOf = (ms) => {
  const d = duration(ms);
  if (!d) return "";
  const unit = (n, u) =>
    new Intl.NumberFormat(labels["page-lang"] || undefined, {
      style: "unit",
      unit: u,
      unitDisplay: "short",
    }).format(n);
  if (d.h) return `${unit(d.h, "hour")} ${unit(d.m, "minute")}`;
  if (d.m)
    return d.m < 5 && d.s ? `${unit(d.m, "minute")} ${unit(d.s, "second")}` : unit(d.m, "minute");
  return unit(d.s, "second");
};

/* ------------------------------ Loading -------------------------------- */
const nameOf = (p) => paneName(p, st.panes, L);

/** The error's words, shown above the view. */
function failed(err) {
  const code = err && err.message;
  st.error =
    code === "not-allowed" ? "error-not-allowed" : code === "slow" ? "error-slow" : "error-failed";
  render();
}

/** What's new: the newest page, the open panes, and once in a while the scope's choices. */
async function refresh(first = false) {
  try {
    const [page, panes] = await Promise.all([
      call("events", { filter: st.kept.filter, limit: PAGE }),
      call("now"),
    ]);
    if (first) st.filters = (await call("filters")) || st.filters;
    const before = new Set(st.events.map((e) => e.id));
    st.events = merge(st.events, page.events || []);
    if (first) st.next = page.next || null;
    st.fresh = first
      ? new Set()
      : new Set(st.events.filter((e) => !before.has(e.id)).map((e) => e.id));
    st.panes = Array.isArray(panes) ? panes : [];
    st.error = null;
    render();
  } catch (err) {
    failed(err);
  }
}

async function older() {
  if (!st.next || st.loading) return;
  st.loading = true;
  render();
  try {
    const page = await call("events", { filter: st.kept.filter, before: st.next, limit: PAGE });
    st.events = merge(st.events, page.events || []);
    st.next = page.next || null;
    st.fresh = new Set();
  } catch (err) {
    failed(err);
  }
  st.loading = false;
  render();
}

/** A new scope starts the list again. */
function rescope(filter) {
  st.kept.filter = filter;
  st.events = [];
  st.next = null;
  st.picked = null;
  keep();
  render();
  refresh(true);
}

/** Cards opening in place, and the whole texts they fetch. */
const cards = createCards({ st, call, render: () => render() });

/* ------------------------------ Drawing -------------------------------- */
function scopeOptions() {
  const opts = [{ kind: "all", label: L("scope-all") }];
  for (const m of st.filters.managers || [])
    opts.push({
      kind: "team",
      value: m.pane,
      label: L("scope-team", { name: m.name || nameOf(m.pane) }),
    });
  for (const p of st.filters.projects || [])
    opts.push({
      kind: "project",
      value: p,
      label: L("scope-project", { name: p.split(/[\\/]/).pop() || p }),
    });
  for (const f of st.filters.folds || [])
    opts.push({ kind: "fold", value: f.id, label: L("scope-fold", { name: f.name }) });
  const f = st.kept.filter;
  // A kept scope that's no longer offered stays chosen until changed.
  if (f.kind !== "all" && !opts.some((o) => o.kind === f.kind && o.value === f.value)) {
    opts.push({ kind: f.kind, value: f.value, label: f.value });
  }
  const sel = $("scope");
  sel.replaceChildren(
    ...opts.map((o, i) =>
      h(
        "option",
        { value: String(i), selected: o.kind === f.kind && (o.value ?? "") === (f.value ?? "") },
        o.label,
      ),
    ),
  );
  sel.onchange = () => {
    const o = opts[Number(sel.value)];
    rescope(o.kind === "all" ? { kind: "all" } : { kind: o.kind, value: o.value });
  };
}

function kindChips() {
  $("kinds").replaceChildren(
    ...KINDS.map((k) =>
      h(
        "button",
        {
          type: "button",
          class: "kind",
          "aria-pressed": String(st.kept.kinds.includes(k)),
          onclick: () => {
            const on = st.kept.kinds.includes(k);
            if (on && st.kept.kinds.length === 1) return;
            st.kept.kinds = on
              ? st.kept.kinds.filter((x) => x !== k)
              : KINDS.filter((x) => x === k || st.kept.kinds.includes(x));
            keep();
            render();
          },
        },
        L(`kind-${k}`),
      ),
    ),
  );
}

/** Opens an event's whole text in the sheet. */
async function openFull(e) {
  $("full-title").textContent = L("loading-text");
  $("full-text").textContent = "";
  $("sheet").hidden = false;
  $("full-close").focus();
  try {
    const text = await call("fullText", { id: e.id });
    $("full-text").textContent = typeof text === "string" ? text : e.summary;
  } catch {
    $("full-text").textContent = e.summary;
  }
  $("full-title").textContent = `${timeOf(e.at)} · ${nameOf(e.pane)}`;
}

function render() {
  if (!st.started) return;
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === st.kept.view));
  const tasks = st.kept.view === "tasks";
  $("window").hidden = st.kept.view !== "lanes";
  $("window").value = String(st.kept.windowMin);
  // Tasks are built from turns and messages, whatever kinds the other views keep.
  $("kinds").hidden = tasks;
  $("task-sort").hidden = !tasks;
  $("task-state").hidden = !tasks;
  $("task-sort").value = st.kept.taskSort;
  $("task-state").value = st.kept.taskState;
  scopeOptions();
  kindChips();
  const ctx = {
    L,
    panes: st.panes,
    timeOf,
    hourOf,
    onFull: openFull,
    fresh: st.fresh,
    picked: st.picked,
    onPick: (id) => ((st.picked = id), render()),
    whenOf,
    durationOf,
    onlyPane: st.onlyPane,
    expanded: st.expanded,
    onToggle: (e) => void cards.toggle(e),
    textOf: cards.textOf,
    onPane: (pane) => {
      st.onlyPane = st.onlyPane === pane ? null : pane;
      st.picked = null;
      render();
    },
  };
  const list = involving(shown(st.events, st.kept.kinds, st.query, nameOf), st.onlyPane);
  const older$ = { more: !!st.next, onOlder: older, loading: st.loading };
  let view;
  if (tasks) {
    const all = tasksOf(st.events, st.panes).filter((t) => !st.onlyPane || t.pane === st.onlyPane);
    const picked = shownTasks(all, st.kept.taskState, st.query, nameOf);
    view = tasksView(all, sortTasks(picked, st.kept.taskSort), ctx, {
      sort: st.kept.taskSort,
      nameOf,
      ...older$,
    });
  } else if (st.kept.view === "lanes") {
    view = lanesView(list, ctx, windowOf(Date.now(), st.kept.windowMin));
  } else {
    view = timeline(replies(list), ctx, older$);
  }
  $("content").replaceChildren(
    ...(st.error ? [h("p", { class: "error", role: "alert" }, L(st.error))] : []),
    nowView(st.events, ctx),
    ...(st.onlyPane ? [onlyChip(st, L, nameOf, render)] : []),
    view,
  );
}

/* ------------------------------- Setup --------------------------------- */
function setup(m) {
  labels = m.labels && typeof m.labels === "object" ? m.labels : {};
  if (m.kept && typeof m.kept === "object") st.kept = { ...st.kept, ...m.kept };
  document.documentElement.lang = labels["page-lang"] || "en";
  document.documentElement.dir = labels["page-dir"] === "rtl" ? "rtl" : "ltr";
  timeFormat = new Intl.DateTimeFormat(labels["page-lang"] || undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  document.title = L("page-title");
  $("title").textContent = L("page-title");
  $("close").setAttribute("aria-label", L("page-close"));
  $("views").setAttribute("aria-label", L("view-label"));
  $("view-timeline").textContent = L("view-timeline");
  $("view-lanes").textContent = L("view-lanes");
  $("view-tasks").textContent = L("view-tasks");
  $("task-sort").setAttribute("aria-label", L("task-sort-label"));
  for (const o of $("task-sort").options) o.textContent = L(`task-sort-${o.value}`);
  $("task-state").setAttribute("aria-label", L("task-state-label"));
  for (const o of $("task-state").options) o.textContent = L(`task-show-${o.value}`);
  $("scope").setAttribute("aria-label", L("scope-label"));
  $("kinds").setAttribute("aria-label", L("kinds-label"));
  $("search").setAttribute("placeholder", L("search-label"));
  $("search").setAttribute("aria-label", L("search-label"));
  $("window").setAttribute("aria-label", L("window-label"));
  for (const o of $("window").options) o.textContent = L(WINDOW_KEYS[o.value]);
  $("export").textContent = L("export-label");
  $("export-markdown").textContent = L("export-markdown");
  $("export-json").textContent = L("export-json");
  $("full-close").textContent = L("full-close");
  st.started = true;
  render();
  refresh(true);
}

function wire() {
  for (const b of document.querySelectorAll("[data-view]")) {
    b.addEventListener("click", () => {
      st.kept.view = b.dataset.view;
      keep();
      render();
    });
  }
  for (const [id, key, allowed] of [
    ["task-sort", "taskSort", TASK_SORTS],
    ["task-state", "taskState", TASK_STATES],
  ]) {
    $(id).addEventListener("change", () => {
      if (!allowed.includes($(id).value)) return;
      st.kept[key] = $(id).value;
      keep();
      render();
    });
  }
  $("window").addEventListener("change", () => {
    st.kept.windowMin = Number($("window").value);
    keep();
    render();
  });
  $("search").addEventListener("input", () => {
    st.query = $("search").value.slice(0, 200);
    render();
  });
  $("close").addEventListener("click", () => send({ type: "close" }));
  $("export").addEventListener("click", () => ($("export-menu").hidden = !$("export-menu").hidden));
  for (const [id, format] of [
    ["export-markdown", "markdown"],
    ["export-json", "json"],
  ]) {
    $(id).addEventListener("click", () => {
      $("export-menu").hidden = true;
      call("export", { filter: st.kept.filter, format }).catch(failed);
    });
  }
  $("full-close").addEventListener("click", () => ($("sheet").hidden = true));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("sheet").hidden = true;
      $("export-menu").hidden = true;
    }
  });
  setInterval(() => {
    if (st.started && document.visibilityState === "visible") refresh(false);
  }, POLL_MS);
}

if (bridge) {
  wire();
  bridge.onMessage((m) => {
    if (!m || typeof m !== "object") return;
    if (m.do === "setup") setup(m);
    else if (m.do === "reply") replied(m);
  });
  send({ type: "hello" });
}
