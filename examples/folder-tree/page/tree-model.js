/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Folder Tree page — the model
 *
 * Everything the page knows, as plain data, and the steps that change it:
 * a message from the tile (`receive`), opening or closing a folder
 * (`toggle`), clicking a name (`pick`) and refreshing (`refresh`). Each step
 * returns the new state and, when the tile has to act, the message to send
 * it. `rows` flattens the open part of the tree into the lines the page
 * draws. No DOM here, so it is tested directly.
 *
 * Folders are kept by the path the page asked for; child paths are built
 * from the path Tilefold returned (links resolved).
 */

/** The page before the tile has said anything. */
export function initialState() {
  return {
    ready: false,
    lang: "en",
    dir: "ltr",
    strings: {},
    /** The folder the tree starts from, or null when none is known. */
    root: null,
    /** Its name, for the title. */
    name: "",
    /** Loaded folders: path → { path, entries, truncated } or { error }. */
    folders: {},
    /** Folders shown open (the root always is). */
    open: [],
    /** Folders asked for and not answered yet. */
    loading: [],
  };
}

/** The path of `name` inside `dir`, with the separator `dir` already uses. */
export function childPath(dir, name) {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

/** A level as kept: the listing, or the error that came instead. */
function level(message) {
  if (message.listing && Array.isArray(message.listing.entries)) {
    return {
      path: String(message.listing.path ?? message.path),
      entries: message.listing.entries,
      truncated: message.listing.truncated === true,
    };
  }
  return { error: String(message.error ?? "") };
}

const without = (list, item) => list.filter((x) => x !== item);

/** Applies a message from the tile. */
export function receive(state, message) {
  const m = message && typeof message === "object" ? message : {};
  if (m.do === "tree") {
    const root = typeof m.root === "string" && m.root ? m.root : null;
    return {
      ...initialState(),
      ready: true,
      lang: typeof m.lang === "string" ? m.lang : "en",
      dir: m.dir === "rtl" ? "rtl" : "ltr",
      strings: m.strings && typeof m.strings === "object" ? m.strings : {},
      root,
      name: String(m.name ?? ""),
      folders: root ? { [root]: level(m) } : {},
    };
  }
  if (m.do === "children" && typeof m.path === "string") {
    return {
      ...state,
      folders: { ...state.folders, [m.path]: level(m) },
      open: state.open.includes(m.path) ? state.open : [...state.open, m.path],
      loading: without(state.loading, m.path),
    };
  }
  return state;
}

/**
 * Opens or closes a folder; asks the tile for it the first time (shown
 * open, with a loading line, until the answer comes). Clicks on a folder
 * that is still loading are ignored.
 */
export function toggle(state, path) {
  if (state.loading.includes(path)) return { state };
  if (state.open.includes(path)) return { state: { ...state, open: without(state.open, path) } };
  if (state.folders[path]) return { state: { ...state, open: [...state.open, path] } };
  return {
    state: { ...state, open: [...state.open, path], loading: [...state.loading, path] },
    send: { do: "expand", path },
  };
}

/** A click on an entry of the folder at `parent` (the listing's own path). */
export function pick(state, parent, entry) {
  const path = childPath(parent, entry.name);
  if (entry.kind === "dir") return toggle(state, path);
  // A file opens in the viewer; a link is opened too, and the tile lists it
  // instead when it leads to a folder.
  if (entry.kind === "file" || entry.kind === "link") {
    if (entry.kind === "link" && state.folders[path]) return toggle(state, path);
    return { state, send: { do: "open", path } };
  }
  return { state };
}

/** Asks the tile for the whole tree again. */
export function refresh(state) {
  return { state: { ...state, loading: state.root ? [state.root] : [] }, send: { do: "refresh" } };
}

/**
 * The lines to draw, top to bottom: entries with their depth, plus a note
 * line where a folder is loading, empty, cut short or failed.
 */
export function rows(state) {
  const out = [];
  const walk = (key, depth) => {
    const f = state.folders[key];
    if (!f) {
      if (state.loading.includes(key)) out.push({ note: "loading", depth });
      return;
    }
    if (f.error !== undefined) return void out.push({ note: "error", text: f.error, depth });
    if (f.entries.length === 0) out.push({ note: "empty", depth });
    for (const entry of f.entries) {
      const path = childPath(f.path, entry.name);
      const open = state.open.includes(path);
      out.push({ path, parent: f.path, entry, depth, open, loading: state.loading.includes(path) });
      if (open) walk(path, depth + 1);
    }
    if (f.truncated) out.push({ note: "truncated", depth });
  };
  if (state.root) walk(state.root, 0);
  return out;
}
