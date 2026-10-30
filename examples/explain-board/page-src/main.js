/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Explain Board page
 *
 * Draws the board the tile sends: the content's numbered lines, and over
 * them the shapes of every step up to the one shown, the newest step's
 * fading in. The step's caption (what the agent says in it) is above the
 * board, with Back and Next to go over the explanation again. A click on
 * a line or a drawing points at it; with or without a question typed in,
 * Ask sends it to the tile, for the agent to read. A 3D scene turns while
 * it's dragged (that only changes the view here, not the board).
 *
 * Messages with the tile: the page says `hello` when it loads and gets
 * `setup` (the labels in the user's language and the board), then `board`
 * after every change. It sends `step` ({ n }), `ask` ({ line?, shape?,
 * question? }) and `close`. Labels hold `{n}` and `{total}` where those go.
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
import {
  boardHeight,
  CONTENT_TOP,
  GUTTER_X,
  LINE_H,
  TEXT_X,
  WIDTH,
  lineBox,
} from "../src/layout.js";
import { COLORS } from "../src/scene.js";
import { el, markers, sceneNode, shapeNode } from "./svg.js";

const bridge = window.tilefold;
const doc = document;
const $ = (id) => doc.getElementById(id);

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (bridge) bridge.post(message).catch(() => {});
};

/** The labels from the tile, by message key. */
let labels = {};
/** The board last drawn. */
let board = null;
/** The step drawn last time, so only a newly reached step fades in. */
let drawnStep = -1;
/** What the user points at: { line } or { shape }, or null. */
let pointed = null;
/** Each 3D scene's camera while the user turns it, by shape id. */
const cameras = new Map();
/** The narrowest a fitted board gets, in pixels, so 16-unit code stays about 11 px. */
const FIT_MIN = 700;
/** Whether the board fills the page's width ("fit") or shows at its own size. */
let zoom = "fit";

/** A label with its `{n}` and `{total}` filled in. */
const L = (key, vars = {}) =>
  String(labels[key] ?? "").replace(/\{(n|total)\}/g, (_, k) => String(vars[k] ?? ""));

/** Finds a shape of the board by id. */
const find = (id) => board?.shapes.find((s) => s.id === id);

/** A 3D scene's camera: as the user turned it, else as the agent set it. */
const cameraOf = (id) => cameras.get(id) ?? find(id)?.camera ?? { yaw: 35, pitch: 25 };

/** Puts the text in the user's language on the page's fixed parts. */
function words() {
  doc.documentElement.lang = labels["page-lang"] || "en";
  doc.documentElement.dir = labels["page-dir"] || "ltr";
  doc.title = L("page-title");
  $("title").textContent = board?.title || L("page-title");
  $("close").title = L("page-close");
  $("close").setAttribute("aria-label", L("page-close"));
  $("back").textContent = L("step-back");
  $("next").textContent = L("step-next");
  $("zoom").textContent = L(zoom === "fit" ? "zoom-actual" : "zoom-fit");
  $("empty-title").textContent = L("empty-title");
  $("empty-hint").textContent = L("empty-hint");
  $("question").placeholder = L("ask-placeholder");
  $("send").textContent = L("ask-send");
  $("ask-hint").textContent = L("ask-hint");
  $("unpoint").textContent = L("ask-clear");
  $("board").setAttribute("aria-label", L("board-label"));
}

/** The step line and the caption: what the agent says in the step shown. */
function caption() {
  const total = board.steps.length;
  const n = board.step;
  $("steps").hidden = total <= 1;
  $("count").textContent = n === 0 ? L("step-start") : L("step-count", { n, total: total - 1 });
  $("back").disabled = n === 0;
  $("next").disabled = n >= total - 1;
  const say = board.steps[n]?.say;
  $("caption").textContent = say ?? "";
  $("caption").hidden = !say;
}

/** The content's lines: their numbers in the gutter, and their text. */
function contentNodes(svg) {
  const c = board.content;
  // The title is the page's heading, above the board, so it isn't drawn on it.
  if (!c) return;
  const g = el(doc, "g", { class: `content ${c.kind}` });
  c.lines.forEach((text, i) => {
    const n = c.from + i;
    const y = CONTENT_TOP + i * LINE_H;
    const row = el(doc, "g", { class: "line", "data-line": n });
    // The whole row is what a click points at.
    row.append(el(doc, "rect", { class: "hit", x: 0, y, width: WIDTH, height: LINE_H }));
    row.append(
      el(doc, "text", { class: "num", x: GUTTER_X, y: y + 16, "text-anchor": "end" }, [String(n)]),
    );
    row.append(el(doc, "text", { class: "code", x: TEXT_X, y: y + 16 }, [text]));
    g.append(row);
  });
  svg.append(g);
}

/** Draws the whole board again. */
function draw() {
  const svg = $("board");
  svg.replaceChildren();
  const empty = !board.content && board.shapes.length === 0;
  $("empty").hidden = !empty;
  // An SVG element has no `hidden` property in browsers: set the attribute itself.
  svg.toggleAttribute("hidden", empty);
  caption();
  $("title").textContent = board.title || L("page-title");
  if (empty) return;
  const height = boardHeight(board.content, board.shapes, find);
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${height}`);
  // Fit to width, but never so small that the code can't be read: narrower, it scrolls.
  svg.style.width = zoom === "fit" ? "100%" : `${WIDTH}px`;
  svg.style.minWidth = zoom === "fit" ? `${FIT_MIN}px` : "";
  svg.append(markers(doc, COLORS));
  const shown = board.shapes.filter((s) => s.step <= board.step);
  const fresh = board.step > drawnStep ? board.step : -1;
  // Highlights go under the content's text, everything else over it.
  const under = el(doc, "g", { class: "under" });
  const over = el(doc, "g", { class: "over" });
  for (const s of shown) {
    const node = shapeNode(doc, s, find, board.content, cameraOf, L("scene-hint"));
    if (!node) continue;
    if (s.step === fresh && fresh > 0) node.classList.add("fresh");
    (s.kind === "highlight" ? under : over).append(node);
  }
  svg.append(under);
  contentNodes(svg);
  svg.append(over);
  drawnStep = board.step;
  mark();
}

/** Shows what the user points at, on the board and by the question box. */
function mark() {
  for (const n of $("board").querySelectorAll(".pointed")) n.classList.remove("pointed");
  if (pointed && "line" in pointed && !lineBox(board.content, pointed.line)) pointed = null;
  if (pointed && "shape" in pointed && !find(pointed.shape)) pointed = null;
  const node = pointed
    ? $("board").querySelector(
        "line" in pointed ? `[data-line="${pointed.line}"]` : `[data-shape="${pointed.shape}"]`,
      )
    : null;
  node?.classList.add("pointed");
  $("pointing").hidden = !pointed;
  $("pointed").textContent = !pointed
    ? ""
    : "line" in pointed
      ? L("ask-line", { n: pointed.line })
      : L("ask-shape");
}

/** A click on the board: point at the line or the drawing under it (again: stop pointing). */
function point(e) {
  const shape = e.target.closest?.("[data-shape]");
  const line = e.target.closest?.("[data-line]");
  let next = null;
  if (shape) next = { shape: shape.getAttribute("data-shape") };
  else if (line) next = { line: Number(line.getAttribute("data-line")) };
  const same = next && pointed && JSON.stringify(next) === JSON.stringify(pointed);
  pointed = same ? null : next;
  mark();
  if (pointed) $("question").focus();
}

/** Sends what the user points at and asks to the tile. */
function askIt(e) {
  e.preventDefault();
  const question = $("question").value.trim();
  if (!pointed && !question) return;
  send({ type: "ask", ...(pointed ?? {}), ...(question ? { question } : {}) });
  $("question").value = "";
  pointed = null;
  mark();
  $("ask-status").textContent = L("ask-sent");
}

/** Turning a 3D scene by dragging it: only the view here changes. */
function dragScenes() {
  let drag = null;
  $("board").addEventListener("pointerdown", (e) => {
    const g = e.target.closest?.(".k-scene3d");
    if (!g) return;
    const id = g.getAttribute("data-shape");
    drag = { id, x: e.clientX, y: e.clientY, cam: { ...cameraOf(id) }, moved: false };
    g.setPointerCapture?.(e.pointerId);
  });
  $("board").addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const cam = {
      yaw: drag.cam.yaw + dx * 0.6,
      pitch: Math.max(-89, Math.min(89, drag.cam.pitch + dy * 0.6)),
    };
    cameras.set(drag.id, cam);
    // Only this scene is drawn again, for a smooth turn.
    const g = $("board").querySelector(`[data-shape="${drag.id}"]`);
    const s = find(drag.id);
    if (g && s) g.replaceChildren(sceneNode(doc, s, cam, L("scene-hint")));
  });
  const end = () => {
    // A drag that turned the scene isn't a click that points at it.
    if (drag?.moved) suppressClick = true;
    drag = null;
  };
  $("board").addEventListener("pointerup", end);
  $("board").addEventListener("pointercancel", end);
}
let suppressClick = false;

/** The page's buttons and keys. */
function wire() {
  $("close").addEventListener("click", () => send({ type: "close" }));
  $("back").addEventListener("click", () => board && send({ type: "step", n: board.step - 1 }));
  $("next").addEventListener("click", () => board && send({ type: "step", n: board.step + 1 }));
  $("zoom").addEventListener("click", () => {
    zoom = zoom === "fit" ? "actual" : "fit";
    words();
    if (board) draw();
  });
  $("board").addEventListener("click", (e) => {
    if (suppressClick) return void (suppressClick = false);
    point(e);
  });
  $("unpoint").addEventListener("click", () => {
    pointed = null;
    mark();
  });
  $("ask").addEventListener("submit", askIt);
  $("question").addEventListener("input", () => ($("ask-status").textContent = ""));
  doc.addEventListener("keydown", (e) => {
    // Left and right step through the explanation, unless the user is typing.
    if (!board || e.target === $("question")) return;
    if (e.key === "ArrowLeft" && board.step > 0) send({ type: "step", n: board.step - 1 });
    if (e.key === "ArrowRight" && board.step < board.steps.length - 1)
      send({ type: "step", n: board.step + 1 });
  });
  dragScenes();
}

/** Follows Tilefold's light or dark (0.1.20), so the drawing palette matches it. */
function followTheme(theme) {
  if (theme && (theme.mode === "light" || theme.mode === "dark")) {
    doc.documentElement.dataset.mode = theme.mode;
  } else delete doc.documentElement.dataset.mode;
}

wire();
followTheme(bridge?.theme);
bridge?.onTheme?.(followTheme);
bridge?.onMessage((m) => {
  if (!m || typeof m !== "object") return;
  if (m.do === "setup") {
    labels = m.labels && typeof m.labels === "object" ? m.labels : {};
    board = m.board;
    drawnStep = board?.step ?? -1;
    words();
    if (board) draw();
  } else if (m.do === "board" && m.board) {
    // A new explanation (fewer steps than before) starts its fading afresh.
    if (board && m.board.steps.length < board.steps.length) drawnStep = -1;
    board = m.board;
    draw();
  }
});
send({ type: "hello" });
