/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Built tile tests
 *
 * Runs the built main.js — the exact file Tilefold loads, with the real
 * engine bundled in — against the fake Tilefold host: it registers
 * everything up front, plays with every command, keeps the scene within
 * Tilefold's limits, ends a game with its records, plays every screen in
 * every language, and resumes a saved game identically after a restart. The clock is pinned so the engine's
 * time-based seed (and so every piece) is the same on every run.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDS } from "../../../examples/tilefall/src/tile/commands.js";
import { SETTINGS } from "../../../examples/tilefall/src/tile/settings.js";
import { ROOT, createHost, drain } from "../support/fake-tf.js";

/** Gives every start its own module instance, like a fresh worker. */
let starts = 0;

/** Starts the built main.js against a fake host. */
async function startBuilt(opts) {
  const { host, tf } = createHost(opts);
  starts += 1;
  const mod = await import(`${pathToFileURL(join(ROOT, "main.js")).href}?start=${starts}`);
  mod.default(tf);
  await drain();
  return host;
}

/** Checks the current scene against Tilefold's overlay limits. */
function expectWithinLimits(host) {
  const items = host.overlay.items;
  expect(items.length).toBeLessThanOrEqual(8);
  let chars = 0;
  for (const item of items) {
    expect(item.id.length).toBeLessThanOrEqual(32);
    expect(item.w).toBeLessThanOrEqual(256);
    expect(item.h).toBeLessThanOrEqual(256);
    expect(item.label.length).toBeLessThanOrEqual(80);
    expect(item.image).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    chars += item.image.length;
  }
  expect(chars).toBeLessThan(1_000_000);
}

/** Hard-drops until the game ends (a stack in the middle tops out quickly). */
async function playToTheEnd(host) {
  for (let i = 0; i < 80 && !host.actions().includes("game.over"); i++) {
    await host.command("hard-drop");
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("built main.js", () => {
  it("registers every setting, command and listener at once", async () => {
    const host = await startBuilt();
    expect(host.regs.filter((r) => r.kind === "setting").map((r) => r.key)).toEqual(
      SETTINGS.map((s) => s.key),
    );
    expect(host.regs.filter((r) => r.kind === "command").map((r) => r.id)).toEqual(
      COMMANDS.map((c) => c.id),
    );
    expect(host.regs.filter((r) => r.kind === "hook")).toHaveLength(7);
  });

  it("plays with every command and stays within the overlay limits", async () => {
    const host = await startBuilt();
    await host.command("new-game");
    expectWithinLimits(host);
    const before = host.item("board").image;
    for (const id of ["left", "right", "rotate", "rotate-back", "soft-drop", "hold"]) {
      await host.command(id);
      expectWithinLimits(host);
    }
    expect(host.item("board").image).not.toBe(before);
    await host.advance(10_000);
    expectWithinLimits(host);
    expect(host.errors).toEqual([]);
  });

  it("lets gravity land pieces on its own", async () => {
    const host = await startBuilt();
    await host.command("new-game");
    // Level 1 falls a row a second: a minute lands several pieces.
    await host.advance(60_000);
    const board = decodeURIComponent(host.item("board").image);
    // Each block is three rects; several landed pieces mean well over thirty.
    expect((board.match(/<rect /g) ?? []).length).toBeGreaterThan(30);
    expect(host.errors).toEqual([]);
  });

  it("ends a game with sound, best score, totals and records", async () => {
    const host = await startBuilt();
    await host.command("new-game");
    await host.advance(3000);
    await playToTheEnd(host);
    expect(host.actions()).toEqual(
      expect.arrayContaining(["view.show", "game.start", "game.over", "best.new"]),
    );
    const over = host.audits.find((a) => a.action === "game.over").details;
    expect(over.score).toBeGreaterThan(0);
    expect(over.seconds).toBe(3);
    expect(host.store.get("best")).toBe(over.score);
    expect(host.store.get("stats").games).toBe(1);
    expect(host.store.get("snapshot")).toBeNull();
    expect(host.sounds.length).toBeGreaterThanOrEqual(1);
    expect(decodeURIComponent(host.item("board").image)).toContain("Game over");
    expect(host.errors).toEqual([]);
  });

  it("speeds up at a higher starting level", async () => {
    const slow = await startBuilt();
    await slow.command("new-game");
    await slow.advance(2000);
    const fast = await startBuilt({ settings: { startLevel: 10 } });
    await fast.command("new-game");
    await fast.advance(2000);
    const rows = (host) => {
      const svg = decodeURIComponent(host.item("board").image);
      return Math.max(
        ...[...svg.matchAll(/y="(\d+(?:\.\d+)?)" width="12"/g)].map((m) => Number(m[1])),
      );
    };
    expect(rows(fast)).toBeGreaterThan(rows(slow));
  });

  it.each(readdirSync(join(ROOT, "locales")).sort())(
    "plays through every screen in %s",
    async (locale) => {
      const host = await startBuilt({ locale, store: { visible: true } });
      await host.emit("app.ready");
      expectWithinLimits(host);
      await host.command("new-game");
      await host.command("pause");
      expectWithinLimits(host);
      await host.command("pause");
      await playToTheEnd(host);
      expectWithinLimits(host);
      // The final score made it into the translated "Score { $score }" line.
      const score = host.audits.find((a) => a.action === "game.over").details.score;
      expect(decodeURIComponent(host.item("board").image)).toContain(
        new Intl.NumberFormat().format(score),
      );
      expect(host.errors).toEqual([]);
    },
  );

  it("resumes a saved game exactly, paused, after a restart", async () => {
    const first = await startBuilt();
    await first.command("new-game");
    await first.command("left");
    await first.command("hard-drop");
    await first.command("rotate");
    await first.command("pause");
    const board = first.item("board").image;
    const panel = first.item("panel").image;

    const again = await startBuilt({ store: Object.fromEntries(first.store) });
    await again.emit("app.ready");
    expect(again.actions()).toContain("game.restore");
    expect(again.item("board").image).toBe(board);
    expect(again.item("panel").image).toBe(panel);
    await again.command("pause");
    await again.command("hard-drop");
    expect(again.errors).toEqual([]);
  });
});
