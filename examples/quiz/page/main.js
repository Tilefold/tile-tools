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
 * is light or dark. On a docked card it also follows drags of its own top
 * bar (to move the card) and of its bottom-right corner (to resize it),
 * and reports how far the pointer went since the press: a docked page
 * keeps the pointer, so only the page can see those drags. The distance is
 * measured on the screen, which doesn't move when the card does. Its place
 * button docks the card beside the panes, or floats the docked page again.
 * Where Tilefold gives its theme (0.1.20), the page is drawn in it: the
 * stylesheet reads Tilefold's colors (`--tf-pane`…) first. It keeps no quiz of its own: the tile decides
 * everything, so the card and the panel always agree. All text arrives
 * from the tile in the user's language.
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/keys.js
  function keyAction(e, view2) {
    if (!e || e.ctrlKey || e.altKey || e.metaKey) return null;
    if (e.key === "Escape") return { type: "close" };
    if (!view2) return null;
    if (view2.screen === "list") {
      const n = /^[1-9]$/.test(String(e.key)) ? Number(e.key) - 1 : -1;
      const quiz = Array.isArray(view2.quizzes) ? view2.quizzes[n] : void 0;
      return quiz ? { type: "open-quiz", id: quiz.id } : null;
    }
    if (view2.done) return e.key === "Enter" ? { type: "again" } : null;
    if (view2.picked !== null && view2.picked !== void 0) {
      return e.key === "Enter" ? { type: "next" } : null;
    }
    const count = Array.isArray(view2.choices) ? view2.choices.length : 0;
    const key = String(e.key);
    let choice = -1;
    if (/^[1-9]$/.test(key)) choice = Number(key) - 1;
    else if (/^[a-i]$/i.test(key)) choice = key.toUpperCase().charCodeAt(0) - 65;
    return choice >= 0 && choice < count ? { type: "pick", choice } : null;
  }

  // page-src/main.js
  var bridge = window.tilefold;
  var $ = (id) => document.getElementById(id);
  var darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
  var view = null;
  var docked = false;
  var moveTo = null;
  var send = (message) => {
    if (bridge) bridge.post(message).catch(() => {
    });
  };
  var scheme = () => darkScheme.matches ? "dark" : "light";
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function screen(name) {
    for (const id of ["list", "asking", "done"]) $(id).hidden = id !== name;
    $("back").hidden = name === "list";
  }
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
      })
    );
    $("hint").textContent = v.hint;
  }
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
      })
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
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
    $("theme").textContent = theme === "dark" ? "\u2600" : "\u263E";
  }
  function label(id, text) {
    $(id).title = text || "";
    $(id).setAttribute("aria-label", text || "");
  }
  function follow(el2, type, [xName, yName], skip = () => false) {
    let from = null;
    let pending = null;
    let frame = 0;
    const report = (e, phase) => send({ type, phase, [xName]: e.screenX - from.x, [yName]: e.screenY - from.y });
    const end = (e) => {
      if (!from) return;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      report(e, "end");
      from = null;
      document.body.classList.remove("dragging");
    };
    el2.addEventListener("pointerdown", (e) => {
      if (!docked || e.button !== 0 || skip(e)) return;
      e.preventDefault();
      from = { x: e.screenX, y: e.screenY };
      el2.setPointerCapture(e.pointerId);
      document.body.classList.add("dragging");
      send({ type, phase: "start" });
    });
    el2.addEventListener("pointermove", (e) => {
      if (!from) return;
      pending = e;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (from && pending) report(pending, "move");
      });
    });
    el2.addEventListener("pointerup", end);
    el2.addEventListener("pointercancel", end);
  }
  function setup(m) {
    document.documentElement.lang = m.lang || "en";
    document.documentElement.dir = m.dir === "rtl" ? "rtl" : "ltr";
    const labels = m.labels || {};
    label("close", labels.close);
    label("back", labels.list);
    label("theme", labels.theme);
    label("resize", labels.resize);
    docked = m.docked === true;
    moveTo = m.place === "card" ? "side" : m.place === "side" ? "card" : null;
    $("place").hidden = moveTo === null;
    $("place").textContent = moveTo === "side" ? "\u21E5" : "\u21E4";
    label("place", moveTo === "side" ? labels.dock : labels.float);
    $("theme").hidden = m.themed === true;
    document.body.toggleAttribute("data-docked", docked);
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
  $("place").addEventListener("click", () => moveTo && send({ type: "place", to: moveTo }));
  $("close").addEventListener("click", () => send({ type: "close" }));
  follow(document.querySelector("header"), "move", ["dx", "dy"], (e) => !!e.target.closest("button"));
  follow($("resize"), "resize", ["dw", "dh"]);
  darkScheme.addEventListener("change", () => send({ type: "scheme", scheme: scheme() }));
  document.addEventListener("keydown", (e) => {
    const action = keyAction(e, view);
    if (!action) return;
    e.preventDefault();
    send(action);
  });
  send({ type: "hello", scheme: scheme() });
})();
