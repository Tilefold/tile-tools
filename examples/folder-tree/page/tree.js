/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree page — on screen
 *
 * Draws the tree from its state (tree-model.js) and passes clicks to the
 * tile through Tilefold's bridge (`window.tilefold`). The page never reads
 * a file itself: it can't, and the tile does it through Tilefold. All text
 * goes in with `textContent`, never as HTML, so a file's name can't change
 * the page. Every entry is a button, so the tree works from the keyboard.
 */
import { initialState, pick, receive, refresh, rows, toggle } from "./tree-model.js";

const bridge = window.tilefold;
let state = initialState();

const $ = (id) => document.getElementById(id);

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (message && bridge) bridge.post(message).catch(() => {});
};

/** Applies a step (new state, maybe a message) and redraws. */
const apply = ({ state: next, send: message }) => {
  state = next;
  send(message);
  render();
};

/** The symbol in front of an entry. */
function icon(row) {
  if (row.entry.kind === "dir") return row.open ? "▾" : "▸";
  return row.entry.kind === "link" ? "↪" : "·";
}

/** One line of the tree. */
function line(row) {
  const li = document.createElement("li");
  li.style.setProperty("--depth", String(row.depth));
  if (row.note) {
    li.className = `note note-${row.note}`;
    li.textContent = row.note === "error" ? row.text : (state.strings[row.note] ?? "");
    return li;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = `entry entry-${row.entry.kind}`;
  if (row.entry.kind === "dir") button.setAttribute("aria-expanded", String(row.open));
  if (row.loading) button.setAttribute("aria-busy", "true");
  button.title = row.path;
  button.addEventListener("click", () => apply(pick(state, row.parent, row.entry)));
  const mark = document.createElement("span");
  mark.className = "icon";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = icon(row);
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = row.entry.name;
  button.append(mark, name);
  li.append(button);
  return li;
}

/** Redraws everything from the state. */
function render() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.dir;
  $("tree-view").hidden = !state.ready;
  $("title").textContent = state.name;
  $("path").textContent = state.root ?? "";
  $("refresh").textContent = state.strings.refresh ?? "";
  $("status").textContent = state.root ? "" : (state.strings.noFolder ?? "");
  const list = $("list");
  list.replaceChildren(...rows(state).map(line));
}

$("refresh").addEventListener("click", () => apply(refresh(state)));
// Left and right arrows close and open the folder that has the focus.
$("list").addEventListener("keydown", (e) => {
  const button = e.target.closest?.("button.entry-dir");
  if (!button || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  const path = button.title;
  const open = state.open.includes(path);
  const wantOpen = (e.key === "ArrowRight") !== (state.dir === "rtl");
  if (open !== wantOpen) apply(toggle(state, path));
});

bridge?.onMessage((message) => {
  state = receive(state, message);
  render();
});
render();
send({ do: "ready" });
