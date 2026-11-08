/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith page — small pieces
 *
 * The prompt's size as the page shows it, how a change of spaces only is
 * drawn, and the view switch's icons (built as SVG elements, never parsed
 * from text).
 */

/** Whether a changed run is only spaces (a spacing fix would be invisible). */
export const wsShown = (s) => /^[^\S\n]+$/.test(String(s));

/**
 * "Words: 12", or "Characters: 48" for a language written without spaces.
 *
 * @param {string} text
 * @param {boolean} unspaced
 * @param {{ words: string, chars: string }} labels with "{count}" in them
 */
export function sizeText(text, unspaced, labels) {
  const t = String(text ?? "");
  const n = unspaced
    ? t.replace(/\s+/g, "").length
    : t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return (unspaced ? labels.chars : labels.words).replace("{count}", String(n));
}

const SVG = "http://www.w3.org/2000/svg";

/** An SVG element with attributes. */
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** A small picture of a view: a pane with its card at the bottom, a dot in its corner, or a dock at its side. */
export function viewIcon(view) {
  const svg = svgEl("svg", { viewBox: "0 0 16 12", "aria-hidden": "true" });
  svg.append(
    svgEl("rect", {
      x: 0.5,
      y: 0.5,
      width: 15,
      height: 11,
      rx: 2,
      fill: "none",
      stroke: "currentColor",
    }),
  );
  if (view === "side")
    svg.append(svgEl("rect", { x: 10, y: 2, width: 4, height: 8, rx: 1, fill: "currentColor" }));
  else if (view === "corner")
    svg.append(svgEl("circle", { cx: 12, cy: 8, r: 2, fill: "currentColor" }));
  else svg.append(svgEl("rect", { x: 2, y: 6, width: 12, height: 4, rx: 1, fill: "currentColor" }));
  return svg;
}
