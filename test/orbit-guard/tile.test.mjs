// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Orbit Guard — tile tests
 *
 * The built tile against the fake Tilefold: its commands, shortcuts and
 * settings; showing the board and its buttons in the pane's corner; clicks
 * that start, pause and resume; moves that only count during a game; the
 * game clock; pausing when you look away; the best score kept across games;
 * sounds; the activity records; and the user's language.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONE_PANE, startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/orbit-guard/", import.meta.url));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.25);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Starts the tile and shows the board. */
async function shown(opts = {}) {
  const host = await startTile(DIR, opts);
  await host.command("toggle");
  await host.advance(0);
  return host;
}

/** Clicks an overlay item. */
const click = (host, item) => host.emit("overlay.pointer", { item, type: "click", x: 0, y: 0 });

describe("registration", () => {
  it("adds its commands with ids, and the four shared settings", async () => {
    const host = await startTile(DIR);
    const commands = host.regs.filter((r) => r.kind === "command");
    expect(commands.map((c) => c.id)).toEqual([
      "new-game",
      "pause",
      "toggle",
      "left",
      "fire",
      "right",
    ]);
    expect(commands.map((c) => c.title)).toContain("Orbit Guard: Fire");
    expect(host.regs.filter((r) => r.kind === "setting").map((r) => r.key)).toEqual([
      "sounds",
      "size",
      "corner",
      "pauseOnBlur",
    ]);
  });
});

describe("showing", () => {
  it("draws the board and its buttons above the Composer in the pane's bottom-right corner", async () => {
    const host = await shown();
    const ids = host.overlay.items.map((i) => i.id);
    expect(ids).toEqual(["board", "btn-left", "btn-fire", "btn-right", "btn-pause"]);
    const board = host.item("board");
    const pane = ONE_PANE.panes[0];
    expect(board.x + board.w).toBeLessThanOrEqual(pane.x + pane.w);
    expect(host.item("btn-pause").y + host.item("btn-pause").h).toBeLessThanOrEqual(
      pane.composer.y,
    );
    expect(board).toMatchObject({ w: 240, h: 256, hit: true });
    expect(board.label).toBe("Orbit Guard board. Click to play.");
    expect(host.item("btn-fire").label).toBe("Fire");
    expect(host.store.get("visible")).toBe(true);
  });

  it("hides again, and comes back after a restart when it was left showing", async () => {
    const host = await shown();
    await host.command("toggle");
    await host.advance(0);
    expect(host.overlay).toBeNull();
    expect(host.store.get("visible")).toBe(false);

    const again = await startTile(DIR, { store: { visible: true } });
    await again.emit("app.ready");
    await again.advance(0);
    expect(again.item("board")).toBeTruthy();
  });

  it("is smaller and top-left when the settings say so", async () => {
    const host = await shown({ settings: { size: "small", corner: "top-left" } });
    const board = host.item("board");
    expect(board).toMatchObject({ w: 180, h: 192 });
    expect(board.x).toBe(ONE_PANE.panes[0].x + 12);
    expect(board.y).toBe(ONE_PANE.panes[0].y + 12);
  });
});

describe("playing", () => {
  it("starts with a click on the board, runs the clock, and pauses and resumes with clicks", async () => {
    const host = await shown();
    await click(host, "board");
    expect(host.item("board").label).toBe("Orbit Guard board. Click to pause.");
    const first = host.item("board").image;
    await host.advance(1000);
    expect(host.item("board").image).not.toBe(first);
    await click(host, "board");
    expect(host.item("board").label).toBe("Orbit Guard board, paused. Click to resume.");
    const paused = host.item("board").image;
    await host.advance(1000);
    expect(host.item("board").image).toBe(paused);
    await click(host, "btn-pause");
    expect(host.item("board").label).toBe("Orbit Guard board. Click to pause.");
    expect(host.audits.map((a) => a.action)).toEqual(["game-start", "game-pause"]);
  });

  it("moves the cannon only while a game is running", async () => {
    const host = await shown();
    const before = host.item("board").image;
    await host.command("left");
    expect(host.item("board").image).toBe(before);
    await host.command("new-game");
    const start = host.item("board").image;
    await host.command("left");
    await host.command("left");
    expect(host.item("board").image).not.toBe(start);
    await click(host, "btn-right");
    await click(host, "btn-fire");
    expect(host.item("board").image).toContain("fill%3D%22%2322d3ee%22");
  });

  it("pauses when you switch apps, unless told not to, and when overlays are hidden", async () => {
    const host = await shown();
    await host.command("new-game");
    await host.emit("window.blurred");
    expect(host.item("board").label).toMatch(/paused/);

    const keeps = await shown({ settings: { pauseOnBlur: false } });
    await keeps.command("new-game");
    await keeps.emit("window.blurred");
    expect(keeps.item("board").label).toMatch(/Click to pause/);
    await keeps.emit("overlay.hidden", { by: "user" });
    expect(keeps.audits.at(-1)).toEqual({ action: "game-pause", details: { reason: "hidden" } });
  });
});

describe("game over", () => {
  it("keeps the best score, records it and plays a sound", async () => {
    const host = await shown();
    await host.command("new-game");
    // Left alone, the drones reach the ground (or the cannons run out).
    for (let i = 0; i < 40 && !/game over/.test(host.item("board").label); i++) {
      await host.advance(10_000);
    }
    expect(host.item("board").label).toBe("Orbit Guard board, game over. Click for a new game.");
    const over = host.audits.find((a) => a.action === "game-over");
    expect(over.details).toMatchObject({ level: expect.any(Number) });
    expect(host.sounds.length).toBeGreaterThan(0);
    for (const s of host.sounds) expect(s.src).toMatch(/^data:audio\/wav;base64,/);
    // A new game starts from a click on the finished board.
    await click(host, "board");
    expect(host.item("board").label).toMatch(/Click to pause/);
  });

  it("stays quiet when sounds are off", async () => {
    const host = await shown({ settings: { sounds: false } });
    await host.command("new-game");
    for (let i = 0; i < 40 && !/game over/.test(host.item("board").label); i++) {
      await host.advance(10_000);
    }
    expect(host.sounds).toEqual([]);
  });

  it("shows the best score from earlier games", async () => {
    const host = await shown({ store: { best: 4321 } });
    expect(decodeURIComponent(host.item("board").image)).toContain("BEST 4,321");
  });
});

describe("language", () => {
  it("speaks Japanese", async () => {
    const host = await shown({ locale: "ja" });
    expect(host.item("board").label).toBe("Orbit Guard の盤面。クリックして開始します。");
    expect(host.item("btn-fire").label).toBe("発射");
  });
});
