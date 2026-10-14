/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — on-screen buttons
 *
 * The six clickable buttons in a row under the card:
 *
 *     ⏮ previous   ⏯ play/pause   ⏭ next   − volume   + volume   ☰ playlists
 *
 * Each is its own overlay item (Tilefold reports clicks per item). Icons
 * are drawn as SVG paths, not glyphs, so they look the same on every system
 * and need no translation; each button's spoken label comes from the
 * locale files.
 */
import { THEME, svgUrl } from "./svg.js";

/** A button's logical side. */
export const BUTTON = 28;

/**
 * The buttons from left to right: id (also the overlay item id suffix),
 * the action the tile runs, and the message key of its spoken label.
 */
export const BUTTONS = [
  { id: "previous", action: "previous", label: "button-previous" },
  { id: "play", action: "playPause", label: "button-play" },
  { id: "next", action: "next", label: "button-next" },
  { id: "volume-down", action: "volumeDown", label: "button-volume-down" },
  { id: "volume-up", action: "volumeUp", label: "button-volume-up" },
  { id: "playlists", action: "panel", label: "button-playlists" },
];

/** Icon artwork in a 28×28 box. */
const ICONS = {
  previous:
    `<rect x="8" y="9" width="2.4" height="10" rx="1" fill="${THEME.text}"/>` +
    `<path d="M20 9 L11.5 14 L20 19 Z" fill="${THEME.text}"/>`,
  next:
    `<rect x="17.6" y="9" width="2.4" height="10" rx="1" fill="${THEME.text}"/>` +
    `<path d="M8 9 L16.5 14 L8 19 Z" fill="${THEME.text}"/>`,
  play: `<path d="M11 8 L20 14 L11 20 Z" fill="${THEME.accent}"/>`,
  pause:
    `<rect x="9.5" y="8.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/>` +
    `<rect x="15.3" y="8.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/>`,
  "volume-down":
    `<path d="M7 11.5 H10 L14 8.5 V19.5 L10 16.5 H7 Z" fill="${THEME.text}"/>` +
    `<path d="M17 14 H22" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>`,
  "volume-up":
    `<path d="M6 11.5 H9 L13 8.5 V19.5 L9 16.5 H6 Z" fill="${THEME.text}"/>` +
    `<path d="M16 14 H22 M19 11 V17" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>`,
  // Three lines with a note: a list of music.
  playlists:
    `<path d="M7 10 H16 M7 14 H16 M7 18 H12" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M20.5 18.5 V9.5 L23.5 9" stroke="${THEME.accent}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="18.8" cy="18.6" r="2" fill="${THEME.accent}"/>`,
};

/**
 * Draws one button.
 *
 * @param {string} icon One of previous, next, play, pause, volume-down, volume-up, playlists.
 * @param {{ displaySize?: number, dim?: boolean, on?: boolean }} [opts] `dim`
 *   greys it out (for example while no device is playing); `on` marks a
 *   button whose panel is open.
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderButton(icon, opts = {}) {
  const art = ICONS[icon] ?? "";
  const body =
    `<rect x="0.5" y="0.5" width="${BUTTON - 1}" height="${BUTTON - 1}" rx="7" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" ` +
    `stroke="${opts.on ? THEME.accent : THEME.border}"/>` +
    `<g opacity="${opts.dim ? 0.35 : 1}">${art}</g>`;
  const size = opts.displaySize ?? BUTTON;
  return svgUrl(BUTTON, BUTTON, body, size, size);
}

/**
 * The icon a button shows right now: the play button turns into "pause"
 * while music is playing.
 *
 * @param {string} id A button id from {@link BUTTONS}.
 * @param {boolean} playing
 * @returns {string}
 */
export function iconFor(id, playing) {
  if (id === "play") return playing ? "pause" : "play";
  return id;
}
