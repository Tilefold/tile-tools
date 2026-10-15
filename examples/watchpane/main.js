/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane
 *
 * Plays YouTube videos in a window of its own: paste a link, or pick one of
 * the videos watched lately. The window is the tile's page (`page/`), which
 * runs YouTube's own embedded player; the tile opens and closes it, keeps
 * the recent list and the settings, and passes them to the page by
 * messages.
 *
 * It shows how a tile page can host a third party's embedded player:
 * - `page` plus `script:www.youtube.com` for YouTube's IFrame Player API;
 * - `net:` hosts for the player's frame (www.youtube-nocookie.com in
 *   private mode) and the thumbnails (i.ytimg.com);
 * - no keys and no sign-in: the tile never talks to YouTube itself.
 *
 * Needs Tilefold 0.1.10 or later (tile pages with a web address; 0.1.9
 * opened them without one). Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// page-src/links.js
var VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
var MAX_START = 24 * 60 * 60;
function isVideoId(id) {
  return typeof id === "string" && VIDEO_ID.test(id);
}

// src/tile/recent.js
var MAX_RECENT = 12;
var MAX_TITLE = 200;
var cleanTitle = (title) => typeof title === "string" ? title.trim().slice(0, MAX_TITLE) : "";
function readRecent(stored) {
  if (!Array.isArray(stored)) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const v of stored) {
    if (!v || !isVideoId(v.id) || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push({ id: v.id, title: cleanTitle(v.title) });
    if (out.length === MAX_RECENT) break;
  }
  return out;
}
function addRecent(list, video) {
  if (!video || !isVideoId(video.id)) return list;
  const entry = { id: video.id, title: cleanTitle(video.title) };
  return [entry, ...list.filter((v) => v.id !== entry.id)].slice(0, MAX_RECENT);
}

// src/tile/settings.js
var SETTINGS = [
  { key: "autoplay", default: true, label: "setting-autoplay" },
  { key: "captions", default: false, label: "setting-captions" },
  { key: "private", default: true, label: "setting-private" }
];
function registerSettings(tf) {
  for (const s of SETTINGS) tf.setting(s.key, s.default, tf.t(s.label));
}
function readOptions(settings) {
  const out = {};
  for (const s of SETTINGS) {
    let value;
    try {
      value = settings.get(s.key);
    } catch {
      value = void 0;
    }
    out[s.key] = typeof value === "boolean" ? value : s.default;
  }
  return (
    /** @type {any} */
    out
  );
}

// src/tile/run.js
var KEYS = { recent: "recent" };
var COMMANDS = [
  { id: "open", title: "cmd-open", key: { mac: "Ctrl+Alt+Y", other: "Ctrl+Alt+Y" } },
  { id: "toggle", title: "cmd-toggle" },
  { id: "close", title: "cmd-close" }
];
var STRINGS = {
  title: "page-title",
  link: "page-link",
  play: "page-play",
  recent: "page-recent",
  empty: "page-empty",
  loading: "page-loading",
  noPlayer: "page-no-player",
  badLink: "page-bad-link",
  errNotFound: "error-not-found",
  errNoEmbed: "error-no-embed",
  errConfig: "error-config",
  errOther: "error-other"
};
var FROM = ["link", "recent", "tile"];
function runWatchpane(tf) {
  let open = false;
  let recent = null;
  const quiet = (fn) => Promise.resolve().then(fn).catch(() => {
  });
  const warn = (text) => quiet(() => tf.log.warn(String(text).slice(0, 300)));
  const audit = (action, details) => quiet(() => tf.audit(action, details));
  const loadRecent = async () => {
    if (recent === null) recent = readRecent(await tf.store.get(KEYS.recent).catch(() => null));
    return recent;
  };
  const post = async (message) => {
    try {
      await tf.page.post(message);
    } catch {
    }
  };
  const setup = async () => {
    const strings = {};
    for (const [k, key] of Object.entries(STRINGS)) strings[k] = tf.t(key, { code: "{code}" });
    return post({
      do: "setup",
      lang: tf.t("page-lang"),
      dir: tf.t("page-dir") === "rtl" ? "rtl" : "ltr",
      strings,
      options: readOptions(tf.settings),
      recent: await loadRecent()
    });
  };
  const show = async () => {
    if (!tf.page) {
      await tf.toast(tf.t("toast-no-pages"));
      return;
    }
    await tf.page.open({ origin: "https" });
    if (!open) void audit("opened", {});
    open = true;
  };
  const close = async () => {
    if (!tf.page || !open) return;
    await tf.page.close();
  };
  const toggle = async () => {
    if (open) await post({ do: "toggle" });
    else await show();
  };
  const hear = async (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      await setup();
    } else if (message.type === "watching") {
      const before = await loadRecent();
      const after = addRecent(before, message);
      if (after === before) return;
      recent = after;
      await tf.store.set(KEYS.recent, recent).catch(() => {
      });
      void audit("video.start", { from: FROM.includes(message.from) ? message.from : "link" });
      await post({ do: "recent", recent });
    } else if (message.type === "error") {
      const code = message.code === "api" ? "api" : Number(message.code) || 0;
      void audit("video.error", { code });
      void warn(`player error ${code}`);
    }
  };
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch((err) => warn(err));
  const runs = { open: show, toggle, close };
  for (const c of COMMANDS) {
    tf.command(
      tf.t(c.title),
      background(() => runs[c.id]()),
      c.key ? { id: c.id, key: c.key } : { id: c.id }
    );
  }
  tf.on(
    "page.message",
    background((e) => hear(e && e.message))
  );
  tf.on(
    "page.closed",
    background(async () => {
      if (open) void audit("closed", {});
      open = false;
    })
  );
  tf.on(
    "setting.changed",
    background(async () => {
      if (open) await setup();
    })
  );
  return { state: () => ({ open, recent }) };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runWatchpane(tf);
};
export default main_default;
