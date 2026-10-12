/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefall — a falling-blocks game as a Tilefold tile
 *
 * Play a falling-blocks game in the corner of your pane while you wait on
 * a build. Tilefold draws the board, the score panel and the on-screen
 * buttons as an overlay (permission window.overlay), so the game can never
 * take your typing or see your terminal. Play with the commands and their
 * Ctrl+Alt shortcuts (⌃⌥ on macOS), or click the buttons; click the board
 * to pause.
 *
 * This entry registers the settings, then hands over to the tile code with
 * the engine plugged in. Built into main.js with
 * `npx @tilefold/tile-tools build`.
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/engine/board.js
var WIDTH = 10;
var HEIGHT = 20;
function createBoard() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
}
function collides(board, cells) {
  return cells.some(
    ([x, y]) => x < 0 || x >= WIDTH || y >= HEIGHT || y >= 0 && board[y][x] !== 0
  );
}
function mergePiece(board, cells, code) {
  for (const [x, y] of cells) {
    if (y >= 0 && y < HEIGHT) board[y][x] = code;
  }
}
function clearLines(board) {
  let removed = 0;
  for (let y = HEIGHT - 1; y >= 0; y -= 1) {
    if (board[y].every((code) => code !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(WIDTH).fill(0));
      removed += 1;
      y += 1;
    }
  }
  return removed;
}

// src/engine/pieces.js
var KINDS = Object.freeze(["I", "O", "T", "S", "Z", "J", "L"]);
var SPAWN = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1]
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1]
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1]
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1]
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ]
};
function rotated(cells, size) {
  return cells.map(([x, y]) => [size - 1 - y, x]);
}
var PIECES = Object.freeze(
  Object.fromEntries(
    KINDS.map((kind) => {
      const states = [SPAWN[kind]];
      for (let turn = 1; turn < 4; turn += 1) {
        states.push(kind === "O" ? SPAWN.O : rotated(states[turn - 1], kind === "I" ? 4 : 3));
      }
      return [kind, states.map((cells) => cells.map(([x, y]) => Object.freeze([x, y])))];
    })
  )
);
var JLSTZ_KICKS = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2]
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2]
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2]
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2]
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2]
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2]
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2]
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2]
  ]
};
var I_KICKS = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2]
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2]
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1]
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1]
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2]
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2]
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1]
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1]
  ]
};
function cellsFor(kind, rotation) {
  return PIECES[kind][rotation].map(([x, y]) => [x, y]);
}
function kickTests(kind, from, to) {
  const tests = kind === "O" ? [[0, 0]] : (kind === "I" ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`];
  return tests.map(([x, y]) => [x, y]);
}

// src/engine/rng.js
function seedNumber(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const source = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}
function createRng(seed = Date.now()) {
  let state = seedNumber(seed);
  return {
    next() {
      state = state + 1831565813 >>> 0;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    },
    getState() {
      return state;
    },
    setState(value) {
      state = value >>> 0;
    }
  };
}
function createBag(seed = Date.now(), snapshot) {
  const rng = createRng(seed);
  let remaining = [];
  if (snapshot) {
    rng.setState(snapshot.rng);
    remaining = [...snapshot.remaining];
  }
  return {
    next() {
      if (remaining.length === 0) {
        remaining = [...KINDS];
        for (let i = remaining.length - 1; i > 0; i -= 1) {
          const j = Math.floor(rng.next() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
      }
      return remaining.pop();
    },
    toJSON() {
      return { rng: rng.getState(), remaining: [...remaining] };
    }
  };
}

// src/engine/scoring.js
var CLEAR_POINTS = [0, 100, 300, 500, 800];
function clearScore(lines, level) {
  return CLEAR_POINTS[lines] * level;
}
function dropScore(rows, hard = false) {
  return rows * (hard ? 2 : 1);
}
function levelForLines(lines, startLevel = 1) {
  return startLevel + Math.floor(lines / 10);
}
function gravityMs(level) {
  return Math.max(30, Math.pow(0.8 - (level - 1) * 7e-3, level - 1) * 1e3);
}

// src/engine/game.js
function placedCells(piece) {
  return cellsFor(piece.kind, piece.rotation).map(([x, y]) => [x + piece.x, y + piece.y]);
}
function copyBoard(board) {
  return board.map((row) => [...row]);
}
function createGame({ seed, startLevel = 1, snapshot } = {}) {
  if (!Number.isInteger(startLevel) || startLevel < 1) {
    throw new RangeError("startLevel must be a positive integer");
  }
  let board = snapshot ? copyBoard(snapshot.board) : createBoard();
  let bag = createBag(seed, snapshot?.bag);
  let queue = snapshot ? [...snapshot.queue] : [];
  let active = snapshot?.active ? { ...snapshot.active } : null;
  let held = snapshot?.hold ?? null;
  let canHold = snapshot?.canHold ?? true;
  let score = snapshot?.score ?? 0;
  let lines = snapshot?.lines ?? 0;
  let levelStart = snapshot?.startLevel ?? startLevel;
  let level = snapshot?.level ?? levelStart;
  let over = snapshot?.over ?? false;
  let clears = snapshot?.clears ?? 0;
  let lastClear = snapshot?.lastClear ? { ...snapshot.lastClear } : null;
  let lockResets = snapshot?.lockResets ?? 0;
  let grace = snapshot?.grace ?? 0;
  function fillQueue() {
    while (queue.length < 3) queue.push(bag.next());
  }
  function spawn(kind) {
    active = { kind, rotation: 0, x: 3, y: 0 };
    lockResets = 0;
    grace = 0;
    if (collides(board, placedCells(active))) {
      active = null;
      over = true;
    }
  }
  function spawnNext() {
    const kind = queue.shift();
    fillQueue();
    spawn(kind);
  }
  if (!snapshot) {
    fillQueue();
    spawnNext();
  }
  function grounded() {
    return collides(board, placedCells({ ...active, y: active.y + 1 }));
  }
  function resetLockIfGrounded(wasGrounded) {
    if (wasGrounded && lockResets < 15) {
      lockResets += 1;
      grace = 1;
    }
  }
  function translate(dx) {
    if (over || !active) return false;
    const wasGrounded = grounded();
    const candidate = { ...active, x: active.x + dx };
    if (collides(board, placedCells(candidate))) return false;
    active = candidate;
    resetLockIfGrounded(wasGrounded);
    return true;
  }
  function rotate(direction) {
    if (over || !active) return false;
    const wasGrounded = grounded();
    const nextRotation = (active.rotation + direction + 4) % 4;
    for (const [dx, dy] of kickTests(active.kind, active.rotation, nextRotation)) {
      const candidate = {
        ...active,
        rotation: nextRotation,
        x: active.x + dx,
        y: active.y + dy
      };
      if (!collides(board, placedCells(candidate))) {
        active = candidate;
        resetLockIfGrounded(wasGrounded);
        return true;
      }
    }
    return false;
  }
  function lock() {
    const cells = placedCells(active);
    mergePiece(board, cells, KINDS.indexOf(active.kind) + 1);
    const removed = clearLines(board);
    score += clearScore(removed, level);
    lines += removed;
    level = levelForLines(lines, levelStart);
    if (removed > 0) clears += 1;
    lastClear = removed ? { lines: removed } : null;
    canHold = true;
    if (cells.some(([, y]) => y < 0)) {
      active = null;
      over = true;
    } else {
      spawnNext();
    }
  }
  function getState() {
    let ghost = [];
    if (active) {
      const projection = { ...active };
      while (!collides(board, placedCells({ ...projection, y: projection.y + 1 }))) {
        projection.y += 1;
      }
      ghost = placedCells(projection);
    }
    return {
      board: copyBoard(board),
      active: active ? { kind: active.kind, cells: placedCells(active) } : null,
      ghost,
      next: [...queue],
      hold: held,
      canHold,
      score,
      lines,
      level,
      over,
      clears,
      lastClear: lastClear ? { ...lastClear } : null
    };
  }
  function toJSON() {
    return {
      version: 1,
      board: copyBoard(board),
      bag: bag.toJSON(),
      queue: [...queue],
      active: active ? { ...active } : null,
      hold: held,
      canHold,
      score,
      lines,
      startLevel: levelStart,
      level,
      over,
      clears,
      lastClear: lastClear ? { ...lastClear } : null,
      lockResets,
      grace
    };
  }
  return {
    moveLeft: () => translate(-1),
    moveRight: () => translate(1),
    rotateCW: () => rotate(1),
    rotateCCW: () => rotate(-1),
    softDrop() {
      if (over || !active || grounded()) return false;
      active.y += 1;
      score += dropScore(1);
      grace = 0;
      return true;
    },
    hardDrop() {
      if (over || !active) return false;
      let rows = 0;
      while (!grounded()) {
        active.y += 1;
        rows += 1;
      }
      score += dropScore(rows, true);
      lock();
      return true;
    },
    hold() {
      if (over || !active || !canHold) return false;
      const outgoing = active.kind;
      if (held === null) {
        held = outgoing;
        spawnNext();
      } else {
        const incoming = held;
        held = outgoing;
        spawn(incoming);
      }
      canHold = false;
      return true;
    },
    tick() {
      if (over || !active) return false;
      if (!grounded()) {
        active.y += 1;
        grace = 0;
      } else if (grace > 0) {
        grace -= 1;
      } else {
        lock();
      }
      return true;
    },
    getState,
    toJSON
  };
}

// src/render/svg.js
var MAX_SIDE = 256;
var PIECE_COLORS = [
  "transparent",
  "#22d3ee",
  // I — cyan
  "#facc15",
  // O — yellow
  "#a855f7",
  // T — purple
  "#22c55e",
  // S — green
  "#ef4444",
  // Z — red
  "#3b82f6",
  // J — blue
  "#f97316"
  // L — orange
];
var KIND_ORDER = ["I", "O", "T", "S", "Z", "J", "L"];
var THEME = {
  panel: "#0f111a",
  panelOpacity: 0.92,
  border: "#2a2f45",
  grid: "#1c2030",
  text: "#e5e7eb",
  muted: "#9ca3af",
  accent: "#22d3ee",
  shade: "#000000"
};
function codeOf(kind) {
  return KIND_ORDER.indexOf(kind) + 1;
}
function colorOf(codeOrKind) {
  const code = typeof codeOrKind === "string" ? codeOf(codeOrKind) : codeOrKind;
  return PIECE_COLORS[code] && code > 0 ? PIECE_COLORS[code] : "#6b7280";
}
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
function textWidth(text, size) {
  let em = 0;
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide = cp >= 4352 && cp <= 4607 || cp >= 11904 && cp <= 42191 || cp >= 44032 && cp <= 55203 || cp >= 63744 && cp <= 64255 || cp >= 65280 && cp <= 65376;
    em += wide ? 1 : 0.6;
  }
  return em * size;
}
function textEl(o) {
  const text = String(o.text);
  const anchor = o.anchor ?? "start";
  const fill = o.fill ?? THEME.text;
  const weight = o.weight ?? 400;
  let fit = "";
  if (o.maxWidth && textWidth(text, o.size) > o.maxWidth) {
    fit = ` textLength="${round2(o.maxWidth)}" lengthAdjust="spacingAndGlyphs"`;
  }
  const opacity = o.opacity === void 0 ? "" : ` opacity="${o.opacity}"`;
  return `<text x="${round2(o.x)}" y="${round2(o.y)}" font-size="${o.size}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${opacity}${fit}>${escapeXml(text)}</text>`;
}
function blockEl(x, y, size, color, opacity = 1) {
  const s = round2(size);
  const e = round2(Math.max(1, size * 0.14));
  const op = opacity === 1 ? "" : ` opacity="${opacity}"`;
  return `<g${op}><rect x="${round2(x)}" y="${round2(y)}" width="${s}" height="${s}" rx="1.5" fill="${color}"/><rect x="${round2(x)}" y="${round2(y)}" width="${s}" height="${e}" fill="#fff" opacity="0.28"/><rect x="${round2(x)}" y="${round2(y + s - e)}" width="${s}" height="${e}" fill="#000" opacity="0.25"/></g>`;
}

// src/render/board.js
var COLS = 10;
var ROWS = 20;
var CELL = 12;
var PAD = 4;
var BOARD_W = COLS * CELL + PAD * 2;
var BOARD_H = ROWS * CELL + PAD * 2;
function gridEl() {
  let d = "";
  for (let c = 1; c < COLS; c++) d += `M${PAD + c * CELL} ${PAD}v${ROWS * CELL}`;
  for (let r = 1; r < ROWS; r++) d += `M${PAD} ${PAD + r * CELL}h${COLS * CELL}`;
  return `<path d="${d}" stroke="${THEME.grid}" stroke-width="0.5" fill="none"/>`;
}
var GRID = gridEl();
function inside(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < COLS && y >= 0 && y < ROWS;
}
function bannerEl(title, hint, extra) {
  const lines = [title, extra, hint].filter(Boolean).length;
  const h = 18 + lines * 16;
  const y = (BOARD_H - h) / 2;
  let out = `<rect x="0" y="0" width="${BOARD_W}" height="${BOARD_H}" rx="6" fill="${THEME.shade}" opacity="0.45"/><rect x="${PAD + 2}" y="${y}" width="${BOARD_W - PAD * 2 - 4}" height="${h}" rx="5" fill="${THEME.panel}" stroke="${THEME.accent}" stroke-width="1"/>`;
  let ty = y + 22;
  const max = BOARD_W - PAD * 2 - 12;
  out += textEl({
    x: BOARD_W / 2,
    y: ty,
    text: title,
    size: 14,
    weight: 700,
    anchor: "middle",
    maxWidth: max
  });
  if (extra) {
    ty += 16;
    out += textEl({
      x: BOARD_W / 2,
      y: ty,
      text: extra,
      size: 10,
      anchor: "middle",
      fill: THEME.accent,
      maxWidth: max
    });
  }
  if (hint) {
    ty += 16;
    out += textEl({
      x: BOARD_W / 2,
      y: ty,
      text: hint,
      size: 9,
      anchor: "middle",
      fill: THEME.muted,
      maxWidth: max
    });
  }
  return out;
}
function renderBoard(state, opts = {}) {
  const showGhost = opts.ghost !== false;
  let body = `<rect x="0.5" y="0.5" width="${BOARD_W - 1}" height="${BOARD_H - 1}" rx="6" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>` + GRID;
  if (state) {
    const board = Array.isArray(state.board) ? state.board : [];
    for (let y = 0; y < Math.min(ROWS, board.length); y++) {
      const row = board[y] || [];
      for (let x = 0; x < Math.min(COLS, row.length); x++) {
        const code = row[x];
        if (code) body += blockEl(PAD + x * CELL, PAD + y * CELL, CELL, colorOf(code));
      }
    }
    const active = state.active;
    const color = active ? colorOf(active.kind) : null;
    if (showGhost && active && Array.isArray(state.ghost) && !state.over) {
      const live = new Set((active.cells || []).map(([x, y]) => `${x},${y}`));
      for (const [x, y] of state.ghost) {
        if (!inside(x, y) || live.has(`${x},${y}`)) continue;
        body += `<rect x="${PAD + x * CELL + 1}" y="${PAD + y * CELL + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="1.5" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-opacity="0.55" stroke-width="1"/>`;
      }
    }
    if (active && Array.isArray(active.cells)) {
      for (const [x, y] of active.cells) {
        if (inside(x, y)) body += blockEl(PAD + x * CELL, PAD + y * CELL, CELL, color);
      }
    }
  }
  if (opts.banner && opts.banner.title) {
    body += bannerEl(opts.banner.title, opts.banner.hint, opts.banner.extra);
  }
  return svgUrl(BOARD_W, BOARD_H, body, opts.displayW, opts.displayH);
}

// src/render/buttons.js
var BUTTON = 26;
var BUTTON_GAP = 3;
var BUTTONS = [
  { id: "rotate", action: "rotate", label: "button-rotate", col: 0, row: 0 },
  { id: "drop", action: "hardDrop", label: "button-drop", col: 1, row: 0 },
  { id: "pause", action: "pause", label: "button-pause", col: 2, row: 0 },
  { id: "left", action: "left", label: "button-left", col: 0, row: 1 },
  { id: "down", action: "softDrop", label: "button-down", col: 1, row: 1 },
  { id: "right", action: "right", label: "button-right", col: 2, row: 1 }
];
var ICONS = {
  left: `<path d="M16 7 L9 13 L16 19 Z" fill="${THEME.text}"/>`,
  right: `<path d="M10 7 L17 13 L10 19 Z" fill="${THEME.text}"/>`,
  down: `<path d="M7 10 L13 17 L19 10 Z" fill="${THEME.text}"/>`,
  drop: `<path d="M7 7 L13 13 L19 7" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M7 12 L13 18 L19 12" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M7 20.5 H19" stroke="${THEME.text}" stroke-width="2" stroke-linecap="round"/>`,
  rotate: `<path d="M18.5 10.5 A6 6 0 1 0 19 15" stroke="${THEME.text}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19.8 6.5 L19.6 11.6 L14.6 10.6 Z" fill="${THEME.text}"/>`,
  pause: `<rect x="8.5" y="7.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/><rect x="14.3" y="7.5" width="3.2" height="11" rx="1" fill="${THEME.text}"/>`,
  play: `<path d="M10 7 L19 13 L10 19 Z" fill="${THEME.accent}"/>`
};
function renderButton(icon, opts = {}) {
  const art = ICONS[icon] ?? "";
  const body = `<rect x="0.5" y="0.5" width="${BUTTON - 1}" height="${BUTTON - 1}" rx="5" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/><g opacity="${opts.dim ? 0.35 : 1}">${art}</g>`;
  const size = opts.displaySize ?? BUTTON;
  return svgUrl(BUTTON, BUTTON, body, size, size);
}
function iconFor(id, running) {
  if (id === "pause") return running ? "pause" : "play";
  return id;
}

// src/render/panel.js
var PANEL_W = 84;
var PANEL_H = 186;
var PREVIEW_CELLS = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0]
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1]
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1]
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1]
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ]
};
function previewEl(kind, cx, cy, cell, opacity = 1) {
  const cells = kind ? PREVIEW_CELLS[kind] : null;
  if (!cells) return "";
  const maxX = Math.max(...cells.map(([x]) => x));
  const maxY = Math.max(...cells.map(([, y]) => y));
  const left = cx - (maxX + 1) * cell / 2;
  const top = cy - (maxY + 1) * cell / 2;
  return cells.map(([x, y]) => blockEl(left + x * cell, top + y * cell, cell, colorOf(kind), opacity)).join("");
}
function stat(y, label, value) {
  return textEl({
    x: 8,
    y,
    text: label,
    size: 8,
    fill: THEME.muted,
    weight: 600,
    maxWidth: PANEL_W - 16
  }) + textEl({
    x: PANEL_W - 8,
    y: y + 13,
    text: value,
    size: 12,
    weight: 700,
    anchor: "end",
    maxWidth: PANEL_W - 16
  });
}
function renderPanel(view, labels, opts = {}) {
  const next = Array.isArray(view.next) ? view.next : [];
  let body = `<rect x="0.5" y="0.5" width="${PANEL_W - 1}" height="${PANEL_H - 1}" rx="6" fill="${THEME.panel}" fill-opacity="${THEME.panelOpacity}" stroke="${THEME.border}"/>`;
  body += textEl({
    x: 8,
    y: 13,
    text: labels.next,
    size: 8,
    fill: THEME.muted,
    weight: 600,
    maxWidth: PANEL_W - 16
  });
  body += previewEl(next[0], PANEL_W / 2, 28, 7);
  body += previewEl(next[1], PANEL_W / 4 + 2, 48, 4, 0.75);
  body += previewEl(next[2], PANEL_W * 3 / 4 - 2, 48, 4, 0.75);
  body += textEl({
    x: 8,
    y: 68,
    text: labels.hold,
    size: 8,
    fill: THEME.muted,
    weight: 600,
    maxWidth: PANEL_W - 16
  });
  body += previewEl(view.hold, PANEL_W / 2, 82, 6, view.canHold === false ? 0.35 : 1);
  body += stat(104, labels.score, view.score);
  body += stat(130, labels.best, view.best);
  body += stat(156, labels.level, view.level);
  body += textEl({
    x: 8,
    y: 169,
    text: `${labels.lines} ${view.lines}`,
    size: 9,
    fill: THEME.text,
    maxWidth: 46
  });
  return svgUrl(PANEL_W, PANEL_H, body, opts.displayW, opts.displayH);
}
function panelLabel(view, labels) {
  return `${labels.score} ${view.score}, ${labels.level} ${view.level}, ${labels.lines} ${view.lines}`.slice(
    0,
    80
  );
}

// src/tile/scene.js
var SIZES = { small: 0.75, medium: 1 };
var CORNERS = ["bottom-right", "bottom-left", "top-right", "top-left"];
var GAP = 6;
var KEYPAD_GAP = BOARD_H - PANEL_H - (BUTTON * 2 + BUTTON_GAP);
var MARGIN = 12;
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
function groupSize(scale) {
  return { w: Math.round((BOARD_W + GAP + PANEL_W) * scale), h: Math.round(BOARD_H * scale) };
}
function computeLayout(layout, settings = {}) {
  const scale = scaleOf(settings.size);
  const corner = cornerOf(settings.corner);
  const area = areaOf(layout);
  const group = groupSize(scale);
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  let gx = right ? area.x + area.w - group.w - MARGIN : area.x + MARGIN;
  let gy = bottom ? area.y + area.h - group.h - MARGIN : area.y + MARGIN;
  gx = Math.max(0, Math.round(gx));
  gy = Math.max(0, Math.round(gy));
  const boardW = Math.round(BOARD_W * scale);
  const colW = Math.round(PANEL_W * scale);
  const gap = Math.round(GAP * scale);
  const boardX = right ? gx + colW + gap : gx;
  const colX = right ? gx : gx + boardW + gap;
  const rects = {
    board: { x: boardX, y: gy, w: boardW, h: Math.round(BOARD_H * scale) },
    panel: { x: colX, y: gy, w: colW, h: Math.round(PANEL_H * scale) }
  };
  const keypadY = gy + (PANEL_H + KEYPAD_GAP) * scale;
  const btn = Math.round(BUTTON * scale);
  for (const b of BUTTONS) {
    rects[`btn-${b.id}`] = {
      x: Math.round(colX + b.col * (BUTTON + BUTTON_GAP) * scale),
      y: Math.round(keypadY + b.row * (BUTTON + BUTTON_GAP) * scale),
      w: btn,
      h: btn
    };
  }
  return rects;
}

// src/tile/settings.js
var MIN_START_LEVEL = 1;
var MAX_START_LEVEL = 15;
var CORNER_LABELS = {
  "bottom-right": "setting-corner-bottom-right",
  "bottom-left": "setting-corner-bottom-left",
  "top-right": "setting-corner-top-right",
  "top-left": "setting-corner-top-left"
};
var SETTINGS = [
  { key: "startLevel", default: 1, label: "setting-start-level" },
  { key: "ghost", default: true, label: "setting-ghost" },
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
    const options = s.choices ? { choices: s.choices.map((c) => ({ value: c.value, label: tf.t(c.label) })) } : void 0;
    if (options) tf.setting(s.key, s.default, tf.t(s.label), options);
    else tf.setting(s.key, s.default, tf.t(s.label));
  }
}
function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function readSettings(settings) {
  const get = (key) => {
    try {
      return settings.get(key);
    } catch {
      return void 0;
    }
  };
  const size = get("size");
  const corner = get("corner");
  return {
    startLevel: clampInt(get("startLevel"), MIN_START_LEVEL, MAX_START_LEVEL, 1),
    ghost: get("ghost") !== false,
    sounds: get("sounds") !== false,
    size: size === "small" ? "small" : "medium",
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

// src/tile/commands.js
var COMMANDS = [
  {
    id: "new-game",
    title: "cmd-new-game",
    action: "newGame",
    key: { mac: "Ctrl+Alt+N", other: "Ctrl+Alt+N" }
  },
  {
    id: "pause",
    title: "cmd-pause",
    action: "pause",
    key: { mac: "Ctrl+Alt+P", other: "Ctrl+Alt+P" }
  },
  {
    id: "toggle",
    title: "cmd-toggle",
    action: "toggle",
    key: { mac: "Ctrl+Alt+G", other: "Ctrl+Alt+G" }
  },
  {
    id: "left",
    title: "cmd-left",
    action: "left",
    key: { mac: "Ctrl+Alt+ArrowLeft", other: "Ctrl+Alt+ArrowLeft" }
  },
  {
    id: "right",
    title: "cmd-right",
    action: "right",
    key: { mac: "Ctrl+Alt+ArrowRight", other: "Ctrl+Alt+ArrowRight" }
  },
  {
    id: "rotate",
    title: "cmd-rotate",
    action: "rotate",
    key: { mac: "Ctrl+Alt+ArrowUp", other: "Ctrl+Alt+ArrowUp" }
  },
  {
    id: "rotate-back",
    title: "cmd-rotate-back",
    action: "rotateBack",
    key: { mac: "Ctrl+Alt+Z", other: "Ctrl+Alt+Z" }
  },
  {
    id: "soft-drop",
    title: "cmd-soft-drop",
    action: "softDrop",
    key: { mac: "Ctrl+Alt+ArrowDown", other: "Ctrl+Alt+ArrowDown" }
  },
  {
    id: "hard-drop",
    title: "cmd-hard-drop",
    action: "hardDrop",
    key: { mac: "Ctrl+Alt+Enter", other: "Ctrl+Alt+Enter" }
  },
  {
    id: "hold",
    title: "cmd-hold",
    action: "hold",
    key: { mac: "Ctrl+Alt+C", other: "Ctrl+Alt+C" }
  }
];
function registerCommands(tf, run) {
  for (const c of COMMANDS) {
    tf.command(tf.t(c.title), () => run(c.action), { id: c.id, key: c.key });
  }
}

// src/tile/audit.js
var ACTIONS = Object.freeze([
  "game.start",
  "game.pause",
  "game.resume",
  "game.over",
  "game.restore",
  "view.show",
  "view.hide",
  "best.new"
]);
var PAUSE_REASONS = Object.freeze(["user", "blur", "hidden", "idle", "toggle", "restore"]);
function cleanDetails(details) {
  const out = {};
  for (const [k, v] of Object.entries(details || {})) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 40);
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
      quiet(() => tf.log.error(String(err && /** @type {any} */
      err.message || err)));
    }
  };
}

// src/tile/loop.js
var MIN_STEP_MS = 30;
function createLoop(o) {
  const setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((h) => clearTimeout(h));
  let handle = null;
  let running = false;
  const wait = () => {
    const ms = Number(o.delay());
    return Number.isFinite(ms) ? Math.max(MIN_STEP_MS, ms) : 1e3;
  };
  const schedule = () => {
    handle = setTimer(() => {
      handle = null;
      if (!running) return;
      try {
        o.step();
      } catch (err) {
        if (o.onError) o.onError(err);
      }
      if (running) schedule();
    }, wait());
  };
  return {
    start() {
      if (running) return;
      running = true;
      schedule();
    },
    stop() {
      running = false;
      if (handle !== null) clearTimer(handle);
      handle = null;
    },
    /** Starts the wait again from now (after a piece locks, for example). */
    restart() {
      if (!running) return;
      if (handle !== null) clearTimer(handle);
      schedule();
    },
    get running() {
      return running;
    }
  };
}

// src/tile/session.js
var MOVES = {
  left: "moveLeft",
  right: "moveRight",
  rotate: "rotateCW",
  rotateBack: "rotateCCW",
  softDrop: "softDrop",
  hardDrop: "hardDrop",
  hold: "hold"
};
function createSession(o) {
  const onChange = o.onChange ?? (() => {
  });
  const onEvent = o.onEvent ?? (() => {
  });
  const now = o.now ?? (() => Date.now());
  let status = "none";
  let game = null;
  let bankedMs = 0;
  let since = 0;
  let seen = { clears: 0, level: 1, over: false };
  const loop = createLoop({
    step: () => {
      if (status !== "playing" || !game) return;
      if (game.tick()) settle();
    },
    delay: () => game ? o.engine.gravityMs(game.getState().level) : 1e3,
    onError: o.onError,
    ...o.timers ?? {}
  });
  const remember = () => {
    const s = game.getState();
    seen = { clears: s.clears, level: s.level, over: s.over };
    return s;
  };
  const bank = () => {
    if (status === "playing") bankedMs += Math.max(0, now() - since);
  };
  const settle = () => {
    const s = game.getState();
    if (s.clears !== seen.clears) {
      onEvent({ type: "clear", lines: s.lastClear && s.lastClear.lines || 1 });
    }
    if (s.level > seen.level) onEvent({ type: "level", level: s.level });
    seen = { clears: s.clears, level: s.level, over: s.over };
    if (s.over && status === "playing") {
      bank();
      status = "over";
      loop.stop();
      onEvent({ type: "over", score: s.score, lines: s.lines, level: s.level, seconds: seconds() });
    }
    onChange();
  };
  const seconds = () => Math.floor((bankedMs + (status === "playing" ? Math.max(0, now() - since) : 0)) / 1e3);
  return {
    /** "none", "playing", "paused" or "over". */
    get status() {
      return status;
    },
    /** The engine's state, or null before the first game. */
    state() {
      return game ? game.getState() : null;
    },
    /** Seconds of play so far in this game. */
    seconds,
    /**
     * Starts a fresh game.
     *
     * @param {{ startLevel?: number, seed?: number }} [opts]
     */
    newGame(opts = {}) {
      loop.stop();
      game = o.engine.createGame({ startLevel: opts.startLevel ?? 1, seed: opts.seed });
      remember();
      bankedMs = 0;
      since = now();
      status = "playing";
      onEvent({ type: "start", level: game.getState().level });
      loop.start();
      onChange();
    },
    /**
     * Brings back a saved game, paused. False (and nothing changes) when
     * the snapshot cannot be restored.
     *
     * @param {{ game: object, seconds?: number }} snap
     * @returns {boolean}
     */
    restore(snap) {
      if (!snap || !snap.game || typeof snap.game !== "object") return false;
      try {
        const restored = o.engine.createGame({ snapshot: snap.game });
        if (!restored || restored.getState().over) return false;
        loop.stop();
        game = restored;
        remember();
        bankedMs = Math.max(0, Number(snap.seconds) || 0) * 1e3;
        status = "paused";
        onChange();
        return true;
      } catch {
        return false;
      }
    },
    /**
     * Runs a player action while playing.
     *
     * @param {string} action A key of {@link MOVES}.
     * @returns {boolean} Whether the game changed.
     */
    act(action) {
      const method = MOVES[action];
      if (!method || status !== "playing" || !game) return false;
      const changed = Boolean(game[method]());
      if (!changed) return false;
      if (action === "hardDrop") loop.restart();
      settle();
      return true;
    },
    /**
     * Pauses a running game.
     *
     * @returns {boolean} Whether it was running.
     */
    pause() {
      if (status !== "playing") return false;
      bank();
      status = "paused";
      loop.stop();
      onChange();
      return true;
    },
    /**
     * Resumes a paused game.
     *
     * @returns {boolean} Whether it was paused.
     */
    resume() {
      if (status !== "paused") return false;
      since = now();
      status = "playing";
      loop.start();
      onChange();
      return true;
    },
    /** Stops the clock and the loop for good (the tile is going away). */
    stop() {
      if (status === "playing") {
        bank();
        status = "paused";
      }
      loop.stop();
    },
    /** The game to save, or null when there is nothing worth resuming. */
    snapshot() {
      if (!game || status === "over" || status === "none") return null;
      if (typeof game.toJSON !== "function") return null;
      return { game: game.toJSON(), seconds: seconds() };
    }
  };
}

// src/tile/sound.js
var RATE = 22050;
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
  return "data:audio/wav;base64," + btoa(bin);
}
function sweep(from, to, ms) {
  const n = Math.max(1, Math.round(RATE * ms / 1e3));
  const out = new Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = from + (to - from) * t;
    phase += 2 * Math.PI * f / RATE;
    const env = Math.min(1, i / (RATE * 4e-3)) * (1 - t) ** 1.5;
    out[i] = 0.35 * env * (Math.sin(phase) + 0.25 * Math.sin(2 * phase));
  }
  return out;
}
function samplesFor(name) {
  switch (name) {
    case "clear1":
      return sweep(520, 780, 110);
    case "clear2":
      return sweep(620, 930, 130);
    case "clear3":
      return sweep(740, 1110, 150);
    case "clear4":
      return [523, 659, 784, 1047].flatMap((f) => sweep(f, f * 1.01, 70));
    case "over":
      return [...sweep(440, 330, 160), ...sweep(330, 196, 320)];
    default:
      return [];
  }
}
function clearSound(lines) {
  const n = Math.min(4, Math.max(1, Math.round(Number(lines)) || 1));
  return (
    /** @type {"clear1"|"clear2"|"clear3"|"clear4"} */
    `clear${n}`
  );
}
function createSounds(tf, enabled) {
  const clips = /* @__PURE__ */ new Map();
  return {
    play(name) {
      if (!enabled()) return;
      if (!clips.has(name)) clips.set(name, wavUrl(samplesFor(
        /** @type {any} */
        name
      )));
      const src = clips.get(name);
      try {
        void Promise.resolve(tf.sound.play({ src, volume: 0.4 })).catch(() => {
        });
      } catch {
      }
    }
  };
}

// src/tile/store.js
var KEYS = { best: "best", stats: "stats", snapshot: "snapshot", visible: "visible" };
var SNAPSHOT_VERSION = 1;
var EMPTY_STATS = Object.freeze({ games: 0, lines: 0, seconds: 0 });
function count(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function createStore(tf) {
  const read = async (key) => {
    try {
      return await tf.store.get(key);
    } catch (err) {
      void tf.log.warn(`store read ${key} failed: ${String(err && err.message || err)}`).catch(() => {
      });
      return null;
    }
  };
  const write = async (key, value) => {
    try {
      await tf.store.set(key, value);
      return true;
    } catch (err) {
      void tf.log.warn(`store write ${key} failed: ${String(err && err.message || err)}`).catch(() => {
      });
      return false;
    }
  };
  return {
    /** The best score so far. */
    async best() {
      return count(await read(KEYS.best));
    },
    /** Records `score` as the best if it beats it; true when it did. */
    async offerBest(score) {
      const best = count(await read(KEYS.best));
      if (count(score) <= best) return false;
      await write(KEYS.best, count(score));
      return true;
    },
    /** Lifetime totals. */
    async stats() {
      const s = await read(KEYS.stats);
      if (!s || typeof s !== "object") return { ...EMPTY_STATS };
      return { games: count(s.games), lines: count(s.lines), seconds: count(s.seconds) };
    },
    /** Adds one finished game to the totals. */
    async addGame(lines, seconds) {
      const s = await this.stats();
      const next = {
        games: s.games + 1,
        lines: s.lines + count(lines),
        seconds: s.seconds + count(seconds)
      };
      await write(KEYS.stats, next);
      return next;
    },
    /** The saved game in progress, or null. */
    async snapshot() {
      const s = await read(KEYS.snapshot);
      if (!s || typeof s !== "object" || s.v !== SNAPSHOT_VERSION || !s.game || typeof s.game !== "object") {
        return null;
      }
      return { v: SNAPSHOT_VERSION, game: s.game, seconds: count(s.seconds) };
    },
    /** Saves the game in progress (`game` is the engine's toJSON()). */
    async saveSnapshot(game, seconds) {
      return write(KEYS.snapshot, { v: SNAPSHOT_VERSION, game, seconds: count(seconds) });
    },
    /** Forgets the game in progress (overwritten with null; the store keeps the key). */
    async clearSnapshot() {
      return write(KEYS.snapshot, null);
    },
    /** Whether the game was last left on screen (default: hidden). */
    async visible() {
      return await read(KEYS.visible) === true;
    },
    /** Remembers whether the game is on screen. */
    async setVisible(on) {
      return write(KEYS.visible, Boolean(on));
    }
  };
}

// src/tile/view.js
var BOARD_ID = "board";
var PANEL_ID = "panel";
var BOARD_LABELS = {
  none: "board-label-none",
  playing: "board-label-playing",
  paused: "board-label-paused",
  over: "board-label-over"
};
var buttonId = (id) => `btn-${id}`;
var FIELDS = ["image", "x", "y", "w", "h", "label", "hit", "cursor", "opacity"];
function bannerFor(status, t, score) {
  if (status === "none") return { title: t("tile-name"), hint: t("banner-start-hint") };
  if (status === "paused") return { title: t("banner-paused"), hint: t("banner-paused-hint") };
  if (status === "over") {
    return {
      title: t("banner-over"),
      extra: t("banner-over-score", { score }),
      hint: t("banner-over-hint")
    };
  }
  return null;
}
function sceneItems(input) {
  const { status, state, settings, t } = input;
  const format = input.format ?? ((n) => String(n));
  const rects = computeLayout(input.layout, settings);
  const running = status === "playing";
  const score = state ? Number(state.score) || 0 : 0;
  const view = {
    next: state && Array.isArray(state.next) ? state.next : [],
    hold: state ? state.hold : null,
    canHold: state ? state.canHold !== false : true,
    score: format(score),
    best: format(Math.max(input.best || 0, score)),
    level: format(state ? Number(state.level) || 1 : 1),
    lines: format(state ? Number(state.lines) || 0 : 0)
  };
  const labels = {
    next: t("panel-next"),
    hold: t("panel-hold"),
    score: t("panel-score"),
    best: t("panel-best"),
    level: t("panel-level"),
    lines: t("panel-lines")
  };
  const board = rects.board;
  const panel = rects.panel;
  const items = [
    {
      id: BOARD_ID,
      image: renderBoard(state, {
        ghost: settings.ghost,
        banner: bannerFor(status, t, view.score),
        displayW: board.w,
        displayH: board.h
      }),
      ...board,
      hit: true,
      cursor: "pointer",
      label: t(BOARD_LABELS[status] ?? BOARD_LABELS.none).slice(0, 80)
    },
    {
      id: PANEL_ID,
      image: renderPanel(view, labels, { displayW: panel.w, displayH: panel.h }),
      ...panel,
      hit: true,
      cursor: "pointer",
      label: panelLabel(view, labels)
    }
  ];
  for (const b of BUTTONS) {
    const r = rects[buttonId(b.id)];
    const dim = b.id !== "pause" && !running;
    const label = b.id === "pause" && !running ? t("button-play") : t(b.label);
    items.push({
      id: buttonId(b.id),
      image: renderButton(iconFor(b.id, running), { displaySize: r.w, dim }),
      ...r,
      hit: true,
      cursor: "pointer",
      label: label.slice(0, 80)
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
function actionForClick(itemId, status) {
  if (itemId === BOARD_ID) return status === "none" || status === "over" ? "newGame" : "pause";
  if (itemId === PANEL_ID) return "hold";
  const b = BUTTONS.find((x) => buttonId(x.id) === itemId);
  return b ? b.action : null;
}

// src/tile/run.js
function runTilefall(tf, engine) {
  const trail = createTrail(tf);
  const store = createStore(tf);
  const settings = () => readSettings(tf.settings);
  const sounds = createSounds(tf, () => settings().sounds);
  const numberFormat = (() => {
    try {
      const nf = new Intl.NumberFormat();
      return (n) => nf.format(n);
    } catch {
      return (n) => String(n);
    }
  })();
  let visible = false;
  let layout = null;
  let shown = null;
  let best = 0;
  let drawing = null;
  let dirty = false;
  const paint = async () => {
    if (!visible) return;
    const items = sceneItems({
      status: session.status,
      state: session.state(),
      best,
      settings: settings(),
      layout,
      t: (key, args) => tf.t(key, args),
      format: numberFormat
    });
    if (!shown) {
      const ok = await tf.overlay.show({ items });
      if (ok === false) {
        shown = null;
        pause("hidden");
        return;
      }
      shown = items;
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
    engine,
    onChange: () => void draw(),
    onEvent: (e) => void onGameEvent(e).catch((err) => trail.error(err)),
    onError: (err) => trail.error(err)
  });
  const figures = () => {
    const s = session.state();
    return s ? { score: s.score, lines: s.lines, level: s.level } : {};
  };
  const save = async () => {
    const snap = session.snapshot();
    if (snap) await store.saveSnapshot(snap.game, snap.seconds);
  };
  const onGameEvent = async (e) => {
    if (e.type === "start") {
      trail.record("game.start", { level: Number(e.level) || 1 });
    } else if (e.type === "clear") {
      sounds.play(clearSound(e.lines));
      await save();
    } else if (e.type === "level") {
      trail.info(`level ${e.level}`);
    } else if (e.type === "over") {
      sounds.play("over");
      const isBest = await store.offerBest(e.score);
      if (isBest) {
        best = Math.max(best, Number(e.score) || 0);
        trail.record("best.new", { score: Number(e.score) || 0 });
      }
      await store.addGame(e.lines, e.seconds);
      await store.clearSnapshot();
      trail.record("game.over", {
        score: Number(e.score) || 0,
        lines: Number(e.lines) || 0,
        level: Number(e.level) || 1,
        seconds: Number(e.seconds) || 0,
        best: isBest
      });
      await draw();
    }
  };
  function pause(reason) {
    if (!session.pause()) return false;
    trail.record("game.pause", { reason, ...figures() });
    void save().catch((err) => trail.error(err));
    return true;
  }
  const resume = () => {
    if (!session.resume()) return false;
    trail.record("game.resume", figures());
    return true;
  };
  let loading = null;
  const ensureLoaded = () => {
    if (!loading) {
      loading = (async () => {
        best = await store.best();
        const snap = await store.snapshot();
        if (snap && session.status === "none" && session.restore(snap)) {
          trail.record("game.restore", figures());
        }
      })().catch((err) => trail.error(err));
    }
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
    await store.setVisible(true);
    trail.record("view.show", {});
    await draw();
  };
  const hide = async () => {
    pause("toggle");
    await save();
    visible = false;
    shown = null;
    await tf.overlay.hide();
    await store.setVisible(false);
    trail.record("view.hide", {});
  };
  const run = async (action) => {
    await ensureLoaded();
    if (action === "toggle") return visible ? hide() : show();
    if (action === "newGame") {
      if (!visible) await show();
      await store.clearSnapshot();
      session.newGame({ startLevel: settings().startLevel });
      return draw();
    }
    if (action === "pause") {
      if (!visible) return show();
      if (session.status === "playing") pause("user");
      else if (session.status === "paused") resume();
      else {
        await store.clearSnapshot();
        session.newGame({ startLevel: settings().startLevel });
      }
      return draw();
    }
    if (!visible) return void 0;
    session.act(action);
    return drawing ?? void 0;
  };
  const background = (fn) => (e) => {
    void (async () => {
      await ensureLoaded();
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
      const action = actionForClick(String(e.item), session.status);
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
      const key = e && e.key;
      if (!visible) return;
      if (LAYOUT_KEYS.includes(key)) {
        try {
          layout = await tf.overlay.layout();
        } catch {
        }
      }
      await draw();
    })
  );
  return { session, run };
}

// src/main.js
var main_default = (tf) => {
  registerSettings(tf);
  runTilefall(tf, { createGame, gravityMs });
};
export default main_default;
