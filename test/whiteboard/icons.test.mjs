// @vitest-environment node
/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — the page's icons
 *
 * Every icon is an SVG made with the DOM (never parsed from text), on the
 * 24-unit grid, hidden from screen readers since its button carries the
 * label; an unknown name is a mistake, not an empty icon. On a 3D window's
 * bar, every button has its icon and a label, and folding swaps its arrow.
 */
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ICONS, icon } from "../../examples/whiteboard/page-src/icons.js";
import { createFloat } from "../../examples/whiteboard/page-src/floatView.js";

const doc = () =>
  new JSDOM("<!doctype html><body></body>", { url: "https://board.test/" }).window.document;

describe("the icons", () => {
  it("draws each as a decorative SVG of shapes", () => {
    const d = doc();
    expect(ICONS.length).toBeGreaterThanOrEqual(12);
    for (const name of ICONS) {
      const svg = icon(d, name);
      expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("class")).toBe(`icon icon-${name}`);
      expect(svg.children.length).toBeGreaterThan(0);
      for (const shape of svg.children) expect(["path", "circle"]).toContain(shape.tagName);
    }
  });

  it("refuses a name it doesn't have", () => {
    expect(() => icon(doc(), "nope")).toThrow(/no icon "nope"/);
    expect(() => icon(doc(), "__proto__")).toThrow();
  });
});

describe("the window's bar", () => {
  it("gives every button an icon and a label, and swaps the fold arrow", () => {
    const d = doc();
    const noop = () => {};
    const win = createFloat(d, {
      title: "Plane",
      labels: Object.fromEntries(
        [
          "move",
          "fold",
          "unfold",
          "mark",
          "size",
          "zoomIn",
          "zoomOut",
          "clear",
          "opacity",
          "tags",
          "reset",
          "close",
        ].map((k) => [k, k]),
      ),
      folded: false,
      ...Object.fromEntries(
        [
          "onGrab",
          "onDrag",
          "onDrop",
          "onKey",
          "onSizeGrab",
          "onSize",
          "onSizeDrop",
          "onSizeKey",
          "onFold",
          "onZoom",
          "onOpacity",
          "onReset",
          "onClose",
          "onTags",
          "onMarkMode",
          "onPick",
        ].map((k) => [k, noop]),
      ),
    });
    d.body.append(win.host);
    const buttons = [
      ...win.host.querySelectorAll(".float-bar button:not(.float-grip), .float-size"),
    ];
    expect(buttons.length).toBe(9);
    for (const b of buttons) {
      expect(b.querySelector("svg.icon")).not.toBeNull();
      expect(b.getAttribute("aria-label")).toBeTruthy();
      expect(b.textContent).toBe("");
    }
    expect(win.host.querySelectorAll(".float-sep")).toHaveLength(3);
    const fold = win.host.querySelector(".float-fold");
    expect(fold.querySelector(".icon-fold-up")).not.toBeNull();
    fold.click();
    expect(fold.querySelector(".icon-fold-down")).not.toBeNull();
  });
});
