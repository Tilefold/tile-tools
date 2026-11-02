// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — the tile in a fake Tilefold
 *
 * The built tile, driven as Tilefold would drive it: Open docks the board
 * beside the panes (a window on a Tilefold without the dock, or after
 * Undock), the page gets its text and the board when it says hello, and
 * every change reaches it and the store. An agent's Show, Draw and Erase
 * open the board when it's closed and give back the ids and steps, or the
 * reason they were refused; Read the board gives everything as data, and
 * with wait holds until the user asks (or seven seconds pass). The page's
 * Back, Next and asks change the board; run from the palette, the agent's
 * commands just open it. Only one-word actions are recorded, never the
 * content, the drawings or the questions.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_KEYS } from "../../examples/whiteboard/src/strings.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/whiteboard/", import.meta.url));
const THEME = { mode: "dark", colors: {} };
const CODE = "const secret = compute();\nreturn secret * 2;";

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, { page: "side", theme: THEME, ...opts });
  hosts.push(host);
  return host;
};

afterEach(() => {
  vi.useRealTimers();
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(a.action).toMatch(/^[a-z][a-z0-9-]*$/);
    // Content, drawings and questions never reach the activity log.
    expect(JSON.stringify(host.audits)).not.toMatch(/secret|why|Doubles/);
  }
});

/** The page says something. */
const say = (host, message) => host.emit("page.message", { message });
/** The last board the tile sent the page. */
const lastBoard = (host) => host.page.posted.filter((m) => m.board).at(-1)?.board;
const actions = (host) => host.audits.map((a) => a.action);

describe("opening the board", () => {
  it("docks the page beside the panes and sends it its text and the board", async () => {
    const host = await start();
    await host.command("open");
    expect(host.page).toMatchObject({ open: true, side: true });
    await say(host, { type: "hello" });
    const setup = host.page.posted.find((m) => m.do === "setup");
    expect(Object.keys(setup.labels).sort()).toEqual([...PAGE_KEYS].sort());
    expect(setup.labels["step-count"]).toBe("Step {n} of {total}");
    expect(setup.board).toMatchObject({ content: null, shapes: [], step: 0 });
    expect(actions(host)).toEqual(["opened"]);
  });

  it("opens a window on a Tilefold that can't dock, and after Undock", async () => {
    const old = await start({ page: true, theme: undefined });
    await old.command("open");
    expect(old.page.opens).toEqual([{}]);
    const host = await start();
    await host.command("open");
    await host.undock();
    expect(host.page.opens.at(-1)).toEqual({});
  });

  it("tells the user to update on a Tilefold without pages", async () => {
    const host = await start({ page: undefined, theme: undefined });
    await host.command("open");
    expect(host.toasts).toEqual(["Whiteboard needs Tilefold 0.1.7 or later."]);
    await expect(host.command("show", { text: CODE })).rejects.toThrow(/needs 0.1.7/);
  });

  it("speaks the user's language", async () => {
    const host = await start({ locale: "de" });
    await host.command("open");
    await say(host, { type: "hello" });
    expect(host.page.posted[0].labels["page-lang"]).toBe("de");
  });
});

describe("an agent explaining", () => {
  it("shows content, draws steps and reads the board back", async () => {
    const host = await start();
    const shown = await host.command("show", { text: CODE, title: "Doubles", language: "js" });
    // The board opened by itself.
    expect(host.page.open).toBe(true);
    expect(shown.content).toMatchObject({ from: 1, to: 2, language: "js" });
    const drawn = await host.command("draw", {
      say: "secret is computed first",
      shapes: [
        { kind: "highlight", line: 1, cols: [7, 12], color: "yellow" },
        { kind: "note", id: "why", x: 600, y: 56, text: "Doubles it next" },
        { kind: "arrow", from: { shape: "why" }, to: { line: 2 } },
      ],
    });
    expect(drawn).toEqual({ ids: ["s1", "why", "s2"], step: 1, steps: 2 });
    expect(lastBoard(host)).toMatchObject({ step: 1, title: "Doubles" });

    const read = await host.command("read", { lines: true });
    expect(read.content.lines).toEqual(["const secret = compute();", "return secret * 2;"]);
    expect(read.shapes.map((s) => s.id)).toEqual(["s1", "why", "s2"]);
    expect(read.shapes[2].ends).toHaveLength(2);
    expect(read).toMatchObject({ open: true, newAsk: false, step: 1 });
    expect(read.next).toMatch(/Draw/);
    expect(actions(host)).toEqual(["opened", "shown", "drew"]);
  });

  it("gives the reason when a drawing can't be made", async () => {
    const host = await start();
    await host.command("show", { text: CODE });
    await expect(
      host.command("draw", { shapes: [{ kind: "highlight", line: 7 }] }),
    ).rejects.toThrow("shapes[0].lines: there's no line 7 on the board (lines 1 to 2)");
    await expect(host.command("draw", { shapes: [{ kind: "box" }] })).rejects.toThrow(
      /shapes\[0\]\.x/,
    );
    // A refused drawing changes nothing.
    expect(lastBoard(host).shapes).toEqual([]);
  });

  it("erases, and says what's left", async () => {
    const host = await start();
    await host.command("show", { text: CODE });
    await host.command("draw", { say: "a", shapes: [{ kind: "highlight", line: 1 }] });
    expect(await host.command("erase", { all: true })).toEqual({ shapes: 0, steps: 1 });
    expect(actions(host)).toContain("erased");
  });

  it("asks for content first on an empty board", async () => {
    const host = await start();
    const read = await host.command("read", {});
    expect(read.next).toMatch(/Show content/);
    expect(read.open).toBe(false);
  });

  it("just opens the board when the agent's commands run from the palette", async () => {
    const host = await start();
    for (const id of ["show", "draw", "erase", "read"])
      expect(await host.command(id)).toBeUndefined();
    expect(host.page.open).toBe(true);
  });
});

describe("the user on the page", () => {
  it("steps back and on, from the page and the palette", async () => {
    const host = await start();
    await host.command("show", { text: CODE });
    await host.command("draw", { say: "one", shapes: [{ kind: "highlight", line: 1 }] });
    await host.command("draw", { say: "two", shapes: [{ kind: "highlight", line: 2 }] });
    await say(host, { type: "step", n: 1 });
    expect(lastBoard(host).step).toBe(1);
    await host.command("next");
    expect(lastBoard(host).step).toBe(2);
    await host.command("back");
    await host.command("back");
    expect(lastBoard(host).step).toBe(0);
  });

  it("asks, and an agent waiting to read hears it at once", async () => {
    const host = await start();
    await host.command("show", { text: CODE });
    const waiting = host.command("read", { wait: true });
    await say(host, { type: "ask", line: 2, question: "why times two?" });
    const read = await waiting;
    expect(read).toMatchObject({
      newAsk: true,
      asked: { n: 1, line: 2, question: "why times two?" },
    });
    expect(read.next).toMatch(/"why times two\?" about line 2/);
    // Read again: nothing new.
    expect((await host.command("read", {})).newAsk).toBe(false);
    expect(actions(host)).toContain("asked");
  });

  it("brings the question to Tilefold's ask card when no agent is waiting", async () => {
    const host = await start({ agentAsk: true });
    await host.command("open");
    await host.command("show", { text: CODE, title: "Doubles" });
    await say(host, { type: "ask", line: 2, question: "why times two?" });
    expect(host.asks).toEqual([
      {
        question: "why times two?",
        about:
          'On the Whiteboard "Doubles", pointing at line 2: return secret * 2;. ' +
          "Run the Whiteboard's read command with tile_run to see the board.",
      },
    ]);
    expect(host.page.posted.at(-1)).toEqual({ do: "asked", via: "card" });
    expect(host.audits.find((a) => a.action === "asked").details).toEqual({ via: "card" });
    // The question stays on the board for the agent's next read.
    expect((await host.command("read", {})).asked).toMatchObject({ question: "why times two?" });
  });

  it("names a drawing the user pointed at", async () => {
    const host = await start({ agentAsk: true });
    await host.command("show", { text: CODE });
    await host.command("draw", {
      shapes: [{ kind: "note", id: "n1", x: 600, y: 60, text: "the result" }],
    });
    await say(host, { type: "ask", shape: "n1", question: "and this?" });
    expect(host.asks[0].about).toMatch(
      /^On the Whiteboard, pointing at the note "n1" \(the result\)\./,
    );
  });

  it("leaves the question on the board when the card can't take it", async () => {
    for (const agentAsk of [{ shown: false, why: "busy" }, undefined]) {
      const host = await start({ agentAsk });
      await host.command("open");
      await host.command("show", { text: CODE });
      await say(host, { type: "ask", line: 1, question: "q?" });
      expect(host.page.posted.at(-1)).toEqual({ do: "asked", via: "board" });
    }
  });

  it("asks only with a question, and not when an agent is already waiting", async () => {
    const host = await start({ agentAsk: true });
    await host.command("open");
    await host.command("show", { text: CODE });
    await say(host, { type: "ask", line: 1 });
    expect(host.asks).toEqual([]);
    // The agent has read that pointing; now it waits for the next ask.
    await host.command("read", {});
    const waiting = host.command("read", { wait: true });
    await say(host, { type: "ask", line: 2, question: "now?" });
    await waiting;
    expect(host.asks).toEqual([]);
    expect(host.page.posted.at(-1)).toEqual({ do: "asked", via: "agent" });
  });

  it("holds a waiting read for seven seconds at most", async () => {
    vi.useFakeTimers();
    const host = await start();
    await host.command("show", { text: CODE });
    let done = false;
    const waiting = host.command("read", { wait: true }).then((r) => ((done = true), r));
    await host.advance(6900);
    expect(done).toBe(false);
    await host.advance(200);
    expect((await waiting).newAsk).toBe(false);
  });

  it("closes from the page, and clears from the palette", async () => {
    const host = await start();
    await host.command("show", { text: CODE });
    await host.command("clear");
    expect(lastBoard(host)).toMatchObject({ content: null, shapes: [] });
    await say(host, { type: "close" });
    expect(host.page.open).toBe(false);
    expect(actions(host)).toEqual(["opened", "shown", "cleared", "closed"]);
  });
});

describe("keeping the board", () => {
  it("keeps it in the store and sends it back next time", async () => {
    const host = await start();
    await host.command("show", { text: CODE, title: "Doubles" });
    const kept = host.store.get("board");
    expect(kept.title).toBe("Doubles");
    const later = await start({ store: { board: kept } });
    await later.command("open");
    await say(later, { type: "hello" });
    expect(later.page.posted[0].board.title).toBe("Doubles");
  });

  it("keeps and sends plain JSON when the agent leaves optional fields out", async () => {
    const host = await start();
    // No language, title or say: the checked content has them as undefined.
    await host.command("show", { text: CODE });
    const kept = host.store.get("board");
    expect(JSON.stringify(kept)).toBe(JSON.stringify(JSON.parse(JSON.stringify(kept))));
    expect("language" in kept.content).toBe(false);
    // The page, opened after that, still gets its text and the board.
    await say(host, { type: "hello" });
    const setup = host.page.posted.find((m) => m.do === "setup");
    expect(Object.keys(setup.labels)).toHaveLength(PAGE_KEYS.length);
    expect(setup.board.content.lines).toHaveLength(2);
    // And the user's question still goes through.
    await say(host, { type: "ask", line: 1, question: "why?" });
    expect(host.store.get("board").asked).toMatchObject({ n: 1, question: "why?" });
  });

  it("starts empty when what was kept isn't a board", async () => {
    const host = await start({ store: { board: { nonsense: true } } });
    await host.command("open");
    await say(host, { type: "hello" });
    expect(host.page.posted[0].board.content).toBeNull();
  });
});
