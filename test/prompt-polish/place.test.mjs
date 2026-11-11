// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — where the page shows
 *
 * The bottom card spans the focused pane right above its input row and
 * follows focus; it shrinks to a short pane and gives up under Tilefold's
 * 120 px minimum (the tile then uses the side dock); a wide pane is capped
 * at 2,000 px. The corner button sits at the pane's end corner above the
 * input, mirrored right to left, with its card above it when open. The
 * corner button picture and the languages are checked here too. A dragged
 * card moves by its offset but never leaves the pane or covers its input
 * row (the offset kept is what fit); with no pill (the agent input box)
 * the corner card sits right above the box; a filled card spans the pane above
 * its input row, as far as Tilefold docks a page.
 */
import { describe, expect, it } from "vitest";
import {
  PILL_MAX_W,
  PILL_MIN_W,
  buttonImage,
  pillWidth,
} from "../../examples/prompt-polish/src/button.js";
import { LANGUAGES, isUnspaced, languageOf } from "../../examples/prompt-polish/src/languages.js";
import {
  BUTTON,
  BUTTON_H,
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

describe("moving and filling the card", () => {
  const home = { x: GAP, y: 694 - GAP - 300, w: 600 - 2 * GAP, h: 300 };

  it("moves by the drag, within the pane", () => {
    const r = placeFor(twoPanes("p1"), "bottom", { h: 300, offset: { dx: 0, dy: -100 } });
    expect(r.card).toEqual({ ...home, y: home.y - 100 });
    expect(r.offset).toEqual({ dx: 0, dy: -100 });
  });

  it("never leaves the pane nor covers its input row, and keeps what fit", () => {
    const up = placeFor(twoPanes("p1"), "bottom", { h: 300, offset: { dx: -50, dy: -5000 } });
    expect(up.card).toMatchObject({ x: GAP, y: 40 + GAP });
    expect(up.offset).toEqual({ dx: 0, dy: 40 + GAP - home.y });
    const down = placeFor(twoPanes("p1"), "bottom", { h: 300, offset: { dx: 0, dy: 900 } });
    expect(down.card.y + down.card.h).toBe(694 - GAP);
    // The corner card moves sideways too, inside its pane.
    const corner = placeFor(twoPanes("p2"), "corner", {
      h: 200,
      open: true,
      offset: { dx: -5000, dy: 0 },
    });
    expect(corner.card.x).toBe(601 + GAP);
    // Anything but numbers is no drag.
    const odd = placeFor(twoPanes("p1"), "bottom", { h: 300, offset: { dx: "9", dy: NaN } });
    expect(odd.card).toEqual(home);
  });

  it("fills the pane above its input row", () => {
    const r = placeFor(twoPanes("p1"), "bottom", {
      h: 300,
      max: true,
      offset: { dx: 0, dy: -100 },
    });
    expect(r.card).toEqual({ x: GAP, y: 40 + GAP, w: 600 - 2 * GAP, h: 694 - GAP - (40 + GAP) });
    // The drag is kept for when it goes back.
    expect(r.offset).toEqual({ dx: 0, dy: -100 });
    const huge = placeFor(pane(5000, 5000), "bottom", { max: true });
    expect(huge.card.w).toBe(SPOT_MAX);
    expect(huge.card.h).toBe(SPOT_MAX);
  });
});

describe("the corner card over the agent input box", () => {
  it("sits right above the box, with no empty pill spot under it", () => {
    const r = placeFor(twoPanes("p1"), "corner", { h: 200, open: true, noPill: true });
    expect(r.button).toBeNull();
    expect(r.card.y + r.card.h).toBe(694 - GAP);
    // With the pill, the card stays above it.
    const pill = placeFor(twoPanes("p1"), "corner", { h: 200, open: true });
    expect(pill.card.y + pill.card.h).toBe(pill.button.y - GAP);
  });
});

describe("the bottom card", () => {
  it("spans the focused pane, right above its input row", () => {
    expect(placeFor(twoPanes("p1"), "bottom", { h: 300 })).toEqual({
      card: { x: GAP, y: 694 - GAP - 300, w: 600 - 2 * GAP, h: 300 },
      button: null,
      offset: { dx: 0, dy: 0 },
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
  it("closed: only the pill, at the right end of the pane's bottom row, above the input", () => {
    expect(placeFor(twoPanes("p1"), "corner", { open: false, bw: 80 })).toEqual({
      card: null,
      button: { x: 600 - GAP - 80, y: 694 - GAP - BUTTON_H, w: 80, h: BUTTON_H },
    });
    expect(placeFor(twoPanes("p1"), "corner", { open: false }).button.w).toBe(BUTTON);
  });

  it("open: the card above the button, at the same edge; mirrored right to left", () => {
    const s = placeFor(twoPanes("p1"), "corner", { open: true, h: 300 });
    expect(s.card.x + s.card.w).toBe(600 - GAP);
    expect(s.card.y + s.card.h).toBe(s.button.y - GAP);
    const r = placeFor(twoPanes("p1"), "corner", { open: true, h: 300, rtl: true });
    expect(r.card.x).toBe(GAP);
    expect(r.button.x).toBe(GAP);
  });

  it("is as wide as its word needs, within limits", () => {
    expect(pillWidth("Polish")).toBeGreaterThanOrEqual(PILL_MIN_W);
    expect(pillWidth("다듬기")).toBeGreaterThan(pillWidth("Pul"));
    expect(pillWidth("x".repeat(80))).toBe(PILL_MAX_W);
    expect(pillWidth("")).toBe(PILL_MIN_W);
  });

  it("gives up when its card can't fit above the button", () => {
    expect(placeFor(pane(500, 180), "corner", { open: true })).toBeNull();
    expect(placeFor(pane(500, 180), "corner", { open: false }).button).toBeTruthy();
  });

  it("draws the word, a ring while open, and a badge with the waiting fixes", () => {
    const svg = (url) =>
      new TextDecoder().decode(
        Uint8Array.from(atob(url.replace("data:image/svg+xml;base64,", "")), (c) =>
          c.charCodeAt(0),
        ),
      );
    expect(svg(buttonImage())).toMatch(/>Polish</);
    expect(svg(buttonImage({ label: "다듬기" }))).toMatch(/>다듬기</);
    expect(svg(buttonImage({ label: "<b>&" }))).toMatch(/>&lt;b&gt;&amp;</);
    expect(svg(buttonImage({ waiting: 3 }))).toMatch(/>3</);
    expect(svg(buttonImage({ waiting: 0 }))).toMatch(/<path/);
    expect(svg(buttonImage({ waiting: 3 }))).not.toMatch(/<path/);
    expect(svg(buttonImage({ open: true }))).toMatch(/stroke-width="1.5"/);
    expect(svg(buttonImage({ open: false }))).toMatch(/stroke-width="1"/);
    expect(svg(buttonImage({ accent: "#123456" }))).toMatch(/#123456/);
    // Only plain colors from the theme reach the picture.
    expect(svg(buttonImage({ accent: 'red" onload="x' }))).not.toMatch(/onload/);
    expect(svg(buttonImage({ colors: { surfaceRaised: 'x" onload="y' } }))).not.toMatch(/onload/);
  });

  it("is quiet: the theme's raised surface, border and text, with only the sparkle in the accent", () => {
    const svg = (url) =>
      new TextDecoder().decode(
        Uint8Array.from(atob(url.replace("data:image/svg+xml;base64,", "")), (c) =>
          c.charCodeAt(0),
        ),
      );
    const colors = {
      surfaceRaised: "#101112",
      borderStrong: "#202122",
      textSecondary: "#303132",
      accent: "#7c5cff",
    };
    const out = svg(buttonImage({ colors }));
    // The pill's body is the surface, never the accent.
    expect(out).toMatch(/<rect width="\d+" height="26" rx="13" fill="#101112"\/>/);
    expect(out).toMatch(/stroke="#202122"/);
    expect(out).toMatch(/fill="#303132"[^>]*>Polish</);
    expect(out).toMatch(/<path [^>]*fill="#7c5cff"/);
    // Without a theme it falls back to the quiet defaults, not a purple fill.
    expect(svg(buttonImage())).not.toMatch(/rx="13" fill="#7c5cff"/);
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
    expect(viewOf("nowhere")).toBe("corner");
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
