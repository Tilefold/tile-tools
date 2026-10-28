/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree's window — the file tools
 *
 * Changing files from the window (Tilefold 0.1.16 and later; hidden on an
 * older Tilefold): a toolbar with New file, New folder, Rename, Edit and
 * Move to Trash for the chosen row (or the tree's folder); renaming in
 * place (Enter keeps the new name, Escape or leaving the field keeps the
 * old one); dragging a file or folder onto a folder, or onto the Files
 * heading for the tree's own folder, moves it; F2 renames and ⌘⌫ / Delete
 * moves the chosen row to the Trash (Tilefold asks first). A double-click
 * on a file renames it in place: the second click on the same file within
 * DOUBLE_MS starts the rename instead of opening it again. It is counted by
 * row id, not left to the browser, since the first click's redraw replaces
 * the row's element. Everything goes
 * to the tile as a message; the tile and Tilefold check it all again.
 * Names are only ever set with `textContent` and the field's value.
 */

/** The drag type that carries a row id between rows of this window. */
const DRAG_TYPE = "application/x-folder-tree-row";

/** Two clicks on the same file within this many milliseconds are a double-click. */
export const DOUBLE_MS = 500;

/**
 * The tools for one window. `send(message)` posts to the tile, `el(tag,
 * className, text)` makes an element, `$` finds one by id.
 */
export function createTools({ send, el, $ }) {
  let state = null;
  let strings = null;
  /** The row being renamed, and one the tile asked to rename before it was drawn. */
  let renaming = null;
  let pendingRename = null;
  /** The last click on a file row (to tell a double-click). */
  let lastClick = { id: null, at: 0 };

  const chosen = () => state?.selected ?? null;
  const rowOf = (id) => state?.tree.find((r) => r.id === id) ?? null;
  const on = () => Boolean(state?.canEdit);

  /** Renames `id` in place: its name becomes a text field. */
  const startRename = (id) => {
    const row = rowOf(id);
    const button = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const name = button?.querySelector(".name");
    if (!row || !name || !on()) return;
    renaming = id;
    const field = el("input", "rename");
    field.value = row.name;
    field.setAttribute("aria-label", strings.edit.nameLabel);
    field.dir = "auto";
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      renaming = null;
      const next = field.value.trim();
      if (keep && next && next !== row.name) send({ type: "rename", id, name: next });
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
    // Select the name without its extension, as Finder does.
    const dot = row.kind === "dir" ? -1 : row.name.lastIndexOf(".");
    field.setSelectionRange(0, dot > 0 ? dot : row.name.length);
  };

  /** Moves the dragged row into folder row `to` (null: the tree's folder). */
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
      send({ type: "move", id, to });
    });
  };

  return {
    /** New strings from the tile. */
    setStrings(next) {
      strings = next;
      const s = strings.edit;
      $("tools").setAttribute("aria-label", s.tools);
      for (const [id, key] of [
        ["tool-new-file", "newFile"],
        ["tool-new-folder", "newFolder"],
        ["tool-rename", "rename"],
        ["tool-edit", "edit"],
        ["tool-trash", "trash"],
      ]) {
        $(id).textContent = s[key];
      }
    },

    /** A new state from the tile: the toolbar follows the chosen row. */
    setState(next) {
      state = next;
      $("tools").hidden = !on();
      const row = rowOf(chosen());
      const entry = row && row.kind !== "note";
      $("tool-rename").disabled = !entry;
      $("tool-trash").disabled = !entry;
      $("tool-edit").disabled = !(entry && row.kind === "file");
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
      if (r.kind === "file" || r.kind === "link") {
        // Added before the window's own click listener, so a second click
        // can keep it from opening the file again.
        button.addEventListener("click", (e) => {
          const now = Date.now();
          const again = lastClick.id === r.id && now - lastClick.at < DOUBLE_MS;
          lastClick = again ? { id: null, at: 0 } : { id: r.id, at: now };
          if (!again) return;
          e.stopImmediatePropagation();
          startRename(r.id);
        });
      }
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
      $("tool-new-file").addEventListener("click", () => send({ type: "new-file", id: chosen() }));
      $("tool-new-folder").addEventListener("click", () =>
        send({ type: "new-folder", id: chosen() }),
      );
      $("tool-rename").addEventListener("click", () => chosen() && startRename(chosen()));
      $("tool-edit").addEventListener("click", () => send({ type: "edit", id: chosen() }));
      $("tool-trash").addEventListener("click", () => send({ type: "trash", id: chosen() }));
      dropOn($("files-title"), null);
      $("tree").addEventListener("keydown", (e) => {
        if (!on() || renaming || !chosen()) return;
        if (e.key === "F2") {
          e.preventDefault();
          startRename(chosen());
        } else if (e.key === "Delete" || (e.key === "Backspace" && e.metaKey)) {
          e.preventDefault();
          send({ type: "trash", id: chosen() });
        }
      });
    },

    /** True while a name is being typed (the tree isn't redrawn under it). */
    busy: () => renaming !== null,
  };
}
