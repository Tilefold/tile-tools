/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Arcade kit — SVG helpers
 *
 * Small, pure building blocks for the pictures the arcade examples draw:
 * escaping text, turning an SVG document into the `data:image/svg+xml` URL
 * the overlay accepts, the shared colours, the score bar, the banners shown
 * over the board, and the round buttons with their icons.
 *
 * Every picture is drawn at a fixed logical size (its viewBox) and scaled to
 * its display size by `width`/`height`, so the renderers never need to know
 * which board size the user picked.
 *
 * This file is the same in every arcade example.
 */

/** The largest side Tilefold accepts for one overlay item, in CSS pixels. */
export const MAX_SIDE = 256;

/** The height of the score bar at the top of every board. */
export const HUD_H = 18;

/** Colours shared by the frame, the score bar, banners and buttons. */
export const THEME = {
  panel: "#0b0d17",
  border: "#2a2f45",
  text: "#e5e7eb",
  muted: "#9ca3af",
  accent: "#22d3ee",
  warn: "#f97316",
  shade: "#000000",
  button: "#1b1f30",
};

/**
 * Escapes text for an XML element or a double-quoted attribute.
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
 * Wraps SVG markup into a document and returns it as a `data:` URL.
 *
 * @param {number} w Logical width.
 * @param {number} h Logical height.
 * @param {string} body SVG elements.
 * @param {number} [displayW] Width on screen (default: the logical width).
 * @param {number} [displayH] Height on screen.
 * @returns {string}
 */
export function svgUrl(w, h, body, displayW = w, displayH = h) {
  const dw = Math.min(MAX_SIDE, Math.round(displayW * 100) / 100);
  const dh = Math.min(MAX_SIDE, Math.round(displayH * 100) / 100);
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" ` +
    `viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}

/**
 * The markup of an SVG data URL made by {@link svgUrl}. For tests.
 *
 * @param {string} url
 * @returns {string}
 */
export function svgOf(url) {
  return decodeURIComponent(url.slice(url.indexOf(",") + 1));
}

/**
 * The board's frame: a dark panel with a thin border.
 *
 * @param {number} w
 * @param {number} h
 * @returns {string}
 */
export function frame(w, h) {
  return (
    `<rect width="${w}" height="${h}" rx="6" fill="${THEME.panel}" fill-opacity="0.94"/>` +
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" fill="none" ` +
    `stroke="${THEME.border}"/>`
  );
}

/**
 * Roughly how wide a text runs, in logical pixels: wide scripts (Chinese,
 * Japanese, Korean) count about double.
 *
 * @param {string} value
 * @param {number} size Font size.
 * @returns {number}
 */
export function textWidth(value, size) {
  let units = 0;
  for (const ch of value)
    units += /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(ch)
      ? 1.7
      : 1;
  return units * size * 0.6;
}

/**
 * A text element; `size` in logical pixels, `anchor` start, middle or end.
 * With `fit`, a text wider than that many pixels is squeezed to fit, so a
 * long translation never runs off the board.
 *
 * @param {number} x
 * @param {number} y
 * @param {unknown} value
 * @param {{ size?: number, fill?: string, anchor?: string, weight?: number, fit?: number }} [o]
 * @returns {string}
 */
export function text(x, y, value, o = {}) {
  const size = o.size ?? 9;
  const squeeze =
    o.fit && textWidth(String(value), size) > o.fit
      ? ` textLength="${o.fit}" lengthAdjust="spacingAndGlyphs"`
      : "";
  return (
    `<text x="${x}" y="${y}"${squeeze} font-family="ui-monospace,Menlo,monospace" ` +
    `font-size="${size}" font-weight="${o.weight ?? 600}" ` +
    `fill="${o.fill ?? THEME.text}" text-anchor="${o.anchor ?? "start"}">` +
    `${escapeXml(value)}</text>`
  );
}

/**
 * The score bar: score on the left, best in the middle, level and lives on
 * the right.
 *
 * @param {number} w Board width.
 * @param {{ score: string, best: string, level: string, lives: number,
 *           labels: { score: string, best: string, level: string }, lifeColor?: string }} o
 * @returns {string}
 */
export function hud(w, o) {
  const y = 12;
  let lives = "";
  for (let i = 0; i < Math.min(o.lives, 5); i++) {
    lives += `<rect x="${w - 10 - i * 8}" y="6" width="5" height="5" fill="${o.lifeColor ?? THEME.accent}"/>`;
  }
  return (
    text(6, y, `${o.labels.score} ${o.score}`, { size: 8, fit: 76 }) +
    text(w / 2 - 8, y, `${o.labels.best} ${o.best}`, {
      size: 8,
      fill: THEME.muted,
      anchor: "middle",
      fit: 72,
    }) +
    text(w - 14 - Math.min(o.lives, 5) * 8, y, `${o.labels.level} ${o.level}`, {
      size: 8,
      fill: THEME.muted,
      anchor: "end",
      fit: 52,
    }) +
    lives +
    `<line x1="4" y1="${HUD_H - 0.5}" x2="${w - 4}" y2="${HUD_H - 0.5}" stroke="${THEME.border}"/>`
  );
}

/**
 * A shaded banner across the middle of the board, with a title and a hint.
 *
 * @param {number} w
 * @param {number} h
 * @param {string} title
 * @param {string} [hint]
 * @returns {string}
 */
export function banner(w, h, title, hint = "") {
  const y = h / 2;
  return (
    `<rect x="0" y="${HUD_H}" width="${w}" height="${h - HUD_H}" fill="${THEME.shade}" fill-opacity="0.45"/>` +
    `<rect x="12" y="${y - 24}" width="${w - 24}" height="${hint ? 44 : 30}" rx="6" ` +
    `fill="${THEME.panel}" stroke="${THEME.accent}"/>` +
    text(w / 2, y - 4, title, { size: 13, anchor: "middle", fill: THEME.accent, fit: w - 36 }) +
    (hint
      ? text(w / 2, y + 12, hint, { size: 9, anchor: "middle", fill: THEME.muted, fit: w - 36 })
      : "")
  );
}

/** Icon paths for buttons, drawn in a 30×30 box. */
export const ICONS = {
  left: `<path d="M18 8 L10 15 L18 22 Z" fill="${THEME.text}"/>`,
  right: `<path d="M12 8 L20 15 L12 22 Z" fill="${THEME.text}"/>`,
  up: `<path d="M8 18 L15 10 L22 18 Z" fill="${THEME.text}"/>`,
  down: `<path d="M8 12 L15 20 L22 12 Z" fill="${THEME.text}"/>`,
  fire: `<circle cx="15" cy="15" r="6" fill="${THEME.warn}"/><circle cx="15" cy="15" r="2.5" fill="${THEME.text}"/>`,
  jump: `<path d="M9 20 Q15 4 21 20" fill="none" stroke="${THEME.text}" stroke-width="2.5"/>`,
  launch: `<path d="M15 7 L15 21 M9 13 L15 7 L21 13" fill="none" stroke="${THEME.text}" stroke-width="2.5"/>`,
  pause: `<rect x="10" y="9" width="3.5" height="12" fill="${THEME.text}"/><rect x="16.5" y="9" width="3.5" height="12" fill="${THEME.text}"/>`,
  play: `<path d="M11 8 L22 15 L11 22 Z" fill="${THEME.text}"/>`,
};

/**
 * A round button with an icon.
 *
 * @param {string} icon A key of {@link ICONS}.
 * @param {number} side Display side in CSS pixels.
 * @returns {string}
 */
export function buttonImage(icon, side) {
  return svgUrl(
    30,
    30,
    `<circle cx="15" cy="15" r="14" fill="${THEME.button}" stroke="${THEME.border}"/>` +
      (ICONS[icon] ?? ""),
    side,
    side,
  );
}
