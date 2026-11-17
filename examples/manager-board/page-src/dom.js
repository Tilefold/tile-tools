/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Manager Board page — building the board's elements
 *
 * `h(tag, attrs, ...children)` makes an element; children are elements or
 * text, and text is always set as text, never as HTML, so nothing from the
 * timeline can become markup. Attributes starting with `on` are listeners.
 * `svg(tag, attrs, ...children)` does the same for the flow diagram's SVG.
 *
 * Modified 2026-11-16 (flow diagram): `svg`.
 *
 * Last updated by: Tilefold
 */

/** Makes an element. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = String(v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** The SVG namespace. */
const SVG_NS = "http://www.w3.org/2000/svg";

/** Makes an SVG element; text children are set as text. */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** The glyph for an event's kind (a turn shows who spoke). */
export function glyphOf(e) {
  if (e.kind === "turn") return e.who === "you" ? "❯" : e.who === "tilefold" ? "⌁" : "●";
  return { message: "✉", ask: "?", nudge: "↻", heartbeat: "♥", run: "⏱" }[e.kind] || "•";
}
