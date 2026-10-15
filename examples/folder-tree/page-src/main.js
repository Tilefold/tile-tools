/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree's window — on screen
 *
 * Draws what the tile posts through Tilefold's bridge (`window.tilefold`):
 * the strings once ({ type: "strings" }), then the state each time it
 * changes ({ type: "state" }): the folder, the files agents are on now as
 * cards, the tree, and the recent files pinned to the bottom. "Show all"
 * lets the recent list grow upward to half the window, scrolling inside;
 * ages keep ticking every second. Clicks go back to the tile as
 * { type: "toggle", id, open } and { type: "open", id }; { type: "setup" }
 * opens the help for setting up the agent hooks. All text goes in with
 * `textContent`, never as HTML, so a file's name can't change the page.
 */
import { ACTION_CLASS, ago, fill, RECENT_FEW, shownRecent } from "./format.js";

const bridge = window.tilefold;
const $ = (id) => document.getElementById(id);
let strings = null;
let state = null;
let showAll = false;

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (bridge) bridge.post(message).catch(() => {});
};

/** An element with a class and text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A dot in the action's colour, pulsing when `live`. */
function dot(action, live) {
  return el("span", `dot ${ACTION_CLASS[action] ?? "edit"}${live ? " live" : ""}`);
}

/** One file as a line or card: dot, name, folder, pane and age. */
function fileLine(e, { live, card }) {
  const item = el("li", card ? "card" : "line");
  const button = el("button", "row");
  button.type = "button";
  button.title = `${e.dir}${e.file}`;
  button.addEventListener("click", () => send({ type: "open", id: e.id }));
  const text = el("span", "text");
  text.append(el("span", "file", e.file), el("span", "dir", e.dir));
  button.append(dot(e.action, live), text);
  const meta = el("span", "meta");
  meta.append(el("span", `pane ${ACTION_CLASS[e.action] ?? "edit"}`, e.pane));
  const age = el("time", "age", ago(strings, e.ts));
  age.dataset.ts = String(e.ts);
  meta.append(age);
  if (card) meta.prepend(el("span", "doing", strings.doing[e.action] ?? ""));
  button.append(meta);
  item.append(button);
  return item;
}

/** One tree row. */
function treeRow(r) {
  const item = el("li", "node");
  item.setAttribute("role", "none");
  item.style.setProperty("--depth", String(r.depth));
  const button = el("button", `row ${r.kind}${r.muted ? " muted" : ""}`);
  button.type = "button";
  button.setAttribute("role", "treeitem");
  if (r.expandable) button.setAttribute("aria-expanded", String(r.expanded));
  const twisty = el("span", "twisty", r.expandable ? (r.expanded ? "▾" : "▸") : "");
  const icon = el("span", `icon ${r.kind}${r.expanded ? " open" : ""}`);
  button.append(twisty, icon, el("span", "name", r.name));
  if (r.mark) {
    button.classList.add(ACTION_CLASS[r.mark.action] ?? "edit");
    const age = el("time", "age", ago(strings, r.mark.ts));
    age.dataset.ts = String(r.mark.ts);
    button.append(el("span", `pane ${ACTION_CLASS[r.mark.action] ?? "edit"}`, r.mark.pane), age);
  }
  if (r.hot) {
    button.classList.add("hot");
    button.title = fill(strings.busy, r.hot);
    button.append(dot("e", true), el("span", "count", String(r.hot)));
  }
  if (!r.muted && r.kind !== "note") {
    button.addEventListener("click", () =>
      r.expandable
        ? send({ type: "toggle", id: r.id, open: !r.expanded })
        : send({ type: "open", id: r.id }),
    );
  }
  item.append(button);
  return item;
}

/** The quiet line Now shows when no agent is busy. */
function idleLine() {
  const item = document.createElement("li");
  item.className = "idle";
  item.textContent = strings.emptyNow;
  return item;
}

/** Draws the strings into the static parts. */
function drawStrings() {
  document.documentElement.lang = strings.lang;
  document.documentElement.dir = strings.dir;
  $("now-title").textContent = strings.now;
  $("files-title").textContent = strings.files;
  $("recent-title").textContent = strings.recent;
  const s = strings.setup;
  $("setup-open").textContent = s.open;
  $("setup-title").textContent = s.title;
  $("setup-intro").textContent = s.intro;
  $("setup-claude").textContent = s.claude;
  $("setup-codex").textContent = s.codex;
  $("setup-other").textContent = s.other;
  $("setup-command").textContent = s.command;
  $("setup-copy").textContent = s.copy;
  $("setup-close").textContent = s.close;
}

/** Draws the state. */
function draw() {
  if (!strings || !state) return;
  document.title = state.title;
  $("title").textContent = state.title;
  $("root").textContent = state.root;
  const live = $("live");
  live.textContent = state.live ? strings.live : strings.idle;
  live.classList.toggle("on", state.live);

  // Always there while activity is on, at its least height, so the tree stays put.
  $("now-box").hidden = !state.activity;
  $("now").replaceChildren(
    ...(state.now.length
      ? state.now.map((e) => fileLine(e, { live: true, card: true }))
      : [idleLine()]),
  );
  $("tree").replaceChildren(...state.tree.map(treeRow));

  const box = $("recent-box");
  box.hidden = !state.activity;
  box.classList.toggle("all", showAll);
  $("recent-count").textContent = state.recent.length
    ? `${state.recent.length} · ${fill(strings.panes, state.panes)}`
    : "";
  const list = shownRecent(state.recent, showAll);
  $("recent").replaceChildren(
    ...(list.length
      ? list.map((e) => fileLine(e, { live: false, card: false }))
      : [el("li", "empty", strings.emptyRecent)]),
  );
  const more = $("recent-more");
  more.hidden = state.recent.length <= RECENT_FEW;
  more.textContent = showAll ? strings.showFewer : fill(strings.showAll, state.recent.length);
}

/** Keeps every age current. */
function tick() {
  if (!strings) return;
  for (const t of document.querySelectorAll("time[data-ts]")) {
    t.textContent = ago(strings, Number(t.dataset.ts));
  }
}

$("recent-more").addEventListener("click", () => {
  showAll = !showAll;
  draw();
  // Showing fewer brings the newest back into view.
  if (!showAll) $("recent").scrollTop = 0;
});
$("setup-open").addEventListener("click", () => $("setup").showModal());
$("setup-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(strings.setup.command);
    $("setup-copy").textContent = strings.setup.copied;
    setTimeout(() => ($("setup-copy").textContent = strings.setup.copy), 2000);
  } catch {
    // No clipboard here: the command stays on screen to copy by hand.
  }
});

bridge?.onMessage((message) => {
  if (message?.type === "strings") {
    strings = message;
    drawStrings();
    draw();
  } else if (message?.type === "state") {
    state = message;
    draw();
  } else if (message?.type === "setup" && strings) {
    $("setup").showModal();
  }
});
setInterval(tick, 1000);
send({ type: "ready" });
