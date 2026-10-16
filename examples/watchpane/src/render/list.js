/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane — the recent videos list
 *
 * Opened with the card's ☰ button: the videos watched lately, newest
 * first, one per row (the one on now is marked), under a heading. A click
 * on a row plays that video. When there are none, a line says how to
 * start. Pure: it draws the list as a data URL, and `listHit` says which
 * row a click (in window pixels) landed on.
 *
 *     ┌──────────────────────────────────┐
 *     │ Watched lately                   │
 *     │ ▶ Video title…                   │
 *     │   Another video…                 │
 *     └──────────────────────────────────┘
 */
import { THEME, svgUrl, textEl } from "./svg.js";

/** The list's logical size. */
export const LIST_W = 240;
/** Rows shown at most. */
export const LIST_ROWS = 6;
const HEAD_H = 28;
const ROW_H = 24;
const PAD = 6;
/** The list's height with `rows` rows. */
export const listHeight = (rows) => HEAD_H + rows * ROW_H + PAD;
/** The list's height under the card. */
export const LIST_H = listHeight(LIST_ROWS);

/**
 * Draws the list.
 *
 * @param {{ heading: string, empty: string, videos: { id: string, title: string }[],
 *           current: string | null }} view
 * @param {{ rows?: number, displayW?: number, displayH?: number }} [opts] `rows`:
 *   how many rows it has room for (LIST_ROWS under the card; more beside the video).
 * @returns {string}
 */
export function renderList(view, opts = {}) {
  const rows = opts.rows ?? LIST_ROWS;
  const h = listHeight(rows);
  let body =
    `<rect x="0.5" y="0.5" width="${LIST_W - 1}" height="${h - 1}" rx="12" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>` +
    textEl({
      x: 12,
      y: 19,
      text: view.heading,
      size: 11,
      weight: 600,
      fill: THEME.muted,
      maxWidth: LIST_W - 24,
    });
  const videos = view.videos.slice(0, rows);
  if (!videos.length) {
    body += textEl({
      x: 12,
      y: HEAD_H + 16,
      text: view.empty,
      size: 10,
      fill: THEME.muted,
      maxWidth: LIST_W - 24,
    });
  }
  videos.forEach((v, i) => {
    const y = HEAD_H + i * ROW_H;
    const on = v.id === view.current;
    if (on) {
      body += `<rect x="6" y="${y + 2}" width="${LIST_W - 12}" height="${ROW_H - 4}" rx="6" fill="${THEME.accent}" fill-opacity="0.18"/>`;
      body += `<path d="M13 ${y + 8} L19 ${y + 12} L13 ${y + 16} Z" fill="${THEME.accent}"/>`;
    }
    body += textEl({ x: 26, y: y + 16, text: v.title || v.id, size: 11, maxWidth: LIST_W - 38 });
  });
  return svgUrl(LIST_W, h, body, opts.displayW, opts.displayH);
}

/**
 * The row a click landed on (0 is the newest), or null for the heading,
 * the empty space or outside.
 *
 * @param {{ x: number, y: number, w: number, h: number } | undefined} rect The list on screen.
 * @param {number} x Window pixels.
 * @param {number} y
 * @param {number} count How many videos there are.
 * @param {number} [rows] How many rows the list has (as drawn).
 */
export function listHit(rect, x, y, count, rows = LIST_ROWS) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return null;
  const lx = ((x - rect.x) * LIST_W) / rect.w;
  const ly = ((y - rect.y) * listHeight(rows)) / rect.h;
  if (lx < 0 || lx > LIST_W || ly < HEAD_H) return null;
  const row = Math.floor((ly - HEAD_H) / ROW_H);
  return row >= 0 && row < Math.min(count, rows) ? row : null;
}
