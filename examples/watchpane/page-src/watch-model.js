/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane's page — its state
 *
 * What the Watchpane window shows and does, kept apart from the HTML and
 * from YouTube's player so it can be tested on its own. Each function takes
 * the state and returns the next one (never changing it in place), with:
 *
 * - `send`: a message for the tile, or null;
 * - `act`: what the player should do, or null: `{ load: { id, start } }`
 *   to play a video, `{ toggle: true }` to play or pause.
 *
 * `receive` applies a message from the tile; `submit` and `pick` are the
 * user's paste and click; `apiReady`, `apiFailed`, `playerError` and
 * `started` are what YouTube's player reports.
 */
import { isVideoId, parseVideoLink } from "./links.js";

/** YouTube player error codes, grouped by what the user is told. */
const ERROR_KINDS = {
  2: "badLink",
  100: "errNotFound",
  105: "errNotFound",
  101: "errNoEmbed",
  150: "errNoEmbed",
  152: "errConfig",
  153: "errConfig",
};

/** The page before the tile has said anything. */
export function initialState() {
  return {
    configured: false,
    lang: "en",
    dir: "ltr",
    strings: {},
    options: { autoplay: true, captions: false, private: true },
    recent: [],
    /** YouTube's player script: "loading", "ready" or "failed". */
    api: "loading",
    /** The video picked last, and where it was picked from. */
    current: null,
    /** What the status line says: a string key, maybe with an error code. */
    status: null,
  };
}

/** A step that changes nothing. */
const none = (state) => ({ state, send: null, act: null });

/** Keeps only well-formed recent entries: { id, title }. */
function cleanRecent(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((v) => v && isVideoId(v.id))
    .map((v) => ({ id: v.id, title: typeof v.title === "string" ? v.title : "" }));
}

/** Plays `video` once the player can, remembering where it was picked. */
function playVideo(state, video, from) {
  const next = { ...state, current: { ...video, from }, status: null };
  return { state: next, send: null, act: state.api === "ready" ? { load: video } : null };
}

/**
 * Applies one message from the tile.
 *
 * @param {ReturnType<typeof initialState>} state
 * @param {any} message
 */
export function receive(state, message) {
  if (!message || typeof message !== "object") return none(state);
  switch (message.do) {
    case "setup": {
      const o = message.options && typeof message.options === "object" ? message.options : {};
      return none({
        ...state,
        configured: true,
        lang: typeof message.lang === "string" ? message.lang : state.lang,
        dir: message.dir === "rtl" ? "rtl" : "ltr",
        strings: message.strings && typeof message.strings === "object" ? message.strings : {},
        options: {
          autoplay: o.autoplay !== false,
          captions: o.captions === true,
          private: o.private !== false,
        },
        recent: cleanRecent(message.recent),
      });
    }
    case "recent":
      return none({ ...state, recent: cleanRecent(message.recent) });
    case "play":
      if (!isVideoId(message.id)) return none(state);
      return playVideo(state, { id: message.id, start: 0 }, "tile");
    case "toggle":
      return { state, send: null, act: state.current ? { toggle: true } : null };
    default:
      return none(state);
  }
}

/** The user pasted a link (or an id) and pressed Play. */
export function submit(state, text) {
  const video = parseVideoLink(text);
  if (!video) return none({ ...state, status: { key: "badLink" } });
  return playVideo(state, video, "link");
}

/** The user clicked a video in the recent list. */
export function pick(state, id) {
  if (!state.recent.some((v) => v.id === id)) return none(state);
  return playVideo(state, { id, start: 0 }, "recent");
}

/** YouTube's player script has loaded: play what was picked meanwhile. */
export function apiReady(state) {
  const next = { ...state, api: "ready" };
  const c = state.current;
  return { state: next, send: null, act: c ? { load: { id: c.id, start: c.start } } : null };
}

/** YouTube's player script didn't load (offline, or refused). */
export function apiFailed(state) {
  return { state: { ...state, api: "failed" }, send: { type: "error", code: "api" }, act: null };
}

/** The player reported an error code for the current video. */
export function playerError(state, code) {
  const n = Number(code);
  const safe = Number.isSafeInteger(n) ? n : 0;
  return {
    state: { ...state, status: { key: ERROR_KINDS[safe] ?? "errOther", code: safe } },
    send: { type: "error", code: safe },
    act: null,
  };
}

/** The current video started playing; YouTube told the page its title. */
export function started(state, id, title) {
  const c = state.current;
  if (!c || c.id !== id || c.reported) return none(state);
  const clean = typeof title === "string" ? title.trim().slice(0, 200) : "";
  return {
    state: { ...state, current: { ...c, reported: true }, status: null },
    send: { type: "watching", id, title: clean, from: c.from },
    act: null,
  };
}

/** The status line: text and whether it is an error. Empty when all is well. */
export function statusLine(state) {
  const s = state.strings;
  const fill = (text, code) => String(text ?? "").replace("{code}", String(code ?? ""));
  if (state.status) {
    return { text: fill(s[state.status.key], state.status.code), error: true };
  }
  if (state.api === "failed") return { text: s.noPlayer ?? "", error: true };
  if (state.api === "loading") return { text: s.loading ?? "", error: false };
  if (!state.current && state.recent.length === 0) return { text: s.empty ?? "", error: false };
  return { text: "", error: false };
}
