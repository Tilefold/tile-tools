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
 * Clicking a Now card narrows every view to that pane until it's clicked
 * again or the chip's × is pressed. Messages between agents get the relay
 * color; Now folds from its heading and shows the panes as cards, compact
 * chips or a flow diagram, each choice kept.
 *
 * Modified 2026-11-15 (Tasks view): tests for the Tasks view.
 * Modified 2026-11-15 (one pane only): tests for narrowing to one pane.
 * Modified 2026-11-15 (what the agent did): an open card lists the
 *   agent's actions under its line, and a folded one counts them.
 * Modified 2026-11-15 (cards open in place): a card opens in place with
 *   its whole text instead of the sheet, and an agent's reply lines join
 *   into one card.
 *
 * Modified 2026-11-16 (Now modes): tests for the relay color, folding Now
 *   and its Compact and Flow modes.
 *
 * Last updated by: Tilefold
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_KEYS } from "../../examples/manager-board/src/strings.js";
import { addTimeline } from "../fake-timeline.mjs";
import { API, EVENTS, FILTERS, FULL, LEAD, NOW } from "./fixtures.mjs";

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

  it("opens a card in place with its whole text, and folds it again", async () => {
    const p = await page();
    const body = () => p.$("content").querySelector('.rail [data-key="turn:t1"] .body');
    expect(body().getAttribute("aria-expanded")).toBe("false");
    body().click();
    await settle();
    expect(body().getAttribute("aria-expanded")).toBe("true");
    expect(body().querySelector(".full-in").textContent).toBe(FULL["turn:t1"]);
    // Folded again: one line; opened again, the text comes from what was kept.
    body().click();
    expect(body().querySelector(".full-in")).toBeNull();
    const asked = p.posted.filter((m) => m.call === "fullText").length;
    body().dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle();
    expect(body().querySelector(".full-in").textContent).toBe(FULL["turn:t1"]);
    expect(p.posted.filter((m) => m.call === "fullText").length).toBe(asked);
  });

  it("joins an agent's reply lines into one card that opens to show them all", async () => {
    const lines = [
      {
        ...EVENTS[1],
        id: "turn:r1",
        at: "2026-11-06T09:02:10.000Z",
        summary: "Reading the routes",
        more: false,
      },
      {
        ...EVENTS[1],
        id: "turn:r2",
        at: "2026-11-06T09:02:20.000Z",
        summary: "Adding the handler",
        more: false,
      },
      {
        ...EVENTS[1],
        id: "turn:r3",
        at: "2026-11-06T09:02:30.000Z",
        summary: "Done: POST /refunds",
        more: false,
      },
    ];
    const p = await page({ events: [EVENTS[0], ...lines] });
    const cards = [...p.$("content").querySelectorAll(".rail .ev")];
    expect(cards.map((c) => c.dataset.key)).toEqual(["turn:r1", "turn:t1"]);
    // Folded, it reads as its newest line, with how many more it holds.
    expect(cards[0].querySelector(".sum").textContent).toBe("Done: POST /refunds");
    expect(cards[0].textContent).toContain("+2 more");
    cards[0].querySelector(".body").click();
    await settle();
    const open = p.$("content").querySelector('[data-key="turn:r1"] .full-in');
    expect([...open.querySelectorAll("p")].map((x) => x.textContent)).toEqual([
      "Reading the routes",
      "Adding the handler",
      "Done: POST /refunds",
    ]);
  });

  it("loads older pages until the start of history", async () => {
    const many = Array.from({ length: 130 }, (_, n) => ({
      ...EVENTS[1],
      id: `turn:z${String(n).padStart(3, "0")}`,
      at: new Date(Date.UTC(2026, 10, 6, 8, 0, n)).toISOString(),
    }));
    const p = await page({ events: many });
    // One agent's lines with no prompt between them: one card, holding all of them.
    expect(p.$("content").querySelectorAll(".rail .ev")).toHaveLength(1);
    expect(p.text()).toContain("+99 more");
    p.$("older").click();
    await settle();
    expect(p.text()).toContain("+129 more");
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

  it("shows what the agent did under its line, and counts it while folded", async () => {
    const reply = {
      ...EVENTS[1],
      id: "turn:act",
      more: false,
      summary: "Running the tests",
      detail: {
        cli: "claude",
        actions: [
          { tool: "Bash", target: "cargo test" },
          { tool: "Edit", target: "/w/app/src/<b>lib</b>.rs" },
          { tool: "mcp__tilefold-memory__memory_write", target: "" },
          { tool: 7, target: "dropped" },
        ],
      },
    };
    const p = await page({ events: [EVENTS[0], reply] });
    const card = () => p.$("content").querySelector('[data-key="turn:act"]');
    // A short line with actions still opens; folded, it says how many.
    expect(card().textContent).toContain("Did: 3");
    card().querySelector(".body").click();
    await settle();
    const items = [...card().querySelectorAll(".actions li")].map((li) => li.textContent);
    expect(items).toEqual(["Bashcargo test", "Edit/w/app/src/<b>lib</b>.rs", "memory_write"]);
    // Targets are text, never markup.
    expect(card().querySelector(".actions b")).toBeNull();
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

  it("narrows every view to the pane whose Now card is clicked, and back", async () => {
    const p = await page();
    const ids = () =>
      [...p.$("content").querySelectorAll(".rail .ev")].map((e) => e.dataset.id).sort();
    const card = () => p.$("content").querySelector(`.now [data-pane="${API}"]`);
    expect(ids()).toHaveLength(EVENTS.length);
    card().click();
    // What the worker did, and the message sent to it; nothing of the lead's own.
    expect(ids()).toEqual(["heartbeat:h1", "message:m1", "message:m2", "nudge:w1"]);
    expect(card().getAttribute("aria-pressed")).toBe("true");
    expect(p.$("content").querySelector(".only-chip").textContent).toContain("Only 2 · api");
    // The Tasks view is narrowed too.
    p.$("view-tasks").click();
    const tasks = [...p.$("content").querySelectorAll(".task")].map((r) => r.dataset.task);
    expect(tasks).toEqual(["message:m1"]);
    // The chip's × shows every pane again; so does a second click on the card.
    p.$("only-clear").click();
    expect(p.$("content").querySelector(".only-chip")).toBeNull();
    expect(p.$("content").querySelectorAll(".task")).toHaveLength(2);
    card().dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(p.$("content").querySelectorAll(".task")).toHaveLength(1);
    card().click();
    expect(p.$("content").querySelectorAll(".task")).toHaveLength(2);
    // Not kept: panes come and go.
    expect(p.posted.filter((m) => m.type === "keep").every((m) => !("onlyPane" in m.kept))).toBe(
      true,
    );
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

  it("gives messages between agents the relay color", async () => {
    const p = await page();
    const tone = (id) => p.$("content").querySelector(`.rail [data-id="${id}"]`).className;
    expect(tone("message:m1")).toContain("relay");
    expect(tone("message:m2")).toContain("relay question");
    expect(tone("turn:t2")).not.toContain("relay");
  });

  it("folds Now from its heading, saying how many are open, kept", async () => {
    const p = await page();
    const fold = () => p.$("content").querySelector(".now-fold");
    expect(fold().getAttribute("aria-expanded")).toBe("true");
    expect(fold().textContent).toContain("2 open");
    fold().click();
    expect(fold().getAttribute("aria-expanded")).toBe("false");
    expect(p.$("content").querySelectorAll(".pane")).toHaveLength(0);
    expect(p.$("content").querySelector(".now-modes")).toBeNull();
    expect(p.posted.filter((m) => m.type === "keep").at(-1).kept.nowFolded).toBe(true);
    fold().click();
    expect(p.$("content").querySelectorAll(".pane")).toHaveLength(2);
  });

  it("shows the panes as compact chips or a flow diagram, kept, each narrowing on a click", async () => {
    const p = await page();
    const mode = (m) => p.$("content").querySelector(`[data-now-mode="${m}"]`);
    mode("compact").click();
    expect(mode("compact").getAttribute("aria-pressed")).toBe("true");
    const chips = [...p.$("content").querySelectorAll(".pane-chip")];
    expect(chips.map((c) => c.textContent)).toEqual(["1 · lead★", "2 · api"]);
    expect(p.posted.filter((m) => m.type === "keep").at(-1).kept.nowMode).toBe("compact");
    mode("flow").click();
    const svg = p.$("content").querySelector(".flow svg");
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll(".node")).toHaveLength(2);
    // The two messages between lead and api, one a question (dashed).
    expect(svg.querySelectorAll(".edge")).toHaveLength(2);
    expect(svg.querySelectorAll(".edge.question")).toHaveLength(1);
    expect(svg.querySelector(".edge title").textContent).toMatch(/→/);
    svg
      .querySelector('.node[data-pane$="api"], .node:last-of-type')
      .dispatchEvent(new p.w.MouseEvent("click", { bubbles: true }));
    expect(p.$("content").querySelector(".flow .node.only")).not.toBeNull();
  });

  it("starts in the kept mode, folded or not", async () => {
    const p = await page({ kept: { nowMode: "compact", nowFolded: false } });
    expect(p.$("content").querySelectorAll(".pane-chip")).toHaveLength(2);
    const q = await page({ kept: { nowFolded: true } });
    expect(q.$("content").querySelector(".now-fold").getAttribute("aria-expanded")).toBe("false");
  });
});
