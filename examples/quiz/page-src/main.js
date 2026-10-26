/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz page
 *
 * The borderless card's content. It draws the view the tile sends: the
 * list of quizzes, or a question with its choices marked, whether the
 * answer was right and why, the next step, or the score at the end. It
 * tells the tile what the user clicked or pressed, and whether the system
 * is light or dark. It keeps no quiz of its own: the tile decides
 * everything, so the card and the panel always agree. All text arrives
 * from the tile in the user's language.
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
import { keyAction } from "./keys.js";

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);
const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
/** The view last drawn, for the keys. */
let view = null;

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (bridge) bridge.post(message).catch(() => {});
};

/** The system's light or dark, as the page sees it. */
const scheme = () => (darkScheme.matches ? "dark" : "light");

/** A new element with a class and text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shows one of the card's screens: "list", "asking" or "done". */
function screen(name) {
  for (const id of ["list", "asking", "done"]) $(id).hidden = id !== name;
  $("back").hidden = name === "list";
}

/** Draws the list of quizzes. */
function drawList(v) {
  screen("list");
  $("progress").textContent = v.title;
  $("quizzes").replaceChildren(
    ...v.quizzes.map((q) => {
      const button = el("button", "quiz");
      button.type = "button";
      button.append(el("span", "quiz-title", q.title), el("span", "quiz-detail", q.detail));
      button.addEventListener("click", () => send({ type: "open-quiz", id: q.id }));
      return button;
    }),
  );
  $("hint").textContent = v.hint;
}

/** Draws a question: its choices as buttons, marked once one is picked. */
function drawQuestion(v) {
  screen("asking");
  $("progress").textContent = v.progress;
  $("question").textContent = v.question;
  $("choices").replaceChildren(
    ...v.choices.map((c, i) => {
      const button = el("button", `choice mark-${c.mark}`);
      button.type = "button";
      button.disabled = v.picked !== null;
      button.append(el("span", "letter", c.letter), el("span", "text", c.text));
      button.addEventListener("click", () => send({ type: "pick", choice: i }));
      return button;
    }),
  );
  const answered = v.picked !== null;
  $("answer").hidden = !answered;
  if (answered) {
    $("result").textContent = v.result;
    $("result").className = v.correct ? "result right" : "result wrong";
    $("why").textContent = v.why;
    $("next").textContent = v.next;
    $("next").focus({ preventScroll: true });
  }
}

/** Draws the view the tile sent. */
function draw(v) {
  view = v;
  if (v.screen === "list") return drawList(v);
  if (v.done) {
    screen("done");
    $("progress").textContent = v.title;
    $("score").textContent = v.score;
    $("again").textContent = v.again;
    return;
  }
  drawQuestion(v);
}

/** Draws the card light or dark. */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  $("theme").textContent = theme === "dark" ? "☀" : "☾";
}

/** Labels a header button for screen readers and as its tooltip. */
function label(id, text) {
  $(id).title = text || "";
  $(id).setAttribute("aria-label", text || "");
}

/** Takes the page's language, labels and appearance. */
function setup(m) {
  document.documentElement.lang = m.lang || "en";
  document.documentElement.dir = m.dir === "rtl" ? "rtl" : "ltr";
  const labels = m.labels || {};
  label("close", labels.close);
  label("back", labels.list);
  label("theme", labels.theme);
  applyTheme(m.theme);
}

if (bridge) {
  bridge.onMessage((m) => {
    if (!m || typeof m !== "object") return;
    if (m.do === "setup") setup(m);
    if (m.do === "theme") applyTheme(m.theme);
    if (m.do === "show" && m.view) draw(m.view);
  });
}

$("next").addEventListener("click", () => send({ type: "next" }));
$("again").addEventListener("click", () => send({ type: "again" }));
$("back").addEventListener("click", () => send({ type: "list" }));
$("theme").addEventListener("click", () => send({ type: "theme" }));
$("close").addEventListener("click", () => send({ type: "close" }));
darkScheme.addEventListener("change", () => send({ type: "scheme", scheme: scheme() }));
document.addEventListener("keydown", (e) => {
  const action = keyAction(e, view);
  if (!action) return;
  e.preventDefault();
  send(action);
});

send({ type: "hello", scheme: scheme() });
