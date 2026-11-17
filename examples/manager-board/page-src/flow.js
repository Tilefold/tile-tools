/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — the flow diagram
 *
 * The Now strip's Flow mode: every open agent pane as a node, managers on
 * the top row and the others below (one row when there is no manager), and
 * an arrow for each pair of panes that messaged each other in the events
 * loaded, thicker the more messages went that way. A pair that asked
 * questions has a dashed arrow. Each node shows the pane's state by its
 * color, and clicking one narrows the board to it, as a Now card does.
 *
 * `flowOf` is the layout (pure, for tests); `flowView` draws it as SVG,
 * every text set as text.
 *
 * @module manager-board/page-src/flow
 */
import { h, svg } from "./dom.js";

/** The diagram's size in its own units (it scales to the strip's width). */
export const FLOW_W = 640;
export const ROW_H = 92;
export const NODE_W = 120;
export const NODE_H = 40;
/** Most panes drawn in one row (more wrap onto another). */
export const PER_ROW = 5;
/** Widest arrow, in units. */
const MAX_STROKE = 4;

/** The panes a message event links (`from` → `to`), or null. */
function linkOf(e) {
  if (e.kind !== "message" || typeof e.pane !== "string" || typeof e.to !== "string") return null;
  if (e.pane === e.to) return null;
  const q = !!(e.detail && typeof e.detail === "object" && e.detail.kind === "question");
  return { from: e.pane, to: e.to, question: q };
}

/** Places `items` in rows of PER_ROW from `top`, each row centred. */
function rows(items, top) {
  const out = [];
  items.forEach((item, i) => {
    const row = Math.floor(i / PER_ROW);
    const inRow = Math.min(PER_ROW, items.length - row * PER_ROW);
    const gap = FLOW_W / inRow;
    const col = i % PER_ROW;
    out.push({ ...item, x: gap * col + gap / 2, y: top + row * ROW_H + NODE_H / 2 });
  });
  return out;
}

/**
 * The diagram for the open `panes` and the loaded `events`: nodes (each
 * with its place), edges by direction with how many messages went that way
 * and whether any was a question, and the diagram's height.
 */
export function flowOf(events, panes) {
  const open = panes.filter((p) => p && typeof p.pane === "string");
  const managers = open.filter((p) => p.role === "manager");
  const others = open.filter((p) => p.role !== "manager");
  const top = 12;
  const placed = managers.length
    ? [...rows(managers, top), ...rows(others, top + Math.ceil(managers.length / PER_ROW) * ROW_H)]
    : rows(others, top);
  const at = new Map(placed.map((n) => [n.pane, n]));
  const edges = new Map();
  for (const e of events) {
    const link = linkOf(e);
    if (!link || !at.has(link.from) || !at.has(link.to)) continue;
    const key = `${link.from}\u0000${link.to}`;
    const edge = edges.get(key) || { from: link.from, to: link.to, count: 0, question: false };
    edge.count += 1;
    edge.question = edge.question || link.question;
    edges.set(key, edge);
  }
  const bottom = placed.reduce((m, n) => Math.max(m, n.y + NODE_H / 2), 0);
  return { nodes: placed, edges: [...edges.values()], height: Math.max(bottom + 12, ROW_H) };
}

/**
 * Where an arrow from `a` to `b` starts and ends: on the nodes' edges. When
 * the pair messaged both ways (`twoWay`), each way runs on its own side of
 * the line between them, so both show.
 */
function ends(a, b, twoWay) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // The side is taken from one fixed direction of the pair, so the two ways differ.
  const flip = a.pane > b.pane ? -1 : 1;
  const cx = dx * flip;
  const cy = dy * flip;
  const len = Math.hypot(cx, cy) || 1;
  const off = twoWay ? 6 * flip : 0;
  const nx = (-cy / len) * off;
  const ny = (cx / len) * off;
  // Out of the box: how far along the line its edge is.
  const tx = dx ? NODE_W / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? NODE_H / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty, 0.45) + 0.03;
  return {
    x1: a.x + dx * t + nx,
    y1: a.y + dy * t + ny,
    x2: b.x - dx * t + nx,
    y2: b.y - dy * t + ny,
  };
}

/** The label shown in a node: the pane's name, shortened. */
const short = (s, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The Flow mode: the diagram, its legend, or a note when there is nothing to draw. */
export function flowView(events, ctx) {
  const flow = flowOf(events, ctx.panes);
  if (!flow.nodes.length) return h("span", { class: "muted" }, ctx.L("now-none"));
  const most = flow.edges.reduce((m, e) => Math.max(m, e.count), 1);
  const at = new Map(flow.nodes.map((n) => [n.pane, n]));
  const twoWay = new Set(flow.edges.map((e) => `${e.from}\u0000${e.to}`));
  const arrows = flow.edges.map((e) => {
    const a = at.get(e.from);
    const b = at.get(e.to);
    const p = ends(a, b, twoWay.has(`${e.to}\u0000${e.from}`));
    const width = 1.5 + ((MAX_STROKE - 1.5) * (e.count - 1)) / Math.max(1, most - 1);
    return svg(
      "line",
      {
        class: `edge${e.question ? " question" : ""}`,
        ...p,
        "stroke-width": width.toFixed(2),
        "marker-end": "url(#flow-arrow)",
      },
      svg("title", {}, ctx.L("flow-edge", { from: a.name, to: b.name, count: e.count })),
    );
  });
  const nodes = flow.nodes.map((n) =>
    svg(
      "g",
      {
        class: `node ${n.state || "idle"}${n.role === "manager" ? " manager" : ""}${ctx.onlyPane === n.pane ? " only" : ""}`,
        transform: `translate(${(n.x - NODE_W / 2).toFixed(1)} ${(n.y - NODE_H / 2).toFixed(1)})`,
        tabindex: "0",
        role: "button",
        "aria-pressed": String(ctx.onlyPane === n.pane),
        "aria-label": n.name,
        "data-pane": n.pane,
        onclick: () => ctx.onPane(n.pane),
        onkeydown: (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          ctx.onPane(n.pane);
        },
      },
      svg("rect", { width: NODE_W, height: NODE_H, rx: 9 }),
      svg("circle", { class: "state", cx: 14, cy: NODE_H / 2, r: 4.5 }),
      svg("text", { x: 26, y: 17, class: "name" }, short(n.name)),
      svg("text", { x: 26, y: 31, class: "agent" }, short(n.agent || "", 18)),
    ),
  );
  return h(
    "div",
    { class: "flow" },
    svg(
      "svg",
      {
        viewBox: `0 0 ${FLOW_W} ${flow.height}`,
        role: "img",
        "aria-label": ctx.L("flow-label", { count: flow.edges.length }),
      },
      svg(
        "defs",
        {},
        svg(
          "marker",
          {
            id: "flow-arrow",
            viewBox: "0 0 10 10",
            refX: "8",
            refY: "5",
            // A fixed size, however thick the arrow.
            markerUnits: "userSpaceOnUse",
            markerWidth: "10",
            markerHeight: "10",
            orient: "auto-start-reverse",
          },
          svg("path", { d: "M0 0 L10 5 L0 10 z", class: "head" }),
        ),
      ),
      arrows,
      nodes,
    ),
    h(
      "p",
      { class: "flow-legend muted" },
      flow.edges.length ? ctx.L("flow-legend") : ctx.L("flow-none"),
    ),
  );
}
