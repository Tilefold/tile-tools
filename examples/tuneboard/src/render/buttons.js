/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — on-screen buttons
 *
 * The clickable buttons in a row under the card:
 *
 *     ⏮ previous   ⏯ play/pause   ⏭ next   [− 🔇 +] volume   ☰ playlists
 *
 * Each is its own overlay item (Tilefold reports clicks per item, and a
 * scene may hold only eight). The volume control is one item drawn as three
 * parts, lower, mute and raise, told apart by where the click lands
 * (`volumeHit`). Icons are drawn as SVG paths, not glyphs, so they look the
 * same on every system and need no translation; each button's spoken label
 * comes from the locale files.
 */
import { THEME, svgUrl } from "./svg.js";

/** A button's logical side. */
export const BUTTON = 28;

/** The volume control's logical width: three parts of 25 pixels and a bit. */
export const VOLUME_W = 76;

/**
 * The buttons from left to right: id (also the overlay item id suffix),
 * the action the tile runs (the volume control's depends on where it is
 * clicked), the message key of its spoken label, and its logical width.
 */
export const BUTTONS = [
  { id: "previous", action: "previous", label: "button-previous", w: BUTTON },
  { id: "play", action: "playPause", label: "button-play", w: BUTTON },
  { id: "next", action: "next", label: "button-next", w: BUTTON },
  { id: "volume", action: null, label: "button-volume", w: VOLUME_W },
  { id: "playlists", action: "panel", label: "button-playlists", w: BUTTON },
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
  // Three lines with a note: a list of music.
  playlists:
    `<path d="M7 10 H16 M7 14 H16 M7 18 H12" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M20.5 18.5 V9.5 L23.5 9" stroke="${THEME.accent}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="18.8" cy="18.6" r="2" fill="${THEME.accent}"/>`,
};

/**
 * Draws one button.
 *
 * @param {string} icon One of previous, next, play, pause, playlists.
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

/** A speaker at (x, y), 14×12, with sound waves or, muted, a cross. */
function speaker(x, y, muted) {
  const body = `<path d="M${x} ${y + 4} H${x + 3} L${x + 7} ${y + 0.5} V${y + 11.5} L${x + 3} ${y + 8} H${x} Z" fill="${THEME.text}"/>`;
  const mark = muted
    ? `<path d="M${x + 9.5} ${y + 3.5} L${x + 14} ${y + 8.5} M${x + 14} ${y + 3.5} L${x + 9.5} ${y + 8.5}" stroke="${THEME.error}" stroke-width="1.6" stroke-linecap="round"/>`
    : `<path d="M${x + 9.5} ${y + 3.5} Q${x + 11.5} ${y + 6} ${x + 9.5} ${y + 8.5} M${x + 11.5} ${y + 1.5} Q${x + 15} ${y + 6} ${x + 11.5} ${y + 10.5}" stroke="${THEME.text}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  return body + mark;
}

/**
 * Draws the volume control: − (lower), a speaker (mute; crossed out while
 * muted) and + (raise), in one rounded box.
 *
 * @param {{ displayW?: number, displayH?: number, dim?: boolean, muted?: boolean }} [opts]
 * @returns {string} A `data:image/svg+xml` URL.
 */
export function renderVolume(opts = {}) {
  const third = VOLUME_W / 3;
  const mid = BUTTON / 2;
  const body =
    `<rect x="0.5" y="0.5" width="${VOLUME_W - 1}" height="${BUTTON - 1}" rx="7" ` +
    `fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" ` +
    `stroke="${opts.muted ? THEME.error : THEME.border}"/>` +
    `<path d="M${third} 7 V21 M${third * 2} 7 V21" stroke="${THEME.border}"/>` +
    `<g opacity="${opts.dim ? 0.35 : 1}">` +
    `<path d="M${third / 2 - 5} ${mid} H${third / 2 + 5}" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>` +
    speaker(third + third / 2 - 7, mid - 6, Boolean(opts.muted)) +
    `<path d="M${third * 2.5 - 5} ${mid} H${third * 2.5 + 5} M${third * 2.5} ${mid - 5} V${mid + 5}" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>` +
    `</g>`;
  return svgUrl(VOLUME_W, BUTTON, body, opts.displayW ?? VOLUME_W, opts.displayH ?? BUTTON);
}

/**
 * The action a click on the volume control asks for, by where it lands.
 *
 * @param {{ x: number, w: number }} rect The control's place on screen.
 * @param {number} x The click, in window pixels.
 * @returns {"volumeDown"|"mute"|"volumeUp"|null}
 */
export function volumeHit(rect, x) {
  if (!rect || rect.w <= 0) return null;
  const at = (x - rect.x) / rect.w;
  if (at < 0 || at > 1) return null;
  return at < 1 / 3 ? "volumeDown" : at < 2 / 3 ? "mute" : "volumeUp";
}
