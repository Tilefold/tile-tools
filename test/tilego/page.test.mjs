// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the built page, twice
 *
 * Two copies of page/index.html with the built page/main.js, each in its
 * own jsdom window with a fake Tilefold bridge, play each other through
 * the fake relay: the lobby offers the board sizes, Start a game shows the
 * code, the other page joins and gets the same size, a click plays a stone
 * that appears on the other board, Pass is said in words, two passes show
 * the marking with the score, a click marks a chain dead on both boards,
 * and both accepting shows who won and by how much. Against an agent, its
 * requests (as the tile passes them) read the board, wait for its turn,
 * play its stones and passes, mark and accept, and come back refused with
 * a reason when they can't be played.
 */
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_KEYS } from "../../examples/tilego/src/strings.js";
import { createFakeRelay } from "../fake-relay.mjs";

const PAGE = fileURLToPath(new URL("../../examples/tilego/page/", import.meta.url));
const HTML = readFileSync(`${PAGE}index.html`, "utf8").replace(/<script[^>]*><\/script>/, "");
const SCRIPT = readFileSync(`${PAGE}main.js`, "utf8");

/** English labels as the tile sends them, with the page's own marks. */
const ftl = readFileSync(
  fileURLToPath(new URL("../../examples/tilego/locales/en/tile.ftl", import.meta.url)),
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

/** Lets frames and page work settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

/** One page in its own window, talking to a fake tile and `server`. */
function page(server, setup = {}) {
  const dom = new JSDOM(HTML, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  windows.push(w);
  const posted = [];
  let listener = null;
  w.tilefold = {
    post: async (m) => void posted.push(structuredClone(m)),
    onMessage: (fn) => {
      listener = fn;
      return () => {};
    },
  };
  w.WebSocket = server.WebSocket;
  Object.defineProperty(w, "crypto", { value: webcrypto });
  w.document.hasFocus = () => true;
  w.eval(SCRIPT);
  const $ = (id) => w.document.getElementById(id);
  let asks = 0;
  return {
    w,
    $,
    posted,
    setup: () =>
      listener({
        do: "setup",
        relay: "wss://relay.example.com/rooms",
        labels: LABELS,
        player: null,
        name: "",
        saved: null,
        ...setup,
      }),
    shown: () => ["lobby", "waiting", "game"].find((id) => !$(id).hidden),
    point: (x, y) => $("board").querySelector(`[data-x="${x}"][data-y="${y}"]`),
    points: () => $("board").querySelectorAll(".point").length,
    kept: () => posted.filter((m) => m.type === "keep").at(-1),
    /** An agent's request, as the tile passes it; resolves with the page's reply. */
    async ask(ask, input = null) {
      const id = `a${++asks}`;
      listener({ do: "agent", id, ask, input });
      await settle();
      return posted.find((m) => m.type === "agent" && m.id === id)?.reply;
    },
  };
}

/** Types into a field (or picks in a list) as a user would. */
const type = (p, id, text) => {
  p.$(id).value = text;
  p.$(id).dispatchEvent(new p.w.Event("input"));
};

describe("the page", () => {
  it("says hello, then shows the lobby with the board sizes in the tile's words", () => {
    const p = page(createFakeRelay());
    expect(p.posted[0]).toEqual({ type: "hello" });
    p.setup();
    expect(p.shown()).toBe("lobby");
    expect(p.$("new").textContent).toBe("Start a game");
    expect([...p.$("size").options].map((o) => [o.value, o.textContent])).toEqual([
      ["9", "9 × 9, a quick game"],
      ["13", "13 × 13"],
      ["19", "19 × 19, the full board"],
    ]);
    expect(p.$("size").value).toBe("9");
    expect(p.kept().player).toMatch(/^[0-9a-f]{24}$/);
  });

  it("plays a game with another page, through passing, marking and the score", async () => {
    const server = createFakeRelay();
    const ada = page(server);
    const bo = page(server);
    ada.setup();
    bo.setup();
    type(ada, "name", "Ada");
    type(ada, "size", "13");
    ada.$("new").click();
    await settle();
    expect(ada.$("room-code").value).toBe("K7P-4QX");
    type(bo, "name", "Bo");
    type(bo, "code", "k7p-4qx");
    bo.$("join").click();
    await settle();
    expect(bo.shown()).toBe("game");
    // Bo's board takes Ada's size.
    expect(ada.points()).toBe(169);
    expect(bo.points()).toBe(169);
    expect(ada.point(3, 3).classList.contains("star")).toBe(true);

    ada.point(6, 6).click();
    await settle();
    expect(bo.point(6, 6).dataset.stone).toBe("black");
    expect(bo.point(6, 6).getAttribute("aria-label")).toBe("G7, black");
    expect(bo.point(6, 6).classList.contains("last")).toBe(true);
    bo.point(0, 12).click();
    await settle();
    ada.$("pass").click();
    await settle();
    expect(bo.$("status").textContent).toBe("Ada passed. Your move.");
    expect(bo.$("pass").disabled).toBe(false);
    bo.$("pass").click();
    await settle();

    for (const p of [ada, bo]) {
      expect(p.$("status").textContent).toBe("Both players passed: mark the dead stones.");
      expect(p.$("scoring").hidden).toBe(false);
      expect(p.$("pass").hidden).toBe(true);
      expect(p.$("accept").hidden).toBe(false);
    }
    // Nothing marked: one stone each, the empty board shared.
    expect(ada.$("score-line").textContent).toBe("Black 1 · White 8.5 (with 7.5 komi)");
    // Ada marks Bo's stone dead; it shows on both boards.
    ada.point(0, 12).click();
    await settle();
    expect(bo.point(0, 12).classList.contains("dead")).toBe(true);
    expect(bo.point(0, 12).getAttribute("aria-label")).toBe("A1, white, marked dead");
    expect(bo.point(5, 5).dataset.area).toBe("black");
    expect(bo.$("score-line").textContent).toBe("Black 169 · White 7.5 (with 7.5 komi)");
    ada.$("accept").click();
    await settle();
    expect(ada.$("accept").disabled).toBe(true);
    expect(ada.$("accept-status").textContent).toBe("Waiting for Bo to accept…");
    expect(bo.$("accept-status").textContent).toBe(
      "Ada accepted these marks. Accept too, or change them.",
    );
    bo.$("accept").click();
    await settle();
    expect(ada.$("status").textContent).toBe("You won by 161.5 points!");
    expect(bo.$("status").textContent).toBe("Ada won by 161.5 points.");
    expect(ada.$("rematch").hidden).toBe(false);
    expect(ada.posted.filter((m) => m.type === "event").map((m) => m.action)).toEqual([
      "created",
      "started",
      "scoring",
      "won",
    ]);
    expect(ada.kept().saved).toMatchObject({ size: 13, scored: true });
  });
});

describe("a game against an agent", () => {
  it("answers the agent's requests: the board, its moves and passes, and the marking", async () => {
    const p = page(createFakeRelay());
    p.setup();
    type(p, "name", "Ada");
    const start = await p.ask("versus");
    expect(start).toMatchObject({ ok: true, board: { mode: "agent", you: "white", size: 9 } });
    expect(p.$("status").textContent).toBe("Your move.");

    // The agent waits for the user's move, then plays.
    const waiting = p.ask("board", { wait: true });
    p.point(4, 4).click();
    const read = await waiting;
    expect(read.board).toMatchObject({ yourTurn: true, moves: ["E5"] });
    expect((await p.ask("play", { cell: "E5" })).error).toMatch(/already has a stone/);
    expect((await p.ask("play", { cell: "I5" })).error).toMatch(/without I/);
    expect(await p.ask("play", { cell: "A1" })).toMatchObject({ ok: true, played: "A1" });
    expect(p.point(0, 8).dataset.stone).toBe("white");
    expect((await p.ask("play", { cell: "B1" })).error).toMatch(/isn't your turn/);

    p.$("pass").click();
    expect(await p.ask("play", "pass")).toMatchObject({ ok: true });
    expect(p.$("status").textContent).toBe("Both players passed: mark the dead stones.");
    expect(p.$("scoring-hint").textContent).toContain("Ask the agent");
    expect((await p.ask("play", "B2")).error).toMatch(/play has ended/);
    expect((await p.ask("score", {})).error).toMatch(/Say what to do/);
    expect((await p.ask("score", { dead: ["Z9"] })).error).toMatch(/Name the dead stones/);
    const marked = await p.ask("score", { dead: ["A1"], accept: true });
    expect(marked.board).toMatchObject({ dead: ["A1"], accepted: { you: true, opponent: false } });
    expect(p.$("accept-status").textContent).toBe(
      "Agent accepted these marks. Accept too, or change them.",
    );
    p.$("accept").click();
    expect(p.$("status").textContent).toBe("You won by 73.5 points!");
    expect(p.posted.filter((m) => m.type === "event").map((m) => m.action)).toEqual([
      "agent-game",
      "started",
      "agent-moved",
      // The agent's pass ends play: the page is marking before the move is recorded.
      "scoring",
      "agent-moved",
      "won",
    ]);
  });

  it("comes back to a kept game against the agent", async () => {
    const saved = {
      mode: "agent",
      name: "Ada",
      game: 1,
      size: 19,
      moves: [[3, 3]],
      resigned: null,
      scored: false,
      marks: { dead: [], mine: false, theirs: false },
    };
    const p = page(createFakeRelay(), { saved, name: "Ada" });
    p.setup();
    expect(p.shown()).toBe("game");
    expect(p.points()).toBe(361);
    expect(p.$("status").textContent).toBe(
      "The agent's move. Ask an AI agent in one of your panes to play TileGo with you.",
    );
    p.$("leave").click();
    expect(p.shown()).toBe("lobby");
    expect(p.kept().saved).toBeNull();
  });
});
