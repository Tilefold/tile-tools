/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — the playlist panel's picture
 *
 * The panel attached to the card is one overlay item (a scene may hold
 * only eight, and the card and its buttons use seven), so it is drawn as a
 * single picture and clicks are told apart by where they land:
 *
 *     ┌──────────────────────────┐
 *     │ ▣ Road trip             ▐│  five rows' room: cover, name,
 *     │   by Ana · ♪ 42          │  owner and track count; scrolled
 *     │ ▣ …                      │  by dragging, with a thin bar
 *     │ [▲][▼] 1–5 of 23  Show all│  footer: pages, range, the window
 *     └──────────────────────────┘
 *
 * The rows scroll smoothly: the view says which playlist is at the top and
 * how many pixels of it are scrolled off (`shift`), and up to six rows are
 * drawn, clipped to the rows' room. While loading, when empty or after an
 * error, that room shows the message instead. Covers come in already as
 * `data:` URLs; a missing one is drawn as a note. `panelHit` maps a click
 * to a point in the rows (the controller knows the scroll) or a footer
 * button, and `panelPoint` turns window pixels into the panel's own.
 */
import { THEME, ellipsize, escapeXml, round2, svgUrl, textEl } from "./svg.js";
import { CARD_W, wrapLines } from "./card.js";

/** How many playlists the panel shows at a time. */
export const ROWS = 5;

/** The panel's logical size and parts. */
export const PANEL_W = CARD_W;
export const PAD = 6;
export const ROW_H = 34;
const FOOT_H = 26;
export const PANEL_H = PAD + ROWS * ROW_H + FOOT_H + PAD;

/** Where the footer starts, and its buttons' left edges (each 26 wide). */
const FOOT_Y = PAD + ROWS * ROW_H;
const PREV_X = 8;
const NEXT_X = 38;
const FOOT_BTN = 26;
/** Clicks right of this, in the footer, open the Library window. */
const ALL_X = 128;

/** Where a row's text starts. */
const TEXT_X = 44;

/**
 * One row: highlight, cover (or a note), name and the owner line.
 *
 * @param {{ name: string, meta: string, cover: string|null, picked: boolean }} row
 * @param {number} i Its place among the rows drawn (names its cover's clip).
 * @param {number} y Its top edge.
 * @returns {string}
 */
function rowSvg(row, i, y) {
  const parts = [];
  if (row.picked) {
    parts.push(
      `<rect x="4" y="${y + 1}" width="${PANEL_W - 8}" height="${ROW_H - 2}" rx="6" ` +
        `fill="${THEME.accent}" fill-opacity="0.18"/>`,
    );
  }
  if (row.cover) {
    parts.push(
      `<clipPath id="c${i}"><rect x="10" y="${y + 4}" width="26" height="26" rx="4"/></clipPath>` +
        `<image href="${escapeXml(row.cover)}" x="10" y="${y + 4}" width="26" height="26" ` +
        `preserveAspectRatio="xMidYMid slice" clip-path="url(#c${i})"/>`,
    );
  } else {
    parts.push(
      `<rect x="10" y="${y + 4}" width="26" height="26" rx="4" fill="${THEME.track}"/>` +
        `<path d="M21 ${y + 23} V${y + 11} L28 ${y + 9.5} V${y + 21}" stroke="${THEME.muted}" ` +
        `stroke-width="1.6" fill="none"/>` +
        `<circle cx="19.5" cy="${y + 23}" r="2.2" fill="${THEME.muted}"/>` +
        `<circle cx="26.5" cy="${y + 21}" r="2.2" fill="${THEME.muted}"/>`,
    );
  }
  const width = PANEL_W - TEXT_X - 10;
  parts.push(
    textEl({ x: TEXT_X, y: y + 15, text: row.name, size: 12, weight: 600, maxWidth: width }),
    textEl({ x: TEXT_X, y: y + 28, text: row.meta, size: 10, fill: THEME.muted, maxWidth: width }),
  );
  return parts.join("");
}

/** A footer arrow button, pointing up (previous page) or down (next page). */
function arrowSvg(x, up, enabled) {
  const y = FOOT_Y + 1;
  const tip = up
    ? `M${x + 8} ${y + 15} L${x + 13} ${y + 9} L${x + 18} ${y + 15}`
    : `M${x + 8} ${y + 9} L${x + 13} ${y + 15} L${x + 18} ${y + 9}`;
  return (
    `<g opacity="${enabled ? 1 : 0.35}">` +
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="${FOOT_BTN - 1}" height="${FOOT_BTN - 4}" rx="5" ` +
    `fill="none" stroke="${THEME.border}"/>` +
    `<path d="${tip}" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linecap="round" ` +
    `stroke-linejoin="round"/></g>`
  );
}

/**
 * Draws the panel.
 *
 * @param {{ rows: { name: string, meta: string, cover: string|null, picked: boolean }[],
 *           shift?: number, bar?: { top: number, size: number } | null,
 *           status: { text: string, error?: boolean } | null,
 *           range: string, canPrev: boolean, canNext: boolean,
 *           allLabel: string|null }} view
 *   `rows` start with the one at the top, `shift` pixels of it scrolled
 *   off; `bar` is the scroll bar (where it is and how much of the list
 *   shows, both 0–1; null when it all fits); `status` replaces the rows
 *   when set; `allLabel` is the "Show all" link (null when this Tilefold
 *   can't open the Library window).
 * @param {{ displayW?: number, displayH?: number }} [opts]
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderPanel(view, opts = {}) {
  const parts = [
    `<rect x="0.5" y="0.5" width="${PANEL_W - 1}" height="${PANEL_H - 1}" rx="10" ` +
      `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`,
  ];
  if (view.status) {
    const lines = wrapLines(view.status.text, 12, PANEL_W - 28, 4);
    const top = PAD + (ROWS * ROW_H) / 2 - (lines.length * 16) / 2 + 12;
    lines.forEach((line, i) =>
      parts.push(
        textEl({
          x: PANEL_W / 2,
          y: round2(top + i * 16),
          text: line,
          size: 12,
          anchor: "middle",
          fill: view.status.error ? THEME.error : THEME.muted,
        }),
      ),
    );
  } else {
    // Up to one more row than fits, for the one half scrolled in.
    const shift = Math.min(Math.max(Number(view.shift) || 0, 0), ROW_H);
    const rows = view.rows
      .slice(0, ROWS + 1)
      .map((row, i) => rowSvg(row, i, round2(PAD + i * ROW_H - shift)));
    parts.push(
      `<clipPath id="rows"><rect x="0" y="${PAD}" width="${PANEL_W}" height="${ROWS * ROW_H}"/></clipPath>` +
        `<g clip-path="url(#rows)">${rows.join("")}</g>`,
    );
    if (view.bar) {
      const room = ROWS * ROW_H - 4;
      const h = Math.max(12, room * view.bar.size);
      const top = PAD + 2 + (room - h) * view.bar.top;
      parts.push(
        `<rect x="${PANEL_W - 5}" y="${round2(top)}" width="3" height="${round2(h)}" rx="1.5" ` +
          `fill="${THEME.muted}" fill-opacity="0.6"/>`,
      );
    }
  }
  parts.push(
    `<path d="M8 ${FOOT_Y + 0.5} H${PANEL_W - 8}" stroke="${THEME.border}"/>`,
    arrowSvg(PREV_X, true, view.canPrev),
    arrowSvg(NEXT_X, false, view.canNext),
    textEl({
      x: NEXT_X + FOOT_BTN + 6,
      y: FOOT_Y + 17,
      text: ellipsize(view.range, 10, ALL_X - NEXT_X - FOOT_BTN - 10),
      size: 10,
      fill: THEME.muted,
    }),
  );
  if (view.allLabel) {
    parts.push(
      textEl({
        x: PANEL_W - 10,
        y: FOOT_Y + 17,
        text: view.allLabel,
        size: 11,
        weight: 600,
        anchor: "end",
        fill: THEME.accent,
        maxWidth: PANEL_W - ALL_X - 12,
        squeeze: true,
      }),
    );
  }
  return svgUrl(PANEL_W, PANEL_H, parts.join(""), opts.displayW, opts.displayH);
}

/**
 * A point in window pixels as the panel's own (logical) coordinates.
 *
 * @param {{ x: number, y: number, w: number, h: number }} rect The panel's place on screen.
 * @param {number} x
 * @param {number} y
 * @returns {{ x: number, y: number } | null} Null for a rectangle with no size.
 */
export function panelPoint(rect, x, y) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return null;
  return { x: ((x - rect.x) * PANEL_W) / rect.w, y: ((y - rect.y) * PANEL_H) / rect.h };
}

/**
 * What a click on the panel means: a point in the rows' room (`y` from its
 * top edge, before scrolling), the previous or next page, the Library
 * window, or nothing.
 *
 * @param {{ x: number, y: number, w: number, h: number }} rect The panel's place on screen.
 * @param {number} x The click, in window pixels.
 * @param {number} y
 * @returns {{ kind: "row", y: number } | { kind: "prev"|"next"|"all" } | null}
 */
export function panelHit(rect, x, y) {
  const p = panelPoint(rect, x, y);
  if (!p) return null;
  const { x: lx, y: ly } = p;
  if (lx < 0 || lx > PANEL_W || ly < 0 || ly > PANEL_H) return null;
  if (ly >= PAD && ly < FOOT_Y) return { kind: "row", y: ly - PAD };
  if (ly >= FOOT_Y && ly < FOOT_Y + FOOT_H) {
    if (lx >= PREV_X && lx < PREV_X + FOOT_BTN) return { kind: "prev" };
    if (lx >= NEXT_X && lx < NEXT_X + FOOT_BTN) return { kind: "next" };
    if (lx >= ALL_X) return { kind: "all" };
  }
  return null;
}
