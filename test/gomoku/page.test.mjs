// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the built page, twice
 *
 * Two copies of page/index.html with the built page/main.js, each in its
 * own jsdom window with a fake Tilefold bridge, play each other through
 * the fake relay: the lobby asks for a name, Start a game shows the code,
 * the other page joins with it, both boards show whose turn it is in
 * words, a click plays a stone that appears on the other board, and Leave
 * takes the page back to the lobby. What each page asks the tile to keep
 * is checked on the way.
 */
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_KEYS } from "../../examples/gomoku/src/strings.js";
import { createFakeRelay } from "../fake-relay.mjs";

const PAGE = fileURLToPath(new URL("../../examples/gomoku/page/", import.meta.url));
const HTML = readFileSync(`${PAGE}index.html`, "utf8").replace(/<script[^>]*><\/script>/, "");
const SCRIPT = readFileSync(`${PAGE}main.js`, "utf8");

/** English labels as the tile sends them, with the page's own marks. */
const ftl = readFileSync(
  fileURLToPath(new URL("../../examples/gomoku/locales/en/tile.ftl", import.meta.url)),
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
  return {
    w,
    $,
    posted,
    /** The tile answers the page's hello. */
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
    send: (m) => listener(m),
    shown: () => ["lobby", "waiting", "game"].find((id) => !$(id).hidden),
    point: (x, y) => $("board").querySelector(`[data-x="${x}"][data-y="${y}"]`),
    kept: () => posted.filter((m) => m.type === "keep").at(-1),
  };
}

/** Types into a field as a user would. */
const type = (p, id, text) => {
  p.$(id).value = text;
  p.$(id).dispatchEvent(new p.w.Event("input"));
};

describe("the page", () => {
  it("says hello, then shows the lobby in the tile's words", async () => {
    const p = page(createFakeRelay());
    expect(p.posted[0]).toEqual({ type: "hello" });
    p.setup();
    expect(p.shown()).toBe("lobby");
    expect(p.$("new").textContent).toBe("Start a game");
    expect(p.$("code").placeholder).toBe("Game code, like K7P-4QX");
    // It made this player an id and asked the tile to keep it.
    expect(p.kept().player).toMatch(/^[0-9a-f]{24}$/);
  });

  it("asks for a name before starting", async () => {
    const p = page(createFakeRelay());
    p.setup();
    p.$("new").click();
    expect(p.$("error").hidden).toBe(false);
    expect(p.$("error").textContent).toBe("Enter your name first: the other player sees it.");
    type(p, "name", "Ada");
    expect(p.$("error").hidden).toBe(true);
  });

  it("plays a game with another page through the relay", async () => {
    const server = createFakeRelay();
    const ada = page(server);
    const bo = page(server);
    ada.setup();
    bo.setup();

    type(ada, "name", "Ada");
    ada.$("new").click();
    await settle();
    expect(ada.shown()).toBe("waiting");
    expect(ada.$("room-code").value).toBe("K7P-4QX");
    expect(ada.kept()).toMatchObject({ name: "Ada", saved: { room: "K7P4QX", creator: true } });

    type(bo, "name", "Bo");
    type(bo, "code", "k7p-4qx");
    bo.$("join").click();
    await settle();
    expect(ada.shown()).toBe("game");
    expect(bo.shown()).toBe("game");
    expect(ada.$("status").textContent).toBe("Your move.");
    expect(bo.$("status").textContent).toBe("Ada is thinking…");
    expect(ada.$("me").textContent).toContain("You · black");
    expect(bo.$("them").textContent).toContain("Ada · black");

    // Bo can't play out of turn; Ada's click plays and reaches Bo's board.
    bo.point(7, 7).click();
    await settle();
    expect(ada.point(7, 7).dataset.stone).toBe("");
    ada.point(7, 7).click();
    await settle();
    expect(bo.point(7, 7).dataset.stone).toBe("black");
    expect(bo.point(7, 7).classList.contains("last")).toBe(true);
    expect(bo.point(7, 7).getAttribute("aria-label")).toBe("H8, black");
    expect(bo.$("status").textContent).toBe("Your move.");
    expect(ada.kept().saved.moves).toEqual([[7, 7]]);

    // Bo resigns: both see the result and can ask for another game.
    bo.$("resign").click();
    await settle();
    expect(ada.$("status").textContent).toBe("Bo resigned. You win!");
    expect(bo.$("status").textContent).toBe("You resigned. Ada wins.");
    expect(ada.$("rematch").hidden).toBe(false);

    // Leaving goes back to the lobby and tells the other side.
    bo.$("leave").click();
    await settle();
    expect(bo.shown()).toBe("lobby");
    expect(bo.kept().saved).toBeNull();
    expect(ada.$("rematch").hidden).toBe(true);
  });

  it("says where a join went wrong", async () => {
    const p = page(createFakeRelay());
    p.setup();
    type(p, "name", "Cy");
    type(p, "code", "K7P");
    p.$("join").click();
    expect(p.$("error").textContent).toBe("A game code has six letters and digits, like K7P-4QX.");
    type(p, "code", "MN3-RTV");
    p.$("join").click();
    await settle();
    expect(p.shown()).toBe("lobby");
    expect(p.$("error").textContent).toBe(
      "There's no game with that code. Check it and try again.",
    );
  });

  it("asks the tile for a notice only while it doesn't have the focus", async () => {
    const server = createFakeRelay();
    const ada = page(server);
    const bo = page(server);
    ada.setup();
    bo.setup();
    type(ada, "name", "Ada");
    ada.$("new").click();
    await settle();
    bo.w.document.hasFocus = () => false;
    type(bo, "name", "Bo");
    type(bo, "code", "K7P4QX");
    bo.$("join").click();
    await settle();
    ada.point(0, 14).click();
    await settle();
    const notices = bo.posted.filter((m) => m.type === "notice");
    expect(notices).toEqual([
      { type: "notice", kind: "joined", name: "Ada", cell: "" },
      { type: "notice", kind: "moved", name: "Ada", cell: "A1" },
    ]);
    expect(ada.posted.filter((m) => m.type === "notice")).toEqual([]);
  });

  it("resumes the kept game the tile sends back", async () => {
    const server = createFakeRelay();
    const ada = page(server);
    ada.setup();
    type(ada, "name", "Ada");
    ada.$("new").click();
    await settle();
    const kept = ada.kept();
    const again = page(server, { player: kept.player, name: "Ada", saved: kept.saved });
    ada.w.close();
    await settle();
    again.setup();
    await settle();
    expect(again.shown()).toBe("waiting");
    expect(again.$("room-code").value).toBe("K7P-4QX");
    expect(again.$("name").value).toBe("Ada");
  });
});
