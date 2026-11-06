/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Prompt Polish — corrects the prompts you write to AI agents
 *
 * Write a prompt in the language you choose; Claude fixes its spelling,
 * grammar, spacing and punctuation (or also makes it read naturally),
 * with your own Anthropic key. You see every change with a reason, keep
 * your own words wherever you like, and send the result to the agent in
 * your pane from Tilefold's ask card. Code, file paths and links are never
 * changed. The page shows on a card over the agent's pane, behind a button
 * in its corner, or in the dock beside the panes.
 *
 * Needs Tilefold 0.1.23 (`tf.agent.ask`); over the pane from 0.1.11, beside
 * the panes from 0.1.20.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/polish.js
var MAX_CHARS = 2e3;
var MAX_CELLS = 4e6;
var PROTECTED = /```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s)]+|(?:~|\.{1,2})?\/?[\w.-]+(?:\/[\w.-]+)+/g;
function protectedSpans(text) {
  const spans = [];
  for (const m of String(text ?? "").matchAll(PROTECTED)) {
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return spans;
}
function keepsProtected(original, corrected) {
  let at = 0;
  for (const s of protectedSpans(original)) {
    const found = String(corrected).indexOf(s.text, at);
    if (found < 0) return false;
    at = found + s.text.length;
  }
  return true;
}
var TOKEN = /\s+|`[^`\n]*`|[\p{Script=Latin}\p{N}_'’-]+|[\s\S]/gu;
var tokenize = (text) => String(text ?? "").match(TOKEN) ?? [];
function diff(a, b) {
  const x = tokenize(a);
  const y = tokenize(b);
  let head = 0;
  while (head < x.length && head < y.length && x[head] === y[head]) head++;
  let tail = 0;
  while (tail < x.length - head && tail < y.length - head && x[x.length - 1 - tail] === y[y.length - 1 - tail]) {
    tail++;
  }
  const ops = [];
  const push = (op, text) => {
    if (!text) return;
    const last = ops[ops.length - 1];
    if (last && last.op === op) last.text += text;
    else ops.push({ op, text });
  };
  push("same", x.slice(0, head).join(""));
  const xm = x.slice(head, x.length - tail);
  const ym = y.slice(head, y.length - tail);
  const n = xm.length;
  const m = ym.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    push("del", xm.join(""));
    push("ins", ym.join(""));
  } else {
    const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i2 = n - 1; i2 >= 0; i2--) {
      for (let j2 = m - 1; j2 >= 0; j2--) {
        lcs[i2][j2] = xm[i2] === ym[j2] ? lcs[i2 + 1][j2 + 1] + 1 : Math.max(lcs[i2 + 1][j2], lcs[i2][j2 + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (xm[i] === ym[j]) {
        push("same", xm[i]);
        i++;
        j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("del", xm[i++]);
      else push("ins", ym[j++]);
    }
    while (i < n) push("del", xm[i++]);
    while (j < m) push("ins", ym[j++]);
  }
  push("same", x.slice(x.length - tail).join(""));
  return ops;
}
function changes(ops) {
  const parts = [];
  let id = 0;
  for (let k = 0; k < ops.length; k++) {
    const o = ops[k];
    if (o.op === "same") {
      parts.push({ same: o.text });
      continue;
    }
    const c = { id: ++id, del: "", ins: "" };
    c[o.op] = o.text;
    const next = ops[k + 1];
    if (next && next.op !== "same" && next.op !== o.op) {
      c[next.op] = next.text;
      k++;
    }
    parts.push(c);
  }
  return parts;
}
function build(parts, rejected) {
  const no = rejected instanceof Set ? rejected : new Set(rejected ?? []);
  return parts.map((p) => "same" in p ? p.same : no.has(p.id) ? p.del : p.ins).join("");
}
var changeCount = (parts) => parts.filter((p) => !("same" in p)).length;
function blocker(text) {
  const t = String(text ?? "").trim();
  if (!t) return "empty";
  if (t.length > MAX_CHARS) return "too-long";
  return "";
}

// src/answer.js
var KINDS = ["spelling", "grammar", "spacing", "punctuation", "style"];
var MAX_NOTES = 40;
function systemPrompt(language, mode, uiLanguage) {
  return [
    `You correct prompts a developer writes in ${language} to an AI coding agent.`,
    mode === "natural" ? "Fix spelling, grammar, spacing and punctuation, and make clumsy phrasing natural." : "Fix only spelling, grammar, spacing and punctuation. Do not reword anything else.",
    "Keep the meaning and the language. Never translate, never answer the prompt, never add to it.",
    "Leave anything in backticks, file paths, links, names in code and numbers exactly as they are.",
    `Give each note's "why" as one short sentence in ${uiLanguage}.`,
    'Answer with JSON only: {"corrected": string, "notes": [{"from": string, "to": string, "kind": "spelling" | "grammar" | "spacing" | "punctuation" | "style", "why": string}]}.',
    'When nothing needs fixing, answer {"corrected": <the prompt unchanged>, "notes": []}.'
  ].join("\n");
}
function buildAsk({ text, language, mode, uiLanguage, fast }) {
  return {
    system: systemPrompt(language, mode, uiLanguage),
    messages: [{ role: "user", content: String(text) }],
    // Room for the corrected text twice over (it and the notes), bounded.
    maxTokens: Math.min(4e3, 400 + Math.ceil(String(text).length * 1.5)),
    model: fast ? "fast" : "default"
  };
}
var UNSAFE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩﻿]/g;
var clean = (s) => typeof s === "string" ? s.replace(UNSAFE, "") : "";
var line = (s, max) => {
  const t = clean(s).replace(/\s+/g, " ").trim();
  return t.length <= max ? t : "";
};
function findJson(text) {
  const t = String(text ?? "").trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}
function readNote(n) {
  if (!n || typeof n !== "object") return null;
  const from = clean(n.from).slice(0, 300);
  const to = clean(n.to).slice(0, 300);
  if (!from && !to) return null;
  if (from === to) return null;
  const kind = KINDS.includes(n.kind) ? n.kind : "grammar";
  return { from, to, kind, why: line(n.why, 200) };
}
function readAnswer(text, original) {
  const json = findJson(text);
  if (!json || typeof json !== "object" || typeof json.corrected !== "string") {
    return { ok: false, why: "unreadable" };
  }
  const corrected = clean(json.corrected);
  if (!corrected.trim() || corrected.length > String(original).length * 2 + 200) {
    return { ok: false, why: "unreadable" };
  }
  if (!keepsProtected(original, corrected)) return { ok: false, why: "changed-code" };
  const notes = (Array.isArray(json.notes) ? json.notes : []).slice(0, MAX_NOTES).map(readNote).filter(Boolean);
  return { ok: true, corrected, notes };
}
function errorKey(err) {
  switch (err && typeof err === "object" ? err.name : "") {
    case "AiDeclinedError":
      return null;
    case "AiNotSetUpError":
      return "error-no-key";
    case "PermissionDeniedError":
      return "error-denied";
    case "BudgetExceededError":
      return "error-budget";
    case "RefusedError":
      return "error-refused";
    default:
      return "error-failed";
  }
}

// src/button.js
function colorOr(value, fallback) {
  const v = String(value ?? "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d\s.,%]+\)$/i.test(v) ? v : fallback;
}
function buttonImage({ accent, waiting = 0, open = false } = {}) {
  const fill = colorOr(accent, "#7c5cff");
  const n = Math.max(0, Math.min(99, Math.floor(Number(waiting) || 0)));
  const badge = n > 0 ? `<circle cx="29" cy="7" r="7" fill="#e5484d"/><text x="29" y="10" font-size="9" font-weight="700" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${n}</text>` : "";
  const ring = open ? `<circle cx="18" cy="18" r="16.5" fill="none" stroke="${fill}" stroke-width="1.5" opacity=".55"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">${ring}<circle cx="18" cy="18" r="${open ? 13 : 15}" fill="${fill}"/><text x="18" y="23" font-size="15" font-weight="700" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">P</text>${badge}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
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
var UNSPACED = /* @__PURE__ */ new Set(["ja", "zh-CN"]);
function languageOf(setting, uiCode) {
  const find = (code) => LANGUAGES.find((l) => l.code === code);
  return find(setting) ?? find(uiCode) ?? find("en");
}
var isUnspaced = (code) => UNSPACED.has(code);

// src/place.js
var VIEWS = ["bottom", "corner", "side"];
var SPOT_MIN = 120;
var SPOT_MAX = 2e3;
var GAP = 12;
var BUTTON = 36;
var CORNER_W = 420;
var MAX_H = 440;
var viewOf = (value) => VIEWS.includes(value) ? value : "bottom";
function focusedPane(layout) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const ok = panes.filter((p) => [p.x, p.y, p.w, p.h].every(Number.isFinite));
  return ok.find((p) => p.focused) ?? ok[0] ?? null;
}
function placeFor(layout, view, opts = {}) {
  const h = Math.min(MAX_H, Math.max(SPOT_MIN, Number.isFinite(opts.h) ? opts.h : 260));
  const pane = focusedPane(layout);
  if (!pane || view !== "bottom" && view !== "corner") return null;
  const top = pane.y + GAP;
  const composer = pane.composer && Number.isFinite(pane.composer.y) ? pane.composer : null;
  const floor = (composer ? composer.y : pane.y + pane.h) - GAP;
  const round = (r) => ({
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.w),
    h: Math.round(r.h)
  });
  if (view === "bottom") {
    const w2 = Math.min(SPOT_MAX, pane.w - 2 * GAP);
    const ch2 = Math.min(h, floor - top);
    if (w2 < SPOT_MIN || ch2 < SPOT_MIN) return null;
    return { card: round({ x: pane.x + GAP, y: floor - ch2, w: w2, h: ch2 }), button: null };
  }
  const bx = opts.rtl ? pane.x + GAP : pane.x + pane.w - GAP - BUTTON;
  const button = round({ x: bx, y: floor - BUTTON, w: BUTTON, h: BUTTON });
  if (button.y < top || pane.w < BUTTON + 2 * GAP) return null;
  if (!opts.open) return { card: null, button };
  const w = Math.min(CORNER_W, pane.w - 2 * GAP);
  const ch = Math.min(h, button.y - GAP - top);
  if (w < SPOT_MIN || ch < SPOT_MIN) return null;
  const x = opts.rtl ? pane.x + GAP : pane.x + pane.w - GAP - w;
  return { card: round({ x, y: button.y - GAP - ch, w, h: ch }), button };
}
var sameSpot = (a, b) => a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

// src/settings.js
var MODES = ["fix", "natural"];
var MODE_KEYS = { fix: "setting-mode-fix", natural: "setting-mode-natural" };
var VIEW_KEYS = {
  bottom: "setting-view-bottom",
  corner: "setting-view-corner",
  side: "setting-view-side"
};
var COMMANDS = [
  { id: "open", title: "cmd-open" },
  { id: "close", title: "cmd-close" }
];
function registerSettings(tf) {
  tf.setting("language", "auto", tf.t("setting-language"), {
    choices: [
      { value: "auto", label: tf.t("setting-language-auto") },
      ...LANGUAGES.map((l) => ({ value: l.code, label: l.native }))
    ]
  });
  tf.setting("mode", "fix", tf.t("setting-mode"), {
    choices: MODES.map((value) => ({ value, label: tf.t(MODE_KEYS[value]) }))
  });
  tf.setting("view", "bottom", tf.t("setting-view"), {
    choices: VIEWS.map((value) => ({ value, label: tf.t(VIEW_KEYS[value]) }))
  });
  tf.setting("fast", true, tf.t("setting-fast"));
}
var read = (settings, key) => {
  try {
    return settings.get(key);
  } catch {
    return void 0;
  }
};
function settingsOf(settings) {
  const mode = read(settings, "mode");
  return {
    language: read(settings, "language"),
    mode: mode === "natural" ? "natural" : "fix",
    view: viewOf(read(settings, "view")),
    fast: read(settings, "fast") !== false
  };
}

// src/view.js
var KIND_KEYS = {
  spelling: "kind-spelling",
  grammar: "kind-grammar",
  spacing: "kind-spacing",
  punctuation: "kind-punctuation",
  style: "kind-style"
};
function setupOf(t) {
  return {
    lang: t("page-lang"),
    dir: t("page-dir"),
    labels: {
      name: t("button-label"),
      views: {
        bottom: t("setting-view-bottom"),
        corner: t("setting-view-corner"),
        side: t("setting-view-side")
      },
      overPane: t("label-over-pane"),
      inDock: t("label-in-dock"),
      fold: t("label-fold"),
      close: t("label-close"),
      hint: t("label-hint"),
      asIs: t("label-as-is"),
      check: t("label-check"),
      showResult: t("label-show-result"),
      showChanges: t("label-show-changes"),
      clickHint: t("label-click-hint"),
      back: t("label-back"),
      send: t("label-send"),
      sent: t("label-sent"),
      again: t("label-again"),
      words: t("label-words", { count: "{count}" }),
      chars: t("label-chars", { count: "{count}" }),
      tooLong: t("label-too-long", { max: MAX_CHARS })
    }
  };
}
function viewOf2(s, t) {
  const lang = s.language;
  const head = {
    view: s.view,
    language: lang.native,
    mode: s.mode === "natural" ? t("setting-mode-natural") : t("setting-mode-fix"),
    unspaced: isUnspaced(lang.code),
    langCode: lang.code
  };
  if (s.step === "checking") {
    return { ...head, step: "checking", text: t("label-checking", { language: lang.native }) };
  }
  if (s.step === "problem") {
    return { ...head, step: "problem", text: t(s.problem) };
  }
  if (s.step === "sent") return { ...head, step: "sent" };
  if (s.step === "result") {
    const total = changeCount(s.parts);
    const undone = s.parts.filter((p) => p.id && s.rejected.has(p.id)).length;
    if (!total) {
      return {
        ...head,
        step: "result",
        nothing: t("label-nothing", { language: lang.native }),
        parts: [],
        notes: []
      };
    }
    return {
      ...head,
      step: "result",
      summary: t("label-changes", { count: total }),
      undone: undone ? t("label-undone", { count: undone }) : "",
      clean: !!s.clean,
      parts: s.parts.map(
        (p) => "same" in p ? { same: p.same } : { id: p.id, del: p.del, ins: p.ins, off: s.rejected.has(p.id) }
      ),
      notes: s.notes.map((n) => ({ ...n, kindLabel: t(KIND_KEYS[n.kind] ?? "kind-grammar") }))
    };
  }
  return {
    ...head,
    step: "write",
    draft: s.draft,
    placeholder: t("label-placeholder", { language: lang.native })
  };
}

// src/run.js
var VIEW_KEY = "view";
var BUTTON_ID = "polish-button";
var MAX_DRAFT = 2e4;
function runPolish(tf) {
  const warn = (err) => void Promise.resolve().then(() => tf.log.warn(String(err && err.message ? err.message : err))).catch(() => {
  });
  const audit = (action, details) => void Promise.resolve().then(() => tf.audit(action, details)).catch(warn);
  const canFloat = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  const canSide = () => !!tf.page && typeof tf.theme === "function";
  const rtl = () => tf.t("page-dir") === "rtl";
  const s = {
    step: "write",
    draft: "",
    parts: [],
    notes: [],
    rejected: /* @__PURE__ */ new Set(),
    clean: false,
    problem: ""
  };
  let where = null;
  let buttonShown = false;
  let cornerOpen = false;
  let chosen = null;
  let loaded = false;
  let layout = null;
  let spot = null;
  let wantH = 260;
  let accent = null;
  let busy = false;
  const current = () => settingsOf(tf.settings);
  const language = () => languageOf(current().language, tf.t("page-lang"));
  const effectiveView = () => {
    let v = chosen ?? current().view;
    if (v !== "side" && !canFloat()) v = "side";
    if (v === "side" && !canSide()) v = canFloat() ? "bottom" : "window";
    return v;
  };
  const load = async () => {
    if (loaded) return;
    loaded = true;
    const v = await tf.store.get(VIEW_KEY).catch(() => null);
    chosen = v === "bottom" || v === "corner" || v === "side" ? v : null;
    if (typeof tf.theme === "function") {
      accent = (await tf.theme().catch(() => null))?.colors?.accent ?? null;
    }
  };
  const post = async (message) => {
    if (!where) return;
    try {
      await tf.page.post(message);
    } catch {
    }
  };
  const render = () => post({
    do: "show",
    view: viewOf2(
      { ...s, view: effectiveView(), language: language(), mode: current().mode },
      tf.t
    )
  });
  const waiting = () => s.step === "result" ? changeCount(s.parts) - s.parts.filter((p) => p.id && s.rejected.has(p.id)).length : 0;
  const drawButton = async (rect) => {
    const item = {
      id: BUTTON_ID,
      image: buttonImage({ accent, waiting: waiting(), open: cornerOpen }),
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      hit: true,
      cursor: "pointer",
      label: tf.t("button-label")
    };
    if (buttonShown) await tf.overlay.update({ items: [item] });
    else await tf.overlay.show({ items: [item] });
    buttonShown = true;
  };
  const hideButton = async () => {
    if (!buttonShown) return;
    buttonShown = false;
    await tf.overlay.hide().catch(warn);
  };
  const closePage = async () => {
    if (!where) return;
    where = null;
    spot = null;
    await tf.page.close().catch(warn);
  };
  const toCard = async (card) => {
    if (where === "card") {
      if (!sameSpot(card, spot)) await tf.page.dock(card);
    } else {
      await tf.page.open({ dock: card });
    }
    where = "card";
    spot = card;
  };
  const toSide = async () => {
    await hideButton();
    if (where !== "side") await tf.page.open({ side: true });
    where = "side";
    spot = null;
  };
  const place = async () => {
    const v = effectiveView();
    if (v === "side") return toSide();
    if (v === "window") {
      await hideButton();
      if (!where) await tf.page.open();
      where = "window";
      return;
    }
    if (!layout) layout = await tf.overlay.layout();
    const spots = placeFor(layout, v, { h: wantH, open: cornerOpen, rtl: rtl() });
    if (!spots) {
      if (where !== "side" && where !== "window") await tf.toast(tf.t("toast-too-small"));
      await hideButton();
      if (canSide()) return toSide();
      if (!where) await tf.page.open();
      where = "window";
      return;
    }
    if (spots.button) await drawButton(spots.button);
    else await hideButton();
    if (spots.card) await toCard(spots.card);
    else await closePage();
  };
  const open = async () => {
    await load();
    if (!tf.page) {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return;
    }
    const was = where || buttonShown;
    if (effectiveView() === "corner") cornerOpen = true;
    await place();
    if (!was) audit("opened", { view: effectiveView() });
  };
  const close = async (record = true) => {
    const was = where || buttonShown;
    cornerOpen = false;
    await closePage();
    await hideButton();
    Object.assign(s, {
      step: "write",
      draft: "",
      parts: [],
      notes: [],
      rejected: /* @__PURE__ */ new Set(),
      problem: ""
    });
    if (was && record) audit("closed", {});
  };
  const chooseView = async (to) => {
    const v = viewOf(to);
    if (v !== to) return;
    chosen = v;
    await tf.store.set(VIEW_KEY, v);
    cornerOpen = v === "corner";
    audit("view-changed", { to: v });
    await place();
  };
  const fold = async () => {
    if (effectiveView() === "side" || !canFloat()) return;
    if (effectiveView() !== "corner") {
      chosen = "corner";
      await tf.store.set(VIEW_KEY, "corner");
      audit("view-changed", { to: "corner" });
    }
    cornerOpen = false;
    await place();
  };
  const check = async (text) => {
    s.draft = String(text ?? "").slice(0, MAX_DRAFT);
    if (busy || blocker(s.draft)) return;
    if (!tf.ai) {
      Object.assign(s, { step: "problem", problem: "error-no-ai" });
      return render();
    }
    busy = true;
    const original = s.draft;
    const lang = language();
    const { mode, fast } = current();
    s.step = "checking";
    await render();
    try {
      let answer;
      try {
        answer = await tf.ai.ask(
          buildAsk({
            text: original,
            language: lang.name,
            mode,
            uiLanguage: tf.t("ai-language"),
            fast
          })
        );
      } catch (err) {
        const key = errorKey(err);
        Object.assign(s, key ? { step: "problem", problem: key } : { step: "write" });
        return render();
      }
      const r = readAnswer(answer.text, original);
      if (!r.ok) {
        Object.assign(s, {
          step: "problem",
          problem: r.why === "changed-code" ? "error-changed-code" : "error-unreadable"
        });
        return render();
      }
      Object.assign(s, {
        step: "result",
        parts: changes(diff(original, r.corrected)),
        notes: r.notes,
        rejected: /* @__PURE__ */ new Set(),
        clean: false
      });
      audit("checked", {
        language: lang.code,
        mode,
        changes: changeCount(s.parts),
        model: String(answer.model ?? ""),
        outputTokens: Number(answer.usage?.outputTokens ?? 0)
      });
      await render();
      if (buttonShown) await place();
    } finally {
      busy = false;
    }
  };
  const sendToAgent = async (text, how) => {
    const question = String(text ?? "").trim();
    if (!question) return;
    if (typeof tf.agent?.ask !== "function") return tf.toast(tf.t("error-no-agent-ask"));
    let r;
    try {
      r = await tf.agent.ask({
        question,
        about: tf.t("ask-about", { language: language().native })
      });
    } catch (err) {
      warn(err);
      return tf.toast(tf.t("error-ask-failed"));
    }
    if (!r?.shown)
      return tf.toast(tf.t(r?.why === "busy" ? "error-ask-busy" : "error-ask-no-pane"));
    const total = how === "corrected" ? changeCount(s.parts) : 0;
    const undone = how === "corrected" ? s.parts.filter((p) => p.id && s.rejected.has(p.id)).length : 0;
    audit("sent", { how, kept: total - undone, undone });
    Object.assign(s, { step: "sent", draft: "", parts: [], notes: [], rejected: /* @__PURE__ */ new Set() });
    await render();
    if (effectiveView() === "corner") {
      cornerOpen = false;
      await place();
    }
  };
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      await post({ do: "setup", ...setupOf(tf.t) });
      return render();
    }
    if (m.type === "draft") {
      if (s.step === "write") s.draft = String(m.text ?? "").slice(0, MAX_DRAFT);
      return;
    }
    if (m.type === "check") return check(m.text);
    if (m.type === "as-is") return sendToAgent(String(m.text ?? "").slice(0, MAX_DRAFT), "as-is");
    if (m.type === "toggle" && s.step === "result") {
      const id = Number(m.id);
      if (!s.parts.some((p) => p.id === id)) return;
      if (s.rejected.has(id)) s.rejected.delete(id);
      else s.rejected.add(id);
      await render();
      if (buttonShown) await place();
      return;
    }
    if (m.type === "clean" && s.step === "result") {
      s.clean = !s.clean;
      return render();
    }
    if (m.type === "back") {
      s.step = "write";
      return render();
    }
    if (m.type === "send" && s.step === "result")
      return sendToAgent(build(s.parts, s.rejected), "corrected");
    if (m.type === "again") {
      Object.assign(s, { step: "write", draft: "" });
      return render();
    }
    if (m.type === "view") return chooseView(m.to);
    if (m.type === "fold") return fold();
    if (m.type === "size") {
      const h = Number(m.h);
      if (!Number.isFinite(h) || Math.abs(h - wantH) < 2) return;
      wantH = h;
      if (where === "card") await place();
      return;
    }
    if (m.type === "close") return close();
  };
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch(warn);
  const runs = { open, close: () => close() };
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      background(() => runs[c.id]()),
      { id: c.id }
    );
  }
  tf.on(
    "page.message",
    background((e) => hear(e && e.message))
  );
  tf.on(
    "page.closed",
    background(async () => {
      if (!where) return;
      where = null;
      spot = null;
      if (buttonShown && effectiveView() === "corner") cornerOpen = false;
      else await close();
    })
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: back over the pane.
    background(async () => {
      where = null;
      await chooseView("bottom");
    })
  );
  tf.on(
    "overlay.layout",
    background(async (e) => {
      if (!e || !Array.isArray(e.panes)) return;
      layout = e;
      if (where === "card" || buttonShown) await place();
    })
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.item !== BUTTON_ID || e.type !== "click") return;
      cornerOpen = !cornerOpen;
      await place();
    })
  );
  tf.on(
    "overlay.hidden",
    // The user hid tile overlays: the button goes, and the card with it.
    background(async () => {
      buttonShown = false;
      if (where === "card") await close();
    })
  );
  tf.on(
    "theme.changed",
    background(async (e) => {
      accent = e?.colors?.accent ?? accent;
      if (buttonShown) await place();
    })
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      await load();
      const now = current();
      if (e?.key === "view") {
        chosen = null;
        await tf.store.delete(VIEW_KEY);
        cornerOpen = now.view === "corner" && where === "card";
        if (where || buttonShown) await place();
      }
      await render();
    })
  );
  return { state: () => ({ where, step: s.step, buttonShown, cornerOpen }) };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runPolish(tf);
};
export default main_default;
