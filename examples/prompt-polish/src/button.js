/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith — the Polish pill's picture
 *
 * A small pill with a sparkle and the word "Polish" in the user's
 * language, drawn as an SVG picture for an overlay item, in Tilefold's
 * accent color where Tilefold gives its theme. It sits at the right end of
 * the pane's bottom row, by where the user types. While fixes are waiting
 * their number takes the sparkle's place; while the card is open it has a
 * ring. The label is escaped for the SVG, and only plain colors from the
 * theme reach it. Pure: no Tilefold calls.
 */

/** The pill's height, and the narrowest and widest it gets. */
export const PILL_H = 26;
export const PILL_MIN_W = 64;
export const PILL_MAX_W = 160;

/** A color Tilefold sent, if it is a plain hex or rgb() color; else the fallback. */
function colorOr(value, fallback) {
  const v = String(value ?? "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d\s.,%]+\)$/i.test(v) ? v : fallback;
}

/** Text made safe inside SVG markup. */
const xml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );

/** About how wide a label is at 12 px: wide letters (CJK, Hangul) count double. */
const textWidth = (label) =>
  [...String(label)].reduce((w, ch) => w + (/[ᄀ-ￜ]/.test(ch) ? 12.5 : 7), 0);

/** The pill's width for a label, room for the sparkle and padding included. */
export const pillWidth = (label) =>
  Math.round(Math.min(PILL_MAX_W, Math.max(PILL_MIN_W, 34 + textWidth(label))));

/** Base64 of a UTF-8 string (the label may be in any script). */
function base64(text) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * The pill's picture as a data URL, `w` pixels wide (from `pillWidth`).
 *
 * @param {{ label?: string, w?: number, accent?: string, waiting?: number, open?: boolean, rtl?: boolean }} o
 */
export function buttonImage({
  label = "Polish",
  w,
  accent,
  waiting = 0,
  open = false,
  rtl = false,
} = {}) {
  const width = Number.isFinite(w) ? w : pillWidth(label);
  const fill = colorOr(accent, "#7c5cff");
  const n = Math.max(0, Math.min(99, Math.floor(Number(waiting) || 0)));
  const h = PILL_H;
  // The sparkle sits on the side the text starts from.
  const sx = rtl ? width - 16 : 16;
  const tx = rtl ? width - 28 : 28;
  const ring = open
    ? `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${h - 1.5}" rx="${(h - 1.5) / 2}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".8"/>`
    : "";
  // Waiting fixes: their count in a white dot where the sparkle is, so it never covers the word.
  const mark =
    n > 0
      ? `<circle cx="${sx}" cy="${h / 2}" r="7.5" fill="#fff"/><text x="${sx}" y="${h / 2 + 3.5}" font-size="10" font-weight="700" text-anchor="middle" fill="${fill}" font-family="system-ui,sans-serif">${n}</text>`
      : `<path d="M${sx} 7.5l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" fill="#fff"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">` +
    `<rect width="${width}" height="${h}" rx="${h / 2}" fill="${fill}"/>${ring}` +
    mark +
    `<text x="${tx}" y="17" font-size="12" font-weight="600" text-anchor="${rtl ? "end" : "start"}" fill="#fff" font-family="system-ui,sans-serif">${xml(label)}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${base64(svg)}`;
}
