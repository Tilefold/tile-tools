/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Fake Tilefold — tf.annotate
 *
 * The annotation part of the fake Tilefold in fake-host.mjs (Tilefold
 * 0.1.23): `tf.annotate.draw`, `clear` and `list` with Tilefold's main
 * checks (a known kind and color, a target on a pane or a file, a note's
 * text, 20 marks at once and in one draw, an id used once per draw), and
 * marks numbered a1, a2, … when the tile names none. Where a mark lands is
 * up to the test: `annotate: true` places every mark, and `annotate: {
 * place(target) }` answers `true` or why not ("no-pane", "not-found",
 * "no-row", "not-shown"). The marks are kept in `host.marks`;
 * `host.hideOverlays(on)` plays the user's switch (draw answers `shown:
 * false`) and `host.clearMarks()` the user's Clear annotations, which
 * fires `annotate.cleared`. See fake-host.mjs for how tests use it.
 */

const KINDS = ["highlight", "box", "underline", "arrow", "note"];
const COLORS = ["accent", "red", "orange", "yellow", "green", "teal", "blue", "purple", "gray"];
const ID = /^[a-z0-9-]{1,32}$/;
const MAX = 20;

/** Why a target can't be a target, or null. */
function badTarget(t, field) {
  if (!t || typeof t !== "object") return `${field}: an object`;
  if (t.file !== undefined) {
    if (typeof t.file !== "string" || !t.file.startsWith("/"))
      return `${field}.file: an absolute path`;
    if (!Number.isInteger(t.line) || t.line < 1) return `${field}.line: the line to mark`;
    return null;
  }
  if (t.pane === undefined) return `${field}.pane: the pane`;
  if (t.text === undefined && t.row === undefined) return `${field}: needs text to find, or a row`;
  if (t.text !== undefined && (typeof t.text !== "string" || t.text.length < 2)) {
    return `${field}.text: text of 2 to 200 characters on one line`;
  }
  return null;
}

/** Why an item can't be drawn, or null. */
function badItem(item, field) {
  if (!item || typeof item !== "object") return `${field}: an object`;
  if (!KINDS.includes(item.kind)) return `${field}.kind: one of ${KINDS.join(", ")}`;
  if (item.color !== undefined && !COLORS.includes(item.color)) {
    return `${field}.color: one of ${COLORS.join(", ")}`;
  }
  if (item.id !== undefined && !ID.test(item.id))
    return `${field}.id: 1 to 32 lowercase letters, digits or -`;
  if (item.kind === "note" && !item.text) return `${field}.text: a note needs its text`;
  return (
    badTarget(item.at, `${field}.at`) ?? (item.from ? badTarget(item.from, `${field}.from`) : null)
  );
}

/** Adds `tf.annotate` to `tf`, keeping its marks on `host`. */
export function addAnnotate(tf, host, named, option) {
  const place = typeof option === "object" && option.place ? option.place : () => true;
  host.marks = [];
  host.overlaysHidden = false;
  host.hideOverlays = (on) => void (host.overlaysHidden = on);
  host.clearMarks = async () => {
    if (host.marks.length === 0) return;
    host.marks = [];
    await host.emit("annotate.cleared", { by: "user" });
  };

  tf.annotate = {
    async draw(items, options) {
      if (!Array.isArray(items) || items.length === 0 || items.length > MAX) {
        throw named("TypeError", `items: a list of 1 to ${MAX} marks`);
      }
      const ids = new Set();
      items.forEach((item, i) => {
        const bad = badItem(item, `items[${i}]`);
        if (bad) throw named("TypeError", bad);
        if (item.id && ids.has(item.id)) throw named("TypeError", `items[${i}].id: used twice`);
        if (item.id) ids.add(item.id);
      });
      const staying =
        options && options.clear === true ? [] : host.marks.filter((m) => !ids.has(m.id));
      if (staying.length + items.length > MAX) {
        throw named("RangeError", `at most ${MAX} marks at once; clear some first`);
      }
      const taken = new Set([...staying.map((m) => m.id), ...ids]);
      let n = 0;
      const answers = [];
      const fresh = items.map((item) => {
        let id = item.id;
        if (!id) {
          do n++;
          while (taken.has(`a${n}`));
          id = `a${n}`;
          taken.add(id);
        }
        const where = place(structuredClone(item.at));
        const placed = where === true;
        answers.push(placed ? { id, placed } : { id, placed, why: where });
        return { ...structuredClone(item), id, placed };
      });
      host.marks = [...staying, ...fresh];
      return { items: answers, shown: !host.overlaysHidden };
    },
    async clear(ids) {
      const before = host.marks.length;
      host.marks = Array.isArray(ids) ? host.marks.filter((m) => !ids.includes(m.id)) : [];
      return { cleared: before - host.marks.length };
    },
    async list() {
      return { items: host.marks.map((m) => ({ id: m.id, kind: m.kind, placed: m.placed })) };
    },
  };
}
