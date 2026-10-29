// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree — the panel's "Now" section
 *
 * Now always takes NOW_MIN rows below its header, and fills the rows no
 * busy file needs: the last thing an agent did (coloured by the action,
 * not pulsing, opening the file), the agents of the last hour by their
 * panes' names (or how long it has been quiet), and the tally of the last
 * hour (or of all that is known). Before any activity it offers the hooks'
 * setup, which the tile opens when clicked. The tally counts each file
 * once per action.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toEvents } from "../../examples/folder-tree/src/activity.js";
import {
  LATELY_MS,
  NOW_MAX,
  NOW_MIN,
  nowRows,
  panesOf,
  tally,
} from "../../examples/folder-tree/src/now-view.js";
import { startTile } from "../fake-host.mjs";

const NOW = 1_000_000_000;
const t = (key, args) => (args ? `${key}(${Object.values(args).join(",")})` : key);
const found = (rel, action, secondsAgo, pane = "api", nonce = "0000") => ({
  root: "/work/app",
  marker: { ts: NOW - secondsAgo * 1000, nonce, action, pane, path: rel, chunks: 0 },
});
const view = (events, active = []) => nowRows(t, { active, events, now: NOW, root: "/work/app" });
const ids = (rows) => rows.map((r) => r.id);

describe("the Now section", () => {
  it("keeps its height with the last action, the hour's agents and their tally", () => {
    const events = toEvents([
      found("src/a.js", "e", 600, "api"),
      found("src/b.js", "a", 900, "web", "0001"),
      found("README.md", "r", 1200, "api", "0002"),
    ]);
    const { rows, targets } = view(events);
    expect(ids(rows)).toEqual(["now", "now-last:/work/app/src/a.js", "now-agents", "now-tally"]);
    expect(rows).toHaveLength(1 + NOW_MIN);
    expect(rows[1]).toMatchObject({
      label: "now-last-e(api,src/a.js)",
      icon: "file",
      tone: "warning",
      trail: "ago-m(10)",
    });
    expect(rows[1].pulse).toBeUndefined();
    expect(targets.get("now-last:/work/app/src/a.js")).toEqual({
      kind: "file",
      path: "/work/app/src/a.js",
    });
    expect(rows[2]).toMatchObject({ label: "now-agents(api, web)", badge: "2", tone: "accent" });
    expect(rows[2].hint).toBe("api\nweb");
    expect(rows[3]).toMatchObject({ label: "now-tally-hour(1,1,1,0)", tone: "info" });
  });

  it("says how long it has been quiet, and counts all that is known, after a quiet hour", () => {
    const old = LATELY_MS / 1000 + 120;
    const events = toEvents([found("src/a.js", "d", old)]);
    const { rows } = view(events);
    expect(rows[2]).toMatchObject({ id: "now-agents", label: "now-quiet(ago-h(1))", muted: true });
    expect(rows[3].label).toBe("now-tally-all(0,0,0,1)");
  });

  it("puts busy files first and fills only the rows left", () => {
    const events = toEvents([found("src/a.js", "e", 2), found("src/b.js", "r", 5, "web", "0001")]);
    const one = view(events, events.slice(0, 1));
    expect(ids(one.rows)).toEqual(["now", "now:/work/app/src/a.js", "now-agents", "now-tally"]);
    const two = view(events, events);
    expect(ids(two.rows)).toEqual([
      "now",
      "now:/work/app/src/a.js",
      "now:/work/app/src/b.js",
      "now-agents",
    ]);
    expect(two.rows[0].badge).toBe("2");
    // No "last action" while someone is busy: the busy rows already say it.
    expect(ids(two.rows).some((id) => id.startsWith("now-last"))).toBe(false);
  });

  it("shows at most NOW_MAX busy files and nothing more", () => {
    const events = toEvents(
      Array.from({ length: NOW_MAX + 2 }, (_, i) => found(`f${i}.js`, "e", i + 1, "p", `000${i}`)),
    );
    const { rows } = view(events, events);
    expect(rows).toHaveLength(1 + NOW_MAX);
    expect(rows.every((r) => r.id === "now" || r.id.startsWith("now:"))).toBe(true);
  });

  it("offers the hooks' setup before any activity", () => {
    const { rows, targets } = view([]);
    expect(ids(rows)).toEqual(["now", "now-idle", "now-setup", "now-pad-2"]);
    expect(rows[2]).toMatchObject({ label: "now-setup", tone: "accent", icon: "info" });
    expect(targets.get("now-setup")).toEqual({ kind: "setup" });
  });
});

describe("tally and panes", () => {
  it("counts each file once per action, and names each pane once, newest first", () => {
    const events = toEvents([
      found("a.js", "e", 1, "api"),
      found("a.js", "e", 2, "api", "0001"),
      found("a.js", "r", 3, "web", "0002"),
      found("b.js", "e", 4, "api", "0003"),
    ]);
    expect(tally(events)).toEqual({ r: 1, e: 2, a: 0, d: 0 });
    expect(panesOf(events)).toEqual(["api", "web"]);
  });
});

describe("the setup row in the tile", () => {
  it("opens the window on the setup help when clicked", async () => {
    const DIR = fileURLToPath(new URL("../../examples/folder-tree/", import.meta.url));
    const host = await startTile(DIR, {
      folders: { cwd: "/work/app", roots: ["/work/app"], files: ["/work/app/README.md"] },
      panel: true,
      page: true,
    });
    await host.command("toggle");
    expect(host.panel.content.rows.map((r) => r.id)).toContain("now-setup");
    await host.emit("panel.click", { row: "now-setup", action: "activate" });
    expect(host.page.opens).toEqual([{ visible: true }]);
    expect(host.audits).toContainEqual({ action: "window-opened", details: { setup: true } });
  });
});
