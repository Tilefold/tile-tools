// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — the tile in a fake Tilefold
 *
 * The built tile, driven as Tilefold would drive it: Open docks the board
 * beside the panes (a window once the user undocks it, or on a Tilefold
 * without the dock); the page gets its text and the choices kept, checked;
 * what it asks to keep is kept, a change of view recorded once. The page's
 * timeline calls reach tf.timeline and their answers come back, failures
 * as a short reason; only the five calls pass. An export says in a notice
 * which file it went to. A Tilefold without tf.timeline gets a notice to
 * update. Only one-word actions are recorded, never what the timeline says.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkKept, reasonOf } from "../../examples/manager-board/src/run.js";
import { PAGE_KEYS } from "../../examples/manager-board/src/strings.js";
import { startTile } from "../fake-host.mjs";
import { EVENTS, FILTERS, FULL, LEAD, NOW } from "./fixtures.mjs";

const DIR = fileURLToPath(new URL("../../examples/manager-board/", import.meta.url));
const THEME = { mode: "dark", colors: {} };
const TIMELINE = { events: EVENTS, full: FULL, now: NOW, filters: FILTERS };

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, { page: "side", theme: THEME, timeline: TIMELINE, ...opts });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(a.action).toMatch(/^[a-z][a-z-]*$/);
    // Nothing the timeline says reaches the activity log.
    expect(JSON.stringify(host.audits)).not.toMatch(/refunds|old form|lead/i);
  }
});

const say = (host, message) => host.emit("page.message", { message });
const replies = (host) => host.page.posted.filter((m) => m.do === "reply");
const lastReply = (host) => replies(host).at(-1);

describe("the Manager Board tile", () => {
  it("opens beside the panes and sends the page its text and kept choices", async () => {
    const host = await start({
      store: {
        kept: {
          view: "lanes",
          filter: { kind: "team", value: LEAD },
          kinds: ["turn", "bogus"],
          windowMin: 60,
        },
      },
    });
    await host.command("open");
    expect(host.page.side).toBe(true);
    await say(host, { type: "hello" });
    const setup = host.page.posted.find((m) => m.do === "setup");
    expect(Object.keys(setup.labels).sort()).toEqual([...PAGE_KEYS].sort());
    expect(setup.labels["h-you"]).toBe("You to {pane}");
    expect(setup.kept).toEqual({
      view: "lanes",
      filter: { kind: "team", value: LEAD },
      kinds: ["turn"],
      windowMin: 60,
    });
    expect(host.audits.map((a) => a.action)).toEqual(["opened"]);
    await host.undock();
    expect(host.page.opens.at(-1)).toEqual({});
  });

  it("keeps the page's choices, checked, and records a change of view once", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "hello" });
    await say(host, {
      type: "keep",
      kept: {
        view: "lanes",
        filter: { kind: "fold", value: "f1" },
        kinds: ["ask"],
        windowMin: 240,
      },
    });
    await say(host, {
      type: "keep",
      kept: { view: "lanes", filter: { kind: "who", value: "x" }, windowMin: 7 },
    });
    expect(host.store.get("kept")).toEqual({
      view: "lanes",
      filter: { kind: "all" },
      kinds: ["turn", "message", "ask", "nudge", "heartbeat", "run"],
      windowMin: 120,
    });
    expect(host.audits.filter((a) => a.action === "view")).toEqual([
      { action: "view", details: { view: "lanes" } },
    ]);
  });

  it("answers the page's timeline calls", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "call", id: "c1", call: "events", args: { limit: 3 } });
    expect(lastReply(host).value.events.map((e) => e.id)).toEqual([
      "run:n1",
      "heartbeat:h1",
      "nudge:w1",
    ]);
    await say(host, {
      type: "call",
      id: "c2",
      call: "events",
      args: { before: lastReply(host).value.next, limit: 3 },
    });
    expect(lastReply(host).value.events[0].id).toBe("message:m2");
    await say(host, { type: "call", id: "c3", call: "fullText", args: { id: "turn:t1" } });
    expect(lastReply(host)).toEqual({ do: "reply", id: "c3", value: FULL["turn:t1"] });
    await say(host, { type: "call", id: "c4", call: "now" });
    expect(lastReply(host).value).toEqual(NOW);
    await say(host, { type: "call", id: "c5", call: "filters" });
    expect(lastReply(host).value).toEqual(FILTERS);
  });

  it("turns failures into short reasons and passes only the five calls", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "call", id: "c1", call: "events", args: { limit: 999 } });
    expect(lastReply(host)).toEqual({ do: "reply", id: "c1", error: "failed" });
    await say(host, { type: "call", id: "c2", call: "fullText", args: { id: "ask:r1" } });
    expect(lastReply(host).error).toBe("failed");
    await say(host, { type: "call", id: "c3", call: "delete" });
    expect(lastReply(host)).toEqual({ do: "reply", id: "c3", error: "failed" });
    const before = replies(host).length;
    await say(host, { type: "call", id: "<script>", call: "now" });
    await say(host, { type: "call", call: "now" });
    expect(replies(host)).toHaveLength(before);
    expect(host.timeline.calls.some((c) => c.call === "delete")).toBe(false);
    expect(reasonOf({ name: "PermissionDeniedError" })).toBe("not-allowed");
    expect(reasonOf({ name: "RateLimitError" })).toBe("slow");
    expect(reasonOf(null)).toBe("failed");
  });

  it("exports through Tilefold and says where it went", async () => {
    const host = await start();
    await host.command("open");
    await say(host, {
      type: "call",
      id: "c1",
      call: "export",
      args: { format: "json", filter: { kind: "project", value: "/w/app" } },
    });
    expect(host.timeline.calls.at(-1)).toEqual({
      call: "export",
      filter: { kind: "project", value: "/w/app" },
      format: "json",
    });
    expect(host.toasts.at(-1)).toBe(`Saved timeline.json with ${EVENTS.length} events.`);
    expect(host.audits.at(-1)).toEqual({
      action: "exported",
      details: { format: "json", truncated: false },
    });
  });

  it("asks for an update on a Tilefold without the timeline", async () => {
    const host = await start({ timeline: undefined });
    await host.command("open");
    expect(host.page.open).toBe(false);
    expect(host.toasts).toEqual(["The Manager Board needs Tilefold 0.1.27 or later."]);
  });

  it("checks kept choices", () => {
    expect(checkKept(null).view).toBe("timeline");
    expect(checkKept({ filter: { kind: "project", value: "" } }).filter).toEqual({ kind: "all" });
    expect(checkKept({ filter: { kind: "project", value: "x".repeat(1025) } }).filter).toEqual({
      kind: "all",
    });
    expect(checkKept({ kinds: [] }).kinds).toHaveLength(6);
  });
});
