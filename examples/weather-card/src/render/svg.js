/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — SVG helpers
 *
 * Small, pure building blocks for the card: escaping text for XML, turning
 * an SVG document into the `data:image/svg+xml` URL the overlay accepts, the
 * colours, a rough text-width estimate and text that shortens itself with
 * "…" so any place name or language fits. An SVG shown by the overlay is a
 * picture: it can't run scripts or load anything.
 */

/** The largest side Tilefold accepts for one overlay item, in CSS pixels. */
export const MAX_SIDE = 256;

/** The card's colours. */
export const THEME = {
  panel: "#0f172a",
  panelOpacity: 0.94,
  border: "#1e293b",
  text: "#f8fafc",
  muted: "#94a3b8",
  sun: "#fbbf24",
  cloud: "#cbd5e1",
  rain: "#38bdf8",
  snow: "#e0f2fe",
  storm: "#a78bfa",
  warn: "#f59e0b",
  error: "#ef4444",
  info: "#38bdf8",
};

/** The font stack every text element uses. */
const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";

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
 * A complete SVG document as a data URL. The drawing uses `w`×`h` logical
 * units and is shown at that size (capped at {@link MAX_SIDE}).
 *
 * @param {number} w
 * @param {number} h
 * @param {string} body SVG elements.
 * @returns {string}
 */
export function svgUrl(w, h, body) {
  const dw = Math.min(MAX_SIDE, w);
  const dh = Math.min(MAX_SIDE, h);
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" ` +
    `viewBox="0 0 ${w} ${h}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
}

/** True for a character drawn about as wide as it is tall (CJK and similar). */
const wide = (ch) => /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿＀-￯]/.test(ch);

/**
 * A rough width of text at a font size: good enough to decide where to cut.
 *
 * @param {unknown} text
 * @param {number} size
 * @returns {number}
 */
export function textWidth(text, size) {
  let units = 0;
  for (const ch of String(text)) units += wide(ch) ? 1 : 0.56;
  return units * size;
}

/**
 * Text shortened with "…" to fit `maxWidth` at `size`.
 *
 * @param {unknown} text
 * @param {number} size
 * @param {number} maxWidth
 * @returns {string}
 */
export function ellipsize(text, size, maxWidth) {
  const s = String(text);
  if (textWidth(s, size) <= maxWidth) return s;
  let out = "";
  for (const ch of s) {
    if (textWidth(`${out}${ch}…`, size) > maxWidth) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
}

/**
 * A text element that never runs past `maxWidth`.
 *
 * @param {{ x: number, y: number, text: unknown, size: number, maxWidth: number,
 *           color?: string, weight?: number, anchor?: string }} o
 * @returns {string}
 */
export function textEl(o) {
  const weight = o.weight ? ` font-weight="${o.weight}"` : "";
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  return (
    `<text x="${o.x}" y="${o.y}" font-family="${FONT}" font-size="${o.size}"${weight}${anchor} ` +
    `fill="${o.color ?? THEME.text}">${escapeXml(ellipsize(o.text, o.size, o.maxWidth))}</text>`
  );
}

/**
 * Text split into at most `maxLines` lines that each fit `maxWidth` at
 * `size`. Breaks at spaces where it can and inside words (or scripts written
 * without spaces) where it must; the last line ends in "…" when the text
 * does not fit at all.
 *
 * @param {unknown} text
 * @param {number} size
 * @param {number} maxWidth
 * @param {number} maxLines
 * @returns {string[]}
 */
export function wrapLines(text, size, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const lines = [];
  let line = "";
  for (const word of words) {
    const joined = line ? `${line} ${word}` : word;
    if (textWidth(joined, size) <= maxWidth) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    // A word wider than the line is broken where it reaches the edge.
    for (const ch of word) {
      if (line && textWidth(line + ch, size) > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, size, maxWidth);
  return kept;
}
