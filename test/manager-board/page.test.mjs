// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board — the built page
 *
 * page/index.html with the built page/main.js in jsdom, with a fake bridge
 * whose tile answers the page's calls from a fake timeline: the page says
 * hello, draws Waiting on you, Now and the Timeline by hour once set up,
 * opens a whole text in its sheet, loads older pages, narrows by kind and
 * scope (keeping each choice), switches to Lanes and back, and exports
 * through the tile. Text from the timeline is never made into markup. The
 * Tasks view lists one row per task, filters by state, sorts with headings
 * per agent, keeps both choices and opens a request or reply in full.
 *
 * Modified 2026-11-15 (Tasks view): tests for the Tasks view.
 *
 * Last updated by: Tilefold
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_KEYS } from "../../examples/manager-board/src/strings.js";
import { addTimeline } from "../fake-timeline.mjs";
import { EVENTS, FILTERS, FULL, LEAD, NOW } from "./fixtures.mjs";

const PAGE = fileURLToPath(new URL("../../examples/manager-board/page/", import.meta.url));
const HTML = readFileSync(`${PAGE}index.html`, "utf8").replace(/<script[^>]*><\/script>/, "");
const SCRIPT = readFileSync(`${PAGE}main.js`, "utf8");
const ftl = readFileSync(
  fileURLToPath(new URL("../../examples/manager-board/locales/en/tile.ftl", import.meta.url)),
  "utf8",
);
const english = new Map([...ftl.matchAll(/^([a-z][\w-]*) = (.*)$/gm)].map((m) => [m[1], m[2]]));
const LABELS = Object.fromEntries(
  PAGE_KEYS.map((k) => [k, english.get(k).replace(/\{ \$(\w+) \}/g, "{$1}")]),
);

const windows = [];
afterEach(() => {
  for (const w of windows.splice(0)) w.close();
});

/** Lets the page's calls and their answers settle. */
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 2));
};

/** The page in its own window; a fake tile answers its calls from `events`. */
async function page({ events = EVENTS, kept } = {}) {
  const dom = new JSDOM(HTML, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  windows.push(w);
  const named = (name, message) => Object.assign(new Error(message), { name });
  const tf = {};
  const host = {};
  addTimeline(tf, host, named, { events, full: FULL, now: NOW, filters: FILTERS });
  const posted = [];
  let listener = null;
  const deliver = (m) => listener && listener(structuredClone(m));
  w.tilefold = {
    async post(m) {
      posted.push(structuredClone(m));
      if (m.type !== "call") return;
      const a = m.args || {};
      try {
        const value =
          m.call === "fullText"
            ? await tf.timeline.fullText(a.id)
            : m.call === "events" || m.call === "export"
              ? await tf.timeline[m.call](a)
              : await tf.timeline[m.call]();
        setTimeout(() => deliver({ do: "reply", id: m.id, value }), 0);
      } catch {
        setTimeout(() => deliver({ do: "reply", id: m.id, error: "failed" }), 0);
      }
    },
    onMessage: (fn) => {
      listener = fn;
      return () => {};
    },
  };
  w.eval(SCRIPT);
  expect(posted[0]).toEqual({ type: "hello" });
  deliver({ do: "setup", labels: LABELS, kept });
  await settle();
  const $ = (id) => w.document.getElementById(id);
  const text = () => $("content").textContent;
  return { w, $, posted, host, text, deliver };
}

describe("the Manager Board page", () => {
  it("draws Waiting on you, Now and the timeline once set up", async () => {
    const p = await page();
    expect(p.$("title").textContent).toBe("Manager Board");
    expect(p.$("view-timeline").getAttribute("aria-pressed")).toBe("true");
    expect(p.text()).toContain("Waiting on you");
    expect(p.text()).toContain("2 · api asks 1 · lead");
    expect(p.$("content").querySelectorAll(".pane")).toHaveLength(2);
    expect(p.$("content").querySelector(".pane.asking").textContent).toContain("Needs you");
    const cards = [...p.$("content").querySelectorAll(".rail .ev")].map((e) => e.dataset.id);
    expect(cards).toEqual(EVENTS.map((e) => e.id).reverse());
    expect(p.text()).toContain("You to 1 · lead");
    expect(p.text()).toContain("Start of history for this view.");
    // The scope offers everything, the manager's team, the project and the fold.
    expect([...p.$("scope").options].map((o) => o.textContent)).toEqual([
      "Everything",
      "Team · 1 · lead",
      "Project · app",
      "Fold · Refunds",
    ]);
  });

  it("opens a whole text in the sheet", async () => {
    const p = await page();
    p.$("content").querySelector('[data-full="turn:t1"]').click();
    await settle();
    expect(p.$("sheet").hidden).toBe(false);
    expect(p.$("full-text").textContent).toBe(FULL["turn:t1"]);
    p.$("full-close").click();
    expect(p.$("sheet").hidden).toBe(true);
  });

  it("loads older pages until the start of history", async () => {
    const many = Array.from({ length: 130 }, (_, n) => ({
      ...EVENTS[1],
      id: `turn:z${String(n).padStart(3, "0")}`,
      at: new Date(Date.UTC(2026, 10, 6, 8, 0, n)).toISOString(),
    }));
    const p = await page({ events: many });
    expect(p.$("content").querySelectorAll(".rail .ev")).toHaveLength(100);
    p.$("older").click();
    await settle();
    expect(p.$("content").querySelectorAll(".rail .ev")).toHaveLength(130);
    expect(p.$("older")).toBeNull();
  });

  it("narrows by kind and scope, keeping each choice", async () => {
    const p = await page();
    const chip = (label) => [...p.$("kinds").children].find((b) => b.textContent === label);
    for (const label of ["Said", "Messages", "Nudges", "Heartbeats", "Schedule runs"])
      chip(label).click();
    expect([...p.$("content").querySelectorAll(".rail .ev")].map((e) => e.dataset.id)).toEqual([
      "ask:r1",
    ]);
    expect(p.posted.filter((m) => m.type === "keep").at(-1).kept.kinds).toEqual(["ask"]);
    p.$("scope").value = "1";
    p.$("scope").dispatchEvent(new p.w.Event("change"));
    await settle();
    expect(p.posted.filter((m) => m.type === "keep").at(-1).kept.filter).toEqual({
      kind: "team",
      value: LEAD,
    });
    expect(p.host.timeline.calls.filter((c) => c.call === "events").at(-1).filter).toEqual({
      kind: "team",
      value: LEAD,
    });
  });

  it("switches to Lanes and back", async () => {
    const recent = EVENTS.map((e, i) => ({
      ...e,
      at: new Date(Date.now() - (60 - i) * 60000).toISOString(),
    }));
    const p = await page({ events: recent });
    p.$("view-lanes").click();
    expect(p.$("view-lanes").getAttribute("aria-pressed")).toBe("true");
    expect(p.$("window").hidden).toBe(false);
    const names = [...p.$("content").querySelectorAll(".lane .name")].map((n) => n.textContent);
    expect(names[0]).toBe("You");
    expect(names.slice(-2)).toEqual(["Tilefold", "Schedules"]);
    expect(p.$("content").querySelectorAll(".pin")).toHaveLength(EVENTS.length);
    expect(p.$("content").querySelectorAll(".msg-line")).toHaveLength(2);
    p.$("content").querySelector('[data-pick="turn:t1"]').click();
    expect(p.$("content").querySelector(".picked .ev").dataset.id).toBe("turn:t1");
    expect(p.posted.filter((m) => m.type === "keep").at(-1).kept.view).toBe("lanes");
    p.$("view-timeline").click();
    expect(p.$("content").querySelector(".rail")).not.toBeNull();
  });

  it("lists tasks, filters and sorts them, and keeps both choices", async () => {
    const p = await page();
    p.$("view-tasks").click();
    const rows = () => [...p.$("content").querySelectorAll(".task")].map((r) => r.dataset.task);
    expect(rows()).toEqual(["message:m1", "turn:t1"]);
    expect(p.$("kinds").hidden).toBe(true);
    expect(p.$("task-sort").hidden).toBe(false);
    expect(p.text()).toContain("Tasks: 2");
    expect(p.text()).toContain("waiting on you: 1");
    expect(p.text()).toContain("You asked 1 · lead");
    expect(p.text()).toContain("1 · lead asked 2 · api");
    expect(p.text()).toContain("No reply yet.");
    // Only the tasks waiting on you.
    p.$("task-state").value = "waiting";
    p.$("task-state").dispatchEvent(new p.w.Event("change"));
    expect(rows()).toEqual(["message:m1"]);
    // By agent, with a heading for each.
    p.$("task-state").value = "all";
    p.$("task-state").dispatchEvent(new p.w.Event("change"));
    p.$("task-sort").value = "agent";
    p.$("task-sort").dispatchEvent(new p.w.Event("change"));
    const heads = [...p.$("content").querySelectorAll(".task-group h3")].map((x) => x.textContent);
    expect(heads).toEqual(["claude", "codex"]);
    expect(rows()).toEqual(["turn:t1", "message:m1"]);
    const kept = p.posted.filter((m) => m.type === "keep").at(-1).kept;
    expect(kept).toMatchObject({ view: "tasks", taskSort: "agent", taskState: "all" });
    // A search narrows the tasks too.
    p.$("search").value = "codex";
    p.$("search").dispatchEvent(new p.w.Event("input"));
    expect(rows()).toEqual(["message:m1"]);
  });

  it("opens a task's request in full", async () => {
    const p = await page({ kept: { view: "tasks" } });
    const row = p.$("content").querySelector('[data-task="turn:t1"]');
    row.querySelector(".task-links .link").click();
    await settle();
    expect(p.$("sheet").hidden).toBe(false);
    expect(p.$("full-text").textContent).toBe("Add refunds.\nSplit it up.");
  });

  it("exports through the tile", async () => {
    const p = await page();
    p.$("export").click();
    expect(p.$("export-menu").hidden).toBe(false);
    p.$("export-json").click();
    await settle();
    expect(p.$("export-menu").hidden).toBe(true);
    expect(p.posted.filter((m) => m.type === "call" && m.call === "export").at(-1).args).toEqual({
      filter: { kind: "all" },
      format: "json",
    });
  });

  it("never makes the timeline's text into markup", async () => {
    const evil = [
      { ...EVENTS[0], id: "turn:evil", summary: '<img src=x onerror="window.hacked=1">' },
    ];
    const p = await page({ events: evil });
    expect(p.$("content").querySelector("img")).toBeNull();
    expect(p.text()).toContain('<img src=x onerror="window.hacked=1">');
    expect(p.w.hacked).toBeUndefined();
  });
});
