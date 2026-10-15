/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Watchpane
 *
 * Plays YouTube videos in a small window of its own, with a card over the
 * panes like a music player's: the video's picture, title and progress,
 * and buttons to play or pause, skip ten seconds, mute, pick one of the
 * videos watched lately, and bring the window forward. The window is the
 * tile's page (`page/`), which runs YouTube's own embedded player and
 * stays visible while it plays, as YouTube asks; the tile opens and
 * closes it, keeps the recent list and the settings, draws the card
 * (`window.overlay`), and talks to the page by messages.
 *
 * It shows how a tile page can host a third party's embedded player:
 * - `page` plus `script:www.youtube.com` for YouTube's IFrame Player API;
 * - `net:` hosts for the player's frame (www.youtube-nocookie.com in
 *   private mode) and the thumbnails (i.ytimg.com);
 * - an overlay card the tile draws itself, controlling the page's player;
 * - no keys and no sign-in: the tile never talks to YouTube itself.
 *
 * Needs Tilefold 0.1.10 or later (tile pages with a web address; 0.1.9
 * opened them without one). Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/render/svg.js
var MAX_SIDE = 256;
var THEME = {
  panel: "#121212",
  panelOpacity: 0.94,
  border: "#2a2a2a",
  track: "#3a3a3a",
  text: "#f5f5f5",
  muted: "#a3a3a3",
  accent: "#ff3b30",
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
  { id: "back", action: "back", label: "button-back" },
  { id: "play", action: "toggle", label: "button-play" },
  { id: "forward", action: "forward", label: "button-forward" },
  { id: "mute", action: "mute", label: "button-mute" },
  { id: "list", action: "list", label: "button-list" },
  { id: "window", action: "window", label: "button-window" }
];
var C = BUTTON / 2;
var stroke = (d, color) => `<path d="${d}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
var small = (x, y, text, color) => `<text x="${x}" y="${y}" font-size="7" font-weight="700" font-family="system-ui,sans-serif" fill="${color}" text-anchor="middle">${text}</text>`;
var ART = {
  back: (_s, c) => stroke("M9 9 A7 7 0 1 1 8 17", c) + stroke("M9 5 V9 H13", c) + small(C + 1, 17, "10", c),
  forward: (_s, c) => stroke("M19 9 A7 7 0 1 0 20 17", c) + stroke("M19 5 V9 H15", c) + small(C - 1, 17, "10", c),
  play: (s, c) => s.playing ? `<rect x="9.5" y="8" width="3" height="12" rx="1" fill="${c}"/><rect x="15.5" y="8" width="3" height="12" rx="1" fill="${c}"/>` : `<path d="M10.5 8 L20 14 L10.5 20 Z" fill="${c}"/>`,
  mute: (s, c) => `<path d="M7 11.5 H10 L14 8 V20 L10 16.5 H7 Z" fill="${c}"/>` + (s.muted ? stroke("M17 11 L22 17 M22 11 L17 17", c) : stroke("M17 11 Q19.5 14 17 17 M19.5 9 Q23.5 14 19.5 19", c)),
  list: (_s, c) => [9.5, 14, 18.5].map((y) => stroke(`M8 ${y} H20`, c)).join(""),
  window: (_s, c) => `<rect x="7" y="8" width="14" height="11" rx="2" stroke="${c}" stroke-width="1.8" fill="none"/><path d="M12 11.5 L16.5 13.5 L12 15.5 Z" fill="${c}"/>`
};
function renderButton(id, state = {}, display = BUTTON) {
  const lit = id === "list" && state.listOpen || id === "play" && state.playing;
  const color = state.enabled === false ? THEME.muted : lit ? "#fff" : THEME.text;
  const fill = lit ? THEME.accent : THEME.panel;
  const body = `<circle cx="${C}" cy="${C}" r="${C - 0.5}" fill="${fill}" fill-opacity="${lit ? 1 : THEME.panelOpacity}" stroke="${THEME.border}"/>` + (ART[id] ? ART[id](state, color) : "");
  return svgUrl(BUTTON, BUTTON, body, display, display);
}
function actionForClick(itemId) {
  const b = BUTTONS.find((x) => `btn-${x.id}` === itemId);
  return b ? b.action : null;
}

// src/render/card.js
var CARD_W = 240;
var CARD_H = 76;
var PIC = { x: 8, y: 8, w: 96, h: 54 };
var TEXT_X = PIC.x + PIC.w + 10;
var TEXT_W = CARD_W - TEXT_X - 10;
function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
function clampProgress(p) {
  const n = Number(p);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
function wrapLines(text, size, maxWidth, maxLines) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
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
var frame = () => `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="12" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`;
function picture(thumb, playing) {
  const clip = `<clipPath id="pic"><rect x="${PIC.x}" y="${PIC.y}" width="${PIC.w}" height="${PIC.h}" rx="6"/></clipPath>`;
  const base = thumb ? `<image href="${escapeXml(thumb)}" x="${PIC.x}" y="${PIC.y}" width="${PIC.w}" height="${PIC.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pic)"/>` : `<rect x="${PIC.x}" y="${PIC.y}" width="${PIC.w}" height="${PIC.h}" rx="6" fill="${THEME.track}"/>`;
  const cx = PIC.x + PIC.w / 2;
  const cy = PIC.y + PIC.h / 2;
  const mark = playing ? "" : `<circle cx="${cx}" cy="${cy}" r="13" fill="#000" fill-opacity="0.55"/><path d="M${cx - 4} ${cy - 7} L${cx + 7} ${cy} L${cx - 4} ${cy + 7} Z" fill="#fff"/>`;
  return `<defs>${clip}</defs>${base}${mark}`;
}
function alertIcon(x, y, color) {
  return `<g transform="translate(${x} ${y})"><circle cx="16" cy="16" r="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/><rect x="14.75" y="8" width="2.5" height="11" rx="1.2" fill="${color}"/><circle cx="16" cy="23.5" r="1.6" fill="${color}"/></g>`;
}
function playIcon(x, y, color) {
  return `<g transform="translate(${x} ${y})"><rect width="32" height="32" rx="8" fill="${color}" fill-opacity="0.16"/><path d="M12 9 L24 16 L12 23 Z" fill="${color}"/></g>`;
}
function renderCard(view, opts = {}) {
  let body = frame();
  if (view.mode === "video") {
    const lines = wrapLines(view.title, 11, TEXT_W, 2);
    const barW = CARD_W - 16;
    body += picture(view.thumb, view.playing) + lines.map(
      (text, i) => textEl({ x: TEXT_X, y: 21 + i * 14, text, size: 11, weight: 600, maxWidth: TEXT_W })
    ).join("") + textEl({
      x: TEXT_X,
      y: 57,
      text: view.detail,
      size: 9,
      fill: THEME.muted,
      maxWidth: TEXT_W
    }) + `<rect x="8" y="67" width="${barW}" height="3" rx="1.5" fill="${THEME.track}"/><rect x="8" y="67" width="${round2(barW * clampProgress(view.progress))}" height="3" rx="1.5" fill="${THEME.accent}"/>`;
  } else {
    const color = view.tone === "error" ? THEME.error : THEME.accent;
    body += (view.tone === "error" ? alertIcon(12, 22, color) : playIcon(12, 22, color)) + textEl({ x: 54, y: 30, text: view.title, size: 12, weight: 600, maxWidth: CARD_W - 64 }) + wrapLines(view.hint, 10, CARD_W - 64, 2).map((text, i) => textEl({ x: 54, y: 46 + i * 13, text, size: 10, fill: THEME.muted })).join("");
  }
  return svgUrl(CARD_W, CARD_H, body, opts.displayW, opts.displayH);
}

// src/render/list.js
var LIST_W = 240;
var LIST_ROWS = 6;
var HEAD_H = 28;
var ROW_H = 24;
var PAD = 6;
var LIST_H = HEAD_H + LIST_ROWS * ROW_H + PAD;
function renderList(view, opts = {}) {
  let body = `<rect x="0.5" y="0.5" width="${LIST_W - 1}" height="${LIST_H - 1}" rx="12" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>` + textEl({
    x: 12,
    y: 19,
    text: view.heading,
    size: 11,
    weight: 600,
    fill: THEME.muted,
    maxWidth: LIST_W - 24
  });
  const videos = view.videos.slice(0, LIST_ROWS);
  if (!videos.length) {
    body += textEl({
      x: 12,
      y: HEAD_H + 16,
      text: view.empty,
      size: 10,
      fill: THEME.muted,
      maxWidth: LIST_W - 24
    });
  }
  videos.forEach((v, i) => {
    const y = HEAD_H + i * ROW_H;
    const on = v.id === view.current;
    if (on) {
      body += `<rect x="6" y="${y + 2}" width="${LIST_W - 12}" height="${ROW_H - 4}" rx="6" fill="${THEME.accent}" fill-opacity="0.18"/>`;
      body += `<path d="M13 ${y + 8} L19 ${y + 12} L13 ${y + 16} Z" fill="${THEME.accent}"/>`;
    }
    body += textEl({ x: 26, y: y + 16, text: v.title || v.id, size: 11, maxWidth: LIST_W - 38 });
  });
  return svgUrl(LIST_W, LIST_H, body, opts.displayW, opts.displayH);
}
function listHit(rect, x, y, count) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return null;
  const lx = (x - rect.x) * LIST_W / rect.w;
  const ly = (y - rect.y) * LIST_H / rect.h;
  if (lx < 0 || lx > LIST_W || ly < HEAD_H) return null;
  const row = Math.floor((ly - HEAD_H) / ROW_H);
  return row >= 0 && row < Math.min(count, LIST_ROWS) ? row : null;
}

// src/tile/scene.js
var CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
var GAP = 6;
var MARGIN = 12;
var VIDEO_W = 356;
var VIDEO_H = 200;
var cornerOf = (corner) => CORNERS.includes(corner) ? corner : "bottom-right";
function areaOf(layout) {
  const panes = Array.isArray(layout?.panes) ? layout.panes : [];
  const pane = panes.find((p) => p?.focused) ?? panes[0];
  if (pane) {
    const bottom = pane.composer ? pane.composer.y : pane.y + pane.h;
    return { x: pane.x, y: pane.y, w: pane.w, h: Math.max(0, bottom - pane.y) };
  }
  const content = layout?.content ?? { w: 800, h: 600 };
  return { x: 0, y: 0, w: content.w, h: content.h };
}
function computeLayout(layout, corner, { list = false, video = false } = {}) {
  const at = cornerOf(corner);
  const area = areaOf(layout);
  const groupH = CARD_H + GAP + BUTTON;
  const right = at.endsWith("right");
  const bottom = at.startsWith("bottom");
  const gx = Math.max(0, Math.round(right ? area.x + area.w - CARD_W - MARGIN : area.x + MARGIN));
  const gy = Math.max(0, Math.round(bottom ? area.y + area.h - groupH - MARGIN : area.y + MARGIN));
  const rects = { card: { x: gx, y: gy, w: CARD_W, h: CARD_H } };
  const step = (CARD_W - BUTTON) / (BUTTONS.length - 1);
  BUTTONS.forEach((b, i) => {
    rects[`btn-${b.id}`] = {
      x: Math.round(gx + i * step),
      y: gy + CARD_H + GAP,
      w: BUTTON,
      h: BUTTON
    };
  });
  let edge = bottom ? gy : gy + groupH;
  const stack = (w, h) => {
    const y = bottom ? edge - GAP - h : edge + GAP;
    edge = bottom ? y : y + h;
    const x = right ? gx + CARD_W - w : gx;
    return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), w, h };
  };
  if (video) rects.video = stack(VIDEO_W, VIDEO_H);
  if (list) rects.list = stack(LIST_W, LIST_H);
  return rects;
}

// src/tile/thumbs.js
var thumbUrl = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
var MAX_THUMB_BYTES = 48 * 1024;
var REMEMBERED = 20;
var TYPES = ["image/jpeg", "image/png", "image/webp"];
function base64Of(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}
function createThumbs(fetchFn) {
  const known = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  const download = async (id) => {
    try {
      const response = await fetchFn(thumbUrl(id), { method: "GET" });
      if (!response?.ok) return null;
      const type = String(response.headers?.["content-type"] ?? "").split(";")[0].trim();
      if (!TYPES.includes(type)) return null;
      const bytes = await response.bytes();
      if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_THUMB_BYTES) {
        return null;
      }
      return `data:${type};base64,${base64Of(bytes)}`;
    } catch {
      return null;
    }
  };
  return {
    /** The picture for video `id` (a data URL), or null. */
    get(id) {
      if (!fetchFn || !/^[A-Za-z0-9_-]{11}$/.test(String(id))) return Promise.resolve(null);
      if (known.has(id)) return Promise.resolve(known.get(id));
      if (!pending.has(id)) {
        pending.set(
          id,
          download(id).then((value) => {
            pending.delete(id);
            known.set(id, value);
            while (known.size > REMEMBERED) known.delete(known.keys().next().value);
            return value;
          })
        );
      }
      return pending.get(id);
    },
    /** The picture if it is already here (undefined while unknown). */
    peek: (id) => known.get(id)
  };
}

// src/tile/card.js
function cleanStatus(m) {
  if (!m || typeof m !== "object" || typeof m.id !== "string") return null;
  const n = (v) => Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  return {
    id: m.id,
    title: typeof m.title === "string" ? m.title.slice(0, 200) : "",
    playing: m.playing === true,
    time: n(m.time),
    duration: n(m.duration),
    muted: m.muted === true
  };
}
function cardView(t, status, recent, thumb) {
  if (!status)
    return { mode: "message", tone: "info", title: t("card-idle"), hint: t("card-idle-hint") };
  const known = recent.find((v) => v.id === status.id);
  const where = status.duration ? `${clock(status.time)} / ${clock(status.duration)}` : clock(status.time);
  const line = status.playing ? where : t("card-paused", { time: where });
  return {
    mode: "video",
    title: status.title || known?.title || status.id,
    detail: status.muted ? t("card-muted", { line }) : line,
    progress: status.duration ? status.time / status.duration : 0,
    playing: status.playing,
    thumb: thumb ?? null
  };
}
function createCard(tf, hooks) {
  const thumbs = createThumbs(tf.net ? (url, init) => tf.net.fetch(url, init) : null);
  let visible = false;
  let listOpen = false;
  let status = null;
  let layout = null;
  let drawn = "";
  let docked = "";
  const t = (key, args) => tf.t(key, args);
  const items = () => {
    const rects = computeLayout(layout, hooks.corner(), { list: listOpen, video: hooks.docked() });
    if (rects.video && JSON.stringify(rects.video) !== docked) {
      docked = JSON.stringify(rects.video);
      void Promise.resolve(hooks.redock(rects.video)).catch(() => {
      });
    }
    const thumb = status ? thumbs.peek(status.id) : null;
    if (status && thumb === void 0) {
      void thumbs.get(status.id).then(() => draw());
    }
    const state = { playing: !!status?.playing, muted: !!status?.muted, listOpen };
    const out = [
      {
        id: "card",
        image: renderCard(cardView(t, status, hooks.recent(), thumb)),
        ...rects.card,
        hit: true,
        cursor: "pointer",
        label: t("card-idle-hint")
      },
      ...BUTTONS.map((b) => ({
        id: `btn-${b.id}`,
        image: renderButton(b.id, state),
        ...rects[`btn-${b.id}`],
        hit: true,
        cursor: "pointer",
        label: t(b.label)
      }))
    ];
    if (listOpen) {
      out.push({
        id: "list",
        image: renderList({
          heading: t("list-heading"),
          empty: t("list-empty"),
          videos: hooks.recent(),
          current: status?.id ?? null
        }),
        ...rects.list,
        hit: true,
        cursor: "pointer",
        label: t("button-list")
      });
    }
    return out;
  };
  const draw = async () => {
    if (!visible) return;
    if (!layout) layout = await tf.overlay.layout();
    const scene = items();
    const ids = scene.map((i) => i.id).join(",");
    if (ids === drawn) await tf.overlay.update({ items: scene });
    else {
      drawn = ids;
      await tf.overlay.show({ items: scene });
    }
  };
  const act = async (action) => {
    if (action === "list") {
      listOpen = !listOpen;
      return draw();
    }
    if (action === "window") return hooks.isOpen() ? hooks.closeWindow() : hooks.openWindow();
    if (!hooks.isOpen()) return hooks.openWindow();
    const control = action === "mute" ? status?.muted ? "unmute" : "mute" : action;
    return hooks.post({ do: "control", action: control });
  };
  return {
    /** Whether the card is shown. */
    get visible() {
      return visible;
    },
    /** Shows the card. */
    async show() {
      if (visible) return;
      visible = true;
      drawn = "";
      layout = null;
      void tf.audit("card.shown", {}).catch(() => {
      });
      await draw();
    },
    /** Hides the card (`byUser`: the user hid the overlays). */
    async hide(byUser = false) {
      if (!visible) return;
      visible = false;
      listOpen = false;
      void tf.audit("card.hidden", { byUser }).catch(() => {
      });
      if (!byUser) await tf.overlay.hide();
    },
    /** What the page reported about the player. */
    async status(message) {
      const next = cleanStatus(message);
      if (!next) return;
      status = next;
      await draw();
    },
    /** The window closed: the video stopped. */
    async stopped() {
      status = null;
      docked = "";
      await draw();
    },
    /** Where the docked video goes now (the card's layout read first if needed). */
    async videoSpot() {
      if (!layout) layout = await tf.overlay.layout();
      return computeLayout(layout, hooks.corner(), { list: listOpen, video: true }).video;
    },
    /** The recent list or a setting changed. */
    redraw: () => draw(),
    /** The panes moved. */
    async moved(next) {
      if (next && typeof next === "object") layout = next;
      await draw();
    },
    /** A pointer event on one of the card's items. */
    async pointer(e) {
      if (!visible || e?.type !== "click") return;
      if (e.item === "card") {
        return hooks.docked() && hooks.isOpen() ? hooks.paste() : hooks.openWindow();
      }
      if (e.item === "list") {
        const rect = computeLayout(layout, hooks.corner(), { list: true }).list;
        const videos = hooks.recent().slice(0, LIST_ROWS);
        const row = listHit(rect, Number(e.x), Number(e.y), videos.length);
        if (row === null) return;
        listOpen = false;
        await draw();
        return hooks.play(videos[row].id);
      }
      const action = actionForClick(String(e.item));
      if (action) await act(action);
    },
    /** A palette command: one of the buttons' actions. */
    run: (action) => act(action)
  };
}

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
var CORNER_KEYS = {
  "bottom-right": "corner-bottom-right",
  "bottom-left": "corner-bottom-left",
  "top-right": "corner-top-right",
  "top-left": "corner-top-left"
};
var SETTINGS = [
  { key: "autoplay", default: true, label: "setting-autoplay" },
  { key: "captions", default: false, label: "setting-captions" },
  { key: "private", default: true, label: "setting-private" }
];
function registerSettings(tf) {
  for (const s of SETTINGS) tf.setting(s.key, s.default, tf.t(s.label));
  tf.setting("showCard", true, tf.t("setting-show-card"));
  tf.setting("corner", "bottom-right", tf.t("setting-corner"), {
    choices: CORNERS.map((value) => ({ value, label: tf.t(CORNER_KEYS[value]) }))
  });
}
function showCardSetting(settings) {
  try {
    return settings.get("showCard") !== false;
  } catch {
    return true;
  }
}
function cornerSetting(settings) {
  try {
    return cornerOf(settings.get("corner"));
  } catch {
    return cornerOf(null);
  }
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
  { id: "back", title: "cmd-back" },
  { id: "forward", title: "cmd-forward" },
  { id: "mute", title: "cmd-mute" },
  { id: "card", title: "cmd-card" },
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
  let pending = null;
  let docked = false;
  const canDock = () => typeof tf.page?.dock === "function" && !!tf.overlay;
  const card = tf.overlay ? createCard(tf, {
    post: (m) => post(m),
    openWindow: () => show({ resume: true }),
    play: (id) => play(id),
    recent: () => recent ?? [],
    isOpen: () => open,
    corner: () => cornerSetting(tf.settings),
    docked: () => open && docked,
    redock: (spot) => tf.page.dock(spot),
    closeWindow: () => close(),
    paste: () => post({ do: "paste" })
  }) : null;
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
      recent: await loadRecent(),
      docked
    });
  };
  const show = async ({ resume = false } = {}) => {
    if (!tf.page) {
      await tf.toast(tf.t("toast-no-pages"));
      return;
    }
    if (!open && resume && !pending) pending = (await loadRecent())[0]?.id ?? null;
    const withCard = !!card && showCardSetting(tf.settings);
    if (withCard) await card.show();
    if (open) await tf.page.open({ origin: "https" });
    else if (withCard && canDock()) {
      await tf.page.open({ origin: "https", dock: await card.videoSpot() });
      docked = true;
    } else {
      await tf.page.open({ origin: "https" });
      docked = false;
    }
    if (!open) void audit("opened", { docked });
    open = true;
  };
  const play = async (id) => {
    if (open) return post({ do: "play", id });
    pending = id;
    return show();
  };
  const control = async (action) => {
    if (card) return card.run(action);
    if (!open) return show({ resume: true });
    return post({ do: "control", action: action === "mute" ? "mute" : action });
  };
  const toggleCard = async () => {
    if (!card) return;
    if (!card.visible) return card.show();
    await card.hide();
    if (open && docked) await close();
  };
  const close = async () => {
    if (!tf.page || !open) return;
    await tf.page.close();
  };
  const toggle = async () => {
    if (open) await post({ do: "toggle" });
    else await show({ resume: true });
  };
  const hear = async (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      await setup();
      if (pending) {
        const id = pending;
        pending = null;
        await post({ do: "play", id });
      }
    } else if (message.type === "status") {
      await card?.status(message);
    } else if (message.type === "watching") {
      const before = await loadRecent();
      const after = addRecent(before, message);
      if (after === before) return;
      recent = after;
      await tf.store.set(KEYS.recent, recent).catch(() => {
      });
      await card?.redraw();
      void audit("video.start", { from: FROM.includes(message.from) ? message.from : "link" });
      await post({ do: "recent", recent });
    } else if (message.type === "error") {
      const code = message.code === "api" ? "api" : Number(message.code) || 0;
      void audit("video.error", { code });
      void warn(`player error ${code}`);
    }
  };
  const background = (fn) => (e) => void Promise.resolve().then(() => fn(e)).catch((err) => warn(err));
  const runs = {
    open: () => show(),
    toggle,
    close,
    back: () => control("back"),
    forward: () => control("forward"),
    mute: () => control("mute"),
    card: toggleCard
  };
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
      docked = false;
      await card?.stopped();
    })
  );
  tf.on(
    "overlay.pointer",
    background((e) => card?.pointer(e))
  );
  tf.on(
    "overlay.layout",
    background((e) => card?.moved(e))
  );
  tf.on(
    "overlay.hidden",
    background(() => card?.hide(true))
  );
  tf.on(
    "setting.changed",
    background(async () => {
      if (open) await setup();
      await card?.redraw();
    })
  );
  return { state: () => ({ open, recent, card: card?.visible ?? false }) };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runWatchpane(tf);
};
export default main_default;
