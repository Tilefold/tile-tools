/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Whiteboard — the board and what changes it
 *
 * A board is plain JSON, so the tile can keep it in its store and send it
 * to the page as it is:
 *
 *   { title, content, steps: [{ say }], step, shapes, nextId, asked, revision }
 *
 * - `content` is what is being explained: lines of code or text (scene.js).
 * - `steps` are the explanation's steps, each with what the agent says in
 *   it; every shape belongs to one. Step 0 is the content itself. The page
 *   shows the shapes of every step up to the one the user is on, so the
 *   user can go back over an explanation, and forward again.
 * - `asked` is the last thing the user asked about: a line, a shape, and
 *   or a question typed into the page, with a number that grows with each.
 * - A 3D scene the user moved on the page (by its bar) has their `x` and
 *   `y`, and `moved: true`, which keeps it there when the agent redraws it.
 *
 * Every operation returns a new board (the old one is left as it was) or
 * throws an Error that says why, for the agent. Pure: no `tf`, no DOM.
 */
import {
  CHAR_W,
  CONTENT_TOP,
  LINE_H,
  MAX_HEIGHT,
  TEXT_X,
  WIDTH,
  boardHeight,
  clamp,
  contentBox,
  endsOf,
  lineBox,
  shapeBox,
} from "./layout.js";
import { LIMITS, checkContent, checkSay, checkShape, checkTitle } from "./scene.js";

/** The most JSON a board may take, so it fits one message to the page and the store. */
export const MAX_BOARD_BYTES = 200 * 1024;

/** An empty board. */
export const emptyBoard = () => ({
  title: null,
  content: null,
  steps: [{ say: null }],
  step: 0,
  shapes: [],
  nextId: 1,
  asked: null,
  revision: 0,
});

/** Whether `b` looks like a board this version keeps (one from the store may be anything). */
export function isBoard(b) {
  return (
    !!b &&
    typeof b === "object" &&
    Array.isArray(b.steps) &&
    b.steps.length > 0 &&
    Array.isArray(b.shapes) &&
    Number.isInteger(b.step) &&
    Number.isInteger(b.nextId)
  );
}

/** Finds a shape by id on a board. */
export const finder = (board) => {
  const byId = new Map(board.shapes.map((s) => [s.id, s]));
  return (id) => byId.get(id);
};

/** A board with one more revision, after checking it still fits. */
function done(board) {
  const next = { ...board, revision: board.revision + 1 };
  const bytes = new TextEncoder().encode(JSON.stringify(next)).length;
  if (bytes > MAX_BOARD_BYTES) {
    throw new Error(
      "The board is full: erase some shapes, or show the content again to start over.",
    );
  }
  return next;
}

/**
 * Shows new content to explain, which starts a new explanation: earlier
 * drawings and steps go. With `append`, adds the lines after the content
 * already there and keeps the drawings.
 *
 * @param {object} board
 * @param {{ text: string, kind?: string, language?: string, from?: number,
 *           title?: string, say?: string, append?: boolean }} input
 */
export function show(board, input) {
  const content = checkContent(input);
  const title = checkTitle(input.title);
  const say = checkSay(input.say);
  if (input.append === true && board.content) {
    const lines = [...board.content.lines, ...content.lines];
    if (lines.length > LIMITS.lines) throw new Error(`text: at most ${LIMITS.lines} lines in all`);
    return done({
      ...board,
      title: title ?? board.title,
      content: { ...board.content, lines },
    });
  }
  return done({
    ...emptyBoard(),
    title: title ?? null,
    content,
    steps: [{ say: say ?? null }],
    nextId: board.nextId,
    asked: board.asked,
    revision: board.revision,
  });
}

/** Checks that every line and shape a shape points at is on the board. */
function checkTargets(shape, where, board, find) {
  const ends = [];
  if (shape.kind === "arrow" || shape.kind === "line")
    ends.push(["from", shape.from], ["to", shape.to]);
  for (const [end, p] of ends) {
    if (Array.isArray(p)) continue;
    if ("line" in p && !lineBox(board.content, p.line)) {
      throw new Error(
        `${where}.${end}.line: there's no line ${p.line} on the board${linesHint(board)}`,
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

/** " (lines a to b)" for an error, or "" when the board has no content. */
function linesHint(board) {
  const c = contentBox(board.content);
  return c.to >= c.from ? ` (lines ${c.from} to ${c.to})` : " (show some content first)";
}

/**
 * Draws shapes. With `say`, they make a new step of the explanation, and
 * the page moves on to it; without, they join the last step. A shape with
 * the id of one already there replaces it (in its step), so an agent can
 * move or relabel what it drew. With `clear`, everything drawn goes first.
 *
 * @returns {{ board: object, ids: string[] }}
 */
export function draw(board, input) {
  if (!input || typeof input !== "object") throw new Error("input: { shapes: [...], say? }");
  const list = input.shapes ?? [];
  if (!Array.isArray(list)) throw new Error("shapes: a list of shapes");
  if (list.length > LIMITS.shapesPerDraw) {
    throw new Error(
      `shapes: at most ${LIMITS.shapesPerDraw} in one Draw; draw the rest in another`,
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

  // Ids first, so shapes in the same Draw can point at each other.
  let nextId = next.nextId;
  const shapes = [...next.shapes];
  const ids = [];
  for (const s of checked) {
    const id = s.id ?? `s${nextId++}`;
    const at = shapes.findIndex((o) => o.id === id);
    const old = at >= 0 ? shapes[at] : null;
    // A 3D scene the user moved stays where they put it when the agent draws it again.
    const placed =
      old?.moved && old.kind === "scene3d" && s.kind === "scene3d"
        ? { x: Math.min(old.x, Math.max(0, WIDTH - s.w)), y: old.y, moved: true }
        : {};
    const shape = { ...s, ...placed, id, step: old ? old.step : step };
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

/**
 * Erases shapes: `ids`, the shapes of step `step`, or `all` of them (with
 * every step but the first). Content stays; arrows pointing at an erased
 * shape go with it.
 */
export function erase(board, input) {
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
    (s) => !gone.has(s.id) && !pointsAtGone(s.from) && !pointsAtGone(s.to),
  );
  return done({ ...board, shapes });
}

/** Shows step `n` of the explanation (clamped to the steps there are). */
export function goTo(board, n) {
  const step = Math.max(0, Math.min(board.steps.length - 1, Math.trunc(Number(n) || 0)));
  return step === board.step ? board : done({ ...board, step });
}

/**
 * The user asks about something: a content line, a shape, a question, or
 * a mix. Each ask gets a number one more than the last.
 */
export function ask(board, input) {
  const asked = { n: (board.asked?.n ?? 0) + 1 };
  if (Number.isInteger(input?.line) && lineBox(board.content, input.line)) asked.line = input.line;
  const shape = typeof input?.shape === "string" ? finder(board)(input.shape) : null;
  if (shape) asked.shape = input.shape;
  // A part of a 3D scene: one of its objects' labels.
  if (
    shape?.kind === "scene3d" &&
    typeof input?.part === "string" &&
    shape.objects.some((o) => o.label === input.part)
  ) {
    asked.part = input.part;
  }
  if (typeof input?.question === "string" && input.question.trim()) {
    asked.question = input.question.trim().slice(0, LIMITS.question);
  }
  if (!("line" in asked) && !("shape" in asked) && !("question" in asked)) return board;
  return done({ ...board, asked });
}

/**
 * The user moved a 3D scene (by the bar along its top) to `x`, `y`, in
 * board units. It keeps its size and stays inside the board; anything else
 * (another kind of shape, an id that isn't there, a number that isn't one)
 * leaves the board as it was. Arrows that point at the scene follow it.
 */
export function move(board, input) {
  const id = typeof input?.id === "string" ? input.id : null;
  const s = id ? finder(board)(id) : null;
  if (!s || s.kind !== "scene3d") return board;
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return board;
  const x = Math.round(clamp(input.x, 0, Math.max(0, WIDTH - s.w)));
  const y = Math.round(clamp(input.y, 0, Math.max(0, MAX_HEIGHT - s.h)));
  if (x === s.x && y === s.y) return board;
  const moved = { ...s, x, y, moved: true };
  return done({ ...board, shapes: board.shapes.map((t) => (t === s ? moved : t)) });
}

/** What every agent should know about drawing here, in a few lines. */
const HOW = [
  "The board is 1000 units wide; y grows downwards. Content lines are laid out at fixed places (see content).",
  "Draw with { shapes: [...], say? }: say makes a new step the user steps through; ids let you replace a shape later.",
  "Kinds: box/ellipse {x,y,w,h,label?}, note {x,y,w?,text}, text {x,y,text,size?}, arrow/line {from,to,label?,curve?}, highlight {lines:[a,b] or line, cols?, label?}, path {d}, scene3d {x,y,w,h,camera?:{yaw,pitch},objects:[...]}.",
  "3D objects (y up, -100..100; the user turns, zooms and clicks parts): box {at,size}, sphere {at,r}, point, label {at,text}, line {at,to}, cylinder {at,to,r,r2?} (r2:0 is a cone), arrow {at,to,r?} (forces, directions), lathe {at,profile:[[radius,h],...],axis?:x|y|z} (bodies spun round an axis: fuselage, bottle, rocket), wing {at,span,chord,thickness?,camber?,taper?,sweep?,dihedral?,mirror?=true,vertical?} (a real airfoil; nose to +x, span along z, vertical for a fin), tube {points:[[x,y,z],...],r?,flow?} (smooth curve; flow:true moves beads along it, for air or current). Any object: color, label (the part's name, which the user can click to ask about), rot [x,y,z] degrees, opacity. Build real things from these parts, each with a label.",
  "Points: [x,y], { line, col? } (a content line by its number) or { shape: id, side? }. Colors: accent, red, orange, yellow, green, teal, blue, purple, gray.",
  "Keep drawings right of the content column (x ≥ content.box.w + 20) so they don't cover it, or below it. A scene3d floats over the board in a window the user can move by its bar (and fold away): moved: true means its x,y are where the user put it, and drawing it again keeps them.",
];

/**
 * The board as an agent reads it: where everything is, each shape with the
 * box it takes, the steps, and the user's last question. `lines` includes
 * the content's text (up to `maxChars`), which the agent that showed it
 * already knows, but another agent may not.
 */
export function describe(board, { lines = false, maxChars = 20000 } = {}) {
  const find = finder(board);
  const c = contentBox(board.content);
  const content = board.content
    ? {
        kind: board.content.kind,
        language: board.content.language ?? null,
        from: c.from,
        to: c.to,
        box: { x: c.x, y: c.y, w: c.w, h: c.h },
        lineTop: `y of line n = ${CONTENT_TOP} + (n - from) * ${LINE_H}; each line is ${LINE_H} high`,
        columnX: `x of column k = ${TEXT_X} + (k - 1) * ${CHAR_W}`,
      }
    : null;
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
      shapes: board.shapes.filter((x) => x.step === n).length,
    })),
    step: board.step,
    shapes: board.shapes.map((s) => {
      const box = shapeBox(s, find, board.content);
      const out = { ...s, box: box && roundBox(box) };
      if (s.kind === "arrow" || s.kind === "line") out.ends = endsOf(s, find, board.content);
      return out;
    }),
    asked: board.asked,
    how: HOW,
  };
}

/** A box with whole numbers. */
const roundBox = (b) => ({
  x: Math.round(b.x),
  y: Math.round(b.y),
  w: Math.round(b.w),
  h: Math.round(b.h),
});
