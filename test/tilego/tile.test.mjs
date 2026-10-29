// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * TileGo — the tile in a fake Tilefold
 *
 * The built tile, driven as Tilefold would drive it: Play opens the board
 * docked beside the panes (a window on a Tilefold without the dock, or
 * once the user undocks it), the page gets its text, the relay's address
 * and what was kept, and what the page asks to keep is kept for next time.
 * The other player's moves, passes and acceptances become notices in the
 * user's language; Leave goes through the page when it's open and forgets
 * the game otherwise. An agent's commands (the board, a move or a pass,
 * the dead stones) open the board when it's closed, wait for it to be
 * ready, pass the request to the page and give back its answer, or its
 * refusal as the reason. Only one-word actions are recorded, never what
 * the players typed or the moves.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { RELAY_URL } from "../../examples/tilego/src/config.js";
import { PAGE_KEYS } from "../../examples/tilego/src/strings.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/tilego/", import.meta.url));
const THEME = { mode: "dark", colors: {} };

const hosts = [];
const start = async (opts = {}) => {
  const host = await startTile(DIR, { page: "side", theme: THEME, ...opts });
  hosts.push(host);
  return host;
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    for (const a of host.audits) expect(a.action).toMatch(/^[a-z][a-z0-9-]*$/);
    // Names, codes and moves never reach the activity log.
    expect(JSON.stringify(host.audits)).not.toMatch(/Ada|Bo|K7P|E5/);
  }
});

/** The page says something. */
const say = (host, message) => host.emit("page.message", { message });

/** The last setup the tile sent the page. */
const lastSetup = (host) => host.page.posted.filter((m) => m.do === "setup").at(-1);

/** Lets the tile's background work run. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The last agent request the tile passed to the page. */
const lastAsk = (host) => host.page.posted.filter((m) => m.do === "agent").at(-1);

/** Opens the board and lets the page say it's ready. */
async function opened(host) {
  await host.command("open");
  await say(host, { type: "hello" });
  await say(host, { type: "ready" });
}

const SAVED = {
  room: "K7P4QX",
  creator: true,
  name: "Ada",
  opponent: null,
  game: 1,
  size: 9,
  moves: [[4, 4], "pass"],
};

describe("opening the board", () => {
  it("docks the page beside the panes and sends it everything it needs", async () => {
    const host = await start();
    await host.command("open");
    expect(host.page).toMatchObject({ open: true, side: true });
    await say(host, { type: "hello" });
    const setup = lastSetup(host);
    expect(setup).toMatchObject({ relay: RELAY_URL, player: null, name: "", saved: null });
    expect(Object.keys(setup.labels).sort()).toEqual([...PAGE_KEYS].sort());
    // Placeholders arrive as marks the page fills in itself.
    expect(setup.labels["score-line"]).toBe("Black {black} · White {white} (with 7.5 komi)");
    expect(setup.labels["status-won"]).toBe("You won by {margin} points!");
    expect(host.audits.map((a) => a.action)).toEqual(["opened"]);
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
    expect(host.toasts).toEqual(["TileGo needs Tilefold 0.1.7 or later."]);
  });

  it("speaks the user's language", async () => {
    const host = await start({ locale: "ja" });
    await host.command("open");
    await say(host, { type: "hello" });
    expect(lastSetup(host).labels["page-lang"]).toBe("ja");
  });
});

describe("keeping the game", () => {
  it("keeps the player's id, name and game, and sends them back next time", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "keep", player: "a1b2c3d4e5f6", name: "Ada", saved: SAVED });
    await host.command("close");
    await host.command("open");
    await say(host, { type: "hello" });
    expect(lastSetup(host)).toMatchObject({ player: "a1b2c3d4e5f6", name: "Ada", saved: SAVED });
  });

  it("refuses a player id that isn't one", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "keep", player: "<script>", name: "Ada" });
    expect(host.store.has("player")).toBe(false);
  });
});

describe("while playing", () => {
  it("shows the other player's moves, passes and acceptances as notices", async () => {
    const host = await start();
    await host.command("open");
    for (const n of [
      { kind: "moved", name: "Bo", cell: "E5" },
      { kind: "passed", name: "Bo" },
      { kind: "scoring", name: "Bo" },
      { kind: "accepted", name: "Bo" },
      { kind: "agent-passed", name: "Agent" },
      { kind: "made-up", name: "Bo" },
    ]) {
      await say(host, { type: "notice", ...n });
    }
    expect(host.toasts).toEqual([
      "Your move in TileGo: Bo played E5.",
      "Your move in TileGo: Bo passed.",
      "Both players passed in TileGo. Mark the dead stones and accept the score.",
      "Bo accepted the score in TileGo.",
      "The agent passed in TileGo. Your move.",
    ]);
  });

  it("records the page's one-word events, and nothing else it sends", async () => {
    const host = await start();
    await host.command("open");
    for (const action of ["created", "started", "scoring", "won", "draw", "E5", "K7P4QX"]) {
      await say(host, { type: "event", action });
    }
    expect(host.audits.map((a) => a.action)).toEqual([
      "opened",
      "created",
      "started",
      "scoring",
      "won",
    ]);
  });
});

describe("leaving", () => {
  it("asks the open page to leave, and forgets the kept game when the board is closed", async () => {
    const open = await start();
    await open.command("open");
    await open.command("leave");
    expect(open.page.posted.at(-1)).toEqual({ do: "leave" });
    const closed = await start({ store: { game: SAVED } });
    await closed.command("leave");
    expect(closed.store.get("game")).toBeNull();
    expect(closed.audits.map((a) => a.action)).toEqual(["left"]);
  });
});

describe("an AI agent's commands", () => {
  it("open the board, wait for it, and give back the page's answer", async () => {
    const host = await start();
    const run = host.command("board", { wait: true });
    await tick();
    expect(host.page.open).toBe(true);
    await say(host, { type: "hello" });
    await say(host, { type: "ready" });
    await tick();
    const ask = lastAsk(host);
    expect(ask).toMatchObject({ do: "agent", ask: "board", input: { wait: true } });
    const board = { mode: "agent", phase: "playing", you: "white", yourTurn: true };
    await say(host, { type: "agent", id: ask.id, reply: { board } });
    expect(await run).toEqual({ board });
  });

  it("pass a move or a pass on, and give a refusal back as the reason", async () => {
    const host = await start();
    await opened(host);
    const run = host.command("move", { cell: "pass" });
    await tick();
    const ask = lastAsk(host);
    expect(ask).toMatchObject({ ask: "play", input: { cell: "pass" } });
    await say(host, { type: "agent", id: ask.id, reply: { error: "It isn't your turn." } });
    await expect(run).rejects.toThrow("It isn't your turn.");
  });

  it("pass the dead stones on", async () => {
    const host = await start();
    await opened(host);
    const run = host.command("score", { dead: ["A1"], accept: true });
    await tick();
    const ask = lastAsk(host);
    expect(ask).toMatchObject({ ask: "score", input: { dead: ["A1"], accept: true } });
    await say(host, { type: "agent", id: ask.id, reply: { ok: true, board: {} } });
    expect(await run).toMatchObject({ ok: true });
  });

  it("only open the board for Play a point or Mark dead stones from the palette", async () => {
    const host = await start();
    await host.command("score");
    expect(host.page.open).toBe(true);
    await host.command("move");
    expect(lastAsk(host)).toBeUndefined();
  });

  it("take input only where they say so", async () => {
    const host = await start();
    await expect(host.command("versus", { cell: "E5" })).rejects.toThrow(/takes no input/);
    const inputs = Object.fromEntries(
      host.regs.filter((r) => r.kind === "command").map((r) => [r.id, r.input ?? null]),
    );
    expect(inputs.board).toMatch(/wait/);
    expect(inputs.move).toMatch(/pass/);
    expect(inputs.score).toMatch(/dead/);
    expect(inputs.versus).toBeNull();
  });

  it("end a request with a reason when the board closes before answering", async () => {
    const host = await start();
    await opened(host);
    const run = host.command("board", { wait: true });
    await tick();
    await host.command("close");
    await expect(run).rejects.toThrow("The board was closed.");
  });
});
