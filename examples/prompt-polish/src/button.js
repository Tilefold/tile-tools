/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — the corner button's picture
 *
 * A round button with the tile's "P", drawn as an SVG picture for an
 * overlay item, in Tilefold's accent color where Tilefold gives its theme.
 * While fixes are waiting it carries a small badge with their number;
 * while the card is open it has a ring. Pure: no Tilefold calls.
 */

/** A color Tilefold sent, if it is a plain hex or rgb() color; else the fallback. */
function colorOr(value, fallback) {
  const v = String(value ?? "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d\s.,%]+\)$/i.test(v) ? v : fallback;
}

/**
 * The button's picture as a data URL.
 *
 * @param {{ accent?: string, waiting?: number, open?: boolean }} o
 */
export function buttonImage({ accent, waiting = 0, open = false } = {}) {
  const fill = colorOr(accent, "#7c5cff");
  const n = Math.max(0, Math.min(99, Math.floor(Number(waiting) || 0)));
  const badge =
    n > 0
      ? `<circle cx="29" cy="7" r="7" fill="#e5484d"/><text x="29" y="10" font-size="9" font-weight="700" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${n}</text>`
      : "";
  const ring = open
    ? `<circle cx="18" cy="18" r="16.5" fill="none" stroke="${fill}" stroke-width="1.5" opacity=".55"/>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">` +
    `${ring}<circle cx="18" cy="18" r="${open ? 13 : 15}" fill="${fill}"/>` +
    `<text x="18" y="23" font-size="15" font-weight="700" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">P</text>` +
    `${badge}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
