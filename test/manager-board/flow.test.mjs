/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — the flow diagram's layout
 *
 * Managers sit on the top row and the other panes below (one row with no
 * manager), wrapping past PER_ROW; an arrow per direction counts its
 * messages and says whether any was a question; messages to or from a pane
 * that isn't open, to the same pane, or anything but messages, draw no
 * arrow.
 */
import { describe, expect, it } from "vitest";
import { flowOf, NODE_H, PER_ROW, ROW_H } from "../../examples/manager-board/page-src/flow.js";

const pane = (id, role = "opened") => ({
  pane: `tilefold:${id}`,
  name: id,
  agent: "claude",
  state: "idle",
  role,
});
const msg = (from, to, kind = "message") => ({
  kind: "message",
  pane: `tilefold:${from}`,
  to: `tilefold:${to}`,
  detail: { kind },
});

describe("the flow diagram", () => {
  it("puts managers on top and the others below", () => {
    const f = flowOf([], [pane("a"), pane("lead", "manager"), pane("b")]);
    const y = Object.fromEntries(f.nodes.map((n) => [n.name, n.y]));
    expect(y.lead).toBe(12 + NODE_H / 2);
    expect(y.a).toBe(12 + ROW_H + NODE_H / 2);
    expect(y.b).toBe(y.a);
    expect(f.nodes.find((n) => n.name === "a").x).toBeLessThan(
      f.nodes.find((n) => n.name === "b").x,
    );
  });

  it("uses one row with no manager, wrapping past PER_ROW", () => {
    const many = Array.from({ length: PER_ROW + 2 }, (_, i) => pane(`p${i}`));
    const f = flowOf([], many);
    expect(new Set(f.nodes.map((n) => n.y)).size).toBe(2);
    expect(f.height).toBeGreaterThan(ROW_H);
    expect(flowOf([], []).nodes).toEqual([]);
  });

  it("counts the messages each way, and marks questions", () => {
    const f = flowOf(
      [
        msg("lead", "a"),
        msg("lead", "a"),
        msg("a", "lead", "question"),
        msg("a", "a"),
        msg("a", "gone"),
        { kind: "turn", pane: "tilefold:a", to: "tilefold:lead" },
        { kind: "message", pane: 3, to: "tilefold:a" },
      ],
      [pane("lead", "manager"), pane("a")],
    );
    expect(f.edges).toEqual([
      { from: "tilefold:lead", to: "tilefold:a", count: 2, question: false },
      { from: "tilefold:a", to: "tilefold:lead", count: 1, question: true },
    ]);
  });
});
