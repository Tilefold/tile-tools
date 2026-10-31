// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Explain Board — pointing on screen
 *
 * The agent's Point on screen, in a fake Tilefold with tf.annotate: marks
 * go to Tilefold as given, and the agent hears which were placed and what
 * to do about the rest; what it says goes on the board as a step; Tilefold's
 * refusals name the agent's own field; { clear: true } and clearing the
 * board take the marks away; Read the board lists them and suggests
 * pointing; the user's hidden overlays are explained. On a Tilefold
 * without tf.annotate, Point says so and Read doesn't suggest it. Only
 * one-word actions are recorded, never the marks or what they say.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { nextAfter, WHY } from "../../examples/explain-board/src/point.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/explain-board/", import.meta.url));
const THEME = { mode: "dark", colors: {} };

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, { page: "side", theme: THEME, annotate: true, ...opts });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(a.action).toMatch(/^[a-z][a-z0-9-]*$/);
    // The marks, what they point at and what the agent says never reach the activity log.
    expect(JSON.stringify(host.audits)).not.toMatch(/npm ERR|missing|build script/);
  }
});

const actions = (host) => host.audits.map((a) => a.action);
const box = { kind: "box", id: "err", at: { pane: "build", text: "npm ERR!" }, color: "red" };
const note = { kind: "note", at: { pane: "build", text: "npm ERR!" }, text: "No build script" };

describe("pointing on screen", () => {
  it("draws the marks on the user's panes and says they're seen", async () => {
    const host = await start();
    const out = await host.command("point", { marks: [box, note] });
    expect(out.marks).toEqual([
      { id: "err", placed: true },
      { id: "a1", placed: true },
    ]);
    expect(out.shown).toBe(true);
    expect(out.next).toMatch(/sees the marks/);
    expect(host.marks.map((m) => m.kind)).toEqual(["box", "note"]);
    expect(host.marks[1].text).toBe("No build script");
    // Pointing alone leaves the board as it was.
    expect(host.page.open).toBeFalsy();
    expect(actions(host)).toEqual(["pointed"]);
  });

  it("puts what the agent says on the board as a step", async () => {
    const host = await start();
    await host.command("point", { marks: [box], say: "This line is why the build stops." });
    expect(host.page.open).toBe(true);
    const board = host.store.get("board");
    expect(board.steps.at(-1).say).toBe("This line is why the build stops.");
    expect(board.step).toBe(board.steps.length - 1);
    expect(actions(host)).toEqual(["pointed", "opened", "drew"]);
  });

  it("tells the agent what to do about marks that weren't placed", async () => {
    const host = await start({
      annotate: { place: (at) => (at.pane === "build" ? "not-found" : "no-pane") },
    });
    const out = await host.command("point", {
      marks: [box, { ...note, at: { pane: "nowhere", text: "npm ERR!" } }],
    });
    expect(out.marks.map((m) => m.why)).toEqual(["not-found", "no-pane"]);
    expect(out.next).toContain(WHY["not-found"]);
    expect(out.next).toContain(WHY["no-pane"]);
  });

  it("explains the user's hidden overlays", async () => {
    const host = await start();
    host.hideOverlays(true);
    const out = await host.command("point", { marks: [box] });
    expect(out.shown).toBe(false);
    expect(out.next).toMatch(/hidden tile overlays/);
  });

  it("names the agent's own field when a mark is refused", async () => {
    const host = await start();
    await expect(host.command("point", { marks: [{ kind: "circle", at: {} }] })).rejects.toThrow(
      /^marks\[0\]\.kind/,
    );
    await expect(host.command("point", { say: "hi" })).rejects.toThrow(/marks: a list/);
    await expect(host.command("point", { marks: [box], clear: "yes" })).rejects.toThrow(/clear:/);
    await expect(host.command("point", { marks: [box], say: " " })).rejects.toThrow(/say:/);
    expect(host.marks).toEqual([]);
  });

  it("takes the marks away with clear, and when the board is cleared", async () => {
    const host = await start();
    await host.command("point", { marks: [box, note] });
    expect(await host.command("point", { clear: true })).toMatchObject({ cleared: 2 });
    await host.command("point", { marks: [box] });
    await host.command("clear");
    expect(host.marks).toEqual([]);
    expect(actions(host)).toEqual(["pointed", "unpointed", "pointed", "cleared"]);
  });

  it("lists the marks when the board is read, and suggests pointing", async () => {
    const host = await start();
    await host.command("point", { marks: [box] });
    const read = await host.command("read", {});
    expect(read.marks).toEqual([{ id: "err", kind: "box", placed: true }]);
    expect(read.next).toMatch(/Point on screen/);
  });

  it("just opens the board when run from the palette", async () => {
    const host = await start();
    expect(await host.command("point")).toBeUndefined();
    expect(host.page.open).toBe(true);
  });
});

describe("on a Tilefold that can't point", () => {
  it("says so, and Read doesn't suggest it", async () => {
    const host = await start({ annotate: undefined });
    await expect(host.command("point", { marks: [box] })).rejects.toThrow(/0\.1\.23 or later/);
    const read = await host.command("read", {});
    expect(read.marks).toBeUndefined();
    expect(read.next).not.toMatch(/Point on screen/);
  });
});

describe("the agent's next step", () => {
  it("names each reason once", () => {
    const items = [
      { id: "a", placed: false, why: "not-shown" },
      { id: "b", placed: false, why: "not-shown" },
      { id: "c", placed: true },
    ];
    const next = nextAfter(items, true);
    expect(next.split(WHY["not-shown"])).toHaveLength(2);
    expect(nextAfter([{ id: "c", placed: true }], true)).toMatch(/sees the marks/);
  });
});
