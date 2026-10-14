/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card — icons
 *
 * One small picture per weather kind, drawn in code from circles and paths
 * on a 32×32 grid and scaled to where the card needs it. Clear skies show a
 * moon at night. Pure: kind in, SVG markup out.
 */
import { THEME } from "./svg.js";

/** A cloud shape on the 32×32 grid. */
const CLOUD = "M9 24 h15 a5 5 0 0 0 0 -10 a7 7 0 0 0 -13 -1 a5.5 5.5 0 0 0 -2 11 z";

/** A sun at (cx, cy) with radius r. */
function sun(cx, cy, r) {
  let rays = "";
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const x1 = Math.round((cx + Math.cos(a) * (r + 3)) * 10) / 10;
    const y1 = Math.round((cy + Math.sin(a) * (r + 3)) * 10) / 10;
    const x2 = Math.round((cx + Math.cos(a) * (r + 6)) * 10) / 10;
    const y2 = Math.round((cy + Math.sin(a) * (r + 6)) * 10) / 10;
    rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${THEME.sun}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${THEME.sun}"/>${rays}`;
}

/** A crescent moon. */
const MOON = `<path d="M20 6 a10 10 0 1 0 6 16 a8 8 0 1 1 -6 -16 z" fill="${THEME.cloud}"/>`;

/** Short slanted lines under the cloud, for rain or drizzle. */
function drops(count, color) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = 11 + i * 5;
    out += `<line x1="${x}" y1="26" x2="${x - 2}" y2="30" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return out;
}

/** The body of each kind's icon. */
function body(kind, day) {
  const cloud = (color = THEME.cloud) => `<path d="${CLOUD}" fill="${color}"/>`;
  switch (kind) {
    case "clear":
      return day ? sun(16, 16, 7) : MOON;
    case "partly":
      return `<g transform="translate(-4 -5) scale(0.8)">${day ? sun(16, 16, 7) : MOON}</g>${cloud()}`;
    case "cloudy":
      return cloud();
    case "fog":
      return (
        cloud("#94a3b8") +
        `<line x1="6" y1="27" x2="26" y2="27" stroke="${THEME.cloud}" stroke-width="2" stroke-linecap="round"/>` +
        `<line x1="9" y1="30" x2="23" y2="30" stroke="${THEME.cloud}" stroke-width="2" stroke-linecap="round"/>`
      );
    case "drizzle":
      return cloud() + drops(2, THEME.rain);
    case "rain":
      return cloud("#94a3b8") + drops(3, THEME.rain);
    case "snow":
      return (
        cloud() +
        [11, 16, 21].map((x) => `<circle cx="${x}" cy="28" r="1.6" fill="${THEME.snow}"/>`).join("")
      );
    case "storm":
      return (
        cloud("#64748b") + `<path d="M17 22 l-4 6 h4 l-2 4 l6 -7 h-4 l2 -3 z" fill="${THEME.sun}"/>`
      );
    default:
      return (
        cloud("#64748b") +
        `<text x="16" y="21" font-size="10" text-anchor="middle" fill="${THEME.panel}">?</text>`
      );
  }
}

/**
 * The icon for a kind at (x, y), `size` pixels square.
 *
 * @param {string} kind
 * @param {boolean} day
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @returns {string}
 */
export function weatherIcon(kind, day, x, y, size) {
  const s = Math.round((size / 32) * 1000) / 1000;
  return `<g transform="translate(${x} ${y}) scale(${s})">${body(kind, day)}</g>`;
}

/**
 * An exclamation mark in a circle, for the card's messages, at (x, y).
 *
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @returns {string}
 */
export function alertIcon(x, y, color) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/>` +
    `<rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/>` +
    `<circle cx="16" cy="23.5" r="1.6" fill="${color}"/>` +
    `</g>`
  );
}
