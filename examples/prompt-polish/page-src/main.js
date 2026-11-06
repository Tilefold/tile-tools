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
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
import { sizeText, viewIcon, wsShown } from "./bits.js";

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);
/** The labels, from the tile's setup. */
let L = null;
/** The view last drawn. */
let view = null;

/**
 * Sends a message to the tile, naming the pane whose prompt is showing
 * (unless the message names one itself); a refused one (the tile is off)
 * is dropped.
 */
const send = (message) => {
  if (!bridge) return;
  bridge.post({ pane: view ? view.pane : null, ...message }).catch(() => {});
};

/** The draft not sent yet (typing pauses before it goes), with the pane it was typed for. */
let pending = null;

/** Sends the pending draft now, to the pane it was typed for. */
function flushDraft() {
  if (!pending) return;
  clearTimeout(pending.timer);
  send({ type: "draft", pane: pending.pane, text: pending.text });
  pending = null;
}

/** A new element with a class and text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A button with a class, a label and what it sends (none: the caller wires it). */
function button(className, label, message) {
  const b = el("button", className, label);
  b.type = "button";
  if (message) b.addEventListener("click", () => send(message));
  return b;
}

/** Text with `code` spans set in the mono font, as text nodes only. */
function withCode(text) {
  const frag = document.createDocumentFragment();
  for (const piece of String(text).split(/(`[^`\n]*`)/)) {
    if (!piece) continue;
    frag.append(
      piece.startsWith("`") && piece.endsWith("`") && piece.length > 1
        ? el("span", "code", piece)
        : piece,
    );
  }
  return frag;
}

/* ------------------------------- header -------------------------------- */
function drawHead(v) {
  $("name").textContent = L.name;
  $("where").textContent = v.view === "side" ? L.inDock : L.overPane;
  $("chip").textContent = `${v.language} · ${v.mode}`;
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
    }),
  );
  $("fold").hidden = v.view === "side" || v.view === "window";
  $("fold").title = L.fold;
  $("fold").setAttribute("aria-label", L.fold);
  $("close").title = L.close;
  $("close").setAttribute("aria-label", L.close);
}

/* -------------------------------- steps -------------------------------- */
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
  check.title = "⌘↩";
  const update = () => {
    const t = area.value;
    size.textContent = sizeText(t, v.unspaced, L);
    const long = t.trim().length > 2000;
    warn.hidden = !long;
    check.disabled = !t.trim() || long;
    asIs.disabled = !t.trim();
  };
  area.addEventListener("input", () => {
    update();
    if (pending) clearTimeout(pending.timer);
    pending = { pane: v.pane, text: area.value, timer: setTimeout(flushDraft, 300) };
  });
  // From the agent input box, the prompt is already there: Keep mine leaves it.
  if (v.input) asIs.textContent = L.keep;
  asIs.addEventListener("click", () =>
    send(v.input ? { type: "keep" } : { type: "as-is", text: area.value }),
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

/** The diff: each change a button that undoes or restores it. */
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
        el("del", wsShown(p.del) ? "ws" : "", wsShown(p.del) && !(v.clean && p.off) ? "␣" : p.del),
      );
    if (p.ins)
      c.append(el("ins", wsShown(p.ins) ? "ws" : "", wsShown(p.ins) && !v.clean ? "␣" : p.ins));
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
    $("foot").replaceChildren(back, el("span", "spacer"), ...sendButtons(v));
    return;
  }
  const sum = el("div", "sum");
  sum.append(el("b", "", v.summary));
  if (v.undone) sum.append(el("span", "muted", v.undone));
  sum.append(
    el("span", "spacer"),
    button("link", v.clean ? L.showChanges : L.showResult, { type: "clean" }),
  );
  const notes = el("ul", "notes");
  for (const n of v.notes) {
    const li = el("li");
    const what = el("span", "what");
    what.append(el("s", "", n.from), " → ", el("b", "", n.to));
    li.append(el("span", "kind", n.kindLabel), what);
    if (n.why) li.append(el("span", "why", n.why));
    notes.append(li);
  }
  $("body").replaceChildren(
    sum,
    diffOf(v),
    el("p", "muted", L.clickHint),
    ...(v.notes.length ? [notes] : []),
  );
  $("foot").replaceChildren(back, el("span", "spacer"), ...sendButtons(v));
}

/** Send to agent; for a prompt from the agent input box, Keep mine and Use instead. */
function sendButtons(v) {
  if (!v.input) return [button("btn primary", L.send, { type: "send" })];
  return [
    button("btn ghost", L.keep, { type: "keep" }),
    button("btn primary", L.use, { type: "send" }),
  ];
}

function drawSent() {
  const box = el("div", "state");
  box.append(el("span", "", L.sent));
  $("body").replaceChildren(box);
  $("foot").replaceChildren(el("span", "spacer"), button("btn", L.again, { type: "again" }));
}

/** Waiting for the agent in the pane to hand its correction back. */
function drawAgent(v) {
  const box = el("div", "state");
  box.append(el("b", "", v.text), el("span", "muted", L.agentHint));
  $("body").replaceChildren(box);
  $("foot").replaceChildren(
    el("span", "spacer"),
    button("btn", L.cancel, { type: "cancel-agent" }),
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

/** Draws a view from the tile. */
function draw(v) {
  if (!L) return;
  // A draft still waiting goes to its own pane before another pane's prompt is drawn.
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

/* ------------------------------ the size ------------------------------- */
/** Tells the tile how tall the content is, so the card fits it. */
let lastH = 0;
function reportSize() {
  requestAnimationFrame(() => {
    const body = $("body");
    const h = $("head").offsetHeight + body.scrollHeight + $("foot").offsetHeight + 2;
    if (Math.abs(h - lastH) < 2) return;
    lastH = h;
    send({ type: "size", h });
  });
}

/* ------------------------------- messages ------------------------------ */
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
