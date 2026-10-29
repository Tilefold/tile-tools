// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Gomoku — the tile in a fake Tilefold
 *
 * The built tile, driven as Tilefold would drive it: Play opens the board
 * docked beside the panes (a window on a Tilefold without the dock, or
 * once the user undocks it), the page gets its text, the relay's address
 * and what was kept, and what the page asks to keep is kept for next time.
 * The other player's moves become notices in the user's language; Leave
 * goes through the page when it's open and forgets the game otherwise.
 * Only one-word actions are recorded, never what the players typed.
 */
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { RELAY_URL } from "../../examples/gomoku/src/config.js";
import { PAGE_KEYS } from "../../examples/gomoku/src/strings.js";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/gomoku/", import.meta.url));
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
    // Names and codes the players typed never reach the activity log.
    expect(JSON.stringify(host.audits)).not.toMatch(/Ada|Bo|K7P/);
  }
});

/** The page says something. */
const say = (host, message) => host.emit("page.message", { message });

/** The last setup the tile sent the page. */
const lastSetup = (host) => host.page.posted.filter((m) => m.do === "setup").at(-1);

const SAVED = {
  room: "K7P4QX",
  creator: true,
  name: "Ada",
  opponent: null,
  game: 1,
  moves: [[7, 7]],
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
    expect(setup.labels["status-their-turn"]).toBe("{name} is thinking…");
    expect(setup.labels["cell-black"]).toBe("{cell}, black");
    expect(host.audits.map((a) => a.action)).toEqual(["opened"]);
  });

  it("opens a window on a Tilefold that can't dock beside the panes", async () => {
    const host = await start({ page: true, theme: undefined });
    await host.command("open");
    expect(host.page.opens).toEqual([{}]);
    expect(host.page.side).toBe(false);
  });

  it("moves to a window when the user undocks it", async () => {
    const host = await start();
    await host.command("open");
    await host.undock();
    expect(host.page.open).toBe(true);
    expect(host.page.opens.at(-1)).toEqual({});
  });

  it("tells the user to update on a Tilefold without pages", async () => {
    const host = await start({ page: undefined, theme: undefined });
    await host.command("open");
    expect(host.toasts).toEqual(["Gomoku needs Tilefold 0.1.7 or later."]);
  });

  it("speaks the user's language", async () => {
    const host = await start({ locale: "ko" });
    await host.command("open");
    await say(host, { type: "hello" });
    expect(lastSetup(host).labels["page-lang"]).toBe("ko");
  });
});

describe("keeping the game", () => {
  it("keeps the player's id, name and game, and sends them back next time", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "keep", player: "a1b2c3d4e5f6", name: "Ada", saved: SAVED });
    await host.command("close");
    expect(host.page.open).toBe(false);
    await host.command("open");
    await say(host, { type: "hello" });
    expect(lastSetup(host)).toMatchObject({ player: "a1b2c3d4e5f6", name: "Ada", saved: SAVED });
  });

  it("keeps the game as it is when the page sends only the name", async () => {
    const host = await start({ store: { game: SAVED } });
    await host.command("open");
    await say(host, { type: "keep", player: "a1b2c3d4e5f6", name: "Ada L" });
    expect(host.store.get("game")).toEqual(SAVED);
    expect(host.store.get("name")).toBe("Ada L");
    await say(host, { type: "keep", player: "a1b2c3d4e5f6", name: "Ada L", saved: null });
    expect(host.store.get("game")).toBeNull();
  });

  it("refuses a player id that isn't one", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "keep", player: "<script>", name: "Ada" });
    expect(host.store.has("player")).toBe(false);
  });
});

describe("while playing", () => {
  it("shows the other player's moves and doings as notices", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "notice", kind: "joined", name: "Bo" });
    await say(host, { type: "notice", kind: "moved", name: "Bo", cell: "H8" });
    await say(host, { type: "notice", kind: "made-up", name: "Bo" });
    expect(host.toasts).toEqual([
      "Bo joined your Gomoku game.",
      "Your move in Gomoku: Bo played H8.",
    ]);
  });

  it("records the page's one-word events, and nothing else it sends", async () => {
    const host = await start();
    await host.command("open");
    for (const action of ["created", "started", "won", "nonsense", "K7P4QX"]) {
      await say(host, { type: "event", action });
    }
    expect(host.audits.map((a) => a.action)).toEqual(["opened", "created", "started", "won"]);
  });

  it("closes when the page's close button asks", async () => {
    const host = await start();
    await host.command("open");
    await say(host, { type: "close" });
    expect(host.page.open).toBe(false);
    expect(host.audits.map((a) => a.action)).toEqual(["opened", "closed"]);
  });
});

describe("leaving", () => {
  it("asks the open page to leave the game", async () => {
    const host = await start();
    await host.command("open");
    await host.command("leave");
    expect(host.page.posted.at(-1)).toEqual({ do: "leave" });
  });

  it("forgets the kept game when the board is closed", async () => {
    const host = await start({ store: { game: SAVED } });
    await host.command("leave");
    expect(host.store.get("game")).toBeNull();
    expect(host.audits.map((a) => a.action)).toEqual(["left"]);
  });
});
