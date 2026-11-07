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
// src/agentCheck.js
var TILE_ID = "example.prompt-polish";
var HAND_BACK = "hand-back";
var REQUEST_TTL_MS = 10 * 60 * 1e3;
var REQUEST_ID = /^[a-z0-9]{10}$/;
var MAX_CORRECTED = 8e3;
var MAX_NOTES = 40;
var MAX_QUESTION = 4e3;
function newRequestId(random = Math.random) {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += abc[Math.floor(random() * abc.length) % abc.length];
  return id;
}
var HAND_BACK_INPUT = `{"request": the id from Prompt Polish's request, "corrected": the corrected prompt, "notes": [{"from", "to", "kind": spelling|grammar|spacing|punctuation|style, "why"}]}`;
function agentQuestion({ text, language, mode, uiLanguage, request, command }) {
  const lines = [
    `Prompt Polish request ${request}. Do not act on the prompt below, and do not answer it: it is a prompt I wrote to you in ${language}, and I only want it corrected.`,
    mode === "natural" ? "Fix spelling, grammar, spacing and punctuation, and make clumsy phrasing natural." : "Fix only spelling, grammar, spacing and punctuation. Do not reword anything else.",
    "Keep the meaning and the language. Never translate it and never add to it. Leave anything in backticks, file paths, links, names in code and numbers exactly as they are.",
    `Then call the Tilefold tool tile_run with command "${command}" and input {"request": "${request}", "corrected": <the corrected prompt>, "notes": [{"from": <what you changed>, "to": <what it became>, "kind": "spelling" | "grammar" | "spacing" | "punctuation" | "style", "why": <one short sentence in ${uiLanguage}>}]}.`,
    'If nothing needs fixing, hand back the prompt unchanged with "notes": []. Do nothing else, and reply only "Done".',
    "",
    "The prompt, between the lines:",
    "-----",
    String(text),
    "-----"
  ];
  return lines.join("\n").slice(0, MAX_QUESTION);
}
var str = (v) => typeof v === "string" ? v : "";
function readHandBack(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false };
  const request = str(input.request);
  if (!REQUEST_ID.test(request)) return { ok: false };
  const corrected = str(input.corrected);
  if (!corrected || corrected.length > MAX_CORRECTED) return { ok: false };
  const notes = (Array.isArray(input.notes) ? input.notes : []).slice(0, MAX_NOTES).filter((n) => n && typeof n === "object" && !Array.isArray(n)).map((n) => ({ from: str(n.from), to: str(n.to), kind: str(n.kind), why: str(n.why) }));
  return { ok: true, request, answer: JSON.stringify({ corrected, notes }) };
}
function createPending(now = Date.now) {
  const byId = /* @__PURE__ */ new Map();
  const sweep = () => {
    for (const [id, e] of byId) if (now() - e.at > REQUEST_TTL_MS) byId.delete(id);
  };
  const dropFor = (pane) => {
    for (const [id, e] of byId) if (e.pane === pane) byId.delete(id);
  };
  return {
    add(id, entry) {
      sweep();
      dropFor(entry.pane);
      byId.set(id, { ...entry, at: now() });
    },
    take(id) {
      sweep();
      const e = byId.get(id) ?? null;
      byId.delete(id);
      return e;
    },
    dropFor,
    has(pane) {
      sweep();
      return [...byId.values()].some((e) => e.pane === pane);
    }
  };
}

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
var MAX_NOTES2 = 40;
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
  const notes = (Array.isArray(json.notes) ? json.notes : []).slice(0, MAX_NOTES2).map(readNote).filter(Boolean);
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

// src/agentRun.js
var HELPER_WHY = {
  busy: "error-helper-busy",
  "you-are-typing": "error-helper-typing",
  "not-started": "error-helper-not-started"
};
function createAgentRun(tf, deps) {
  const { sessions, render, refreshButton, audit, warn, language, mode, helperAgent } = deps;
  const hasHelper = () => typeof tf.agent?.helper === "function";
  const pending = createPending();
  const problem = (id, s, key) => {
    Object.assign(s, { step: "problem", problem: key });
    return render(id);
  };
  const viaHelper = async (id, s, entry, question, request) => {
    pending.add(request, entry);
    Object.assign(s, { step: "agent", helper: true, draft: entry.original, problem: "" });
    await render(id);
    let r;
    try {
      r = await tf.agent.helper({
        agent: helperAgent(),
        question,
        about: tf.t("agent-check-about")
      });
    } catch (err) {
      warn(err);
      r = null;
    }
    if (s.step !== "agent" || !pending.has(id)) return;
    if (!r?.sent) {
      pending.dropFor(id);
      return problem(id, s, HELPER_WHY[r?.why] ?? "error-helper-failed");
    }
    audit("agent-asked", {
      language: entry.language,
      mode: entry.mode,
      helper: true,
      opened: !!r.opened
    });
  };
  const check = async (id, original) => {
    const s = sessions.get(id);
    if (!s) return;
    if (!hasHelper() && typeof tf.agent?.ask !== "function")
      return problem(id, s, "error-no-agent-ask");
    const request = newRequestId();
    const lang = language();
    const m = mode();
    const question = agentQuestion({
      text: original,
      language: lang.name,
      mode: m,
      uiLanguage: tf.t("ai-language"),
      request,
      command: `${TILE_ID}.${HAND_BACK}`
    });
    const entry = { pane: id, original, language: lang.code, mode: m };
    if (hasHelper()) return viaHelper(id, s, entry, question, request);
    let r;
    try {
      r = await tf.agent.ask({ question, about: tf.t("agent-check-about") });
    } catch (err) {
      warn(err);
      return problem(id, s, "error-ask-failed");
    }
    if (!r?.shown)
      return problem(id, s, r?.why === "busy" ? "error-ask-busy" : "error-ask-no-pane");
    pending.add(request, entry);
    Object.assign(s, { step: "agent", helper: false, draft: original, problem: "" });
    audit("agent-asked", { language: lang.code, mode: m });
    await render(id);
  };
  const handBack = async (input) => {
    if (input === null || input === void 0) throw new Error("run by agents only, with input");
    const h = readHandBack(input);
    if (!h.ok) {
      throw new Error(
        'input: {"request": the id from the request, "corrected": the corrected prompt, "notes": [{"from", "to", "kind", "why"}]}'
      );
    }
    const e = pending.take(h.request);
    if (!e) {
      throw new Error(
        "Prompt Polish isn't waiting for this request: it was handed back already, cancelled, or is over 10 minutes old"
      );
    }
    const s = sessions.get(e.pane);
    if (!s || s.step !== "agent") throw new Error("the user closed this prompt in Prompt Polish");
    const r = readAnswer(h.answer, e.original);
    if (!r.ok) {
      const changedCode = r.why === "changed-code";
      await problem(e.pane, s, changedCode ? "error-agent-changed-code" : "error-agent-unreadable");
      throw new Error(
        changedCode ? "the correction changed code, a file path or a link, so it was not shown; the user can ask again" : "the correction could not be read, so it was not shown; the user can ask again"
      );
    }
    Object.assign(s, {
      step: "result",
      parts: changes(diff(e.original, r.corrected)),
      notes: r.notes,
      rejected: /* @__PURE__ */ new Set(),
      clean: false
    });
    const count = changeCount(s.parts);
    audit("checked", { language: e.language, mode: e.mode, changes: count, checker: "agent" });
    await render(e.pane);
    await refreshButton();
    return { shown: true, changes: count };
  };
  const cancel = async (id) => {
    pending.dropFor(id);
    const s = sessions.get(id);
    if (s && s.step === "agent") s.step = "write";
    await render(id);
  };
  const forget = (id) => pending.dropFor(id);
  const takeOver = async (id, original) => {
    if (!hasHelper()) return false;
    await check(id, original);
    return true;
  };
  return { check, handBack, cancel, forget, takeOver };
}

// src/claudeRun.js
function createClaudeRun(tf, deps) {
  const { sessions, render, refreshButton, audit, language, mode, fast, noKey } = deps;
  const check = async (id, original) => {
    const s = sessions.get(id);
    if (!s) return;
    if (!tf.ai && await noKey?.(id, original)) return;
    if (!tf.ai) {
      Object.assign(s, { step: "problem", problem: "error-no-ai" });
      return render(id);
    }
    s.busy = true;
    const lang = language();
    const m = mode();
    s.step = "checking";
    await render(id);
    try {
      let answer;
      try {
        answer = await tf.ai.ask(
          buildAsk({
            text: original,
            language: lang.name,
            mode: m,
            uiLanguage: tf.t("ai-language"),
            fast: fast()
          })
        );
      } catch (err) {
        const key = errorKey(err);
        if (key === "error-no-key" && await noKey?.(id, original)) return;
        Object.assign(s, key ? { step: "problem", problem: key } : { step: "write" });
        return render(id);
      }
      const r = readAnswer(answer.text, original);
      if (!r.ok) {
        Object.assign(s, {
          step: "problem",
          problem: r.why === "changed-code" ? "error-changed-code" : "error-unreadable"
        });
        return render(id);
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
        mode: m,
        changes: changeCount(s.parts),
        model: String(answer.model ?? ""),
        outputTokens: Number(answer.usage?.outputTokens ?? 0)
      });
      await render(id);
      await refreshButton();
    } finally {
      s.busy = false;
    }
  };
  return { check };
}

// src/sessions.js
var MAX_SESSIONS = 24;
function freshSession() {
  return {
    open: false,
    step: "write",
    draft: "",
    parts: [],
    notes: [],
    rejected: /* @__PURE__ */ new Set(),
    clean: false,
    problem: "",
    busy: false,
    // A click on ✦ Polish in the agent input box waiting for Use or Keep mine.
    input: null
  };
}
function resetSession(s) {
  Object.assign(s, {
    step: "write",
    draft: "",
    parts: [],
    notes: [],
    rejected: /* @__PURE__ */ new Set(),
    clean: false,
    problem: ""
  });
  return s;
}
function focusedId(layout) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const p = panes.find((x) => x && x.focused && typeof x.id === "string");
  return p ? p.id : null;
}
function createSessions() {
  const byPane = /* @__PURE__ */ new Map();
  const touch = (id, s) => {
    byPane.delete(id);
    byPane.set(id, s);
    return s;
  };
  return {
    get(id) {
      return typeof id === "string" ? byPane.get(id) ?? null : null;
    },
    ensure(id) {
      if (typeof id !== "string" || !id) return null;
      const s = byPane.get(id);
      if (s) return touch(id, s);
      for (const [old, o] of byPane) {
        if (byPane.size < MAX_SESSIONS) break;
        if (!o.busy) byPane.delete(old);
      }
      return touch(id, freshSession());
    },
    drop(id) {
      byPane.delete(id);
    },
    size: () => byPane.size,
    ids: () => [...byPane.keys()]
  };
}

// src/inputAction.js
var ACTION_ID = "polish";
var WHY_KEYS = {
  changed: "error-input-changed",
  expired: "error-input-expired",
  gone: "error-input-gone"
};
function paneAt(layout, spot) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  if (spot && [spot.x, spot.y, spot.w, spot.h].every(Number.isFinite)) {
    const cx = spot.x + spot.w / 2;
    const cy = spot.y + spot.h / 2;
    const hit = panes.find((p) => {
      const r = p?.composer;
      return r && cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
    });
    if (hit && typeof hit.id === "string") return hit.id;
  }
  const focused = panes.find((p) => p?.focused && typeof p.id === "string");
  return focused ? focused.id : null;
}
function createInputAction(tf, deps) {
  const { sessions, render, audit, warn, layout, openFor, check, fold, noPane } = deps;
  const available = () => typeof tf.input?.action === "function";
  const register = () => {
    if (available()) tf.input.action({ id: ACTION_ID, label: tf.t("action-label") });
  };
  const release = async (id) => {
    const s = sessions.get(id);
    const request = s?.input?.request;
    if (!request) return;
    s.input = null;
    await tf.input.release(request).catch(warn);
  };
  const releaseAll = async () => {
    for (const id of sessions.ids()) await release(id);
  };
  const cancelled = async (e) => {
    const request = e && typeof e.request === "string" ? e.request : null;
    const id = request && sessions.ids().find((p) => sessions.get(p)?.input?.request === request);
    if (!id) return;
    const s = sessions.get(id);
    s.input = null;
    resetSession(s);
    await fold(id);
  };
  const clicked = async (e) => {
    if (!e || e.action !== ACTION_ID || typeof e.request !== "string") return;
    const id = paneAt(await layout(), e.spot) ?? noPane;
    await release(id);
    const s = sessions.ensure(id);
    resetSession(s);
    s.input = { request: e.request };
    s.draft = String(e.text ?? "");
    await openFor(id);
    await check(id, s.draft);
  };
  const use = async (id) => {
    const s = sessions.get(id);
    const request = s?.input?.request;
    if (!s || !request || s.step !== "result") return;
    const total = changeCount(s.parts);
    const undone = s.parts.filter((p) => p.id && s.rejected.has(p.id)).length;
    s.input = null;
    let r;
    try {
      r = await tf.input.replace(request, { text: build(s.parts, s.rejected) });
    } catch (err) {
      warn(err);
      r = { done: false, why: "gone" };
    }
    if (r?.why === "stopped") return;
    if (r?.done) {
      audit("used", { kept: total - undone, undone });
      resetSession(s);
      await fold(id);
      return;
    }
    Object.assign(s, { step: "problem", problem: WHY_KEYS[r?.why] ?? WHY_KEYS.gone });
    await render(id);
  };
  const keep = async (id) => {
    const s = sessions.get(id);
    if (!s?.input) return;
    await release(id);
    resetSession(s);
    await fold(id);
  };
  return { available, register, clicked, cancelled, use, keep, release, releaseAll };
}

// src/sendToAgent.js
function createSendToAgent(tf, deps) {
  const { sessions, render, audit, warn, language, afterSend } = deps;
  return async (id, text, how) => {
    const s = sessions.get(id);
    const question = String(text ?? "").trim();
    if (!s || !question) return;
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
    resetSession(s).step = "sent";
    await render(id);
    await afterSend(s);
  };
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
var VIEWS = ["corner", "bottom", "side"];
var SPOT_MIN = 120;
var SPOT_MAX = 2e3;
var GAP = 12;
var BUTTON = 36;
var BUTTON_H = 26;
var CORNER_W = 420;
var MAX_H = 440;
var viewOf = (value) => VIEWS.includes(value) ? value : "corner";
function focusedPane(layout, paneId) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const ok = panes.filter((p) => [p.x, p.y, p.w, p.h].every(Number.isFinite));
  if (paneId !== void 0 && paneId !== null) return ok.find((p) => p.id === paneId) ?? null;
  return ok.find((p) => p.focused) ?? ok[0] ?? null;
}
function placeFor(layout, view, opts = {}) {
  const h = Math.min(MAX_H, Math.max(SPOT_MIN, Number.isFinite(opts.h) ? opts.h : 260));
  const pane = focusedPane(layout, opts.pane);
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
  const bw = Number.isFinite(opts.bw) ? opts.bw : BUTTON;
  const bx = opts.rtl ? pane.x + GAP : pane.x + pane.w - GAP - bw;
  const button = round({ x: bx, y: floor - BUTTON_H, w: bw, h: BUTTON_H });
  if (button.y < top || pane.w < bw + 2 * GAP) return null;
  const shown = opts.noPill ? null : button;
  if (!opts.open) return { card: null, button: shown };
  const w = Math.min(CORNER_W, pane.w - 2 * GAP);
  const ch = Math.min(h, button.y - GAP - top);
  if (w < SPOT_MIN || ch < SPOT_MIN) return null;
  const x = opts.rtl ? pane.x + GAP : pane.x + pane.w - GAP - w;
  return { card: round({ x, y: button.y - GAP - ch, w, h: ch }), button: shown };
}
var sameSpot = (a, b) => a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

// src/settings.js
var MODES = ["fix", "natural"];
var CHECKERS = ["claude", "agent"];
var HELPER_AGENTS = [
  { value: "claude", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini CLI" },
  { value: "cursor", label: "Cursor Agent" },
  { value: "agy", label: "Antigravity CLI" },
  { value: "opencode", label: "OpenCode" }
];
var MODE_KEYS = { fix: "setting-mode-fix", natural: "setting-mode-natural" };
var CHECKER_KEYS = { claude: "setting-checker-claude", agent: "setting-checker-agent" };
var VIEW_KEYS = {
  corner: "setting-view-corner",
  bottom: "setting-view-bottom",
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
  tf.setting("view", "corner", tf.t("setting-view"), {
    choices: VIEWS.map((value) => ({ value, label: tf.t(VIEW_KEYS[value]) }))
  });
  tf.setting("checker", "claude", tf.t("setting-checker"), {
    choices: CHECKERS.map((value) => ({ value, label: tf.t(CHECKER_KEYS[value]) }))
  });
  tf.setting("helperAgent", "claude", tf.t("setting-helper-agent"), {
    choices: HELPER_AGENTS.map((a) => ({ ...a }))
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
    fast: read(settings, "fast") !== false,
    checker: read(settings, "checker") === "agent" ? "agent" : "claude",
    helperAgent: helperAgentOf(read(settings, "helperAgent"))
  };
}
var helperAgentOf = (v) => HELPER_AGENTS.some((a) => a.value === v) ? v : HELPER_AGENTS[0].value;
var helperAgentName = (v) => HELPER_AGENTS.find((a) => a.value === helperAgentOf(v)).label;
var cardSettings = (c) => ({ mode: c.mode, helperName: helperAgentName(c.helperAgent) });

// src/button.js
var PILL_H = 26;
var PILL_MIN_W = 64;
var PILL_MAX_W = 160;
function colorOr(value, fallback) {
  const v = String(value ?? "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d\s.,%]+\)$/i.test(v) ? v : fallback;
}
var xml = (s) => String(s).replace(
  /[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]
);
var textWidth = (label) => [...String(label)].reduce((w, ch) => w + (/[ᄀ-ￜ]/.test(ch) ? 12.5 : 7), 0);
var pillWidth = (label) => Math.round(Math.min(PILL_MAX_W, Math.max(PILL_MIN_W, 34 + textWidth(label))));
function base64(text) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function buttonImage({
  label = "Polish",
  w,
  accent,
  waiting = 0,
  open = false,
  rtl = false
} = {}) {
  const width = Number.isFinite(w) ? w : pillWidth(label);
  const fill = colorOr(accent, "#7c5cff");
  const n = Math.max(0, Math.min(99, Math.floor(Number(waiting) || 0)));
  const h = PILL_H;
  const sx = rtl ? width - 16 : 16;
  const tx = rtl ? width - 28 : 28;
  const ring = open ? `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${h - 1.5}" rx="${(h - 1.5) / 2}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".8"/>` : "";
  const mark = n > 0 ? `<circle cx="${sx}" cy="${h / 2}" r="7.5" fill="#fff"/><text x="${sx}" y="${h / 2 + 3.5}" font-size="10" font-weight="700" text-anchor="middle" fill="${fill}" font-family="system-ui,sans-serif">${n}</text>` : `<path d="M${sx} 7.5l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" fill="#fff"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}"><rect width="${width}" height="${h}" rx="${h / 2}" fill="${fill}"/>${ring}` + mark + `<text x="${tx}" y="17" font-size="12" font-weight="600" text-anchor="${rtl ? "end" : "start"}" fill="#fff" font-family="system-ui,sans-serif">${xml(label)}</text></svg>`;
  return `data:image/svg+xml;base64,${base64(svg)}`;
}

// src/show.js
var BUTTON_ID = "polish-button";
function createStage(tf, o) {
  let where = null;
  let spot = null;
  let buttonShown = false;
  let layout = null;
  let focus = null;
  let wantH = 260;
  let accent = null;
  let toldSmall = false;
  const rtl = () => tf.t("page-dir") === "rtl";
  const closePage = async () => {
    if (!where) return;
    where = null;
    spot = null;
    await tf.page.close().catch(o.warn);
  };
  const hideButton = async () => {
    if (!buttonShown) return;
    buttonShown = false;
    await tf.overlay.hide().catch(o.warn);
  };
  const pill = () => {
    const label = tf.t("pill-label");
    return { label, w: pillWidth(label) };
  };
  const drawButton = async (rect, waiting, open) => {
    const item = {
      id: BUTTON_ID,
      image: buttonImage({ ...pill(), accent, waiting, open, rtl: rtl() }),
      ...rect,
      hit: true,
      cursor: "pointer",
      label: tf.t("button-label")
    };
    if (buttonShown) await tf.overlay.update({ items: [item] });
    else await tf.overlay.show({ items: [item] });
    buttonShown = true;
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
  const toWindow = async () => {
    await hideButton();
    if (!where) await tf.page.open();
    where = "window";
    spot = null;
  };
  const ensureLayout = async () => {
    if (layout || !tf.overlay) return;
    const l = await tf.overlay.layout().catch(() => null);
    if (l) setLayout(l);
  };
  function setLayout(l) {
    layout = l;
    focus = focusedId(l) ?? focus;
  }
  return {
    setLayout,
    ensureLayout,
    focus: () => focus,
    layout: () => layout,
    /** The pane a click in its agent input box came from. */
    focusOn: (id) => void (focus = id ?? focus),
    where: () => where,
    buttonShown: () => buttonShown,
    setAccent: (a) => void (accent = a ?? accent),
    setHeight(h) {
      if (!Number.isFinite(h) || Math.abs(h - wantH) < 2) return false;
      wantH = h;
      return where === "card";
    },
    /** The overlay was hidden by the user: the button is gone. */
    lostOverlay: () => void (buttonShown = false),
    /** The page was closed from elsewhere. */
    lostPage() {
      where = null;
      spot = null;
    },
    /**
     * Shows what should be: `view`, whether the focused pane's card is open,
     * whether anything shows at all (`active`), and the button's badge.
     * Returns where the page ended up.
     */
    async show({ view, open, active, waiting = 0 }) {
      if (!active) {
        await closePage();
        await hideButton();
        return where;
      }
      if (view === "side") {
        await toSide();
        return where;
      }
      if (view === "window") {
        await toWindow();
        return where;
      }
      await ensureLayout();
      if (view === "bottom" && !open) {
        await hideButton();
        await closePage();
        return where;
      }
      const spots = placeFor(layout, view, {
        h: wantH,
        open,
        rtl: rtl(),
        pane: focus,
        bw: pill().w,
        noPill: !!(layout?.panes ?? []).find((p) => p.id === focus)?.agentInput
      });
      if (!spots) {
        const hasPane = (layout?.panes ?? []).some((p) => p.id === focus);
        await hideButton();
        if (!hasPane) {
          await closePage();
          return where;
        }
        if (!toldSmall) {
          toldSmall = true;
          await tf.toast(tf.t("toast-too-small"));
        }
        if (o.canSide()) await toSide();
        else await toWindow();
        return where;
      }
      toldSmall = false;
      if (spots.button) await drawButton(spots.button, waiting, open);
      else await hideButton();
      if (spots.card) await toCard(spots.card);
      else await closePage();
      return where;
    }
  };
}

// src/view.js
var AGENT_CAN_HELP = /* @__PURE__ */ new Set(["error-no-ai", "error-no-key"]);
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
      cancel: t("label-cancel"),
      askAgent: t("label-ask-agent"),
      use: t("label-use"),
      keep: t("label-keep"),
      agentHint: t("label-agent-hint"),
      words: t("label-words", { count: "{count}" }),
      chars: t("label-chars", { count: "{count}" }),
      tooLong: t("label-too-long", { max: MAX_CHARS })
    }
  };
}
function viewOf2(s, t) {
  const lang = s.language;
  const head = {
    // Whose prompt this is: the page sends it back with what the user does.
    pane: typeof s.pane === "string" ? s.pane : null,
    view: s.view,
    language: lang.native,
    mode: s.mode === "natural" ? t("setting-mode-natural") : t("setting-mode-fix"),
    unspaced: isUnspaced(lang.code),
    langCode: lang.code,
    // From the agent input box: Use puts the result back there.
    input: !!s.input
  };
  if (s.step === "checking") {
    return { ...head, step: "checking", text: t("label-checking", { language: lang.native }) };
  }
  if (s.step === "agent") {
    const text = s.helper ? t("label-helper-waiting", { language: lang.native, agent: s.helperName ?? "" }) : t("label-agent-waiting", { language: lang.native });
    return { ...head, step: "agent", text };
  }
  if (s.step === "problem") {
    const offer = AGENT_CAN_HELP.has(s.problem) && !!String(s.draft ?? "").trim();
    return { ...head, step: "problem", text: t(s.problem), askAgent: offer };
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
var MAX_DRAFT = 2e4;
var NO_PANE = "window";
function runPolish(tf) {
  const warn = (err) => void Promise.resolve().then(() => tf.log.warn(String(err && err.message ? err.message : err))).catch(() => {
  });
  const audit = (action, details) => void Promise.resolve().then(() => tf.audit(action, details)).catch(warn);
  const canFloat = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  const canSide = () => !!tf.page && typeof tf.theme === "function";
  const sessions = createSessions();
  const stage = createStage(tf, { warn, canSide });
  let active = false;
  let dismissed = false;
  let shown = null;
  let chosen = null;
  let loaded = false;
  const current = () => settingsOf(tf.settings);
  const language = () => languageOf(current().language, tf.t("page-lang"));
  const effectiveView = () => {
    let v = chosen ?? current().view;
    if (v !== "side" && !canFloat()) v = "side";
    if (v === "side" && !canSide()) v = canFloat() ? "bottom" : "window";
    return v;
  };
  const focusId = () => stage.focus() ?? NO_PANE;
  const load = async () => {
    if (loaded) return;
    loaded = true;
    const v = await tf.store.get(VIEW_KEY).catch(() => null);
    chosen = v === "bottom" || v === "corner" || v === "side" ? v : null;
    if (typeof tf.theme === "function") {
      stage.setAccent((await tf.theme().catch(() => null))?.colors?.accent ?? null);
    }
  };
  const post = async (message) => {
    if (!stage.where()) return;
    try {
      await tf.page.post(message);
    } catch {
    }
  };
  const render = async (id = shown) => {
    const s = sessions.get(id);
    if (!s || id !== shown) return;
    await post({
      do: "show",
      view: viewOf2(
        { ...s, pane: id, view: effectiveView(), language: language(), ...cardSettings(current()) },
        tf.t
      )
    });
  };
  const waiting = (s) => s && s.step === "result" ? changeCount(s.parts) - s.parts.filter((p) => p.id && s.rejected.has(p.id)).length : 0;
  const place = async () => {
    await stage.ensureLayout();
    const view = effectiveView();
    const id = focusId();
    const s = view === "side" || view === "window" ? sessions.ensure(id) : sessions.get(id);
    const where = await stage.show({ view, active, open: !!s?.open, waiting: waiting(s) });
    const next = where && s ? id : null;
    if (next !== shown) {
      shown = next;
      await render();
    }
  };
  const open = async () => {
    await load();
    if (!tf.page) {
      await tf.toast(tf.t("toast-needs-tilefold"));
      return;
    }
    await stage.ensureLayout();
    const s = sessions.ensure(focusId());
    const was = active && s.open;
    active = true;
    dismissed = false;
    s.open = true;
    await place();
    if (!was) audit("opened", { view: effectiveView() });
  };
  const openFor = async (id) => {
    await load();
    if (!tf.page) return;
    await stage.ensureLayout();
    stage.focusOn(id);
    const s = sessions.ensure(id);
    const was = active && s.open;
    active = true;
    dismissed = false;
    s.open = true;
    await place();
    if (!was) audit("opened", { view: effectiveView(), from: "input" });
  };
  const foldAfter = async (id) => {
    const v = effectiveView();
    const s = sessions.get(id);
    if (s && v !== "side" && v !== "window") s.open = false;
    await place();
    await render(id);
  };
  const closeShown = async () => {
    const s = sessions.get(shown);
    if (s) {
      await inputAction.release(shown);
      agentRun.forget(shown);
      resetSession(s);
      s.open = false;
    }
    const v = effectiveView();
    if (v === "side" || v === "window") active = false;
    await place();
    audit("closed", {});
  };
  const closeAll = async () => {
    const was = active;
    active = false;
    dismissed = true;
    await inputAction.releaseAll();
    for (const id of sessions.ids()) sessions.drop(id);
    await place();
    if (was) audit("closed", {});
  };
  const chooseView = async (to) => {
    const v = viewOf(to);
    if (v !== to) return;
    chosen = v;
    await tf.store.set(VIEW_KEY, v);
    const s = sessions.ensure(focusId());
    s.open = true;
    audit("view-changed", { to: v });
    await place();
  };
  const fold = async () => {
    const v = effectiveView();
    if (v === "side" || v === "window") return;
    if (v !== "corner") {
      chosen = "corner";
      await tf.store.set(VIEW_KEY, "corner");
      audit("view-changed", { to: "corner" });
    }
    const s = sessions.get(focusId());
    if (s) s.open = false;
    await place();
  };
  const deps = {
    sessions,
    render,
    refreshButton: async () => {
      if (stage.buttonShown()) await place();
    },
    audit,
    warn,
    language,
    mode: () => current().mode,
    fast: () => current().fast,
    helperAgent: () => current().helperAgent
  };
  const agentRun = createAgentRun(tf, deps);
  const claudeRun = createClaudeRun(tf, { ...deps, noKey: agentRun.takeOver });
  const sendToAgent = createSendToAgent(tf, {
    ...deps,
    // With the pill, the card folds back into it.
    afterSend: async (s) => {
      if (effectiveView() !== "corner") return;
      s.open = false;
      await place();
    }
  });
  const inputAction = createInputAction(tf, {
    ...deps,
    layout: async () => (await stage.ensureLayout(), stage.layout()),
    openFor,
    check: (id, text) => check(id, text),
    fold: foldAfter,
    noPane: NO_PANE
  });
  const check = async (id, text, by = current().checker) => {
    const s = sessions.get(id);
    if (!s) return;
    s.draft = String(text ?? "").slice(0, MAX_DRAFT);
    if (s.busy || blocker(s.draft)) return;
    if (by === "agent") return agentRun.check(id, s.draft);
    return claudeRun.check(id, s.draft);
  };
  const hear = async (m) => {
    if (!m || typeof m !== "object") return;
    if (m.type === "hello") {
      await post({ do: "setup", ...setupOf(tf.t) });
      return render();
    }
    if (m.type === "view") return chooseView(m.to);
    if (m.type === "fold") return fold();
    if (m.type === "size") {
      if (stage.setHeight(Number(m.h))) await place();
      return;
    }
    if (m.type === "close") return closeShown();
    const id = typeof m.pane === "string" ? m.pane : shown;
    const s = sessions.get(id);
    if (!s) return;
    if (m.type === "draft") {
      if (s.step === "write") s.draft = String(m.text ?? "").slice(0, MAX_DRAFT);
      return;
    }
    if (m.type === "check") return check(id, m.text);
    if (m.type === "agent-check") return check(id, s.draft, "agent");
    if (m.type === "cancel-agent") return agentRun.cancel(id);
    if (m.type === "as-is")
      return sendToAgent(id, String(m.text ?? "").slice(0, MAX_DRAFT), "as-is");
    if (m.type === "toggle" && s.step === "result") {
      const n = Number(m.id);
      if (!s.parts.some((p) => p.id === n)) return;
      if (s.rejected.has(n)) s.rejected.delete(n);
      else s.rejected.add(n);
      await render(id);
      if (stage.buttonShown()) await place();
      return;
    }
    if (m.type === "clean" && s.step === "result") {
      s.clean = !s.clean;
      return render(id);
    }
    if (m.type === "back") {
      s.step = "write";
      return render(id);
    }
    if (m.type === "send" && s.step === "result" && s.input) return inputAction.use(id);
    if (m.type === "keep") return inputAction.keep(id);
    if (m.type === "send" && s.step === "result")
      return sendToAgent(id, build(s.parts, s.rejected), "corrected");
    if (m.type === "again") {
      await inputAction.release(id);
      agentRun.forget(id);
      resetSession(s);
      return render(id);
    }
  };
  const wake = async () => {
    await load();
    if (active || dismissed || !canFloat() || effectiveView() !== "corner") return;
    active = true;
    await place();
  };
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch(warn);
  inputAction.register();
  tf.on(
    "input.action",
    background((e) => inputAction.clicked(e))
  );
  tf.on(
    "input.cancelled",
    background((e) => inputAction.cancelled(e))
  );
  const runs = { open, close: closeAll };
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      background(() => runs[c.id]()),
      { id: c.id }
    );
  }
  tf.command(
    tf.t("cmd-hand-back"),
    async (input) => input == null ? void await open() : agentRun.handBack(input),
    { id: HAND_BACK, input: HAND_BACK_INPUT }
  );
  tf.on(
    "page.message",
    background((e) => hear(e && e.message))
  );
  tf.on(
    "page.closed",
    background(async () => {
      if (!stage.where()) return;
      stage.lostPage();
      await inputAction.releaseAll();
      const s = sessions.get(shown);
      shown = null;
      const v = effectiveView();
      if (v === "side" || v === "window") active = false;
      else if (s) s.open = false;
      await place();
    })
  );
  tf.on(
    "page.undocked",
    // The user pressed Undock on the dock's bar: back over the pane.
    background(async () => {
      stage.lostPage();
      shown = null;
      await chooseView("bottom");
    })
  );
  tf.on(
    "overlay.layout",
    background(async (e) => {
      if (!e || !Array.isArray(e.panes)) return;
      stage.setLayout(e);
      await wake();
      if (active) await place();
    })
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.item !== BUTTON_ID || e.type !== "click") return;
      const s = sessions.ensure(focusId());
      s.open = !s.open;
      await place();
    })
  );
  tf.on(
    "overlay.hidden",
    // The user hid tile overlays: the button goes, and the card with it.
    background(async () => {
      stage.lostOverlay();
      if (stage.where() === "card") await closeAll();
    })
  );
  tf.on(
    "theme.changed",
    background(async (e) => {
      stage.setAccent(e?.colors?.accent ?? null);
      if (stage.buttonShown()) await place();
    })
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      await load();
      if (e?.key === "view") {
        chosen = null;
        await tf.store.delete(VIEW_KEY);
        await wake();
        if (active) await place();
      }
      await render();
    })
  );
  void Promise.resolve().then(wake).catch(warn);
  return {
    state: () => ({ where: stage.where(), shown, active, sessions: sessions.size() })
  };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runPolish(tf);
};
export default main_default;
