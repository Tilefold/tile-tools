/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the now-watching card
 *
 * The card is the tile's main picture over the panes. Two modes:
 *
 *   video    what is on: the video's picture, its title over two lines,
 *            where it is ("1:23 / 4:56", "Paused", "Muted") and a
 *            progress bar along the bottom
 *
 *     ┌──────────────────────────────────┐
 *     │ ┌────────┐  Video title that     │
 *     │ │ ▶ pic  │  goes on two lines…   │
 *     │ └────────┘  1:23 / 4:56 · Muted  │
 *     │ ━━━━━━━━━━━━━━━━──────────────── │
 *     └──────────────────────────────────┘
 *
 *   message  nothing on yet, or something went wrong: an icon, a title
 *            and a hint over up to two lines
 *
 * Pure: it takes already-translated text (and the picture as a data URL,
 * or null) and returns a data URL.
 */
import { THEME, ellipsize, escapeXml, round2, svgUrl, textEl, textWidth } from "./svg.js";

/** The card's logical size. */
export const CARD_W = 240;
export const CARD_H = 76;

/** The video's picture: 16:9 at the left. */
const PIC = { x: 8, y: 8, w: 96, h: 54 };
/** The text column. */
const TEXT_X = PIC.x + PIC.w + 10;
const TEXT_W = CARD_W - TEXT_X - 10;

/** `seconds` as "m:ss", or "h:mm:ss" from an hour. */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** A fraction kept within 0..1 (0 for anything not a number). */
export function clampProgress(p) {
  const n = Number(p);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Text over at most `maxLines` lines that fit `maxWidth`, breaking at
 * spaces where it can and anywhere where it must; the last line ends
 * with "…" when the text doesn't fit.
 */
export function wrapLines(text, size, maxWidth, maxLines) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const joined = line ? `${line} ${word}` : word;
    if (textWidth(joined, size) <= maxWidth) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
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

/** The card's frame. */
const frame = () =>
  `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="12" ` +
  `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`;

/** The video's picture, rounded, with a play mark when paused (or a placeholder). */
function picture(thumb, playing) {
  const clip = `<clipPath id="pic"><rect x="${PIC.x}" y="${PIC.y}" width="${PIC.w}" height="${PIC.h}" rx="6"/></clipPath>`;
  const base = thumb
    ? `<image href="${escapeXml(thumb)}" x="${PIC.x}" y="${PIC.y}" width="${PIC.w}" height="${PIC.h}" ` +
      `preserveAspectRatio="xMidYMid slice" clip-path="url(#pic)"/>`
    : `<rect x="${PIC.x}" y="${PIC.y}" width="${PIC.w}" height="${PIC.h}" rx="6" fill="${THEME.track}"/>`;
  const cx = PIC.x + PIC.w / 2;
  const cy = PIC.y + PIC.h / 2;
  const mark = playing
    ? ""
    : `<circle cx="${cx}" cy="${cy}" r="13" fill="#000" fill-opacity="0.55"/>` +
      `<path d="M${cx - 4} ${cy - 7} L${cx + 7} ${cy} L${cx - 4} ${cy + 7} Z" fill="#fff"/>`;
  return `<defs>${clip}</defs>${base}${mark}`;
}

/** An exclamation mark in a circle, 32×32 at (x, y). */
function alertIcon(x, y, color) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/>` +
    `<rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/>` +
    `<circle cx="16" cy="23.5" r="1.6" fill="${color}"/>` +
    `</g>`
  );
}

/** A play triangle in a rounded square, 32×32 at (x, y). */
function playIcon(x, y, color) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect width="32" height="32" rx="8" fill="${color}" fill-opacity="0.16"/>` +
    `<path d="M12 9 L24 16 L12 23 Z" fill="${color}"/>` +
    `</g>`
  );
}

/**
 * Draws the card.
 *
 * @param {{ mode: "video", title: string, detail: string, progress: number,
 *           playing: boolean, thumb: string | null }
 *       | { mode: "message", tone: "info" | "error", title: string, hint: string }} view
 * @param {{ displayW?: number, displayH?: number }} [opts]
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderCard(view, opts = {}) {
  let body = frame();
  if (view.mode === "video") {
    const lines = wrapLines(view.title, 11, TEXT_W, 2);
    const barW = CARD_W - 16;
    body +=
      picture(view.thumb, view.playing) +
      lines
        .map((text, i) =>
          textEl({ x: TEXT_X, y: 21 + i * 14, text, size: 11, weight: 600, maxWidth: TEXT_W }),
        )
        .join("") +
      textEl({
        x: TEXT_X,
        y: 57,
        text: view.detail,
        size: 9,
        fill: THEME.muted,
        maxWidth: TEXT_W,
      }) +
      `<rect x="8" y="67" width="${barW}" height="3" rx="1.5" fill="${THEME.track}"/>` +
      `<rect x="8" y="67" width="${round2(barW * clampProgress(view.progress))}" height="3" rx="1.5" fill="${THEME.accent}"/>`;
  } else {
    const color = view.tone === "error" ? THEME.error : THEME.accent;
    body +=
      (view.tone === "error" ? alertIcon(12, 22, color) : playIcon(12, 22, color)) +
      textEl({ x: 54, y: 30, text: view.title, size: 12, weight: 600, maxWidth: CARD_W - 64 }) +
      wrapLines(view.hint, 10, CARD_W - 64, 2)
        .map((text, i) => textEl({ x: 54, y: 46 + i * 13, text, size: 10, fill: THEME.muted }))
        .join("");
  }
  return svgUrl(CARD_W, CARD_H, body, opts.displayW, opts.displayH);
}
