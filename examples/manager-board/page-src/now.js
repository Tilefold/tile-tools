/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — Waiting on you and Now
 *
 * Waiting on you lists the panes that need the user. Under it, Now has a
 * heading that folds and unfolds it (with how many agent panes are open,
 * so nothing seems lost while folded) and a switch between three ways of
 * showing the open agent panes:
 *
 *   cards    a card per pane with its state and what it did last (as before)
 *   compact  one small chip per pane, its state's color and its name, for a
 *            window with many agents
 *   flow     a diagram of the panes, managers on top, with an arrow for the
 *            messages between each pair (flow.js)
 *
 * In every mode, clicking a pane narrows the board to it, and again shows
 * every pane. The mode and whether Now is folded come in `ctx` (`nowMode`,
 * `nowFolded`) and change through `onNowMode(mode)` and `onNowFold(folded)`,
 * which keep them.
 *
 * @module manager-board/page-src/now
 */
import { h } from "./dom.js";
import { flowView } from "./flow.js";
import { waiting } from "./model.js";

/** The ways Now can show the agent panes, the first the default. */
export const NOW_MODES = ["cards", "compact", "flow"];

const STATE_KEY = {
  ready: "state-ready",
  idle: "state-idle",
  busy: "state-busy",
  asking: "state-asking",
};

/** The newest event that happened in `pane` (the list is newest first). */
const lastOf = (list, pane) => list.find((e) => e.pane === pane);

/** What makes a pane narrow the board when clicked, or pressed with Enter or Space. */
function picks(p, ctx) {
  return {
    role: "button",
    tabindex: "0",
    "data-pane": p.pane,
    "aria-pressed": String(ctx.onlyPane === p.pane),
    title: ctx.L(ctx.onlyPane === p.pane ? "only-pane-clear" : "only-pane-pick"),
    onclick: () => ctx.onPane(p.pane),
    onkeydown: (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      ctx.onPane(p.pane);
    },
  };
}

/** A pane's card: its name, role, agent, state and what it did last. */
function paneCard(p, list, ctx) {
  const last = lastOf(list, p.pane);
  return h(
    "div",
    { class: `pane ${p.state}${ctx.onlyPane === p.pane ? " only" : ""}`, ...picks(p, ctx) },
    h(
      "div",
      { class: "row" },
      h("span", { class: "state", "aria-hidden": "true" }),
      h("b", {}, p.name || p.pane.slice(-4)),
      p.role === "manager" && h("span", { class: "chip" }, ctx.L("role-manager")),
      h("span", { class: "spacer" }),
      h("span", { class: "muted agent" }, p.agent),
    ),
    h(
      "span",
      { class: "doing" },
      h("b", {}, ctx.L(STATE_KEY[p.state] || "state-idle")),
      last && ` · ${last.summary}`,
    ),
  );
}

/** A pane as one small chip: its state's color and its name (the rest on hover). */
function paneChip(p, ctx) {
  const name = p.name || p.pane.slice(-4);
  const state = ctx.L(STATE_KEY[p.state] || "state-idle");
  return h(
    "div",
    {
      class: `pane-chip ${p.state}${ctx.onlyPane === p.pane ? " only" : ""}${p.role === "manager" ? " manager" : ""}`,
      ...picks(p, ctx),
      title: `${name} · ${p.agent || ""} · ${state}`,
    },
    h("span", { class: "state", "aria-hidden": "true" }),
    h("span", { class: "name" }, name),
    p.role === "manager" && h("span", { class: "crown", "aria-hidden": "true" }, "★"),
  );
}

/** The Now heading: the fold toggle with the count, and the mode switch. */
function nowHead(ctx) {
  const count = ctx.panes.length;
  return h(
    "div",
    { class: "now-head" },
    h(
      "button",
      {
        type: "button",
        class: "now-fold",
        "aria-expanded": String(!ctx.nowFolded),
        "aria-controls": "now-panes",
        onclick: () => ctx.onNowFold(!ctx.nowFolded),
      },
      h("span", { class: "chev", "aria-hidden": "true" }, "▾"),
      h("b", {}, ctx.L("now-title")),
      h("span", { class: "count" }, ctx.L("now-count", { count })),
    ),
    !ctx.nowFolded &&
      h(
        "div",
        { class: "now-modes", role: "group", "aria-label": ctx.L("now-mode-label") },
        NOW_MODES.map((m) =>
          h(
            "button",
            {
              type: "button",
              "data-now-mode": m,
              "aria-pressed": String(ctx.nowMode === m),
              onclick: () => ctx.onNowMode(m),
            },
            ctx.L(`now-mode-${m}`),
          ),
        ),
      ),
  );
}

/** Waiting on you, then the Now heading and the open agent panes in the chosen mode. */
export function now(list, ctx) {
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
          wait.map((w) =>
            h(
              "li",
              {},
              h("span", {}, w.text),
              w.summary && h("span", { class: "muted" }, `: ${w.summary}`),
            ),
          ),
        ),
      ),
    );
  }
  box.append(nowHead(ctx));
  if (ctx.nowFolded) return box;
  const mode = NOW_MODES.includes(ctx.nowMode) ? ctx.nowMode : NOW_MODES[0];
  const none = h("span", { class: "muted" }, ctx.L("now-none"));
  let body;
  if (mode === "flow") body = flowView(list, ctx);
  else if (mode === "compact")
    body = ctx.panes.length ? ctx.panes.map((p) => paneChip(p, ctx)) : none;
  else body = ctx.panes.length ? ctx.panes.map((p) => paneCard(p, list, ctx)) : none;
  box.append(
    h("section", { class: `now ${mode}`, id: "now-panes", "aria-label": ctx.L("now-title") }, body),
  );
  return box;
}
