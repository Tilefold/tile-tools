/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Girder Jump (example tile)
 *
 * A climb-and-dodge platformer in the corner of your pane: climb the
 * girders to the beacon while a robot rolls crates down at you, and jump
 * them for points. Tilefold draws the board and its buttons as an overlay
 * (permission window.overlay), so the game can never take your typing or
 * see your terminal. Play with Ctrl+Alt+Shift shortcuts (⌃⌥⇧ on macOS) or
 * the buttons under the board; click the board to start or pause.
 *
 * The game itself (engine/) and its drawing (render/) know nothing about
 * Tilefold. The arcade kit in tile/ connects them to it, and is the same
 * in every arcade example, so this folder works on its own.
 *
 * Build:  npx @tilefold/tile-tools build
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/engine/field.js
var W = 240;
var H = 256;

// src/engine/level.js
var GROUND_Y = H - 12;
var FLOOR_GAP = 34;
var FLOORS = [
  { y: GROUND_Y, x0: 4, x1: 236 },
  { y: GROUND_Y - FLOOR_GAP, x0: 4, x1: 214 },
  { y: GROUND_Y - FLOOR_GAP * 2, x0: 26, x1: 236 },
  { y: GROUND_Y - FLOOR_GAP * 3, x0: 4, x1: 214 },
  { y: GROUND_Y - FLOOR_GAP * 4, x0: 26, x1: 236 },
  { y: GROUND_Y - FLOOR_GAP * 5, x0: 4, x1: 214 },
  { y: GROUND_Y - FLOOR_GAP * 6, x0: 96, x1: 150 }
];
var TOP_FLOOR = 5;
var LEDGE = 6;
var LADDERS = [
  { floor: 0, x: 196 },
  { floor: 1, x: 56 },
  { floor: 1, x: 150 },
  { floor: 2, x: 190 },
  { floor: 3, x: 44 },
  { floor: 3, x: 120 },
  { floor: 4, x: 178 },
  { floor: 5, x: 120 }
];
var START = { floor: 0, x: 28 };
var ROBOT_X = 22;
var BEACON_X = 136;
function rollDir(floor) {
  return (TOP_FLOOR - floor) % 2 === 0 ? 1 : -1;
}
function ladderUp(floor, x, reach = 7) {
  return LADDERS.find((l) => l.floor === floor && Math.abs(l.x - x) <= reach) ?? null;
}
function ladderDown(floor, x, reach = 7) {
  return LADDERS.find((l) => l.floor === floor - 1 && Math.abs(l.x - x) <= reach) ?? null;
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
var STEP = 6;
var CLIMB_STEP = 0.25;
var JUMP_MS = 760;
var JUMP_H = 16;
var CRATE_R = 5;
var GRAVITY = 420;
var LADDER_SPEED = 55;
var LADDER_CHANCE = 0.3;
var LEAP_POINTS = 100;
var START_BONUS = 3e3;
var FREEZE_MS = 1e3;
function crateSpeed(level) {
  return Math.min(95, 42 + level * 7);
}
function throwMs(level) {
  return Math.max(1100, 3e3 - (level - 1) * 350);
}
function heroFeet(hero2) {
  if (hero2.climb) {
    const l = hero2.climb.ladder;
    const y0 = FLOORS[l.floor].y;
    const y1 = FLOORS[l.floor + 1].y;
    return { x: l.x, y: y0 + (y1 - y0) * hero2.climb.p };
  }
  const lift = hero2.jump ? Math.sin(Math.PI * hero2.jump.ms / JUMP_MS) * JUMP_H : 0;
  return { x: hero2.x, y: FLOORS[hero2.floor].y - lift };
}
function crateMiddle(crate2) {
  const y = crate2.fall ? crate2.fall.y : FLOORS[crate2.floor].y;
  return { x: crate2.x, y: y - CRATE_R };
}
function createGame(seed) {
  const rng = createRng(seed);
  const state = {
    score: 0,
    lives: 3,
    level: 1,
    over: false,
    bonus: START_BONUS,
    hero: null,
    crates: [],
    throwIn: 0,
    throwing: 0,
    freeze: 0,
    bonusClock: 0
  };
  const reset = () => {
    state.hero = { floor: START.floor, x: START.x, climb: null, jump: null, facing: 1 };
    state.crates = [];
    state.throwIn = 1200;
    state.bonus = START_BONUS;
    state.bonusClock = 0;
  };
  reset();
  const act = (action) => {
    const hero2 = state.hero;
    if (state.over || state.freeze > 0) return [];
    if (action === "left" || action === "right") {
      if (hero2.climb) return [];
      const dir = action === "left" ? -1 : 1;
      const f = FLOORS[hero2.floor];
      hero2.x = Math.min(f.x1 - 4, Math.max(f.x0 + 4, hero2.x + dir * STEP));
      hero2.facing = dir;
      return [];
    }
    if (action === "up") {
      if (hero2.climb) {
        hero2.climb.p = Math.min(1, hero2.climb.p + CLIMB_STEP);
        if (hero2.climb.p >= 1) {
          hero2.floor = hero2.climb.ladder.floor + 1;
          hero2.x = hero2.climb.ladder.x;
          hero2.climb = null;
          if (hero2.floor === LEDGE) return clear();
        }
        return [];
      }
      if (hero2.jump) return [];
      const ladder2 = ladderUp(hero2.floor, hero2.x);
      if (ladder2) hero2.climb = { ladder: ladder2, p: CLIMB_STEP };
      return [];
    }
    if (action === "down") {
      if (hero2.climb) {
        hero2.climb.p = Math.max(0, hero2.climb.p - CLIMB_STEP);
        if (hero2.climb.p <= 0) {
          hero2.floor = hero2.climb.ladder.floor;
          hero2.x = hero2.climb.ladder.x;
          hero2.climb = null;
        }
        return [];
      }
      if (hero2.jump) return [];
      const ladder2 = ladderDown(hero2.floor, hero2.x);
      if (ladder2) {
        hero2.floor = ladder2.floor;
        hero2.climb = { ladder: ladder2, p: 1 - CLIMB_STEP };
      }
      return [];
    }
    if (action === "jump" && !hero2.climb && !hero2.jump) {
      hero2.jump = { ms: 0 };
      return [{ type: "jump" }];
    }
    return [];
  };
  function clear() {
    const bonus = state.bonus;
    state.score += bonus;
    state.level += 1;
    reset();
    return [{ type: "clear", level: state.level, bonus }];
  }
  const moveCrate = (c, dt) => {
    if (c.fall) {
      if (c.fall.ladder) c.fall.y += LADDER_SPEED * dt;
      else {
        c.fall.vy += GRAVITY * dt;
        c.fall.y += c.fall.vy * dt;
      }
      const landing = FLOORS[c.fall.to].y;
      if (c.fall.y >= landing) {
        c.floor = c.fall.to;
        c.dir = rollDir(c.floor);
        c.fall = null;
        c.scored = false;
      }
      return true;
    }
    const f = FLOORS[c.floor];
    const before = c.x;
    c.x += c.dir * crateSpeed(state.level) * dt;
    if (c.floor > 0) {
      const ladder2 = ladderDown(c.floor, (before + c.x) / 2, Math.abs(c.x - before) / 2 + 0.5);
      if (ladder2 && c.lastLadder !== ladder2.x) {
        c.lastLadder = ladder2.x;
        if (rng.next() < LADDER_CHANCE) {
          c.x = ladder2.x;
          c.fall = { y: f.y, vy: 0, to: c.floor - 1, ladder: true };
          return true;
        }
      }
    }
    if (c.floor === 0) return c.x > -CRATE_R * 2;
    if (c.dir > 0 && c.x > f.x1 || c.dir < 0 && c.x < f.x0) {
      c.fall = { y: f.y, vy: 0, to: c.floor - 1, ladder: false };
    }
    return true;
  };
  const touches = (c, feet) => {
    const m = crateMiddle(c);
    return Math.abs(m.x - feet.x) < 4 + CRATE_R - 1 && m.y + CRATE_R > feet.y - 12 + 1 && m.y - CRATE_R < feet.y - 1;
  };
  const step = (ms) => {
    const events = [];
    if (state.over) return events;
    const dt = ms / 1e3;
    if (state.freeze > 0) {
      state.freeze = Math.max(0, state.freeze - ms);
      if (state.freeze === 0) reset();
      return events;
    }
    state.bonusClock += ms;
    while (state.bonusClock >= 2e3) {
      state.bonusClock -= 2e3;
      state.bonus = Math.max(0, state.bonus - 100);
    }
    const hero2 = state.hero;
    if (hero2.jump) {
      hero2.jump.ms += ms;
      if (hero2.jump.ms >= JUMP_MS) hero2.jump = null;
    }
    if (state.throwing > 0) state.throwing = Math.max(0, state.throwing - ms);
    state.throwIn -= ms;
    if (state.throwIn <= 0) {
      state.crates.push({ x: ROBOT_X + 14, floor: TOP_FLOOR, dir: 1, fall: null, scored: false });
      state.throwIn = throwMs(state.level) + rng.int(600);
      state.throwing = 300;
      events.push({ type: "throw" });
    }
    state.crates = state.crates.filter((c) => moveCrate(c, dt));
    const feet = heroFeet(hero2);
    for (const c of state.crates) {
      if (touches(c, feet)) {
        state.lives -= 1;
        events.push({ type: "die" });
        if (state.lives <= 0) {
          state.over = true;
          events.push({ type: "over" });
        } else {
          state.freeze = FREEZE_MS;
        }
        return events;
      }
      if (hero2.jump && !c.fall && !c.scored && c.floor === hero2.floor && Math.abs(c.x - hero2.x) < 5) {
        c.scored = true;
        state.score += LEAP_POINTS;
        events.push({ type: "leap", points: LEAP_POINTS });
      }
    }
    return events;
  };
  return { state, act, step };
}

// src/girder.js
var MOVES = [
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+Shift+ArrowLeft", other: "Ctrl+Alt+Shift+ArrowLeft" },
    icon: "left",
    label: "button-left"
  },
  {
    id: "up",
    title: "cmd-up",
    action: "up",
    key: { mac: "Ctrl+Alt+Shift+ArrowUp", other: "Ctrl+Alt+Shift+ArrowUp" },
    icon: "up",
    label: "button-up"
  },
  {
    id: "jump",
    title: "cmd-jump",
    action: "jump",
    key: { mac: "Ctrl+Alt+Shift+Enter", other: "Ctrl+Alt+Shift+Enter" },
    icon: "jump",
    label: "button-jump"
  },
  {
    id: "down",
    title: "cmd-down",
    action: "down",
    key: { mac: "Ctrl+Alt+Shift+ArrowDown", other: "Ctrl+Alt+Shift+ArrowDown" },
    icon: "down",
    label: "button-down"
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+Shift+ArrowRight", other: "Ctrl+Alt+Shift+ArrowRight" },
    icon: "right",
    label: "button-right"
  }
];
var SOUNDS = {
  jump: { from: 330, to: 660, ms: 120, wave: "square", volume: 0.2 },
  leap: [
    { from: 988, ms: 60 },
    { from: 1319, ms: 100 }
  ],
  die: { from: 400, to: 80, ms: 600, wave: "noise", volume: 0.35 },
  clear: [
    { from: 523, ms: 100, wave: "triangle" },
    { from: 659, ms: 100, wave: "triangle" },
    { from: 784, ms: 100, wave: "triangle" },
    { from: 1047, ms: 100, wave: "triangle" },
    { from: 1319, ms: 220, wave: "triangle" }
  ],
  over: { from: 330, to: 82, ms: 900, wave: "triangle" }
};
function soundFor(event) {
  return ["jump", "leap", "die", "clear", "over"].includes(event.type) ? event.type : void 0;
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
function girder({ y, x0, x1 }) {
  let zig = "";
  for (let x = x0; x + 8 <= x1; x += 8)
    zig += `M${x} ${y + 6} L${x + 4} ${y + 1} L${x + 8} ${y + 6} `;
  return `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="7" fill="#c2410c"/><path d="${zig}" stroke="#fdba74" stroke-width="1" fill="none"/><rect x="${x0}" y="${y}" width="${x1 - x0}" height="1.2" fill="#fed7aa"/>`;
}
function ladder({ floor, x }) {
  const top = FLOORS[floor + 1].y;
  const bottom = FLOORS[floor].y;
  let rungs = "";
  for (let y = top + 5; y < bottom; y += 5) rungs += `M${x - 4} ${y} L${x + 4} ${y} `;
  return `<path d="M${x - 4} ${top} L${x - 4} ${bottom} M${x + 4} ${top} L${x + 4} ${bottom} ${rungs}" stroke="#67e8f9" stroke-width="1.2" fill="none"/>`;
}
function robot(throwing) {
  const y = FLOORS[5].y;
  const x = ROBOT_X;
  const arm = throwing ? `M${x + 9} ${y - 13} L${x + 14} ${y - 20}` : `M${x + 9} ${y - 10} L${x + 14} ${y - 7}`;
  return `<g><rect x="${x - 8}" y="${y - 16}" width="16" height="14" rx="2" fill="#94a3b8"/><rect x="${x - 6}" y="${y - 22}" width="12" height="7" rx="1.5" fill="#cbd5e1"/><rect x="${x - 4}" y="${y - 20}" width="2.5" height="2.5" fill="#ef4444"/><rect x="${x + 1.5}" y="${y - 20}" width="2.5" height="2.5" fill="#ef4444"/><path d="M${x} ${y - 22} L${x} ${y - 26}" stroke="#cbd5e1"/><circle cx="${x}" cy="${y - 27}" r="1.5" fill="#facc15"/><path d="${arm} M${x - 9} ${y - 10} L${x - 14} ${y - 7}" stroke="#94a3b8" stroke-width="2.5"/><rect x="${x - 6}" y="${y - 2}" width="4" height="2" fill="#475569"/><rect x="${x + 2}" y="${y - 2}" width="4" height="2" fill="#475569"/></g>`;
}
function beacon() {
  const y = FLOORS[LEDGE].y;
  const x = BEACON_X;
  return `<g><circle cx="${x}" cy="${y - 14}" r="7" fill="#facc15" fill-opacity="0.25"/><rect x="${x - 1}" y="${y - 10}" width="2" height="10" fill="#e5e7eb"/><circle cx="${x}" cy="${y - 14}" r="3.5" fill="#facc15"/></g>`;
}
function crate(c) {
  const m = crateMiddle(c);
  const turn = Math.round(c.x * 9 % 360);
  const r = CRATE_R;
  return `<g transform="rotate(${turn} ${m.x.toFixed(1)} ${m.y.toFixed(1)})"><rect x="${(m.x - r).toFixed(1)}" y="${(m.y - r).toFixed(1)}" width="${r * 2}" height="${r * 2}" rx="1" fill="#a16207"/><path d="M${(m.x - r).toFixed(1)} ${(m.y - r).toFixed(1)} L${(m.x + r).toFixed(1)} ${(m.y + r).toFixed(1)} M${(m.x + r).toFixed(1)} ${(m.y - r).toFixed(1)} L${(m.x - r).toFixed(1)} ${(m.y + r).toFixed(1)}" stroke="#fde68a" stroke-width="1"/></g>`;
}
function hero(h) {
  const { x, y } = heroFeet(h);
  const f = h.facing ?? 1;
  const arms = h.climb ? `M${x - 4} ${y - 7} L${x - 5} ${y - 12} M${x + 4} ${y - 7} L${x + 5} ${y - 12}` : `M${x - 3} ${y - 7} L${x - 3 - f * 2} ${y - 4} M${x + 3} ${y - 7} L${x + 3 + f * 2} ${y - 4}`;
  return `<g><path d="${arms}" stroke="#fcd34d" stroke-width="1.6"/><rect x="${x - 3.5}" y="${y - 8}" width="7" height="5" fill="#2563eb"/><rect x="${x - 3.5}" y="${y - 3}" width="2.5" height="3" fill="#1e3a8a"/><rect x="${x + 1}" y="${y - 3}" width="2.5" height="3" fill="#1e3a8a"/><circle cx="${x}" cy="${y - 10.5}" r="2.6" fill="#fcd34d"/><path d="M${x - 3.5} ${y - 11.5} Q${x} ${y - 16} ${x + 3.5} ${y - 11.5} Z" fill="#facc15"/><rect x="${x + f * 2 - 0.5}" y="${y - 11.5}" width="1" height="1" fill="#0b0d17"/></g>`;
}
function statusBanner(status, state, t, format) {
  if (status === "none") return banner(W, H, "GIRDER JUMP", t("banner-start"));
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
    lifeColor: "#facc15"
  });
  body += text(W - 6, 30, `${t("hud-bonus")} ${format(state ? state.bonus : 3e3)}`, {
    size: 8,
    anchor: "end",
    fill: THEME.warn,
    fit: 90
  });
  for (const l of LADDERS) body += ladder(l);
  for (const f of FLOORS) body += girder(f);
  body += beacon();
  body += robot(state ? state.throwing > 0 : false);
  if (state) {
    for (const c of state.crates) body += crate(c);
    if (state.freeze === 0 || Math.floor(state.freeze / 120) % 2 === 0) body += hero(state.hero);
  } else {
    body += hero({ floor: 0, x: 28, climb: null, jump: null, facing: 1 });
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
    tickMs: 50,
    create: createGame,
    render: renderBoard,
    moves: MOVES,
    toggleKey: { mac: "Ctrl+Alt+J", other: "Ctrl+Alt+J" },
    sounds: SOUNDS,
    soundFor
  });
};
export default main_default;
