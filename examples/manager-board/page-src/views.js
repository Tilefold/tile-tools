/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — the Timeline
 *
 * `ctx` carries what every view needs: `L` (labels), `panes` (open now),
 * `timeOf(at)` and `hourOf(at)` (in the user's time zone), `onFull(e)` (Show
 * full text), `fresh` (ids that just arrived, drawn in) and, for Lanes,
 * `picked` and `onPick(id)`. Every text is set as text.
 *
 * Modified 2026-11-15 (cards open in place): a card shows one line;
 *   clicking it (or Enter or Space) opens it in place with the whole text,
 *   and a reply joined from several lines (model `replies`) shows them all,
 *   each with its time. `expanded` (keys open), `onToggle(item)` and
 *   `textOf(e)` (the whole text once loaded, else the summary) come in
 *   `ctx`; "+N more" says how many lines a folded reply holds. Under each
 *   line an open card lists what the agent did after writing it (Tilefold
 *   0.1.38 sends `detail.actions`: a tool and what it acted on), and a
 *   folded card says how many things it did.
 * Modified 2026-11-15 (one pane only): a Now card is a button: clicking it
 *   (or Enter or Space on it) narrows the board to that pane, and again
 *   shows every pane (`onlyPane`, `onPane(pane)` in `ctx`).
 *
 * Modified 2026-11-16 (Now modes): Waiting on you and Now moved to now.js.
 *
 * Last updated by: Tilefold
 */
import { h, glyphOf } from "./dom.js";
import { byHour, headline, statusOf } from "./model.js";

/** Most actions listed under one line (the rest are counted). */
const MAX_SHOWN_ACTIONS = 20;

/** What the agent did after a line: Tilefold's `detail.actions`, checked. */
export function actionsOf(e) {
  const list = e && e.detail && Array.isArray(e.detail.actions) ? e.detail.actions : [];
  return list
    .filter((a) => a && typeof a.tool === "string" && a.tool && typeof a.target === "string")
    .map((a) => ({ tool: a.tool.slice(0, 64), target: a.target.slice(0, 240) }));
}

/** An MCP tool's own name, without its server's prefix (`mcp__server__tool`). */
const toolName = (tool) => (tool.startsWith("mcp__") ? tool.split("__").pop() || tool : tool);

/** The list of what the agent did after one line. */
function actionList(l, ctx) {
  const all = actionsOf(l);
  if (!all.length) return null;
  const shown = all.slice(0, MAX_SHOWN_ACTIONS);
  return h(
    "ul",
    { class: "actions", "aria-label": ctx.L("actions-label") },
    shown.map((a) =>
      h(
        "li",
        {},
        h("span", { class: "tool" }, toolName(a.tool)),
        a.target && h("code", { dir: "auto" }, a.target),
      ),
    ),
    all.length > shown.length &&
      h("li", { class: "muted" }, ctx.L("more-lines", { count: all.length - shown.length })),
  );
}

/** What an open card shows: each line of a joined reply with its time, or the whole text. */
function opened(e, ctx) {
  const lines = e.lines || [e];
  return h(
    "div",
    { class: "full-in" },
    lines.map((l) =>
      h(
        "div",
        { class: "line" },
        e.lines && h("time", { datetime: l.at }, ctx.timeOf(l.at)),
        h("p", {}, ctx.textOf(l)),
        actionList(l, ctx),
      ),
    ),
  );
}

/** One event (or a joined reply), as both views show it: one line, opening in place. */
export function card(e, ctx) {
  const head = headline(e, ctx.panes, ctx.L);
  const status = statusOf(e, ctx.L);
  const key = e.key || e.id;
  const open = !!ctx.expanded && ctx.expanded.has(key);
  const extra = e.lines ? e.lines.length - 1 : 0;
  const did = (e.lines || [e]).reduce((n, l) => n + actionsOf(l).length, 0);
  const toggle = () => ctx.onToggle && ctx.onToggle(e);
  // A card opens when there is more to read, or things the agent did.
  const opens = e.more || did > 0;
  return h(
    "article",
    {
      class: `ev ${head.tone}${ctx.fresh.has(e.id) ? " fresh" : ""}${open ? " open" : ""}`,
      "data-id": e.id,
      "data-key": key,
    },
    h("time", { datetime: e.at }, ctx.timeOf(e.at)),
    h("span", { class: "dot", "aria-hidden": "true" }, glyphOf(e)),
    h(
      "div",
      {
        class: "body",
        role: opens ? "button" : null,
        tabindex: opens ? "0" : null,
        "aria-expanded": opens ? String(open) : null,
        title: opens ? ctx.L(open ? "card-close" : "card-open") : null,
        onclick: opens ? toggle : null,
        onkeydown: opens
          ? (ev) => {
              if (ev.key !== "Enter" && ev.key !== " ") return;
              ev.preventDefault();
              toggle();
            }
          : null,
      },
      h(
        "div",
        { class: "head" },
        h("span", { class: "who" }, head.text),
        extra > 0 &&
          !open &&
          h("span", { class: "chip more" }, ctx.L("more-lines", { count: extra })),
        did > 0 && !open && h("span", { class: "chip did" }, ctx.L("did-count", { count: did })),
        status && h("span", { class: `status ${status.tone}` }, status.text),
      ),
      open ? opened(e, ctx) : h("p", { class: "sum" }, e.summary),
    ),
  );
}

/** The empty view's message. */
export function empty(ctx) {
  return h(
    "div",
    { class: "empty" },
    h("b", {}, ctx.L("empty-title")),
    h("span", { class: "muted" }, ctx.L("empty-text")),
  );
}

/** Timeline: hour groups newest first, then Load older or the start of history. */
export function timeline(list, ctx, { more, onOlder, loading }) {
  if (!list.length && !more) return empty(ctx);
  const rail = h(
    "div",
    { class: "rail" },
    byHour(list, ctx.hourOf).map((g) =>
      h(
        "section",
        { class: "hour" },
        h("h3", {}, g.label),
        g.items.map((e) => card(e, ctx)),
      ),
    ),
  );
  const end = more
    ? h(
        "button",
        { type: "button", class: "older", id: "older", disabled: loading, onclick: onOlder },
        loading ? ctx.L("loading-text") : ctx.L("load-older"),
      )
    : h("p", { class: "start muted" }, ctx.L("history-start"));
  return h("div", {}, rail, end);
}
