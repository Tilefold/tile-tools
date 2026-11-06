// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — where the page shows
 *
 * The bottom card spans the focused pane right above its input row and
 * follows focus; it shrinks to a short pane and gives up under Tilefold's
 * 120 px minimum (the tile then uses the side dock); a wide pane is capped
 * at 2,000 px. The corner button sits at the pane's end corner above the
 * input, mirrored right to left, with its card above it when open. The
 * corner button picture and the languages are checked here too.
 */
import { describe, expect, it } from "vitest";
import { buttonImage } from "../../examples/prompt-polish/src/button.js";
import { LANGUAGES, isUnspaced, languageOf } from "../../examples/prompt-polish/src/languages.js";
import {
  BUTTON,
  GAP,
  MAX_H,
  SPOT_MAX,
  SPOT_MIN,
  focusedPane,
  placeFor,
  sameSpot,
  viewOf,
} from "../../examples/prompt-polish/src/place.js";

/** Two panes side by side; `focus` names the focused one. */
const twoPanes = (focus) => ({
  content: { w: 1200, h: 800 },
  panes: [
    {
      id: "p1",
      x: 0,
      y: 40,
      w: 600,
      h: 700,
      focused: focus === "p1",
      composer: { x: 0, y: 694, w: 600, h: 46 },
    },
    {
      id: "p2",
      x: 601,
      y: 40,
      w: 599,
      h: 700,
      focused: focus === "p2",
      composer: { x: 601, y: 694, w: 599, h: 46 },
    },
  ],
});
const pane = (w, h, composer = null) => ({
  panes: [{ id: "p", x: 0, y: 0, w, h, focused: true, composer }],
});

describe("the bottom card", () => {
  it("spans the focused pane, right above its input row", () => {
    expect(placeFor(twoPanes("p1"), "bottom", { h: 300 })).toEqual({
      card: { x: GAP, y: 694 - GAP - 300, w: 600 - 2 * GAP, h: 300 },
      button: null,
    });
  });

  it("follows focus to the other pane", () => {
    expect(placeFor(twoPanes("p2"), "bottom", { h: 300 }).card.x).toBe(601 + GAP);
  });

  it("goes over the pane it is asked for, and nowhere when that pane isn't there", () => {
    expect(placeFor(twoPanes("p1"), "bottom", { h: 300, pane: "p2" }).card.x).toBe(601 + GAP);
    expect(placeFor(twoPanes("p1"), "bottom", { pane: "p9" })).toBeNull();
    expect(focusedPane(twoPanes("p1"), "p2").id).toBe("p2");
  });

  it("sits at the pane's bottom edge when it has no input row", () => {
    const s = placeFor(pane(500, 600), "bottom", { h: 200 });
    expect(s.card.y + s.card.h).toBe(600 - GAP);
  });

  it("asks for at least 120 px and at most its tallest", () => {
    expect(placeFor(pane(500, 900), "bottom", { h: 40 }).card.h).toBe(SPOT_MIN);
    expect(placeFor(pane(500, 900), "bottom", { h: 5000 }).card.h).toBe(MAX_H);
  });

  it("shrinks to a short pane, and gives up under Tilefold's minimum", () => {
    expect(placeFor(pane(500, 260), "bottom", { h: 340 }).card.h).toBe(260 - 2 * GAP);
    expect(placeFor(pane(500, 130), "bottom")).toBeNull();
    expect(placeFor(pane(130, 600), "bottom")).toBeNull();
  });

  it("is capped at 2,000 px wide", () => {
    expect(placeFor(pane(2600, 600), "bottom").card.w).toBe(SPOT_MAX);
  });
});

describe("the corner button", () => {
  it("closed: only the button, in the pane's end corner above the input", () => {
    expect(placeFor(twoPanes("p1"), "corner", { open: false })).toEqual({
      card: null,
      button: { x: 600 - GAP - BUTTON, y: 694 - GAP - BUTTON, w: BUTTON, h: BUTTON },
    });
  });

  it("open: the card above the button, at the same edge; mirrored right to left", () => {
    const s = placeFor(twoPanes("p1"), "corner", { open: true, h: 300 });
    expect(s.card.x + s.card.w).toBe(600 - GAP);
    expect(s.card.y + s.card.h).toBe(s.button.y - GAP);
    const r = placeFor(twoPanes("p1"), "corner", { open: true, h: 300, rtl: true });
    expect(r.card.x).toBe(GAP);
    expect(r.button.x).toBe(GAP);
  });

  it("gives up when its card can't fit above the button", () => {
    expect(placeFor(pane(500, 180), "corner", { open: true })).toBeNull();
    expect(placeFor(pane(500, 180), "corner", { open: false }).button).toBeTruthy();
  });

  it("draws a P, a ring while open, and a badge with the waiting fixes", () => {
    const svg = (url) => atob(url.replace("data:image/svg+xml;base64,", ""));
    expect(svg(buttonImage())).toMatch(/>P</);
    expect(svg(buttonImage({ waiting: 3 }))).toMatch(/>3</);
    expect(svg(buttonImage({ waiting: 0 }))).not.toMatch(/#e5484d/);
    expect(svg(buttonImage({ open: true }))).toMatch(/stroke=/);
    expect(svg(buttonImage({ accent: "#123456" }))).toMatch(/#123456/);
    // Only plain colors from the theme reach the picture.
    expect(svg(buttonImage({ accent: 'red" onload="x' }))).not.toMatch(/onload/);
  });
});

describe("the rest", () => {
  it("other views, no panes, or broken panes give no spot", () => {
    expect(placeFor(twoPanes("p1"), "side")).toBeNull();
    expect(placeFor({ panes: [] }, "bottom")).toBeNull();
    expect(placeFor(null, "corner")).toBeNull();
    expect(focusedPane({ panes: [{ x: "a" }] })).toBeNull();
    expect(focusedPane(twoPanes("")).id).toBe("p1");
  });

  it("checks views and compares spots", () => {
    expect(viewOf("corner")).toBe("corner");
    expect(viewOf("nowhere")).toBe("bottom");
    expect(sameSpot({ x: 1, y: 2, w: 3, h: 4 }, { x: 1, y: 2, w: 3, h: 4 })).toBe(true);
    expect(sameSpot({ x: 1, y: 2, w: 3, h: 4 }, null)).toBe(false);
  });

  it("knows Tilefold's twelve languages, Tilefold's own for auto, and which have no spaces", () => {
    expect(LANGUAGES).toHaveLength(12);
    expect(languageOf("ko", "en").name).toBe("Korean");
    expect(languageOf("auto", "de").name).toBe("German");
    expect(languageOf("auto", "xx").code).toBe("en");
    expect(isUnspaced("ja")).toBe(true);
    expect(isUnspaced("ko")).toBe(false);
  });
});
