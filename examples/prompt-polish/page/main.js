/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish page
 *
 * Draws the step the tile sends for the pane the user works in (each pane
 * has its own prompt, and every message names whose it is): writing the
 * prompt, checking it, the
 * fixes (a diff whose changes the user clicks to keep their own words,
 * with a reason for each), sent to the ask card, or a problem. It tells
 * the tile what the user typed (so a reload of the page keeps it), what
 * they clicked, and how tall its content is, so the card over the pane is
 * only as tall as it needs. Text is set with textContent only: nothing
 * from the tile or from Claude is read as HTML. All labels arrive from the
 * tile in the user's language.
 *
 * Modified 2026-11-06 (no-key mode): waiting for the agent in the pane,
 *   with Cancel, and a problem's "Ask the agent instead".
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/bits.js
  var wsShown = (s) => /^[^\S\n]+$/.test(String(s));
  function sizeText(text, unspaced, labels) {
    const t = String(text ?? "");
    const n = unspaced ? t.replace(/\s+/g, "").length : t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    return (unspaced ? labels.chars : labels.words).replace("{count}", String(n));
  }
  var SVG = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
  }
  function viewIcon(view2) {
    const svg = svgEl("svg", { viewBox: "0 0 16 12", "aria-hidden": "true" });
    svg.append(
      svgEl("rect", {
        x: 0.5,
        y: 0.5,
        width: 15,
        height: 11,
        rx: 2,
        fill: "none",
        stroke: "currentColor"
      })
    );
    if (view2 === "side")
      svg.append(svgEl("rect", { x: 10, y: 2, width: 4, height: 8, rx: 1, fill: "currentColor" }));
    else if (view2 === "corner")
      svg.append(svgEl("circle", { cx: 12, cy: 8, r: 2, fill: "currentColor" }));
    else svg.append(svgEl("rect", { x: 2, y: 6, width: 12, height: 4, rx: 1, fill: "currentColor" }));
    return svg;
  }

  // page-src/main.js
  var bridge = window.tilefold;
  var $ = (id) => document.getElementById(id);
  var L = null;
  var view = null;
  var send = (message) => {
    if (!bridge) return;
    bridge.post({ pane: view ? view.pane : null, ...message }).catch(() => {
    });
  };
  var pending = null;
  function flushDraft() {
    if (!pending) return;
    clearTimeout(pending.timer);
    send({ type: "draft", pane: pending.pane, text: pending.text });
    pending = null;
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function button(className, label, message) {
    const b = el("button", className, label);
    b.type = "button";
    if (message) b.addEventListener("click", () => send(message));
    return b;
  }
  function withCode(text) {
    const frag = document.createDocumentFragment();
    for (const piece of String(text).split(/(`[^`\n]*`)/)) {
      if (!piece) continue;
      frag.append(
        piece.startsWith("`") && piece.endsWith("`") && piece.length > 1 ? el("span", "code", piece) : piece
      );
    }
    return frag;
  }
  function drawHead(v) {
    $("name").textContent = L.name;
    $("where").textContent = v.view === "side" ? L.inDock : L.overPane;
    $("chip").textContent = `${v.language} \xB7 ${v.mode}`;
    $("chip").title = v.mode;
    $("views").setAttribute("aria-label", L.views.bottom);
    $("views").replaceChildren(
      ...["bottom", "corner", "side"].map((k) => {
        const b = el("button");
        b.type = "button";
        b.title = L.views[k];
        b.setAttribute("aria-label", L.views[k]);
        b.setAttribute("aria-pressed", String(v.view === k));
        b.append(viewIcon(k));
        b.addEventListener("click", () => send({ type: "view", to: k }));
        return b;
      })
    );
    $("fold").hidden = v.view === "side" || v.view === "window";
    $("fold").title = L.fold;
    $("fold").setAttribute("aria-label", L.fold);
    $("close").title = L.close;
    $("close").setAttribute("aria-label", L.close);
  }
  function drawWrite(v) {
    const area = el("textarea");
    area.id = "draft";
    area.dir = "auto";
    area.lang = v.langCode;
    area.placeholder = v.placeholder;
    area.value = v.draft;
    area.setAttribute("aria-label", v.placeholder);
    const size = el("span", "muted");
    const warn = el("p", "warn", L.tooLong);
    const asIs = button("btn ghost", L.asIs, null);
    const check = button("btn primary", L.check, null);
    check.title = "\u2318\u21A9";
    const update = () => {
      const t = area.value;
      size.textContent = sizeText(t, v.unspaced, L);
      const long = t.trim().length > 2e3;
      warn.hidden = !long;
      check.disabled = !t.trim() || long;
      asIs.disabled = !t.trim();
    };
    area.addEventListener("input", () => {
      update();
      if (pending) clearTimeout(pending.timer);
      pending = { pane: v.pane, text: area.value, timer: setTimeout(flushDraft, 300) };
    });
    asIs.addEventListener("click", () => send({ type: "as-is", text: area.value }));
    check.addEventListener("click", () => send({ type: "check", text: area.value }));
    update();
    $("body").replaceChildren(area, el("p", "muted", L.hint), warn);
    $("foot").replaceChildren(size, el("span", "spacer"), asIs, check);
  }
  function drawChecking(v) {
    const shimmer = el("div", "shimmer");
    for (const w of [92, 78, 85]) {
      const i = el("i");
      i.style.width = `${w}%`;
      shimmer.append(i);
    }
    const box = el("div", "state");
    box.append(el("b", "", v.text), shimmer);
    $("body").replaceChildren(box);
    $("foot").replaceChildren();
  }
  function diffOf(v) {
    const box = el("div", `diff${v.clean ? " clean" : ""}`);
    for (const p of v.parts) {
      if ("same" in p) {
        box.append(withCode(p.same));
        continue;
      }
      const c = el("span", `chg${p.off ? " off" : ""}`);
      c.setAttribute("role", "button");
      c.tabIndex = 0;
      if (p.del)
        c.append(
          el("del", wsShown(p.del) ? "ws" : "", wsShown(p.del) && !(v.clean && p.off) ? "\u2423" : p.del)
        );
      if (p.ins)
        c.append(el("ins", wsShown(p.ins) ? "ws" : "", wsShown(p.ins) && !v.clean ? "\u2423" : p.ins));
      const toggle = () => send({ type: "toggle", id: p.id });
      c.addEventListener("click", toggle);
      c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
      box.append(c);
    }
    return box;
  }
  function drawResult(v) {
    const back = button("btn ghost", L.back, { type: "back" });
    if (v.nothing) {
      const box = el("div", "state");
      box.append(el("b", "", v.nothing));
      $("body").replaceChildren(box);
      $("foot").replaceChildren(
        back,
        el("span", "spacer"),
        button("btn primary", L.send, { type: "send" })
      );
      return;
    }
    const sum = el("div", "sum");
    sum.append(el("b", "", v.summary));
    if (v.undone) sum.append(el("span", "muted", v.undone));
    sum.append(
      el("span", "spacer"),
      button("link", v.clean ? L.showChanges : L.showResult, { type: "clean" })
    );
    const notes = el("ul", "notes");
    for (const n of v.notes) {
      const li = el("li");
      const what = el("span", "what");
      what.append(el("s", "", n.from), " \u2192 ", el("b", "", n.to));
      li.append(el("span", "kind", n.kindLabel), what);
      if (n.why) li.append(el("span", "why", n.why));
      notes.append(li);
    }
    $("body").replaceChildren(
      sum,
      diffOf(v),
      el("p", "muted", L.clickHint),
      ...v.notes.length ? [notes] : []
    );
    $("foot").replaceChildren(
      back,
      el("span", "spacer"),
      button("btn primary", L.send, { type: "send" })
    );
  }
  function drawSent() {
    const box = el("div", "state");
    box.append(el("span", "", L.sent));
    $("body").replaceChildren(box);
    $("foot").replaceChildren(el("span", "spacer"), button("btn", L.again, { type: "again" }));
  }
  function drawAgent(v) {
    const box = el("div", "state");
    box.append(el("b", "", v.text), el("span", "muted", L.agentHint));
    $("body").replaceChildren(box);
    $("foot").replaceChildren(
      el("span", "spacer"),
      button("btn", L.cancel, { type: "cancel-agent" })
    );
  }
  function drawProblem(v) {
    const box = el("div", "state");
    box.append(el("b", "", v.text));
    $("body").replaceChildren(box);
    const foot = [button("btn", L.back, { type: "back" })];
    if (v.askAgent) {
      foot.push(el("span", "spacer"), button("btn primary", L.askAgent, { type: "agent-check" }));
    }
    $("foot").replaceChildren(...foot);
  }
  function draw(v) {
    if (!L) return;
    flushDraft();
    view = v;
    drawHead(v);
    if (v.step === "checking") drawChecking(v);
    else if (v.step === "agent") drawAgent(v);
    else if (v.step === "result") drawResult(v);
    else if (v.step === "sent") drawSent();
    else if (v.step === "problem") drawProblem(v);
    else drawWrite(v);
    reportSize();
  }
  var lastH = 0;
  function reportSize() {
    requestAnimationFrame(() => {
      const body = $("body");
      const h = $("head").offsetHeight + body.scrollHeight + $("foot").offsetHeight + 2;
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      send({ type: "size", h });
    });
  }
  if (bridge) {
    bridge.onMessage((m) => {
      if (!m || typeof m !== "object") return;
      if (m.do === "setup") {
        L = m.labels;
        document.documentElement.lang = String(m.lang || "en");
        document.documentElement.dir = m.dir === "rtl" ? "rtl" : "ltr";
        if (view) draw(view);
      } else if (m.do === "show" && m.view) draw(m.view);
    });
    send({ type: "hello" });
  }
  $("fold").addEventListener("click", () => send({ type: "fold" }));
  $("close").addEventListener("click", () => send({ type: "close" }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && view) {
      e.preventDefault();
      if (view.step === "write") {
        const area = $("draft");
        if (area && area.value.trim()) send({ type: "check", text: area.value });
      } else if (view.step === "result") send({ type: "send" });
    }
    if (e.key === "Escape" && view && view.view !== "side" && view.view !== "window")
      send({ type: "fold" });
  });
})();
