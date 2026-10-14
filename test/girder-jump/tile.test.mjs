// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump — tile tests
 *
 * The built tile against the fake Tilefold. The arcade kit itself is tested
 * through Orbit Guard; these cover Girder Jump's own wiring: its commands
 * and six buttons (which fit under the board), walking and climbing during
 * a game, a game that ends when the crates catch a climber who stays put,
 * and its Korean strings.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/girder-jump/", import.meta.url));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.75);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function shown(opts = {}) {
  const host = await startTile(DIR, opts);
  await host.command("toggle");
  await host.advance(0);
  return host;
}

describe("Girder Jump", () => {
  it("adds its commands, and six buttons that fit under the board", async () => {
    const host = await shown();
    const ids = host.regs.filter((r) => r.kind === "command").map((c) => c.id);
    expect(ids).toEqual(["new-game", "pause", "toggle", "left", "up", "jump", "down", "right"]);
    const items = host.overlay.items;
    expect(items.map((i) => i.id)).toEqual([
      "board",
      "btn-left",
      "btn-up",
      "btn-jump",
      "btn-down",
      "btn-right",
      "btn-pause",
    ]);
    const board = host.item("board");
    for (const b of items.slice(1)) {
      expect(b.x).toBeGreaterThanOrEqual(board.x);
      expect(b.x + b.w).toBeLessThanOrEqual(board.x + board.w);
      expect(b.y).toBeGreaterThan(board.y + board.h);
    }
    expect(host.item("btn-up").label).toBe("Climb up");
  });

  it("walks and jumps during a game", async () => {
    const host = await shown();
    await host.command("new-game");
    const start = host.item("board").image;
    await host.command("right");
    expect(host.item("board").image).not.toBe(start);
    await click(host, "btn-jump");
    expect(host.sounds.length).toBe(1);
  });

  it("ends when the crates catch a climber who stays put, and records it", async () => {
    const host = await shown();
    await host.command("new-game");
    for (let i = 0; i < 30 && !/game over/.test(host.item("board").label); i++) {
      await host.advance(10_000);
    }
    expect(host.item("board").label).toBe("Girder Jump board, game over. Click for a new game.");
    expect(host.audits.map((a) => a.action)).toContain("game-over");
  });

  it("speaks Korean", async () => {
    const host = await shown({ locale: "ko" });
    expect(host.item("btn-jump").label).toBe("점프");
    expect(decodeURIComponent(host.item("board").image)).toContain("보너스");
  });
});

/** Clicks an overlay item. */
function click(host, item) {
  return host.emit("overlay.pointer", { item, type: "click", x: 0, y: 0 });
}
