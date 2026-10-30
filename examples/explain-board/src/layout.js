/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Explain Board — where everything sits on the board
 *
 * The board is a canvas 1,000 units wide (it grows downwards as needed),
 * the same for the page that draws it and the agent that draws on it. The
 * content being explained (code or text) is laid out at fixed places: a
 * monospaced line every LINE_H units, its number in a gutter on the left.
 * So an agent can point at "line 12, column 8" and the page puts the arrow
 * there exactly, whatever the size of the window.
 *
 * Everything here is pure: the tile uses it to tell agents the geometry,
 * the page to draw, and the tests to check both.
 */

/** The canvas width, in board units. */
export const WIDTH = 1000;
/** The tallest a board may grow, in board units. */
export const MAX_HEIGHT = 6000;
/** The shortest board, so a few shapes have room. */
export const MIN_HEIGHT = 560;
/** Where the content's first line starts. */
export const CONTENT_TOP = 20;
/** One line of content: its height, and the width of one monospaced character. */
export const LINE_H = 22;
export const CHAR_W = 9.6;
/** Where the line numbers end and the content's text starts. */
export const GUTTER_X = 44;
export const TEXT_X = 56;
/** The widest the content column gets; longer lines are cut off there. */
export const CONTENT_MAX_W = 640;
/** Space kept round the drawings at the bottom of the board. */
const BOTTOM_PAD = 40;
/** Roughly how wide a character of the proportional label font is, per unit of font size. */
const LABEL_CHAR = 0.56;
/** The line height of notes and labels, per unit of font size. */
const LABEL_LEADING = 1.35;

/** Clamps `n` to [lo, hi]. */
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * The content's box and the numbers of its first and last lines.
 *
 * @param {{ from: number, lines: string[] } | null} content
 */
export function contentBox(content) {
  if (!content || content.lines.length === 0) {
    return { x: 0, y: CONTENT_TOP, w: 0, h: 0, from: 0, to: -1 };
  }
  const longest = content.lines.reduce((n, l) => Math.max(n, l.length), 0);
  const w = Math.min(CONTENT_MAX_W, TEXT_X + longest * CHAR_W + 16);
  return {
    x: 0,
    y: CONTENT_TOP,
    w: Math.round(w),
    h: content.lines.length * LINE_H,
    from: content.from,
    to: content.from + content.lines.length - 1,
  };
}

/**
 * The box of one content line, by its shown number, or null when there's
 * no such line. `cols` narrows it to columns a..b (1-based, inclusive).
 */
export function lineBox(content, line, cols) {
  if (!content) return null;
  const i = line - content.from;
  if (!Number.isInteger(i) || i < 0 || i >= content.lines.length) return null;
  const y = CONTENT_TOP + i * LINE_H;
  const text = content.lines[i];
  if (cols) {
    const [a, b] = cols;
    return { x: TEXT_X + (a - 1) * CHAR_W, y, w: (b - a + 1) * CHAR_W, h: LINE_H };
  }
  const w = Math.max(CHAR_W, Math.min(CONTENT_MAX_W - TEXT_X, text.length * CHAR_W));
  return { x: TEXT_X, y, w, h: LINE_H };
}

/**
 * Splits `text` into lines of at most `max` characters, at spaces where it
 * can, keeping the line breaks it has.
 */
export function wrapText(text, max) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      // A word longer than a whole line is cut into pieces.
      let w = word;
      while (w.length > max) {
        if (line) out.push(line);
        line = "";
        out.push(w.slice(0, max));
        w = w.slice(max);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= max) line += ` ${w}`;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

/** The lines a label of `size` wraps to in a box `w` units wide. */
export const labelLines = (text, w, size) =>
  wrapText(text, Math.max(4, Math.floor((w - 16) / (size * LABEL_CHAR))));

/** The height of `n` lines of a label of `size`. */
export const labelHeight = (n, size) => n * size * LABEL_LEADING;

/** The size notes are written in, and the room round their text. */
export const NOTE_SIZE = 15;
const NOTE_PAD = 10;

/** A note's height: its wrapped text plus room round it. */
export const noteHeight = (text, w) =>
  Math.ceil(labelHeight(labelLines(text, w, NOTE_SIZE).length, NOTE_SIZE) + NOTE_PAD * 2);

/**
 * The box a shape takes on the board, or null for one that points at
 * something missing. Arrows and lines get the box round their two ends.
 *
 * @param {object} shape  a checked shape (scene.js)
 * @param {(id: string) => object | undefined} find  another shape by id
 * @param {object | null} content
 */
export function shapeBox(shape, find, content) {
  switch (shape.kind) {
    case "box":
    case "ellipse":
    case "scene3d":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    case "note":
      return { x: shape.x, y: shape.y, w: shape.w, h: noteHeight(shape.text, shape.w) };
    case "text": {
      const w = shape.text.length * shape.size * LABEL_CHAR;
      const x =
        shape.align === "middle" ? shape.x - w / 2 : shape.align === "end" ? shape.x - w : shape.x;
      return { x, y: shape.y - shape.size, w, h: shape.size * LABEL_LEADING };
    }
    case "highlight": {
      const top = lineBox(content, shape.lines[0], shape.cols);
      const bottom = lineBox(content, shape.lines[1], shape.cols);
      if (!top || !bottom) return null;
      // A highlight of whole lines spans the content column.
      const w = shape.cols ? top.w : contentBox(content).w - TEXT_X + 4;
      return { x: top.x - 4, y: top.y, w, h: bottom.y + bottom.h - top.y };
    }
    case "arrow":
    case "line": {
      const ends = endsOf(shape, find, content);
      if (!ends) return null;
      const [a, b] = ends;
      return {
        x: Math.min(a[0], b[0]),
        y: Math.min(a[1], b[1]),
        w: Math.abs(a[0] - b[0]),
        h: Math.abs(a[1] - b[1]),
      };
    }
    case "path":
      return pathBox(shape.d);
    default:
      return null;
  }
}

/** The box round the numbers of an SVG path (a rough, but safe, bound). */
export function pathBox(d) {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  if (!xs.length || !ys.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The middle of a box. */
const centerOf = (b) => [b.x + b.w / 2, b.y + b.h / 2];

/** The point on side `side` of box `b`. */
function sidePoint(b, side) {
  const [cx, cy] = centerOf(b);
  if (side === "top") return [cx, b.y];
  if (side === "bottom") return [cx, b.y + b.h];
  if (side === "left") return [b.x, cy];
  if (side === "right") return [b.x + b.w, cy];
  return [cx, cy];
}

/** The side of box `b` that faces the point `p`. */
function sideFacing(b, p) {
  const [cx, cy] = centerOf(b);
  const dx = (p[0] - cx) / Math.max(1, b.w);
  const dy = (p[1] - cy) / Math.max(1, b.h);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

/**
 * Where a point an arrow names is, before choosing a side: its box for a
 * line or a shape, or the point itself.
 */
function targetOf(point, find, content) {
  if (Array.isArray(point)) return { at: point };
  if ("line" in point) {
    const b = lineBox(content, point.line, point.col ? [point.col, point.col] : undefined);
    if (!b) return null;
    // A whole line is pointed at just after its text (unless a side is named),
    // a column at the side of its character that faces the other end.
    if (point.col) return { at: centerOf(b), box: b, side: point.side };
    return { at: [b.x + b.w + 6, b.y + b.h / 2], box: b, side: point.side, lineEnd: true };
  }
  const other = find(point.shape);
  if (!other || other.kind === "arrow" || other.kind === "line") return null;
  const b = shapeBox(other, find, content);
  return b ? { at: centerOf(b), box: b, side: point.side } : null;
}

/** The point a target ends at: the side it names, else the side that faces `toward`. */
function endPoint(t, toward) {
  if (!t.box) return t.at;
  if (t.lineEnd && (!t.side || t.side === "right")) return t.at;
  if (t.side === "center") return centerOf(t.box);
  return sidePoint(t.box, t.side ?? sideFacing(t.box, toward));
}

/**
 * The two ends of an arrow or a line, in board units, or null when one of
 * them names a line or a shape that isn't there.
 */
export function endsOf(shape, find, content) {
  const a = targetOf(shape.from, find, content);
  const b = targetOf(shape.to, find, content);
  if (!a || !b) return null;
  return [endPoint(a, b.at), endPoint(b, a.at)];
}

/** How tall the board must be for its content and every shape. */
export function boardHeight(content, shapes, find) {
  const c = contentBox(content);
  let bottom = c.y + c.h;
  for (const s of shapes) {
    const b = shapeBox(s, find, content);
    if (b) bottom = Math.max(bottom, b.y + b.h);
  }
  return clamp(Math.ceil(bottom + BOTTOM_PAD), MIN_HEIGHT, MAX_HEIGHT);
}
