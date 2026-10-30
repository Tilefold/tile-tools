/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Explain Board — a board your AI agent draws on to explain things
 *
 * Ask the AI agent in one of your panes to explain something (a file, a
 * function, an error, an idea) and it shows it on a board docked beside
 * your panes, then draws over it as it explains: boxes and arrows pointing
 * at exact lines, notes, highlights, small diagrams and 3D scenes you turn
 * by dragging, one step at a time. Step back and on through the
 * explanation, point at a line or a drawing, and ask about it; the agent
 * hears your question when it next reads the board.
 *
 * The agent draws through the tile's commands (Tilefold's tile_run), as
 * data the tile checks, never code. Needs Tilefold 0.1.14 for agents'
 * commands with data, 0.1.20 to dock the board beside the panes.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/layout.js
var WIDTH = 1e3;
var MAX_HEIGHT = 6e3;
var MIN_HEIGHT = 560;
var CONTENT_TOP = 20;
var LINE_H = 22;
var CHAR_W = 9.6;
var TEXT_X = 56;
var CONTENT_MAX_W = 640;
var BOTTOM_PAD = 40;
var LABEL_CHAR = 0.56;
var LABEL_LEADING = 1.35;
var clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
function contentBox(content) {
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
    to: content.from + content.lines.length - 1
  };
}
function lineBox(content, line, cols) {
  if (!content) return null;
  const i = line - content.from;
  if (!Number.isInteger(i) || i < 0 || i >= content.lines.length) return null;
  const y = CONTENT_TOP + i * LINE_H;
  const text2 = content.lines[i];
  if (cols) {
    const [a, b] = cols;
    return { x: TEXT_X + (a - 1) * CHAR_W, y, w: (b - a + 1) * CHAR_W, h: LINE_H };
  }
  const w = Math.max(CHAR_W, Math.min(CONTENT_MAX_W - TEXT_X, text2.length * CHAR_W));
  return { x: TEXT_X, y, w, h: LINE_H };
}
function wrapText(text2, max) {
  const out = [];
  for (const para of String(text2).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
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
var labelLines = (text2, w, size) => wrapText(text2, Math.max(4, Math.floor((w - 16) / (size * LABEL_CHAR))));
var labelHeight = (n, size) => n * size * LABEL_LEADING;
var NOTE_SIZE = 15;
var NOTE_PAD = 10;
var noteHeight = (text2, w) => Math.ceil(labelHeight(labelLines(text2, w, NOTE_SIZE).length, NOTE_SIZE) + NOTE_PAD * 2);
function shapeBox(shape, find, content) {
  switch (shape.kind) {
    case "box":
    case "ellipse":
    case "scene3d":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    case "note":
      return { x: shape.x, y: shape.y, w: shape.w, h: noteHeight(shape.text, shape.w) };
    case "text": {
      const w = shape.text.length * shape.size * LABEL_CHAR;
      const x = shape.align === "middle" ? shape.x - w / 2 : shape.align === "end" ? shape.x - w : shape.x;
      return { x, y: shape.y - shape.size, w, h: shape.size * LABEL_LEADING };
    }
    case "highlight": {
      const top = lineBox(content, shape.lines[0], shape.cols);
      const bottom = lineBox(content, shape.lines[1], shape.cols);
      if (!top || !bottom) return null;
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
        h: Math.abs(a[1] - b[1])
      };
    }
    case "path":
      return pathBox(shape.d);
    default:
      return null;
  }
}
function pathBox(d) {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  if (!xs.length || !ys.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
var centerOf = (b) => [b.x + b.w / 2, b.y + b.h / 2];
function sidePoint(b, side) {
  const [cx, cy] = centerOf(b);
  if (side === "top") return [cx, b.y];
  if (side === "bottom") return [cx, b.y + b.h];
  if (side === "left") return [b.x, cy];
  if (side === "right") return [b.x + b.w, cy];
  return [cx, cy];
}
function sideFacing(b, p) {
  const [cx, cy] = centerOf(b);
  const dx = (p[0] - cx) / Math.max(1, b.w);
  const dy = (p[1] - cy) / Math.max(1, b.h);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}
function targetOf(point2, find, content) {
  if (Array.isArray(point2)) return { at: point2 };
  if ("line" in point2) {
    const b2 = lineBox(content, point2.line, point2.col ? [point2.col, point2.col] : void 0);
    if (!b2) return null;
    if (point2.col) return { at: centerOf(b2), box: b2, side: point2.side };
    return { at: [b2.x + b2.w + 6, b2.y + b2.h / 2], box: b2, side: point2.side, lineEnd: true };
  }
  const other = find(point2.shape);
  if (!other || other.kind === "arrow" || other.kind === "line") return null;
  const b = shapeBox(other, find, content);
  return b ? { at: centerOf(b), box: b, side: point2.side } : null;
}
function endPoint(t, toward) {
  if (!t.box) return t.at;
  if (t.lineEnd && (!t.side || t.side === "right")) return t.at;
  if (t.side === "center") return centerOf(t.box);
  return sidePoint(t.box, t.side ?? sideFacing(t.box, toward));
}
function endsOf(shape, find, content) {
  const a = targetOf(shape.from, find, content);
  const b = targetOf(shape.to, find, content);
  if (!a || !b) return null;
  return [endPoint(a, b.at), endPoint(b, a.at)];
}
function boardHeight(content, shapes, find) {
  const c = contentBox(content);
  let bottom = c.y + c.h;
  for (const s of shapes) {
    const b = shapeBox(s, find, content);
    if (b) bottom = Math.max(bottom, b.y + b.h);
  }
  return clamp(Math.ceil(bottom + BOTTOM_PAD), MIN_HEIGHT, MAX_HEIGHT);
}

// src/scene.js
var COLORS = [
  "accent",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "gray"
];
var KINDS = [
  "box",
  "ellipse",
  "note",
  "text",
  "arrow",
  "line",
  "highlight",
  "path",
  "scene3d"
];
var KINDS_3D = ["box", "sphere", "line", "point", "label"];
var LIMITS = {
  shapes: 300,
  shapesPerDraw: 100,
  steps: 50,
  lines: 1e3,
  lineChars: 400,
  contentChars: 6e4,
  title: 120,
  say: 600,
  label: 200,
  note: 600,
  text: 300,
  path: 2e3,
  objects3d: 60,
  question: 500
};
var ID = /^[A-Za-z0-9_-]{1,32}$/;
var PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,eE\s-]+$/;
function fail(where, what) {
  throw new Error(`${where}: ${what}`);
}
function num(v, where, lo, hi) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) {
    fail(where, `a number from ${lo} to ${hi}`);
  }
  return Math.round(v * 100) / 100;
}
var optNum = (v, where, lo, hi, fallback) => v === void 0 ? fallback : num(v, where, lo, hi);
function int(v, where, lo, hi) {
  if (!Number.isInteger(v) || v < lo || v > hi) fail(where, `a whole number from ${lo} to ${hi}`);
  return v;
}
function text(v, where, max) {
  if (typeof v !== "string" || !v.trim()) fail(where, "some text");
  if (v.length > max) fail(where, `text of at most ${max} characters`);
  return v.trim();
}
var optText = (v, where, max) => v === void 0 || v === null ? void 0 : text(v, where, max);
function flag(v, where, fallback = false) {
  if (v === void 0) return fallback;
  if (typeof v !== "boolean") fail(where, "true or false");
  return v;
}
function oneOf(v, where, choices, fallback) {
  if (v === void 0) return fallback;
  if (!choices.includes(v)) fail(where, `one of ${choices.join(", ")}`);
  return v;
}
var color = (v, where) => oneOf(v, `${where}.color`, COLORS, "accent");
var SIDES = ["top", "bottom", "left", "right", "center"];
function point(v, where) {
  if (Array.isArray(v)) {
    if (v.length !== 2) fail(where, "[x, y], { line, col? } or { shape }");
    return [num(v[0], `${where}[0]`, 0, WIDTH), num(v[1], `${where}[1]`, 0, MAX_HEIGHT)];
  }
  if (!v || typeof v !== "object") fail(where, "[x, y], { line, col? } or { shape }");
  const side = oneOf(v.side, `${where}.side`, SIDES, void 0);
  if ("line" in v) {
    const p = { line: int(v.line, `${where}.line`, 0, 1e6) };
    if (v.col !== void 0) p.col = int(v.col, `${where}.col`, 1, LIMITS.lineChars);
    if (side) p.side = side;
    return p;
  }
  if ("shape" in v) {
    if (typeof v.shape !== "string" || !ID.test(v.shape)) fail(`${where}.shape`, "a shape's id");
    return side ? { shape: v.shape, side } : { shape: v.shape };
  }
  return fail(where, "[x, y], { line, col? } or { shape }");
}
function point3(v, where) {
  if (!Array.isArray(v) || v.length !== 3) fail(where, "[x, y, z]");
  return v.map((n, i) => num(n, `${where}[${i}]`, -100, 100));
}
function object3d(o, where) {
  if (!o || typeof o !== "object") fail(where, 'an object such as { kind: "box", at: [0, 0, 0] }');
  const kind = oneOf(o.kind, `${where}.kind`, KINDS_3D, void 0);
  if (!kind) fail(`${where}.kind`, `one of ${KINDS_3D.join(", ")}`);
  const out = { kind, at: point3(o.at, `${where}.at`), color: color(o.color, where) };
  const label = optText(o.label ?? (kind === "label" ? o.text : void 0), `${where}.label`, 80);
  if (kind === "label" && !label) fail(`${where}.text`, "the label's text");
  if (label) out.label = label;
  if (kind === "box") {
    const size = o.size ?? [10, 10, 10];
    if (!Array.isArray(size) || size.length !== 3) fail(`${where}.size`, "[width, height, depth]");
    out.size = size.map((n, i) => num(n, `${where}.size[${i}]`, 0.1, 200));
  }
  if (kind === "sphere") out.r = optNum(o.r, `${where}.r`, 0.1, 100, 5);
  if (kind === "line") out.to = point3(o.to, `${where}.to`);
  return out;
}
function common(s, where) {
  const out = { kind: s.kind };
  if (s.id !== void 0) {
    if (typeof s.id !== "string" || !ID.test(s.id)) {
      fail(`${where}.id`, "1 to 32 letters, digits, _ or -");
    }
    out.id = s.id;
  }
  out.color = color(s.color, where);
  return out;
}
function rect(s, where, out) {
  out.x = num(s.x, `${where}.x`, 0, WIDTH);
  out.y = num(s.y, `${where}.y`, 0, MAX_HEIGHT);
  out.w = num(s.w, `${where}.w`, 4, WIDTH);
  out.h = num(s.h, `${where}.h`, 4, MAX_HEIGHT);
}
function checkShape(s, where = "shape") {
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
      if (s.lines !== void 0) {
        if (!Array.isArray(s.lines) || s.lines.length !== 2)
          fail(`${where}.lines`, "[first, last]");
        lines = s.lines.map((n, i) => int(n, `${where}.lines[${i}]`, 0, 1e6));
        if (lines[1] < lines[0]) fail(`${where}.lines`, "[first, last] with first \u2264 last");
      } else {
        const n = int(s.line, `${where}.line`, 0, 1e6);
        lines = [n, n];
      }
      out.lines = lines;
      if (s.cols !== void 0) {
        if (!Array.isArray(s.cols) || s.cols.length !== 2) fail(`${where}.cols`, "[first, last]");
        out.cols = s.cols.map((n, i) => int(n, `${where}.cols[${i}]`, 1, LIMITS.lineChars));
        if (out.cols[1] < out.cols[0]) fail(`${where}.cols`, "[first, last] with first \u2264 last");
      }
      const label = optText(s.label, `${where}.label`, LIMITS.label);
      if (label) out.label = label;
      break;
    }
    case "path":
      if (typeof s.d !== "string" || !s.d.trim() || s.d.length > LIMITS.path || !PATH.test(s.d)) {
        fail(
          `${where}.d`,
          `SVG path data (M, L, C, Q, A, Z\u2026 and numbers), at most ${LIMITS.path} characters`
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
      const cam = s.camera ?? {};
      if (typeof cam !== "object" || Array.isArray(cam))
        fail(`${where}.camera`, "{ yaw?, pitch? }");
      out.camera = {
        yaw: optNum(cam.yaw, `${where}.camera.yaw`, -360, 360, 35),
        pitch: optNum(cam.pitch, `${where}.camera.pitch`, -89, 89, 25)
      };
      const label = optText(s.label, `${where}.label`, LIMITS.label);
      if (label) out.label = label;
      break;
    }
  }
  return out;
}
function checkContent(input) {
  if (!input || typeof input !== "object") fail("input", "{ text, kind?, title?, from? }");
  if (typeof input.text !== "string") fail("text", "the code or text to explain");
  if (input.text.length > LIMITS.contentChars) {
    fail("text", `at most ${LIMITS.contentChars} characters`);
  }
  const lines = input.text.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n");
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  if (lines.length > LIMITS.lines) fail("text", `at most ${LIMITS.lines} lines`);
  return {
    kind: oneOf(input.kind, "kind", ["code", "text"], "code"),
    language: optText(input.language, "language", 32),
    from: input.from === void 0 ? 1 : int(input.from, "from", 0, 1e6),
    lines: lines.map((l) => l.slice(0, LIMITS.lineChars))
  };
}
var checkTitle = (v) => optText(v, "title", LIMITS.title);
var checkSay = (v) => optText(v, "say", LIMITS.say);

// src/board.js
var MAX_BOARD_BYTES = 200 * 1024;
var emptyBoard = () => ({
  title: null,
  content: null,
  steps: [{ say: null }],
  step: 0,
  shapes: [],
  nextId: 1,
  asked: null,
  revision: 0
});
function isBoard(b) {
  return !!b && typeof b === "object" && Array.isArray(b.steps) && b.steps.length > 0 && Array.isArray(b.shapes) && Number.isInteger(b.step) && Number.isInteger(b.nextId);
}
var finder = (board) => {
  const byId = new Map(board.shapes.map((s) => [s.id, s]));
  return (id) => byId.get(id);
};
function done(board) {
  const next = { ...board, revision: board.revision + 1 };
  const bytes = new TextEncoder().encode(JSON.stringify(next)).length;
  if (bytes > MAX_BOARD_BYTES) {
    throw new Error(
      "The board is full: erase some shapes, or show the content again to start over."
    );
  }
  return next;
}
function show(board, input) {
  const content = checkContent(input);
  const title = checkTitle(input.title);
  const say = checkSay(input.say);
  if (input.append === true && board.content) {
    const lines = [...board.content.lines, ...content.lines];
    if (lines.length > LIMITS.lines) throw new Error(`text: at most ${LIMITS.lines} lines in all`);
    return done({
      ...board,
      title: title ?? board.title,
      content: { ...board.content, lines }
    });
  }
  return done({
    ...emptyBoard(),
    title: title ?? null,
    content,
    steps: [{ say: say ?? null }],
    nextId: board.nextId,
    asked: board.asked,
    revision: board.revision
  });
}
function checkTargets(shape, where, board, find) {
  const ends = [];
  if (shape.kind === "arrow" || shape.kind === "line")
    ends.push(["from", shape.from], ["to", shape.to]);
  for (const [end, p] of ends) {
    if (Array.isArray(p)) continue;
    if ("line" in p && !lineBox(board.content, p.line)) {
      throw new Error(
        `${where}.${end}.line: there's no line ${p.line} on the board${linesHint(board)}`
      );
    }
    if ("shape" in p) {
      const other = find(p.shape);
      if (!other)
        throw new Error(`${where}.${end}.shape: there's no shape "${p.shape}" on the board`);
      if (other.kind === "arrow" || other.kind === "line") {
        throw new Error(`${where}.${end}.shape: an arrow can't point at another arrow or line`);
      }
    }
  }
  if (shape.kind === "highlight") {
    for (const n of shape.lines) {
      if (!lineBox(board.content, n)) {
        throw new Error(`${where}.lines: there's no line ${n} on the board${linesHint(board)}`);
      }
    }
  }
}
function linesHint(board) {
  const c = contentBox(board.content);
  return c.to >= c.from ? ` (lines ${c.from} to ${c.to})` : " (show some content first)";
}
function draw(board, input) {
  if (!input || typeof input !== "object") throw new Error("input: { shapes: [...], say? }");
  const list = input.shapes ?? [];
  if (!Array.isArray(list)) throw new Error("shapes: a list of shapes");
  if (list.length > LIMITS.shapesPerDraw) {
    throw new Error(
      `shapes: at most ${LIMITS.shapesPerDraw} in one Draw; draw the rest in another`
    );
  }
  const say = checkSay(input.say);
  if (!list.length && !say) throw new Error("shapes: at least one shape, or a step to say");
  const checked = list.map((s, i) => checkShape(s, `shapes[${i}]`));
  let next = input.clear === true ? erase(board, { all: true }) : board;
  let steps = next.steps;
  let step = steps.length - 1;
  if (say) {
    if (steps.length >= LIMITS.steps + 1) throw new Error(`say: at most ${LIMITS.steps} steps`);
    steps = [...steps, { say }];
    step = steps.length - 1;
  }
  let nextId = next.nextId;
  const shapes = [...next.shapes];
  const ids = [];
  for (const s of checked) {
    const id = s.id ?? `s${nextId++}`;
    const at = shapes.findIndex((o) => o.id === id);
    const shape = { ...s, id, step: at >= 0 ? shapes[at].step : step };
    if (at >= 0) shapes[at] = shape;
    else shapes.push(shape);
    ids.push(id);
  }
  if (shapes.length > LIMITS.shapes) {
    throw new Error(`shapes: at most ${LIMITS.shapes} on the board; erase some first`);
  }
  const candidate = { ...next, steps, shapes, nextId, step: say ? step : next.step };
  const find = finder(candidate);
  checked.forEach((s, i) => checkTargets({ ...s, id: ids[i] }, `shapes[${i}]`, candidate, find));
  return { board: done(candidate), ids };
}
function erase(board, input) {
  if (!input || typeof input !== "object")
    throw new Error("input: { ids } , { step } or { all: true }");
  if (input.all === true) {
    return done({ ...board, shapes: [], steps: [board.steps[0]], step: 0 });
  }
  let gone;
  if (Array.isArray(input.ids)) {
    gone = new Set(input.ids.filter((id) => typeof id === "string"));
  } else if (Number.isInteger(input.step)) {
    gone = new Set(board.shapes.filter((s) => s.step === input.step).map((s) => s.id));
  } else {
    throw new Error("input: { ids: [...] }, { step } or { all: true }");
  }
  const pointsAtGone = (p) => p && !Array.isArray(p) && "shape" in p && gone.has(p.shape);
  const shapes = board.shapes.filter(
    (s) => !gone.has(s.id) && !pointsAtGone(s.from) && !pointsAtGone(s.to)
  );
  return done({ ...board, shapes });
}
function goTo(board, n) {
  const step = Math.max(0, Math.min(board.steps.length - 1, Math.trunc(Number(n) || 0)));
  return step === board.step ? board : done({ ...board, step });
}
function ask(board, input) {
  const asked = { n: (board.asked?.n ?? 0) + 1 };
  if (Number.isInteger(input?.line) && lineBox(board.content, input.line)) asked.line = input.line;
  if (typeof input?.shape === "string" && finder(board)(input.shape)) asked.shape = input.shape;
  if (typeof input?.question === "string" && input.question.trim()) {
    asked.question = input.question.trim().slice(0, LIMITS.question);
  }
  if (!("line" in asked) && !("shape" in asked) && !("question" in asked)) return board;
  return done({ ...board, asked });
}
var HOW = [
  "The board is 1000 units wide; y grows downwards. Content lines are laid out at fixed places (see content).",
  "Draw with { shapes: [...], say? }: say makes a new step the user steps through; ids let you replace a shape later.",
  "Kinds: box/ellipse {x,y,w,h,label?}, note {x,y,w?,text}, text {x,y,text,size?}, arrow/line {from,to,label?,curve?}, highlight {lines:[a,b] or line, cols?, label?}, path {d}, scene3d {x,y,w,h,objects:[{kind:box|sphere|line|point|label, at:[x,y,z], ...}]}.",
  "Points: [x,y], { line, col? } (a content line by its number) or { shape: id, side? }. Colors: accent, red, orange, yellow, green, teal, blue, purple, gray.",
  "Keep drawings right of the content column (x \u2265 content.box.w + 20) so they don't cover it, or below it."
];
function describe(board, { lines = false, maxChars = 2e4 } = {}) {
  const find = finder(board);
  const c = contentBox(board.content);
  const content = board.content ? {
    kind: board.content.kind,
    language: board.content.language ?? null,
    from: c.from,
    to: c.to,
    box: { x: c.x, y: c.y, w: c.w, h: c.h },
    lineTop: `y of line n = ${CONTENT_TOP} + (n - from) * ${LINE_H}; each line is ${LINE_H} high`,
    columnX: `x of column k = ${TEXT_X} + (k - 1) * ${CHAR_W}`
  } : null;
  if (content && lines) {
    let used = 0;
    const out = [];
    for (const l of board.content.lines) {
      if (used + l.length > maxChars) break;
      used += l.length + 1;
      out.push(l);
    }
    content.lines = out;
    if (out.length < board.content.lines.length) content.cut = true;
  }
  return {
    title: board.title,
    canvas: { width: WIDTH, height: boardHeight(board.content, board.shapes, find) },
    content,
    steps: board.steps.map((s, n) => ({
      n,
      say: s.say,
      shapes: board.shapes.filter((x) => x.step === n).length
    })),
    step: board.step,
    shapes: board.shapes.map((s) => {
      const box = shapeBox(s, find, board.content);
      const out = { ...s, box: box && roundBox(box) };
      if (s.kind === "arrow" || s.kind === "line") out.ends = endsOf(s, find, board.content);
      return out;
    }),
    asked: board.asked,
    how: HOW
  };
}
var roundBox = (b) => ({
  x: Math.round(b.x),
  y: Math.round(b.y),
  w: Math.round(b.w),
  h: Math.round(b.h)
});

// src/strings.js
var PAGE_KEYS = [
  "page-lang",
  "page-dir",
  "page-title",
  "page-close",
  "step-back",
  "step-next",
  "step-count",
  "step-start",
  "zoom-fit",
  "zoom-actual",
  "empty-title",
  "empty-hint",
  "ask-placeholder",
  "ask-send",
  "ask-hint",
  "ask-sent",
  "ask-line",
  "ask-shape",
  "ask-clear",
  "board-label",
  "scene-hint"
];
var MARKS = { n: "{n}", total: "{total}" };
var pageLabels = (tf) => Object.fromEntries(PAGE_KEYS.map((key) => [key, tf.t(key, MARKS)]));

// src/run.js
var BOARD = "board";
var WAIT_MS = 7e3;
function runExplainBoard(tf) {
  const warn = (err) => void Promise.resolve().then(() => tf.log.warn(String(err && err.message ? err.message : err))).catch(() => {
  });
  const audit = (action) => void Promise.resolve().then(() => tf.audit(action)).catch(warn);
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch(warn);
  let board = null;
  let where = null;
  let seen = 0;
  let waiters = [];
  const canSide = () => !!tf.page && typeof tf.theme === "function";
  async function current() {
    if (board) return board;
    const kept = await tf.store.get(BOARD);
    board = isBoard(kept) ? kept : emptyBoard();
    seen = board.asked?.n ?? 0;
    return board;
  }
  async function set(next) {
    if (next === board) return;
    board = next;
    await tf.store.set(BOARD, board);
    if (where) await tf.page.post({ do: "board", board }).catch(() => {
    });
  }
  async function open() {
    if (!tf.page) {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return false;
    }
    if (where) return true;
    const side = canSide();
    await tf.page.open(side ? { side: true } : {});
    where = side ? "side" : "window";
    audit("opened");
    return true;
  }
  async function close() {
    if (!tf.page || !where) return;
    where = null;
    await tf.page.close();
    audit("closed");
  }
  async function hello() {
    await tf.page.post({ do: "setup", labels: pageLabels(tf), board: await current() });
  }
  async function asked(m) {
    const before = (await current()).asked?.n ?? 0;
    await set(ask(board, m));
    if ((board.asked?.n ?? 0) === before) return;
    audit("asked");
    const ws = waiters;
    waiters = [];
    for (const w of ws) w();
  }
  async function hear(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") return hello();
    if (m.type === "step") return set(goTo(await current(), m.n));
    if (m.type === "ask") return asked(m);
    if (m.type === "close") return close();
  }
  async function change(action, apply) {
    if (!await open())
      throw new Error("This Tilefold can't show the Explain Board (it needs 0.1.7 or later).");
    const result = apply(await current());
    await set(result.board ?? result);
    audit(action);
    return result;
  }
  function newAsk(ms) {
    if ((board.asked?.n ?? 0) > seen) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(done2, ms);
      function done2() {
        clearTimeout(timer);
        waiters = waiters.filter((w) => w !== done2);
        resolve();
      }
      waiters.push(done2);
    });
  }
  function nextFor(b, fresh) {
    if (!b.content) return "Show what to explain first: run Show content with { text }.";
    if (fresh && b.asked) {
      const about = [
        b.asked.line !== void 0 ? `line ${b.asked.line}` : null,
        b.asked.shape ? `the shape "${b.asked.shape}"` : null
      ].filter(Boolean);
      const q = b.asked.question ? `"${b.asked.question}"` : "what it is";
      return `The user asks ${q}${about.length ? ` about ${about.join(" and ")}` : ""}: answer with Draw and a say.`;
    }
    return "Explain with Draw, a step at a time (each say is a step); read with { wait: true } to hear the user's next question.";
  }
  async function read(input) {
    if (input == null) return void await open();
    await current();
    if (input && input.wait === true) await newAsk(WAIT_MS);
    const n = board.asked?.n ?? 0;
    const fresh = n > seen;
    seen = n;
    const out = describe(board, { lines: input && input.lines === true });
    return { ...out, open: !!where, newAsk: fresh, next: nextFor(board, fresh) };
  }
  const runs = {
    open: () => open(),
    close,
    clear: async () => {
      await set({ ...emptyBoard(), nextId: (await current()).nextId, asked: board.asked });
      audit("cleared");
    },
    next: async () => set(goTo(await current(), (await current()).step + 1)),
    back: async () => set(goTo(await current(), (await current()).step - 1))
  };
  for (const [id, title] of [
    ["open", "cmd-open"],
    ["close", "cmd-close"],
    ["clear", "cmd-clear"],
    ["next", "cmd-next"],
    ["back", "cmd-back"]
  ]) {
    tf.command(tf.t(title), () => void runs[id]().catch(warn), { id });
  }
  tf.command(
    tf.t("cmd-show"),
    async (input) => {
      if (input == null) return void await open();
      const b = await change("shown", (b2) => show(b2, input));
      const d = describe(b);
      return {
        content: d.content,
        canvas: d.canvas,
        next: "Now explain it with Draw, a step at a time."
      };
    },
    {
      id: "show",
      input: "{ text, kind?: code|text, language?, from?: first line's number, title?, say?, append? }: what to explain"
    }
  );
  tf.command(
    tf.t("cmd-draw"),
    async (input) => {
      if (input == null) return void await open();
      const { board: b, ids } = await change("drew", (b2) => draw(b2, input));
      return { ids, step: b.step, steps: b.steps.length };
    },
    {
      id: "draw",
      input: "{ shapes: [{ kind, id?, color?, ... }], say?, clear? }: say starts a new step. Read the board's `how` for kinds and points"
    }
  );
  tf.command(
    tf.t("cmd-erase"),
    async (input) => {
      if (input == null) return void await open();
      const b = await change("erased", (b2) => erase(b2, input));
      return { shapes: b.shapes.length, steps: b.steps.length };
    },
    { id: "erase", input: "{ ids: [...] } or { step } or { all: true }: what to erase" }
  );
  tf.command(tf.t("cmd-read"), (input) => read(input), {
    id: "read",
    input: "{ wait?: true, lines?: true }: the board as data; with wait, holds up to 7 s for the user's question"
  });
  tf.on(
    "page.message",
    background((e) => hear(e && e.message))
  );
  tf.on(
    "page.closed",
    background(() => {
      if (!where) return;
      where = null;
      audit("closed");
    })
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock: the board moves to a window of its own, and loads again.
    background(async () => {
      if (where !== "side") return;
      await tf.page.open();
      where = "window";
    })
  );
}

// src/main.js
var main_default = (tf) => {
  runExplainBoard(tf);
};
export default main_default;
