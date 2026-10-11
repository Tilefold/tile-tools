/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — drawing helpers
 *
 * Every pose is drawn in a 48 × 48 box (the pet's size setting scales it on
 * screen). These helpers turn drawn SVG into the `data:` URLs an overlay
 * item takes, and lay animation frames side by side into a sprite sheet.
 */

/** Width and height of one frame, in SVG units. */
export const BOX = 48;

/**
 * SVG markup as a `data:` URL an overlay item accepts.
 *
 * @param {string} inner The SVG elements.
 * @param {number} [frames] How many 48-wide frames sit side by side.
 * @returns {string}
 */
export function svgUrl(inner, frames = 1) {
  const w = BOX * frames;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BOX}" viewBox="0 0 ${w} ${BOX}">${inner}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/**
 * A still pose.
 *
 * @param {string} inner The SVG elements of the frame.
 * @returns {{ image: string, sheet: null }}
 */
export function still(inner) {
  return { image: svgUrl(inner), sheet: null };
}

/**
 * An animated pose: `draw(i)` returns frame i's SVG, drawn as if at x = 0;
 * each frame is shifted into its slot of the sheet.
 *
 * @param {number} frames How many frames.
 * @param {number} fps Frames per second.
 * @param {(i: number) => string} draw
 * @returns {{ image: string, sheet: { frames: number, fps: number } }}
 */
export function sprite(frames, fps, draw) {
  let inner = "";
  for (let i = 0; i < frames; i++) {
    inner += `<g transform="translate(${i * BOX} 0)">${draw(i)}</g>`;
  }
  return { image: svgUrl(inner, frames), sheet: { frames, fps } };
}

/**
 * The soft shadow under the pet.
 *
 * @param {number} rx Half its width.
 * @returns {string}
 */
export function shadow(rx) {
  return `<ellipse cx="24" cy="46" rx="${rx}" ry="2" fill="#1f2937" opacity=".18"/>`;
}

/**
 * The "z" of a sleeping pet, mid-grey so it shows on light and dark themes.
 *
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
export function snore(x, y) {
  return `<text x="${x}" y="${y}" font-size="9" font-family="sans-serif" fill="#94a3b8" stroke="#1f2937" stroke-width=".3">z</text>`;
}
