/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — checking what an agent draws
 *
 * Agents describe drawings as data, never code: a list of shapes of a few
 * kinds (box, ellipse, note, text, arrow, line, highlight, path and a small
 * 3D scene), in board units (layout.js), in colors named from a short
 * palette the page maps to the user's theme. Everything an agent sends is
 * checked here like any data from outside, and either comes back clean or
 * fails with an Error naming the field and what it should be, which goes
 * back to the agent as the reason, so it can fix the call and try again.
 *
 * Pure: no `tf`, no DOM.
 *
 * Modified 2026-10-31 (real 3D): scenes take cylinders, arrows, lathes
 *   (a profile spun round an axis), wings (an airfoil stretched along a
 *   span) and tubes (a curve with a thickness, flowing when asked), plus
 *   `rot` and `opacity` on any object; points are limited per object and
 *   per scene.
 */
import { MAX_HEIGHT, WIDTH } from "./layout.js";

/** The palette agents name colors from; the page maps each to the theme. */
export const COLORS = [
  "accent",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "gray",
];

/** The shapes an agent can draw. */
export const KINDS = [
  "box",
  "ellipse",
  "note",
  "text",
  "arrow",
  "line",
  "highlight",
  "path",
  "scene3d",
];

/** The objects a 3D scene can hold. */
export const KINDS_3D = [
  "box",
  "sphere",
  "line",
  "point",
  "label",
  "cylinder",
  "arrow",
  "lathe",
  "wing",
  "tube",
];

/** Axes a lathe spins round. */
const AXES = ["x", "y", "z"];

/** Limits that keep a board within what the page and the store can carry. */
export const LIMITS = {
  shapes: 300,
  shapesPerDraw: 100,
  steps: 50,
  lines: 1000,
  lineChars: 400,
  contentChars: 60000,
  title: 120,
  say: 600,
  label: 200,
  note: 600,
  text: 300,
  path: 2000,
  objects3d: 60,
  points3d: 64,
  pointsPerScene: 1500,
  question: 500,
};

/** A short, readable shape id: letters, digits, `_` or `-`. */
const ID = /^[A-Za-z0-9_-]{1,32}$/;
/** SVG path data: commands and numbers only, nothing that could load or run. */
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,eE\s-]+$/;

/** Fails with the field and what it should be. */
function fail(where, what) {
  throw new Error(`${where}: ${what}`);
}

/** A number from lo to hi. */
function num(v, where, lo, hi) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) {
    fail(where, `a number from ${lo} to ${hi}`);
  }
  return Math.round(v * 100) / 100;
}

/** An optional number from lo to hi, or `fallback`. */
const optNum = (v, where, lo, hi, fallback) => (v === undefined ? fallback : num(v, where, lo, hi));

/** A whole number from lo to hi. */
function int(v, where, lo, hi) {
  if (!Number.isInteger(v) || v < lo || v > hi) fail(where, `a whole number from ${lo} to ${hi}`);
  return v;
}

/** Text of 1 to max characters, trimmed at the ends. */
function text(v, where, max) {
  if (typeof v !== "string" || !v.trim()) fail(where, "some text");
  if (v.length > max) fail(where, `text of at most ${max} characters`);
  return v.trim();
}

/** Optional text, or undefined. */
const optText = (v, where, max) =>
  v === undefined || v === null ? undefined : text(v, where, max);

/** Optional true/false, or `fallback`. */
function flag(v, where, fallback = false) {
  if (v === undefined) return fallback;
  if (typeof v !== "boolean") fail(where, "true or false");
  return v;
}

/** One of `choices`, or `fallback` when left out. */
function oneOf(v, where, choices, fallback) {
  if (v === undefined) return fallback;
  if (!choices.includes(v)) fail(where, `one of ${choices.join(", ")}`);
  return v;
}

/** A color from the palette, "accent" when left out. */
const color = (v, where) => oneOf(v, `${where}.color`, COLORS, "accent");

/** The sides an arrow can leave or reach a box by. */
const SIDES = ["top", "bottom", "left", "right", "center"];

/**
 * Where an arrow or a line starts or ends: [x, y] on the board, a content
 * line { line, col?, side? }, or another shape { shape, side? }.
 */
function point(v, where) {
  if (Array.isArray(v)) {
    if (v.length !== 2) fail(where, "[x, y], { line, col? } or { shape }");
    return [num(v[0], `${where}[0]`, 0, WIDTH), num(v[1], `${where}[1]`, 0, MAX_HEIGHT)];
  }
  if (!v || typeof v !== "object") fail(where, "[x, y], { line, col? } or { shape }");
  const side = oneOf(v.side, `${where}.side`, SIDES, undefined);
  if ("line" in v) {
    const p = { line: int(v.line, `${where}.line`, 0, 1_000_000) };
    if (v.col !== undefined) p.col = int(v.col, `${where}.col`, 1, LIMITS.lineChars);
    if (side) p.side = side;
    return p;
  }
  if ("shape" in v) {
    if (typeof v.shape !== "string" || !ID.test(v.shape)) fail(`${where}.shape`, "a shape's id");
    return side ? { shape: v.shape, side } : { shape: v.shape };
  }
  return fail(where, "[x, y], { line, col? } or { shape }");
}

/** A point in a 3D scene: [x, y, z], each from -100 to 100. */
function point3(v, where) {
  if (!Array.isArray(v) || v.length !== 3) fail(where, "[x, y, z]");
  return v.map((n, i) => num(n, `${where}[${i}]`, -100, 100));
}

/** One object of a 3D scene. */
function object3d(o, where) {
  if (!o || typeof o !== "object") fail(where, 'an object such as { kind: "box", at: [0, 0, 0] }');
  const kind = oneOf(o.kind, `${where}.kind`, KINDS_3D, undefined);
  if (!kind) fail(`${where}.kind`, `one of ${KINDS_3D.join(", ")}`);
  // A tube is placed by its points: its `at` is the first one unless given.
  const at = kind === "tube" && o.at === undefined && Array.isArray(o.points) ? o.points[0] : o.at;
  const out = { kind, at: point3(at, `${where}.at`), color: color(o.color, where) };
  const label = optText(o.label ?? (kind === "label" ? o.text : undefined), `${where}.label`, 80);
  if (kind === "label" && !label) fail(`${where}.text`, "the label's text");
  if (label) out.label = label;
  if (kind === "box") {
    const size = o.size ?? [10, 10, 10];
    if (!Array.isArray(size) || size.length !== 3) fail(`${where}.size`, "[width, height, depth]");
    out.size = size.map((n, i) => num(n, `${where}.size[${i}]`, 0.1, 200));
  }
  if (kind === "sphere") out.r = optNum(o.r, `${where}.r`, 0.1, 100, 5);
  if (kind === "line") out.to = point3(o.to, `${where}.to`);
  if (kind === "cylinder" || kind === "arrow") {
    out.to = point3(o.to, `${where}.to`);
    out.r = optNum(o.r, `${where}.r`, 0.1, 50, kind === "arrow" ? 1.2 : 3);
    if (kind === "cylinder") out.r2 = optNum(o.r2, `${where}.r2`, 0, 50, out.r);
  }
  if (kind === "lathe") {
    out.profile = list(o.profile, `${where}.profile`, 2, (p, w) => {
      if (!Array.isArray(p) || p.length !== 2) fail(w, "[radius, height]");
      return [num(p[0], `${w}[0]`, 0, 100), num(p[1], `${w}[1]`, -100, 100)];
    });
    out.axis = oneOf(o.axis, `${where}.axis`, AXES, "y");
  }
  if (kind === "wing") {
    out.span = num(o.span, `${where}.span`, 1, 200);
    out.chord = num(o.chord, `${where}.chord`, 1, 100);
    out.thickness = optNum(o.thickness, `${where}.thickness`, 0.02, 0.4, 0.12);
    out.camber = optNum(o.camber, `${where}.camber`, 0, 0.1, 0.03);
    out.taper = optNum(o.taper, `${where}.taper`, 0.1, 1, 1);
    out.sweep = optNum(o.sweep, `${where}.sweep`, -60, 60, 0);
    out.dihedral = optNum(o.dihedral, `${where}.dihedral`, -30, 30, 0);
    out.mirror = flag(o.mirror, `${where}.mirror`, true);
    out.vertical = flag(o.vertical, `${where}.vertical`, false);
  }
  if (kind === "tube") {
    out.points = list(o.points, `${where}.points`, 2, point3);
    out.r = optNum(o.r, `${where}.r`, 0.1, 20, 0.8);
    out.flow = flag(o.flow, `${where}.flow`, false);
  }
  if (o.rot !== undefined) {
    if (!Array.isArray(o.rot) || o.rot.length !== 3) fail(`${where}.rot`, "[x, y, z] in degrees");
    out.rot = o.rot.map((n, i) => num(n, `${where}.rot[${i}]`, -360, 360));
  }
  if (o.opacity !== undefined) out.opacity = num(o.opacity, `${where}.opacity`, 0.1, 1);
  return out;
}

/** A list of 2 to LIMITS.points3d items, each checked by `each`. */
function list(v, where, min, each) {
  if (!Array.isArray(v) || v.length < min || v.length > LIMITS.points3d) {
    fail(where, `a list of ${min} to ${LIMITS.points3d} points`);
  }
  return v.map((p, i) => each(p, `${where}[${i}]`));
}

/** How many points a scene's objects hold (lathe profiles and tubes). */
const pointsIn = (objects) =>
  objects.reduce((n, o) => n + (o.profile?.length ?? 0) + (o.points?.length ?? 0), 0);

/** The fields every shape may have. */
function common(s, where) {
  const out = { kind: s.kind };
  if (s.id !== undefined) {
    if (typeof s.id !== "string" || !ID.test(s.id)) {
      fail(`${where}.id`, "1 to 32 letters, digits, _ or -");
    }
    out.id = s.id;
  }
  out.color = color(s.color, where);
  return out;
}

/** A box's place and size: x, y, w, h on the board. */
function rect(s, where, out) {
  out.x = num(s.x, `${where}.x`, 0, WIDTH);
  out.y = num(s.y, `${where}.y`, 0, MAX_HEIGHT);
  out.w = num(s.w, `${where}.w`, 4, WIDTH);
  out.h = num(s.h, `${where}.h`, 4, MAX_HEIGHT);
}

/**
 * One shape an agent drew, checked and with its defaults filled in.
 *
 * @param {unknown} s
 * @param {string} where  how to name it in an error, such as "shapes[2]"
 */
export function checkShape(s, where = "shape") {
  if (!s || typeof s !== "object" || Array.isArray(s)) {
    fail(where, 'an object such as { kind: "box", x, y, w, h }');
  }
  if (!KINDS.includes(s.kind)) fail(`${where}.kind`, `one of ${KINDS.join(", ")}`);
  const out = common(s, where);
  switch (s.kind) {
    case "box":
    case "ellipse": {
      rect(s, where, out);
      const label = optText(s.label, `${where}.label`, LIMITS.label);
      if (label) out.label = label;
      out.fill = flag(s.fill, `${where}.fill`, true);
      break;
    }
    case "note":
      out.x = num(s.x, `${where}.x`, 0, WIDTH);
      out.y = num(s.y, `${where}.y`, 0, MAX_HEIGHT);
      out.w = optNum(s.w, `${where}.w`, 80, WIDTH, 260);
      out.text = text(s.text, `${where}.text`, LIMITS.note);
      break;
    case "text":
      out.x = num(s.x, `${where}.x`, 0, WIDTH);
      out.y = num(s.y, `${where}.y`, 0, MAX_HEIGHT);
      out.text = text(s.text, `${where}.text`, LIMITS.text);
      out.size = optNum(s.size, `${where}.size`, 10, 48, 16);
      out.align = oneOf(s.align, `${where}.align`, ["start", "middle", "end"], "start");
      break;
    case "arrow":
    case "line": {
      out.from = point(s.from, `${where}.from`);
      out.to = point(s.to, `${where}.to`);
      const label = optText(s.label, `${where}.label`, LIMITS.label);
      if (label) out.label = label;
      out.dashed = flag(s.dashed, `${where}.dashed`);
      out.curve = optNum(s.curve, `${where}.curve`, -1, 1, 0);
      if (s.kind === "line") out.both = false;
      else out.both = flag(s.both, `${where}.both`);
      break;
    }
    case "highlight": {
      let lines;
      if (s.lines !== undefined) {
        if (!Array.isArray(s.lines) || s.lines.length !== 2)
          fail(`${where}.lines`, "[first, last]");
        lines = s.lines.map((n, i) => int(n, `${where}.lines[${i}]`, 0, 1_000_000));
        if (lines[1] < lines[0]) fail(`${where}.lines`, "[first, last] with first ≤ last");
      } else {
        const n = int(s.line, `${where}.line`, 0, 1_000_000);
        lines = [n, n];
      }
      out.lines = lines;
      if (s.cols !== undefined) {
        if (!Array.isArray(s.cols) || s.cols.length !== 2) fail(`${where}.cols`, "[first, last]");
        out.cols = s.cols.map((n, i) => int(n, `${where}.cols[${i}]`, 1, LIMITS.lineChars));
        if (out.cols[1] < out.cols[0]) fail(`${where}.cols`, "[first, last] with first ≤ last");
      }
      const label = optText(s.label, `${where}.label`, LIMITS.label);
      if (label) out.label = label;
      break;
    }
    case "path":
      if (typeof s.d !== "string" || !s.d.trim() || s.d.length > LIMITS.path || !PATH.test(s.d)) {
        fail(
          `${where}.d`,
          `SVG path data (M, L, C, Q, A, Z… and numbers), at most ${LIMITS.path} characters`,
        );
      }
      out.d = s.d.trim();
      out.fill = flag(s.fill, `${where}.fill`);
      out.dashed = flag(s.dashed, `${where}.dashed`);
      break;
    case "scene3d": {
      rect(s, where, out);
      if (!Array.isArray(s.objects) || s.objects.length === 0) {
        fail(`${where}.objects`, "a list of 3D objects");
      }
      if (s.objects.length > LIMITS.objects3d) {
        fail(`${where}.objects`, `at most ${LIMITS.objects3d} objects`);
      }
      out.objects = s.objects.map((o, i) => object3d(o, `${where}.objects[${i}]`));
      if (pointsIn(out.objects) > LIMITS.pointsPerScene) {
        fail(`${where}.objects`, `at most ${LIMITS.pointsPerScene} points in all`);
      }
      const cam = s.camera ?? {};
      if (typeof cam !== "object" || Array.isArray(cam))
        fail(`${where}.camera`, "{ yaw?, pitch? }");
      out.camera = {
        yaw: optNum(cam.yaw, `${where}.camera.yaw`, -360, 360, 35),
        pitch: optNum(cam.pitch, `${where}.camera.pitch`, -89, 89, 25),
      };
      const label = optText(s.label, `${where}.label`, LIMITS.label);
      if (label) out.label = label;
      break;
    }
  }
  return out;
}

/**
 * The content an agent shows to explain: code or text, cut into lines,
 * numbered from `from` (1 unless the content starts further into a file).
 */
export function checkContent(input) {
  if (!input || typeof input !== "object") fail("input", "{ text, kind?, title?, from? }");
  if (typeof input.text !== "string") fail("text", "the code or text to explain");
  if (input.text.length > LIMITS.contentChars) {
    fail("text", `at most ${LIMITS.contentChars} characters`);
  }
  const lines = input.text.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n");
  // A last line break doesn't make an empty line of its own.
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  if (lines.length > LIMITS.lines) fail("text", `at most ${LIMITS.lines} lines`);
  return {
    kind: oneOf(input.kind, "kind", ["code", "text"], "code"),
    language: optText(input.language, "language", 32),
    from: input.from === undefined ? 1 : int(input.from, "from", 0, 1_000_000),
    lines: lines.map((l) => l.slice(0, LIMITS.lineChars)),
  };
}

export const checkTitle = (v) => optText(v, "title", LIMITS.title);
export const checkSay = (v) => optText(v, "say", LIMITS.say);
