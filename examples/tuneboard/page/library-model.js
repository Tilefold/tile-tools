/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard's Library page — its state
 *
 * What the Library window shows, kept apart from the page's HTML so it can
 * be tested on its own. `receive` applies a message from the tile (show the
 * Library, a page of playlists, an error, "now playing"); `refresh`, `more`,
 * `play` and `setView` (thumbnails or list) are the user's clicks. Each returns the new state and, when the
 * tile must be asked for something, the message to send it. State is never
 * changed in place.
 */

/** The ways the Library lists playlists: thumbnails or rows. */
export const VIEWS = Object.freeze(["grid", "list"]);

/** The Library before the tile has said anything: hidden and empty. */
export function initialState() {
  return {
    shown: false,
    lang: "en",
    dir: "ltr",
    view: "grid",
    strings: {},
    items: [],
    total: 0,
    nextOffset: null,
    loading: false,
    error: null,
    playing: null,
    notice: null,
  };
}

/** Asks the tile for playlists from `offset`, marking the Library as loading. */
function ask(state, offset) {
  return {
    state: { ...state, loading: true, error: null },
    send: { type: "want-playlists", offset },
  };
}

/** Adds a page of playlists, skipping ones already listed. */
function addPage(state, message) {
  const fresh = message.offset === 0;
  const known = new Set(fresh ? [] : state.items.map((p) => p.uri));
  const added = (Array.isArray(message.items) ? message.items : []).filter(
    (p) => p && typeof p.uri === "string" && !known.has(p.uri) && known.add(p.uri),
  );
  return {
    ...state,
    items: fresh ? added : [...state.items, ...added],
    total: Number.isSafeInteger(message.total) ? message.total : state.total,
    nextOffset: Number.isSafeInteger(message.nextOffset) ? message.nextOffset : null,
    loading: false,
    error: null,
  };
}

/**
 * Applies one message from the tile.
 *
 * @param {ReturnType<typeof initialState>} state
 * @param {any} message
 * @returns {{ state: ReturnType<typeof initialState>, send: object|null }}
 */
export function receive(state, message) {
  if (!message || typeof message !== "object") return { state, send: null };
  switch (message.do) {
    case "library": {
      // Shown (again): take the user's language and load the list afresh.
      const next = {
        ...state,
        shown: true,
        lang: typeof message.lang === "string" ? message.lang : state.lang,
        dir: message.dir === "rtl" ? "rtl" : "ltr",
        view: VIEWS.includes(message.view) ? message.view : state.view,
        strings: message.strings && typeof message.strings === "object" ? message.strings : {},
      };
      return ask(next, 0);
    }
    case "playlists":
      return { state: addPage(state, message), send: null };
    case "library-error":
      return {
        state: { ...state, loading: false, error: String(message.message ?? "") },
        send: null,
      };
    case "playing":
      return {
        state: { ...state, playing: message.uri, notice: String(message.message ?? "") },
        send: null,
      };
    default:
      return { state, send: null };
  }
}

/** The user asks for the list again. */
export function refresh(state) {
  return state.loading ? { state, send: null } : ask(state, 0);
}

/** The user asks for more playlists. */
export function more(state) {
  if (state.loading || state.nextOffset === null) return { state, send: null };
  return ask(state, state.nextOffset);
}

/** The user switches between thumbnails and list; the tile remembers it. */
export function setView(state, view) {
  if (!VIEWS.includes(view) || view === state.view) return { state, send: null };
  return { state: { ...state, view }, send: { type: "set-view", view } };
}

/** The user picks a playlist to play. */
export function play(state, uri) {
  if (!state.items.some((p) => p.uri === uri)) return { state, send: null };
  return { state: { ...state, error: null, notice: null }, send: { type: "play-playlist", uri } };
}

/** The line under the header: the error, the notice, "loading" or "empty". */
export function statusLine(state) {
  if (state.error) return { text: state.error, error: true };
  if (state.loading && state.items.length === 0) return { text: state.strings.loading ?? "" };
  if (!state.loading && state.items.length === 0) return { text: state.strings.empty ?? "" };
  return { text: state.notice ?? "" };
}
