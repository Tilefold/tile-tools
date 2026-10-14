/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard's Library page — on screen
 *
 * Draws the Library from its state (library-model.js), as thumbnails or as
 * a list, and passes the user's clicks to the tile through Tilefold's bridge (`window.tilefold`).
 * It stays hidden until the tile says to show it, so the same page can also
 * run hidden as the player. All text goes in with `textContent`, never as
 * HTML, so a playlist's name can't change the page. Covers load only from
 * Spotify's image hosts, the ones Tilefold allows this page.
 */
import {
  initialState,
  more,
  play,
  receive,
  refresh,
  setView,
  statusLine,
} from "./library-model.js";

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

/** One playlist as a button: cover, name, owner and track count. */
function tile(p) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "playlist";
  if (p.uri === state.playing) button.classList.add("playing");
  button.addEventListener("click", () => apply(play(state, p.uri)));

  const cover = document.createElement(p.cover ? "img" : "div");
  cover.className = "cover";
  if (p.cover) {
    cover.src = p.cover;
    cover.alt = "";
    cover.loading = "lazy";
  }
  const text = document.createElement("span");
  text.className = "text";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = p.name;
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = [p.byline, p.tracks === null ? "" : `♪ ${p.tracks}`]
    .filter(Boolean)
    .join(" · ");
  text.append(name, meta);
  button.append(cover, text);
  return button;
}

/** Draws the whole Library from the state. */
function render() {
  const root = $("library");
  root.hidden = !state.shown;
  if (!state.shown) return;
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.dir;
  document.title = state.strings.title ?? document.title;
  $("title").textContent = state.strings.title ?? "";
  $("refresh").textContent = state.strings.refresh ?? "↻";
  $("refresh").disabled = state.loading;
  const line = statusLine(state);
  $("status").textContent = line.text;
  $("status").classList.toggle("error", Boolean(line.error));
  for (const [id, view, label] of [
    ["view-grid", "grid", state.strings.viewGrid],
    ["view-list", "list", state.strings.viewList],
  ]) {
    $(id).setAttribute("aria-pressed", String(state.view === view));
    $(id).setAttribute("aria-label", label ?? view);
    $(id).title = label ?? view;
  }
  $("list").className = state.view;
  $("list").replaceChildren(...state.items.map(tile));
  $("more").hidden = state.nextOffset === null;
  $("more").textContent = state.strings.more ?? "…";
  $("more").disabled = state.loading;
}

if (bridge) {
  bridge.onMessage((message) => apply(receive(state, message)));
  $("refresh").addEventListener("click", () => apply(refresh(state)));
  $("more").addEventListener("click", () => apply(more(state)));
  for (const id of ["view-grid", "view-list"]) {
    $(id).addEventListener("click", () => apply(setView(state, $(id).dataset.view)));
  }
  // Tells the tile the page is here, in case it is waiting to show the Library.
  send({ type: "hello" });
}
