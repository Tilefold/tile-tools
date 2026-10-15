/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — moving the card
 *
 * A saved spot is two fractions of the room the window leaves for the
 * card, checked when read back; it is placed inside the window whatever
 * its size, and a drag off screen is pulled back to the edge. The mover
 * follows a drag that starts on the card (and only then), draws it while
 * dragging, saves and records the drop once, and puts the card back in
 * the pane's corner on request, recording that only when it moved.
 */
import { describe, expect, it, vi } from "vitest";
import { createMover } from "../../../examples/tuneboard/src/tile/mover.js";
import {
  contentOf,
  createDrag,
  placeAt,
  positionFor,
  readPosition,
} from "../../../examples/tuneboard/src/tile/position.js";

const CONTENT = { w: 1000, h: 600 };

describe("position", () => {
  it("reads the window's size, and only sound saved spots", () => {
    expect(contentOf({ content: { w: 1200, h: 700 } })).toEqual({ w: 1200, h: 700 });
    expect(contentOf(null)).toEqual(expect.objectContaining({ w: expect.any(Number) }));
    expect(readPosition({ fx: 0.25, fy: 1 })).toEqual({ fx: 0.25, fy: 1 });
    // Out-of-range fractions are pulled back into [0, 1]; anything else is no spot.
    expect(readPosition({ fx: -0.1, fy: 2 })).toEqual({ fx: 0, fy: 1 });
    for (const bad of [null, "x", { fx: "0.5", fy: 0 }, { fx: NaN, fy: 0 }]) {
      expect(readPosition(bad)).toBeNull();
    }
  });

  it("places a spot inside the window, whatever its size", () => {
    expect(placeAt(CONTENT, 200, 100, { fx: 1, fy: 1 })).toEqual({ x: 800, y: 500 });
    expect(placeAt(CONTENT, 200, 100, { fx: 0, fy: 0 })).toEqual({ x: 0, y: 0 });
    // A card dropped on the right edge stays on it when the window shrinks.
    expect(placeAt({ w: 500, h: 400 }, 200, 100, { fx: 1, fy: 0.5 })).toEqual({ x: 300, y: 150 });
    expect(placeAt({ w: 100, h: 50 }, 200, 100, { fx: 1, fy: 1 })).toEqual({ x: 0, y: 0 });
  });

  it("keeps a drag off screen at the edge", () => {
    expect(positionFor(CONTENT, 200, 100, 400, 250)).toEqual({ fx: 0.5, fy: 0.5 });
    expect(positionFor(CONTENT, 200, 100, -50, 9999)).toEqual({ fx: 0, fy: 1 });
    expect(positionFor({ w: 200, h: 100 }, 200, 100, 30, 30)).toEqual({ fx: 0, fy: 0 });
  });

  it("follows one drag from its start to its end", () => {
    const drag = createDrag();
    expect(drag.move(10, 10, CONTENT, 200, 100)).toBeNull();
    drag.start(100, 100, { x: 50, y: 50 });
    expect(drag.active()).toBe(true);
    expect(drag.move(500, 300, CONTENT, 200, 100)).toEqual(
      positionFor(CONTENT, 200, 100, 450, 250),
    );
    expect(drag.end(500, 300, CONTENT, 200, 100)).toEqual(positionFor(CONTENT, 200, 100, 450, 250));
    expect(drag.active()).toBe(false);
  });
});

describe("mover", () => {
  /** A mover over a fake store and trail, with the card at (50, 50). */
  function setup(saved = null) {
    const store = { position: vi.fn(async () => saved), setPosition: vi.fn(async () => true) };
    const trail = { record: vi.fn() };
    const redraw = vi.fn();
    const mover = createMover({
      store,
      trail,
      layout: () => ({ content: CONTENT }),
      size: () => ({ w: 200, h: 100 }),
      cardRect: () => ({ x: 50, y: 50 }),
      redraw,
      cardId: "card",
    });
    return { mover, store, trail, redraw };
  }

  it("moves the card on a drag that starts on it, saving the drop once", async () => {
    const { mover, store, trail, redraw } = setup();
    expect(await mover.pointer({ type: "drag", item: "card", x: 1, y: 1 })).toBe(false);
    expect(await mover.pointer({ type: "dragstart", item: "btn-play", x: 60, y: 60 })).toBe(false);
    expect(await mover.pointer({ type: "dragstart", item: "card", x: 100, y: 100 })).toBe(true);
    // Later events count whatever item is under the pointer.
    expect(await mover.pointer({ type: "drag", item: "none", x: 500, y: 300 })).toBe(true);
    expect(redraw).toHaveBeenCalledTimes(1);
    expect(store.setPosition).not.toHaveBeenCalled();
    expect(await mover.pointer({ type: "drop", item: "none", x: 500, y: 300 })).toBe(true);
    const spot = positionFor(CONTENT, 200, 100, 450, 250);
    expect(store.setPosition).toHaveBeenCalledWith(spot);
    expect(mover.position()).toEqual(spot);
    expect(trail.record).toHaveBeenCalledWith("view.move", { via: "drag" });
  });

  it("keeps the last drawn spot when the drop has no point", async () => {
    const { mover, store } = setup();
    await mover.pointer({ type: "dragstart", item: "card", x: 100, y: 100 });
    await mover.pointer({ type: "drag", item: "card", x: 300, y: 200 });
    await mover.pointer({ type: "drop", item: "card", x: NaN, y: NaN });
    expect(store.setPosition).toHaveBeenCalledWith(positionFor(CONTENT, 200, 100, 250, 150));
  });

  it("loads a saved spot, and puts the card back only when it moved", async () => {
    const { mover, store, trail } = setup({ fx: 0.2, fy: 0.3 });
    expect(await mover.load()).toEqual({ fx: 0.2, fy: 0.3 });
    expect(await mover.reset("command")).toBe(true);
    expect(store.setPosition).toHaveBeenCalledWith(null);
    expect(trail.record).toHaveBeenCalledWith("view.reset", { via: "command" });
    expect(mover.position()).toBeNull();
    expect(await mover.reset("corner")).toBe(false);
    expect(trail.record).toHaveBeenCalledTimes(1);
  });
});
