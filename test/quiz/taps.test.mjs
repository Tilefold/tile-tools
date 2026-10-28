/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz page — double-clicks on the top bar — tests
 *
 * Two quick clicks in one place on the card's top bar are a double-click
 * (which docks the quiz); a drag, a slow second click, or one far from the
 * first is not, and a third click starts a new pair.
 */
import { describe, expect, it } from "vitest";
import { DOUBLE_MS, DOUBLE_PX, createDoubleTaps } from "../../examples/quiz/page-src/taps.js";

/** One click: pressed at (x, y), let go at (x + dx, y + dy) at `time`. */
const click = (taps, time, x = 100, y = 20, dx = 0, dy = 0) => {
  taps.down({ x, y });
  return taps.up({ x: x + dx, y: y + dy, time });
};

describe("double-clicks on the top bar", () => {
  it("finds two quick clicks in one place", () => {
    const taps = createDoubleTaps();
    expect(click(taps, 1000)).toBe(false);
    expect(click(taps, 1000 + DOUBLE_MS)).toBe(true);
  });

  it("lets the pointer shake a little, but not more", () => {
    const taps = createDoubleTaps();
    click(taps, 0);
    expect(click(taps, 100, 100 + DOUBLE_PX, 20 - DOUBLE_PX)).toBe(true);
    click(taps, 1000);
    expect(click(taps, 1100, 100 + DOUBLE_PX + 1, 20)).toBe(false);
  });

  it("takes no slow second click", () => {
    const taps = createDoubleTaps();
    click(taps, 0);
    expect(click(taps, DOUBLE_MS + 1)).toBe(false);
    // The slow one counts as a first click itself.
    expect(click(taps, DOUBLE_MS + 100)).toBe(true);
  });

  it("is not a click when the press dragged the card, and a drag starts over", () => {
    const taps = createDoubleTaps();
    click(taps, 0);
    expect(click(taps, 100, 100, 20, 30, 0)).toBe(false);
    expect(click(taps, 200)).toBe(false);
    expect(click(taps, 300)).toBe(true);
  });

  it("uses a double-click up: a third click starts a new pair", () => {
    const taps = createDoubleTaps();
    click(taps, 0);
    expect(click(taps, 100)).toBe(true);
    expect(click(taps, 200)).toBe(false);
    expect(click(taps, 300)).toBe(true);
  });

  it("ignores a release with no press seen", () => {
    const taps = createDoubleTaps();
    click(taps, 0);
    expect(taps.up({ x: 100, y: 20, time: 50 })).toBe(false);
    expect(click(taps, 100)).toBe(false);
  });
});
