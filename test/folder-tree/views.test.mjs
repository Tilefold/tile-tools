// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — view tests
 *
 * Activity: markers become events once each, newest first; the files an
 * agent is on now, busy folders and recent files come out right. The
 * panel: "Now" pulses in each action's colour with the pane's name, the
 * tree marks files agents used lately and busy closed folders, and
 * "Recent" is the panel's footer (five, then all, then fewer), with every
 * id unique and text within Tilefold's limits. The window's state carries
 * the same ids, and its wording fills values in and keeps ages short.
 */
import { describe, expect, it } from "vitest";
import {
  activeFiles,
  age,
  hotFolders,
  namedByPane,
  recentFiles,
  toEvents,
  withShownPaths,
} from "../../examples/folder-tree/src/activity.js";
import { emptyTree, withListing } from "../../examples/folder-tree/src/model.js";
import { pageStrings, pageView } from "../../examples/folder-tree/src/page-view.js";
import { clamp, PANEL_RECENT, panelView } from "../../examples/folder-tree/src/panel-view.js";
import { ago, fill, shownRecent } from "../../examples/folder-tree/page-src/format.js";

const NOW = 1_000_000_000;
/** Messages as "key(args)", so tests see what was asked for. */
const t = (key, args) => (args ? `${key}(${Object.values(args).join(",")})` : key);
/** A marker found under /work/app. */
const found = (rel, action, secondsAgo, pane = "Claude Code", nonce = "0000") => ({
  root: "/work/app",
  marker: { ts: NOW - secondsAgo * 1000, nonce, action, pane, path: rel, chunks: 0 },
});
/** /work/app listed: src (closed) and README.md. */
const tree = withListing(emptyTree("/work/app"), "/work/app", {
  path: "/work/app",
  entries: [
    { name: "src", kind: "dir" },
    { name: "README.md", kind: "file" },
  ],
  truncated: false,
});
const OPTS = {
  activeMs: 20_000,
  recentMs: 30 * 60_000,
  showActivity: true,
  filters: { showHidden: false, skip: new Set() },
  recentOpen: true,
  recentAll: false,
};

describe("activity", () => {
  it("turns markers into events, once each, newest first", () => {
    const events = toEvents([
      found("a.js", "e", 50),
      found("b.js", "r", 5),
      found("a.js", "e", 50),
      { root: "/work/app", marker: { ts: NOW, nonce: "x", action: "e", pane: "p", path: null } },
    ]);
    expect(events.map((e) => e.abs)).toEqual(["/work/app/b.js", "/work/app/a.js"]);
  });

  it("finds what is happening now, busy folders and recent files", () => {
    const events = toEvents([
      found("src/lib/x.js", "e", 3),
      found("src/y.js", "a", 10),
      found("src/lib/x.js", "r", 100),
      found("README.md", "r", 600),
    ]);
    const active = activeFiles(events, NOW, 20_000);
    expect(active.map((e) => e.abs)).toEqual(["/work/app/src/lib/x.js", "/work/app/src/y.js"]);
    expect([...hotFolders(active, "/work/app")]).toEqual([
      ["/work/app/src/lib", 1],
      ["/work/app/src", 2],
    ]);
    expect(recentFiles(events, 10).map((e) => [e.abs, e.action])).toEqual([
      ["/work/app/src/lib/x.js", "e"],
      ["/work/app/src/y.js", "a"],
      ["/work/app/README.md", "r"],
    ]);
    expect(age(59_400)).toEqual({ unit: "s", n: 59 });
    expect(age(3_600_000 * 5)).toEqual({ unit: "h", n: 5 });
  });
});

describe("panel", () => {
  it("shows Now, the marked tree and Recent pinned as its footer", () => {
    const events = toEvents([
      found("src/a.js", "e", 3, "api"),
      found("README.md", "r", 120, "web"),
    ]);
    const { content, targets, live } = panelView({ tree, events, now: NOW, t, opts: OPTS });
    expect(live).toBe(true);
    expect(content.title).toBe("app");
    expect(content.subtitle).toBe("now-e(api,src/a.js)");
    const [now, nowFile, agents, counts, files, src, readme] = content.rows;
    expect(now).toMatchObject({ id: "now", section: true, badge: "1" });
    // The rows the busy file leaves say who worked here this hour and what they did.
    expect(agents).toMatchObject({
      id: "now-agents",
      label: "now-agents(api, web)",
      tone: "accent",
      badge: "2",
    });
    expect(counts).toMatchObject({
      id: "now-tally",
      label: "now-tally-hour(1,1,0,0)",
      tone: "info",
    });
    expect(nowFile).toMatchObject({
      id: "now:/work/app/src/a.js",
      label: "src/a.js",
      tone: "warning",
      pulse: true,
      badge: "api",
      trail: "ago-s(3)",
    });
    expect(files).toMatchObject({ id: "files", section: true });
    // A closed folder with a busy file pulses with how many.
    expect(src).toMatchObject({ label: "src", tone: "accent", pulse: true, badge: "1" });
    // A file read two minutes ago is marked, but no longer pulses.
    expect(readme).toMatchObject({ label: "README.md", tone: "info", trail: "ago-m(2)" });
    expect(readme.pulse).toBeUndefined();
    expect(content.footer.rows.map((r) => r.id)).toEqual([
      "recent",
      "recent:/work/app/src/a.js",
      "recent:/work/app/README.md",
    ]);
    expect(content.footer.rows[0]).toMatchObject({ section: true, expanded: true, badge: "2" });
    expect(targets.get("recent:/work/app/README.md")).toEqual({
      kind: "file",
      path: "/work/app/README.md",
    });
    expect(targets.get("now:/work/app/src/a.js")).toEqual({
      kind: "file",
      path: "/work/app/src/a.js",
    });
  });

  it("shows five recent files, then all, then can close", () => {
    const events = toEvents(
      Array.from({ length: 8 }, (_, i) =>
        found(`f${i}.js`, "e", 1000 + i, "p", String(i).padStart(4, "0")),
      ),
    );
    const view = (opts) => panelView({ tree, events, now: NOW, t, opts: { ...OPTS, ...opts } });
    const few = view({}).content.footer.rows;
    expect(few.filter((r) => r.id.startsWith("recent:"))).toHaveLength(PANEL_RECENT);
    expect(few.at(-1)).toMatchObject({ id: "recent-more", label: "recent-all(8)" });
    const all = view({ recentAll: true }).content.footer.rows;
    expect(all.filter((r) => r.id.startsWith("recent:"))).toHaveLength(8);
    expect(all.at(-1).label).toBe("recent-fewer");
    expect(view({ recentOpen: false }).content.footer.rows).toEqual([
      expect.objectContaining({ id: "recent", expanded: false }),
    ]);
    // While nobody is working, Now keeps its height with the last action, the
    // agents of the hour and their tally; ids stay unique across rows and footer.
    const { content } = view({ recentAll: true });
    expect(content.rows.slice(0, 5).map((r) => r.id)).toEqual([
      "now",
      "now-last:/work/app/f0.js",
      "now-agents",
      "now-tally",
      "files",
    ]);
    expect(content.rows[0].badge).toBeUndefined();
    expect(content.rows[1]).toMatchObject({ label: "now-last-e(p,f0.js)", tone: "warning" });
    expect(content.rows[1].pulse).toBeUndefined();
    expect(content.rows[5].id).toBe("/work/app/src");
    const ids = [...content.rows, ...content.footer.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps Recent pinned with a note before any agent used a file", () => {
    const { content, targets } = panelView({ tree, events: [], now: NOW, t, opts: OPTS });
    expect(content.footer.rows).toEqual([
      { id: "recent", label: "section-recent", section: true, expandable: true, expanded: true },
      {
        id: "recent-none",
        label: "page-empty-recent",
        icon: "none",
        depth: 1,
        muted: true,
      },
    ]);
    // The note is no link; the header still opens and closes.
    expect(targets.has("recent-none")).toBe(false);
    expect(targets.get("recent")).toEqual({ kind: "recent" });
    const closed = panelView({
      tree,
      events: [],
      now: NOW,
      t,
      opts: { ...OPTS, recentOpen: false },
    });
    expect(closed.content.footer.rows.map((r) => r.id)).toEqual(["recent"]);
  });

  it("shows only the tree when activity is off", () => {
    const events = toEvents([found("src/a.js", "e", 3)]);
    const off = panelView({ tree, events, now: NOW, t, opts: { ...OPTS, showActivity: false } });
    expect(off.content.footer).toBeUndefined();
    expect(off.content.rows.map((r) => r.id)).toEqual(["/work/app/src", "/work/app/README.md"]);
    expect(off.content.subtitle).toBe("/work/app");
    const none = panelView({ tree: emptyTree(null), events: [], now: NOW, t, opts: OPTS });
    expect(none.content.title).toBe("title-no-folder");
  });

  it("keeps text within Tilefold's limits", () => {
    expect(clamp("abc", 3)).toBe("abc");
    expect(clamp("abcd", 3)).toBe("ab…");
    const long = `${"d/".repeat(300)}x.js`;
    const events = toEvents([found(long, "e", 1)]);
    const { content } = panelView({ tree, events, now: NOW, t, opts: OPTS });
    for (const r of [...content.rows, ...content.footer.rows]) {
      expect([...r.label].length).toBeLessThanOrEqual(256);
      if (r.hint) expect([...r.hint].length).toBeLessThanOrEqual(512);
    }
    expect([...content.subtitle].length).toBeLessThanOrEqual(512);
  });
});

describe("window", () => {
  it("posts the tree, Now and Recent with the panel's ids", () => {
    const events = toEvents([found("src/a.js", "a", 2, "api"), found("README.md", "d", 90, "web")]);
    const { state, targets } = pageView({ tree, events, now: NOW, t, opts: OPTS });
    expect(state).toMatchObject({
      type: "state",
      title: "app",
      root: "/work/app",
      live: true,
      panes: 2,
    });
    expect(state.now).toEqual([
      {
        id: "now:/work/app/src/a.js",
        file: "a.js",
        dir: "src/",
        pane: "api",
        action: "a",
        ts: NOW - 2000,
      },
    ]);
    expect(state.tree).toEqual([
      {
        id: "/work/app/src",
        name: "src",
        depth: 0,
        kind: "dir",
        expandable: true,
        expanded: false,
        hot: 1,
      },
      {
        id: "/work/app/README.md",
        name: "README.md",
        depth: 0,
        kind: "file",
        mark: { action: "d", pane: "web", ts: NOW - 90_000 },
      },
    ]);
    expect(state.recent.map((e) => e.id)).toEqual([
      "recent:/work/app/src/a.js",
      "recent:/work/app/README.md",
    ]);
    expect(targets.get("recent:/work/app/README.md")).toEqual({
      kind: "file",
      path: "/work/app/README.md",
    });
  });

  it("gets its strings once, with places for values", () => {
    const s = pageStrings(t, "node hooks/install.mjs");
    expect(s).toMatchObject({ type: "strings", lang: "page-lang", dir: "ltr", now: "section-now" });
    expect(s.showAll).toBe("recent-all(§)");
    expect(s.setup.command).toBe("node hooks/install.mjs");
    expect(pageStrings((k) => (k === "page-dir" ? "rtl" : k), "x").dir).toBe("rtl");
  });

  it("fills values in and keeps ages short", () => {
    expect(fill("Show all §", 12)).toBe("Show all 12");
    expect(fill("§2 of §1", "a", "b")).toBe("b of a");
    const strings = { ago: { s: "§s", m: "§m", h: "§h", d: "§d" } };
    expect(ago(strings, NOW - 5000, NOW)).toBe("5s");
    expect(ago(strings, NOW - 7_200_000, NOW)).toBe("2h");
    expect(ago({}, NOW - 3 * 86_400_000, NOW)).toBe("3d");
    expect(shownRecent([1, 2, 3, 4, 5, 6], false)).toEqual([1, 2, 3, 4, 5]);
    expect(shownRecent([1, 2, 3, 4, 5, 6], true)).toHaveLength(6);
  });
});

describe("agents across panes", () => {
  const event = (abs, pane, session) => ({ ts: NOW, action: "e", pane, session, abs, key: abs });

  it("are called by the name the user gave their pane, else the agent's", () => {
    const panes = [
      { session: "s1", name: "Winnie", folder: "/game", focused: false },
      { session: "s2", name: null, folder: "/app", focused: true },
    ];
    const named = namedByPane(
      [
        event("/game/a.js", "Claude Code", "s1"),
        event("/app/b.js", "Codex", "s2"),
        event("/x", "agent", null),
      ],
      panes,
    );
    expect(named.map((e) => e.pane)).toEqual(["Winnie", "Codex", "agent"]);
    expect(namedByPane([event("/a", "Claude Code", "s1")], [])[0].pane).toBe("Claude Code");
  });

  it("show paths inside the tree as they are, others after their pane folder's name", () => {
    const shown = withShownPaths(
      [event("/app/src/b.js"), event("/game/src/a.js"), event("/elsewhere/c.js")],
      "/app",
      ["/game", "/app"],
    ).map((e) => e.shown);
    expect(shown).toEqual(["src/b.js", "game/src/a.js", "/elsewhere/c.js"]);
  });
});
