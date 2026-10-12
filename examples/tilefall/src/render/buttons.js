/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — on-screen buttons
 *
 * The six clickable buttons under the panel, laid out like a keypad:
 *
 *     ⟳ rotate   ⤓ drop    ⏸ pause/play
 *     ◀ left     ▼ down    ▶ right
 *
 * Each is its own overlay item (Tilefold reports clicks per item). Icons
 * are drawn as SVG paths, not glyphs, so they look the same on every system
 * and need no translation; each button's spoken label comes from the
 * locale files.
 */
import { THEME, svgUrl } from "./svg.js";

/** A button's logical side. */
export const BUTTON = 26;
/** The gap between buttons. */
export const BUTTON_GAP = 3;

/**
 * The buttons in keypad order: id (also the overlay item id suffix), the
 * action the tile runs, the message key of its spoken label, and its grid
 * cell (column, row).
 */
export const BUTTONS = [
  { id: "rotate", action: "rotate", label: "button-rotate", col: 0, row: 0 },
  { id: "drop", action: "hardDrop", label: "button-drop", col: 1, row: 0 },
  { id: "pause", action: "pause", label: "button-pause", col: 2, row: 0 },
  { id: "left", action: "left", label: "button-left", col: 0, row: 1 },
  { id: "down", action: "softDrop", label: "button-down", col: 1, row: 1 },
  { id: "right", action: "right", label: "button-right", col: 2, row: 1 },
];

/** Icon paths in a 26×26 box, stroked or filled in the text colour. */
const ICONS = {
  left: `<path d="M16 7 L9 13 L16 19 Z" fill="${THEME.text}"/>`,
  right: `<path d="M10 7 L17 13 L10 19 Z" fill="${THEME.text}"/>`,
  down: `<path d="M7 10 L13 17 L19 10 Z" fill="${THEME.text}"/>`,
  drop:
    `<path d="M7 7 L13 13 L19 7" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linejoin="round"/>` +
    `<path d="M7 12 L13 18 L19 12" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linejoin="round"/>` +
    `<path d="M7 20.5 H19" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>`,
  rotate:
    `<path d="M18.5 10.5 A6 6 0 1 0 19 15" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M19.8 6.5 L19.6 11.6 L14.6 10.6 Z" fill="${THEME.text}"/>`,
  pause:
    `<rect x="8.5" y="7.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/>` +
    `<rect x="14.3" y="7.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/>`,
  play: `<path d="M10 7 L19 13 L10 19 Z" fill="${THEME.accent}"/>`,
};

/**
 * Draws one button.
 *
 * @param {string} icon One of left, right, down, drop, rotate, pause, play.
 * @param {{ displaySize?: number, dim?: boolean }} [opts] `dim` greys it
 *   out (for example the movement buttons while paused).
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderButton(icon, opts = {}) {
  const art = ICONS[icon] ?? "";
  const body =
    `<rect x="0.5" y="0.5" width="${BUTTON - 1}" height="${BUTTON - 1}" rx="5" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>` +
    `<g opacity="${opts.dim ? 0.35 : 1}">${art}</g>`;
  const size = opts.displaySize ?? BUTTON;
  return svgUrl(BUTTON, BUTTON, body, size, size);
}

/**
 * The icon a button shows right now: the pause button turns into "play"
 * whenever the game is not running.
 *
 * @param {string} id A button id from {@link BUTTONS}.
 * @param {boolean} running
 * @returns {string}
 */
export function iconFor(id, running) {
  if (id === "pause") return running ? "pause" : "play";
  return id;
}
