/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tuneboard — Spotify's now playing as a Tilefold tile
 *
 * Shows what Spotify is playing in a card in the corner of your pane, with
 * buttons for previous, play/pause, next and volume, and Ctrl+Alt
 * shortcuts (⌃⌥ on macOS) that work even while the card is hidden.
 * Tilefold draws the card as an overlay (permission window.overlay), so
 * the tile never sees your typing or your terminal.
 *
 * It talks to Spotify through Tilefold (`tf.net.fetch`, permission
 * net:api.spotify.com). The user signs in to Spotify under Keys on the
 * tile's card in Settings → Tiles, with their own Spotify app; Tilefold
 * keeps the token in the system keychain and adds it to each request, so
 * the tile never sees it. On a Tilefold without these, the card says so
 * and nothing is sent anywhere.
 *
 * This entry registers the settings, then hands over to the tile code
 * with the Spotify client plugged in. Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/spotify/errors.js
var SpotifyError = class extends Error {
  constructor(code, message, { status, retryAfterMs: retryAfterMs2, cause } = {}) {
    super(message, { cause });
    this.name = "SpotifyError";
    this.code = code;
    if (status !== void 0) this.status = status;
    if (retryAfterMs2 !== void 0) this.retryAfterMs = retryAfterMs2;
  }
};
function networkError(cause) {
  return new SpotifyError("network", "Could not reach Spotify", { cause });
}
var HOST_CODES = {
  CredentialMissingError: "auth",
  PermissionDeniedError: "no-network",
  NetworkPolicyError: "no-network",
  RateLimitError: "rate-limit",
  TimeoutError: "network",
  NetworkError: "network",
  TooLargeError: "server"
};
function hostError(err) {
  const code = err && typeof err.name === "string" ? HOST_CODES[err.name] : void 0;
  if (!code) return null;
  return new SpotifyError(code, String(err.message || err.name), { cause: err });
}
function header(headers, name) {
  if (!headers) return void 0;
  if (typeof headers.get === "function") return headers.get(name) ?? void 0;
  return headers[name.toLowerCase()];
}
function retryAfterMs(value, now) {
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1e3;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now()) : void 0;
}
async function responseError(response, { now = Date.now } = {}) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const detail = body?.error;
  const reason = typeof detail === "string" ? detail : detail?.reason;
  const message = body?.error_description || detail?.message || "Spotify request failed";
  const status = response.status;
  let code = "unknown";
  if (status === 401) code = "auth";
  else if (status === 403 && reason === "PREMIUM_REQUIRED") code = "premium";
  else if (status === 404 && reason === "NO_ACTIVE_DEVICE") code = "no-device";
  else if (status === 429) code = "rate-limit";
  else if (status >= 500) code = "server";
  return new SpotifyError(code, message, {
    status,
    retryAfterMs: code === "rate-limit" ? retryAfterMs(header(response.headers, "Retry-After"), now) : void 0
  });
}

// src/spotify/client.js
var PLAYER_URL = "https://api.spotify.com/v1/me/player";
var AUTH_NAME = "spotify";
function playbackModel(data) {
  const item = data.item;
  return {
    isPlaying: Boolean(data.is_playing),
    track: item ? {
      title: item.name ?? "",
      artists: Array.isArray(item.artists) ? item.artists.map((artist) => artist.name).filter(Boolean) : [],
      album: item.album?.name ?? "",
      durationMs: item.duration_ms ?? 0
    } : null,
    progressMs: data.progress_ms ?? 0,
    device: data.device ? { name: data.device.name ?? "", volume: data.device.volume_percent ?? null } : null,
    shuffle: Boolean(data.shuffle_state),
    repeat: data.repeat_state ?? "off"
  };
}
function createSpotify({ fetchFn, now = Date.now } = {}) {
  if (typeof fetchFn !== "function") throw new TypeError("fetchFn is required");
  async function request(path = "", { method = "GET", query, body } = {}) {
    const url = new URL(PLAYER_URL + path);
    if (query)
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    const init = { method, auth: AUTH_NAME };
    if (body !== void 0) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetchFn(url.toString(), init);
    } catch (cause) {
      throw hostError(cause) ?? networkError(cause);
    }
    if (!response.ok) throw await responseError(response, { now });
    if (response.status === 204) return null;
    if (method === "GET") return response.json();
    return void 0;
  }
  const nonnegativeMs = (value) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError("Position must be a nonnegative integer in milliseconds");
    return value;
  };
  return {
    async getPlayback() {
      const data = await request();
      return data === null ? null : playbackModel(data);
    },
    play: () => request("/play", { method: "PUT" }),
    pause: () => request("/pause", { method: "PUT" }),
    next: () => request("/next", { method: "POST" }),
    previous: () => request("/previous", { method: "POST" }),
    setVolume(volume) {
      if (!Number.isInteger(volume) || volume < 0 || volume > 100)
        throw new RangeError("Volume must be an integer from 0 to 100");
      return request("/volume", { method: "PUT", query: { volume_percent: volume } });
    },
    seek(ms) {
      return request("/seek", { method: "PUT", query: { position_ms: nonnegativeMs(ms) } });
    },
    setShuffle(enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("Shuffle must be a boolean");
      return request("/shuffle", { method: "PUT", query: { state: enabled } });
    }
  };
}

// src/render/svg.js
var MAX_SIDE = 256;
var THEME = {
  panel: "#121212",
  panelOpacity: 0.94,
  border: "#2a2a2a",
  track: "#3a3a3a",
  text: "#f5f5f5",
  muted: "#a3a3a3",
  accent: "#1db954",
  warn: "#f59e0b",
  error: "#ef4444"
};
var FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";
function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function svgUrl(logicalW, logicalH, body, displayW = logicalW, displayH = logicalH) {
  const w = Math.min(MAX_SIDE, round2(displayW));
  const h = Math.min(MAX_SIDE, round2(displayH));
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${logicalW} ${logicalH}">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}
function isWide(cp) {
  return cp >= 4352 && cp <= 4607 || cp >= 11904 && cp <= 42191 || cp >= 44032 && cp <= 55203 || cp >= 63744 && cp <= 64255 || cp >= 65280 && cp <= 65376;
}
function textWidth(text, size) {
  let em = 0;
  for (const ch of String(text)) em += isWide(ch.codePointAt(0) ?? 0) ? 1 : 0.6;
  return em * size;
}
function ellipsize(text, size, maxWidth) {
  const s = String(text);
  if (textWidth(s, size) <= maxWidth) return s;
  const chars = [...s];
  while (chars.length > 0 && textWidth(chars.join("") + "\u2026", size) > maxWidth) chars.pop();
  return chars.join("").trimEnd() + "\u2026";
}
function textEl(o) {
  let text = String(o.text);
  const anchor = o.anchor ?? "start";
  const fill = o.fill ?? THEME.text;
  const weight = o.weight ?? 400;
  let fit = "";
  if (o.maxWidth && textWidth(text, o.size) > o.maxWidth) {
    if (o.squeeze) fit = ` textLength="${round2(o.maxWidth)}" lengthAdjust="spacingAndGlyphs"`;
    else text = ellipsize(text, o.size, o.maxWidth);
  }
  const opacity = o.opacity === void 0 ? "" : ` opacity="${o.opacity}"`;
  return `<text x="${round2(o.x)}" y="${round2(o.y)}" font-size="${o.size}" font-family="${FONT}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${opacity}${fit}>${escapeXml(text)}</text>`;
}

// src/render/buttons.js
var BUTTON = 28;
var BUTTONS = [
  { id: "previous", action: "previous", label: "button-previous" },
  { id: "play", action: "playPause", label: "button-play" },
  { id: "next", action: "next", label: "button-next" },
  { id: "volume-down", action: "volumeDown", label: "button-volume-down" },
  { id: "volume-up", action: "volumeUp", label: "button-volume-up" }
];
var ICONS = {
  previous: `<rect x="8" y="9" width="2.4" height="10" rx="1" fill="${THEME.text}"/><path d="M20 9 L11.5 14 L20 19 Z" fill="${THEME.text}"/>`,
  next: `<rect x="17.6" y="9" width="2.4" height="10" rx="1" fill="${THEME.text}"/><path d="M8 9 L16.5 14 L8 19 Z" fill="${THEME.text}"/>`,
  play: `<path d="M11 8 L20 14 L11 20 Z" fill="${THEME.accent}"/>`,
  pause: `<rect x="9.5" y="8.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/><rect x="15.3" y="8.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/>`,
  "volume-down": `<path d="M7 11.5 H10 L14 8.5 V19.5 L10 16.5 H7 Z" fill="${THEME.text}"/><path d="M17 14 H22" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>`,
  "volume-up": `<path d="M6 11.5 H9 L13 8.5 V19.5 L9 16.5 H6 Z" fill="${THEME.text}"/><path d="M16 14 H22 M19 11 V17" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>`
};
function renderButton(icon, opts = {}) {
  const art = ICONS[icon] ?? "";
  const body = `<rect x="0.5" y="0.5" width="${BUTTON - 1}" height="${BUTTON - 1}" rx="7" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/><g opacity="${opts.dim ? 0.35 : 1}">${art}</g>`;
  const size = opts.displaySize ?? BUTTON;
  return svgUrl(BUTTON, BUTTON, body, size, size);
}
function iconFor(id, playing) {
  if (id === "play") return playing ? "pause" : "play";
  return id;
}

// src/render/card.js
var CARD_W = 208;
var CARD_H = 72;
var TEXT_X = 54;
var TEXT_W = CARD_W - TEXT_X - 12;
var TONES = { info: THEME.accent, warn: THEME.warn, error: THEME.error };
function wrapLines(text, size, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  const flush = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of words) {
    const joined = line ? `${line} ${word}` : word;
    if (textWidth(joined, size) <= maxWidth) {
      line = joined;
      continue;
    }
    flush();
    let piece = "";
    for (const ch of word) {
      if (textWidth(piece + ch, size) > maxWidth && piece) {
        lines.push(piece);
        piece = "";
      }
      piece += ch;
    }
    line = piece;
  }
  flush();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, size, maxWidth);
  return kept;
}
function noteIcon(x, y, color, opacity) {
  return `<g transform="translate(${x} ${y})" opacity="${opacity}"><rect width="32" height="32" rx="6" fill="${color}" fill-opacity="0.16"/><path d="M13 22 V10 L23 8 V20" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="11" cy="22" r="3" fill="${color}"/><circle cx="21" cy="20" r="3" fill="${color}"/></g>`;
}
function alertIcon(x, y, color) {
  return `<g transform="translate(${x} ${y})"><circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/><rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/><circle cx="16" cy="23.5" r="1.6" fill="${color}"/></g>`;
}
function frame() {
  return `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="10" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`;
}
function clampProgress(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
function renderCard(view, opts = {}) {
  let body = frame();
  if (view.mode === "track") {
    const p = clampProgress(view.progress);
    const barW = TEXT_W;
    body += noteIcon(12, 12, THEME.accent, view.playing ? 1 : 0.5) + textEl({ x: TEXT_X, y: 22, text: view.title, size: 13, weight: 600, maxWidth: TEXT_W }) + textEl({
      x: TEXT_X,
      y: 37,
      text: view.artists,
      size: 11,
      fill: THEME.muted,
      maxWidth: TEXT_W
    }) + textEl({
      x: TEXT_X,
      y: 51,
      text: view.detail,
      size: 9,
      fill: THEME.muted,
      maxWidth: TEXT_W
    }) + `<rect x="${TEXT_X}" y="58" width="${barW}" height="3" rx="1.5" fill="${THEME.track}"/><rect x="${TEXT_X}" y="58" width="${round2(barW * p)}" height="3" rx="1.5" fill="${THEME.accent}"/>`;
  } else {
    const color = TONES[view.tone] ?? THEME.accent;
    const icon = view.tone === "info" ? noteIcon(12, 12, color, 1) : alertIcon(12, 12, color);
    const hint = wrapLines(view.hint, 10, TEXT_W, 3);
    body += icon + textEl({
      x: TEXT_X,
      y: 22,
      text: view.title,
      size: 12,
      weight: 600,
      maxWidth: TEXT_W,
      squeeze: true
    }) + hint.map(
      (line, i) => textEl({ x: TEXT_X, y: 37 + i * 12, text: line, size: 10, fill: THEME.muted })
    ).join("");
  }
  return svgUrl(CARD_W, CARD_H, body, opts.displayW ?? CARD_W, opts.displayH ?? CARD_H);
}

// src/tile/scene.js
var SIZES = { small: 0.8, medium: 1 };
var CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
var GAP = 6;
var MARGIN = 12;
var GROUP_W = CARD_W;
var GROUP_H = CARD_H + GAP + BUTTON;
function scaleOf(size) {
  return SIZES[
    /** @type {string} */
    size
  ] ?? SIZES.medium;
}
function cornerOf(corner) {
  return CORNERS.includes(
    /** @type {string} */
    corner
  ) ? (
    /** @type {string} */
    corner
  ) : "bottom-right";
}
function homePane(layout) {
  const panes = layout && Array.isArray(layout.panes) ? layout.panes : [];
  return panes.find((p) => p && p.focused) || panes[0] || null;
}
function areaOf(layout) {
  const pane = homePane(layout);
  if (pane) {
    const bottom = pane.composer ? pane.composer.y : pane.y + pane.h;
    return { x: pane.x, y: pane.y, w: pane.w, h: Math.max(0, bottom - pane.y) };
  }
  const content = layout && layout.content || { w: 800, h: 600 };
  return { x: 0, y: 0, w: content.w, h: content.h };
}
function computeLayout(layout, settings = {}) {
  const scale = scaleOf(settings.size);
  const corner = cornerOf(settings.corner);
  const area = areaOf(layout);
  const w = Math.round(GROUP_W * scale);
  const h = Math.round(GROUP_H * scale);
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  const gx = Math.max(0, Math.round(right ? area.x + area.w - w - MARGIN : area.x + MARGIN));
  const gy = Math.max(0, Math.round(bottom ? area.y + area.h - h - MARGIN : area.y + MARGIN));
  const rects = { card: { x: gx, y: gy, w, h: Math.round(CARD_H * scale) } };
  const btn = Math.round(BUTTON * scale);
  const rowY = Math.round(gy + (CARD_H + GAP) * scale);
  const step = BUTTONS.length > 1 ? (w - btn) / (BUTTONS.length - 1) : 0;
  BUTTONS.forEach((b, i) => {
    rects[`btn-${b.id}`] = { x: Math.round(gx + i * step), y: rowY, w: btn, h: btn };
  });
  return rects;
}

// src/tile/settings.js
var CORNER_LABELS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left"
};
var SETTINGS = [
  {
    key: "size",
    default: "medium",
    label: "setting-size",
    choices: [
      { value: "medium", label: "setting-size-medium" },
      { value: "small", label: "setting-size-small" }
    ]
  },
  {
    key: "corner",
    default: "bottom-right",
    label: "setting-corner",
    choices: CORNERS.map((c) => ({ value: c, label: CORNER_LABELS[c] }))
  },
  { key: "poll", default: true, label: "setting-poll" }
];
var LAYOUT_KEYS = ["size", "corner"];
function registerSettings(tf) {
  for (const s of SETTINGS) {
    const options = s.choices ? { choices: s.choices.map((c) => ({ value: c.value, label: tf.t(c.label) })) } : void 0;
    if (options) tf.setting(s.key, s.default, tf.t(s.label), options);
    else tf.setting(s.key, s.default, tf.t(s.label));
  }
}
function readSettings(settings) {
  const get = (key) => {
    try {
      return settings.get(key);
    } catch {
      return void 0;
    }
  };
  const corner = get("corner");
  return {
    size: get("size") === "small" ? "small" : "medium",
    corner: CORNERS.includes(
      /** @type {string} */
      corner
    ) ? (
      /** @type {string} */
      corner
    ) : "bottom-right",
    poll: get("poll") !== false
  };
}

// src/tile/audit.js
var ACTIONS = Object.freeze([
  "view.show",
  "view.hide",
  "control.play",
  "control.pause",
  "control.previous",
  "control.next",
  "control.volume",
  "control.refresh",
  "state.change",
  "auth.failed",
  "auth.connected",
  "auth.legacy-cleared"
]);
var DETAIL_KEYS = Object.freeze(["from", "to", "volume", "ok", "code", "via"]);
function cleanDetails(details) {
  const out = {};
  for (const [k, v] of Object.entries(details || {})) {
    if (!DETAIL_KEYS.includes(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 24);
  }
  return out;
}
function createTrail(tf) {
  const quiet = (call) => {
    try {
      void Promise.resolve(call()).catch(() => {
      });
    } catch {
    }
  };
  return {
    record(action, details = {}) {
      if (!ACTIONS.includes(action)) return;
      const clean = cleanDetails(details);
      quiet(() => tf.audit(action, clean));
      quiet(() => tf.log.info(`${action} ${JSON.stringify(clean)}`));
    },
    info(text) {
      quiet(() => tf.log.info(String(text)));
    },
    error(err) {
      const e = (
        /** @type {any} */
        err
      );
      const text = e && e.code ? `${e.code}: ${e.message ?? ""}` : String(e && e.message || e);
      quiet(() => tf.log.error(text.slice(0, 200)));
    }
  };
}

// src/tile/commands.js
var COMMANDS = [
  {
    id: "toggle",
    title: "cmd-toggle",
    action: "toggle",
    key: { mac: "Ctrl+Alt+M", other: "Ctrl+Alt+M" }
  },
  {
    id: "play-pause",
    title: "cmd-play-pause",
    action: "playPause",
    key: { mac: "Ctrl+Alt+K", other: "Ctrl+Alt+K" }
  },
  {
    id: "previous",
    title: "cmd-previous",
    action: "previous",
    key: { mac: "Ctrl+Alt+B", other: "Ctrl+Alt+B" }
  },
  {
    id: "next",
    title: "cmd-next",
    action: "next",
    key: { mac: "Ctrl+Alt+X", other: "Ctrl+Alt+X" }
  },
  {
    id: "volume-up",
    title: "cmd-volume-up",
    action: "volumeUp",
    key: { mac: "Ctrl+Alt+U", other: "Ctrl+Alt+U" }
  },
  {
    id: "volume-down",
    title: "cmd-volume-down",
    action: "volumeDown",
    key: { mac: "Ctrl+Alt+D", other: "Ctrl+Alt+D" }
  },
  {
    id: "refresh",
    title: "cmd-refresh",
    action: "refresh",
    key: { mac: "Ctrl+Alt+R", other: "Ctrl+Alt+R" }
  }
];
function registerCommands(tf, run) {
  for (const c of COMMANDS) {
    tf.command(tf.t(c.title), () => run(c.action), { id: c.id, key: c.key });
  }
}

// src/tile/poller.js
var MIN_WAIT_MS = 250;
function createPoller(o) {
  const setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((h) => clearTimeout(h));
  let handle = null;
  let running = false;
  let busy = false;
  const cancel = () => {
    if (handle !== null) clearTimer(handle);
    handle = null;
  };
  const wait = (ms) => {
    cancel();
    handle = setTimer(
      () => {
        handle = null;
        void ask();
      },
      Math.max(MIN_WAIT_MS, ms)
    );
  };
  const ask = async () => {
    if (!running || busy) return;
    busy = true;
    try {
      await o.tick();
    } catch (err) {
      if (o.onError) o.onError(err);
    } finally {
      busy = false;
    }
    if (!running || handle !== null) return;
    const next = o.delay();
    if (next !== null && Number.isFinite(next)) wait(next);
  };
  return {
    /** Starts polling with an ask right away. */
    start() {
      if (running) return;
      running = true;
      void ask();
    },
    stop() {
      running = false;
      cancel();
    },
    /** Asks after `ms` (default at once), replacing the current wait. */
    soon(ms = 0) {
      if (!running) return;
      wait(ms);
    },
    get running() {
      return running;
    },
    /** True while a next ask is scheduled. */
    get waiting() {
      return handle !== null;
    }
  };
}

// src/tile/session.js
var STATES = Object.freeze([
  "no-network",
  "signed-out",
  "connecting",
  "no-device",
  "playing",
  "paused",
  "premium",
  "error"
]);
var CONTROL_STATES = Object.freeze(["playing", "paused", "no-device", "premium", "error"]);
var POLL_MS = 5e3;
var MAX_BACKOFF_MS = 6e4;
var VOLUME_STEP = 10;
function clampInt(value, min, max, fallback) {
  if (value === null || value === void 0 || value === "") return fallback;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function cleanPlayback(p) {
  if (!p || typeof p !== "object") return null;
  const track = p.track && typeof p.track === "object" ? p.track : null;
  if (!track) return null;
  const artists = Array.isArray(track.artists) ? track.artists.map(String).filter(Boolean) : [];
  const durationMs = clampInt(track.durationMs, 0, 24 * 3600 * 1e3, 0) ?? 0;
  return {
    isPlaying: p.isPlaying === true,
    title: typeof track.title === "string" ? track.title : "",
    artists,
    durationMs,
    progressMs: clampInt(p.progressMs, 0, durationMs || 24 * 3600 * 1e3, 0) ?? 0,
    device: p.device && typeof p.device.name === "string" ? p.device.name : "",
    volume: p.device ? clampInt(p.device.volume, 0, 100, null) : null
  };
}
function createSession(o = {}) {
  const now = o.now ?? (() => Date.now());
  let client = null;
  let status = "no-network";
  let playback = null;
  let fetchedAt = 0;
  let failures = 0;
  let retryAfter = null;
  let lastCode = "";
  const go = (next) => {
    if (next === status) return;
    const from = status;
    status = next;
    if (o.onState) o.onState(from, next);
  };
  const changed = () => {
    if (o.onChange) o.onChange();
  };
  const applyPlayback = (raw) => {
    failures = 0;
    retryAfter = null;
    lastCode = "";
    playback = cleanPlayback(raw);
    fetchedAt = now();
    if (!playback) go("no-device");
    else go(playback.isPlaying ? "playing" : "paused");
  };
  const applyError = (err) => {
    const code = err && typeof err.code === "string" && err.code || "unknown";
    lastCode = code;
    if (code === "auth") {
      playback = null;
      go("signed-out");
    } else if (code === "premium") {
      go("premium");
    } else if (code === "no-device") {
      playback = null;
      go("no-device");
    } else if (code === "rate-limit") {
      const after = Number(err && err.retryAfterMs);
      retryAfter = Number.isFinite(after) && after > 0 ? after : POLL_MS * 2;
    } else {
      failures += 1;
      go("error");
    }
    return code;
  };
  const session = {
    get status() {
      return status;
    },
    get lastCode() {
      return lastCode;
    },
    /** True when a client is set and Spotify can be asked. */
    get connected() {
      return client !== null;
    },
    /**
     * Sets (or clears) the Spotify client. With none, `reason` says why:
     * "no-network" or "signed-out".
     *
     * @param {any} next
     * @param {"no-network"|"signed-out"} [reason]
     */
    setClient(next, reason = "signed-out") {
      client = next ?? null;
      playback = null;
      failures = 0;
      retryAfter = null;
      lastCode = "";
      go(client ? "connecting" : reason);
      changed();
    },
    /** Asks Spotify what is playing. Never throws; returns false on failure. */
    async refresh() {
      if (!client) return false;
      try {
        applyPlayback(await client.getPlayback());
        changed();
        return true;
      } catch (err) {
        applyError(err);
        changed();
        return false;
      }
    },
    /**
     * Runs one control. Shows the likely result at once (play turns into
     * pause, the volume moves) and leaves confirming it to the next poll.
     *
     * @param {"playPause"|"next"|"previous"|"volumeUp"|"volumeDown"} action
     * @returns {Promise<{ ok: boolean, code?: string, did?: string, volume?: number }>}
     */
    async control(action) {
      if (!client || !CONTROL_STATES.includes(status)) return { ok: false, code: "unavailable" };
      try {
        if (action === "playPause") {
          const playing = status === "playing";
          if (playing) await client.pause();
          else await client.play();
          if (playback) {
            playback = { ...playback, isPlaying: !playing, progressMs: session.progressMs() };
            fetchedAt = now();
            go(playing ? "paused" : "playing");
          }
          changed();
          return { ok: true, did: playing ? "pause" : "play" };
        }
        if (action === "next" || action === "previous") {
          if (action === "next") await client.next();
          else await client.previous();
          return { ok: true, did: action };
        }
        if (action === "volumeUp" || action === "volumeDown") {
          const current = playback ? playback.volume : null;
          if (current === null) return { ok: false, code: "no-volume" };
          const step = action === "volumeUp" ? VOLUME_STEP : -VOLUME_STEP;
          const volume = (
            /** @type {number} */
            clampInt(current + step, 0, 100, current)
          );
          await client.setVolume(volume);
          if (playback) playback = { ...playback, volume };
          changed();
          return { ok: true, did: "volume", volume };
        }
        return { ok: false, code: "unknown-action" };
      } catch (err) {
        const code = applyError(err);
        changed();
        return { ok: false, code };
      }
    },
    /**
     * How long to wait before the next poll, or null to stop until the user
     * does something.
     *
     * @returns {number|null}
     */
    nextDelay() {
      if (!client || status === "signed-out" || status === "premium") return null;
      if (retryAfter !== null) return Math.max(retryAfter, POLL_MS);
      if (status === "error")
        return Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** Math.max(0, failures - 1));
      return POLL_MS;
    },
    /** The track's position now, counting time since the last answer while playing. */
    progressMs() {
      if (!playback) return 0;
      const moved = playback.isPlaying ? Math.max(0, now() - fetchedAt) : 0;
      const at = playback.progressMs + moved;
      return playback.durationMs > 0 ? Math.min(playback.durationMs, at) : at;
    },
    /** A copy of what is playing, or null. */
    playback() {
      return playback ? { ...playback, artists: [...playback.artists] } : null;
    }
  };
  return session;
}

// src/tile/store.js
var KEYS = { visible: "visible", auth: "auth" };
function createStore(tf) {
  const read = async (key) => {
    try {
      return await tf.store.get(key);
    } catch (err) {
      void Promise.resolve(
        tf.log.warn(`store read ${key} failed: ${String(err && err.message || err)}`)
      ).catch(() => {
      });
      return null;
    }
  };
  const write = async (key, value) => {
    try {
      await tf.store.set(key, value);
      return true;
    } catch (err) {
      void Promise.resolve(
        tf.log.warn(`store write ${key} failed: ${String(err && err.message || err)}`)
      ).catch(() => {
      });
      return false;
    }
  };
  return {
    /** Whether the card was last left on screen (default: hidden). */
    async visible() {
      return await read(KEYS.visible) === true;
    },
    /** Remembers whether the card is on screen. */
    async setVisible(on) {
      return write(KEYS.visible, Boolean(on));
    },
    /**
     * Overwrites a refresh token an earlier version saved, if there is one.
     * Returns true when there was one to clear.
     */
    async clearLegacyAuth() {
      if (await read(KEYS.auth) === null) return false;
      await write(KEYS.auth, null);
      return true;
    }
  };
}

// src/tile/transport.js
function withOk(response) {
  if (!response || typeof response !== "object" || typeof response.ok === "boolean")
    return response;
  const status = Number(response.status);
  return Object.assign(Object.create(Object.getPrototypeOf(response)), response, {
    ok: status >= 200 && status < 300
  });
}
function findTransport(tf) {
  try {
    const net = tf && tf.net;
    if (net && typeof net.fetch === "function")
      return async (url, init) => withOk(await net.fetch(url, init));
  } catch {
  }
  return null;
}

// src/tile/view.js
var CARD_ID = "card";
var STATE_TEXT = {
  "no-network": ["state-no-network", "state-no-network-hint"],
  "signed-out": ["state-signed-out", "state-signed-out-hint"],
  connecting: ["state-connecting", "state-connecting-hint"],
  "no-device": ["state-no-device", "state-no-device-hint"],
  premium: ["state-premium", "state-premium-hint"],
  error: ["state-error", "state-error-hint"]
};
var buttonId = (id) => `btn-${id}`;
var FIELDS = ["image", "x", "y", "w", "h", "label", "hit", "cursor", "opacity"];
var TONE = Object.freeze({
  "no-network": "warn",
  "signed-out": "info",
  connecting: "info",
  "no-device": "info",
  premium: "warn",
  error: "error",
  playing: "info",
  paused: "info"
});
var MAX_LABEL = 80;
function cardView(input) {
  const { status, playback, t } = input;
  if ((status === "playing" || status === "paused") && playback) {
    const device = playback.device ? t("card-device", { device: playback.device, volume: playback.volume ?? "\u2013" }) : "";
    const detail = status === "paused" ? [t("card-paused"), device].filter(Boolean).join(" \xB7 ") : device;
    return {
      mode: "track",
      title: playback.title || t("card-unknown-title"),
      artists: playback.artists.join(", "),
      detail,
      progress: playback.durationMs > 0 ? input.progressMs / playback.durationMs : 0,
      playing: status === "playing"
    };
  }
  return {
    mode: "message",
    tone: TONE[status] ?? "info",
    title: t((STATE_TEXT[status] ?? STATE_TEXT.error)[0]),
    hint: t((STATE_TEXT[status] ?? STATE_TEXT.error)[1])
  };
}
function cardLabel(view, t) {
  const text = view.mode === "track" ? t(view.playing ? "card-label-playing" : "card-label-paused", {
    title: view.title,
    artists: view.artists
  }) : `${view.title}. ${view.hint}`;
  return text.slice(0, MAX_LABEL);
}
function sceneItems(input) {
  const { status, playback, settings, t } = input;
  const rects = computeLayout(input.layout, settings);
  const view = cardView(input);
  const card = rects[CARD_ID];
  const playing = status === "playing";
  const canControl = CONTROL_STATES.includes(status);
  const items = [
    {
      id: CARD_ID,
      image: renderCard(view, { displayW: card.w, displayH: card.h }),
      ...card,
      hit: true,
      cursor: "pointer",
      label: cardLabel(view, t)
    }
  ];
  for (const b of BUTTONS) {
    const r = rects[buttonId(b.id)];
    const isVolume = b.id.startsWith("volume");
    const dim = !canControl || isVolume && !(playback && playback.volume !== null);
    const label = b.id === "play" && playing ? t("button-pause") : t(b.label);
    items.push({
      id: buttonId(b.id),
      image: renderButton(iconFor(b.id, playing), { displaySize: r.w, dim }),
      ...r,
      hit: true,
      cursor: "pointer",
      label: label.slice(0, MAX_LABEL)
    });
  }
  return items;
}
function diffItems(prev, next) {
  const before = new Map((prev ?? []).map((i) => [i.id, i]));
  const out = [];
  for (const item of next) {
    const old = before.get(item.id);
    if (!old) {
      out.push(item);
      continue;
    }
    const change = { id: item.id };
    let any = false;
    for (const f of FIELDS) {
      if (item[f] !== old[f]) {
        change[f] = item[f];
        any = true;
      }
    }
    if (any) out.push(change);
  }
  return out;
}
function actionForClick(itemId) {
  if (itemId === CARD_ID) return "refresh";
  const b = BUTTONS.find((x) => buttonId(x.id) === itemId);
  return b ? b.action : null;
}

// src/tile/run.js
var CLOCK_MS = 1e3;
var CONFIRM_MS = 800;
var SIGN_IN_CHECK_MS = 5e3;
var AUTH_RETRY_MS = 6e4;
var SIGN_IN = "spotify";
var CONTROL_ACTION = {
  play: "control.play",
  pause: "control.pause",
  next: "control.next",
  previous: "control.previous",
  volume: "control.volume"
};
var FAILED_ACTION = {
  playPause: "control.play",
  next: "control.next",
  previous: "control.previous",
  volumeUp: "control.volume",
  volumeDown: "control.volume"
};
function runTuneboard(tf, deps = {}) {
  const now = deps.now ?? (() => Date.now());
  const trail = createTrail(tf);
  const store = createStore(tf);
  const settings = () => readSettings(tf.settings);
  let visible = false;
  let present = true;
  let layout = null;
  let shown = null;
  let drawing = null;
  let dirty = false;
  const paint = async () => {
    if (!visible) return;
    const items = sceneItems({
      status: session.status,
      playback: session.playback(),
      progressMs: session.progressMs(),
      settings: settings(),
      layout,
      t: (key, args) => tf.t(key, args)
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items });
      shown = ok === false ? null : items;
      return;
    }
    const changes = diffItems(shown, items);
    shown = items;
    if (changes.length) await tf.overlay.update({ items: changes });
  };
  const draw = () => {
    dirty = true;
    if (!drawing) {
      drawing = (async () => {
        try {
          while (dirty) {
            dirty = false;
            await paint();
          }
        } catch (err) {
          shown = null;
          trail.error(err);
        } finally {
          drawing = null;
        }
      })();
    }
    return drawing;
  };
  const session = createSession({
    now,
    onChange: () => {
      updateTimers();
      if (visible) void draw();
    },
    onState: (from, to) => {
      trail.record("state.change", { from, to });
      if (to === "signed-out" && session.lastCode === "auth") {
        authFailedAt = now();
        trail.record("auth.failed", { code: "auth" });
      }
      updateSignInCheck();
    }
  });
  const poller = createPoller({
    tick: () => session.refresh(),
    delay: () => session.nextDelay(),
    onError: (err) => trail.error(err)
  });
  let clock = null;
  function updateTimers() {
    const watch = visible && present && session.connected && settings().poll;
    if (watch && !poller.running) poller.start();
    else if (!watch && poller.running) poller.stop();
    const tick = visible && shown !== null && session.status === "playing";
    if (tick && clock === null) clock = setInterval(() => void draw(), CLOCK_MS);
    else if (!tick && clock !== null) {
      clearInterval(clock);
      clock = null;
    }
  }
  let connecting = null;
  const signedIn = async () => {
    try {
      return Boolean(tf.auth && typeof tf.auth.has === "function" && await tf.auth.has(SIGN_IN));
    } catch {
      return false;
    }
  };
  const connect = () => {
    connecting = (async () => {
      poller.stop();
      const fetchFn = findTransport(tf);
      if (!fetchFn || typeof deps.createSpotify !== "function" || !tf.auth) {
        session.setClient(null, "no-network");
        return;
      }
      if (!await signedIn()) {
        session.setClient(null, "signed-out");
        return;
      }
      session.setClient(deps.createSpotify({ fetchFn, now }));
      trail.record("auth.connected", {});
      if (!poller.running) await session.refresh();
    })().catch((err) => {
      trail.error(err);
      session.setClient(null, "signed-out");
    });
    return connecting;
  };
  const ensureConnected = () => connecting ?? (connecting = (async () => {
    if (await store.clearLegacyAuth()) trail.record("auth.legacy-cleared", {});
    await connect();
  })());
  let authFailedAt = 0;
  let signInCheck = null;
  function updateSignInCheck() {
    const wanted = visible && session.status === "signed-out";
    if (wanted && signInCheck === null) {
      signInCheck = setInterval(() => {
        void (async () => {
          if (session.status !== "signed-out") return;
          if (authFailedAt && now() - authFailedAt < AUTH_RETRY_MS) return;
          if (await signedIn()) await connect();
        })().catch((err) => trail.error(err));
      }, SIGN_IN_CHECK_MS);
    } else if (!wanted && signInCheck !== null) {
      clearInterval(signInCheck);
      signInCheck = null;
    }
  }
  const show = async () => {
    visible = true;
    shown = null;
    try {
      layout = await tf.overlay.layout();
    } catch {
      layout = null;
    }
    await store.setVisible(true);
    trail.record("view.show", {});
    updateSignInCheck();
    updateTimers();
    await draw();
    updateTimers();
  };
  const hide = async () => {
    visible = false;
    shown = null;
    updateSignInCheck();
    updateTimers();
    await tf.overlay.hide();
    await store.setVisible(false);
    trail.record("view.hide", {});
  };
  const confirmSoon = () => {
    if (poller.running) poller.soon(CONFIRM_MS);
    else setTimeout(() => void session.refresh().catch((err) => trail.error(err)), CONFIRM_MS);
  };
  const run = async (action) => {
    await ensureConnected();
    if (action === "toggle") return visible ? hide() : show();
    if (action === "refresh") {
      trail.record("control.refresh", {});
      if (!session.connected || session.status === "signed-out" || session.status === "premium") {
        await connect();
      } else {
        await session.refresh();
      }
      updateTimers();
      if (poller.running) poller.soon(0);
      return visible ? draw() : void 0;
    }
    const result = await session.control(
      /** @type {any} */
      action
    );
    if (result.ok) {
      const details = result.did === "volume" ? { ok: true, volume: result.volume } : { ok: true };
      trail.record(CONTROL_ACTION[result.did ?? ""] ?? "control.refresh", details);
      confirmSoon();
    } else if (FAILED_ACTION[action]) {
      trail.record(FAILED_ACTION[action], { ok: false, code: result.code ?? "unknown" });
    }
    return visible ? draw() : void 0;
  };
  const background = (fn) => (e) => {
    void (async () => {
      await ensureConnected();
      await fn(e);
    })().catch((err) => trail.error(err));
  };
  registerCommands(tf, (action) => run(action).catch((err) => trail.error(err)));
  tf.on(
    "app.ready",
    background(async () => {
      if (!visible && await store.visible()) await show();
    })
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.type !== "click" || !visible) return;
      const action = actionForClick(String(e.item));
      if (action) await run(action);
    })
  );
  tf.on(
    "overlay.layout",
    background(async (next) => {
      if (next && typeof next === "object") layout = next;
      if (visible) await draw();
    })
  );
  tf.on(
    "overlay.hidden",
    background(async () => {
      shown = null;
      updateTimers();
    })
  );
  const presence = (here) => background(async () => {
    present = here;
    updateTimers();
  });
  tf.on("window.blurred", presence(false));
  tf.on("user.idle", presence(false));
  tf.on("window.focused", presence(true));
  tf.on("user.active", presence(true));
  tf.on(
    "setting.changed",
    background(async (e) => {
      const key = e && e.key;
      if (LAYOUT_KEYS.includes(key) && visible) {
        try {
          layout = await tf.overlay.layout();
        } catch {
        }
      }
      updateTimers();
      if (visible) await draw();
    })
  );
  return { session, run };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runTuneboard(tf, { createSpotify });
};
export default main_default;
