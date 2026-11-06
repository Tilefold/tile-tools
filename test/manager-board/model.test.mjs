// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — the page's model
 *
 * Pages join newest first, ties in time by id, a newer copy of an event
 * replacing the old one and anything not shaped like an event dropped;
 * kinds and a search narrow the list; panes are named as the user calls
 * them (closed ones by the end of their id, schedules as Schedules); each
 * kind of event says who did what to whom, with its status in words;
 * what waits on the user is panes asking and questions not read yet;
 * hours group the timeline; lanes put you first, then managers, the panes
 * they opened, Tilefold and schedules; times fall in the lanes' window.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  byHour,
  headline,
  lanes,
  laneOf,
  merge,
  MAX_LOADED,
  paneName,
  place,
  shown,
  statusOf,
  waiting,
} from "../../examples/manager-board/page-src/model.js";
import { API, at, EVENTS, GONE, LEAD, NOW } from "./fixtures.mjs";

/** English labels with the page's marks, as the tile sends them. */
const ftl = readFileSync(
  new URL("../../examples/manager-board/locales/en/tile.ftl", import.meta.url),
  "utf8",
);
const english = new Map(
  [...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [
    m[1],
    m[2].replace(/\{ \$(\w+) \}/g, "{$1}"),
  ]),
);
const L = (key, vars = {}) =>
  String(english.get(key) ?? "").replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const by = (id) => EVENTS.find((e) => e.id === id);
const ids = (list) => list.map((e) => e.id);

describe("the model", () => {
  it("joins pages newest first and keeps the newest copy of an event", () => {
    const first = merge([], EVENTS.slice(0, 4));
    const both = merge(first, [
      ...EVENTS.slice(3),
      { id: "bad" },
      null,
      { ...by("ask:r1"), status: "denied" },
    ]);
    expect(ids(both)).toEqual(ids(EVENTS).reverse());
    expect(both.find((e) => e.id === "ask:r1").status).toBe("denied");
    const tied = [1, 2, 3].map((n) => ({ ...by("turn:t2"), id: `turn:x${n}`, at: at(30) }));
    expect(ids(merge([], tied))).toEqual(["turn:x3", "turn:x2", "turn:x1"]);
    const many = Array.from({ length: MAX_LOADED + 5 }, (_, n) => ({
      ...by("turn:t2"),
      id: `turn:y${String(n).padStart(5, "0")}`,
    }));
    expect(merge([], many)).toHaveLength(MAX_LOADED);
  });

  it("narrows by kind and search, names included", () => {
    const nameOf = (p) => paneName(p, NOW, L);
    expect(ids(shown(EVENTS, ["ask"], "", nameOf))).toEqual(["ask:r1"]);
    expect(ids(shown(EVENTS, ["turn", "message"], "OLD FORM", nameOf))).toEqual(["message:m2"]);
    expect(ids(shown(EVENTS, ["message"], "2 · api", nameOf)).sort()).toEqual([
      "message:m1",
      "message:m2",
    ]);
  });

  it("names panes as the user does", () => {
    expect(paneName(LEAD, NOW, L)).toBe("1 · lead");
    expect(paneName(GONE, NOW, L)).toBe("Closed pane c0de");
    expect(paneName("schedule:s1", NOW, L)).toBe("Schedules");
    expect(paneName("", NOW, L)).toBe("");
  });

  it("says who did what to whom", () => {
    const head = (id) => headline(by(id), NOW, L);
    expect(head("turn:t1")).toEqual({ text: "You to 1 · lead", tone: "you" });
    expect(head("turn:t2")).toEqual({ text: "1 · lead replied", tone: "agent" });
    expect(head("ask:r1").text).toBe("1 · lead asked to open a pane");
    expect(head("message:m1").text).toBe("1 · lead sent a message to 2 · api");
    expect(head("message:m2")).toEqual({ text: "2 · api asked 1 · lead", tone: "question" });
    expect(head("nudge:w1").text).toBe("A heartbeat nudged 2 · api");
    expect(head("heartbeat:h1").text).toBe("The heartbeat on 2 · api ended");
    expect(head("run:n1")).toEqual({ text: "Schedule “Nightly”", tone: "warn" });
    const hb = { ...by("ask:r1"), detail: { tool: "heartbeat-create", pane: API.slice(9) } };
    expect(headline(hb, NOW, L).text).toBe("1 · lead asked to keep 2 · api going");
  });

  it("words each status, with a tone", () => {
    expect(statusOf(by("ask:r1"), L)).toEqual({ text: "allowed", tone: "success" });
    expect(statusOf(by("message:m2"), L)).toEqual({ text: "not read yet", tone: "info" });
    expect(statusOf(by("run:n1"), L)).toEqual({ text: "missed", tone: "warning" });
    expect(statusOf(by("turn:t1"), L)).toBeNull();
    expect(statusOf({ ...by("ask:r1"), status: "mystery" }, L)).toBeNull();
  });

  it("finds what waits on the user", () => {
    const list = merge([], EVENTS);
    const w = waiting(NOW, list, L);
    expect(w.map((x) => x.text)).toEqual(["2 · api needs you", "2 · api asks 1 · lead"]);
    expect(
      waiting(
        [],
        list.filter((e) => e.id !== "message:m2"),
        L,
      ),
    ).toEqual([]);
  });

  it("groups by hour and lays out the lanes", () => {
    const list = merge([], EVENTS);
    expect(byHour(list, (a) => a.slice(11, 13)).map((g) => [g.label, g.items.length])).toEqual([
      ["09", 8],
    ]);
    const order = lanes(list, NOW).map((l) => l.id);
    expect(order[0]).toBe("you");
    expect(order[1]).toBe(LEAD);
    expect(order[2]).toBe(API);
    expect(order.slice(-2)).toEqual(["tilefold", "schedule"]);
    expect(laneOf(by("nudge:w1"))).toBe("tilefold");
    expect(laneOf(by("run:n1"))).toBe("schedule");
    expect(place(at(20), at(0), at(40))).toBe(0.5);
    expect(place(at(59), at(0), at(30))).toBe(1);
  });
});
