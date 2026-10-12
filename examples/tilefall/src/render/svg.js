/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — SVG helpers
 *
 * Small, pure building blocks for the pictures Tilefall draws: escaping
 * text for XML, turning an SVG document into the `data:image/svg+xml` URL
 * the overlay accepts, the piece colours, and a text element that squeezes
 * itself to fit when a translated label runs long.
 *
 * Every picture is drawn at a fixed "logical" size (its viewBox) and scaled
 * to its display size by the `width`/`height` attributes, so the renderers
 * never have to know which board size the user picked.
 */

/** The largest side Tilefold accepts for one overlay item, in CSS pixels. */
export const MAX_SIDE = 256;

/**
 * Piece colours by board code (1..7 = I, O, T, S, Z, J, L). Index 0 is the
 * empty cell and is never filled. Chosen to stay readable on a dark panel and
 * to be told apart by most colour-vision types (each also differs in lightness).
 */
export const PIECE_COLORS = [
  "transparent",
  "#22d3ee", // I — cyan
  "#facc15", // O — yellow
  "#a855f7", // T — purple
  "#22c55e", // S — green
  "#ef4444", // Z — red
  "#3b82f6", // J — blue
  "#f97316", // L — orange
];

/** Piece kinds in board-code order; code = index + 1. */
export const KIND_ORDER = ["I", "O", "T", "S", "Z", "J", "L"];

/** The colours of the frame, grid and text that surround the pieces. */
export const THEME = {
  panel: "#0f111a",
  panelOpacity: 0.92,
  border: "#2a2f45",
  grid: "#1c2030",
  text: "#e5e7eb",
  muted: "#9ca3af",
  accent: "#22d3ee",
  shade: "#000000",
};

/**
 * The board code of a kind letter, or 0 for anything unknown.
 *
 * @param {string} kind One of I, O, T, S, Z, J, L.
 * @returns {number}
 */
export function codeOf(kind) {
  return KIND_ORDER.indexOf(kind) + 1;
}

/**
 * The colour for a board code or a kind letter (grey for anything unknown,
 * so a bad value is visible rather than invisible).
 *
 * @param {number|string} codeOrKind
 * @returns {string}
 */
export function colorOf(codeOrKind) {
  const code = typeof codeOrKind === "string" ? codeOf(codeOrKind) : codeOrKind;
  return PIECE_COLORS[code] && code > 0 ? PIECE_COLORS[code] : "#6b7280";
}

/**
 * Escapes text for use inside an XML element or a double-quoted attribute.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value)
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
 * A rough width estimate for a line of text: average glyph width is about
 * 0.6 em for Latin text; wide scripts (CJK, Hangul) are about 1 em.
 *
 * @param {string} text
 * @param {number} size Font size.
 * @returns {number}
 */
export function textWidth(text, size) {
  let em = 0;
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0) ?? 0;
    // CJK ideographs, kana, Hangul and full-width forms are about one em wide.
    const wide =
      (cp >= 0x1100 && cp <= 0x11ff) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xff00 && cp <= 0xff60);
    em += wide ? 1 : 0.6;
  }
  return em * size;
}

/**
 * A `<text>` element. When the text would be wider than `maxWidth` it is
 * squeezed with `textLength` so long translations still fit their box.
 *
 * @param {{ x: number, y: number, text: unknown, size: number, fill?: string,
 *           anchor?: "start"|"middle"|"end", weight?: number|string,
 *           maxWidth?: number, opacity?: number }} o
 * @returns {string}
 */
export function textEl(o) {
  const text = String(o.text);
  const anchor = o.anchor ?? "start";
  const fill = o.fill ?? THEME.text;
  const weight = o.weight ?? 400;
  let fit = "";
  if (o.maxWidth && textWidth(text, o.size) > o.maxWidth) {
    fit = ` textLength="${round2(o.maxWidth)}" lengthAdjust="spacingAndGlyphs"`;
  }
  const opacity = o.opacity === undefined ? "" : ` opacity="${o.opacity}"`;
  return (
    `<text x="${round2(o.x)}" y="${round2(o.y)}" font-size="${o.size}" ` +
    `font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-weight="${weight}" ` +
    `fill="${fill}" text-anchor="${anchor}"${opacity}${fit}>${escapeXml(text)}</text>`
  );
}

/**
 * One block: a filled square with a lighter top-left edge and a darker
 * bottom-right edge, so stacked blocks read as separate pieces.
 *
 * @param {number} x Left, in logical units.
 * @param {number} y Top.
 * @param {number} size Side.
 * @param {string} color Fill.
 * @param {number} [opacity]
 * @returns {string}
 */
export function blockEl(x, y, size, color, opacity = 1) {
  const s = round2(size);
  const e = round2(Math.max(1, size * 0.14));
  const op = opacity === 1 ? "" : ` opacity="${opacity}"`;
  return (
    `<g${op}>` +
    `<rect x="${round2(x)}" y="${round2(y)}" width="${s}" height="${s}" rx="1.5" fill="${color}"/>` +
    `<rect x="${round2(x)}" y="${round2(y)}" width="${s}" height="${e}" fill="#fff" opacity="0.28"/>` +
    `<rect x="${round2(x)}" y="${round2(y + s - e)}" width="${s}" height="${e}" fill="#000" opacity="0.25"/>` +
    `</g>`
  );
}
