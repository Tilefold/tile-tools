/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Screensaver Themes — tests
 *
 * The pieces: the seeded random numbers repeat for a seed and stay in
 * [0, 1); colors and speeds fall back to green and normal; the Matrix rain
 * fits its columns to the window, clears the canvas on its first frame,
 * falls just as far at 10 frames a second as at 30, and keeps every column
 * in play however long it runs; the starfield scales its stars with the
 * window (within limits), draws only inside it and moves at the same pace
 * at any frame rate.
 *
 * The built tile against the fake Tilefold: it asks for the theme
 * permission only, registers its two settings and two named themes, draws
 * in the chosen color (the user's accent for "theme"), starts afresh on
 * each start, and on a Tilefold without a screensaver registers only its
 * settings.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMatrixRain, GLYPHS } from "../examples/screensaver-themes/src/matrix.js";
import { colorFor, COLORS, speedFor } from "../examples/screensaver-themes/src/palette.js";
import { seededRandom } from "../examples/screensaver-themes/src/random.js";
import {
  createStarfield,
  MAX_STARS,
  MIN_STARS,
} from "../examples/screensaver-themes/src/starfield.js";
import { startTile } from "./fake-host.mjs";
import { DEFAULT_COLORS, fakeContext } from "./fake-screensaver.mjs";

const DIR = fileURLToPath(new URL("../examples/screensaver-themes/", import.meta.url));
const LOOK = { color: "#39ff6a", speed: 1 };

/** Plays `frames` frames `dt` apart on `ctx` with `theme`. */
function play(
  theme,
  { width = 1200, height = 800, frames = 1, dt = 1000 / 30, ctx = fakeContext() } = {},
) {
  for (let i = 0; i < frames; i += 1) {
    theme.draw({ ctx, width, height, dt: i === 0 ? 0 : dt, colors: DEFAULT_COLORS }, LOOK);
  }
  return ctx;
}

afterEach(() => vi.useRealTimers());

describe("random numbers", () => {
  it("repeat for a seed and stay in [0, 1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = Array.from({ length: 200 }, a);
    expect(Array.from({ length: 200 }, b)).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(new Set(first).size).toBeGreaterThan(190);
    // Seed 0 still moves.
    const zero = seededRandom(0);
    expect(zero()).not.toBe(zero());
  });
});

describe("colors and speeds", () => {
  it("fall back to green and normal", () => {
    expect(colorFor("amber", DEFAULT_COLORS)).toBe(COLORS.amber);
    expect(colorFor("theme", DEFAULT_COLORS)).toBe(DEFAULT_COLORS.accent);
    expect(colorFor("theme", {})).toBe(COLORS.green);
    expect(colorFor("purple", DEFAULT_COLORS)).toBe(COLORS.green);
    expect(colorFor("__proto__", DEFAULT_COLORS)).toBe(COLORS.green);
    expect(speedFor("fast")).toBe(1.6);
    expect(speedFor(undefined)).toBe(1);
  });
});

describe("Matrix rain", () => {
  it("fits its columns to the window and clears the canvas first", () => {
    const rain = createMatrixRain(seededRandom(1));
    const ctx = play(rain);
    const { size, columns } = rain.state();
    expect(size).toBe(15);
    expect(columns).toHaveLength(Math.ceil(1200 / 15));
    expect(ctx.calls[0]).toEqual(["fillRect", 0, 0, 1200, 800]);
    // A narrow window: the glyphs never get smaller than 14 pixels.
    play(rain, { width: 300, height: 200, ctx });
    expect(rain.state().size).toBe(14);
    expect(rain.state().columns).toHaveLength(Math.ceil(300 / 14));
  });

  it("draws glyphs from its set", () => {
    const ctx = play(createMatrixRain(seededRandom(2)), { frames: 60 });
    const texts = ctx.calls.filter((c) => c[0] === "fillText");
    expect(texts.length).toBeGreaterThan(100);
    expect(texts.every(([, glyph]) => GLYPHS.includes(glyph))).toBe(true);
  });

  it("falls as far at 10 frames a second as at 30", () => {
    // Tall, so no column reaches the bottom and starts again within the second.
    const fast = createMatrixRain(seededRandom(3));
    const slow = createMatrixRain(seededRandom(3));
    play(fast, { height: 20_000, frames: 31, dt: 1000 / 30 });
    play(slow, { height: 20_000, frames: 11, dt: 100 });
    const a = fast.state().columns;
    const b = slow.state().columns;
    a.forEach((row, i) => expect(row).toBeCloseTo(b[i], 6));
  });

  it("keeps every column in play however long it runs", () => {
    const rain = createMatrixRain(seededRandom(4));
    play(rain, { frames: 30 * 60 });
    const rows = 800 / rain.state().size;
    for (const row of rain.state().columns) {
      expect(row).toBeGreaterThanOrEqual(-rows);
      expect(row).toBeLessThanOrEqual(rows + 1);
    }
  });
});

describe("Starfield", () => {
  it("scales its stars with the window, within limits", () => {
    const sky = createStarfield(seededRandom(5));
    play(sky, { width: 1000, height: 1000 });
    expect(sky.state()).toHaveLength(400);
    play(sky, { width: 100, height: 100 });
    expect(sky.state()).toHaveLength(MIN_STARS);
    play(sky, { width: 5000, height: 3000 });
    expect(sky.state()).toHaveLength(MAX_STARS);
  });

  it("draws only inside the window", () => {
    const ctx = play(createStarfield(seededRandom(6)), { frames: 300 });
    const stars = ctx.calls.filter((c) => c[0] === "fillRect" && c[3] < 10);
    expect(stars.length).toBeGreaterThan(1000);
    for (const [, x, y] of stars) {
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x).toBeLessThan(1202);
      expect(y).toBeGreaterThanOrEqual(-2);
      expect(y).toBeLessThan(802);
    }
  });

  it("moves at the same pace at any frame rate", () => {
    const a = createStarfield(seededRandom(7));
    const b = createStarfield(seededRandom(7));
    play(a, { frames: 4, dt: 1000 / 30 });
    play(b, { frames: 2, dt: 100 });
    // Stars that left the window start again far away at a frame that depends
    // on the rate; every other star must have come exactly as close.
    const near = b.state();
    const kept = a.state().filter((s, i) => s.z < 0.97 && near[i].z < 0.97);
    expect(kept.length).toBeGreaterThan(300);
    a.state().forEach((s, i) => {
      if (s.z < 0.97 && near[i].z < 0.97) expect(s.z).toBeCloseTo(near[i].z, 6);
    });
  });
});

describe("the built tile", () => {
  it("asks for the theme permission only", () => {
    const manifest = JSON.parse(readFileSync(`${DIR}tile.json`, "utf8"));
    expect(manifest.permissions.map((p) => Object.keys(p)[0])).toEqual(["screensaver.theme"]);
    expect(manifest.auth).toBeUndefined();
  });

  it("registers its settings and two named themes", async () => {
    const host = await startTile(DIR, { screensaver: true });
    expect(host.regs).toEqual([
      expect.objectContaining({ kind: "setting", key: "color", default: "green" }),
      expect.objectContaining({ kind: "setting", key: "speed", default: "normal" }),
      { kind: "theme", id: "matrix", name: "Matrix" },
      { kind: "theme", id: "starfield", name: "Starfield" },
    ]);
    expect(host.regs[0].choices.map((c) => c.label)).toEqual([
      "Green",
      "Amber",
      "Blue",
      "Your Tilefold theme's accent",
    ]);
  });

  it("draws in the chosen color", async () => {
    const host = await startTile(DIR, { screensaver: true, settings: { color: "amber" } });
    const ctx = host.drawTheme("matrix", { frames: 30 });
    expect(ctx.sets).toContainEqual(["fillStyle", COLORS.amber]);
    await host.setSetting("color", "theme");
    const sky = host.drawTheme("starfield", {
      frames: 2,
      colors: { ...DEFAULT_COLORS, accent: "#123456" },
    });
    expect(sky.sets).toContainEqual(["fillStyle", "#123456"]);
  });

  it("starts afresh on each start", async () => {
    vi.useFakeTimers({ now: 1000 });
    const host = await startTile(DIR, { screensaver: true });
    const ctx = host.drawTheme("matrix", { frames: 5 });
    // The same canvas, a new start: the canvas is cleared again first.
    const before = ctx.calls.length;
    vi.setSystemTime(2000);
    host.drawTheme("matrix", { frames: 1, ctx });
    expect(ctx.calls[before]).toEqual(["fillRect", 0, 0, 1200, 800]);
  });

  it("registers only its settings on a Tilefold without a screensaver", async () => {
    const host = await startTile(DIR);
    expect(host.regs.map((r) => r.kind)).toEqual(["setting", "setting"]);
  });
});
