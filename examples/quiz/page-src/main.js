/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Quiz page
 *
 * The borderless card's content. It draws the view the tile sends (the
 * progress, the question, the choices and how each is marked, whether
 * the answer was right and why, the next step, or the score at the end)
 * and tells the tile what the user clicked or pressed. It keeps no quiz
 * of its own: the tile decides everything, so the card and the panel
 * always agree. All text arrives from the tile in the user's language.
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
import { keyAction } from "./keys.js";

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);
/** The view last drawn, for the keys. */
let view = null;

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (bridge) bridge.post(message).catch(() => {});
};

/** A new element with a class and text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draws a question: its choices as buttons, marked once one is picked. */
function drawQuestion(v) {
  $("progress").textContent = v.progress;
  $("question").textContent = v.question;
  const list = $("choices");
  list.replaceChildren(
    ...v.choices.map((c, i) => {
      const button = el("button", `choice mark-${c.mark}`);
      button.type = "button";
      button.disabled = v.picked !== null;
      button.append(el("span", "letter", c.letter), el("code", "text", c.text));
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
  $("asking").hidden = v.done;
  $("done").hidden = !v.done;
  if (v.done) {
    $("progress").textContent = "";
    $("score").textContent = v.score;
    $("again").textContent = v.again;
  } else {
    drawQuestion(v);
  }
}

/** Takes the page's language and labels. */
function setup(m) {
  document.documentElement.lang = m.lang || "en";
  document.documentElement.dir = m.dir === "rtl" ? "rtl" : "ltr";
  document.title = m.title || "";
  $("close").title = m.close || "";
  $("close").setAttribute("aria-label", m.close || "");
}

if (bridge) {
  bridge.onMessage((m) => {
    if (!m || typeof m !== "object") return;
    if (m.do === "setup") setup(m);
    if (m.do === "show" && m.view) draw(m.view);
  });
}

$("next").addEventListener("click", () => send({ type: "next" }));
$("again").addEventListener("click", () => send({ type: "again" }));
$("close").addEventListener("click", () => send({ type: "close" }));
document.addEventListener("keydown", (e) => {
  const action = keyAction(e, view);
  if (!action) return;
  e.preventDefault();
  send(action);
});

send({ type: "hello" });
