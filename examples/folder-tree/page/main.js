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
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/format.js
  function fill(text, ...values) {
    let i = 0;
    return String(text ?? "").replace(
      /§(\d)?/g,
      (_, n) => String(values[n ? Number(n) - 1 : i++] ?? "")
    );
  }
  function ago(strings2, ts, now = Date.now()) {
    const s = Math.max(0, Math.round((now - ts) / 1e3));
    const forms = strings2?.ago ?? {};
    if (s < 60) return fill(forms.s ?? "\xA7s", s);
    if (s < 3600) return fill(forms.m ?? "\xA7m", Math.floor(s / 60));
    if (s < 86400) return fill(forms.h ?? "\xA7h", Math.floor(s / 3600));
    return fill(forms.d ?? "\xA7d", Math.floor(s / 86400));
  }
  var ACTION_CLASS = Object.freeze({ r: "read", e: "edit", a: "add", d: "delete" });
  var RECENT_FEW = 5;
  var shownRecent = (recent, all) => all ? recent : recent.slice(0, RECENT_FEW);

  // page-src/main.js
  var bridge = window.tilefold;
  var $ = (id) => document.getElementById(id);
  var strings = null;
  var state = null;
  var showAll = false;
  var send = (message) => {
    if (bridge) bridge.post(message).catch(() => {
    });
  };
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function dot(action, live) {
    return el("span", `dot ${ACTION_CLASS[action] ?? "edit"}${live ? " live" : ""}`);
  }
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
  function treeRow(r) {
    const item = el("li", "node");
    item.setAttribute("role", "none");
    item.style.setProperty("--depth", String(r.depth));
    const button = el("button", `row ${r.kind}${r.muted ? " muted" : ""}`);
    button.type = "button";
    button.setAttribute("role", "treeitem");
    if (r.expandable) button.setAttribute("aria-expanded", String(r.expanded));
    const twisty = el("span", "twisty", r.expandable ? r.expanded ? "\u25BE" : "\u25B8" : "");
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
      button.addEventListener(
        "click",
        () => r.expandable ? send({ type: "toggle", id: r.id, open: !r.expanded }) : send({ type: "open", id: r.id })
      );
    }
    item.append(button);
    return item;
  }
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
  function draw() {
    if (!strings || !state) return;
    document.title = state.title;
    $("title").textContent = state.title;
    $("root").textContent = state.root;
    const live = $("live");
    live.textContent = state.live ? strings.live : strings.idle;
    live.classList.toggle("on", state.live);
    $("now-box").hidden = !state.now.length;
    $("now").replaceChildren(...state.now.map((e) => fileLine(e, { live: true, card: true })));
    $("tree").replaceChildren(...state.tree.map(treeRow));
    const box = $("recent-box");
    box.hidden = !state.activity;
    box.classList.toggle("all", showAll);
    $("recent-count").textContent = state.recent.length ? `${state.recent.length} \xB7 ${fill(strings.panes, state.panes)}` : "";
    const list = shownRecent(state.recent, showAll);
    $("recent").replaceChildren(
      ...list.length ? list.map((e) => fileLine(e, { live: false, card: false })) : [el("li", "empty", strings.emptyRecent)]
    );
    const more = $("recent-more");
    more.hidden = state.recent.length <= RECENT_FEW;
    more.textContent = showAll ? strings.showFewer : fill(strings.showAll, state.recent.length);
  }
  function tick() {
    if (!strings) return;
    for (const t of document.querySelectorAll("time[data-ts]")) {
      t.textContent = ago(strings, Number(t.dataset.ts));
    }
  }
  $("recent-more").addEventListener("click", () => {
    showAll = !showAll;
    draw();
    if (!showAll) $("recent").scrollTop = 0;
  });
  $("setup-open").addEventListener("click", () => $("setup").showModal());
  $("setup-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(strings.setup.command);
      $("setup-copy").textContent = strings.setup.copied;
      setTimeout(() => $("setup-copy").textContent = strings.setup.copy, 2e3);
    } catch {
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
  setInterval(tick, 1e3);
  send({ type: "ready" });
})();
