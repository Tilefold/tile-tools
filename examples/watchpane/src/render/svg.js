/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — SVG helpers
 *
 * Small, pure building blocks for the pictures Watchpane draws: escaping
 * text for XML, turning an SVG document into the `data:image/svg+xml` URL
 * the overlay accepts, the card colours, a rough text-width estimate, and
 * text elements that either squeeze (labels) or shorten with an ellipsis
 * (video titles, which can be any length).
 *
 * Every picture is drawn at a fixed "logical" size (its viewBox) and scaled
 * to its display size by the `width`/`height` attributes, so the renderers
 * never have to know which card size the user picked.
 */

/** The largest side Tilefold accepts for one overlay item, in CSS pixels. */
export const MAX_SIDE = 256;

/** The colours of the card and buttons. */
export const THEME = {
  panel: "#121212",
  panelOpacity: 0.94,
  border: "#2a2a2a",
  track: "#3a3a3a",
  text: "#f5f5f5",
  muted: "#a3a3a3",
  accent: "#ff3b30",
  warn: "#f59e0b",
  error: "#ef4444",
};

/** The font stack every text element uses. */
const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";

/**
 * Characters XML forbids even when escaped: controls other than tab, line
 * feed and carriage return, lone surrogates, and U+FFFE/U+FFFF. One of
 * them in a name makes the whole picture invalid (a broken image).
 */
const NOT_XML =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Escapes text for use inside an XML element or a double-quoted attribute,
 * dropping characters XML can't hold at all.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value)
    .replace(NOT_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Rounds a number to at most two decimals, so the SVG text stays short.
 *
 * @param {number} n
 * @returns {number}
 */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Wraps SVG body markup into a complete document and returns it as a
 * `data:image/svg+xml` URL. `logicalW`/`logicalH` are the drawing's own
 * coordinates; `displayW`/`displayH` (default: the same) are its size on
 * screen. Both display sides are capped at {@link MAX_SIDE}.
 *
 * @param {number} logicalW
 * @param {number} logicalH
 * @param {string} body SVG elements.
 * @param {number} [displayW]
 * @param {number} [displayH]
 * @returns {string}
 */
export function svgUrl(logicalW, logicalH, body, displayW = logicalW, displayH = logicalH) {
  const w = Math.min(MAX_SIDE, round2(displayW));
  const h = Math.min(MAX_SIDE, round2(displayH));
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${logicalW} ${logicalH}">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}

/**
 * One vertical strip of a wider picture, as its own `data:image/svg+xml`
 * URL: the part of the logical drawing from `sliceX` to `sliceX + sliceW`,
 * drawn at its logical size. Tilefold draws an overlay item at most
 * {@link MAX_SIDE} pixels a side, so a wider picture (the control dock
 * under the video) goes over the panes as strips laid side by side.
 *
 * @param {number} logicalW The whole picture's width (for the check only).
 * @param {number} logicalH
 * @param {string} body SVG elements of the whole picture.
 * @param {number} sliceX Where the strip starts.
 * @param {number} sliceW The strip's width (at most MAX_SIDE).
 * @returns {string}
 */
export function svgSlice(logicalW, logicalH, body, sliceX, sliceW) {
  const x = Math.max(0, Math.min(logicalW, sliceX));
  const w = Math.min(MAX_SIDE, Math.max(0, Math.min(sliceW, logicalW - x)));
  const h = Math.min(MAX_SIDE, logicalH);
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round2(w)}" height="${round2(h)}" ` +
    `viewBox="${round2(x)} 0 ${round2(w)} ${round2(logicalH)}">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}

/**
 * Decodes an SVG data URL made by {@link svgUrl} back into its markup.
 * Used by tests and diagnostics only.
 *
 * @param {string} url
 * @returns {string}
 */
export function svgOf(url) {
  const at = url.indexOf(",");
  return decodeURIComponent(url.slice(at + 1));
}

/**
 * Whether a code point is drawn about one em wide (CJK ideographs, kana,
 * Hangul and full-width forms); everything else is taken as about 0.6 em.
 *
 * @param {number} cp
 * @returns {boolean}
 */
function isWide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x11ff) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xff60)
  );
}

/**
 * A rough width estimate for a line of text at a font size.
 *
 * @param {string} text
 * @param {number} size Font size.
 * @returns {number}
 */
export function textWidth(text, size) {
  let em = 0;
  for (const ch of String(text)) em += isWide(ch.codePointAt(0) ?? 0) ? 1 : 0.6;
  return em * size;
}

/**
 * Shortens text with a trailing "…" until its estimated width fits
 * `maxWidth`. Works on whole characters (code points), so an emoji or a
 * surrogate pair is never cut in half.
 *
 * @param {unknown} text
 * @param {number} size Font size.
 * @param {number} maxWidth
 * @returns {string}
 */
export function ellipsize(text, size, maxWidth) {
  const s = String(text);
  if (textWidth(s, size) <= maxWidth) return s;
  const chars = [...s];
  while (chars.length > 0 && textWidth(chars.join("") + "…", size) > maxWidth) chars.pop();
  return chars.join("").trimEnd() + "…";
}

/**
 * A `<text>` element. With `squeeze`, text wider than `maxWidth` is fitted
 * with `textLength` (good for short translated labels); otherwise it is
 * shortened with an ellipsis (good for titles of any length).
 *
 * @param {{ x: number, y: number, text: unknown, size: number, fill?: string,
 *           anchor?: "start"|"middle"|"end", weight?: number|string,
 *           maxWidth?: number, squeeze?: boolean, opacity?: number }} o
 * @returns {string}
 */
export function textEl(o) {
  let text = String(o.text);
  const anchor = o.anchor ?? "start";
  const fill = o.fill ?? THEME.text;
  const weight = o.weight ?? 400;
  let fit = "";
  if (o.maxWidth && textWidth(text, o.size) > o.maxWidth) {
    if (o.squeeze) fit = ` textLength="${round2(o.maxWidth)}" lengthAdjust="spacingAndGlyphs"`;
    else text = ellipsize(text, o.size, o.maxWidth);
  }
  const opacity = o.opacity === undefined ? "" : ` opacity="${o.opacity}"`;
  return (
    `<text x="${round2(o.x)}" y="${round2(o.y)}" font-size="${o.size}" ` +
    `font-family="${FONT}" font-weight="${weight}" ` +
    `fill="${fill}" text-anchor="${anchor}"${opacity}${fit}>${escapeXml(text)}</text>`
  );
}
