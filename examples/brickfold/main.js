/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Brickfold (example tile)
 *
 * A brick breaker in the corner of your pane: keep the ball in play with
 * your paddle and break the wall. Tilefold draws the board and its buttons
 * as an overlay (permission window.overlay), so the game can never take
 * your typing or see your terminal. Play with Ctrl+Alt shortcuts (⌃⌥ on
 * macOS) or the buttons under the board; click the board to start or pause.
 *
 * The game itself (engine/) and its drawing (render/) know nothing about
 * Tilefold. The arcade kit in tile/ connects them to it, and is the same
 * in every arcade example, so this folder works on its own.
 *
 * Build:  npx @tilefold/tile-tools build
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/brickfold.js
var MOVES = [
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+BracketLeft", other: "Ctrl+Alt+BracketLeft" },
    icon: "left",
    label: "button-left"
  },
  {
    id: "launch",
    title: "cmd-launch",
    action: "launch",
    key: { mac: "Ctrl+Alt+Backslash", other: "Ctrl+Alt+Backslash" },
    icon: "launch",
    label: "button-launch"
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+BracketRight", other: "Ctrl+Alt+BracketRight" },
    icon: "right",
    label: "button-right"
  }
];
var SOUNDS = {
  brick: { from: 880, to: 990, ms: 60, wave: "square", volume: 0.2 },
  lose: { from: 330, to: 90, ms: 500, wave: "triangle" },
  level: [
    { from: 523, ms: 90, wave: "triangle" },
    { from: 659, ms: 90, wave: "triangle" },
    { from: 784, ms: 90, wave: "triangle" },
    { from: 1047, ms: 180, wave: "triangle" }
  ],
  over: { from: 392, to: 98, ms: 800, wave: "triangle" }
};
function soundFor(event) {
  if (event.type === "brick") return event.broken ? "brick" : void 0;
  return ["lose", "level", "over"].includes(event.type) ? event.type : void 0;
}

// src/engine/rng.js
function createRng(seed) {
  let state = (Number.isFinite(seed) ? seed : 1) >>> 0;
  const next = () => {
    state = state + 1831565813 >>> 0;
    let v = state;
    v = Math.imul(v ^ v >>> 15, v | 1);
    v ^= v + Math.imul(v ^ v >>> 7, v | 61);
    return ((v ^ v >>> 14) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}

// src/engine/game.js
var W = 240;
var H = 256;
var TOP = 18;
var COLS = 10;
var ROWS = 6;
var BRICK_W = 22;
var BRICK_H = 9;
var BRICK_GAP = 1;
var WALL_X = (W - COLS * (BRICK_W + BRICK_GAP) + BRICK_GAP) / 2;
var WALL_Y = TOP + 22;
var ROW_POINTS = [60, 50, 40, 30, 20, 10];
var PADDLE_Y = H - 16;
var PADDLE_W = 40;
var PADDLE_H = 6;
var STEP = 14;
var BALL_R = 3;
var MAX_SPEED = 300;
var PATTERNS = [
  ["##########", "##########", "##########", "##########", "##########", "##########"],
  ["..######..", ".########.", "####XX####", "##########", ".########.", "..######.."],
  ["#.#.#.#.#.", ".#.#.#.#.#", "XXXXXXXXXX", "#.#.#.#.#.", ".#.#.#.#.#", "##########"],
  ["X########X", "#X######X#", "##X####X##", "###X##X###", "####XX####", "##########"]
];
function ballSpeed(level) {
  return Math.min(MAX_SPEED, 150 + (level - 1) * 18);
}
function wallFor(level) {
  const pattern = PATTERNS[(level - 1) % PATTERNS.length];
  return pattern.flatMap((row) => [...row].map((c) => c === "X" ? 2 : c === "#" ? 1 : 0));
}
function createGame(seed) {
  const rng = createRng(seed);
  const state = {
    score: 0,
    lives: 3,
    level: 1,
    over: false,
    paddle: { x: W / 2 },
    ball: { x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, stuck: true },
    bricks: wallFor(1)
  };
  const stick = () => {
    state.ball = { x: state.paddle.x, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, stuck: true };
  };
  const aim = (angle) => {
    const speed = ballSpeed(state.level);
    state.ball.vx = Math.sin(angle) * speed;
    state.ball.vy = -Math.cos(angle) * speed;
  };
  const act = (action) => {
    if (state.over) return [];
    if (action === "left" || action === "right") {
      const dx = action === "left" ? -STEP : STEP;
      state.paddle.x = Math.min(
        W - PADDLE_W / 2 - 2,
        Math.max(PADDLE_W / 2 + 2, state.paddle.x + dx)
      );
      if (state.ball.stuck) state.ball.x = state.paddle.x;
      return [];
    }
    if (action === "launch" && state.ball.stuck) {
      state.ball.stuck = false;
      aim((rng.next() - 0.5) * 1.2);
      return [{ type: "launch" }];
    }
    return [];
  };
  const brickAt = (x, y) => {
    const col = Math.floor((x - WALL_X) / (BRICK_W + BRICK_GAP));
    const row = Math.floor((y - WALL_Y) / (BRICK_H + BRICK_GAP));
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    const i = row * COLS + col;
    return state.bricks[i] > 0 ? i : -1;
  };
  const move = (dt, events) => {
    const b = state.ball;
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    if (nx - BALL_R < 0 || nx + BALL_R > W) b.vx = -b.vx;
    if (ny - BALL_R < TOP) b.vy = Math.abs(b.vy);
    const edgeX = nx + Math.sign(b.vx) * BALL_R;
    const edgeY = ny + Math.sign(b.vy) * BALL_R;
    const hitX = brickAt(edgeX, b.y);
    const hitY = brickAt(b.x, edgeY);
    for (const i of /* @__PURE__ */ new Set([hitX, hitY])) {
      if (i < 0) continue;
      state.bricks[i] -= 1;
      const broken = state.bricks[i] === 0;
      if (broken) state.score += ROW_POINTS[Math.floor(i / COLS)];
      events.push({ type: "brick", broken });
    }
    if (hitX >= 0) b.vx = -b.vx;
    if (hitY >= 0) b.vy = -b.vy;
    const px = state.paddle.x;
    if (b.vy > 0 && ny + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H && nx >= px - PADDLE_W / 2 - BALL_R && nx <= px + PADDLE_W / 2 + BALL_R) {
      const offset = Math.max(-1, Math.min(1, (nx - px) / (PADDLE_W / 2)));
      aim(offset * 1.05);
      events.push({ type: "paddle" });
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.x = Math.max(BALL_R, Math.min(W - BALL_R, b.x));
  };
  const step = (ms) => {
    const events = [];
    if (state.over || state.ball.stuck) return events;
    const speed = Math.hypot(state.ball.vx, state.ball.vy) || 1;
    const parts = Math.max(1, Math.ceil(speed * ms / 1e3 / 2));
    for (let i = 0; i < parts && !state.ball.stuck; i++) {
      move(ms / 1e3 / parts, events);
      if (state.ball.y - BALL_R > H) {
        state.lives -= 1;
        events.push({ type: "lose" });
        if (state.lives <= 0) {
          state.over = true;
          events.push({ type: "over" });
          return events;
        }
        stick();
      }
    }
    if (state.bricks.every((n) => n === 0)) {
      state.level += 1;
      state.bricks = wallFor(state.level);
      stick();
      events.push({ type: "level", level: state.level });
    }
    return events;
  };
  return { state, act, step };
}

// src/render/svg.js
var MAX_SIDE = 256;
var HUD_H = 18;
var THEME = {
  panel: "#0b0d17",
  border: "#2a2f45",
  text: "#e5e7eb",
  muted: "#9ca3af",
  accent: "#22d3ee",
  warn: "#f97316",
  shade: "#000000",
  button: "#1b1f30"
};
function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function svgUrl(w, h, body, displayW = w, displayH = h) {
  const dw = Math.min(MAX_SIDE, Math.round(displayW * 100) / 100);
  const dh = Math.min(MAX_SIDE, Math.round(displayH * 100) / 100);
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
}
function frame(w, h) {
  return `<rect width="${w}" height="${h}" rx="6" fill="${THEME.panel}" fill-opacity="0.94"/><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" fill="none" stroke="${THEME.border}"/>`;
}
function textWidth(value, size) {
  let units = 0;
  for (const ch of value)
    units += /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 1.7 : 1;
  return units * size * 0.6;
}
function text(x, y, value, o = {}) {
  const size = o.size ?? 9;
  const squeeze = o.fit && textWidth(String(value), size) > o.fit ? ` textLength="${o.fit}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${x}" y="${y}"${squeeze} font-family="ui-monospace,Menlo,monospace" font-size="${size}" font-weight="${o.weight ?? 600}" fill="${o.fill ?? THEME.text}" text-anchor="${o.anchor ?? "start"}">${escapeXml(value)}</text>`;
}
function hud(w, o) {
  const y = 12;
  let lives = "";
  for (let i = 0; i < Math.min(o.lives, 5); i++) {
    lives += `<rect x="${w - 10 - i * 8}" y="6" width="5" height="5" fill="${o.lifeColor ?? THEME.accent}"/>`;
  }
  return text(6, y, `${o.labels.score} ${o.score}`, { size: 8, fit: 76 }) + text(w / 2 - 8, y, `${o.labels.best} ${o.best}`, {
    size: 8,
    fill: THEME.muted,
    anchor: "middle",
    fit: 72
  }) + text(w - 14 - Math.min(o.lives, 5) * 8, y, `${o.labels.level} ${o.level}`, {
    size: 8,
    fill: THEME.muted,
    anchor: "end",
    fit: 52
  }) + lives + `<line x1="4" y1="${HUD_H - 0.5}" x2="${w - 4}" y2="${HUD_H - 0.5}" stroke="${THEME.border}"/>`;
}
function banner(w, h, title, hint = "") {
  const y = h / 2;
  return `<rect x="0" y="${HUD_H}" width="${w}" height="${h - HUD_H}" fill="${THEME.shade}" fill-opacity="0.45"/><rect x="12" y="${y - 24}" width="${w - 24}" height="${hint ? 44 : 30}" rx="6" fill="${THEME.panel}" stroke="${THEME.accent}"/>` + text(w / 2, y - 4, title, { size: 13, anchor: "middle", fill: THEME.accent, fit: w - 36 }) + (hint ? text(w / 2, y + 12, hint, { size: 9, anchor: "middle", fill: THEME.muted, fit: w - 36 }) : "");
}
var ICONS = {
  left: `<path d="M18 8 L10 15 L18 22 Z" fill="${THEME.text}"/>`,
  right: `<path d="M12 8 L20 15 L12 22 Z" fill="${THEME.text}"/>`,
  up: `<path d="M8 18 L15 10 L22 18 Z" fill="${THEME.text}"/>`,
  down: `<path d="M8 12 L15 20 L22 12 Z" fill="${THEME.text}"/>`,
  fire: `<circle cx="15" cy="15" r="6" fill="${THEME.warn}"/><circle cx="15" cy="15" r="2.5" fill="${THEME.text}"/>`,
  jump: `<path d="M9 20 Q15 4 21 20" fill="none" stroke="${THEME.text}" stroke-width="2.5"/>`,
  launch: `<path d="M15 7 L15 21 M9 13 L15 7 L21 13" fill="none" stroke="${THEME.text}" stroke-width="2.5"/>`,
  pause: `<rect x="10" y="9" width="3.5" height="12" fill="${THEME.text}"/><rect x="16.5" y="9" width="3.5" height="12" fill="${THEME.text}"/>`,
  play: `<path d="M11 8 L22 15 L11 22 Z" fill="${THEME.text}"/>`
};
function buttonImage(icon, side) {
  return svgUrl(
    30,
    30,
    `<circle cx="15" cy="15" r="14" fill="${THEME.button}" stroke="${THEME.border}"/>` + (ICONS[icon] ?? ""),
    side,
    side
  );
}

// src/render/board.js
var ROW_COLORS = ["#f43f5e", "#f97316", "#facc15", "#4ade80", "#22d3ee", "#818cf8"];
function brick(i, hits, tough) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = WALL_X + col * (BRICK_W + BRICK_GAP);
  const y = WALL_Y + row * (BRICK_H + BRICK_GAP);
  const color = ROW_COLORS[row % ROW_COLORS.length];
  let out = `<rect x="${x}" y="${y}" width="${BRICK_W}" height="${BRICK_H}" rx="1.5" fill="${color}"/><rect x="${x + 1}" y="${y + 1}" width="${BRICK_W - 2}" height="2" fill="#ffffff" fill-opacity="0.35"/>`;
  if (tough) {
    out += `<rect x="${x + 0.75}" y="${y + 0.75}" width="${BRICK_W - 1.5}" height="${BRICK_H - 1.5}" rx="1.5" fill="none" stroke="#ffffff" stroke-opacity="${hits > 1 ? 0.9 : 0.3}" stroke-width="1.5"/>`;
    if (hits === 1) {
      out += `<path d="M${x + 8} ${y + 2} l3 3 l-2 2 l3 2" stroke="#0b0d17" fill="none"/>`;
    }
  }
  return out;
}
function statusBanner(status, state, t, format) {
  if (status === "none") return banner(W, H, "BRICKFOLD", t("banner-start"));
  if (status === "paused") return banner(W, H, t("banner-paused"), t("banner-paused-hint"));
  if (status === "over") {
    return banner(
      W,
      H,
      t("banner-over"),
      t("banner-over-hint", { score: format(state ? state.score : 0) })
    );
  }
  return "";
}
function renderBoard({ state, status, best, t, format, w, h }) {
  let body = frame(W, H);
  body += hud(W, {
    score: format(state ? state.score : 0),
    best: format(Math.max(best, state ? state.score : 0)),
    level: format(state ? state.level : 1),
    lives: state ? Math.max(0, state.lives) : 3,
    labels: { score: t("hud-score"), best: t("hud-best"), level: t("hud-level") },
    lifeColor: "#e5e7eb"
  });
  const bricks = state ? state.bricks : wallFor(1);
  const tough = wallFor(state ? state.level : 1);
  bricks.forEach((hits, i) => {
    if (hits > 0) body += brick(i, hits, tough[i] === 2);
  });
  const px = state ? state.paddle.x : W / 2;
  body += `<rect x="${Math.round(px - PADDLE_W / 2)}" y="${PADDLE_Y}" width="${PADDLE_W}" height="${PADDLE_H}" rx="3" fill="${THEME.accent}"/><rect x="${Math.round(px - PADDLE_W / 2) + 3}" y="${PADDLE_Y + 1}" width="${PADDLE_W - 6}" height="1.5" fill="#ffffff" fill-opacity="0.5"/>`;
  const ball = state ? state.ball : { x: W / 2, y: PADDLE_Y - BALL_R, stuck: true };
  body += `<circle cx="${Math.round(ball.x * 10) / 10}" cy="${Math.round(ball.y * 10) / 10}" r="${BALL_R}" fill="#f8fafc"/>`;
  if (state && ball.stuck && status === "playing") {
    body += text(W / 2, PADDLE_Y - 14, `\u2191 ${t("button-launch")}`, {
      size: 8,
      anchor: "middle",
      fill: THEME.muted,
      fit: W - 40
    });
  }
  body += statusBanner(status, state, t, format);
  return svgUrl(W, H, body, w, h);
}

// src/tile/settings.js
var CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
var SIZES = { medium: 1, small: 0.75 };
var CORNER_LABELS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left"
};
var SETTINGS = [
  { key: "sounds", default: true, label: "setting-sounds" },
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
  { key: "pauseOnBlur", default: true, label: "setting-pause-on-blur" }
];
var LAYOUT_KEYS = ["size", "corner"];
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
  const corner = get("corner");
  return {
    sounds: get("sounds") !== false,
    size: get("size") === "small" ? "small" : "medium",
    corner: CORNERS.includes(
      /** @type {string} */
      corner
    ) ? (
      /** @type {string} */
      corner
    ) : "bottom-right",
    pauseOnBlur: get("pauseOnBlur") !== false
  };
}

// src/tile/layout.js
var BUTTON = 30;
var BUTTON_GAP = 6;
var GAP = 6;
var MARGIN = 12;
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
function computeLayout(layout, settings, board, buttons) {
  const scale = SIZES[settings.size] ?? 1;
  const area = areaOf(layout);
  const w = Math.round(board.w * scale);
  const boardH = Math.round(board.h * scale);
  const btn = Math.round(BUTTON * scale);
  const h = boardH + Math.round(GAP * scale) + btn;
  const right = settings.corner.endsWith("right");
  const bottom = settings.corner.startsWith("bottom");
  const gx = Math.max(0, Math.round(right ? area.x + area.w - w - MARGIN : area.x + MARGIN));
  const gy = Math.max(0, Math.round(bottom ? area.y + area.h - h - MARGIN : area.y + MARGIN));
  const rects = { board: { x: gx, y: gy, w, h: boardH } };
  const rowW = buttons.length * btn + (buttons.length - 1) * Math.round(BUTTON_GAP * scale);
  let x = gx + Math.round((w - rowW) / 2);
  const y = gy + boardH + Math.round(GAP * scale);
  for (const id of buttons) {
    rects[`btn-${id}`] = { x, y, w: btn, h: btn };
    x += btn + Math.round(BUTTON_GAP * scale);
  }
  return rects;
}

// src/tile/sound.js
var RATE = 11025;
var MIN_GAP_MS = 550;
var MAX_PER_MINUTE = 24;
function wavUrl(samples) {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at, s) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 32768)));
  }
  return `data:audio/wav;base64,${btoa(bin)}`;
}
function toneSamples(spec) {
  const parts = Array.isArray(spec) ? spec : [spec];
  const total = parts.reduce((n, p) => n + Math.round(RATE * p.ms / 1e3), 0);
  const out = new Float32Array(total);
  let at = 0;
  let noise = 625341585;
  for (const p of parts) {
    const n = Math.round(RATE * p.ms / 1e3);
    const to = p.to ?? p.from;
    const volume = p.volume ?? 0.35;
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const progress = i / n;
      phase += (p.from + (to - p.from) * progress) / RATE;
      const cycle = phase % 1;
      let v;
      if (p.wave === "noise") {
        noise ^= noise << 13;
        noise ^= noise >>> 17;
        noise ^= noise << 5;
        v = (noise >>> 0) / 4294967296 * 2 - 1;
      } else if (p.wave === "triangle") {
        v = 1 - 4 * Math.abs(cycle - 0.5);
      } else {
        v = cycle < 0.5 ? 1 : -1;
      }
      const fade = Math.min(1, i / 40, (n - i) / (n * 0.35 + 1));
      out[at + i] = v * volume * fade;
    }
    at += n;
  }
  return out;
}
function createSounds(tf, enabled, specs, now = Date.now) {
  const cache = /* @__PURE__ */ new Map();
  const played = [];
  const url = (name) => {
    if (!Object.hasOwn(specs, name)) return null;
    if (!cache.has(name)) cache.set(name, wavUrl(toneSamples(specs[name])));
    return cache.get(name);
  };
  return {
    url,
    play(name) {
      if (!enabled() || !tf.sound) return;
      const src = url(name);
      if (!src) return;
      const t = now();
      while (played.length && t - played[0] > 6e4) played.shift();
      const last = played[played.length - 1];
      if (last !== void 0 && t - last < MIN_GAP_MS) return;
      if (played.length >= MAX_PER_MINUTE) return;
      played.push(t);
      void Promise.resolve().then(() => tf.sound.play({ src, volume: 0.6 })).catch(() => {
      });
    }
  };
}

// src/tile/arcade.js
var KIT_COMMANDS = [
  { id: "new-game", title: "cmd-new-game", action: "newGame" },
  { id: "pause", title: "cmd-pause", action: "pause" }
];
var BOARD_LABELS = {
  none: "board-label-none",
  playing: "board-label-playing",
  paused: "board-label-paused",
  over: "board-label-over"
};
var FIELDS = ["image", "x", "y", "w", "h", "label", "hit", "cursor"];
function diffItems(before, after) {
  const old = new Map(before.map((i) => [i.id, i]));
  const out = [];
  for (const item of after) {
    const prev = old.get(item.id);
    if (!prev) {
      out.push(item);
      continue;
    }
    const change = { id: item.id };
    let changed = false;
    for (const f of FIELDS) {
      if (item[f] !== prev[f]) {
        change[f] = item[f];
        changed = true;
      }
    }
    if (changed) out.push(change);
  }
  return out;
}
function boardAction(status) {
  return status === "playing" || status === "paused" ? "pause" : "newGame";
}
function runArcade(tf, game) {
  const settings = () => readSettings(tf.settings);
  const sounds = createSounds(tf, () => settings().sounds, game.sounds);
  const format = (() => {
    try {
      const nf = new Intl.NumberFormat();
      return (n) => nf.format(n);
    } catch {
      return (n) => String(n);
    }
  })();
  const seed = game.seed ?? (() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const buttons = [
    ...game.moves.filter((m) => m.icon),
    { id: "pause", icon: "pause", action: "pause" }
  ];
  let status = "none";
  let engine = null;
  let best = 0;
  let visible = false;
  let layout = null;
  let shown = null;
  let clock = null;
  const fail = (err) => {
    void Promise.resolve(tf.log?.error(String(err && err.message ? err.message : err))).catch(
      () => {
      }
    );
  };
  const record = (action, details) => {
    void Promise.resolve(tf.audit?.(action, details)).catch(() => {
    });
  };
  const items = () => {
    const s = settings();
    const rects = computeLayout(
      layout,
      s,
      game.board,
      buttons.map((b) => b.id)
    );
    const scale = SIZES[s.size] ?? 1;
    const t = (key, args) => tf.t(key, args);
    const board = rects.board;
    const list = [
      {
        id: "board",
        image: game.render({
          state: engine ? engine.state : null,
          status,
          best,
          t,
          format,
          w: board.w,
          h: board.h
        }),
        ...board,
        label: tf.t(BOARD_LABELS[status]),
        hit: true,
        cursor: "pointer"
      }
    ];
    for (const b of buttons) {
      const r = rects[`btn-${b.id}`];
      const icon = b.id === "pause" && status !== "playing" ? "play" : b.icon;
      list.push({
        id: `btn-${b.id}`,
        image: buttonImage(icon, Math.round(30 * scale)),
        ...r,
        label: tf.t(b.id === "pause" ? "button-pause" : b.label),
        hit: true,
        cursor: "pointer"
      });
    }
    return list;
  };
  const paint = async () => {
    if (!visible) return;
    const next = items();
    if (!shown) {
      const ok = await tf.overlay.show({ items: next });
      if (ok === false) {
        pause("hidden");
        return;
      }
      shown = next;
      return;
    }
    const changes = diffItems(shown, next);
    shown = next;
    if (changes.length) await tf.overlay.update({ items: changes });
  };
  let drawing = null;
  let dirty = false;
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
          fail(err);
        } finally {
          drawing = null;
        }
      })();
    }
    return drawing;
  };
  const syncClock = () => {
    const want = status === "playing" && visible;
    if (want && clock === null) clock = setInterval(tick, game.tickMs);
    if (!want && clock !== null) {
      clearInterval(clock);
      clock = null;
    }
  };
  const handle = (events) => {
    for (const e of events ?? []) {
      const name = game.soundFor(e);
      if (name) sounds.play(name);
    }
    if (engine && engine.state.over && status === "playing") void gameOver();
  };
  function tick() {
    if (status !== "playing" || !engine) return;
    try {
      handle(engine.step(game.tickMs));
    } catch (err) {
      fail(err);
    }
    void draw();
  }
  const gameOver = async () => {
    status = "over";
    syncClock();
    const score = Number(engine.state.score) || 0;
    const isBest = score > best;
    if (isBest) {
      best = score;
      await tf.store.set("best", best);
      record("best-new", { score });
    }
    record("game-over", { score, level: Number(engine.state.level) || 1, best: isBest });
    await draw();
  };
  const newGame = () => {
    engine = game.create(seed());
    status = "playing";
    record("game-start", {});
    syncClock();
  };
  function pause(reason) {
    if (status !== "playing") return false;
    status = "paused";
    syncClock();
    record("game-pause", { reason });
    void draw();
    return true;
  }
  const resume = () => {
    if (status !== "paused") return false;
    status = "playing";
    syncClock();
    return true;
  };
  let loading = null;
  const ensureLoaded = () => {
    loading ??= (async () => {
      const stored = Number(await tf.store.get("best"));
      if (Number.isFinite(stored) && stored > best) best = stored;
    })().catch(fail);
    return loading;
  };
  const show = async () => {
    visible = true;
    shown = null;
    try {
      layout = await tf.overlay.layout();
    } catch {
      layout = null;
    }
    await tf.store.set("visible", true);
    syncClock();
    await draw();
  };
  const hide = async () => {
    pause("hidden");
    visible = false;
    shown = null;
    syncClock();
    await tf.overlay.hide();
    await tf.store.set("visible", false);
  };
  const run = async (action) => {
    await ensureLoaded();
    if (action === "toggle") return visible ? hide() : show();
    if (action === "newGame") {
      if (!visible) await show();
      newGame();
      return draw();
    }
    if (action === "pause") {
      if (!visible) return show();
      if (status === "playing") pause("user");
      else if (status === "paused") resume();
      else newGame();
      return draw();
    }
    if (!visible || status !== "playing" || !engine) return void 0;
    handle(engine.act(action));
    return draw();
  };
  const background = (fn) => (e) => {
    void (async () => {
      await ensureLoaded();
      await fn(e);
    })().catch(fail);
  };
  const commands = [
    ...KIT_COMMANDS,
    { id: "toggle", title: "cmd-toggle", action: "toggle", key: game.toggleKey },
    ...game.moves
  ];
  for (const c of commands) {
    const options = c.key ? { id: c.id, key: c.key } : { id: c.id };
    tf.command(tf.t(c.title), () => void run(c.action).catch(fail), options);
  }
  tf.on(
    "app.ready",
    background(async () => {
      if (!visible && await tf.store.get("visible") === true) await show();
    })
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.type !== "click" || !visible) return;
      const id = String(e.item);
      if (id === "board") return run(boardAction(status));
      const b = buttons.find((x) => `btn-${x.id}` === id);
      if (b) return run(b.action);
      return void 0;
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
      pause("hidden");
      shown = null;
    })
  );
  tf.on(
    "window.blurred",
    background(async () => {
      if (settings().pauseOnBlur) pause("blur");
    })
  );
  tf.on(
    "user.idle",
    background(async () => {
      pause("idle");
    })
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      if (!visible) return;
      if (e && LAYOUT_KEYS.includes(e.key)) {
        try {
          layout = await tf.overlay.layout();
        } catch {
        }
      }
      await draw();
    })
  );
  return { run, status: () => status, engine: () => engine };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runArcade(tf, {
    board: { w: W, h: H },
    tickMs: 40,
    create: createGame,
    render: renderBoard,
    moves: MOVES,
    toggleKey: { mac: "Ctrl+Alt+F", other: "Ctrl+Alt+F" },
    sounds: SOUNDS,
    soundFor
  });
};
export default main_default;
