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
 *
 * Modified 2026-10-23 (changing files): the file tools (tools.js): a
 *   toolbar, renaming in place, dragging to move, F2 and ⌘⌫; the tree
 *   isn't redrawn while a name is being typed; { type: "rename", id } from
 *   the tile starts renaming.
 *
 * Last updated by: Tilefold
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

  // page-src/tools.js
  var DRAG_TYPE = "application/x-folder-tree-row";
  function createTools({ send: send2, el: el2, $: $2 }) {
    let state2 = null;
    let strings2 = null;
    let renaming = null;
    let pendingRename = null;
    const chosen = () => state2?.selected ?? null;
    const rowOf = (id) => state2?.tree.find((r) => r.id === id) ?? null;
    const on = () => Boolean(state2?.canEdit);
    const startRename = (id) => {
      const row = rowOf(id);
      const button = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
      const name = button?.querySelector(".name");
      if (!row || !name || !on()) return;
      renaming = id;
      const field = el2("input", "rename");
      field.value = row.name;
      field.setAttribute("aria-label", strings2.edit.nameLabel);
      field.dir = "auto";
      let done = false;
      const finish = (keep) => {
        if (done) return;
        done = true;
        renaming = null;
        const next = field.value.trim();
        if (keep && next && next !== row.name) send2({ type: "rename", id, name: next });
        field.replaceWith(name);
        button.focus();
      };
      field.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
      });
      field.addEventListener("click", (e) => e.stopPropagation());
      field.addEventListener("blur", () => finish(false));
      name.replaceWith(field);
      field.focus();
      const dot2 = row.kind === "dir" ? -1 : row.name.lastIndexOf(".");
      field.setSelectionRange(0, dot2 > 0 ? dot2 : row.name.length);
    };
    const dropOn = (target, to) => {
      target.addEventListener("dragover", (e) => {
        if (!on() || !e.dataTransfer?.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        target.classList.add("drop");
      });
      target.addEventListener("dragleave", () => target.classList.remove("drop"));
      target.addEventListener("drop", (e) => {
        target.classList.remove("drop");
        const id = e.dataTransfer?.getData(DRAG_TYPE);
        if (!id || id === to) return;
        e.preventDefault();
        send2({ type: "move", id, to });
      });
    };
    return {
      /** New strings from the tile. */
      setStrings(next) {
        strings2 = next;
        const s = strings2.edit;
        $2("tools").setAttribute("aria-label", s.tools);
        for (const [id, key] of [
          ["tool-new-file", "newFile"],
          ["tool-new-folder", "newFolder"],
          ["tool-rename", "rename"],
          ["tool-edit", "edit"],
          ["tool-trash", "trash"]
        ]) {
          $2(id).textContent = s[key];
        }
      },
      /** A new state from the tile: the toolbar follows the chosen row. */
      setState(next) {
        state2 = next;
        $2("tools").hidden = !on();
        const row = rowOf(chosen());
        const entry = row && row.kind !== "note";
        $2("tool-rename").disabled = !entry;
        $2("tool-trash").disabled = !entry;
        $2("tool-edit").disabled = !(entry && row.kind === "file");
        if (pendingRename && rowOf(pendingRename)) {
          const id = pendingRename;
          pendingRename = null;
          queueMicrotask(() => startRename(id));
        }
      },
      /** Marks a drawn tree row as chosen, draggable and a drop target. */
      decorate(button, r) {
        button.dataset.id = r.id;
        if (r.id === chosen()) button.classList.add("chosen");
        button.setAttribute("aria-selected", String(r.id === chosen()));
        if (!on() || r.muted || r.kind === "note") return;
        button.draggable = true;
        button.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData(DRAG_TYPE, r.id);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        });
        if (r.kind === "dir") dropOn(button, r.id);
      },
      /** The tile asks to rename `id` (from the palette). */
      rename(id) {
        if (rowOf(id)) startRename(id);
        else pendingRename = id;
      },
      /** Wires the toolbar, the Files heading and the keys (once). */
      wire() {
        $2("tool-new-file").addEventListener("click", () => send2({ type: "new-file", id: chosen() }));
        $2("tool-new-folder").addEventListener(
          "click",
          () => send2({ type: "new-folder", id: chosen() })
        );
        $2("tool-rename").addEventListener("click", () => chosen() && startRename(chosen()));
        $2("tool-edit").addEventListener("click", () => send2({ type: "edit", id: chosen() }));
        $2("tool-trash").addEventListener("click", () => send2({ type: "trash", id: chosen() }));
        dropOn($2("files-title"), null);
        $2("tree").addEventListener("keydown", (e) => {
          if (!on() || renaming || !chosen()) return;
          if (e.key === "F2") {
            e.preventDefault();
            startRename(chosen());
          } else if (e.key === "Delete" || e.key === "Backspace" && e.metaKey) {
            e.preventDefault();
            send2({ type: "trash", id: chosen() });
          }
        });
      },
      /** True while a name is being typed (the tree isn't redrawn under it). */
      busy: () => renaming !== null
    };
  }

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
  var tools = createTools({ send, el, $ });
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
    tools.decorate(button, r);
    if (!r.muted && r.kind !== "note") {
      button.addEventListener(
        "click",
        () => r.expandable ? send({ type: "toggle", id: r.id, open: !r.expanded }) : send({ type: "open", id: r.id })
      );
    }
    item.append(button);
    return item;
  }
  function idleLine() {
    const item = document.createElement("li");
    item.className = "idle";
    item.textContent = strings.emptyNow;
    return item;
  }
  function drawStrings() {
    document.documentElement.lang = strings.lang;
    document.documentElement.dir = strings.dir;
    $("now-title").textContent = strings.now;
    $("files-title").textContent = strings.files;
    $("recent-title").textContent = strings.recent;
    tools.setStrings(strings);
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
    $("now-box").hidden = !state.activity;
    $("now").replaceChildren(
      ...state.now.length ? state.now.map((e) => fileLine(e, { live: true, card: true })) : [idleLine()]
    );
    tools.setState(state);
    if (!tools.busy()) $("tree").replaceChildren(...state.tree.map(treeRow));
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
    } else if (message?.type === "rename" && typeof message.id === "string") {
      tools.rename(message.id);
    }
  });
  tools.wire();
  setInterval(tick, 1e3);
  send({ type: "ready" });
})();
