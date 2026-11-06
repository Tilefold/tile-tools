/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — the Now strip, Waiting on you and the Timeline
 *
 * `ctx` carries what every view needs: `L` (labels), `panes` (open now),
 * `timeOf(at)` and `hourOf(at)` (in the user's time zone), `onFull(e)` (Show
 * full text), `fresh` (ids that just arrived, drawn in) and, for Lanes,
 * `picked` and `onPick(id)`. Every text is set as text.
 */
import { h, glyphOf } from "./dom.js";
import { byHour, headline, statusOf, waiting } from "./model.js";

const STATE_KEY = {
  ready: "state-ready",
  idle: "state-idle",
  busy: "state-busy",
  asking: "state-asking",
};

/** The newest event that happened in `pane` (the list is newest first). */
const lastOf = (list, pane) => list.find((e) => e.pane === pane);

/** One event, as both views show it. */
export function card(e, ctx) {
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
        status && h("span", { class: `status ${status.tone}` }, status.text),
      ),
      h("p", { class: "sum" }, e.summary),
      e.more &&
        h(
          "button",
          { type: "button", class: "link", "data-full": e.id, onclick: () => ctx.onFull(e) },
          ctx.L("show-full"),
        ),
    ),
  );
}

/** Waiting on you, then one card per open pane. */
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
  const cards = ctx.panes.map((p) =>
    h(
      "div",
      { class: `pane ${p.state}` },
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
        lastOf(list, p.pane) && ` · ${lastOf(list, p.pane).summary}`,
      ),
    ),
  );
  box.append(
    h(
      "section",
      { class: "now", "aria-label": ctx.L("now-title") },
      cards.length ? cards : h("span", { class: "muted" }, ctx.L("now-none")),
    ),
  );
  return box;
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
