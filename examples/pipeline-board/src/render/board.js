/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Pipeline Board — the board
 *
 * The tile's one picture. Two modes:
 *
 *   list     the project and its latest pipelines, newest first: a status
 *            dot (spinning ring while running), the branch, the pipeline
 *            number, its status and how long ago it changed
 *
 *     ┌────────────────────────────────────┐
 *     │ ◆ group/project                    │
 *     │ ● main              #812  Passed   │
 *     │                           3 min ago│
 *     │ ◌ feature/login     #811  Running  │
 *     │ ● main              #810  Failed   │
 *     └────────────────────────────────────┘
 *
 *   message  a state with nothing to list (signed out, no project, not
 *            found, refused…): an icon in the state's tone, a title and a
 *            hint wrapped between them
 *
 * Pure: it takes already-translated text and returns a data URL and a size.
 */
import { THEME, svgUrl, textEl, wrapLines } from "./svg.js";

/** The board's width, its header, one row, and a message's height. */
export const BOARD_W = 240;
export const HEADER_H = 34;
export const ROW_H = 34;
export const MESSAGE_H = 88;

/** Icon colour by message tone. */
const TONES = { info: THEME.info, warn: THEME.warn, error: THEME.error };

/** The frame behind everything. */
function frame(h) {
  return (
    `<rect x="0.5" y="0.5" width="${BOARD_W - 1}" height="${h - 1}" rx="12" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`
  );
}

/** GitLab-ish mark: a small orange diamond. */
function mark(x, y) {
  return `<path d="M${x + 7} ${y} L${x + 14} ${y + 7} L${x + 7} ${y + 14} L${x} ${y + 7} Z" fill="${THEME.accent}"/>`;
}

/** A status dot; a running pipeline gets an open ring instead. */
function dot(cx, cy, color, running) {
  return running
    ? `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${color}" stroke-width="2.4" stroke-dasharray="20 8"/>`
    : `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}"/>`;
}

/**
 * The list of pipelines.
 *
 * @param {{ project: string,
 *           rows: { ref: string, number: string, status: string, age: string,
 *                   color: string, running: boolean }[],
 *           empty: string }} v
 *   Every text is ready to show. `empty` is shown when there are no rows.
 * @returns {{ image: string, w: number, h: number }}
 */
export function renderList(v) {
  const rows = v.rows.slice(0, 4);
  const h = HEADER_H + Math.max(1, rows.length) * ROW_H + 6;
  let body = frame(h);
  body += mark(12, 11);
  body += textEl({ x: 34, y: 23, text: v.project, size: 12, weight: 600, maxWidth: BOARD_W - 46 });
  body += `<line x1="12" y1="${HEADER_H}" x2="${BOARD_W - 12}" y2="${HEADER_H}" stroke="${THEME.border}"/>`;
  if (rows.length === 0) {
    body += textEl({
      x: 14,
      y: HEADER_H + 22,
      text: v.empty,
      size: 10,
      color: THEME.muted,
      maxWidth: BOARD_W - 28,
    });
  }
  rows.forEach((r, i) => {
    const top = HEADER_H + i * ROW_H;
    body += dot(20, top + 13, r.color, r.running);
    body += textEl({ x: 34, y: top + 17, text: r.ref, size: 11, weight: 600, maxWidth: 118 });
    body += textEl({
      x: BOARD_W - 14,
      y: top + 17,
      text: r.status,
      size: 10,
      color: r.color,
      maxWidth: 64,
      anchor: "end",
    });
    body += textEl({
      x: 34,
      y: top + 30,
      text: r.number,
      size: 9,
      color: THEME.muted,
      maxWidth: 80,
    });
    body += textEl({
      x: BOARD_W - 14,
      y: top + 30,
      text: r.age,
      size: 9,
      color: THEME.muted,
      maxWidth: 110,
      anchor: "end",
    });
  });
  return { image: svgUrl(BOARD_W, h, body), w: BOARD_W, h };
}

/**
 * A message: an exclamation icon in the tone's colour, and a title and a
 * hint wrapped over four lines between them.
 *
 * @param {{ title: string, hint: string, tone: "info" | "warn" | "error" }} v
 * @returns {{ image: string, w: number, h: number }}
 */
export function renderMessage(v) {
  const color = TONES[v.tone] ?? THEME.info;
  const width = BOARD_W - 66;
  let body = frame(MESSAGE_H);
  body +=
    `<g transform="translate(12 12)">` +
    `<circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/>` +
    `<rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/>` +
    `<circle cx="16" cy="23.5" r="1.6" fill="${color}"/></g>`;
  const title = wrapLines(v.title, 12, width, 2);
  const hint = wrapLines(v.hint, 10, width, 4 - title.length);
  let y = 25;
  for (const line of title) {
    body += textEl({ x: 54, y, text: line, size: 12, weight: 600, maxWidth: width });
    y += 15;
  }
  y += 2;
  for (const line of hint) {
    body += textEl({ x: 54, y, text: line, size: 10, color: THEME.muted, maxWidth: width });
    y += 13;
  }
  return { image: svgUrl(BOARD_W, MESSAGE_H, body), w: BOARD_W, h: MESSAGE_H };
}
