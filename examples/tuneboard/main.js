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
  // The user hasn't allowed Spotify's host, or Tilefold refused the request:
  // nothing reached Spotify, so this is not a Spotify failure.
  PermissionDeniedError: "denied",
  NetworkPolicyError: "denied",
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
  else if (status === 403 && /scope/i.test(String(message))) code = "scope";
  else if (status === 404 && reason === "NO_ACTIVE_DEVICE") code = "no-device";
  else if (status === 429) code = "rate-limit";
  else if (status >= 500) code = "server";
  return new SpotifyError(code, message, {
    status,
    retryAfterMs: code === "rate-limit" ? retryAfterMs(header(response.headers, "Retry-After"), now) : void 0
  });
}

// src/spotify/playlists.js
var PAGE_SIZE = 50;
var MAX_TEXT = 200;
var COVER_WIDTH = 160;
var THUMB_WIDTH = 160;
var IMAGE_DOMAINS = ["scdn.co", "spotifycdn.com"];
function isPlaylistUri(uri) {
  return typeof uri === "string" && /^spotify:playlist:[A-Za-z0-9]{1,64}$/.test(uri);
}
function isCoverUrl(url) {
  if (typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.port || parsed.username) return false;
  return IMAGE_DOMAINS.some((d) => parsed.hostname.endsWith(`.${d}`));
}
function pickCover(images) {
  if (!Array.isArray(images)) return null;
  const usable = images.filter((i) => i && isCoverUrl(i.url));
  if (usable.length === 0) return null;
  const width = (i) => Number.isFinite(i.width) ? i.width : 0;
  const bigEnough = usable.filter((i) => width(i) >= COVER_WIDTH);
  const pool = bigEnough.length ? bigEnough : usable;
  const best = pool.reduce(
    (a, b) => bigEnough.length ? width(b) < width(a) ? b : a : width(b) > width(a) ? b : a
  );
  return best.url;
}
function pickThumb(images) {
  if (!Array.isArray(images)) return null;
  const small = images.filter(
    (i) => i && isCoverUrl(i.url) && Number.isFinite(i.width) && i.width <= THUMB_WIDTH
  );
  if (small.length === 0) return null;
  return small.reduce((a, b) => b.width < a.width ? b : a).url;
}
var text = (value) => typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
function playlistModel(p) {
  if (!p || typeof p !== "object" || !isPlaylistUri(p.uri)) return null;
  const total = p.tracks?.total ?? p.items?.total;
  return {
    uri: p.uri,
    name: text(p.name),
    owner: text(p.owner?.display_name ?? p.owner?.id),
    tracks: Number.isSafeInteger(total) && total >= 0 ? total : null,
    cover: pickCover(p.images),
    thumb: pickThumb(p.images)
  };
}
function playlistPage(data, offset) {
  const raw = Array.isArray(data?.items) ? data.items : [];
  const items = raw.map(playlistModel).filter((p) => p !== null);
  const total = Number.isSafeInteger(data?.total) && data.total >= 0 ? data.total : items.length;
  const after = offset + raw.length;
  return { items, total, nextOffset: data?.next && raw.length > 0 && after < total ? after : null };
}

// src/spotify/client.js
var API_URL = "https://api.spotify.com/v1";
var PLAYER = "/me/player";
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
    device: data.device ? {
      id: data.device.id ?? "",
      name: data.device.name ?? "",
      volume: data.device.volume_percent ?? null
    } : null,
    shuffle: Boolean(data.shuffle_state),
    repeat: data.repeat_state ?? "off"
  };
}
function createSpotify({ fetchFn, now = Date.now } = {}) {
  if (typeof fetchFn !== "function") throw new TypeError("fetchFn is required");
  async function request(path, { method = "GET", query, body } = {}) {
    const url = new URL(API_URL + path);
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
  const player = (path = "", init) => request(PLAYER + path, init);
  const deviceQuery = (deviceId) => {
    if (deviceId === void 0) return void 0;
    if (typeof deviceId !== "string" || !deviceId) throw new TypeError("A device id is required");
    return { device_id: deviceId };
  };
  const nonnegativeMs = (value) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError("Position must be a nonnegative integer in milliseconds");
    return value;
  };
  return {
    async getPlayback() {
      const data = await player();
      return data === null ? null : playbackModel(data);
    },
    play: () => player("/play", { method: "PUT" }),
    pause: () => player("/pause", { method: "PUT" }),
    next: () => player("/next", { method: "POST" }),
    previous: () => player("/previous", { method: "POST" }),
    setVolume(volume) {
      if (!Number.isInteger(volume) || volume < 0 || volume > 100)
        throw new RangeError("Volume must be an integer from 0 to 100");
      return player("/volume", { method: "PUT", query: { volume_percent: volume } });
    },
    seek(ms) {
      return player("/seek", { method: "PUT", query: { position_ms: nonnegativeMs(ms) } });
    },
    transfer(deviceId, play = true) {
      if (typeof deviceId !== "string" || !deviceId) throw new TypeError("A device id is required");
      return player("", { method: "PUT", body: { device_ids: [deviceId], play: Boolean(play) } });
    },
    /** Starts playing on a device (it becomes the active one); resumes what was last played. */
    playOn(deviceId) {
      return player("/play", { method: "PUT", query: deviceQuery(deviceId) });
    },
    /** Plays a playlist on a device, or on the active device when none is given. */
    playContext(uri, deviceId) {
      if (!isPlaylistUri(uri)) throw new TypeError("A Spotify playlist URI is required");
      return player("/play", {
        method: "PUT",
        query: deviceQuery(deviceId),
        body: { context_uri: uri }
      });
    },
    /** One page of the user's playlists, from `offset`. */
    async playlists(offset = 0) {
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new RangeError("Offset must be a nonnegative integer");
      const data = await request("/me/playlists", { query: { limit: PAGE_SIZE, offset } });
      return playlistPage(data ?? {}, offset);
    },
    setShuffle(enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("Shuffle must be a boolean");
      return player("/shuffle", { method: "PUT", query: { state: enabled } });
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
var NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
function escapeXml(value) {
  return String(value).replace(NOT_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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
function textWidth(text2, size) {
  let em = 0;
  for (const ch of String(text2)) em += isWide(ch.codePointAt(0) ?? 0) ? 1 : 0.6;
  return em * size;
}
function ellipsize(text2, size, maxWidth) {
  const s = String(text2);
  if (textWidth(s, size) <= maxWidth) return s;
  const chars = [...s];
  while (chars.length > 0 && textWidth(chars.join("") + "\u2026", size) > maxWidth) chars.pop();
  return chars.join("").trimEnd() + "\u2026";
}
function textEl(o) {
  let text2 = String(o.text);
  const anchor = o.anchor ?? "start";
  const fill = o.fill ?? THEME.text;
  const weight = o.weight ?? 400;
  let fit = "";
  if (o.maxWidth && textWidth(text2, o.size) > o.maxWidth) {
    if (o.squeeze) fit = ` textLength="${round2(o.maxWidth)}" lengthAdjust="spacingAndGlyphs"`;
    else text2 = ellipsize(text2, o.size, o.maxWidth);
  }
  const opacity = o.opacity === void 0 ? "" : ` opacity="${o.opacity}"`;
  return `<text x="${round2(o.x)}" y="${round2(o.y)}" font-size="${o.size}" font-family="${FONT}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${opacity}${fit}>${escapeXml(text2)}</text>`;
}

// src/render/buttons.js
var BUTTON = 28;
var VOLUME_W = 76;
var BUTTONS = [
  { id: "previous", action: "previous", label: "button-previous", w: BUTTON },
  { id: "play", action: "playPause", label: "button-play", w: BUTTON },
  { id: "next", action: "next", label: "button-next", w: BUTTON },
  { id: "volume", action: null, label: "button-volume", w: VOLUME_W },
  { id: "playlists", action: "panel", label: "button-playlists", w: BUTTON }
];
var ICONS = {
  previous: `<rect x="8" y="9" width="2.4" height="10" rx="1" fill="${THEME.text}"/><path d="M20 9 L11.5 14 L20 19 Z" fill="${THEME.text}"/>`,
  next: `<rect x="17.6" y="9" width="2.4" height="10" rx="1" fill="${THEME.text}"/><path d="M8 9 L16.5 14 L8 19 Z" fill="${THEME.text}"/>`,
  play: `<path d="M11 8 L20 14 L11 20 Z" fill="${THEME.accent}"/>`,
  pause: `<rect x="9.5" y="8.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/><rect x="15.3" y="8.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/>`,
  // Three lines with a note: a list of music.
  playlists: `<path d="M7 10 H16 M7 14 H16 M7 18 H12" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/><path d="M20.5 18.5 V9.5 L23.5 9" stroke="${THEME.accent}" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="18.8" cy="18.6" r="2" fill="${THEME.accent}"/>`
};
function renderButton(icon, opts = {}) {
  const art = ICONS[icon] ?? "";
  const body = `<rect x="0.5" y="0.5" width="${BUTTON - 1}" height="${BUTTON - 1}" rx="7" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${opts.on ? THEME.accent : THEME.border}"/><g opacity="${opts.dim ? 0.35 : 1}">${art}</g>`;
  const size = opts.displaySize ?? BUTTON;
  return svgUrl(BUTTON, BUTTON, body, size, size);
}
function iconFor(id, playing) {
  if (id === "play") return playing ? "pause" : "play";
  return id;
}
function speaker(x, y, muted) {
  const body = `<path d="M${x} ${y + 4} H${x + 3} L${x + 7} ${y + 0.5} V${y + 11.5} L${x + 3} ${y + 8} H${x} Z" fill="${THEME.text}"/>`;
  const mark = muted ? `<path d="M${x + 9.5} ${y + 3.5} L${x + 14} ${y + 8.5} M${x + 14} ${y + 3.5} L${x + 9.5} ${y + 8.5}" stroke="${THEME.error}" stroke-width="1.6" stroke-linecap="round"/>` : `<path d="M${x + 9.5} ${y + 3.5} Q${x + 11.5} ${y + 6} ${x + 9.5} ${y + 8.5} M${x + 11.5} ${y + 1.5} Q${x + 15} ${y + 6} ${x + 11.5} ${y + 10.5}" stroke="${THEME.text}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  return body + mark;
}
function renderVolume(opts = {}) {
  const third = VOLUME_W / 3;
  const mid = BUTTON / 2;
  const body = `<rect x="0.5" y="0.5" width="${VOLUME_W - 1}" height="${BUTTON - 1}" rx="7" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${opts.muted ? THEME.error : THEME.border}"/><path d="M${third} 7 V21 M${third * 2} 7 V21" stroke="${THEME.border}"/><g opacity="${opts.dim ? 0.35 : 1}"><path d="M${third / 2 - 5} ${mid} H${third / 2 + 5}" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>` + speaker(third + third / 2 - 7, mid - 6, Boolean(opts.muted)) + `<path d="M${third * 2.5 - 5} ${mid} H${third * 2.5 + 5} M${third * 2.5} ${mid - 5} V${mid + 5}" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/></g>`;
  return svgUrl(VOLUME_W, BUTTON, body, opts.displayW ?? VOLUME_W, opts.displayH ?? BUTTON);
}
function volumeHit(rect, x) {
  if (!rect || rect.w <= 0) return null;
  const at = (x - rect.x) / rect.w;
  if (at < 0 || at > 1) return null;
  return at < 1 / 3 ? "volumeDown" : at < 2 / 3 ? "mute" : "volumeUp";
}

// src/render/card.js
var CARD_W = 208;
var CARD_H = 72;
var TEXT_X = 54;
var TEXT_W = CARD_W - TEXT_X - 12;
var TONES = { info: THEME.accent, warn: THEME.warn, error: THEME.error };
function wrapLines(text2, size, maxWidth, maxLines) {
  const words = String(text2).split(/\s+/).filter(Boolean);
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
      // The volume, right-aligned, always shows whole; the device gives way.
      maxWidth: view.volume ? TEXT_W - textWidth(view.volume, 9) - 6 : TEXT_W
    }) + (view.volume ? textEl({
      x: TEXT_X + TEXT_W,
      y: 51,
      text: view.volume,
      size: 9,
      weight: 600,
      fill: THEME.muted,
      anchor: "end"
    }) : "") + `<rect x="${TEXT_X}" y="58" width="${barW}" height="3" rx="1.5" fill="${THEME.track}"/><rect x="${TEXT_X}" y="58" width="${round2(barW * p)}" height="3" rx="1.5" fill="${THEME.accent}"/>`;
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

// src/render/panel.js
var ROWS = 5;
var PANEL_W = CARD_W;
var PAD = 6;
var ROW_H = 34;
var FOOT_H = 26;
var PANEL_H = PAD + ROWS * ROW_H + FOOT_H + PAD;
var FOOT_Y = PAD + ROWS * ROW_H;
var PREV_X = 8;
var NEXT_X = 38;
var FOOT_BTN = 26;
var ALL_X = 128;
var TEXT_X2 = 44;
function rowSvg(row, i, y) {
  const parts = [];
  if (row.picked) {
    parts.push(
      `<rect x="4" y="${y + 1}" width="${PANEL_W - 8}" height="${ROW_H - 2}" rx="6" fill="${THEME.accent}" fill-opacity="0.18"/>`
    );
  }
  if (row.cover) {
    parts.push(
      `<clipPath id="c${i}"><rect x="10" y="${y + 4}" width="26" height="26" rx="4"/></clipPath><image href="${escapeXml(row.cover)}" x="10" y="${y + 4}" width="26" height="26" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${i})"/>`
    );
  } else {
    parts.push(
      `<rect x="10" y="${y + 4}" width="26" height="26" rx="4" fill="${THEME.track}"/><path d="M21 ${y + 23} V${y + 11} L28 ${y + 9.5} V${y + 21}" stroke="${THEME.muted}" stroke-width="1.6" fill="none"/><circle cx="19.5" cy="${y + 23}" r="2.2" fill="${THEME.muted}"/><circle cx="26.5" cy="${y + 21}" r="2.2" fill="${THEME.muted}"/>`
    );
  }
  const width = PANEL_W - TEXT_X2 - 10;
  parts.push(
    textEl({ x: TEXT_X2, y: y + 15, text: row.name, size: 12, weight: 600, maxWidth: width }),
    textEl({ x: TEXT_X2, y: y + 28, text: row.meta, size: 10, fill: THEME.muted, maxWidth: width })
  );
  return parts.join("");
}
function arrowSvg(x, up, enabled) {
  const y = FOOT_Y + 1;
  const tip = up ? `M${x + 8} ${y + 15} L${x + 13} ${y + 9} L${x + 18} ${y + 15}` : `M${x + 8} ${y + 9} L${x + 13} ${y + 15} L${x + 18} ${y + 9}`;
  return `<g opacity="${enabled ? 1 : 0.35}"><rect x="${x + 0.5}" y="${y + 0.5}" width="${FOOT_BTN - 1}" height="${FOOT_BTN - 4}" rx="5" fill="none" stroke="${THEME.border}"/><path d="${tip}" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
function renderPanel(view, opts = {}) {
  const parts = [
    `<rect x="0.5" y="0.5" width="${PANEL_W - 1}" height="${PANEL_H - 1}" rx="10" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`
  ];
  if (view.status) {
    const lines = wrapLines(view.status.text, 12, PANEL_W - 28, 4);
    const top = PAD + ROWS * ROW_H / 2 - lines.length * 16 / 2 + 12;
    lines.forEach(
      (line, i) => parts.push(
        textEl({
          x: PANEL_W / 2,
          y: round2(top + i * 16),
          text: line,
          size: 12,
          anchor: "middle",
          fill: view.status.error ? THEME.error : THEME.muted
        })
      )
    );
  } else {
    const shift = Math.min(Math.max(Number(view.shift) || 0, 0), ROW_H);
    const rows = view.rows.slice(0, ROWS + 1).map((row, i) => rowSvg(row, i, round2(PAD + i * ROW_H - shift)));
    parts.push(
      `<clipPath id="rows"><rect x="0" y="${PAD}" width="${PANEL_W}" height="${ROWS * ROW_H}"/></clipPath><g clip-path="url(#rows)">${rows.join("")}</g>`
    );
    if (view.bar) {
      const room = ROWS * ROW_H - 4;
      const h = Math.max(12, room * view.bar.size);
      const top = PAD + 2 + (room - h) * view.bar.top;
      parts.push(
        `<rect x="${PANEL_W - 5}" y="${round2(top)}" width="3" height="${round2(h)}" rx="1.5" fill="${THEME.muted}" fill-opacity="0.6"/>`
      );
    }
  }
  parts.push(
    `<path d="M8 ${FOOT_Y + 0.5} H${PANEL_W - 8}" stroke="${THEME.border}"/>`,
    arrowSvg(PREV_X, true, view.canPrev),
    arrowSvg(NEXT_X, false, view.canNext),
    textEl({
      x: NEXT_X + FOOT_BTN + 6,
      y: FOOT_Y + 17,
      text: ellipsize(view.range, 10, ALL_X - NEXT_X - FOOT_BTN - 10),
      size: 10,
      fill: THEME.muted
    })
  );
  if (view.allLabel) {
    parts.push(
      textEl({
        x: PANEL_W - 10,
        y: FOOT_Y + 17,
        text: view.allLabel,
        size: 11,
        weight: 600,
        anchor: "end",
        fill: THEME.accent,
        maxWidth: PANEL_W - ALL_X - 12,
        squeeze: true
      })
    );
  }
  return svgUrl(PANEL_W, PANEL_H, parts.join(""), opts.displayW, opts.displayH);
}
function panelPoint(rect, x, y) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return null;
  return { x: (x - rect.x) * PANEL_W / rect.w, y: (y - rect.y) * PANEL_H / rect.h };
}
function panelHit(rect, x, y) {
  const p = panelPoint(rect, x, y);
  if (!p) return null;
  const { x: lx, y: ly } = p;
  if (lx < 0 || lx > PANEL_W || ly < 0 || ly > PANEL_H) return null;
  if (ly >= PAD && ly < FOOT_Y) return { kind: "row", y: ly - PAD };
  if (ly >= FOOT_Y && ly < FOOT_Y + FOOT_H) {
    if (lx >= PREV_X && lx < PREV_X + FOOT_BTN) return { kind: "prev" };
    if (lx >= NEXT_X && lx < NEXT_X + FOOT_BTN) return { kind: "next" };
    if (lx >= ALL_X) return { kind: "all" };
  }
  return null;
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
function computeLayout(layout, settings = {}, options = {}) {
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
  const widths = BUTTONS.map((b) => Math.round(b.w * scale));
  const used = widths.reduce((a, b) => a + b, 0);
  const gap = BUTTONS.length > 1 ? (w - used) / (BUTTONS.length - 1) : 0;
  let left = gx;
  BUTTONS.forEach((b, i) => {
    const last = i === BUTTONS.length - 1;
    const x = last ? gx + w - widths[i] : Math.round(left);
    rects[`btn-${b.id}`] = { x, y: rowY, w: widths[i], h: btn };
    left += widths[i] + gap;
  });
  if (options.panel) {
    const pw = Math.round(PANEL_W * scale);
    const ph = Math.round(PANEL_H * scale);
    const py = bottom ? gy - Math.round(GAP * scale) - ph : gy + h + Math.round(GAP * scale);
    rects.panel = { x: gx, y: Math.max(0, py), w: pw, h: ph };
  }
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
  "auth.legacy-cleared",
  "control.play-here",
  "player.start",
  "player.ready",
  "player.not-ready",
  "player.error",
  "player.stop",
  "player.closed",
  "library.show",
  "library.load",
  "library.play",
  "library.view",
  "panel.show",
  "panel.hide"
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
    info(text2) {
      quiet(() => tf.log.info(String(text2)));
    },
    error(err) {
      const e = (
        /** @type {any} */
        err
      );
      const text2 = e && e.code ? `${e.code}: ${e.message ?? ""}` : String(e && e.message || e);
      quiet(() => tf.log.error(text2.slice(0, 200)));
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
    id: "mute",
    title: "cmd-mute",
    action: "mute",
    key: { mac: "Ctrl+Alt+S", other: "Ctrl+Alt+S" }
  },
  {
    id: "refresh",
    title: "cmd-refresh",
    action: "refresh",
    key: { mac: "Ctrl+Alt+R", other: "Ctrl+Alt+R" }
  },
  { id: "play-here", title: "cmd-play-here", action: "playHere" },
  { id: "stop-here", title: "cmd-stop-here", action: "stopHere" },
  { id: "library", title: "cmd-library", action: "library" },
  { id: "playlists", title: "cmd-playlists", action: "panel" }
];
function registerCommands(tf, run) {
  for (const c of COMMANDS) {
    tf.command(tf.t(c.title), () => run(c.action), { id: c.id, ...c.key ? { key: c.key } : {} });
  }
}

// src/tile/player.js
var READY_TIMEOUT_MS = 15e3;
var PLAYER_ERRORS = Object.freeze([
  "initialization_error",
  "authentication_error",
  "account_error",
  "playback_error",
  "token"
]);
function playerError(code) {
  return Object.assign(new Error(`the player in Tilefold failed (${code})`), { code });
}
function createPagePlayer(tf, { trail }) {
  let deviceId = null;
  let waiting = [];
  const settle = (fn) => {
    const pending = waiting;
    waiting = [];
    for (const w of pending) fn(w);
  };
  const hear = (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "ready" && typeof message.deviceId === "string") {
      deviceId = message.deviceId;
      trail.record("player.ready", {});
      settle((w) => w.resolve(message.deviceId));
    } else if (message.type === "not-ready") {
      deviceId = null;
      trail.record("player.not-ready", {});
    } else if (message.type === "error") {
      const code = PLAYER_ERRORS.includes(message.kind) ? message.kind : "unknown";
      trail.record("player.error", { code });
      settle((w) => w.reject(playerError(code)));
    }
  };
  if (tf.page) {
    tf.on("page.message", (e) => hear(e && e.message));
    tf.on("page.closed", () => {
      deviceId = null;
      trail.record("player.closed", {});
      settle((w) => w.reject(playerError("closed")));
    });
  }
  return {
    /** Whether this Tilefold can run the player (it has tile pages). */
    available: () => Boolean(tf.page && typeof tf.page.open === "function"),
    /** Whether the player is running and ready. */
    ready: () => deviceId !== null,
    /** The ready player's Spotify device id, or null. */
    deviceId: () => deviceId,
    /**
     * Sets the volume of the player inside Tilefold (0–100).
     *
     * @param {number} volume
     */
    async setVolume(volume) {
      if (deviceId === null)
        throw Object.assign(new Error("the player is not ready"), { code: "closed" });
      await tf.page.post({ do: "volume", value: Math.min(100, Math.max(0, volume)) / 100 });
    },
    /**
     * Starts the player (or reuses the running one); resolves to its device id.
     *
     * @returns {Promise<string>}
     */
    async start() {
      if (deviceId) return deviceId;
      const ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting = waiting.filter((w) => w.resolve !== resolve);
          reject(playerError("timeout"));
        }, READY_TIMEOUT_MS);
        waiting.push({
          resolve: (id) => {
            clearTimeout(timer);
            resolve(id);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          }
        });
      });
      await tf.page.open({ visible: false });
      trail.record("player.start", {});
      return ready;
    },
    /** Stops the player and closes its page. */
    async stop() {
      deviceId = null;
      await tf.page.close();
      trail.record("player.stop", {});
    }
  };
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
  "denied",
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
var UNMUTE_VOLUME = 50;
var VOLUME_SETTLE_MS = 300;
var VOLUME_HOLD_MS = 3e3;
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
    deviceId: p.device && typeof p.device.id === "string" ? p.device.id : "",
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
  let volumeTarget = null;
  let holdUntil = 0;
  let volumeTimer = null;
  let sendingVolume = false;
  let sentVolume = null;
  let mutedFrom = null;
  const chooseVolume = (volume) => {
    volumeTarget = volume;
    holdUntil = now() + VOLUME_HOLD_MS;
    if (playback) playback = { ...playback, volume };
    if (volume > 0) mutedFrom = null;
    scheduleVolume();
    changed();
    return { ok: true, did: "volume", volume };
  };
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
    if (volumeTarget !== null && now() < holdUntil) {
      if (playback) playback = { ...playback, volume: volumeTarget };
    } else if (!sendingVolume && volumeTimer === null) {
      volumeTarget = null;
    }
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
    } else if (code === "denied") {
      playback = null;
      go("denied");
    } else if (code === "rate-limit") {
      const after = Number(err && err.retryAfterMs);
      retryAfter = Number.isFinite(after) && after > 0 ? after : POLL_MS * 2;
    } else {
      failures += 1;
      go("error");
    }
    return code;
  };
  const sendVolume = async () => {
    volumeTimer = null;
    if (sendingVolume || volumeTarget === null || !client) return;
    const volume = volumeTarget;
    sendingVolume = true;
    try {
      await (o.setVolume ? o.setVolume(volume, playback) : client.setVolume(volume));
      sentVolume = volume;
      holdUntil = now() + VOLUME_HOLD_MS;
    } catch (err) {
      volumeTarget = null;
      holdUntil = 0;
      const code = applyError(err);
      changed();
      if (o.onVolumeError) o.onVolumeError(code);
    } finally {
      sendingVolume = false;
    }
    if (volumeTarget !== null && volumeTarget !== sentVolume) scheduleVolume();
  };
  const scheduleVolume = () => {
    if (volumeTimer !== null) clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => void sendVolume(), VOLUME_SETTLE_MS);
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
     * @param {"playPause"|"next"|"previous"|"volumeUp"|"volumeDown"|"mute"} action
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
          const current = volumeTarget ?? (playback ? playback.volume : null);
          if (current === null) return { ok: false, code: "no-volume" };
          const step = action === "volumeUp" ? VOLUME_STEP : -VOLUME_STEP;
          const base = current === 0 && step > 0 && mutedFrom !== null ? mutedFrom - step : current;
          return chooseVolume(
            /** @type {number} */
            clampInt(base + step, 0, 100, current)
          );
        }
        if (action === "mute") {
          const current = volumeTarget ?? (playback ? playback.volume : null);
          if (current === null) return { ok: false, code: "no-volume" };
          if (current > 0) {
            const before = current;
            chooseVolume(0);
            mutedFrom = before;
            return { ok: true, did: "volume", volume: 0 };
          }
          return chooseVolume(mutedFrom ?? UNMUTE_VOLUME);
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
      if (status === "denied") return MAX_BACKOFF_MS;
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
var KEYS = { visible: "visible", auth: "auth", libraryView: "libraryView" };
var LIBRARY_VIEWS = Object.freeze(["grid", "list"]);
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
    /** How the Library lists playlists (default: thumbnails). */
    async libraryView() {
      const view = await read(KEYS.libraryView);
      return LIBRARY_VIEWS.includes(view) ? view : LIBRARY_VIEWS[0];
    },
    /** Remembers how the Library lists playlists; refuses unknown views. */
    async setLibraryView(view) {
      if (!LIBRARY_VIEWS.includes(view)) return false;
      return write(KEYS.libraryView, view);
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

// src/spotify/covers.js
var MAX_COVER_BYTES = 24 * 1024;
var MAX_REMEMBERED = 200;
var TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
function base64Of(bytes) {
  let binary = "";
  const CHUNK = 32768;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
function createCovers({ fetchFn }) {
  const pending = /* @__PURE__ */ new Map();
  const known = /* @__PURE__ */ new Map();
  const remember = (url, value) => {
    known.set(url, value);
    while (known.size > MAX_REMEMBERED) known.delete(known.keys().next().value);
  };
  const download = async (url) => {
    try {
      const response = await fetchFn(url, { method: "GET" });
      if (!response || !response.ok) return null;
      const type = String(response.headers?.["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (!TYPES.includes(type)) return null;
      const bytes = await response.bytes();
      if (!(bytes instanceof Uint8Array) || bytes.length === 0) return null;
      if (bytes.length > MAX_COVER_BYTES) return null;
      return `data:${type};base64,${base64Of(bytes)}`;
    } catch {
      return null;
    }
  };
  return {
    /** The cover as a data URL, fetching it the first time; null when there is none. */
    get(url) {
      if (!fetchFn || !isCoverUrl(url)) return Promise.resolve(null);
      if (known.has(url)) return Promise.resolve(known.get(url) ?? null);
      if (!pending.has(url)) {
        pending.set(
          url,
          download(url).then((value) => {
            pending.delete(url);
            remember(url, value);
            return value;
          })
        );
      }
      return (
        /** @type {Promise<string|null>} */
        pending.get(url)
      );
    },
    /** The cover if it is already known (undefined while not fetched yet). */
    peek(url) {
      if (!url || !known.has(url)) return void 0;
      return known.get(url);
    }
  };
}

// src/tile/pick.js
var ERROR_MESSAGE = {
  auth: "player-error-sign-in",
  scope: "library-error-scope",
  premium: "player-error-premium",
  denied: "state-denied-hint",
  network: "library-error-network",
  "rate-limit": "library-error-network",
  "no-device": "state-no-device-hint",
  timeout: "player-error-other",
  account_error: "player-error-premium",
  authentication_error: "player-error-sign-in",
  token: "player-error-sign-in",
  initialization_error: "player-error-unsupported"
};
var codeOf = (err) => String(err?.code ?? "unknown").slice(0, 24);
function messageFor(err) {
  return ERROR_MESSAGE[codeOf(err)] ?? "library-error-other";
}
function createPicker({ trail, player, client }) {
  return {
    /**
     * Plays a playlist; resolves when Spotify took it, rejects with a coded
     * error otherwise.
     *
     * @param {string} uri A playlist URI the caller has checked.
     * @param {string} from Where the pick came from: "window" or "panel".
     */
    async play(uri, from) {
      const spotify = await client();
      if (!spotify) {
        trail.record("library.play", { ok: false, code: "auth", from });
        throw Object.assign(new Error("not signed in"), { code: "auth" });
      }
      let via = "device";
      try {
        try {
          await spotify.playContext(uri);
        } catch (err) {
          if (err?.code !== "no-device" || !player.available()) throw err;
          via = "tilefold";
          await spotify.playContext(uri, await player.start());
        }
        trail.record("library.play", { ok: true, via, from });
      } catch (err) {
        trail.record("library.play", { ok: false, code: codeOf(err), via, from });
        throw err;
      }
    }
  };
}

// src/tile/library.js
var STRINGS = {
  title: "library-title",
  refresh: "library-refresh",
  loading: "library-loading",
  empty: "library-empty",
  more: "library-more",
  viewGrid: "library-view-grid",
  viewList: "library-view-list"
};
function createLibrary(tf, { trail, store, picker, client, afterPlay = () => {
} }) {
  let wanted = false;
  const post = async (message) => {
    try {
      await tf.page.post(message);
    } catch {
    }
  };
  const language = () => ({
    lang: tf.t("library-lang"),
    dir: tf.t("library-dir") === "rtl" ? "rtl" : "ltr"
  });
  const open = async () => {
    const strings = {};
    for (const [k, key] of Object.entries(STRINGS)) strings[k] = tf.t(key);
    return post({ do: "library", ...language(), view: await store.libraryView(), strings });
  };
  const fail = (err) => post({
    do: "library-error",
    message: tf.t(messageFor(err))
  });
  const load = async (offset) => {
    const spotify = await client();
    if (!spotify) {
      trail.record("library.load", { ok: false, code: "auth" });
      return fail({ code: "auth" });
    }
    try {
      const page = await spotify.playlists(offset);
      trail.record("library.load", { ok: true });
      const items = page.items.map((p) => ({
        ...p,
        byline: p.owner ? tf.t("library-by", { owner: p.owner }) : ""
      }));
      await post({ do: "playlists", offset, ...page, items });
    } catch (err) {
      trail.record("library.load", { ok: false, code: codeOf(err) });
      await fail(err);
    }
  };
  const play = async (uri) => {
    try {
      await picker.play(uri, "window");
      await post({ do: "playing", uri, message: tf.t("library-playing") });
      afterPlay();
    } catch (err) {
      await fail(err);
    }
  };
  const hear = async (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      if (wanted) await open();
    } else if (message.type === "want-playlists") {
      const offset = Number.isSafeInteger(message.offset) && message.offset >= 0 ? message.offset : 0;
      await load(offset);
    } else if (message.type === "play-playlist") {
      if (isPlaylistUri(message.uri)) await play(message.uri);
    } else if (message.type === "set-view") {
      if (!LIBRARY_VIEWS.includes(message.view)) return;
      await store.setLibraryView(message.view);
      trail.record("library.view", { to: message.view });
    }
  };
  if (tf.page) {
    tf.on("page.message", (e) => {
      void hear(e && e.message).catch((err) => trail.error(err));
    });
    tf.on("page.closed", () => {
      wanted = false;
    });
  }
  return {
    /** Whether this Tilefold can show the Library (it has tile pages). */
    available: () => Boolean(tf.page && typeof tf.page.open === "function"),
    /** Opens the Library window (or brings it back) and fills it. */
    async show() {
      wanted = true;
      await tf.page.open({ visible: true, keepRunning: true });
      trail.record("library.show", {});
      await open();
    }
  };
}

// src/tile/panel.js
var MAX_REQUESTS = 3;
var LOAD_AHEAD = ROWS;
function createPanel(tf, deps) {
  const { trail, client, picker, covers, library, onChange } = deps;
  const afterPlay = deps.afterPlay ?? (() => {
  });
  const state = {
    open: false,
    /** @type {any[]} */
    items: [],
    total: 0,
    /** @type {number|null} */
    nextOffset: null,
    /** How far the rows are scrolled, in the panel's own pixels. */
    scroll: 0,
    loading: false,
    /** @type {string|null} An error message key, shown instead of the rows. */
    error: null,
    /** @type {string|null} The playlist picked last, highlighted. */
    picked: null,
    /** @type {{ y: number, scroll: number } | null} Where a drag started. */
    drag: null
  };
  const maxScroll = () => Math.max(0, (state.items.length - ROWS) * ROW_H);
  const top = () => Math.floor(state.scroll / ROW_H);
  const snapped = (scroll) => Math.round(scroll / ROW_H) * ROW_H;
  const fetchCovers = () => {
    for (const p of state.items.slice(top(), top() + ROWS + 1)) {
      if (p.thumb && covers.peek(p.thumb) === void 0) {
        void covers.get(p.thumb).then((cover) => {
          if (cover && state.open) onChange();
        });
      }
    }
  };
  const load = async (offset, want = offset + ROWS) => {
    state.loading = true;
    state.error = null;
    onChange();
    try {
      const spotify = await client();
      if (!spotify) throw Object.assign(new Error("not signed in"), { code: "auth" });
      let from = offset;
      for (let i = 0; i < MAX_REQUESTS && from !== null; i++) {
        const page = await spotify.playlists(from);
        const known = new Set(from === 0 ? [] : state.items.map((p) => p.uri));
        const fresh = page.items.filter((p) => !known.has(p.uri));
        state.items = from === 0 ? fresh : [...state.items, ...fresh];
        state.total = page.total;
        state.nextOffset = page.nextOffset;
        from = state.items.length < want ? page.nextOffset : null;
      }
      trail.record("library.load", { ok: true, from: "panel" });
    } catch (err) {
      if (state.items.length === 0 || offset === 0) state.error = messageFor(err);
      else state.nextOffset = null;
      trail.record("library.load", { ok: false, code: codeOf(err), from: "panel" });
    } finally {
      state.loading = false;
    }
    fetchCovers();
    onChange();
  };
  const loadAhead = () => {
    if (state.loading || state.nextOffset === null) return;
    if (top() + ROWS + LOAD_AHEAD < state.items.length) return;
    void load(state.nextOffset, top() + ROWS + LOAD_AHEAD).catch((err) => trail.error(err));
  };
  const scrollTo = (scroll) => {
    const next = Math.min(Math.max(0, scroll), maxScroll());
    if (next === state.scroll) return;
    state.scroll = next;
    fetchCovers();
    loadAhead();
    onChange();
  };
  const turn = async (step) => {
    if (state.loading) return;
    const target = snapped(state.scroll) + step * ROWS * ROW_H;
    const needed = Math.floor(target / ROW_H) + ROWS;
    if (step > 0 && needed > state.items.length && state.nextOffset !== null) {
      await load(state.nextOffset, needed);
    }
    scrollTo(target);
  };
  const pick = async (y) => {
    const p = state.items[Math.floor((y + state.scroll) / ROW_H)];
    if (!p || state.error) return;
    state.picked = p.uri;
    onChange();
    try {
      await picker.play(p.uri, "panel");
      afterPlay();
    } catch (err) {
      tf.toast(tf.t(messageFor(err)));
    }
  };
  const click = async (hit) => {
    if (!hit) return;
    if (hit.kind === "row") return pick(hit.y);
    if (hit.kind === "prev") return turn(-1);
    if (hit.kind === "next") return turn(1);
    if (hit.kind === "all" && library.available()) return library.show();
  };
  return {
    /** Whether the panel is open. */
    get open() {
      return state.open;
    },
    /** Opens or closes the panel; opening loads the list afresh, from the top. */
    async toggle() {
      state.open = !state.open;
      state.drag = null;
      trail.record(state.open ? "panel.show" : "panel.hide", {});
      if (!state.open) return onChange();
      state.scroll = 0;
      await load(0);
    },
    /**
     * Handles a pointer event on the panel: clicks, and drags that scroll.
     *
     * @param {{ type: string, x: number, y: number }} e Tilefold's event.
     * @param {{ x: number, y: number, w: number, h: number }} rect Where the panel is.
     */
    async pointer(e, rect) {
      if (!state.open || !e) return;
      if (e.type === "click") return click(panelHit(rect, Number(e.x), Number(e.y)));
      const p = panelPoint(rect, Number(e.x), Number(e.y));
      if (!p) return;
      if (e.type === "dragstart") {
        const hit = panelHit(rect, Number(e.x), Number(e.y));
        state.drag = hit && hit.kind === "row" ? { y: p.y, scroll: state.scroll } : null;
      } else if (e.type === "drag" && state.drag) {
        scrollTo(state.drag.scroll - (p.y - state.drag.y));
      } else if (e.type === "drop" && state.drag) {
        scrollTo(state.drag.scroll - (p.y - state.drag.y));
        state.drag = null;
        scrollTo(snapped(state.scroll));
      }
    },
    /**
     * What the panel shows now, in the user's language, or null when closed.
     *
     * @returns {null | { rows: object[], shift: number, bar: { top: number, size: number } | null,
     *   status: { text: string, error?: boolean } | null, range: string,
     *   canPrev: boolean, canNext: boolean, allLabel: string|null, label: string }}
     */
    view() {
      if (!state.open) return null;
      const first = top();
      const shown = state.items.slice(first, first + ROWS + 1);
      let status = null;
      if (state.error) status = { text: tf.t(state.error), error: true };
      else if (state.loading && shown.length === 0) status = { text: tf.t("library-loading") };
      else if (shown.length === 0) status = { text: tf.t("library-empty") };
      const count = Math.max(state.total, state.items.length);
      const last = Math.min(first + ROWS, state.items.length);
      const range = shown.length ? tf.t("panel-range", { from: first + 1, to: last, total: count }) : "";
      const room = (count - ROWS) * ROW_H;
      return {
        rows: shown.map((p) => ({
          name: p.name,
          meta: [
            p.owner ? tf.t("library-by", { owner: p.owner }) : "",
            p.tracks === null ? "" : `\u266A ${p.tracks}`
          ].filter(Boolean).join(" \xB7 "),
          cover: covers.peek(p.thumb) ?? null,
          picked: p.uri === state.picked
        })),
        shift: state.scroll - first * ROW_H,
        bar: count > ROWS ? { top: Math.min(1, state.scroll / room), size: ROWS / count } : null,
        status,
        range,
        canPrev: state.scroll > 0,
        canNext: state.scroll < maxScroll() || state.nextOffset !== null,
        allLabel: library.available() ? tf.t("panel-show-all") : null,
        label: [tf.t("library-title"), range].filter(Boolean).join(", ")
      };
    }
  };
}

// src/tile/playlists.js
function createPlaylistViews(tf, { trail, store, player, client, afterPlay, onChange }) {
  const picker = createPicker({ trail, player, client });
  const library = createLibrary(tf, { trail, store, picker, client, afterPlay });
  const panel = createPanel(tf, {
    trail,
    client,
    picker,
    library,
    afterPlay,
    covers: createCovers({ fetchFn: findTransport(tf) }),
    onChange
  });
  return { library, panel };
}

// src/tile/view.js
var CARD_ID = "card";
var PANEL_ID = "panel";
var VOLUME_ID = "btn-volume";
var STATE_TEXT = {
  "no-network": ["state-no-network", "state-no-network-hint"],
  denied: ["state-denied", "state-denied-hint"],
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
  denied: "warn",
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
    const device = playback.device ? t("card-on-device", { device: playback.device }) : "";
    const detail = status === "paused" ? [t("card-paused"), device].filter(Boolean).join(" \xB7 ") : device;
    const volume = playback.volume === null ? "" : playback.volume === 0 ? t("card-muted") : t("card-volume", { volume: playback.volume });
    return {
      mode: "track",
      title: playback.title || t("card-unknown-title"),
      artists: playback.artists.join(", "),
      detail,
      volume,
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
  const text2 = view.mode === "track" ? t(view.playing ? "card-label-playing" : "card-label-paused", {
    title: view.title,
    artists: view.artists
  }) : `${view.title}. ${view.hint}`;
  return text2.slice(0, MAX_LABEL);
}
function sceneItems(input) {
  const { status, playback, settings, t } = input;
  const panel = input.panel ?? null;
  const rects = computeLayout(input.layout, settings, { panel: panel !== null });
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
    const isVolume = b.id === "volume";
    const dim = b.id !== "playlists" && (!canControl || isVolume && !(playback && playback.volume !== null));
    const label = b.id === "play" && playing ? t("button-pause") : t(b.label);
    items.push({
      id: buttonId(b.id),
      image: isVolume ? renderVolume({ displayW: r.w, displayH: r.h, dim, muted: playback?.volume === 0 }) : renderButton(iconFor(b.id, playing), {
        displaySize: r.w,
        dim,
        on: b.id === "playlists" && panel !== null
      }),
      ...r,
      hit: true,
      cursor: "pointer",
      label: label.slice(0, MAX_LABEL)
    });
  }
  if (panel) {
    const r = rects[PANEL_ID];
    items.push({
      id: PANEL_ID,
      image: renderPanel(panel, { displayW: r.w, displayH: r.h }),
      ...r,
      hit: true,
      cursor: "pointer",
      label: String(panel.label ?? "").slice(0, MAX_LABEL)
    });
  }
  return items;
}
function removedIds(prev, next) {
  const kept = new Set(next.map((i) => i.id));
  return (prev ?? []).map((i) => i.id).filter((id) => !kept.has(id));
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
var PLAYER_MESSAGE = {
  account_error: "player-error-premium",
  authentication_error: "player-error-sign-in",
  token: "player-error-sign-in",
  initialization_error: "player-error-unsupported"
};
var FAILED_ACTION = {
  playPause: "control.play",
  next: "control.next",
  previous: "control.previous",
  volumeUp: "control.volume",
  volumeDown: "control.volume",
  mute: "control.volume"
};
function runTuneboard(tf, deps = {}) {
  const now = deps.now ?? (() => Date.now());
  const trail = createTrail(tf);
  const store = createStore(tf);
  const settings = () => readSettings(tf.settings);
  const player = createPagePlayer(tf, { trail });
  const client = async () => {
    await ensureConnected();
    if (!spotify) await connect();
    return spotify;
  };
  const { library, panel } = createPlaylistViews(tf, {
    ...{ trail, store, player, client },
    afterPlay: () => confirmSoon(),
    onChange: () => void draw()
  });
  let spotify = null;
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
      t: (key, args) => tf.t(key, args),
      panel: panel.view()
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items });
      shown = ok === false ? null : items;
      return;
    }
    const changes = diffItems(shown, items);
    const remove = removedIds(shown, items);
    shown = items;
    if (changes.length || remove.length) {
      await tf.overlay.update({ items: changes, ...remove.length ? { remove } : {} });
    }
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
    },
    // Music playing inside Tilefold takes its volume from the page at once.
    setVolume: (volume, playing) => player.ready() && playing?.deviceId === player.deviceId() ? player.setVolume(volume) : spotify.setVolume(volume),
    onVolumeError: (code) => trail.record("control.volume", { ok: false, code })
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
      spotify = null;
      const fetchFn = findTransport(tf);
      if (!fetchFn || typeof deps.createSpotify !== "function" || !tf.auth) {
        session.setClient(null, "no-network");
        return;
      }
      if (!await signedIn()) {
        session.setClient(null, "signed-out");
        return;
      }
      spotify = deps.createSpotify({ fetchFn, now });
      session.setClient(spotify);
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
  const tell = (key) => void Promise.resolve(tf.toast(tf.t(key))).catch(() => {
  });
  const playHere = async () => {
    if (!player.available()) return tell("player-unavailable");
    if (!spotify) await connect();
    if (!spotify) return tell("state-signed-out-hint");
    try {
      await spotify.playOn(await player.start());
      trail.record("control.play-here", { ok: true });
      confirmSoon();
    } catch (err) {
      const code = String(err?.code ?? "unknown").slice(0, 40);
      trail.record("control.play-here", { ok: false, code });
      tell(PLAYER_MESSAGE[code] ?? "player-error-other");
    }
    return visible ? draw() : void 0;
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
    if (action === "playHere") return playHere();
    if (action === "panel") {
      if (!visible) await show();
      return panel.toggle();
    }
    if (action === "library") {
      return library.available() ? library.show() : tell("player-unavailable");
    }
    if (action === "stopHere") {
      if (player.available()) await player.stop();
      confirmSoon();
      return visible ? draw() : void 0;
    }
    if (action === "playPause" && session.status === "no-device" && player.available()) {
      return playHere();
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
      if (!e || !visible) return;
      if (e.item === PANEL_ID) {
        return panel.pointer(e, computeLayout(layout, settings(), { panel: true })[PANEL_ID]);
      }
      if (e.type !== "click") return;
      const action = e.item === VOLUME_ID ? volumeHit(computeLayout(layout, settings())[VOLUME_ID], Number(e.x)) : actionForClick(String(e.item));
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
