// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Brickfold — tile tests
 *
 * The built tile against the fake Tilefold. The arcade kit itself is tested
 * through Orbit Guard; these cover Brickfold's own wiring: its commands and
 * buttons, launching and moving the paddle during a game, a game that ends
 * when every ball is missed (with its best score kept and recorded), and
 * its German strings.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTile } from "../fake-host.mjs";

const DIR = fileURLToPath(new URL("../../examples/brickfold/", import.meta.url));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.5);
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

describe("Brickfold", () => {
  it("adds its commands and buttons", async () => {
    const host = await shown();
    const ids = host.regs.filter((r) => r.kind === "command").map((c) => c.id);
    expect(ids).toEqual(["new-game", "pause", "toggle", "left", "launch", "right"]);
    expect(host.overlay.items.map((i) => i.id)).toEqual([
      "board",
      "btn-left",
      "btn-launch",
      "btn-right",
      "btn-pause",
    ]);
    expect(host.item("btn-launch").label).toBe("Launch the ball");
  });

  it("waits for a launch, then the ball moves on its own", async () => {
    const host = await shown();
    await host.command("new-game");
    const waiting = host.item("board").image;
    expect(decodeURIComponent(waiting)).toContain("↑ Launch the ball");
    await host.advance(400);
    expect(host.item("board").image).toBe(waiting);
    await host.command("launch");
    await host.advance(400);
    expect(host.item("board").image).not.toBe(waiting);
    expect(decodeURIComponent(host.item("board").image)).not.toContain("Launch the ball");
  });

  it("ends when every ball is missed, keeping and recording the best score", async () => {
    const host = await shown();
    await host.command("new-game");
    for (let i = 0; i < 6 && !/game over/.test(host.item("board").label); i++) {
      await host.command("launch");
      // Move the paddle out of the way so the ball is missed.
      for (let j = 0; j < 20; j++) await host.command(i % 2 ? "right" : "left");
      await host.advance(15_000);
    }
    expect(host.item("board").label).toBe("Brickfold board, game over. Click for a new game.");
    const over = host.audits.find((a) => a.action === "game-over");
    expect(over).toBeTruthy();
    if (over.details.score > 0) expect(host.store.get("best")).toBe(over.details.score);
  });

  it("speaks German", async () => {
    const host = await shown({ locale: "de" });
    expect(host.item("btn-launch").label).toBe("Ball abschießen");
    expect(host.regs.find((r) => r.id === "launch").title).toBe("Brickfold: Ball abschießen");
  });
});
