/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — now-playing card
 *
 * The card is the tile's main picture. It has two modes:
 *
 *   track    what is playing: a note icon, the title, the artists, a detail
 *            line (device and volume, or "Paused") and a progress bar
 *
 *     ┌──────────────────────────────┐
 *     │ ♪  Song title                │
 *     │    Artist, Artist            │
 *     │    On MacBook · volume 40%   │
 *     │    ━━━━━━━━━━──────────────  │
 *     └──────────────────────────────┘
 *
 *   message  a state with no track (not signed in, no device, an error…):
 *            an icon in the state's tone, a title and a hint wrapped over
 *            up to three lines
 *
 * Pure: it takes already-translated text and returns a data URL.
 */
import { THEME, ellipsize, round2, svgUrl, textEl, textWidth } from "./svg.js";

/** The card's logical size. */
export const CARD_W = 208;
export const CARD_H = 72;

/** Where the text column starts, and its width. */
const TEXT_X = 54;
const TEXT_W = CARD_W - TEXT_X - 12;

/** Icon colours by message tone. */
const TONES = { info: THEME.accent, warn: THEME.warn, error: THEME.error };

/**
 * Splits text into at most `maxLines` lines that each fit `maxWidth`.
 * Breaks at spaces where it can, and inside words (or in scripts written
 * without spaces) where it must. The last line is shortened with "…" when
 * the text does not fit at all.
 *
 * @param {unknown} text
 * @param {number} size Font size.
 * @param {number} maxWidth
 * @param {number} maxLines
 * @returns {string[]}
 */
export function wrapLines(text, size, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const lines = [];
  let line = "";
  /** Pushes a finished line. */
  const flush = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of words) {
    const joined = line ? `${line} ${word}` : word;
    if (textWidth(joined, size) <= maxWidth) {
      line = joined;
      continue;
    }
    flush();
    // A word wider than the line is broken character by character.
    let piece = "";
    for (const ch of word) {
      if (textWidth(piece + ch, size) > maxWidth && piece) {
        lines.push(piece);
        piece = "";
      }
      piece += ch;
    }
    line = piece;
  }
  flush();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, size, maxWidth);
  return kept;
}

/**
 * The music-note icon in a rounded square, 32×32 at (x, y).
 *
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {number} opacity
 * @returns {string}
 */
function noteIcon(x, y, color, opacity) {
  return (
    `<g transform="translate(${x} ${y})" opacity="${opacity}">` +
    `<rect width="32" height="32" rx="6" fill="${color}" fill-opacity="0.16"/>` +
    `<path d="M13 22 V10 L23 8 V20" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round"/>` +
    `<circle cx="11" cy="22" r="3" fill="${color}"/>` +
    `<circle cx="21" cy="20" r="3" fill="${color}"/>` +
    `</g>`
  );
}

/**
 * An exclamation icon in a circle, 32×32 at (x, y).
 *
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @returns {string}
 */
function alertIcon(x, y, color) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/>` +
    `<rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/>` +
    `<circle cx="16" cy="23.5" r="1.6" fill="${color}"/>` +
    `</g>`
  );
}

/** The card's background frame. */
function frame() {
  return (
    `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="10" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`
  );
}

/**
 * A progress fraction kept within 0..1 (0 for anything not a number).
 *
 * @param {unknown} p
 * @returns {number}
 */
export function clampProgress(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Draws the card.
 *
 * @param {{ mode: "track", title: string, artists: string, detail: string,
 *           progress: number, playing: boolean }
 *       | { mode: "message", tone: "info"|"warn"|"error", title: string, hint: string }} view
 * @param {{ displayW?: number, displayH?: number }} [opts]
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderCard(view, opts = {}) {
  let body = frame();
  if (view.mode === "track") {
    const p = clampProgress(view.progress);
    const barW = TEXT_W;
    body +=
      noteIcon(12, 12, THEME.accent, view.playing ? 1 : 0.5) +
      textEl({ x: TEXT_X, y: 22, text: view.title, size: 13, weight: 600, maxWidth: TEXT_W }) +
      textEl({
        x: TEXT_X,
        y: 37,
        text: view.artists,
        size: 11,
        fill: THEME.muted,
        maxWidth: TEXT_W,
      }) +
      textEl({
        x: TEXT_X,
        y: 51,
        text: view.detail,
        size: 9,
        fill: THEME.muted,
        maxWidth: TEXT_W,
      }) +
      `<rect x="${TEXT_X}" y="58" width="${barW}" height="3" rx="1.5" fill="${THEME.track}"/>` +
      `<rect x="${TEXT_X}" y="58" width="${round2(barW * p)}" height="3" rx="1.5" fill="${THEME.accent}"/>`;
  } else {
    const color = TONES[view.tone] ?? THEME.accent;
    const icon = view.tone === "info" ? noteIcon(12, 12, color, 1) : alertIcon(12, 12, color);
    const hint = wrapLines(view.hint, 10, TEXT_W, 3);
    body +=
      icon +
      textEl({
        x: TEXT_X,
        y: 22,
        text: view.title,
        size: 12,
        weight: 600,
        maxWidth: TEXT_W,
        squeeze: true,
      }) +
      hint
        .map((line, i) =>
          textEl({ x: TEXT_X, y: 37 + i * 12, text: line, size: 10, fill: THEME.muted }),
        )
        .join("");
  }
  return svgUrl(CARD_W, CARD_H, body, opts.displayW ?? CARD_W, opts.displayH ?? CARD_H);
}
