/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane's page — on screen
 *
 * Loads YouTube's IFrame Player API (the `script:www.youtube.com`
 * permission), plays what the user pastes or picks, and tells the tile
 * through Tilefold's bridge (`window.tilefold`) what started and what
 * failed. Every decision is made in watch-model.js; this file only draws
 * the state and runs the player.
 *
 * The tile's card controls the player too (play, pause, skip, mute): the
 * page runs what it asks (`control`) and reports the player's state back
 * (`status`) when it changes, and every second while a video plays.
 *
 * The player shows YouTube's own controls, at least 200 × 200, and stops
 * when the window closes, as YouTube's terms for embedded players ask.
 * In private mode the player comes from youtube-nocookie.com, which sets
 * no cookies until the user plays a video. All text goes in with
 * `textContent`, never as HTML, so a video's title can't change the page.
 */
// Built by @tilefold/tile-tools from page-src/main.js. Edit the sources, then rebuild.
(() => {
  // page-src/links.js
  var VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  var HOSTS = /* @__PURE__ */ new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "youtu.be"
  ]);
  var ID_PATHS = ["shorts", "live", "embed", "v", "e"];
  var MAX_START = 24 * 60 * 60;
  function isVideoId(id) {
    return typeof id === "string" && VIDEO_ID.test(id);
  }
  function parseStart(value) {
    if (!value) return 0;
    const text = value.trim().toLowerCase();
    let seconds = 0;
    if (/^\d+s?$/.test(text)) {
      seconds = Number.parseInt(text, 10);
    } else {
      const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
      if (!parts || !parts[0]) return 0;
      seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
    }
    return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= MAX_START ? seconds : 0;
  }
  function parseVideoLink(input) {
    if (typeof input !== "string") return null;
    const text = input.trim();
    if (!text || text.length > 2048) return null;
    if (isVideoId(text)) return { id: text, start: 0 };
    let url;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (!HOSTS.has(host)) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    let id = null;
    if (host === "youtu.be") {
      id = segments[0] ?? null;
    } else if (segments[0] === "watch") {
      id = url.searchParams.get("v");
    } else if (ID_PATHS.includes(segments[0] ?? "")) {
      id = segments[1] ?? null;
    }
    if (!isVideoId(id)) return null;
    return { id, start: parseStart(url.searchParams.get("t") ?? url.searchParams.get("start")) };
  }

  // page-src/watch-model.js
  var ERROR_KINDS = {
    2: "badLink",
    100: "errNotFound",
    105: "errNotFound",
    101: "errNoEmbed",
    150: "errNoEmbed",
    152: "errConfig",
    153: "errConfig"
  };
  var CONTROLS = ["play", "pause", "toggle", "back", "forward", "mute", "unmute"];
  var SKIP_SECONDS = 10;
  function initialState() {
    return {
      configured: false,
      lang: "en",
      dir: "ltr",
      strings: {},
      options: { autoplay: true, captions: false, private: true },
      recent: [],
      /** Docked in Tilefold's window: only the player, and the link box when asked. */
      docked: false,
      /** Whether the docked page shows its link box. */
      pasting: false,
      /** YouTube's player script: "loading", "ready" or "failed". */
      api: "loading",
      /** The video picked last, and where it was picked from. */
      current: null,
      /** What the status line says: a string key, maybe with an error code. */
      status: null
    };
  }
  var none = (state2) => ({ state: state2, send: null, act: null });
  function cleanRecent(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((v) => v && isVideoId(v.id)).map((v) => ({ id: v.id, title: typeof v.title === "string" ? v.title : "" }));
  }
  function playVideo(state2, video, from) {
    const next = { ...state2, current: { ...video, from }, status: null };
    return { state: next, send: null, act: state2.api === "ready" ? { load: video } : null };
  }
  function receive(state2, message) {
    if (!message || typeof message !== "object") return none(state2);
    switch (message.do) {
      case "setup": {
        const o = message.options && typeof message.options === "object" ? message.options : {};
        return none({
          ...state2,
          configured: true,
          lang: typeof message.lang === "string" ? message.lang : state2.lang,
          dir: message.dir === "rtl" ? "rtl" : "ltr",
          strings: message.strings && typeof message.strings === "object" ? message.strings : {},
          options: {
            autoplay: o.autoplay !== false,
            captions: o.captions === true,
            private: o.private !== false
          },
          recent: cleanRecent(message.recent),
          docked: message.docked === true
        });
      }
      case "paste":
        return none({ ...state2, pasting: true });
      case "recent":
        return none({ ...state2, recent: cleanRecent(message.recent) });
      case "play":
        if (!isVideoId(message.id)) return none(state2);
        return playVideo(state2, { id: message.id, start: 0 }, "tile");
      case "toggle":
        return { state: state2, send: null, act: state2.current ? { toggle: true } : null };
      case "control":
        if (!CONTROLS.includes(message.action) || !state2.current) return none(state2);
        return { state: state2, send: null, act: { control: message.action } };
      default:
        return none(state2);
    }
  }
  function submit(state2, text) {
    const video = parseVideoLink(text);
    if (!video) return none({ ...state2, status: { key: "badLink" } });
    return playVideo({ ...state2, pasting: false }, video, "link");
  }
  function pick(state2, id) {
    if (!state2.recent.some((v) => v.id === id)) return none(state2);
    return playVideo(state2, { id, start: 0 }, "recent");
  }
  function apiReady(state2) {
    const next = { ...state2, api: "ready" };
    const c = state2.current;
    return { state: next, send: null, act: c ? { load: { id: c.id, start: c.start } } : null };
  }
  function apiFailed(state2) {
    return { state: { ...state2, api: "failed" }, send: { type: "error", code: "api" }, act: null };
  }
  function playerError(state2, code) {
    const n = Number(code);
    const safe = Number.isSafeInteger(n) ? n : 0;
    return {
      state: { ...state2, status: { key: ERROR_KINDS[safe] ?? "errOther", code: safe } },
      send: { type: "error", code: safe },
      act: null
    };
  }
  function started(state2, id, title) {
    const c = state2.current;
    if (!c || c.id !== id || c.reported) return none(state2);
    const clean = typeof title === "string" ? title.trim().slice(0, 200) : "";
    return {
      state: { ...state2, current: { ...c, reported: true }, status: null },
      send: { type: "watching", id, title: clean, from: c.from },
      act: null
    };
  }
  function statusLine(state2) {
    const s = state2.strings;
    const fill = (text, code) => String(text ?? "").replace("{code}", String(code ?? ""));
    if (state2.status) {
      return { text: fill(s[state2.status.key], state2.status.code), error: true };
    }
    if (state2.api === "failed") return { text: s.noPlayer ?? "", error: true };
    if (state2.api === "loading") return { text: s.loading ?? "", error: false };
    if (!state2.current && state2.recent.length === 0) return { text: s.empty ?? "", error: false };
    return { text: "", error: false };
  }
  function statusMessage(state2, snap) {
    const c = state2.current;
    const whole = (n) => Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 0;
    const title = typeof snap?.title === "string" ? snap.title.trim().slice(0, 200) : "";
    return {
      type: "status",
      id: c ? c.id : null,
      title,
      playing: snap?.playing === true,
      time: whole(snap?.time),
      duration: whole(snap?.duration),
      muted: snap?.muted === true
    };
  }
  var showsLinkBox = (state2) => state2.docked && (state2.pasting || !state2.current);

  // page-src/main.js
  var API_URL = "https://www.youtube.com/iframe_api";
  var API_TIMEOUT_MS = 2e4;
  var PLAYING = 1;
  var STATUS_MS = 1e3;
  var bridge = window.tilefold;
  var state = initialState();
  var player = null;
  var playerPrivate = null;
  var $ = (id) => document.getElementById(id);
  var send = (message) => {
    if (message && bridge) bridge.post(message).catch(() => {
    });
  };
  function apply({ state: next, send: message, act }) {
    state = next;
    send(message);
    if (act) run(act);
    render();
  }
  var ask = (name, fallback) => {
    try {
      return player && typeof player[name] === "function" ? player[name]() : fallback;
    } catch {
      return fallback;
    }
  };
  function report() {
    if (!state.current) return;
    const data = ask("getVideoData", {}) ?? {};
    send(
      statusMessage(state, {
        title: data.title,
        playing: ask("getPlayerState", -1) === PLAYING,
        time: ask("getCurrentTime", 0),
        duration: ask("getDuration", 0),
        muted: ask("isMuted", false)
      })
    );
  }
  setInterval(() => {
    if (ask("getPlayerState", -1) === PLAYING) report();
  }, STATUS_MS);
  function makePlayer(video) {
    if (player) player.destroy();
    const stage = document.querySelector(".stage");
    stage.replaceChildren(Object.assign(document.createElement("div"), { id: "player" }));
    playerPrivate = state.options.private;
    player = new window.YT.Player("player", {
      host: playerPrivate ? "https://www.youtube-nocookie.com" : "https://www.youtube.com",
      width: "100%",
      height: "100%",
      videoId: video.id,
      playerVars: {
        autoplay: state.options.autoplay ? 1 : 0,
        cc_load_policy: state.options.captions ? 1 : 0,
        playsinline: 1,
        rel: 0,
        start: video.start || void 0
      },
      events: {
        onStateChange: (e) => {
          report();
          if (e.data !== PLAYING) return;
          const data = typeof player.getVideoData === "function" ? player.getVideoData() : {};
          apply(started(state, data.video_id, data.title));
        },
        onError: (e) => apply(playerError(state, e.data))
      }
    });
  }
  function run(act) {
    if (!window.YT || !window.YT.Player) return;
    if (act.load) {
      if (!player || playerPrivate !== state.options.private) return makePlayer(act.load);
      const args = { videoId: act.load.id, startSeconds: act.load.start || 0 };
      if (state.options.autoplay) player.loadVideoById(args);
      else player.cueVideoById(args);
    } else if (act.toggle && player) {
      if (player.getPlayerState() === PLAYING) player.pauseVideo();
      else player.playVideo();
    } else if (act.control && player) {
      control(act.control);
    }
  }
  function control(action) {
    const now = ask("getCurrentTime", 0);
    if (action === "play") player.playVideo();
    else if (action === "pause") player.pauseVideo();
    else if (action === "toggle") run({ toggle: true });
    else if (action === "back") player.seekTo(Math.max(0, now - SKIP_SECONDS), true);
    else if (action === "forward") player.seekTo(now + SKIP_SECONDS, true);
    else if (action === "mute") player.mute();
    else if (action === "unmute") player.unMute();
    setTimeout(report, 150);
  }
  function loadApi() {
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      apply(apiFailed(state));
    };
    window.onYouTubeIframeAPIReady = () => {
      if (settled) return;
      settled = true;
      apply(apiReady(state));
    };
    const script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.addEventListener("error", fail);
    document.head.append(script);
    setTimeout(fail, API_TIMEOUT_MS);
  }
  function videoButton(v) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "video";
    if (state.current && state.current.id === v.id) button.classList.add("current");
    button.addEventListener("click", () => apply(pick(state, v.id)));
    const picture = document.createElement("img");
    picture.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
    picture.alt = "";
    picture.loading = "lazy";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = v.title || v.id;
    button.append(picture, name);
    return button;
  }
  function render() {
    const s = state.strings;
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.dir;
    if (s.title) document.title = s.title;
    $("link").placeholder = s.link ?? "";
    $("link").setAttribute("aria-label", s.link ?? "");
    $("play").textContent = s.play ?? "\u25B6";
    document.body.classList.toggle("docked", state.docked);
    document.body.classList.toggle("pasting", showsLinkBox(state));
    const line = statusLine(state);
    $("status").textContent = line.text;
    $("status").classList.toggle("error", line.error);
    $("recent-box").hidden = state.recent.length === 0;
    $("recent-title").textContent = s.recent ?? "";
    $("recent").replaceChildren(...state.recent.map(videoButton));
  }
  $("paste").addEventListener("submit", (e) => {
    e.preventDefault();
    const step = submit(state, $("link").value);
    if (step.state.current !== state.current) $("link").value = "";
    apply(step);
  });
  if (bridge) bridge.onMessage((message) => apply(receive(state, message)));
  render();
  loadApi();
  send({ type: "hello" });
})();
