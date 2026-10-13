/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Orbit Guard (example tile)
 *
 * A fixed shooter in the corner of your pane: hold off rows of marching
 * drones from behind your shields. Tilefold draws the board and its buttons
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
var ROWS = 5;
var COLS = 8;
var DRONE_W = 16;
var DRONE_H = 12;
var SPACE_X = 22;
var SPACE_Y = 16;
var CANNON_Y = H - 18;
var CANNON_W = 16;
var CANNON_H = 8;
var STEP = 6;
var SHOT_SPEED = 260;
var BOMB_SPEED = 110;
var MAX_BOMBS = 3;
var SHIELDS = 4;
var SHIELD_COLS = 6;
var SHIELD_ROWS = 4;
var CELL = 4;
var SHIELD_Y = H - 52;
var SHIP_Y = TOP + 4;
var SHIP_W = 20;
var SHIP_SPEED = 60;
var SHIP_POINTS = [50, 100, 150, 300];
var ROW_POINTS = [30, 20, 20, 10, 10];
var RESPAWN_MS = 1200;
var shieldX = (i) => 30 + i * 60 - SHIELD_COLS * CELL / 2;
function marchMs(alive, level) {
  return Math.max(60, 40 + alive * 13 - (level - 1) * 40);
}
function wave(state) {
  state.drones = new Array(ROWS * COLS).fill(true);
  state.ox = 20;
  state.oy = TOP + 22 + Math.min(state.level - 1, 5) * 8;
  state.dir = 1;
  state.frame = 0;
  state.marchIn = marchMs(ROWS * COLS, state.level);
  state.shields = Array.from(
    { length: SHIELDS },
    () => Array.from(
      { length: SHIELD_COLS * SHIELD_ROWS },
      (_, i) => !(i >= SHIELD_COLS * (SHIELD_ROWS - 1) && i % SHIELD_COLS >= 2 && i % SHIELD_COLS <= 3)
    )
  );
  state.shot = null;
  state.bombs = [];
}
var hits = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
function createGame(seed) {
  const rng = createRng(seed);
  const state = {
    score: 0,
    lives: 3,
    level: 1,
    over: false,
    cannon: { x: W / 2, down: 0 },
    ship: null,
    shipIn: 12e3 + rng.int(8e3),
    blasts: []
  };
  wave(state);
  const droneAt = (row, col) => state.drones[row * COLS + col] ? { x: state.ox + col * SPACE_X, y: state.oy + row * SPACE_Y } : null;
  const chipShield = (x, y) => {
    for (let i = 0; i < SHIELDS; i++) {
      const sx = shieldX(i);
      if (x < sx || x >= sx + SHIELD_COLS * CELL || y < SHIELD_Y || y >= SHIELD_Y + SHIELD_ROWS * CELL)
        continue;
      const c = Math.floor((x - sx) / CELL) + Math.floor((y - SHIELD_Y) / CELL) * SHIELD_COLS;
      if (state.shields[i][c]) {
        state.shields[i][c] = false;
        return true;
      }
    }
    return false;
  };
  const act = (action) => {
    if (state.over || state.cannon.down > 0) return [];
    if (action === "left") state.cannon.x = Math.max(10, state.cannon.x - STEP);
    else if (action === "right") state.cannon.x = Math.min(W - 10, state.cannon.x + STEP);
    else if (action === "fire" && !state.shot) {
      state.shot = { x: state.cannon.x, y: CANNON_Y - 4 };
      return [{ type: "fire" }];
    }
    return [];
  };
  const march = (events) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let lowest = -Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = droneAt(r, c);
        if (!d) continue;
        minX = Math.min(minX, d.x);
        maxX = Math.max(maxX, d.x + DRONE_W);
        lowest = Math.max(lowest, d.y + DRONE_H);
      }
    }
    const dx = 4 * state.dir;
    if (minX + dx < 4 || maxX + dx > W - 4) {
      state.oy += 8;
      state.dir = -state.dir;
      lowest += 8;
    } else {
      state.ox += dx;
    }
    state.frame = 1 - state.frame;
    if (lowest >= SHIELD_Y) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const d = droneAt(r, c);
          if (!d) continue;
          for (let x = d.x; x < d.x + DRONE_W; x += CELL)
            for (let y = d.y; y < d.y + DRONE_H; y += CELL) chipShield(x, y);
        }
      }
    }
    if (lowest >= CANNON_Y) {
      state.over = true;
      events.push({ type: "over" });
    }
  };
  const maybeBomb = (ms) => {
    if (state.bombs.length >= MAX_BOMBS || state.cannon.down > 0) return;
    const chance = ms / 1e3 * (0.9 + state.level * 0.25);
    if (rng.next() > chance) return;
    const cols = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (droneAt(r, c)) {
          cols.push(droneAt(r, c));
          break;
        }
      }
    }
    if (!cols.length) return;
    const d = cols[rng.int(cols.length)];
    state.bombs.push({ x: d.x + DRONE_W / 2, y: d.y + DRONE_H });
  };
  const step = (ms) => {
    const events = [];
    if (state.over) return events;
    const dt = ms / 1e3;
    state.blasts = state.blasts.map((b) => ({ ...b, ms: b.ms - ms })).filter((b) => b.ms > 0);
    if (state.cannon.down > 0) state.cannon.down = Math.max(0, state.cannon.down - ms);
    if (state.shot) {
      state.shot.y -= SHOT_SPEED * dt;
      const s = state.shot;
      let spent = s.y < TOP;
      if (!spent && chipShield(s.x, s.y)) spent = true;
      for (let r = 0; r < ROWS && !spent; r++) {
        for (let c = 0; c < COLS && !spent; c++) {
          const d = droneAt(r, c);
          if (d && hits(s.x - 1, s.y, 2, 6, d.x, d.y, DRONE_W, DRONE_H)) {
            state.drones[r * COLS + c] = false;
            state.score += ROW_POINTS[r];
            state.blasts.push({ x: d.x, y: d.y, ms: 200 });
            events.push({ type: "hit", points: ROW_POINTS[r] });
            spent = true;
          }
        }
      }
      const ship2 = state.ship;
      if (!spent && ship2 && hits(s.x - 1, s.y, 2, 6, ship2.x, SHIP_Y, SHIP_W, 8)) {
        state.score += ship2.points;
        state.blasts.push({ x: ship2.x, y: SHIP_Y, ms: 400, points: ship2.points });
        events.push({ type: "ship", points: ship2.points });
        state.ship = null;
        spent = true;
      }
      if (spent) state.shot = null;
    }
    for (const b of state.bombs) b.y += BOMB_SPEED * dt;
    state.bombs = state.bombs.filter((b) => {
      if (b.y > H || chipShield(b.x, b.y)) return false;
      const cx = state.cannon.x - CANNON_W / 2;
      if (state.cannon.down === 0 && hits(b.x - 1, b.y, 2, 6, cx, CANNON_Y, CANNON_W, CANNON_H)) {
        state.lives -= 1;
        state.blasts.push({ x: cx, y: CANNON_Y, ms: 600 });
        events.push({ type: "die" });
        state.cannon.down = RESPAWN_MS;
        if (state.lives <= 0) {
          state.over = true;
          events.push({ type: "over" });
        }
        return false;
      }
      return true;
    });
    if (state.cannon.down > 0) state.bombs = state.bombs.filter((b) => b.y < SHIELD_Y);
    if (state.over) return events;
    if (state.ship) {
      state.ship.x += state.ship.dir * SHIP_SPEED * dt;
      if (state.ship.x < -SHIP_W || state.ship.x > W) state.ship = null;
    } else {
      state.shipIn -= ms;
      if (state.shipIn <= 0) {
        const dir = rng.next() < 0.5 ? 1 : -1;
        state.ship = {
          x: dir > 0 ? -SHIP_W : W,
          dir,
          points: SHIP_POINTS[rng.int(SHIP_POINTS.length)]
        };
        state.shipIn = 15e3 + rng.int(1e4);
      }
    }
    const alive = state.drones.filter(Boolean).length;
    if (alive === 0) {
      state.level += 1;
      wave(state);
      events.push({ type: "wave", level: state.level });
      return events;
    }
    state.marchIn -= ms;
    while (state.marchIn <= 0 && !state.over) {
      march(events);
      state.marchIn += marchMs(alive, state.level);
    }
    maybeBomb(ms);
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
var ROW_COLORS = ["#f472b6", "#a78bfa", "#a78bfa", "#38bdf8", "#38bdf8"];
var ROW_DESIGN = ["diamond", "orb", "orb", "wing", "wing"];
var DESIGNS = {
  diamond: [
    `<path d="M8 0 L15 6 L8 12 L1 6 Z" fill="currentColor"/><rect x="6" y="5" width="4" height="2" fill="#0b0d17"/>`,
    `<path d="M8 1 L16 6 L8 11 L0 6 Z" fill="currentColor"/><rect x="7" y="4" width="2" height="4" fill="#0b0d17"/>`
  ],
  orb: [
    `<circle cx="8" cy="7" r="5" fill="currentColor"/><path d="M3 2 L5 4 M13 2 L11 4" stroke="currentColor"/><rect x="6" y="6" width="4" height="2" fill="#0b0d17"/>`,
    `<circle cx="8" cy="6" r="5" fill="currentColor"/><path d="M2 1 L5 3 M14 1 L11 3 M4 11 L6 10 M12 11 L10 10" stroke="currentColor"/><rect x="6" y="5" width="4" height="2" fill="#0b0d17"/>`
  ],
  wing: [
    `<path d="M0 3 L8 7 L16 3 L13 10 L8 8 L3 10 Z" fill="currentColor"/><rect x="7" y="4" width="2" height="2" fill="#0b0d17"/>`,
    `<path d="M0 8 L8 4 L16 8 L13 11 L8 9 L3 11 Z" fill="currentColor"/><rect x="7" y="5" width="2" height="2" fill="#0b0d17"/>`
  ]
};
var DEFS = "<defs>" + Object.entries(DESIGNS).flatMap(
  ([name, poses]) => poses.map(
    (p, i) => `<symbol id="${name}${i}" viewBox="0 0 16 12" width="16" height="12">${p}</symbol>`
  )
).join("") + "</defs>";
var cannon = (x) => `<g fill="#4ade80"><rect x="${x - CANNON_W / 2}" y="${CANNON_Y + 3}" width="${CANNON_W}" height="${CANNON_H - 3}" rx="1"/><rect x="${x - CANNON_W / 2 + 3}" y="${CANNON_Y + 1}" width="${CANNON_W - 6}" height="3"/><rect x="${x - 1}" y="${CANNON_Y - 3}" width="2" height="5"/></g>`;
var ship = (x) => `<g><ellipse cx="${x + 10}" cy="${SHIP_Y + 5}" rx="10" ry="3.5" fill="${THEME.warn}"/><ellipse cx="${x + 10}" cy="${SHIP_Y + 2.5}" rx="5" ry="3" fill="#fde68a"/><rect x="${x + 4}" y="${SHIP_Y + 4}" width="2" height="2" fill="#0b0d17"/><rect x="${x + 9}" y="${SHIP_Y + 4}" width="2" height="2" fill="#0b0d17"/><rect x="${x + 14}" y="${SHIP_Y + 4}" width="2" height="2" fill="#0b0d17"/></g>`;
var blast = (b) => b.points ? text(b.x + 10, b.y + 7, b.points, { size: 8, anchor: "middle", fill: THEME.warn }) : `<path d="M${b.x + 8} ${b.y} L${b.x + 10} ${b.y + 5} L${b.x + 16} ${b.y + 6} L${b.x + 10} ${b.y + 8} L${b.x + 8} ${b.y + 12} L${b.x + 6} ${b.y + 8} L${b.x} ${b.y + 6} L${b.x + 6} ${b.y + 5} Z" fill="#fde68a"/>`;
function statusBanner(status, state, t, format) {
  if (status === "none") return banner(W, H, "ORBIT GUARD", t("banner-start"));
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
  let body = DEFS + frame(W, H);
  body += hud(W, {
    score: format(state ? state.score : 0),
    best: format(Math.max(best, state ? state.score : 0)),
    level: format(state ? state.level : 1),
    lives: state ? Math.max(0, state.lives) : 3,
    labels: { score: t("hud-score"), best: t("hud-best"), level: t("hud-level") },
    lifeColor: "#4ade80"
  });
  if (state) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!state.drones[r * COLS + c]) continue;
        const x = state.ox + c * SPACE_X;
        const y = state.oy + r * SPACE_Y;
        body += `<use href="#${ROW_DESIGN[r]}${state.frame}" x="${x}" y="${y}" width="${DRONE_W}" height="${DRONE_H}" color="${ROW_COLORS[r]}"/>`;
      }
    }
    for (let i = 0; i < SHIELDS; i++) {
      const sx = shieldX(i);
      state.shields[i].forEach((on, cell) => {
        if (!on) return;
        const x = sx + cell % SHIELD_COLS * CELL;
        const y = SHIELD_Y + Math.floor(cell / SHIELD_COLS) * CELL;
        body += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#22c55e" fill-opacity="0.8"/>`;
      });
    }
    if (state.ship) body += ship(Math.round(state.ship.x));
    if (state.shot) {
      body += `<rect x="${Math.round(state.shot.x) - 1}" y="${Math.round(state.shot.y)}" width="2" height="6" fill="${THEME.accent}"/>`;
    }
    for (const b of state.bombs) {
      body += `<path d="M${Math.round(b.x)} ${Math.round(b.y)} l2 2 l-2 2 l2 2" stroke="#fb7185" fill="none" stroke-width="1.5"/>`;
    }
    for (const b of state.blasts) body += blast(b);
    const down = state.cannon.down;
    if (down === 0 || Math.floor(down / 150) % 2 === 0) body += cannon(Math.round(state.cannon.x));
  } else {
    body += cannon(W / 2);
  }
  body += `<line x1="4" y1="${H - 6}" x2="${W - 4}" y2="${H - 6}" stroke="${THEME.border}"/>`;
  body += statusBanner(status, state, t, format);
  return svgUrl(W, H, body, w, h);
}

// src/orbit.js
var MOVES = [
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+Comma", other: "Ctrl+Alt+Comma" },
    icon: "left",
    label: "button-left"
  },
  {
    id: "fire",
    title: "cmd-fire",
    action: "fire",
    key: { mac: "Ctrl+Alt+Slash", other: "Ctrl+Alt+Slash" },
    icon: "fire",
    label: "button-fire"
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+Period", other: "Ctrl+Alt+Period" },
    icon: "right",
    label: "button-right"
  }
];
var SOUNDS = {
  hit: { from: 520, to: 180, ms: 90, wave: "noise", volume: 0.25 },
  ship: [
    { from: 660, ms: 70 },
    { from: 880, ms: 70 },
    { from: 1320, ms: 120 }
  ],
  die: { from: 300, to: 60, ms: 450, wave: "noise", volume: 0.4 },
  wave: [
    { from: 440, ms: 90, wave: "triangle" },
    { from: 660, ms: 90, wave: "triangle" },
    { from: 880, ms: 160, wave: "triangle" }
  ],
  over: { from: 440, to: 110, ms: 700, wave: "triangle" }
};
function soundFor(event) {
  return ["hit", "ship", "die", "wave", "over"].includes(event.type) ? event.type : void 0;
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
    tickMs: 50,
    create: createGame,
    render: renderBoard,
    moves: MOVES,
    toggleKey: { mac: "Ctrl+Alt+I", other: "Ctrl+Alt+I" },
    sounds: SOUNDS,
    soundFor
  });
};
export default main_default;
