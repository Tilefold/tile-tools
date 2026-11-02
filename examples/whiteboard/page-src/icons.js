/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard page — icons
 *
 * The small line icons on a 3D window's bar and the page's buttons, drawn
 * here as SVG on a 24-unit grid with one stroke width, round ends and
 * `currentColor`, so they take the button's color in light and dark and
 * when pressed. Nothing is loaded: each icon is a few shapes made with the
 * DOM, never parsed from text. Every icon is decoration; its button says
 * what it does with aria-label and title.
 */

const NS = "http://www.w3.org/2000/svg";

/**
 * Each icon's shapes: [tag, attributes]. A shape with `fill` is filled
 * instead of stroked.
 * @type {Record<string, Array<[string, Record<string, string | number>]>>}
 */
const SHAPES = {
  // A cube seen from a corner: the sign of a 3D view.
  cube: [
    ["path", { d: "M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9Z" }],
    ["path", { d: "M3.8 7.6 12 12l8.2-4.4M12 12v9" }],
  ],
  // Six dots: something to drag.
  grip: [
    ["circle", { cx: 9, cy: 6, r: 1.6, fill: 1 }],
    ["circle", { cx: 15, cy: 6, r: 1.6, fill: 1 }],
    ["circle", { cx: 9, cy: 12, r: 1.6, fill: 1 }],
    ["circle", { cx: 15, cy: 12, r: 1.6, fill: 1 }],
    ["circle", { cx: 9, cy: 18, r: 1.6, fill: 1 }],
    ["circle", { cx: 15, cy: 18, r: 1.6, fill: 1 }],
  ],
  "zoom-out": [
    ["circle", { cx: 10.5, cy: 10.5, r: 6.5 }],
    ["path", { d: "m15.5 15.5 5 5M7.5 10.5h6" }],
  ],
  "zoom-in": [
    ["circle", { cx: 10.5, cy: 10.5, r: 6.5 }],
    ["path", { d: "m15.5 15.5 5 5M7.5 10.5h6M10.5 7.5v6" }],
  ],
  // A luggage tag: the parts' labels.
  tags: [
    [
      "path",
      {
        d: "M3.5 11.6V4.8c0-.7.6-1.3 1.3-1.3h6.8l8.9 8.9a1.3 1.3 0 0 1 0 1.8l-6.8 6.8a1.3 1.3 0 0 1-1.8 0Z",
      },
    ],
    ["circle", { cx: 8, cy: 8, r: 1.6, fill: 1 }],
  ],
  // A circle half filled: how see-through.
  opacity: [
    ["circle", { cx: 12, cy: 12, r: 8.5 }],
    ["path", { d: "M12 3.5a8.5 8.5 0 0 1 0 17Z", fill: 1 }],
  ],
  pen: [
    ["path", { d: "M4 20l1.1-4.2L15.8 5.1a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L8.2 18.9Z" }],
    ["path", { d: "m13.8 7.1 3.1 3.1" }],
  ],
  eraser: [
    [
      "path",
      {
        d: "M8.6 19.5 4.1 15a1.8 1.8 0 0 1 0-2.5l8.4-8.4a1.8 1.8 0 0 1 2.5 0l4.9 4.9a1.8 1.8 0 0 1 0 2.5l-8 8Z",
      },
    ],
    ["path", { d: "m9 8.6 6.4 6.4M8.6 19.5H20" }],
  ],
  "fold-up": [["path", { d: "m6.5 14.5 5.5-5.5 5.5 5.5" }]],
  "fold-down": [["path", { d: "m6.5 9.5 5.5 5.5 5.5-5.5" }]],
  close: [["path", { d: "M6.5 6.5l11 11M17.5 6.5l-11 11" }]],
  // Three short diagonals in a corner: drag to resize.
  resize: [["path", { d: "M20 9 9 20M20 14l-6 6M20 19l-1 1" }]],
};

/** The icons there are. */
export const ICONS = Object.freeze(Object.keys(SHAPES));

/**
 * The icon `name` as an SVG element, hidden from screen readers.
 * @param {Document} doc
 * @param {string} name  one of ICONS
 */
export function icon(doc, name) {
  const shapes = SHAPES[name];
  if (!shapes) throw new Error(`no icon "${name}"`);
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("class", `icon icon-${name}`);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [tag, attrs] of shapes) {
    const el = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "fill") el.setAttribute("class", "fill");
      else el.setAttribute(k, String(v));
    }
    svg.append(el);
  }
  return svg;
}
