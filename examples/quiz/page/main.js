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
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/keys.js
  function keyAction(e, view2) {
    if (!e || e.ctrlKey || e.altKey || e.metaKey) return null;
    if (e.key === "Escape") return { type: "close" };
    if (!view2) return null;
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
  var view = null;
  var send = (message) => {
    if (bridge) bridge.post(message).catch(() => {
    });
  };
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
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
})();
