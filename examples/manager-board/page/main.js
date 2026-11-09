/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page
 *
 * The board: a header with the view switch (Timeline, Lanes) and Export,
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
 */
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/dom.js
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === void 0 || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = String(v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of children.flat()) {
      if (c === null || c === void 0 || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  function glyphOf(e) {
    if (e.kind === "turn") return e.who === "you" ? "\u276F" : e.who === "tilefold" ? "\u2301" : "\u25CF";
    return { message: "\u2709", ask: "?", nudge: "\u21BB", heartbeat: "\u2665", run: "\u23F1" }[e.kind] || "\u2022";
  }

  // page-src/model.js
  var MAX_LOADED = 2e3;
  function sortNewest(list) {
    return [...list].sort(
      (a, b) => a.at === b.at ? a.id < b.id ? 1 : a.id > b.id ? -1 : 0 : a.at < b.at ? 1 : -1
    );
  }
  function isEvent(e) {
    return !!e && typeof e === "object" && typeof e.id === "string" && typeof e.at === "string" && typeof e.kind === "string" && typeof e.pane === "string" && typeof e.summary === "string";
  }
  function merge(list, incoming) {
    const byId = new Map(list.map((e) => [e.id, e]));
    for (const e of incoming) if (isEvent(e)) byId.set(e.id, e);
    return sortNewest([...byId.values()]).slice(0, MAX_LOADED);
  }
  function shown(list, kinds, query, nameOf2) {
    const q = query.trim().toLowerCase();
    return list.filter(
      (e) => kinds.includes(e.kind) && (!q || e.summary.toLowerCase().includes(q) || nameOf2(e.pane).toLowerCase().includes(q) || e.to != null && nameOf2(e.to).toLowerCase().includes(q))
    );
  }
  var shortId = (pane) => pane.replace(/^tilefold:/, "").slice(-4);
  function paneName(pane, panes, L2) {
    if (!pane) return "";
    const open = panes.find((p) => p.pane === pane);
    if (open && open.name) return open.name;
    if (pane.startsWith("schedule:")) return L2("who-schedules");
    return L2("pane-closed", { id: shortId(pane) });
  }
  function headline(e, panes, L2) {
    const name = (p) => paneName(p, panes, L2);
    const d = e.detail && typeof e.detail === "object" ? e.detail : {};
    const pane = name(e.pane);
    switch (e.kind) {
      case "turn":
        if (e.who === "you") return { text: L2("h-you", { pane }), tone: "you" };
        if (e.who === "tilefold") return { text: L2("h-typed", { pane }), tone: "tilefold" };
        return { text: L2("h-agent", { pane }), tone: "agent" };
      case "message": {
        const key = { question: "h-question", answer: "h-answer", report: "h-report" }[d.kind] || "h-message";
        const from = e.who === "schedule" ? L2("who-schedules") : pane;
        return {
          text: L2(key, { from, to: name(e.to) }),
          tone: d.kind === "question" ? "question" : "agent"
        };
      }
      case "ask": {
        const tone = e.status === "new" ? "question" : "ask";
        if (d.tool === "heartbeat-create") {
          const target = typeof d.pane === "string" ? name(`tilefold:${d.pane}`) : "";
          return { text: L2("h-ask-heartbeat", { pane, target }), tone };
        }
        if (d.tool === "schedule-create") return { text: L2("h-ask-schedule", { pane }), tone };
        return { text: L2("h-ask-open", { pane }), tone };
      }
      case "nudge":
        return { text: L2("h-nudge", { pane }), tone: "tilefold" };
      case "heartbeat":
        return { text: L2("h-heartbeat", { pane }), tone: "tilefold" };
      case "run": {
        const runName = typeof d.name === "string" ? d.name : "";
        return {
          text: L2("h-run", { name: runName }),
          tone: e.status === "started" ? "schedule" : "warn"
        };
      }
      default:
        return { text: pane, tone: "agent" };
    }
  }
  var STATUS = {
    ask: {
      new: ["st-ask-new", "warning"],
      running: ["st-ask-running", "info"],
      done: ["st-ask-done", "success"],
      failed: ["st-failed", "error"],
      denied: ["st-ask-denied", "error"],
      expired: ["st-ask-expired", "muted"]
    },
    message: {
      new: ["st-msg-sending", "muted"],
      sent: ["st-msg-sending", "muted"],
      held: ["st-msg-held", "warning"],
      delivered: ["st-msg-delivered", "info"],
      read: ["st-msg-read", "muted"],
      refused: ["st-msg-refused", "error"]
    },
    heartbeat: {
      done: ["st-hb-done", "success"],
      stopped: ["st-hb-stopped", "muted"],
      expired: ["st-hb-expired", "muted"]
    },
    run: {
      starting: ["st-run-started", "success"],
      started: ["st-run-started", "success"],
      missed: ["st-run-missed", "warning"],
      skipped: ["st-run-skipped", "warning"],
      failed: ["st-failed", "error"]
    }
  };
  function statusOf(e, L2) {
    const s = e.status && STATUS[e.kind] && STATUS[e.kind][e.status];
    return s ? { text: L2(s[0]), tone: s[1] } : null;
  }
  function waiting(panes, list, L2) {
    const out = [];
    for (const p of panes) {
      if (p.state === "asking")
        out.push({
          pane: p.pane,
          text: L2("waiting-asking", { pane: p.name || paneName(p.pane, panes, L2) })
        });
    }
    for (const e of list) {
      if (out.length >= 6) break;
      if (e.kind === "message" && e.detail && e.detail.kind === "question" && e.status === "delivered") {
        const from = paneName(e.pane, panes, L2);
        out.push({
          pane: e.pane,
          id: e.id,
          text: L2("waiting-question", { from, to: paneName(e.to, panes, L2) }),
          summary: e.summary
        });
      }
    }
    return out;
  }
  function byHour(list, hourOf2) {
    const groups = [];
    for (const e of list) {
      const label = hourOf2(e.at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(e);
      else groups.push({ label, items: [e] });
    }
    return groups;
  }
  function laneOf(e) {
    if (e.kind === "turn" && e.who === "you") return "you";
    if (e.who === "tilefold" || e.kind === "nudge" || e.kind === "heartbeat") return "tilefold";
    if (e.who === "schedule" || e.kind === "run") return "schedule";
    return e.pane;
  }
  function lanes(list, panes) {
    const ids = /* @__PURE__ */ new Set();
    for (const e of list) {
      ids.add(laneOf(e));
      if (e.kind === "message" && e.to) ids.add(e.to);
    }
    const roleOf = (id) => (panes.find((p) => p.pane === id) || {}).role;
    const rank = (id) => id === "you" ? 0 : id === "tilefold" ? 8 : id === "schedule" ? 9 : { manager: 1, opened: 2 }[roleOf(id)] || 3;
    return [...ids].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0)).map((id) => ({ id, pane: panes.find((p) => p.pane === id) || null }));
  }
  function place(at, from, to) {
    const t = Date.parse(at);
    const a = Date.parse(from);
    const b = Date.parse(to);
    return b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 0;
  }

  // page-src/views.js
  var STATE_KEY = {
    ready: "state-ready",
    idle: "state-idle",
    busy: "state-busy",
    asking: "state-asking"
  };
  var lastOf = (list, pane) => list.find((e) => e.pane === pane);
  function card(e, ctx) {
    const head = headline(e, ctx.panes, ctx.L);
    const status = statusOf(e, ctx.L);
    return h(
      "article",
      { class: `ev ${head.tone}${ctx.fresh.has(e.id) ? " fresh" : ""}`, "data-id": e.id },
      h("time", { datetime: e.at }, ctx.timeOf(e.at)),
      h("span", { class: "dot", "aria-hidden": "true" }, glyphOf(e)),
      h(
        "div",
        { class: "body" },
        h(
          "div",
          { class: "head" },
          h("span", { class: "who" }, head.text),
          status && h("span", { class: `status ${status.tone}` }, status.text)
        ),
        h("p", { class: "sum" }, e.summary),
        e.more && h(
          "button",
          { type: "button", class: "link", "data-full": e.id, onclick: () => ctx.onFull(e) },
          ctx.L("show-full")
        )
      )
    );
  }
  function now(list, ctx) {
    const wait = waiting(ctx.panes, list, ctx.L);
    const box = h("div", { class: "now-wrap" });
    if (wait.length) {
      box.append(
        h(
          "div",
          { class: "wait", role: "note" },
          h("b", {}, ctx.L("waiting-title")),
          h(
            "ul",
            {},
            wait.map(
              (w) => h(
                "li",
                {},
                h("span", {}, w.text),
                w.summary && h("span", { class: "muted" }, `: ${w.summary}`)
              )
            )
          )
        )
      );
    }
    const cards = ctx.panes.map(
      (p) => h(
        "div",
        { class: `pane ${p.state}` },
        h(
          "div",
          { class: "row" },
          h("span", { class: "state", "aria-hidden": "true" }),
          h("b", {}, p.name || p.pane.slice(-4)),
          p.role === "manager" && h("span", { class: "chip" }, ctx.L("role-manager")),
          h("span", { class: "spacer" }),
          h("span", { class: "muted agent" }, p.agent)
        ),
        h(
          "span",
          { class: "doing" },
          h("b", {}, ctx.L(STATE_KEY[p.state] || "state-idle")),
          lastOf(list, p.pane) && ` \xB7 ${lastOf(list, p.pane).summary}`
        )
      )
    );
    box.append(
      h(
        "section",
        { class: "now", "aria-label": ctx.L("now-title") },
        cards.length ? cards : h("span", { class: "muted" }, ctx.L("now-none"))
      )
    );
    return box;
  }
  function empty(ctx) {
    return h(
      "div",
      { class: "empty" },
      h("b", {}, ctx.L("empty-title")),
      h("span", { class: "muted" }, ctx.L("empty-text"))
    );
  }
  function timeline(list, ctx, { more, onOlder, loading }) {
    if (!list.length && !more) return empty(ctx);
    const rail = h(
      "div",
      { class: "rail" },
      byHour(list, ctx.hourOf).map(
        (g) => h(
          "section",
          { class: "hour" },
          h("h3", {}, g.label),
          g.items.map((e) => card(e, ctx))
        )
      )
    );
    const end = more ? h(
      "button",
      { type: "button", class: "older", id: "older", disabled: loading, onclick: onOlder },
      loading ? ctx.L("loading-text") : ctx.L("load-older")
    ) : h("p", { class: "start muted" }, ctx.L("history-start"));
    return h("div", {}, rail, end);
  }

  // page-src/lanes.js
  var LANE_PX = 44;
  function windowOf(nowMs, minutes) {
    const to = Math.ceil(nowMs / 6e5) * 6e5;
    return { from: new Date(to - minutes * 6e4).toISOString(), to: new Date(to).toISOString() };
  }
  function lanesView(list, ctx, win) {
    const inWindow = list.filter((e) => e.at >= win.from && e.at <= win.to);
    if (!inWindow.length) return empty(ctx);
    const rows = lanes(inWindow, ctx.panes);
    const index = new Map(rows.map((r, i) => [r.id, i]));
    const pct = (at) => `${(place(at, win.from, win.to) * 100).toFixed(2)}%`;
    const label = (id) => id === "you" ? ctx.L("who-you") : id === "tilefold" ? ctx.L("who-tilefold") : id === "schedule" ? ctx.L("who-schedules") : paneName(id, ctx.panes, ctx.L);
    const ticks = [];
    for (let t = Date.parse(win.from); t < Date.parse(win.to) - 6e5; t += 18e5) {
      const at = new Date(t).toISOString();
      ticks.push(h("span", { style: { insetInlineStart: pct(at) } }, ctx.timeOf(at)));
    }
    ticks.push(
      h("span", { class: "nowline", style: { insetInlineStart: "100%" } }, ctx.L("now-line"))
    );
    const links = inWindow.filter((e) => e.kind === "message" && index.has(e.to) && index.has(laneOf(e))).map((e) => {
      const a = index.get(laneOf(e));
      const b = index.get(e.to);
      return h("span", {
        class: `msg-line ${b > a ? "down" : "up"}`,
        "aria-hidden": "true",
        style: {
          insetInlineStart: pct(e.at),
          top: `${Math.min(a, b) * LANE_PX + LANE_PX / 2}px`,
          height: `${Math.abs(a - b) * LANE_PX}px`
        }
      });
    });
    const picked = inWindow.find((e) => e.id === ctx.picked) || inWindow[0];
    const lane = (r) => h(
      "div",
      { class: "lane" },
      h(
        "div",
        { class: "name" },
        r.pane && h("span", { class: `state ${r.pane.state}`, "aria-hidden": "true" }),
        label(r.id)
      ),
      h(
        "div",
        { class: "track" },
        inWindow.filter((e) => laneOf(e) === r.id).map(
          (e) => h(
            "button",
            {
              type: "button",
              class: `pin ${headline(e, ctx.panes, ctx.L).tone}${e.id === picked.id ? " on" : ""}${ctx.fresh.has(e.id) ? " fresh" : ""}`,
              style: { insetInlineStart: pct(e.at) },
              "data-pick": e.id,
              "aria-label": `${ctx.timeOf(e.at)} ${headline(e, ctx.panes, ctx.L).text}`,
              onclick: () => ctx.onPick(e.id)
            },
            glyphOf(e)
          )
        )
      )
    );
    return h(
      "div",
      {},
      h(
        "div",
        { class: "lanes-scroll" },
        h(
          "div",
          { class: "lanes" },
          h("div", { class: "axis" }, h("div"), h("div", { class: "ticks" }, ticks)),
          h("div", { class: "grid" }, rows.map(lane), h("div", { class: "links" }, links))
        )
      ),
      h("div", { class: "picked" }, h("h3", {}, ctx.L("picked-event")), card(picked, ctx))
    );
  }

  // page-src/main.js
  var POLL_MS = 6e3;
  var REPLY_MS = 15e3;
  var PAGE = 100;
  var KINDS = ["turn", "message", "ask", "nudge", "heartbeat", "run"];
  var WINDOW_KEYS = { 60: "window-hour", 120: "window-two-hours", 240: "window-four-hours" };
  var bridge = window.tilefold;
  var $ = (id) => document.getElementById(id);
  var labels = {};
  var L = (key, vars = {}) => String(labels[key] ?? "").replace(
    /\{(pane|from|to|target|name|id)\}/g,
    (_, k) => String(vars[k] ?? "")
  );
  var st = {
    kept: { view: "timeline", filter: { kind: "all" }, kinds: [...KINDS], windowMin: 120 },
    events: [],
    next: null,
    panes: [],
    filters: { managers: [], projects: [], folds: [] },
    query: "",
    picked: null,
    fresh: /* @__PURE__ */ new Set(),
    loading: false,
    error: null,
    started: false
  };
  var waits = /* @__PURE__ */ new Map();
  var nextId = 0;
  var send = (message) => {
    if (bridge) bridge.post(message).catch(() => {
    });
  };
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
  var keep = () => send({ type: "keep", kept: st.kept });
  var timeFormat = null;
  var timeOf = (at) => {
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? "" : timeFormat.format(d);
  };
  var hourOf = (at) => {
    const d = new Date(at);
    d.setMinutes(0, 0, 0);
    const day = d.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? "" : `${d.toLocaleDateString(labels["page-lang"])} `;
    return `${day}${timeFormat.format(d)}`;
  };
  var nameOf = (p) => paneName(p, st.panes, L);
  function failed(err) {
    const code = err && err.message;
    st.error = code === "not-allowed" ? "error-not-allowed" : code === "slow" ? "error-slow" : "error-failed";
    render();
  }
  async function refresh(first = false) {
    try {
      const [page, panes] = await Promise.all([
        call("events", { filter: st.kept.filter, limit: PAGE }),
        call("now")
      ]);
      if (first) st.filters = await call("filters") || st.filters;
      const before = new Set(st.events.map((e) => e.id));
      st.events = merge(st.events, page.events || []);
      if (first) st.next = page.next || null;
      st.fresh = first ? /* @__PURE__ */ new Set() : new Set(st.events.filter((e) => !before.has(e.id)).map((e) => e.id));
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
      st.fresh = /* @__PURE__ */ new Set();
    } catch (err) {
      failed(err);
    }
    st.loading = false;
    render();
  }
  function rescope(filter) {
    st.kept.filter = filter;
    st.events = [];
    st.next = null;
    st.picked = null;
    keep();
    render();
    refresh(true);
  }
  function scopeOptions() {
    const opts = [{ kind: "all", label: L("scope-all") }];
    for (const m of st.filters.managers || [])
      opts.push({
        kind: "team",
        value: m.pane,
        label: L("scope-team", { name: m.name || nameOf(m.pane) })
      });
    for (const p of st.filters.projects || [])
      opts.push({
        kind: "project",
        value: p,
        label: L("scope-project", { name: p.split(/[\\/]/).pop() || p })
      });
    for (const f2 of st.filters.folds || [])
      opts.push({ kind: "fold", value: f2.id, label: L("scope-fold", { name: f2.name }) });
    const f = st.kept.filter;
    if (f.kind !== "all" && !opts.some((o) => o.kind === f.kind && o.value === f.value)) {
      opts.push({ kind: f.kind, value: f.value, label: f.value });
    }
    const sel = $("scope");
    sel.replaceChildren(
      ...opts.map(
        (o, i) => h(
          "option",
          { value: String(i), selected: o.kind === f.kind && (o.value ?? "") === (f.value ?? "") },
          o.label
        )
      )
    );
    sel.onchange = () => {
      const o = opts[Number(sel.value)];
      rescope(o.kind === "all" ? { kind: "all" } : { kind: o.kind, value: o.value });
    };
  }
  function kindChips() {
    $("kinds").replaceChildren(
      ...KINDS.map(
        (k) => h(
          "button",
          {
            type: "button",
            class: "kind",
            "aria-pressed": String(st.kept.kinds.includes(k)),
            onclick: () => {
              const on = st.kept.kinds.includes(k);
              if (on && st.kept.kinds.length === 1) return;
              st.kept.kinds = on ? st.kept.kinds.filter((x) => x !== k) : KINDS.filter((x) => x === k || st.kept.kinds.includes(x));
              keep();
              render();
            }
          },
          L(`kind-${k}`)
        )
      )
    );
  }
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
    $("full-title").textContent = `${timeOf(e.at)} \xB7 ${nameOf(e.pane)}`;
  }
  function render() {
    if (!st.started) return;
    for (const b of document.querySelectorAll("[data-view]"))
      b.setAttribute("aria-pressed", String(b.dataset.view === st.kept.view));
    $("window").hidden = st.kept.view !== "lanes";
    $("window").value = String(st.kept.windowMin);
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
      onPick: (id) => (st.picked = id, render())
    };
    const list = shown(st.events, st.kept.kinds, st.query, nameOf);
    const view = st.kept.view === "lanes" ? lanesView(list, ctx, windowOf(Date.now(), st.kept.windowMin)) : timeline(list, ctx, { more: !!st.next, onOlder: older, loading: st.loading });
    $("content").replaceChildren(
      ...st.error ? [h("p", { class: "error", role: "alert" }, L(st.error))] : [],
      now(st.events, ctx),
      view
    );
  }
  function setup(m) {
    labels = m.labels && typeof m.labels === "object" ? m.labels : {};
    if (m.kept && typeof m.kept === "object") st.kept = { ...st.kept, ...m.kept };
    document.documentElement.lang = labels["page-lang"] || "en";
    document.documentElement.dir = labels["page-dir"] === "rtl" ? "rtl" : "ltr";
    timeFormat = new Intl.DateTimeFormat(labels["page-lang"] || void 0, {
      hour: "2-digit",
      minute: "2-digit"
    });
    document.title = L("page-title");
    $("title").textContent = L("page-title");
    $("close").setAttribute("aria-label", L("page-close"));
    $("views").setAttribute("aria-label", L("view-label"));
    $("view-timeline").textContent = L("view-timeline");
    $("view-lanes").textContent = L("view-lanes");
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
    $("export").addEventListener("click", () => $("export-menu").hidden = !$("export-menu").hidden);
    for (const [id, format] of [
      ["export-markdown", "markdown"],
      ["export-json", "json"]
    ]) {
      $(id).addEventListener("click", () => {
        $("export-menu").hidden = true;
        call("export", { filter: st.kept.filter, format }).catch(failed);
      });
    }
    $("full-close").addEventListener("click", () => $("sheet").hidden = true);
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
})();
