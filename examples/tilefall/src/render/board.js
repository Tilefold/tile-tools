/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — board picture
 *
 * Draws the 10×20 playfield as one SVG picture: the frame, a faint grid,
 * the locked blocks, the ghost (where the falling piece will land), the
 * falling piece itself, and — when the game is not running — a shaded
 * banner with a title and a hint ("Paused · Click to resume", "Game over",
 * or the start screen).
 *
 * Pure: it takes the engine's state (or null before the first game) and
 * returns a data URL. All text arrives already translated.
 */
import { THEME, blockEl, colorOf, svgUrl, textEl } from "./svg.js";

/** Columns and rows of the playfield. */
export const COLS = 10;
export const ROWS = 20;

/** Logical cell size and frame padding; the picture is scaled for display. */
export const CELL = 12;
export const PAD = 4;

/** The board's logical size: 128 × 248. */
export const BOARD_W = COLS * CELL + PAD * 2;
export const BOARD_H = ROWS * CELL + PAD * 2;

/**
 * The faint grid lines, drawn once and reused (they never change).
 *
 * @returns {string}
 */
function gridEl() {
  let d = "";
  for (let c = 1; c < COLS; c++) d += `M${PAD + c * CELL} ${PAD}v${ROWS * CELL}`;
  for (let r = 1; r < ROWS; r++) d += `M${PAD} ${PAD + r * CELL}h${COLS * CELL}`;
  return `<path d="${d}" stroke="${THEME.grid}" stroke-width="0.5" fill="none"/>`;
}
const GRID = gridEl();

/**
 * True when (x, y) is a cell inside the visible playfield.
 *
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function inside(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

/**
 * The shaded banner across the middle of the board.
 *
 * @param {string} title
 * @param {string} [hint]
 * @param {string} [extra] A third line, e.g. the final score.
 * @returns {string}
 */
function bannerEl(title, hint, extra) {
  const lines = [title, extra, hint].filter(Boolean).length;
  const h = 18 + lines * 16;
  const y = (BOARD_H - h) / 2;
  let out =
    `<rect x="0" y="0" width="${BOARD_W}" height="${BOARD_H}" rx="6" fill="${THEME.shade}" opacity="0.45"/>` +
    `<rect x="${PAD + 2}" y="${y}" width="${BOARD_W - PAD * 2 - 4}" height="${h}" rx="5" ` +
    `fill="${THEME.panel}" stroke="${THEME.accent}" stroke-width="1"/>`;
  let ty = y + 22;
  const max = BOARD_W - PAD * 2 - 12;
  out += textEl({
    x: BOARD_W / 2,
    y: ty,
    text: title,
    size: 14,
    weight: 700,
    anchor: "middle",
    maxWidth: max,
  });
  if (extra) {
    ty += 16;
    out += textEl({
      x: BOARD_W / 2,
      y: ty,
      text: extra,
      size: 10,
      anchor: "middle",
      fill: THEME.accent,
      maxWidth: max,
    });
  }
  if (hint) {
    ty += 16;
    out += textEl({
      x: BOARD_W / 2,
      y: ty,
      text: hint,
      size: 9,
      anchor: "middle",
      fill: THEME.muted,
      maxWidth: max,
    });
  }
  return out;
}

/**
 * Draws the board.
 *
 * @param {object|null} state The engine's `getState()`, or null before any game.
 * @param {{ ghost?: boolean, banner?: { title: string, hint?: string, extra?: string } | null,
 *           displayW?: number, displayH?: number }} [opts]
 *   `ghost` shows the landing shadow (default true); `banner` draws the
 *   shaded message (none when null or missing); display size defaults to
 *   the logical size.
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderBoard(state, opts = {}) {
  const showGhost = opts.ghost !== false;
  let body =
    `<rect x="0.5" y="0.5" width="${BOARD_W - 1}" height="${BOARD_H - 1}" rx="6" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>` +
    GRID;

  if (state) {
    // Locked blocks.
    const board = Array.isArray(state.board) ? state.board : [];
    for (let y = 0; y < Math.min(ROWS, board.length); y++) {
      const row = board[y] || [];
      for (let x = 0; x < Math.min(COLS, row.length); x++) {
        const code = row[x];
        if (code) body += blockEl(PAD + x * CELL, PAD + y * CELL, CELL, colorOf(code));
      }
    }
    const active = state.active;
    const color = active ? colorOf(active.kind) : null;
    // The ghost: an outline where the piece would land (skipped where it overlaps the piece).
    if (showGhost && active && Array.isArray(state.ghost) && !state.over) {
      const live = new Set((active.cells || []).map(([x, y]) => `${x},${y}`));
      for (const [x, y] of state.ghost) {
        if (!inside(x, y) || live.has(`${x},${y}`)) continue;
        body +=
          `<rect x="${PAD + x * CELL + 1}" y="${PAD + y * CELL + 1}" width="${CELL - 2}" ` +
          `height="${CELL - 2}" rx="1.5" fill="${color}" fill-opacity="0.12" stroke="${color}" ` +
          `stroke-opacity="0.55" stroke-width="1"/>`;
      }
    }
    // The falling piece (cells above the top edge are simply not drawn).
    if (active && Array.isArray(active.cells)) {
      for (const [x, y] of active.cells) {
        if (inside(x, y)) body += blockEl(PAD + x * CELL, PAD + y * CELL, CELL, color);
      }
    }
  }

  if (opts.banner && opts.banner.title) {
    body += bannerEl(opts.banner.title, opts.banner.hint, opts.banner.extra);
  }
  return svgUrl(BOARD_W, BOARD_H, body, opts.displayW, opts.displayH);
}
