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
 * Modified 2026-11-06 (input actions): for a prompt from Tilefold's agent
 *   input box, Use and Keep mine in place of Send to agent.
 * Modified 2026-11-07 (see-through card): over the pane, the card's
 *   background is as solid as the setting says.
 * Modified 2026-11-07 (polish agent progress): the waiting step's own
 *   hint, and, once the polish agent has the prompt, the seconds it has
 *   taken and a moving bar.
 * Modified 2026-11-07 (send from the card): for a prompt from the agent
 *   input box, Send to agent beside Use.
 * Modified 2026-11-07 (text only): below 60% the blocks fade with the card
 *   (`faded`), and at 0 only the text shows (`text-only`).
 * Modified 2026-11-07 (own cases): the chip opens the menu of what to fix,
 *   and the form to add or edit one of the user's own cases (cases.js).
 * Modified 2026-11-07 (move and fill): over the pane, the header moves the
 *   card, ▢ makes it fill the pane, and a double click folds it to its
 *   header bar or back (move.js); folded, it sends no size.
 * Modified 2026-11-07 (fitted card): the height sent is the content's own
 *   (its children's extent), so the card also shrinks when there's less.
 * Modified 2026-11-07 (pick before checking): the chip names what to fix
 *   first; a prompt from the agent input box, with own cases, opens on the
 *   menu of what to fix (`choose`), and the pick starts the check.
 * Modified 2026-11-08 (apply a case): with a case picked, the write step's
 *   button applies it by name (`apply`).
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

  // page-src/cases.js
  function drawModeMenu(v, L2, o) {
    const list = o.el("div", "menu");
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", L2.modeMenu);
    const item = (label, message, checked) => {
      const b = o.button(checked === void 0 ? "menu-item" : "menu-item pick", label, null);
      b.setAttribute("role", checked === void 0 ? "menuitem" : "menuitemradio");
      if (checked !== void 0) b.setAttribute("aria-checked", String(checked));
      b.dir = "auto";
      if (message) b.addEventListener("click", () => o.pick(message));
      return b;
    };
    for (const m of v.modes ?? [])
      list.append(item(m.label, { type: "mode", to: m.id }, m.id === v.modeId));
    list.append(o.el("hr", "menu-line"));
    if (v.canEditCases) {
      const names = (v.modes ?? []).filter((m) => String(m.id).startsWith("case:"));
      if (String(v.modeId).startsWith("case:")) {
        const name = String(v.modeId).slice(5);
        list.append(item(L2.editCase.replace("{name}", name), { type: "case-edit", was: name }));
      } else if (names.length) {
        const edit = item(L2.editCases, null);
        edit.addEventListener("click", () => drawEditWhich(v, L2, o, names));
        list.append(edit);
      }
      list.append(item(L2.addCase, { type: "case-edit", was: null }));
    } else {
      list.append(o.el("p", "muted", L2.casesInSettings));
    }
    const ask = v.step === "write" && v.choose ? [o.el("p", "menu-ask", L2.modeChoose)] : [];
    o.body.replaceChildren(...ask, list);
    o.foot.replaceChildren(o.button("btn ghost", L2.cancel, null));
    o.foot.firstChild.addEventListener("click", o.close);
    list.querySelector("[aria-checked='true'], button")?.focus();
  }
  function drawEditWhich(v, L2, o, names) {
    const list = o.el("div", "menu");
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", L2.editWhich);
    for (const m of names) {
      const b = o.button("menu-item", m.label, null);
      b.setAttribute("role", "menuitem");
      b.dir = "auto";
      b.addEventListener("click", () => o.pick({ type: "case-edit", was: String(m.id).slice(5) }));
      list.append(b);
    }
    o.body.replaceChildren(o.el("p", "menu-ask", L2.editWhich), list);
    o.foot.replaceChildren(o.button("btn ghost", L2.cancel, null));
    o.foot.firstChild.addEventListener("click", () => drawModeMenu(v, L2, o));
    list.querySelector("button")?.focus();
  }
  function drawCase(v, L2, o) {
    const old = o.body.querySelector("form.case");
    const same = old && old.dataset.was === String(v.was ?? "");
    const typed = same ? { name: old.elements.namedItem("name").value, rules: old.elements.namedItem("rules").value } : { name: v.name, rules: v.rules };
    const form = o.el("form", "case");
    form.dataset.was = String(v.was ?? "");
    form.append(o.el("b", "case-title", v.was === null ? L2.caseNew : L2.caseEdit));
    const field = (label, control) => {
      const wrap = o.el("label", "case-field");
      wrap.append(o.el("span", "muted", label), control);
      return wrap;
    };
    const name = o.el("input");
    Object.assign(name, {
      name: "name",
      type: "text",
      maxLength: 60,
      value: typed.name,
      dir: "auto"
    });
    const rules = o.el("textarea");
    Object.assign(rules, {
      name: "rules",
      rows: 5,
      maxLength: 2e3,
      value: typed.rules,
      dir: "auto"
    });
    rules.placeholder = L2.caseRulesHint;
    form.append(field(L2.caseName, name), field(L2.caseRules, rules));
    if (v.why) {
      const why = o.el("p", "warn", v.why);
      why.setAttribute("role", "alert");
      form.append(why);
    }
    const save = () => o.send({ type: "case-save", name: name.value, rules: rules.value });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      save();
    });
    o.body.replaceChildren(form);
    const foot = [];
    if (v.was !== null)
      foot.push(o.button("btn ghost", L2.caseRemove, { type: "case-remove", name: v.was }));
    foot.push(
      o.el("span", "spacer"),
      o.button("btn ghost", L2.cancel, { type: "case-cancel" }),
      o.button("btn primary", L2.caseSave, null)
    );
    foot.at(-1).addEventListener("click", save);
    o.foot.replaceChildren(...foot);
    if (!same) (typed.name ? rules : name).focus();
  }

  // page-src/move.js
  var MIN_DRAG = 4;
  var isHandle = (target) => !(target instanceof Element) || !target.closest("button, .chip, a, textarea, input");
  function setupMoving(head, o) {
    let drag = null;
    let frame = 0;
    const root = document.documentElement;
    head.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !o.movable() || !isHandle(e.target)) return;
      drag = { id: e.pointerId, x: e.screenX, y: e.screenY, dx: 0, dy: 0, started: false };
      head.setPointerCapture?.(e.pointerId);
    });
    head.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.screenX - drag.x;
      drag.dy = e.screenY - drag.y;
      if (!drag.started) {
        if (Math.hypot(drag.dx, drag.dy) < MIN_DRAG) return;
        drag.started = true;
        root.classList.add("dragging");
        o.send({ type: "drag", phase: "start", dx: 0, dy: 0 });
      }
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (drag?.started) o.send({ type: "drag", phase: "move", dx: drag.dx, dy: drag.dy });
      });
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (e.type === "pointerup") {
        drag.dx = e.screenX - drag.x;
        drag.dy = e.screenY - drag.y;
      }
      const { dx, dy, started } = drag;
      drag = null;
      cancelAnimationFrame(frame);
      frame = 0;
      root.classList.remove("dragging");
      if (started) o.send({ type: "drag", phase: "end", dx, dy });
    };
    head.addEventListener("pointerup", end);
    head.addEventListener("pointercancel", end);
    head.addEventListener("dblclick", (e) => {
      if (o.foldable() && isHandle(e.target)) o.send({ type: "collapse" });
    });
  }

  // page-src/main.js
  var bridge = window.tilefold;
  var $ = (id) => document.getElementById(id);
  var L = null;
  var view = null;
  var menuOpen = false;
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
    $("chip").textContent = `${v.mode} \xB7 ${v.language}`;
    $("chip").title = `${L.modeMenu}: ${v.mode} \xB7 ${v.language}`;
    $("chip").setAttribute("aria-expanded", String(menuOpen));
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
    const over = v.view === "bottom" || v.view === "corner";
    $("fill").hidden = !over;
    $("fill").textContent = v.max ? "\u2750" : "\u25A2";
    $("fill").title = v.max ? L.restore : L.fill;
    $("fill").setAttribute("aria-label", v.max ? L.restore : L.fill);
    $("fill").setAttribute("aria-pressed", String(!!v.max));
    $("head").title = over && !v.max ? L.move : "";
    $("head").classList.toggle("movable", over && !v.max);
    $("head").setAttribute("aria-expanded", String(!(over && v.collapsed)));
    document.documentElement.classList.toggle("collapsed", over && !!v.collapsed);
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
    const label = v.apply ? L.applyCase.replace("{name}", v.apply) : L.check;
    const check = button(v.apply ? "btn primary apply" : "btn primary", label, null);
    check.title = `${label} (\u2318\u21A9)`;
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
    if (v.input) asIs.textContent = L.keep;
    asIs.addEventListener(
      "click",
      () => send(v.input ? { type: "keep" } : { type: "as-is", text: area.value })
    );
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
    const box = el("div", `diff${v.clean ? " clean" : ""}${v.rework ? " rework" : ""}`);
    for (const p of v.parts) {
      if ("same" in p) {
        box.append(withCode(p.same));
        continue;
      }
      const c = el("span", `chg${p.off ? " off" : ""}`);
      const toggle = () => send({ type: "toggle", id: p.id });
      if (p.del)
        c.append(
          el("del", wsShown(p.del) ? "ws" : "", wsShown(p.del) && !(v.clean && p.off) ? "\u2423" : p.del)
        );
      if (p.ins)
        c.append(el("ins", wsShown(p.ins) ? "ws" : "", wsShown(p.ins) && !v.clean ? "\u2423" : p.ins));
      if (v.rework) {
        const x = button("chg-x", p.off ? "\u21BA" : "\u2715", null);
        x.title = p.off ? L.restoreChange : L.undoChange;
        x.setAttribute("aria-label", x.title);
        x.addEventListener("click", toggle);
        c.append(x);
        box.append(c);
        continue;
      }
      c.setAttribute("role", "button");
      c.tabIndex = 0;
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
      $("foot").replaceChildren(back, el("span", "spacer"), ...sendButtons(v));
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
      el("p", "muted", v.rework ? L.clickHintRework : L.clickHint),
      ...v.notes.length ? [notes] : []
    );
    $("foot").replaceChildren(back, el("span", "spacer"), ...sendButtons(v));
  }
  function sendButtons(v) {
    if (!v.input) return [button("btn primary", L.send, { type: "send" })];
    return [
      button("btn ghost", L.keep, { type: "keep" }),
      button("btn", L.use, { type: "send" }),
      button("btn primary", L.send, { type: "send-now" })
    ];
  }
  function drawSent() {
    const box = el("div", "state");
    box.append(el("span", "", L.sent));
    $("body").replaceChildren(box);
    $("foot").replaceChildren(el("span", "spacer"), button("btn", L.again, { type: "again" }));
  }
  var ticking = 0;
  function drawAgent(v) {
    const box = el("div", "state");
    const head = el("b", "", v.text);
    box.append(head);
    if (Number.isFinite(v.since)) {
      const time = el("span", "muted elapsed");
      const tick = () => time.textContent = String(L.elapsed || "{n}").replace(
        "{n}",
        String(Math.max(0, Math.round((Date.now() - v.since) / 1e3)))
      );
      tick();
      ticking = setInterval(tick, 1e3);
      const bar = el("div", "shimmer");
      bar.append(el("i"));
      box.append(time, bar);
    }
    box.append(el("span", "muted", v.hint || L.agentHint));
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
    seeThrough(v);
    clearInterval(ticking);
    if (v.step === "case") menuOpen = false;
    drawHead(v);
    const parts = { el, button, send, body: $("body"), foot: $("foot") };
    if (menuOpen) drawModeMenu(v, L, { ...parts, pick: pickMode, close: closeMenu });
    else if (choosing(v)) drawModeMenu(v, L, { ...parts, pick: pickMode, close: skipChoice });
    else if (v.step === "case") drawCase(v, L, parts);
    else if (v.step === "checking") drawChecking(v);
    else if (v.step === "agent") drawAgent(v);
    else if (v.step === "result") drawResult(v);
    else if (v.step === "sent") drawSent();
    else if (v.step === "problem") drawProblem(v);
    else drawWrite(v);
    reportSize();
  }
  function closeMenu() {
    menuOpen = false;
    if (view) draw(view);
  }
  var choosing = (v) => !!v && v.step === "write" && !!v.choose;
  function skipChoice() {
    menuOpen = false;
    send({ type: "choose-skip" });
  }
  function pickMode(message) {
    menuOpen = false;
    send(message);
    if (view) draw(view);
  }
  function seeThrough(v) {
    const card = v.view === "bottom" || v.view === "corner";
    const solid = Number.isFinite(v.solid) ? Math.min(100, Math.max(0, v.solid)) : 100;
    const root = document.documentElement;
    root.classList.toggle("see-through", card && solid < 100);
    root.classList.toggle("faded", card && solid < 60);
    root.classList.toggle("text-only", card && solid === 0);
    root.style.setProperty("--solid", `${solid}%`);
  }
  function contentHeight(el2) {
    const range = document.createRange();
    if (typeof range.getBoundingClientRect !== "function") return el2.scrollHeight;
    range.selectNodeContents(el2);
    const inner = el2.childNodes.length ? range.getBoundingClientRect().height : 0;
    const style = getComputedStyle(el2);
    return Math.ceil(
      inner + parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0")
    );
  }
  var lastH = 0;
  function reportSize() {
    requestAnimationFrame(() => {
      if (document.documentElement.classList.contains("collapsed")) return;
      const h = $("head").offsetHeight + contentHeight($("body")) + $("foot").offsetHeight + 2;
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
  $("chip").addEventListener("click", () => {
    if (choosing(view) && !menuOpen) return skipChoice();
    menuOpen = !menuOpen;
    if (view) draw(view);
  });
  $("fill").addEventListener("click", () => send({ type: "max" }));
  $("fold").addEventListener("click", () => send({ type: "fold" }));
  var overPane = () => !!view && (view.view === "bottom" || view.view === "corner");
  setupMoving($("head"), { send, movable: () => overPane() && !view.max, foldable: overPane });
  $("close").addEventListener("click", () => send({ type: "close" }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && view) {
      e.preventDefault();
      if (view.step === "write") {
        const area = $("draft");
        if (area && area.value.trim()) send({ type: "check", text: area.value });
      } else if (view.step === "result") send({ type: "send" });
    }
    if (e.key === "Escape" && menuOpen) return closeMenu();
    if (e.key === "Escape" && choosing(view)) return skipChoice();
    if (e.key === "Escape" && view?.step === "case") return send({ type: "case-cancel" });
    if (e.key === "Escape" && view && view.view !== "side" && view.view !== "window")
      send({ type: "fold" });
  });
})();
