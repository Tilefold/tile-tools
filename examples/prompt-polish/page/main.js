/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Promptsmith page
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
 * Modified 2026-11-08 (translations): a case's translations under the
 *   fixes (translations.js).
 * Modified 2026-11-08 (polish agent start): Show its tab while the polish
 *   agent starts or works, and Show its tab and Restart it when it didn't
 *   start.
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

  // src/languages.js
  var LANGUAGES = [
    { code: "ar", name: "Arabic", native: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" },
    { code: "de", name: "German", native: "Deutsch" },
    { code: "en", name: "English", native: "English" },
    { code: "es", name: "Spanish", native: "Espa\xF1ol" },
    { code: "fr", name: "French", native: "Fran\xE7ais" },
    { code: "hi", name: "Hindi", native: "\u0939\u093F\u0928\u094D\u0926\u0940" },
    { code: "it", name: "Italian", native: "Italiano" },
    { code: "ja", name: "Japanese", native: "\u65E5\u672C\u8A9E" },
    { code: "ko", name: "Korean", native: "\uD55C\uAD6D\uC5B4" },
    { code: "pt-BR", name: "Brazilian Portuguese", native: "Portugu\xEAs (Brasil)" },
    { code: "ru", name: "Russian", native: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" },
    { code: "zh-CN", name: "Simplified Chinese", native: "\u7B80\u4F53\u4E2D\u6587" }
  ];

  // src/translateLanguages.js
  var MAX_WORD = 40;
  var TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$/i;
  var NAMED = "aa ab af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu fil yue haw ceb hmn zh-Hans zh-Hant zh-TW zh-HK pt-PT pt-BR es-419 en-GB en-US fr-CA sr-Latn".split(" ");
  function displayNames(locale) {
    try {
      if (typeof Intl?.DisplayNames !== "function") return null;
      return new Intl.DisplayNames([locale], { type: "language", fallback: "none" });
    } catch {
      return null;
    }
  }
  var ENGLISH = displayNames("en");
  function canonical(tag) {
    if (!TAG.test(tag)) return null;
    try {
      return Intl.getCanonicalLocales(tag)[0] ?? null;
    } catch {
      return null;
    }
  }
  function englishName(code) {
    const own = LANGUAGES.find((l) => l.code === code);
    if (own) return own.name;
    try {
      return ENGLISH?.of(code) ?? null;
    } catch {
      return null;
    }
  }
  function nativeName(code) {
    const own = LANGUAGES.find((l) => l.code === code);
    if (own) return own.native;
    try {
      const name = displayNames(code)?.of(code);
      if (name) return name;
    } catch {
    }
    return englishName(code) ?? code;
  }
  var byName = null;
  function names() {
    if (byName) return byName;
    byName = /* @__PURE__ */ new Map();
    const add = (name, code) => {
      const key = String(name ?? "").toLocaleLowerCase();
      if (key && !byName.has(key)) byName.set(key, code);
    };
    for (const l of LANGUAGES) {
      add(l.name, l.code);
      add(l.native, l.code);
    }
    for (const code of NAMED) {
      const english = englishName(code);
      if (!english) continue;
      add(english, code);
      add(nativeName(code), code);
    }
    return byName;
  }
  function languageCode(word) {
    const w = String(typeof word === "string" ? word : "").trim();
    if (!w || [...w].length > MAX_WORD) return null;
    const key = w.toLocaleLowerCase();
    const own = LANGUAGES.find((l) => l.code.toLowerCase() === key);
    if (own) return own.code;
    const named = names().get(key);
    if (named) return named;
    const code = canonical(w);
    return code && englishName(code) && englishName(code) !== code ? code : null;
  }
  var shownName = (code) => `${nativeName(code)} \xB7 ${code}`;

  // page-src/languagesField.js
  var MAX = 8;
  function readLanguages(text) {
    const codes = [];
    const unknown = [];
    for (const w of String(text).slice(0, 200).split(/[,;、，\n]+/)) {
      const word = w.trim();
      if (!word) continue;
      const code = languageCode(word);
      if (!code) unknown.push(word);
      else if (!codes.includes(code)) codes.push(code);
    }
    return { codes, unknown };
  }
  function languagesField(L2, el2, value) {
    const input = el2("input");
    Object.assign(input, { name: "translate", type: "text", maxLength: 200, value, dir: "ltr" });
    input.placeholder = L2.caseTranslateHint;
    const wrap = el2("label", "case-field");
    const help = el2("span", "muted tl-help", L2.caseTranslateHelp);
    const reads = el2("span", "tl-reads");
    reads.setAttribute("aria-live", "polite");
    wrap.append(el2("span", "muted", L2.caseTranslate), input, help, reads);
    const show = () => {
      const { codes, unknown } = readLanguages(input.value);
      const parts = [];
      if (codes.length) {
        parts.push(`${L2.translatePreview} ${codes.slice(0, MAX).map(shownName).join(", ")}`);
      }
      if (codes.length > MAX) parts.push(L2.translateTooMany);
      if (unknown.length) {
        parts.push(String(L2.translateUnknown).replace("{words}", unknown.join(", ")));
      }
      reads.textContent = parts.join(" ");
      reads.classList.toggle("warn", unknown.length > 0 || codes.length > MAX);
    };
    input.addEventListener("input", show);
    show();
    return { wrap, input };
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
      const names2 = (v.modes ?? []).filter((m) => String(m.id).startsWith("case:"));
      const id = String(v.modeId);
      if (id.startsWith("case:")) {
        const name = id.slice(5);
        list.append(item(L2.editCase.replace("{name}", name), { type: "case-edit", was: name }));
      } else {
        const label = (v.modes ?? []).find((m) => m.id === id)?.label ?? id;
        list.append(item(L2.editCase.replace("{name}", label), { type: "case-edit", builtin: id }));
        if (names2.length) {
          const edit = item(L2.editAnother, null);
          edit.addEventListener("click", () => drawEditWhich(v, L2, o, names2));
          list.append(edit);
        }
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
  function drawEditWhich(v, L2, o, names2) {
    const list = o.el("div", "menu");
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", L2.editWhich);
    for (const m of names2) {
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
    if (v.builtin) return drawBuiltin(v, L2, o);
    const old = o.body.querySelector("form.case");
    const same = old && old.dataset.was === String(v.was ?? "");
    const typed = same ? {
      name: old.elements.namedItem("name").value,
      rules: old.elements.namedItem("rules").value,
      translate: old.elements.namedItem("translate").value
    } : { name: v.name, rules: v.rules, translate: v.translate ?? "" };
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
    const tl = languagesField(L2, o.el, typed.translate);
    const translate = tl.input;
    const rules = o.el("textarea");
    Object.assign(rules, {
      name: "rules",
      rows: 5,
      maxLength: 2e3,
      value: typed.rules,
      dir: "auto"
    });
    rules.placeholder = L2.caseRulesHint;
    form.append(field(L2.caseName, name), field(L2.caseRules, rules), tl.wrap);
    if (v.why) {
      const why = o.el("p", "warn", v.why);
      why.setAttribute("role", "alert");
      form.append(why);
    }
    const save = () => o.send({
      type: "case-save",
      name: name.value,
      rules: rules.value,
      translate: translate.value
    });
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
  function drawBuiltin(v, L2, o) {
    const old = o.body.querySelector("form.case");
    const key = `builtin:${v.builtin}`;
    const same = old && old.dataset.was === key;
    const typed = same ? old.elements.namedItem("translate").value : v.translate ?? "";
    const form = o.el("form", "case");
    form.dataset.was = key;
    form.append(o.el("b", "case-title", L2.caseBuiltin));
    const name = o.el("p", "case-name", v.name);
    name.dir = "auto";
    form.append(name, o.el("p", "muted", L2.caseBuiltinNote));
    const tl = languagesField(L2, o.el, typed);
    const translate = tl.input;
    form.append(tl.wrap);
    if (v.why) {
      const why = o.el("p", "warn", v.why);
      why.setAttribute("role", "alert");
      form.append(why);
    }
    const save = () => o.send({ type: "case-save", translate: translate.value });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      save();
    });
    o.body.replaceChildren(form);
    o.foot.replaceChildren(
      o.el("span", "spacer"),
      o.button("btn ghost", L2.cancel, { type: "case-cancel" }),
      o.button("btn primary", L2.caseSave, null)
    );
    o.foot.lastChild.addEventListener("click", save);
    if (!same) translate.focus();
  }

  // page-src/translations.js
  function translationsOf(v, L2, o) {
    const list = Array.isArray(v.translations) ? v.translations : [];
    if (!list.length) return null;
    const box = o.el("section", "translations");
    box.setAttribute("aria-label", L2.translations);
    box.append(o.el("b", "case-title", L2.translations));
    for (const x of list) {
      const item = o.el("div", "tl");
      const head = o.el("div", "tl-head");
      const copy = o.button("link", L2.copy, null);
      copy.addEventListener("click", () => {
        void copyText(x.text).then((ok) => {
          if (ok) copy.textContent = L2.copied;
        });
      });
      const go = o.button("btn", v.input ? L2.useThis : L2.sendThis, {
        type: "send",
        translation: x.code
      });
      head.append(o.el("b", "tl-lang", x.native), o.el("span", "spacer"), copy, go);
      const text = o.el("p", "tl-text", x.text);
      text.lang = x.code;
      text.dir = "auto";
      item.append(head, text);
      box.append(item);
    }
    return box;
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
      return ok;
    }
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
      const tl = translationsOf(v, L, { el, button });
      $("body").replaceChildren(box, ...tl ? [tl] : []);
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
      ...v.notes.length ? [notes] : [],
      ...[translationsOf(v, L, { el, button })].filter(Boolean)
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
    const show = v.showHelper ? [button("btn ghost", L.helperShow, { type: "helper-show" })] : [];
    $("foot").replaceChildren(
      ...show,
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
    } else if (v.helperFix) {
      foot.push(
        el("span", "spacer"),
        button("btn ghost", L.helperRestart, { type: "helper-restart" }),
        button("btn primary", L.helperShow, { type: "helper-show" })
      );
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
