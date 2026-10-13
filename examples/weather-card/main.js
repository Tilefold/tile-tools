/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Weather Card
 *
 * Today's weather in a corner of the focused pane: the sky and temperature
 * now and the next four hours, for a place the user types, from Open-Meteo
 * (free, no key). Optionally, Claude adds one line about what the coming
 * hours mean for the user's day.
 *
 * It shows three things a tile can do from Tilefold 0.1.6 on:
 * - `tf.net.fetch` against two public hosts, each asked for with a
 *   `net:` permission and a reason;
 * - `tf.ai.ask` with the fast model, a small token limit and the user's
 *   language, where "Don't send" is a choice and not a failure;
 * - an overlay card that follows the focused pane, kept fresh only while
 *   it is shown.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/weather/codes.js
var KINDS = Object.freeze([
  "clear",
  "partly",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "storm"
]);
var KIND_TEXT = Object.freeze({
  clear: "cond-clear",
  partly: "cond-partly",
  cloudy: "cond-cloudy",
  fog: "cond-fog",
  drizzle: "cond-drizzle",
  rain: "cond-rain",
  snow: "cond-snow",
  storm: "cond-storm",
  unknown: "cond-unknown"
});
function kindOf(code) {
  if (code === null || code === void 0 || code === "") return "unknown";
  const n = Number(code);
  if (!Number.isInteger(n) || n < 0) return "unknown";
  if (n === 0) return "clear";
  if (n === 1 || n === 2) return "partly";
  if (n === 3) return "cloudy";
  if (n === 45 || n === 48) return "fog";
  if (n >= 51 && n <= 57) return "drizzle";
  if (n >= 61 && n <= 67 || n >= 80 && n <= 82) return "rain";
  if (n >= 71 && n <= 77 || n === 85 || n === 86) return "snow";
  if (n >= 95 && n <= 99) return "storm";
  return "unknown";
}

// src/weather/openMeteo.js
var GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
var HOURS = 4;
var UNITS = {
  metric: { temperature_unit: "celsius", wind_speed_unit: "kmh" },
  imperial: { temperature_unit: "fahrenheit", wind_speed_unit: "mph" }
};
function cleanQuery(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}
function geocodeUrl(query, language = "en") {
  const params = new URLSearchParams({
    name: cleanQuery(query),
    count: "1",
    language: /^[a-z]{2}$/.test(language) ? language : "en",
    format: "json"
  });
  return `${GEOCODING_URL}?${params}`;
}
function parsePlace(json) {
  const first = json && Array.isArray(json.results) ? json.results[0] : null;
  if (!first || typeof first !== "object") return null;
  const lat = Number(first.latitude);
  const lon = Number(first.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    name: String(first.name ?? "").slice(0, 60) || "?",
    country: String(first.country ?? "").slice(0, 60),
    lat: Math.round(lat * 1e4) / 1e4,
    lon: Math.round(lon * 1e4) / 1e4
  };
}
function forecastUrl(place, units = "metric") {
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    forecast_hours: String(HOURS + 2),
    timezone: "auto",
    ...UNITS[units] ?? UNITS.metric
  });
  return `${FORECAST_URL}?${params}`;
}
var whole = (value) => {
  if (value === null || value === void 0 || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};
function parseForecast(json) {
  const current = json && json.current;
  if (!current || typeof current !== "object") return null;
  const temp = whole(current.temperature_2m);
  if (temp === null) return null;
  const units = json && json.current_units || {};
  const now = {
    temp,
    feels: whole(current.apparent_temperature),
    wind: whole(current.wind_speed_10m),
    kind: kindOf(current.weather_code),
    day: current.is_day !== 0
  };
  const hourly = json && json.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const nowTime = typeof current.time === "string" ? current.time : "";
  const hours = [];
  for (let i = 0; i < times.length && hours.length < HOURS; i++) {
    const time = String(times[i]);
    if (nowTime && time <= nowTime) continue;
    hours.push({
      hour: /T(\d\d:\d\d)/.exec(time)?.[1] ?? time.slice(-5),
      temp: whole(hourly.temperature_2m?.[i]),
      kind: kindOf(hourly.weather_code?.[i]),
      rain: whole(hourly.precipitation_probability?.[i])
    });
  }
  return {
    now,
    hours,
    units: {
      temp: typeof units.temperature_2m === "string" ? units.temperature_2m.slice(0, 4) : "\xB0",
      wind: typeof units.wind_speed_10m === "string" ? units.wind_speed_10m.slice(0, 6) : ""
    }
  };
}
function failureOf(err) {
  const name = err && typeof err === "object" ? (
    /** @type {any} */
    err.name
  ) : "";
  return name === "PermissionDeniedError" || name === "NetworkPolicyError" ? "denied" : "error";
}

// src/weather/summary.js
var MAX_SUMMARY = 120;
var MAX_TOKENS = 80;
function summaryQuestion({ place, forecast, system }) {
  const u = forecast.units;
  const now = forecast.now;
  const lines = [
    `Place: ${place}`,
    `Now: ${now.temp}${u.temp}, feels like ${now.feels ?? now.temp}${u.temp}, ${now.kind}, wind ${now.wind ?? "?"} ${u.wind}, ${now.day ? "day" : "night"}`,
    ...forecast.hours.map(
      (h) => `${h.hour}: ${h.temp ?? "?"}${u.temp}, ${h.kind}, chance of rain ${h.rain ?? "?"}%`
    )
  ];
  return { system, prompt: lines.join("\n"), maxTokens: MAX_TOKENS, model: "fast" };
}
function cleanSummary(text) {
  const line = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const bare = line.replace(/^[-*>#\s]+/, "").replace(/^["'“”‘’«»「」]+|["'“”‘’«»「」]+$/g, "").replace(/\*\*|__|`/g, "").trim();
  if (bare.length <= MAX_SUMMARY) return bare;
  return `${bare.slice(0, MAX_SUMMARY - 1).trimEnd()}\u2026`;
}
var AI_NOTES = {
  AiNotSetUpError: "summary-no-key",
  PermissionDeniedError: "summary-denied",
  BudgetExceededError: "summary-budget"
};
function summaryFailure(err) {
  const name = err && typeof err === "object" ? (
    /** @type {any} */
    err.name
  ) : "";
  if (name === "AiDeclinedError") return "declined";
  return AI_NOTES[name] ?? "";
}

// src/tile/settings.js
var CORNERS = ["top-right", "top-left", "bottom-right", "bottom-left"];
var EVERY = ["15", "30", "60"];
var SETTINGS = [
  { key: "place", default: "", label: "setting-place" },
  {
    key: "units",
    default: "metric",
    label: "setting-units",
    choices: [
      { value: "metric", label: "setting-units-metric" },
      { value: "imperial", label: "setting-units-imperial" }
    ]
  },
  {
    key: "corner",
    default: "top-right",
    label: "setting-corner",
    choices: [
      { value: "top-right", label: "setting-corner-top-right" },
      { value: "top-left", label: "setting-corner-top-left" },
      { value: "bottom-right", label: "setting-corner-bottom-right" },
      { value: "bottom-left", label: "setting-corner-bottom-left" }
    ]
  },
  {
    key: "every",
    default: "30",
    label: "setting-every",
    choices: [
      { value: "15", label: "setting-every-quarter" },
      { value: "30", label: "setting-every-half" },
      { value: "60", label: "setting-every-hour" }
    ]
  },
  { key: "summary", default: false, label: "setting-summary" }
];
var FETCH_KEYS = ["place", "units"];
function registerSettings(tf) {
  for (const s of SETTINGS) {
    if (s.choices) {
      const choices = s.choices.map((c) => ({ value: c.value, label: tf.t(c.label) }));
      tf.setting(s.key, s.default, tf.t(s.label), { choices });
    } else {
      tf.setting(s.key, s.default, tf.t(s.label));
    }
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
  const units = get("units") === "imperial" ? "imperial" : "metric";
  const corner = CORNERS.includes(String(get("corner"))) ? String(get("corner")) : "top-right";
  const every = EVERY.includes(String(get("every"))) ? Number(get("every")) : 30;
  return {
    place: cleanQuery(get("place")),
    units,
    corner,
    everyMs: every * 6e4,
    summary: get("summary") === true
  };
}

// src/render/svg.js
var MAX_SIDE = 256;
var THEME = {
  panel: "#0f172a",
  panelOpacity: 0.94,
  border: "#1e293b",
  text: "#f8fafc",
  muted: "#94a3b8",
  sun: "#fbbf24",
  cloud: "#cbd5e1",
  rain: "#38bdf8",
  snow: "#e0f2fe",
  storm: "#a78bfa",
  warn: "#f59e0b",
  error: "#ef4444",
  info: "#38bdf8"
};
var FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";
function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function svgUrl(w, h, body2) {
  const dw = Math.min(MAX_SIDE, w);
  const dh = Math.min(MAX_SIDE, h);
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="0 0 ${w} ${h}">${body2}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
}
var wide = (ch) => /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿＀-￯]/.test(ch);
function textWidth(text, size) {
  let units = 0;
  for (const ch of String(text)) units += wide(ch) ? 1 : 0.56;
  return units * size;
}
function ellipsize(text, size, maxWidth) {
  const s = String(text);
  if (textWidth(s, size) <= maxWidth) return s;
  let out = "";
  for (const ch of s) {
    if (textWidth(`${out}${ch}\u2026`, size) > maxWidth) break;
    out += ch;
  }
  return `${out.trimEnd()}\u2026`;
}
function textEl(o) {
  const weight = o.weight ? ` font-weight="${o.weight}"` : "";
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  return `<text x="${o.x}" y="${o.y}" font-family="${FONT}" font-size="${o.size}"${weight}${anchor} fill="${o.color ?? THEME.text}">${escapeXml(ellipsize(o.text, o.size, o.maxWidth))}</text>`;
}
function wrapLines(text, size, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const joined = line ? `${line} ${word}` : word;
    if (textWidth(joined, size) <= maxWidth) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const ch of word) {
      if (line && textWidth(line + ch, size) > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, size, maxWidth);
  return kept;
}

// src/render/icons.js
var CLOUD = "M9 24 h15 a5 5 0 0 0 0 -10 a7 7 0 0 0 -13 -1 a5.5 5.5 0 0 0 -2 11 z";
function sun(cx, cy, r) {
  let rays = "";
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 * i;
    const x1 = Math.round((cx + Math.cos(a) * (r + 3)) * 10) / 10;
    const y1 = Math.round((cy + Math.sin(a) * (r + 3)) * 10) / 10;
    const x2 = Math.round((cx + Math.cos(a) * (r + 6)) * 10) / 10;
    const y2 = Math.round((cy + Math.sin(a) * (r + 6)) * 10) / 10;
    rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${THEME.sun}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${THEME.sun}"/>${rays}`;
}
var MOON = `<path d="M20 6 a10 10 0 1 0 6 16 a8 8 0 1 1 -6 -16 z" fill="${THEME.cloud}"/>`;
function drops(count, color) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = 11 + i * 5;
    out += `<line x1="${x}" y1="26" x2="${x - 2}" y2="30" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return out;
}
function body(kind, day) {
  const cloud = (color = THEME.cloud) => `<path d="${CLOUD}" fill="${color}"/>`;
  switch (kind) {
    case "clear":
      return day ? sun(16, 16, 7) : MOON;
    case "partly":
      return `<g transform="translate(-4 -5) scale(0.8)">${day ? sun(16, 16, 7) : MOON}</g>${cloud()}`;
    case "cloudy":
      return cloud();
    case "fog":
      return cloud("#94a3b8") + `<line x1="6" y1="27" x2="26" y2="27" stroke="${THEME.cloud}" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="30" x2="23" y2="30" stroke="${THEME.cloud}" stroke-width="2" stroke-linecap="round"/>`;
    case "drizzle":
      return cloud() + drops(2, THEME.rain);
    case "rain":
      return cloud("#94a3b8") + drops(3, THEME.rain);
    case "snow":
      return cloud() + [11, 16, 21].map((x) => `<circle cx="${x}" cy="28" r="1.6" fill="${THEME.snow}"/>`).join("");
    case "storm":
      return cloud("#64748b") + `<path d="M17 22 l-4 6 h4 l-2 4 l6 -7 h-4 l2 -3 z" fill="${THEME.sun}"/>`;
    default:
      return cloud("#64748b") + `<text x="16" y="21" font-size="10" text-anchor="middle" fill="${THEME.panel}">?</text>`;
  }
}
function weatherIcon(kind, day, x, y, size) {
  const s = Math.round(size / 32 * 1e3) / 1e3;
  return `<g transform="translate(${x} ${y}) scale(${s})">${body(kind, day)}</g>`;
}
function alertIcon(x, y, color) {
  return `<g transform="translate(${x} ${y})"><circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/><rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/><circle cx="16" cy="23.5" r="1.6" fill="${color}"/></g>`;
}

// src/render/card.js
var CARD_W = 232;
var CARD_H = 116;
var SUMMARY_H = 34;
var MESSAGE_H = 88;
var SUMMARY_SIZE = 10;
var SUMMARY_W = CARD_W - 24;
var TONES = { info: THEME.info, warn: THEME.warn, error: THEME.error };
function frame(h) {
  return `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${h - 1}" rx="12" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`;
}
function renderWeather(v) {
  const h = CARD_H + (v.summary ? SUMMARY_H : 0);
  let body2 = frame(h);
  body2 += weatherIcon(v.kind, v.day, 12, 10, 40);
  body2 += textEl({ x: 60, y: 24, text: v.place, size: 12, weight: 600, maxWidth: CARD_W - 72 });
  body2 += textEl({ x: 60, y: 50, text: v.temp, size: 22, weight: 700, maxWidth: 58 });
  body2 += textEl({ x: 120, y: 40, text: v.condition, size: 11, maxWidth: CARD_W - 132 });
  const detail = { x: 120, y: 54, text: v.detail, size: 9, color: THEME.muted };
  body2 += textEl({ ...detail, maxWidth: CARD_W - 132 });
  const cell = (CARD_W - 16) / 4;
  v.hours.slice(0, 4).forEach((hour, i) => {
    const cx = Math.round(8 + cell * i + cell / 2);
    body2 += textEl({
      x: cx,
      y: 72,
      text: hour.hour,
      size: 9,
      color: THEME.muted,
      maxWidth: cell - 4,
      anchor: "middle"
    });
    body2 += weatherIcon(hour.kind, true, cx - 20, 77, 18);
    body2 += textEl({ x: cx + 1, y: 91, text: hour.temp, size: 11, maxWidth: cell / 2 });
    if (hour.rain) {
      body2 += textEl({
        x: cx,
        y: 106,
        text: hour.rain,
        size: 9,
        color: THEME.rain,
        maxWidth: cell - 4,
        anchor: "middle"
      });
    }
  });
  if (v.summary) {
    body2 += `<line x1="12" y1="${CARD_H - 2}" x2="${CARD_W - 12}" y2="${CARD_H - 2}" stroke="${THEME.border}"/>`;
    wrapLines(v.summary, SUMMARY_SIZE, SUMMARY_W, 2).forEach((line, i) => {
      body2 += textEl({
        x: 12,
        y: CARD_H + 13 + i * 13,
        text: line,
        size: SUMMARY_SIZE,
        color: v.summaryMuted ? THEME.muted : THEME.text,
        maxWidth: SUMMARY_W
      });
    });
  }
  return { image: svgUrl(CARD_W, h, body2), w: CARD_W, h };
}
function renderMessage(v) {
  const color = TONES[v.tone] ?? THEME.info;
  const width = CARD_W - 66;
  let body2 = frame(MESSAGE_H);
  body2 += alertIcon(12, 12, color);
  const title = wrapLines(v.title, 12, width, 2);
  const hint = wrapLines(v.hint, 10, width, 4 - title.length);
  let y = 25;
  for (const line of title) {
    body2 += textEl({ x: 54, y, text: line, size: 12, weight: 600, maxWidth: width });
    y += 15;
  }
  y += 2;
  for (const line of hint) {
    body2 += textEl({ x: 54, y, text: line, size: 10, color: THEME.muted, maxWidth: width });
    y += 13;
  }
  return { image: svgUrl(CARD_W, MESSAGE_H, body2), w: CARD_W, h: MESSAGE_H };
}

// src/tile/view.js
var CARD_ID = "card";
var MARGIN = 12;
var STATE_TEXT = {
  "no-network": ["state-no-network", "state-no-network-hint", "warn"],
  "no-place": ["state-no-place", "state-no-place-hint", "info"],
  loading: ["state-loading", "state-loading-hint", "info"],
  "not-found": ["state-not-found", "state-not-found-hint", "warn"],
  denied: ["state-denied", "state-denied-hint", "warn"],
  error: ["state-error", "state-error-hint", "error"]
};
var STATES = Object.freeze([...Object.keys(STATE_TEXT), "ready"]);
function placeCard(layout, corner, w, h) {
  const panes = layout && Array.isArray(layout.panes) ? layout.panes : [];
  const pane = panes.find((p) => p && p.focused) || panes[0];
  const content = layout && layout.content || { w: 800, h: 600 };
  const area = pane ? {
    x: pane.x,
    y: pane.y,
    w: pane.w,
    h: pane.composer ? Math.max(0, pane.composer.y - pane.y) : pane.h
  } : { x: 0, y: 0, w: content.w, h: content.h };
  const left = corner.endsWith("left");
  const top = corner.startsWith("top");
  const x = left ? area.x + MARGIN : area.x + area.w - w - MARGIN;
  const y = top ? area.y + MARGIN : area.y + area.h - h - MARGIN;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
}
var degrees = (n) => n === null || n === void 0 ? "\u2013" : `${n}\xB0`;
function cardItem(s) {
  let picture;
  let label;
  if (s.status === "ready" && s.forecast && s.place) {
    const f = s.forecast;
    const condition = s.t(KIND_TEXT[f.now.kind] ?? KIND_TEXT.unknown);
    const summary = s.summary || (s.summaryNote ? s.t(s.summaryNote) : "");
    picture = renderWeather({
      temp: degrees(f.now.temp),
      place: s.place.name,
      condition,
      detail: s.t("card-feels", {
        temp: degrees(f.now.feels),
        wind: `${f.now.wind ?? "\u2013"} ${f.units.wind}`
      }),
      kind: f.now.kind,
      day: f.now.day,
      hours: f.hours.map((h) => ({
        hour: h.hour,
        kind: h.kind,
        temp: degrees(h.temp),
        rain: h.rain ? `${h.rain}%` : ""
      })),
      summary,
      summaryMuted: !s.summary
    });
    label = s.t("card-label", { place: s.place.name, temp: degrees(f.now.temp), condition });
  } else {
    const [title, hint, tone] = STATE_TEXT[s.status] ?? STATE_TEXT.error;
    const titleText = s.t(title);
    picture = renderMessage({
      title: titleText,
      hint: s.t(hint, { place: s.query }),
      tone: (
        /** @type {"info"|"warn"|"error"} */
        tone
      )
    });
    label = titleText;
  }
  const at = placeCard(s.layout, s.corner, CARD_W, picture.h);
  return {
    id: CARD_ID,
    image: picture.image,
    x: at.x,
    y: at.y,
    w: picture.w,
    h: picture.h,
    // Screen readers get a short name; Tilefold keeps at most 80 characters.
    label: label.slice(0, 80),
    hit: true,
    cursor: "pointer"
  };
}

// src/tile/run.js
var KEYS = { visible: "visible", last: "last" };
var COMMANDS = [
  { id: "toggle", title: "cmd-toggle", key: { mac: "Ctrl+Alt+W", other: "Ctrl+Alt+W" } },
  { id: "refresh", title: "cmd-refresh" }
];
function runWeatherCard(tf) {
  let visible = false;
  let shown = null;
  let layout = null;
  let status = "no-place";
  let place = null;
  let forecast = null;
  let fetchedAt = 0;
  let summary = "";
  let summaryNote = "";
  let declined = false;
  let asking = false;
  let busy = false;
  let timer = null;
  const settings = () => readSettings(tf.settings);
  const quiet = (fn) => Promise.resolve().then(fn).catch(() => {
  });
  const warn = (text) => quiet(() => tf.log.warn(String(text).slice(0, 300)));
  const audit = (action, details) => quiet(() => tf.audit(action, details));
  const draw = async () => {
    if (!visible) return;
    const item = cardItem({
      status,
      place,
      forecast,
      summary,
      summaryNote,
      query: settings().place,
      corner: settings().corner,
      layout,
      t: (key, args) => tf.t(key, args)
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items: [item] });
      shown = ok === false ? null : item;
      return;
    }
    if (JSON.stringify(item) === JSON.stringify(shown)) return;
    shown = item;
    await tf.overlay.update({ items: [item] });
  };
  const remember = () => quiet(() => tf.store.set(KEYS.last, { place, forecast, fetchedAt, summary }));
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!visible) return;
    const wait = Math.max(6e4, fetchedAt + settings().everyMs - Date.now());
    timer = setTimeout(() => void refresh(false), wait);
  };
  const refresh = async (byUser) => {
    if (busy) return;
    busy = true;
    const s = settings();
    try {
      if (!tf.net || typeof tf.net.fetch !== "function") {
        status = "no-network";
        return;
      }
      if (!s.place) {
        status = "no-place";
        return;
      }
      if (!forecast) {
        status = "loading";
        await draw();
      }
      if (!place || place.query !== s.place) {
        const res2 = await tf.net.fetch(geocodeUrl(s.place, tf.t("language-code")));
        if (!res2.ok)
          throw Object.assign(new Error(`geocoding ${res2.status}`), { name: "HttpError" });
        const found = parsePlace(await res2.json());
        if (!found) {
          status = "not-found";
          forecast = null;
          place = null;
          void audit("forecast", { ok: false, code: "not-found" });
          return;
        }
        place = { query: s.place, units: s.units, ...found };
        forecast = null;
      }
      const res = await tf.net.fetch(forecastUrl(place, s.units));
      if (!res.ok) throw Object.assign(new Error(`forecast ${res.status}`), { name: "HttpError" });
      const next = parseForecast(await res.json());
      if (!next) throw Object.assign(new Error("forecast unreadable"), { name: "HttpError" });
      forecast = next;
      place = { ...place, units: s.units };
      fetchedAt = Date.now();
      status = "ready";
      summary = "";
      summaryNote = "";
      void audit("forecast", { ok: true });
      void remember();
    } catch (err) {
      status = failureOf(err);
      void audit("forecast", { ok: false, code: String(err && err.name || "Error") });
      void warn(`weather check failed: ${err && err.name}: ${err && err.message}`);
    } finally {
      busy = false;
      fetchedAt = fetchedAt || Date.now();
      await draw();
      schedule();
    }
    if (status === "ready" && s.summary) void summarize(byUser);
  };
  const summarize = async (byUser) => {
    if (asking || !forecast || !place) return;
    if (!tf.ai || typeof tf.ai.ask !== "function") return;
    if (declined && !byUser) return;
    asking = true;
    summaryNote = "summary-thinking";
    await draw();
    try {
      const where = [place.name, place.country].filter(Boolean).join(", ");
      const system = tf.t("summary-system", { language: tf.t("language-name") });
      const answer = await tf.ai.ask(summaryQuestion({ place: where, forecast, system }));
      summary = cleanSummary(answer && answer.text);
      summaryNote = "";
      declined = false;
      void audit("summary", { ok: true });
      void remember();
    } catch (err) {
      const failure = summaryFailure(err);
      declined = failure === "declined";
      summaryNote = failure === "declined" ? "" : failure;
      void audit("summary", { ok: false, code: String(err && err.name || "Error") });
      if (!failure) void warn(`summary failed: ${err && err.name}: ${err && err.message}`);
    } finally {
      asking = false;
      await draw();
    }
  };
  const show = async () => {
    visible = true;
    shown = null;
    try {
      layout = await tf.overlay.layout();
    } catch {
      layout = null;
    }
    void quiet(() => tf.store.set(KEYS.visible, true));
    void audit("shown", {});
    const stale = !forecast || Date.now() - fetchedAt >= settings().everyMs;
    if (stale) await refresh(false);
    else {
      await draw();
      schedule();
    }
  };
  const hide = async () => {
    visible = false;
    shown = null;
    schedule();
    await tf.overlay.hide();
    void quiet(() => tf.store.set(KEYS.visible, false));
    void audit("hidden", {});
  };
  const restore = async () => {
    const s = settings();
    const last = await tf.store.get(KEYS.last).catch(() => null);
    if (last && last.place && last.place.query === s.place && last.place.units === s.units) {
      const parsed = last.forecast && last.forecast.now ? last.forecast : null;
      if (parsed) {
        place = last.place;
        forecast = parsed;
        fetchedAt = Number(last.fetchedAt) || 0;
        summary = s.summary && typeof last.summary === "string" ? last.summary : "";
        status = "ready";
      }
    }
    if (await tf.store.get(KEYS.visible).catch(() => false)) await show();
  };
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch((err) => warn(err));
  for (const c of COMMANDS) {
    const run = c.id === "toggle" ? background(() => visible ? hide() : show()) : background(() => visible ? refresh(true) : show());
    tf.command(tf.t(c.title), run, c.key ? { id: c.id, key: c.key } : { id: c.id });
  }
  tf.on("app.ready", background(restore));
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (visible && e && e.item === CARD_ID && e.type === "click") await refresh(true);
    })
  );
  tf.on(
    "overlay.layout",
    background(async (next) => {
      if (next && typeof next === "object") layout = next;
      await draw();
    })
  );
  tf.on(
    "overlay.hidden",
    background(async () => {
      shown = null;
    })
  );
  tf.on(
    "window.focused",
    background(async () => {
      if (visible && Date.now() - fetchedAt >= settings().everyMs) await refresh(false);
    })
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      const key = e && e.key;
      if (FETCH_KEYS.includes(key)) {
        if (key === "place") place = null;
        forecast = null;
        summary = "";
        fetchedAt = 0;
        if (visible) await refresh(true);
        return;
      }
      if (key === "summary") {
        summary = "";
        summaryNote = "";
        declined = false;
        if (settings().summary && status === "ready") void summarize(true);
      }
      if (key === "every") schedule();
      await draw();
    })
  );
  return { refresh, summarize, state: () => ({ status, visible, summary, summaryNote, declined }) };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runWeatherCard(tf);
};
export default main_default;
