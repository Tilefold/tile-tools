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
 * The player shows YouTube's own controls, at least 200 × 200, and stops
 * when the window closes, as YouTube's terms for embedded players ask.
 * In private mode the player comes from youtube-nocookie.com, which sets
 * no cookies until the user plays a video. All text goes in with
 * `textContent`, never as HTML, so a video's title can't change the page.
 */
import {
  apiFailed,
  apiReady,
  initialState,
  pick,
  playerError,
  receive,
  started,
  statusLine,
  submit,
} from "./watch-model.js";

/** YouTube's player script. */
const API_URL = "https://www.youtube.com/iframe_api";
/** How long to wait for it before saying it didn't load. */
const API_TIMEOUT_MS = 20_000;
/** YouTube's player state for "playing". */
const PLAYING = 1;

const bridge = window.tilefold;
let state = initialState();
/** YouTube's player, once made, and whether it was made in private mode. */
let player = null;
let playerPrivate = null;

const $ = (id) => document.getElementById(id);

/** Sends a message to the tile; a refused one (the tile is off) is dropped. */
const send = (message) => {
  if (message && bridge) bridge.post(message).catch(() => {});
};

/** Applies a step: new state, maybe a message, maybe a player action. */
function apply({ state: next, send: message, act }) {
  state = next;
  send(message);
  if (act) run(act);
  render();
}

// ------------------------------------------------------------ the player

/** Makes YouTube's player for `video`, in the mode the settings ask for. */
function makePlayer(video) {
  if (player) player.destroy();
  // The player replaces this element with its frame, so put a fresh one back.
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
      start: video.start || undefined,
    },
    events: {
      onStateChange: (e) => {
        if (e.data !== PLAYING) return;
        const data = typeof player.getVideoData === "function" ? player.getVideoData() : {};
        apply(started(state, data.video_id, data.title));
      },
      onError: (e) => apply(playerError(state, e.data)),
    },
  });
}

/** Runs one player action. */
function run(act) {
  if (!window.YT || !window.YT.Player) return;
  if (act.load) {
    // A change of private mode needs a new player from the other host.
    if (!player || playerPrivate !== state.options.private) return makePlayer(act.load);
    const args = { videoId: act.load.id, startSeconds: act.load.start || 0 };
    if (state.options.autoplay) player.loadVideoById(args);
    else player.cueVideoById(args);
  } else if (act.toggle && player) {
    if (player.getPlayerState() === PLAYING) player.pauseVideo();
    else player.playVideo();
  }
}

/** Loads YouTube's player script, which calls `onYouTubeIframeAPIReady` when done. */
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

// ------------------------------------------------------------ drawing

/** One recent video as a button: its picture and its title. */
function videoButton(v) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "video";
  if (state.current && state.current.id === v.id) button.classList.add("current");
  button.addEventListener("click", () => apply(pick(state, v.id)));
  const picture = document.createElement("img");
  // The id was checked to be 11 safe characters before it got here.
  picture.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  picture.alt = "";
  picture.loading = "lazy";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = v.title || v.id;
  button.append(picture, name);
  return button;
}

/** Draws the page from the state. */
function render() {
  const s = state.strings;
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.dir;
  if (s.title) document.title = s.title;
  $("link").placeholder = s.link ?? "";
  $("link").setAttribute("aria-label", s.link ?? "");
  $("play").textContent = s.play ?? "▶";

  const line = statusLine(state);
  $("status").textContent = line.text;
  $("status").classList.toggle("error", line.error);

  $("recent-box").hidden = state.recent.length === 0;
  $("recent-title").textContent = s.recent ?? "";
  $("recent").replaceChildren(...state.recent.map(videoButton));
}

// ------------------------------------------------------------ start

$("paste").addEventListener("submit", (e) => {
  e.preventDefault();
  const step = submit(state, $("link").value);
  if (step.state.current !== state.current) $("link").value = "";
  apply(step);
});

if (bridge) bridge.onMessage((message) => apply(receive(state, message)));
render();
loadApi();
// Say hello so the tile sends the text, the settings and the recent list.
send({ type: "hello" });
