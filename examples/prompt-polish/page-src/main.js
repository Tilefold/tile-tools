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
 *
 * Built into page/main.js with `npx @tilefold/tile-tools build`.
 */
import { sizeText, viewIcon, wsShown } from "./bits.js";
import { drawCase, drawModeMenu } from "./cases.js";
import { setupMoving } from "./move.js";

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);
/** The labels, from the tile's setup. */
let L = null;
/** The view last drawn. */
let view = null;
/** Whether the menu of what to fix is open (drawn in the body). */
let menuOpen = false;

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
  // What to fix first: a long case name would otherwise hide behind the
  // chip's ellipsis, after the language. The tooltip has it all.
  $("chip").textContent = `${v.mode} · ${v.language}`;
  $("chip").title = `${L.modeMenu}: ${v.mode} · ${v.language}`;
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
    }),
  );
  const over = v.view === "bottom" || v.view === "corner";
  $("fill").hidden = !over;
  $("fill").textContent = v.max ? "❐" : "▢";
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

/**
 * The diff: each change a button that undoes or restores it. For a case's
 * rework, where a change may be a whole sentence, a click on the text does
 * nothing: each change has its own ✕ (undo) or ↺ (bring back) button.
 */
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
        el("del", wsShown(p.del) ? "ws" : "", wsShown(p.del) && !(v.clean && p.off) ? "␣" : p.del),
      );
    if (p.ins)
      c.append(el("ins", wsShown(p.ins) ? "ws" : "", wsShown(p.ins) && !v.clean ? "␣" : p.ins));
    if (v.rework) {
      const x = button("chg-x", p.off ? "↺" : "✕", null);
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
    el("p", "muted", v.rework ? L.clickHintRework : L.clickHint),
    ...(v.notes.length ? [notes] : []),
  );
  $("foot").replaceChildren(back, el("span", "spacer"), ...sendButtons(v));
}

/**
 * Send to agent; for a prompt from the agent input box, Keep mine, Use (put
 * it back in the box) and Send to agent (put it back and send it).
 */
function sendButtons(v) {
  if (!v.input) return [button("btn primary", L.send, { type: "send" })];
  return [
    button("btn ghost", L.keep, { type: "keep" }),
    button("btn", L.use, { type: "send" }),
    button("btn primary", L.send, { type: "send-now" }),
  ];
}

function drawSent() {
  const box = el("div", "state");
  box.append(el("span", "", L.sent));
  $("body").replaceChildren(box);
  $("foot").replaceChildren(el("span", "spacer"), button("btn", L.again, { type: "again" }));
}

/** Waiting for the agent in the pane to hand its correction back. */
/** The timer counting a check's seconds on the waiting step, while it shows. */
let ticking = 0;

function drawAgent(v) {
  const box = el("div", "state");
  const head = el("b", "", v.text);
  box.append(head);
  if (Number.isFinite(v.since)) {
    // Working on it: the seconds so far, and a moving bar.
    const time = el("span", "muted elapsed");
    const tick = () =>
      (time.textContent = String(L.elapsed || "{n}").replace(
        "{n}",
        String(Math.max(0, Math.round((Date.now() - v.since) / 1000))),
      ));
    tick();
    ticking = setInterval(tick, 1000);
    const bar = el("div", "shimmer");
    bar.append(el("i"));
    box.append(time, bar);
  }
  box.append(el("span", "muted", v.hint || L.agentHint));
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
  seeThrough(v);
  // A waiting step's timer stops with it.
  clearInterval(ticking);
  // The form for a case replaces the menu it was opened from.
  if (v.step === "case") menuOpen = false;
  drawHead(v);
  const parts = { el, button, send, body: $("body"), foot: $("foot") };
  if (menuOpen) drawModeMenu(v, L, { ...parts, pick: pickMode, close: closeMenu });
  // From the agent input box with own cases: what to fix is picked before the check.
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

/** Closes the menu of what to fix, back to the step it covered. */
function closeMenu() {
  menuOpen = false;
  if (view) draw(view);
}

/** Whether view `v` asks what to fix before checking its prompt. */
const choosing = (v) => !!v && v.step === "write" && !!v.choose;

/** Closes the menu asked before the check: the prompt shows, to check as it is set. */
function skipChoice() {
  menuOpen = false;
  send({ type: "choose-skip" });
}

/** Sends the menu's choice and closes it. */
function pickMode(message) {
  menuOpen = false;
  send(message);
  if (view) draw(view);
}

/* --------------------------- the see-through ---------------------------- */
/**
 * Only the card over the pane is see-through (the setting's percent of its
 * background); beside the panes and in a window the page is solid.
 */
function seeThrough(v) {
  const card = v.view === "bottom" || v.view === "corner";
  const solid = Number.isFinite(v.solid) ? Math.min(100, Math.max(0, v.solid)) : 100;
  const root = document.documentElement;
  root.classList.toggle("see-through", card && solid < 100);
  // Below 60% the blocks fade too; at 0 only the text shows.
  root.classList.toggle("faded", card && solid < 60);
  root.classList.toggle("text-only", card && solid === 0);
  root.style.setProperty("--solid", `${solid}%`);
}

/* ------------------------------ the size ------------------------------- */
/**
 * How tall `el`'s content is, with its padding: its children's extent, not
 * its scroll height, which never drops below the space it already fills
 * (so the card could grow but never shrink back).
 */
function contentHeight(el) {
  const range = document.createRange();
  // Where ranges can't be measured, the scroll height is the best there is.
  if (typeof range.getBoundingClientRect !== "function") return el.scrollHeight;
  range.selectNodeContents(el);
  const inner = el.childNodes.length ? range.getBoundingClientRect().height : 0;
  const style = getComputedStyle(el);
  return Math.ceil(
    inner + parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0"),
  );
}

/** Tells the tile how tall the content is, so the card fits it. */
let lastH = 0;
function reportSize() {
  requestAnimationFrame(() => {
    // Folded to its bar, the content's height isn't what the card should be when unfolded.
    if (document.documentElement.classList.contains("collapsed")) return;
    const h = $("head").offsetHeight + contentHeight($("body")) + $("foot").offsetHeight + 2;
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

$("chip").addEventListener("click", () => {
  // The menu asked before the check closes like the one the chip opened.
  if (choosing(view) && !menuOpen) return skipChoice();
  menuOpen = !menuOpen;
  if (view) draw(view);
});
$("fill").addEventListener("click", () => send({ type: "max" }));
$("fold").addEventListener("click", () => send({ type: "fold" }));
// Over the pane: drag the header to move the card, double-click it to fill the pane.
const overPane = () => !!view && (view.view === "bottom" || view.view === "corner");
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
  // Escape closes the menu (or the case form) before it folds the card.
  if (e.key === "Escape" && menuOpen) return closeMenu();
  if (e.key === "Escape" && choosing(view)) return skipChoice();
  if (e.key === "Escape" && view?.step === "case") return send({ type: "case-cancel" });
  if (e.key === "Escape" && view && view.view !== "side" && view.view !== "window")
    send({ type: "fold" });
});
