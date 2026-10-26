/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the grip's picture
 *
 * The thin bar above the card that the user can drag it by (as well as by
 * the card's own top bar): a rounded bar with a row of grip dots in the
 * middle, the sign that it moves. It is drawn once, as one SVG drawing as
 * wide as the card, and shown as several overlay items, each a view of one
 * piece of it (an item is at most 256 pixels wide). It is drawn light or
 * dark, like the card under it. An SVG shown as an image can't run scripts
 * or load anything. Pure: no Tilefold calls.
 */
import { GRIP_H } from "./scene.js";

/** The grip's colors, matching the card's in each appearance. */
export const COLORS = Object.freeze({
  dark: Object.freeze({ bar: "#262833", border: "#4a4e5e", dots: "#8d92a8" }),
  light: Object.freeze({ bar: "#f3f4f8", border: "#c9ccd8", dots: "#8a8fa3" }),
});

/** The whole bar's drawing, `width` × `GRIP_H`. */
function drawing(width, theme) {
  const c = theme === "light" ? COLORS.light : COLORS.dark;
  const mid = width / 2;
  const dots = [-12, -6, 0, 6, 12]
    .map((d) => `<circle cx="${mid + d}" cy="${GRIP_H / 2}" r="1.5" fill="${c.dots}"/>`)
    .join("");
  return (
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${GRIP_H - 1}" rx="${GRIP_H / 2}" ` +
    `fill="${c.bar}" fill-opacity="0.96" stroke="${c.border}"/>` +
    dots
  );
}

/** One piece of the drawing, from `from` and `w` wide, as a data URL. */
function piece(body, from, w) {
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${GRIP_H}" ` +
    `viewBox="${from} 0 ${w} ${GRIP_H}">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}

/**
 * The grip's pictures, one per piece (as `gripPieces` cut it), light or dark.
 *
 * @param {number} width the whole grip's width
 * @param {{ from: number, w: number }[]} pieces
 * @param {"light" | "dark"} theme
 * @returns {string[]}
 */
export function gripImages(width, pieces, theme = "dark") {
  const body = drawing(width, theme);
  return pieces.map((p) => piece(body, p.from, p.w));
}
