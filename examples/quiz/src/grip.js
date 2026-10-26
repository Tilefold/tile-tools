/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz — the grip's picture
 *
 * The bar above the card that the user drags it by: a rounded bar with the
 * quiz's title at the left and a row of grip dots in the middle, the sign
 * that it moves. It is drawn once, as one SVG drawing, and shown as two
 * overlay items, each a view of one half of it (an item is at most 256
 * pixels wide). An SVG shown as an image can't run scripts or load
 * anything. Pure: no Tilefold calls.
 */
import { GRIP_H, GRIP_HALF, PAGE_W } from "./scene.js";

/** The grip's colors: readable over light and dark themes alike. */
export const COLORS = Object.freeze({
  bar: "#262833",
  border: "#4a4e5e",
  dots: "#8d92a8",
  text: "#e8e9f0",
});

/** Text made safe inside SVG markup. */
export const xml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The title, shortened to fit the left half beside the dots. */
export const fitTitle = (title, max = 18) => {
  const s = String(title).trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/** The whole bar's drawing (both halves), `PAGE_W` × `GRIP_H`. */
function drawing(title, rtl) {
  const dots = [-12, -6, 0, 6, 12]
    .map((d) => `<circle cx="${PAGE_W / 2 + d}" cy="${GRIP_H / 2}" r="1.6" fill="${COLORS.dots}"/>`)
    .join("");
  const x = rtl ? PAGE_W - 12 : 12;
  const anchor = rtl ? "end" : "start";
  return (
    `<rect x="0.5" y="0.5" width="${PAGE_W - 1}" height="${GRIP_H - 1}" rx="${GRIP_H / 2}" ` +
    `fill="${COLORS.bar}" fill-opacity="0.94" stroke="${COLORS.border}"/>` +
    dots +
    `<text x="${x}" y="${GRIP_H / 2 + 4}" text-anchor="${anchor}" fill="${COLORS.text}" ` +
    `font-family="-apple-system, system-ui, sans-serif" font-size="11" font-weight="600">` +
    `${xml(fitTitle(title))}</text>`
  );
}

/** One half of the drawing as a `data:image/svg+xml` URL. */
function half(body, left) {
  const x = left ? 0 : GRIP_HALF;
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${GRIP_HALF}" height="${GRIP_H}" ` +
    `viewBox="${x} 0 ${GRIP_HALF} ${GRIP_H}">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}

/**
 * The grip's two halves, for a title in the user's language (`rtl` puts
 * it at the right, for right-to-left languages).
 *
 * @returns {{ left: string, right: string }}
 */
export function gripImages(title, rtl = false) {
  const body = drawing(title, rtl);
  return { left: half(body, true), right: half(body, false) };
}
