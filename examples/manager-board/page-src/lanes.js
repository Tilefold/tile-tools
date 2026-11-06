/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — Lanes
 *
 * The same events across a time window that ends now: one lane per
 * participant (you, the managers, the panes they opened, other panes,
 * Tilefold's nudges, schedules), each event a pin where it happened in
 * time, and each message a line from its sender's lane to its receiver's.
 * Ticks every 30 minutes; the window's end is "now". Picking a pin shows
 * its card under the lanes (the newest one until the user picks).
 */
import { h, glyphOf } from "./dom.js";
import { headline, laneOf, lanes, paneName, place } from "./model.js";
import { card, empty } from "./views.js";

/** One lane's height, in pixels (the CSS uses the same). */
export const LANE_PX = 44;

/** The window [from, to] that ends at the next ten minutes after `nowMs`. */
export function windowOf(nowMs, minutes) {
  const to = Math.ceil(nowMs / 600000) * 600000;
  return { from: new Date(to - minutes * 60000).toISOString(), to: new Date(to).toISOString() };
}

/** Lanes for `list` in the window `win`. */
export function lanesView(list, ctx, win) {
  const inWindow = list.filter((e) => e.at >= win.from && e.at <= win.to);
  if (!inWindow.length) return empty(ctx);
  const rows = lanes(inWindow, ctx.panes);
  const index = new Map(rows.map((r, i) => [r.id, i]));
  const pct = (at) => `${(place(at, win.from, win.to) * 100).toFixed(2)}%`;
  const label = (id) =>
    id === "you"
      ? ctx.L("who-you")
      : id === "tilefold"
        ? ctx.L("who-tilefold")
        : id === "schedule"
          ? ctx.L("who-schedules")
          : paneName(id, ctx.panes, ctx.L);

  // Ticks every 30 minutes, stopping short of "now" at the end.
  const ticks = [];
  for (let t = Date.parse(win.from); t < Date.parse(win.to) - 600000; t += 1800000) {
    const at = new Date(t).toISOString();
    ticks.push(h("span", { style: { insetInlineStart: pct(at) } }, ctx.timeOf(at)));
  }
  ticks.push(
    h("span", { class: "nowline", style: { insetInlineStart: "100%" } }, ctx.L("now-line")),
  );

  const links = inWindow
    .filter((e) => e.kind === "message" && index.has(e.to) && index.has(laneOf(e)))
    .map((e) => {
      const a = index.get(laneOf(e));
      const b = index.get(e.to);
      return h("span", {
        class: `msg-line ${b > a ? "down" : "up"}`,
        "aria-hidden": "true",
        style: {
          insetInlineStart: pct(e.at),
          top: `${Math.min(a, b) * LANE_PX + LANE_PX / 2}px`,
          height: `${Math.abs(a - b) * LANE_PX}px`,
        },
      });
    });

  const picked = inWindow.find((e) => e.id === ctx.picked) || inWindow[0];
  const lane = (r) =>
    h(
      "div",
      { class: "lane" },
      h(
        "div",
        { class: "name" },
        r.pane && h("span", { class: `state ${r.pane.state}`, "aria-hidden": "true" }),
        label(r.id),
      ),
      h(
        "div",
        { class: "track" },
        inWindow
          .filter((e) => laneOf(e) === r.id)
          .map((e) =>
            h(
              "button",
              {
                type: "button",
                class: `pin ${headline(e, ctx.panes, ctx.L).tone}${e.id === picked.id ? " on" : ""}${ctx.fresh.has(e.id) ? " fresh" : ""}`,
                style: { insetInlineStart: pct(e.at) },
                "data-pick": e.id,
                "aria-label": `${ctx.timeOf(e.at)} ${headline(e, ctx.panes, ctx.L).text}`,
                onclick: () => ctx.onPick(e.id),
              },
              glyphOf(e),
            ),
          ),
      ),
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
        h("div", { class: "grid" }, rows.map(lane), h("div", { class: "links" }, links)),
      ),
    ),
    h("div", { class: "picked" }, h("h3", {}, ctx.L("picked-event")), card(picked, ctx)),
  );
}
