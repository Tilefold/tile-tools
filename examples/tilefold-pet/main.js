/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet (example tile)
 *
 * A pet lives on top of your panes: Tessa, a small creature made of four
 * rounded tiles, Coco, a white poodle, Biscuit, a scruffy terrier, Pebble,
 * an emperor penguin, Volta, a spark fox who crackles with lightning, or
 * Rumble, a T. rex (Settings → Tiles → Tilefold Pet → Character). It roams around your panes (or keeps to the bottom), naps
 * when you step away, barks if it's a dog, loves a pat, plays on a double-click, and can be
 * dragged to another pane. Commands: "Tilefold Pet: Show or hide", "Tilefold Pet:
 * Come here" and "Tilefold Pet: Nap or wake up".
 *
 * Built on overlays (permission window.overlay): the tile describes a
 * scene and Tilefold draws it, so nothing of the tile runs in the window
 * and the pet can never take your typing or see your terminal.
 *
 * This tile is written as several files under src/ (this entry, the
 * behaviour, and one file per character) and bundled into main.js with
 * `npx @tilefold/tile-tools build`.
 *
 * Modified 2026-10-12 (added Pebble, the emperor penguin).
 * Modified 2026-10-12 (added Volta, the spark fox).
 * Modified 2026-10-12 (added Rumble, the T. rex).
 *
 * Last updated by: Tilefold
 */
// Built by @tilefold/tile-tools from src/main.js. Edit the sources, then rebuild.
// src/art.js
var BOX = 48;
function svgUrl(inner, frames = 1) {
  const w = BOX * frames;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BOX}" viewBox="0 0 ${w} ${BOX}">${inner}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function still(inner) {
  return { image: svgUrl(inner), sheet: null };
}
function sprite(frames, fps, draw) {
  let inner = "";
  for (let i = 0; i < frames; i++) {
    inner += `<g transform="translate(${i * BOX} 0)">${draw(i)}</g>`;
  }
  return { image: svgUrl(inner, frames), sheet: { frames, fps } };
}
function shadow(rx) {
  return `<ellipse cx="24" cy="46" rx="${rx}" ry="2" fill="#1f2937" opacity=".18"/>`;
}
function snore(x, y) {
  return `<text x="${x}" y="${y}" font-size="9" font-family="sans-serif" fill="#94a3b8" stroke="#1f2937" stroke-width=".3">z</text>`;
}

// src/characters/penguin.js
var HEAD = "#141922";
var RIM = "#8b96a8";
var FLIPPER = "#262f3e";
var FLIPPER_EDGE = "#5b6779";
var FOOT = "#2a303b";
var FAR = "#1a1f28";
var BILL = "#0f141c";
var MANDIBLE = "#ef8354";
var EYE = "#05070b";
var EYE_RING = "#3f4756";
var GLINT = "#ffffff";
var DEFS = '<defs><linearGradient id="pgBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4558"/><stop offset="1" stop-color="#1b212c"/></linearGradient><linearGradient id="pgBelly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe2a0"/><stop offset=".22" stop-color="#fff8e8"/><stop offset=".65" stop-color="#ffffff"/><stop offset="1" stop-color="#d6dce5"/></linearGradient><linearGradient id="pgPatch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#fde68a"/></linearGradient></defs>';
var circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
var rim = (d) => `<path d="${d}" fill="none" stroke="${RIM}" stroke-width="1.4" stroke-linejoin="round"/>`;
var fill = (d, color) => `<path d="${d}" fill="${color}"/>`;
var turn = (deg, x, y, inner) => deg ? `<g transform="rotate(${deg} ${x} ${y})">${inner}</g>` : inner;
var BODY = "M23 13.6C26 12.6 30.5 13 32.2 16.6C34.4 22 35.2 29.5 34 35C33 39.8 29 42.4 24 42.4C18.6 42.4 14.6 39.4 14 34.4C13.4 27.6 17.4 19.6 23 13.6Z";
var BELLY = "M31.6 16.6C33.8 22 34.6 29 33.6 34.8C32.6 39.6 29 41.8 25 41.8C22 41.6 20.6 38 21 32C21.5 25 25 19.6 29.6 16.4Z";
var TAIL = "M15.6 37.4L11 42.4L17.4 41.2Z";
var NECK = [27, 15];
function headParts(dx, dy, eye2) {
  const p = (x, y) => `${x + dx} ${y + dy}`;
  const skull = circle(28.2 + dx, 10.4 + dy, 5.9);
  const patch = `M${p(25.4, 11.2)}C${p(27.4, 11.2)} ${p(29, 12.6)} ${p(30.2, 14.4)}C${p(31.4, 16.2)} ${p(31.8, 18.2)} ${p(31, 19.8)}C${p(30.2, 18.8)} ${p(29, 17.8)} ${p(27.6, 16.8)}C${p(26, 15.6)} ${p(25, 14)} ${p(25, 12.4)}C${p(25, 11.8)} ${p(25.1, 11.4)} ${p(25.4, 11.2)}Z`;
  const upperBill = `M${p(33.6, 9.8)}C${p(36.8, 10.4)} ${p(39.8, 11.6)} ${p(42.2, 13.2)}C${p(39.8, 13)} ${p(36.8, 12.8)} ${p(33.8, 12.8)}Z`;
  const lowerBill = `M${p(34, 12.8)}C${p(36.8, 13)} ${p(39.4, 13.3)} ${p(41.4, 13.6)}C${p(39.2, 14.3)} ${p(36.4, 14.4)} ${p(34.2, 14)}Z`;
  const [ex, ey] = [30.4 + dx, 9.4 + dy];
  let eyes;
  if (eye2 === "closed" || eye2 === "blink") {
    eyes = `<path d="M${ex - 1.2} ${ey}q1.2 ${eye2 === "closed" ? 0.9 : 0.3} 2.4 0" stroke="${RIM}" stroke-width=".7" fill="none" stroke-linecap="round"/>`;
  } else if (eye2 === "happy") {
    eyes = `<path d="M${ex - 1.2} ${ey + 0.3}q1.2 -1.3 2.4 0" stroke="${RIM}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
  } else {
    eyes = `<circle cx="${ex}" cy="${ey}" r="1.35" fill="${EYE_RING}"/><circle cx="${ex}" cy="${ey}" r="1" fill="${EYE}"/><circle cx="${ex + 0.38}" cy="${ey - 0.38}" r=".36" fill="${GLINT}"/>`;
  }
  return {
    skull,
    details: fill(patch, "url(#pgPatch)") + fill(upperBill, BILL) + fill(lowerBill, MANDIBLE) + eyes
  };
}
function flipper(flap) {
  const d = "M22.8 18.2C20.4 21.8 18.6 26.8 18 32.2C17.8 33.8 18.8 34.2 19.6 33C21.6 29 23.8 24.4 24.8 19.6Z";
  return turn(
    flap,
    23.6,
    19,
    `<path d="${d}" fill="${FLIPPER}" stroke="${FLIPPER_EDGE}" stroke-width=".5" stroke-linejoin="round"/>`
  );
}
var foot = (x, lift, color) => `<path d="M${x} ${41.4 - lift}c2.4 -.5 5.2 -.2 6.6 .9c-1.8 .7 -5 .8 -6.8 .3z" fill="${color}"/>`;
function standing({ tilt = 0, lift = [0, 0], head: head2 = 0, flap = 0, eye: eye2 = "open" } = {}) {
  const h = headParts(0, 0, eye2);
  const [nx, ny] = NECK;
  const bird = foot(20.6, lift[1], FAR) + fill(TAIL, FAR) + rim(BODY) + turn(head2, nx, ny, rim(h.skull)) + fill(BODY, "url(#pgBack)") + turn(head2, nx, ny, fill(h.skull, HEAD)) + fill(BELLY, "url(#pgBelly)") + turn(head2, nx, ny, h.details) + flipper(flap) + foot(23.4, lift[0], FOOT);
  return DEFS + shadow(12) + turn(tilt, 24, 42, bird);
}
function lying() {
  const body2 = "M8.6 40.8C9 35.6 15 32.6 22.6 32.2C28.6 31.8 33 32.6 34.6 35.6C35.8 38.6 34.4 42.2 30 42.4L14 42.4C10.6 42.4 8.4 42 8.6 40.8Z";
  const belly = "M12 42.4C18.4 40.8 27.6 40 34.8 38.4C34.4 41 32.6 42.3 30 42.4Z";
  const side2 = "M18 35C14 36.4 10.6 38.4 9.4 40C13 39.6 16.6 38.4 19.6 36.6Z";
  const feet = "M9 41.2c-1.6 -.2 -3.2 .1 -4.2 .8c1.4 .5 3 .5 4.4 .2z";
  const h = headParts(4.6, 19.4, "open");
  return DEFS + shadow(14) + fill(feet, FAR) + rim(body2) + rim(h.skull) + fill(body2, "url(#pgBack)") + fill(h.skull, HEAD) + fill(belly, "url(#pgBelly)") + h.details + `<path d="${side2}" fill="${FLIPPER}" stroke="${FLIPPER_EDGE}" stroke-width=".5" stroke-linejoin="round"/>`;
}
var ROUND = "M24 15C31 15 34.5 24 34 32C33.6 38.5 29.5 42.2 24 42.2C18.5 42.2 14.4 38.5 14 32C13.5 24 17 15 24 15Z";
var SKULL = circle(24, 10.6, 6.2);
var SIDE_FLIPPER = "M15.6 18.8C12.8 22.8 11.4 27.8 11.6 32C12.6 32.6 13.4 32 14 30.6C14.4 26.6 15.2 22.6 16.8 19.8Z";
var mirror = (inner) => `<g transform="matrix(-1 0 0 1 48 0)">${inner}</g>`;
var flippers = () => {
  const one = `<path d="${SIDE_FLIPPER}" fill="${FLIPPER}" stroke="${FLIPPER_EDGE}" stroke-width=".5" stroke-linejoin="round"/>`;
  return one + mirror(one);
};
var WADDLE = [
  { tilt: -5, lift: [1.6, 0] },
  { tilt: 0, lift: [0, 0] },
  { tilt: 5, lift: [0, 1.6] },
  { tilt: 0, lift: [0, 0] }
];
function front(step) {
  const { tilt, lift } = WADDLE[step];
  const belly = "M24 17C29.5 17.5 31.6 25 31.2 32C30.8 38 28 41.4 24 41.4C20 41.4 17.2 38 16.8 32C16.4 25 18.5 17.5 24 17Z";
  const patch = "M18.2 11C17.6 13.6 17.8 16.4 19.2 18.6C20.4 20.2 22.2 21 24 21C22.6 19.6 21.4 17.6 20.8 15.4C20.4 13.8 20.2 12.4 19.6 11.2Z";
  const eye2 = (x) => `<circle cx="${x}" cy="10" r="1.25" fill="${EYE_RING}"/><circle cx="${x}" cy="10" r=".9" fill="${EYE}"/><circle cx="${x + 0.32}" cy="9.65" r=".32" fill="${GLINT}"/>`;
  const bird = `<ellipse cx="20.4" cy="${42 - lift[0]}" rx="2.6" ry="1.1" fill="${FOOT}"/><ellipse cx="27.6" cy="${42 - lift[1]}" rx="2.6" ry="1.1" fill="${FOOT}"/>` + rim(ROUND) + rim(SKULL) + fill(ROUND, "url(#pgBack)") + fill(SKULL, HEAD) + fill(belly, "url(#pgBelly)") + `<ellipse cx="24" cy="20.4" rx="6.8" ry="3.4" fill="#fde68a" opacity=".6"/>` + fill(patch, "url(#pgPatch)") + mirror(fill(patch, "url(#pgPatch)")) + eye2(21.3) + eye2(26.7) + // Seen head-on the bill is a narrow wedge, its orange stripe down the middle.
  fill("M22.7 11.8L25.3 11.8L24 16.6Z", BILL) + fill("M23.5 13L24.5 13L24 15.6Z", MANDIBLE) + flippers();
  return DEFS + shadow(12) + turn(tilt, 24, 42, bird);
}
function behind(step) {
  const { tilt, lift } = WADDLE[step];
  const sliver = "M18 12.4C17.6 14.4 17.9 16.4 19 18.2C19.2 16.4 18.9 14.2 18 12.4Z";
  const bird = rim(ROUND) + rim(SKULL) + fill(ROUND, "url(#pgBack)") + fill(SKULL, HEAD) + fill(sliver, "url(#pgPatch)") + mirror(fill(sliver, "url(#pgPatch)")) + flippers() + fill("M21.6 38.6L24 43.2L26.4 38.6Z", FAR) + // Only the heels show from behind.
  `<ellipse cx="20.4" cy="${42.2 - lift[0]}" rx="2" ry=".9" fill="${FOOT}"/><ellipse cx="27.6" cy="${42.2 - lift[1]}" rx="2" ry=".9" fill="${FOOT}"/>`;
  return DEFS + shadow(12) + turn(tilt, 24, 42, bird);
}
var penguin = {
  id: "penguin",
  label: "setting-character-penguin",
  name: "Pebble",
  // Penguins waddle: slower than the dogs (46) and Tessa (40).
  speed: 30,
  bubbles: {},
  // No `sounds`: she stays quiet whatever the Bark setting says.
  poses: () => ({
    idle: still(standing()),
    blink: still(standing({ eye: "blink" })),
    sit: still(lying()),
    walk: sprite(4, 6, (i) => standing({ ...WADDLE[i], flap: [14, 8, 14, 8][i] })),
    walkDown: sprite(4, 6, front),
    walkUp: sprite(4, 6, behind),
    happy: sprite(2, 6, (i) => standing({ eye: "happy", head: -16, flap: i ? 55 : 20 })),
    sleep: still(standing({ head: 38, eye: "closed" }) + snore(37, 8))
  })
};

// src/audio.js
var RATE = 22050;
function noise(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x = Math.imul(x, 1664525) + 1013904223 >>> 0;
    return x / 4294967295 * 2 - 1;
  };
}
function bandPass(freq, q) {
  const w = 2 * Math.PI * freq / RATE;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const a1 = -2 * Math.cos(w) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}
function wavUrl(samples) {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);
  const text = (at3, s) => {
    for (let i = 0; i < s.length; i++) bytes[at3 + i] = s.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  }
  return "data:audio/wav;base64," + btoa(bin);
}

// src/characters/bark.js
var LENGTH = 0.17;
var GAP = 0.09;
function bark(pitch, seed) {
  const n = Math.round(LENGTH * RATE);
  const out = new Float32Array(n);
  const mouth = [bandPass(1100, 3.5), bandPass(2500, 5)];
  const breath = bandPass(2200, 1.2);
  const rand = noise(seed);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const rise = Math.min(1, t / 0.02);
    const fall = Math.max(0, (t - 0.02) / (LENGTH - 0.02));
    const f = pitch * (0.92 + 0.12 * rise) * (1 - 0.38 * fall);
    phase += 2 * Math.PI * f / RATE;
    let voice = 0;
    for (let k = 1; k <= 14; k++) voice += Math.sin(k * phase) / Math.pow(k, 1.1);
    const shaped = 0.25 * voice + 1.6 * mouth[0](voice) + 0.9 * mouth[1](voice);
    const attack = Math.min(1, t / 6e-3);
    const decay = Math.exp(-t / 0.055) * 0.85 + 0.15 * Math.max(0, 1 - t / LENGTH);
    const burst = breath(rand()) * 2.2 * Math.exp(-t / 0.018);
    out[i] = (shaped * 0.22 + burst) * attack * decay;
  }
  return out;
}
function barks(count, pitch = 800) {
  const gap = Math.round(GAP * RATE);
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(bark(pitch * Math.pow(0.92, i), 7 + i));
  const total = parts.reduce((sum, p) => sum + p.length, 0) + gap * (count - 1);
  const all = new Float32Array(total);
  let at3 = 0;
  for (const p of parts) {
    all.set(p, at3);
    at3 += p.length + gap;
  }
  let peak = 0;
  for (const v of all) peak = Math.max(peak, Math.abs(v));
  const scale = peak ? 0.85 / Math.tanh(1.4) : 0;
  for (let i = 0; i < all.length; i++) all[i] = Math.tanh(1.4 * all[i] / (peak || 1)) * scale;
  return wavUrl(all);
}

// src/characters/poodle.js
var FUR = "#ffffff";
var SHADE = "#e6e8ef";
var LINE = "#aeb3c2";
var INK = "#1f2937";
var TONGUE = "#fb7185";
var COLLAR = "#2dd4bf";
var TAG = "#fbbf24";
var puff = ([x, y, r], fill2, grow = 0) => `<circle cx="${x}" cy="${y}" r="${r + grow}" fill="${fill2}"/>`;
var leg = ([hx, hy, fx, fy], color, grow = 0) => `<path d="M${hx} ${hy}L${fx} ${fy}" stroke="${color}" stroke-width="${3 + grow * 2}" stroke-linecap="round"/><circle cx="${fx}" cy="${fy + 1.4}" r="${2.5 + grow}" fill="${color}"/>`;
function fluff(puffs, legs, fill2) {
  const outline = puffs.map((p) => puff(p, LINE, 0.9)).join("") + legs.map((l) => leg(l, LINE, 0.9)).join("");
  const inside = legs.map((l) => leg(l, fill2)).join("") + puffs.map((p) => puff(p, fill2)).join("");
  return outline + inside;
}
function tail([bx, by], angle, length = 5.5) {
  const a = angle * Math.PI / 180;
  const tx = +(bx - Math.sin(a) * length).toFixed(1);
  const ty = +(by - Math.cos(a) * length).toFixed(1);
  const stalk = (color, width) => `<path d="M${bx} ${by}L${tx} ${ty}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  return stalk(LINE, 4.2) + puff([tx, ty - 1.2, 3.8], LINE, 0.9) + stalk(FUR, 2.4) + puff([tx, ty - 1.2, 3.8], FUR);
}
function face(dx, dy, { eye: eye2 = "open", tongue = false, collar = true } = {}) {
  const at3 = (x, y) => `${x + dx} ${y + dy}`;
  const ear = fluff(
    [
      [33.8 + dx, 16.6 + dy, 2.9],
      [33.2 + dx, 19.8 + dy, 3.2],
      [33.7 + dx, 22.8 + dy, 2.6]
    ],
    [],
    SHADE
  );
  const band = collar ? `<path d="M${at3(32.2, 21.6)}Q${at3(35.6, 24.4)} ${at3(39.4, 21.4)}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="${35.8 + dx}" cy="${24.6 + dy}" r="1.2" fill="${TAG}"/>` : "";
  let eyes;
  if (eye2 === "closed") {
    eyes = `<path d="M${at3(37.6, 14.2)}q1.4 1.2 2.8 0" stroke="${INK}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  } else if (eye2 === "happy") {
    eyes = `<path d="M${at3(37.6, 14.6)}q1.4 -1.6 2.8 0" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else if (eye2 === "blink") {
    eyes = `<path d="M${at3(37.7, 14)}h2.6" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
  } else {
    eyes = `<circle cx="${39 + dx}" cy="${14 + dy}" r="1.35" fill="${INK}"/><circle cx="${39.45 + dx}" cy="${13.5 + dy}" r=".45" fill="${FUR}"/>`;
  }
  const nose = `<ellipse cx="${46 + dx}" cy="${16.6 + dy}" rx="1.4" ry="1.2" fill="${INK}"/>`;
  const mouth = tongue ? `<path d="M${at3(42.4, 19.4)}q1 3.6 2.4 0z" fill="${TONGUE}" stroke="${INK}" stroke-width=".5"/>` : `<path d="M${at3(42.6, 19.2)}q1.2 .8 2.4 0" stroke="${LINE}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
  return ear + band + eyes + nose + mouth;
}
var headPuffs = (dx, dy) => [
  [37 + dx, 15 + dy, 5.8],
  [35.8 + dx, 8.6 + dy, 4.4],
  [39.4 + dx, 9.6 + dy, 3.2],
  [42.6 + dx, 17.4 + dy, 3.3],
  [44.6 + dx, 16.8 + dy, 2.4]
];
function standing2({ swing = 0, lift = 0, wag = 0, eye: eye2 = "open", tongue = false } = {}) {
  const y = -lift;
  const body2 = [
    [12.6, 25 + y, 4.8],
    [17, 27 + y, 6],
    [23, 26 + y, 6.4],
    [28.6, 26.2 + y, 5.8],
    [33, 22.8 + y, 5.4]
  ];
  const far = [
    [18, 30 + y, 18 - swing, 41],
    [31, 30 + y, 31 + swing, 41]
  ];
  const near = [
    [21, 30 + y, 21 + swing, 41],
    [34, 29 + y, 34 - swing, 41]
  ];
  return shadow(15) + fluff([], far, SHADE) + tail([11.4, 22.4 + y], 25 + wag) + fluff([...body2, ...headPuffs(0, y)], near, FUR) + face(0, y, { eye: eye2, tongue });
}
function sitting() {
  const body2 = [
    [14.6, 37.4, 5.6],
    [19.6, 34.4, 6.6],
    [26, 29.6, 6],
    [31.2, 24.4, 5.6]
  ];
  const front6 = [
    [29.6, 31, 29.6, 41],
    [33.6, 30, 33.6, 41]
  ];
  return shadow(14) + tail([10.6, 35], 20) + fluff([...body2, [20.6, 41.4, 3.4], ...headPuffs(0, 1)], front6, FUR) + face(0, 1);
}
function sleeping() {
  const body2 = [
    [14.2, 39.4, 5.4],
    [20.4, 38.2, 6.4],
    [27, 38.4, 6],
    [32.6, 39.2, 5.2],
    [42.6, 43.2, 2.8],
    [9.4, 42, 3.4]
  ];
  return shadow(18) + fluff([...body2, ...headPuffs(-1.4, 22.4)], [], FUR) + face(-1.4, 22.4, { eye: "closed", collar: false }) + snore(40, 15);
}
var sideEar = (x, y) => fluff(
  [
    [x, y, 2.8],
    [x - 0.2, y + 3.4, 3.1],
    [x + 0.1, y + 6.4, 2.6]
  ],
  [],
  SHADE
);
function front2(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0]
  ][step];
  const bob = step % 2 ? -0.8 : 0;
  const back = [
    [16, 31 + bob, 16, 40.5],
    [32, 31 + bob, 32, 40.5]
  ];
  const fore = [
    [20, 32 + bob, 20, 41 - lift[0]],
    [28, 32 + bob, 28, 41 - lift[1]]
  ];
  const body2 = [
    [17.6, 29 + bob, 5.4],
    [30.4, 29 + bob, 5.4],
    [24, 30.4 + bob, 7.6]
  ];
  const head2 = [
    [24, 17 + bob, 6.8],
    [24, 9.4 + bob, 4.8],
    [20.4, 10.8 + bob, 3.4],
    [27.6, 10.8 + bob, 3.4]
  ];
  const y = (v) => v + bob;
  return shadow(13) + fluff([], back, SHADE) + fluff([...body2, ...head2], fore, FUR) + sideEar(16.6, y(15.4)) + sideEar(31.4, y(15.4)) + `<path d="M18.4 ${y(23.6)}Q24 ${y(27.6)} 29.6 ${y(23.6)}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="24" cy="${y(26.6)}" r="1.2" fill="${TAG}"/>` + puff([24, y(21.4), 3.4], LINE, 0.9) + puff([24, y(21.4), 3.4], FUR) + `<circle cx="20.9" cy="${y(16.4)}" r="1.35" fill="${INK}"/><circle cx="27.1" cy="${y(16.4)}" r="1.35" fill="${INK}"/><circle cx="21.3" cy="${y(15.9)}" r=".45" fill="${FUR}"/><circle cx="27.5" cy="${y(15.9)}" r=".45" fill="${FUR}"/><ellipse cx="24" cy="${y(20.2)}" rx="1.6" ry="1.2" fill="${INK}"/><path d="M22.6 ${y(22.6)}q1.4 1 2.8 0" stroke="${LINE}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
}
function behind2(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0]
  ][step];
  const bob = step % 2 ? -0.8 : 0;
  const far = [
    [17, 30 + bob, 17, 40.5],
    [31, 30 + bob, 31, 40.5]
  ];
  const near = [
    [20, 32 + bob, 20, 41 - lift[0]],
    [28, 32 + bob, 28, 41 - lift[1]]
  ];
  const head2 = [
    [24, 13.6 + bob, 6.4],
    [24, 7 + bob, 4.6],
    [20.6, 8.4 + bob, 3.3],
    [27.4, 8.4 + bob, 3.3]
  ];
  const body2 = [
    [18, 29 + bob, 5.2],
    [30, 29 + bob, 5.2],
    [24, 31.6 + bob, 7.4]
  ];
  const wag = [0, 1.2, 0, -1.2][step];
  return shadow(13) + fluff(head2, [], FUR) + sideEar(17, 12.8 + bob) + sideEar(31, 12.8 + bob) + `<path d="M19.2 ${18.8 + bob}Q24 ${21.2 + bob} 28.8 ${18.8 + bob}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/>` + fluff([], far, SHADE) + // The tail's stalk goes behind the rump; only the pom shows above it.
  `<path d="M24 ${28 + bob}L${24 + wag} ${22.4 + bob}" stroke="${LINE}" stroke-width="3.6" stroke-linecap="round"/><path d="M24 ${28 + bob}L${24 + wag} ${22.4 + bob}" stroke="${FUR}" stroke-width="1.8" stroke-linecap="round"/>` + fluff(body2, near, FUR) + puff([24 + wag, 21.2 + bob, 3.2], LINE, 0.9) + puff([24 + wag, 21.2 + bob, 3.2], FUR);
}
var poodle = {
  id: "poodle",
  label: "setting-character-poodle",
  name: "Coco",
  speed: 46,
  bubbles: { play: "bubble-woof" },
  sounds: { bark: barks },
  poses: () => ({
    idle: still(standing2()),
    blink: still(standing2({ eye: "blink" })),
    sit: still(sitting()),
    walk: sprite(
      4,
      8,
      (i) => standing2({ swing: [2.4, 0, -2.4, 0][i], lift: [0, 0.8, 0, 0.8][i], wag: [0, 6, 0, -6][i] })
    ),
    walkDown: sprite(4, 8, front2),
    walkUp: sprite(4, 8, behind2),
    happy: sprite(2, 8, (i) => standing2({ eye: "happy", tongue: true, wag: i ? -18 : 18 })),
    sleep: still(sleeping())
  })
};

// src/characters/terrier.js
var CREAM = "#f3e6c9";
var LIGHT = "#fcf8ee";
var SHADE2 = "#dfcca6";
var LINE2 = "#8a6e58";
var PINK = "#eba5a9";
var INK2 = "#2b211c";
var TONGUE2 = "#f47d8c";
function shape(s, fill2, outline) {
  const edge = outline ? ` stroke="${LINE2}" stroke-width="1.7" stroke-linejoin="round"` : "";
  if (s.e) {
    const [cx, cy, rx, ry] = s.e;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill2}"${edge}/>`;
  }
  if (s.p) return `<path d="${s.p}" fill="${fill2}"${edge}/>`;
  const [x1, y1, x2, y2, w] = s.l;
  const width = outline ? w + 1.7 : w;
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${outline ? LINE2 : fill2}" stroke-width="${width}" stroke-linecap="round"/>`;
}
function silhouette(shapes, fill2) {
  return shapes.map((s) => shape(s, fill2, true)).join("") + shapes.map((s) => shape(s, fill2, false)).join("");
}
var tuft = (x, y, dx, dy, w = 1.6) => ({
  p: `M${x - w} ${y}L${x + dx} ${y + dy}L${x + w} ${y}Z`
});
var paw = (x, y) => ({ e: [x + 0.8, y + 0.6, 2.4, 1.5] });
function tail2(wag = 0, base = [11.5, 24]) {
  const a = wag * Math.PI / 180;
  const [bx, by] = base;
  const at3 = (dx, dy) => `${+(bx + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(1)} ${+(by + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(1)}`;
  return [
    {
      p: `M${at3(0, -1.6)}Q${at3(-7.6, -3)} ${at3(-5.6, -11.4)}Q${at3(-3, -10.6)} ${at3(-2.4, -8.2)}Q${at3(-3.2, -3.6)} ${at3(2, 2)}Z`
    },
    { p: `M${at3(-5.6, -11.4)}L${at3(-6.4, -14.6)}L${at3(-3.4, -10.4)}Z` },
    { p: `M${at3(-6.6, -5.4)}L${at3(-9.4, -5.6)}L${at3(-6.4, -3.4)}Z` }
  ];
}
function profileHead(y, { eye: eye2 = "open", tongue = false } = {}) {
  const coat = [
    {
      p: `M27 ${22.4 + y}Q31 ${18 + y} 34 ${15.6 + y}L40 ${19.4 + y}Q38.6 ${27 + y} 34 ${30.4 + y}L27 ${30 + y}Z`
    },
    { e: [37.6, 17.6 + y, 5.3, 4.8] },
    // Big upright ear, slightly back.
    { p: `M34.2 ${15.2 + y}L35.4 ${3.6 + y}L40.2 ${14 + y}Z` }
  ];
  const far = [{ p: `M32.2 ${15.6 + y}L32 ${6.2 + y}L35.6 ${13.8 + y}Z` }];
  const light = [
    {
      p: `M35.2 ${21.6 + y}Q39.2 ${23.4 + y} 37.6 ${27.6 + y}Q36 ${31.4 + y} 32.2 ${31 + y}Q34.4 ${26.4 + y} 35.2 ${21.6 + y}Z`
    },
    tuft(33.6, 30.6 + y, -0.2, 2.6, 1.2),
    tuft(36, 29.6 + y, 0.4, 2.2, 1)
  ];
  const muzzle = [{ e: [42, 20 + y, 3.8, 2.6] }, tuft(41.4, 22.4 + y, -0.6, 2.4, 1.2)];
  let eyes = `<circle cx="39.4" cy="${16.8 + y}" r="1.15" fill="${INK2}"/>`;
  if (eye2 === "blink") {
    eyes = `<path d="M38.3 ${16.9 + y}h2.3" stroke="${INK2}" stroke-width="1" stroke-linecap="round"/>`;
  }
  if (eye2 === "happy") {
    eyes = `<path d="M38.3 ${17.2 + y}q1.15 -1.4 2.3 0" stroke="${INK2}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }
  const mouth = tongue ? `<path d="M42 ${21.6 + y}q1 3.4 2.2 0z" fill="${TONGUE2}" stroke="${LINE2}" stroke-width=".5"/>` : "";
  const top = `<path d="M35.5 ${6.4 + y}L36.4 ${13.4 + y}L38.8 ${13.2 + y}Z" fill="${PINK}"/>` + silhouette(light, LIGHT) + silhouette(muzzle, LIGHT) + eyes + `<path d="M38.2 ${15 + y}l2.2 -.4" stroke="${LINE2}" stroke-width=".7" stroke-linecap="round"/><ellipse cx="45.4" cy="${19.3 + y}" rx="1.35" ry="1.15" fill="${INK2}"/>` + mouth;
  return { coat, far, top };
}
function side({ swing = 0, lift = 0, wag = 0, eye: eye2 = "open", tongue = false } = {}) {
  const y = -lift;
  const head2 = profileHead(y, { eye: eye2, tongue });
  const far = [
    ...head2.far,
    { l: [16, 30 + y, 16 - swing, 41.5, 3] },
    { l: [32, 30 + y, 32 + swing, 41.5, 3] },
    paw(16 - swing, 41.5),
    paw(32 + swing, 41.5)
  ];
  const coat = [
    ...tail2(wag, [11.5, 24 + y]),
    { e: [22, 26.5 + y, 11, 5.8] },
    tuft(16, 31.5 + y, 0.6, 3),
    tuft(21, 32 + y, 0.4, 3.2),
    tuft(26, 31.6 + y, -0.2, 3),
    ...head2.coat,
    { l: [19.5, 30 + y, 19.5 + swing, 41.5, 3.2] },
    { l: [35, 30 + y, 35 - swing, 41.5, 3.2] },
    paw(19.5 + swing, 41.5),
    paw(35 - swing, 41.5)
  ];
  return shadow(15) + silhouette(far, SHADE2) + silhouette(coat, CREAM) + head2.top;
}
function sitting2() {
  const head2 = profileHead(-1.6);
  const coat = [
    ...tail2(-35, [14, 39.6]),
    { e: [21, 35.4, 7.6, 6.6] },
    { e: [19.6, 41.4, 5, 1.9] },
    // The back, sloping from the haunch up to the chest.
    { p: "M14.6 33.4Q19.4 24.6 28.4 20.6L34.4 29.6Q30.4 38.8 22 41.2Z" },
    ...head2.coat,
    { l: [31, 29, 31, 41.5, 3.2] },
    { l: [34.8, 29, 34.8, 41.5, 3.2] },
    paw(31, 41.5),
    paw(34.8, 41.5)
  ];
  return shadow(14) + silhouette(head2.far, SHADE2) + silhouette(coat, CREAM) + head2.top;
}
function front3(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0]
  ][step];
  const bob = step % 2 ? -0.7 : 0;
  const y = (v) => +(v + bob).toFixed(1);
  const back = [{ l: [17, y(31), 17, 41, 3] }, { l: [31, y(31), 31, 41, 3] }];
  const coat = [
    { e: [24, y(31), 7.6, 7.4] },
    tuft(18.4, y(36), -0.8, 3),
    tuft(29.6, y(36), 0.8, 3),
    { e: [24, y(17), 7.2, 6.6] },
    tuft(17.4, y(17.6), -2.6, 1),
    tuft(30.6, y(17.6), 2.6, 1),
    // Right ear stands up; the left one flops over.
    { p: `M27.6 ${y(12.6)}L33.6 ${y(1.6)}L32.2 ${y(15)}Z` },
    { p: `M20.4 ${y(12.4)}L13.2 ${y(6.4)}L11.6 ${y(11.2)}L18.6 ${y(15.6)}Z` },
    { l: [20.6, y(34), 20.6, 41.4 - lift[0], 3.2] },
    { l: [27.4, y(34), 27.4, 41.4 - lift[1], 3.2] },
    paw(19.8, 41.4 - lift[0]),
    paw(26.6, 41.4 - lift[1])
  ];
  const bib = [{ e: [24, y(29.6), 4.6, 5.6] }, tuft(24, y(34.6), 0, 3, 1.6)];
  const muzzle = [
    { e: [24, y(21.2), 4.2, 3.2] },
    tuft(22.4, y(23.6), -0.4, 2.2, 1.1),
    tuft(25.6, y(23.6), 0.4, 2.2, 1.1)
  ];
  return shadow(12) + silhouette([...back, paw(16.2, 41), paw(30.2, 41)], SHADE2) + silhouette(coat, CREAM) + `<path d="M29.2 ${y(12)}L32.8 ${y(4)}L31.6 ${y(12.8)}Z" fill="${PINK}"/><path d="M19.4 ${y(12.6)}L13.6 ${y(8)}L13 ${y(10.6)}Z" fill="${PINK}"/>` + silhouette(bib, LIGHT) + silhouette(muzzle, LIGHT) + `<circle cx="20.8" cy="${y(16.4)}" r="1.2" fill="${INK2}"/><circle cx="27.2" cy="${y(16.4)}" r="1.2" fill="${INK2}"/><path d="M19.8 ${y(14.2)}l2 .2M28.2 ${y(14.2)}l-2 .2" stroke="${LINE2}" stroke-width=".7" stroke-linecap="round"/><ellipse cx="24" cy="${y(20.2)}" rx="1.6" ry="1.2" fill="${INK2}"/>`;
}
function behind3(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0]
  ][step];
  const bob = step % 2 ? -0.7 : 0;
  const y = (v) => +(v + bob).toFixed(1);
  const wag = [0, 1, 0, -1][step];
  const far = [{ l: [18, y(31), 18, 41, 3] }, { l: [30, y(31), 30, 41, 3] }];
  const coat = [
    { p: `M18.6 ${y(13)}L13.4 ${y(1.8)}L22.2 ${y(10.4)}Z` },
    { p: `M29.4 ${y(13)}L34.6 ${y(1.8)}L25.8 ${y(10.4)}Z` },
    { e: [24, y(16), 6.8, 6.2] },
    { e: [24, y(31), 8, 7.6] },
    tuft(17.4, y(35), -1, 3),
    tuft(30.6, y(35), 1, 3),
    { l: [20.4, y(35), 20.4, 41.4 - lift[0], 3.2] },
    { l: [27.6, y(35), 27.6, 41.4 - lift[1], 3.2] },
    paw(19.6, 41.4 - lift[0]),
    paw(26.8, 41.4 - lift[1])
  ];
  const tailUp = [
    {
      p: `M23 ${y(31)}Q${21 + wag} ${y(24)} ${25 + wag} ${y(20)}L${26.6 + wag} ${y(22.4)}Q${24 + wag} ${y(25.6)} 25.4 ${y(31)}Z`
    },
    tuft(25.8 + wag, y(20.6), 1.6, -2.6, 1.2)
  ];
  return shadow(12) + silhouette([...far, paw(17.2, 41), paw(29.2, 41)], SHADE2) + silhouette(coat, CREAM) + silhouette(tailUp, CREAM);
}
function sleeping2() {
  const coat = [
    ...tail2(-15, [12, 37.6]),
    { e: [21, 39.4, 12, 5.4] },
    tuft(14, 44.4, 0.2, 1.6, 1.4),
    { e: [36, 37.2, 5.4, 4.8] },
    { p: "M32 34.4L28.6 27.6L35.4 32.6Z" },
    { e: [39.4, 43.2, 4.6, 1.8] }
  ];
  return shadow(19) + silhouette(coat, CREAM) + silhouette([{ e: [40.8, 39.6, 3.6, 2.5] }, tuft(40.4, 41.8, -0.4, 1.8, 1)], LIGHT) + `<path d="M36.4 36.6q1.2 1 2.4 0" stroke="${INK2}" stroke-width="1" fill="none" stroke-linecap="round"/><ellipse cx="44.2" cy="38.8" rx="1.3" ry="1.1" fill="${INK2}"/>` + snore(40, 22);
}
var terrier = {
  id: "terrier",
  label: "setting-character-terrier",
  name: "Biscuit",
  speed: 52,
  bubbles: { play: "bubble-woof" },
  sounds: { bark: (count) => barks(count, 660) },
  poses: () => ({
    idle: still(side()),
    blink: still(side({ eye: "blink" })),
    sit: still(sitting2()),
    walk: sprite(
      4,
      8,
      (i) => side({ swing: [2.6, 0, -2.6, 0][i], lift: [0, 0.8, 0, 0.8][i], wag: [0, 8, 0, -8][i] })
    ),
    walkDown: sprite(4, 8, front3),
    walkUp: sprite(4, 8, behind3),
    happy: sprite(2, 8, (i) => side({ eye: "happy", tongue: true, wag: i ? -22 : 14 })),
    sleep: still(sleeping2())
  })
};

// src/characters/trex.js
var LINE3 = "#1c2e14";
var BELLY2 = "#d8c98f";
var STRIPE = "#2a4a1c";
var FAR_SKIN = "#34561f";
var EYE2 = "#f59e0b";
var PUPIL = "#111827";
var TOOTH = "#fffbea";
var MOUTH = "#9f1239";
var CLAW = "#e7e2d0";
var DEFS2 = '<defs><linearGradient id="trSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f6a2a"/><stop offset="1" stop-color="#7aa556"/></linearGradient></defs>';
var SKIN = "url(#trSkin)";
var OUTLINE = `stroke="${LINE3}" stroke-width=".7" stroke-linejoin="round"`;
var at = (transform, inner) => transform ? `<g transform="${transform}">${inner}</g>` : inner;
var HINGE = [33.6, 19.6];
var NECK2 = [31, 18];
function head({ jaw = 0, eye: eye2 = "open" } = {}) {
  const skull = "M30.6 14.2C33 10.4 39 9 43.6 10.2C45.8 10.8 46.8 12.6 46.4 14.8L46 17.4C42 18.2 37 18.6 33.6 19.6C32 20 30.6 19 30.2 17.4Z";
  const lower = "M33.4 19.4C37.6 18.8 41.8 18.4 45.6 17.8C45.4 19.8 43 21.4 39 21.8C36.4 22 34.4 21.6 32.8 20.8Z";
  const teeth = [36, 38.4, 40.8, 43.2].map((x, i) => {
    const y = 18.5 - i * 0.22;
    return `<path d="M${x} ${y}l.55 1.2l.55 -1.25z" fill="${TOOTH}" stroke="${LINE3}" stroke-width=".2"/>`;
  }).join("");
  const [hx, hy] = HINGE;
  const mouth = jaw ? `<path d="M33.6 19.4L46 17.4L${hx + 12.2 * Math.cos(jaw * Math.PI / 180)} ${hy + 12.2 * Math.sin(jaw * Math.PI / 180)}Z" fill="${MOUTH}"/>` : "";
  const eyes = eye2 === "closed" ? `<path d="M37.8 13.6q1 .8 2 0" stroke="${LINE3}" stroke-width=".7" fill="none" stroke-linecap="round"/>` : `<circle cx="38.8" cy="13.4" r="1.15" fill="${EYE2}" stroke="${LINE3}" stroke-width=".3"/><ellipse cx="38.9" cy="13.4" rx=".32" ry=".95" fill="${PUPIL}"/><circle cx="39.3" cy="12.9" r=".25" fill="#fff"/>`;
  return mouth + at(jaw ? `rotate(${jaw} ${hx} ${hy})` : "", `<path d="${lower}" fill="${BELLY2}" ${OUTLINE}/>`) + `<path d="${skull}" fill="${SKIN}" ${OUTLINE}/>` + teeth + // The bony brow ridge that shades his eye.
  `<path d="M36.6 12.2q2.2 -1.4 4.4 -.4" stroke="${LINE3}" stroke-width=".8" fill="none" stroke-linecap="round"/>` + eyes + `<ellipse cx="45" cy="12.6" rx=".5" ry=".35" fill="${LINE3}"/>`;
}
var BODY2 = "M2 22C8 19 14 15.6 21 15C26 14.4 30 15.2 32.4 16.4L34.6 20.6C34 25 30 29.6 23.6 30.6C17 31.4 12 27.6 8 25.2C5.6 24 3.4 23.2 2 22Z";
var UNDER = "M8 25C12 27.4 17 30.2 22.6 30.4C28.4 30.6 32.6 27.4 34.4 22.4C30 26 25 27.6 20 27C15.6 26.4 11.6 25.6 8 25Z";
var STRIPES = [
  [9.6, 18.8],
  [14.6, 16.6],
  [19.6, 15.4],
  [25.4, 15]
].map(
  ([x, y]) => `<path d="M${x} ${y}q1 2.4 .2 4.6" stroke="${STRIPE}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".7"/>`
).join("");
function leg2(swing, fill2) {
  const thigh = "M16.6 24C16 29.4 19 32.6 23.4 32.4C26.4 32.2 27.4 29 26.4 25.4Z";
  const thighEdge = "M16.6 24C16 29.4 19 32.6 23.4 32.4C26.4 32.2 27.4 29 26.4 25.4";
  const shin = "M20.6 30.6L23.8 30.4L26.4 39.8L23.4 40.4Z";
  const foot2 = "M22.6 39.4L29.6 39.8L30.6 42L22 42.2Z";
  const claws = `<path d="M29.4 40l1.6 .8l-1 1.2" stroke="${CLAW}" stroke-width=".45" fill="none" stroke-linecap="round"/>`;
  return at(
    swing ? `rotate(${-swing} 21.6 26)` : "",
    `<path d="${shin}" fill="${fill2}" ${OUTLINE}/><path d="${foot2}" fill="${fill2}" ${OUTLINE}/>` + claws + `<path d="${thigh}" fill="${fill2}"/><path d="${thighEdge}" fill="none" ${OUTLINE}/>`
  );
}
var arm = (wave = 0) => at(
  wave ? `rotate(${wave} 31 24.6)` : "",
  `<path d="M31 24.6q2 1.2 2.4 3" stroke="${LINE3}" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M31 24.6q2 1.2 2.4 3" stroke="#6b9a48" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M33.4 27.6l.9 .3M33.3 27.7l.5 .8" stroke="${CLAW}" stroke-width=".4" stroke-linecap="round"/>`
);
function standing3({
  near = 0,
  far = 0,
  bob = 0,
  tilt = 0,
  jaw = 0,
  wave = 0,
  eye: eye2 = "open",
  shift = 0
} = {}) {
  const [nx, ny] = NECK2;
  const upper = at("translate(-2.4 0)", leg2(far, FAR_SKIN)) + `<path d="${BODY2}" fill="${SKIN}" ${OUTLINE}/><path d="${UNDER}" fill="${BELLY2}"/>` + STRIPES + at(tilt ? `rotate(${tilt} ${nx} ${ny})` : "", head({ jaw, eye: eye2 })) + arm(wave) + leg2(near, SKIN);
  return DEFS2 + shadow(17) + at(bob || shift ? `translate(${-shift} ${-bob})` : "", upper);
}
function lying2({ asleep = false } = {}) {
  const drop = 10.6;
  const thigh = `<path d="M15.6 34C15 38.4 18 41.6 23 41.6C27 41.6 28.2 38.6 27 35.4Z" fill="${SKIN}" ${OUTLINE}/>`;
  const foot2 = `<path d="M24 40.2L32.6 40.6L33.4 42.4L23.4 42.4Z" fill="${SKIN}" ${OUTLINE}/>`;
  const headAt2 = asleep ? "translate(-1.6 20.2)" : `translate(0 ${drop})`;
  return DEFS2 + shadow(19) + at(
    `translate(0 ${drop})`,
    `<path d="${BODY2}" fill="${SKIN}" ${OUTLINE}/><path d="${UNDER}" fill="${BELLY2}"/>` + STRIPES
  ) + at(headAt2, head({ eye: asleep ? "closed" : "open" })) + foot2 + thigh + (asleep ? snore(40, 20) : "");
}
var STOMP = [
  { lift: [2, 0], bob: 0 },
  { lift: [0, 0], bob: 0.8 },
  { lift: [0, 2], bob: 0 },
  { lift: [0, 0], bob: 0.8 }
];
var columnLeg = (x, lift) => `<ellipse cx="${x}" cy="31" rx="4.2" ry="5.2" fill="${SKIN}" ${OUTLINE}/><path d="M${x - 1.6} 34.6L${x + 1.6} 34.6L${x + 1.4} ${40.6 - lift}L${x - 1.4} ${40.6 - lift}Z" fill="${SKIN}" ${OUTLINE}/><ellipse cx="${x}" cy="${41.4 - lift}" rx="3.2" ry="1.2" fill="${SKIN}" ${OUTLINE}/>`;
function front4(step) {
  const { lift, bob } = STOMP[step];
  const teeth = [20.4, 22.4, 24.4, 26.4].map(
    (x) => `<path d="M${x} 18.6l.6 1.1l.6 -1.1z" fill="${TOOTH}" stroke="${LINE3}" stroke-width=".2"/>`
  ).join("");
  const eye2 = (x) => `<circle cx="${x}" cy="11.8" r="1.1" fill="${EYE2}" stroke="${LINE3}" stroke-width=".3"/><ellipse cx="${x}" cy="11.8" rx=".3" ry=".9" fill="${PUPIL}"/>`;
  const tinyArm = (x, dir) => `<path d="M${x} 25q${dir * 1.6} 1.4 ${dir * 1.2} 3" stroke="${LINE3}" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M${x} 25q${dir * 1.6} 1.4 ${dir * 1.2} 3" stroke="#6b9a48" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  const body2 = `<ellipse cx="24" cy="26" rx="8.4" ry="7.4" fill="${SKIN}" ${OUTLINE}/><ellipse cx="24" cy="27.6" rx="5" ry="5" fill="${BELLY2}"/><ellipse cx="24" cy="13" rx="7.6" ry="6.2" fill="${SKIN}" ${OUTLINE}/><ellipse cx="24" cy="16.6" rx="5" ry="3.4" fill="${SKIN}" ${OUTLINE}/><path d="M19.6 18.6q4.4 1.6 8.8 0" stroke="${LINE3}" stroke-width=".6" fill="none"/>` + teeth + `<path d="M19.4 19.2q4.6 2.8 9.2 0q-1 2.4 -4.6 2.6q-3.6 -.2 -4.6 -2.6z" fill="${BELLY2}" ${OUTLINE}/><path d="M16.6 10.4q2 -1.4 3.6 -.2M27.8 10.2q1.6 -1.2 3.6 .2" stroke="${LINE3}" stroke-width=".7" fill="none" stroke-linecap="round"/>` + eye2(18.2) + eye2(29.8) + `<ellipse cx="22.6" cy="15.4" rx=".45" ry=".35" fill="${LINE3}"/><ellipse cx="25.4" cy="15.4" rx=".45" ry=".35" fill="${LINE3}"/>` + tinyArm(19.4, -1) + tinyArm(28.6, 1);
  return DEFS2 + shadow(13) + columnLeg(18.4, lift[0]) + columnLeg(29.6, lift[1]) + at(bob ? `translate(0 ${-bob})` : "", body2);
}
function behind4(step) {
  const { lift, bob } = STOMP[step];
  const sway = [0, 2.4, 0, -2.4][step];
  const tail4 = `M19 27C20 33 22.6 39 ${24 + sway} 43.4C25.4 39 28 33 29 27Z`;
  const stripes = [20, 24, 28].map(
    (y) => `<path d="M18.6 ${y}q5.4 -2 10.8 0" stroke="${STRIPE}" stroke-width="1" fill="none" opacity=".7"/>`
  ).join("");
  const body2 = `<ellipse cx="24" cy="13.6" rx="7" ry="5.8" fill="${SKIN}" ${OUTLINE}/><ellipse cx="24" cy="25" rx="8.4" ry="7.6" fill="${SKIN}" ${OUTLINE}/>` + stripes;
  return DEFS2 + shadow(13) + columnLeg(18.4, lift[0]) + columnLeg(29.6, lift[1]) + at(bob ? `translate(0 ${-bob})` : "", body2) + `<path d="${tail4}" fill="${SKIN}" ${OUTLINE}/>`;
}
var trex = {
  id: "trex",
  label: "setting-character-trex",
  name: "Rumble",
  // A heavy, deliberate walker: a little slower than the dogs.
  speed: 36,
  bubbles: { play: "bubble-roar" },
  // No `sounds`: the roar is only a bubble, whatever the Bark setting says.
  poses: () => ({
    idle: still(standing3()),
    blink: still(standing3({ eye: "closed" })),
    sit: still(lying2()),
    walk: sprite(
      4,
      6,
      (i) => standing3({
        near: [14, 0, -14, 0][i],
        far: [-14, 0, 14, 0][i],
        bob: [0, 0.9, 0, 0.9][i],
        tilt: [0, 1.5, 0, 1.5][i]
      })
    ),
    walkDown: sprite(4, 6, front4),
    walkUp: sprite(4, 6, behind4),
    happy: sprite(
      2,
      6,
      (i) => standing3({ tilt: -12, jaw: i ? 32 : 20, wave: i ? -40 : 20, shift: 1.6 })
    ),
    sleep: still(lying2({ asleep: true }))
  })
};

// src/characters/tessa.js
var COLORS = ["#5eead4", "#a78bfa", "#fbbf24", "#fb7185"];
var INK3 = "#1f2937";
function body(pose, step = 0) {
  const sleep = pose === "sleep";
  const gap = sleep ? 0 : 2;
  const top = sleep ? 16 : 9;
  const s = 15;
  const at3 = [
    [24 - s - gap / 2, top],
    [24 + gap / 2, top],
    [24 - s - gap / 2, top + s + gap],
    [24 + gap / 2, top + s + gap]
  ];
  const tiles = at3.map(
    ([x, y], i) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" fill="${COLORS[i]}"/>`
  ).join("");
  const eyeY = top + 8;
  const ex = [24 - 8.5, 24 + 8.5];
  let eyes;
  if (pose === "back") {
    eyes = "";
  } else if (sleep || pose === "blink") {
    eyes = ex.map(
      (x) => `<path d="M${x - 2.5} ${eyeY}h5" stroke="${INK3}" stroke-width="1.6" stroke-linecap="round"/>`
    ).join("");
  } else if (pose === "happy") {
    eyes = ex.map(
      (x) => `<path d="M${x - 2.5} ${eyeY + 1}q2.5 -3.5 5 0" fill="none" stroke="${INK3}" stroke-width="1.6" stroke-linecap="round"/>`
    ).join("");
    eyes += ex.map((x) => `<circle cx="${x}" cy="${eyeY + 5}" r="1.8" fill="#f9a8d4" opacity=".8"/>`).join("");
  } else {
    eyes = ex.map((x) => `<circle cx="${x}" cy="${eyeY}" r="2.3" fill="${INK3}"/>`).join("");
  }
  const footY = top + 2 * s + gap;
  const stepping = pose === "walk" || pose === "back";
  const lift = stepping ? step ? [0, 2] : [2, 0] : [0, 0];
  const feet = sleep ? "" : [15, 29].map(
    (x, i) => `<rect x="${x}" y="${footY - lift[i]}" width="5" height="4" rx="2" fill="${INK3}" opacity=".75"/>`
  ).join("");
  return shadow(sleep ? 15 : 13) + tiles + eyes + feet + (sleep ? snore(38, 12) : "");
}
var tessa = {
  id: "tessa",
  label: "setting-character-tessa",
  name: "Tessa",
  speed: 40,
  bubbles: {},
  poses: () => ({
    idle: still(body("idle")),
    blink: still(body("blink")),
    walk: sprite(2, 6, (i) => body("walk", i)),
    walkUp: sprite(2, 6, (i) => body("back", i)),
    happy: still(body("happy")),
    sleep: still(body("sleep"))
  })
};

// src/characters/volta.js
var LINE4 = "#34507f";
var INNER_EAR = "#3b82f6";
var CREAM2 = "#fff7e8";
var EYE3 = "#1e1b4b";
var EYE_LIGHT = "#ffffff";
var CHEEK = "#5ef0ff";
var MOUTH2 = "#f472b6";
var BOLT = "#fde047";
var ARC = "#22d3ee";
var BOLT_EDGE = "#b45309";
var SPARK_EDGE = "#0ea5e9";
var DEFS3 = '<defs><radialGradient id="vFur" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#e6f2ff"/><stop offset=".6" stop-color="#b4d6fb"/><stop offset="1" stop-color="#7fb0ea"/></radialGradient><linearGradient id="vTail" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7fb0ea"/><stop offset=".65" stop-color="#cfe6ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient><filter id="vGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation=".9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
var OUTLINE2 = `stroke="${LINE4}" stroke-width=".8" stroke-linejoin="round"`;
var at2 = (transform, inner) => transform ? `<g transform="${transform}">${inner}</g>` : inner;
var bolt = (x, y, scale = 1, angle = 0) => at2(
  `translate(${x} ${y}) rotate(${angle}) scale(${scale})`,
  `<path d="M1.8 -4.6L-2.4 0.6H-0.2L-1.8 4.6L2.6 -1H0.4Z" fill="${BOLT}" stroke="${BOLT_EDGE}" stroke-width=".55" stroke-linejoin="round" filter="url(#vGlow)"/>`
);
var spark = (x, y, r = 1.6) => {
  const k = r * 0.28;
  return `<path d="M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z" fill="${EYE_LIGHT}" stroke="${SPARK_EDGE}" stroke-width=".3" filter="url(#vGlow)"/>`;
};
var arc = (points) => {
  const pts = points.map((p) => p.join(",")).join(" ");
  return `<polyline points="${pts}" fill="none" stroke="${ARC}" stroke-width="1" stroke-linejoin="bevel" filter="url(#vGlow)"/><polyline points="${pts}" fill="none" stroke="${EYE_LIGHT}" stroke-width=".35" stroke-linejoin="bevel"/>`;
};
var cheek = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${CHEEK}" opacity=".85" filter="url(#vGlow)"/>`;
var eyeOpen = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${EYE3}"/><circle cx="${x + rx * 0.3}" cy="${y - ry * 0.38}" r="${rx * 0.42}" fill="${EYE_LIGHT}"/><circle cx="${x - rx * 0.32}" cy="${y + ry * 0.4}" r="${rx * 0.2}" fill="${EYE_LIGHT}"/>`;
function eye(state, x, y, rx, ry) {
  if (state === "open") return eyeOpen(x, y, rx, ry);
  const w = rx * 1.1;
  const bend = { happy: -ry * 0.9, closed: ry * 0.7, blink: ry * 0.25 }[state];
  return `<path d="M${x - w} ${y}q${w} ${bend} ${2 * w} 0" stroke="${EYE3}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
}
function sideHead({ eyes = "open", open = false, ears = 0 } = {}) {
  const backEar = "M19.6 11.4C17.2 7.6 15.8 4 15.6 0.9C19.6 2.4 22.6 5.2 24.4 8.2Z";
  const backInner = "M19.8 9.4C18.6 7 17.8 5 17.6 3.2C19.8 4.4 21.4 6 22.4 7.8Z";
  const frontEar = "M28.2 7C30.4 4.4 33.2 2 36.4 1C36.6 4.4 35.8 8 34.2 10.6Z";
  const frontInner = "M30 6.6C31.6 4.8 33.2 3.6 35 3C35 5 34.6 7 33.6 8.6Z";
  const mouth = open ? `<path d="M32.8 21.6q1.7 3 3.4 0z" fill="${MOUTH2}" stroke="${EYE3}" stroke-width=".55" stroke-linejoin="round"/>` : `<path d="M32.8 21.8q.85 .9 1.7 0q.85 .9 1.7 0" stroke="${EYE3}" stroke-width=".55" fill="none" stroke-linecap="round"/>`;
  return at2(
    ears ? `rotate(${-ears} 22 9)` : "",
    `<path d="${backEar}" fill="url(#vFur)" ${OUTLINE2}/><path d="${backInner}" fill="${INNER_EAR}"/>`
  ) + `<circle cx="27" cy="16.5" r="10.2" fill="url(#vFur)" ${OUTLINE2}/>` + at2(
    ears ? `rotate(${ears} 31 9)` : "",
    `<path d="${frontEar}" fill="url(#vFur)" ${OUTLINE2}/><path d="${frontInner}" fill="${INNER_EAR}"/>`
  ) + `<ellipse cx="33.8" cy="20.8" rx="3.4" ry="2.5" fill="${CREAM2}"/>` + eye(eyes, 28.8, 16.2, 2.3, 2.9) + eye(eyes, 34.4, 16.4, 1.7, 2.6) + `<circle cx="36.9" cy="19.6" r=".8" fill="${EYE3}"/>` + mouth + cheek(24.8, 21, 2);
}
var headAt = (x, y, scale, inner) => at2(`translate(${x} ${y}) scale(${scale}) translate(-27 -16.5)`, inner);
function tail3(sway = 0) {
  const d = "M17.5 35C11 36 5.5 31 6 24C6.4 18.5 10.5 15.5 13.5 17C11.5 20 12 25 15.5 28.5C17 30 18.5 31.6 19 33.4Z";
  return at2(
    sway ? `rotate(${sway} 17.5 35)` : "",
    `<path d="${d}" fill="url(#vTail)" ${OUTLINE2}/>`
  );
}
function standing4({
  bob = 0,
  step = [0, 0],
  sway = 0,
  armsUp = false,
  eyes = "open",
  open = false,
  charge = ""
} = {}) {
  const arm2 = "M29.4 28.4q3 1 3.6 3.6q-1.2 .8 -2.6 -.4z";
  const body2 = tail3(sway) + `<ellipse cx="24.5" cy="32.5" rx="8.6" ry="8.8" fill="url(#vFur)" ${OUTLINE2}/><ellipse cx="27.2" cy="34" rx="4.8" ry="5.8" fill="${CREAM2}"/>` + // A paw at her side sits in front of her tummy; raised, it waves in
  // front of her chin, so it is drawn after the head.
  (armsUp ? "" : `<path d="${arm2}" fill="url(#vFur)" ${OUTLINE2}/>`) + sideHead({ eyes, open }) + (armsUp ? at2("rotate(-75 29.8 28.8)", `<path d="${arm2}" fill="url(#vFur)" ${OUTLINE2}/>`) : "");
  const feet = `<ellipse cx="20.5" cy="${41.6 - step[0]}" rx="3" ry="1.5" fill="url(#vFur)" ${OUTLINE2}/><ellipse cx="29.4" cy="${41.6 - step[1]}" rx="3.2" ry="1.5" fill="url(#vFur)" ${OUTLINE2}/>`;
  return DEFS3 + shadow(12) + feet + at2(bob ? `translate(0 ${-bob})` : "", body2) + charge;
}
function sitting3() {
  const wrap = "M17 38.4C10.6 38.6 8 42.6 13 43.2C19 43.8 30 43.6 35.6 42.4C37.4 42 37.2 40.4 35.2 40.4C30 41 23 40.4 17 38.4Z";
  return DEFS3 + shadow(13) + `<ellipse cx="23.6" cy="35" rx="9" ry="7" fill="url(#vFur)" ${OUTLINE2}/><ellipse cx="26.6" cy="36" rx="4.8" ry="5" fill="${CREAM2}"/><path d="M28.6 31.6q2.6 2 2.6 5.4q-1.4 .6 -2.4 -.8z" fill="url(#vFur)" ${OUTLINE2}/><path d="${wrap}" fill="url(#vTail)" ${OUTLINE2}/>` + headAt(27, 19.6, 1, sideHead()) + spark(36.6, 40.6, 1.5);
}
function sleeping3() {
  const curl = "M10 40C7.6 34 11 28.6 16.6 28C14 31.6 14.4 36.4 18.4 39.6C24 43.4 33 42.6 38.6 40.4C37.8 43 33 44.2 24 44.2C16 44.2 11.4 43 10 40Z";
  return DEFS3 + shadow(16) + `<ellipse cx="24" cy="36.4" rx="11.4" ry="6.6" fill="url(#vFur)" ${OUTLINE2}/>` + headAt(31, 32.4, 0.78, sideHead({ eyes: "closed", ears: 28 })) + `<path d="${curl}" fill="url(#vTail)" ${OUTLINE2}/>` + spark(13, 26, 1.2) + snore(37, 16);
}
function frontHead() {
  const ear = "M16.4 10.6C14.4 7.4 13.4 4 13.6 0.8C17.2 2.2 20 4.6 21.6 7.6Z";
  const inner = "M16.8 8.6C15.8 6.6 15.4 4.8 15.4 3.2C17.4 4.2 19 5.6 20 7.2Z";
  const mirror2 = (s) => `<g transform="matrix(-1 0 0 1 48 0)">${s}</g>`;
  const one = `<path d="${ear}" fill="url(#vFur)" ${OUTLINE2}/><path d="${inner}" fill="${INNER_EAR}"/>`;
  return one + mirror2(one) + `<circle cx="24" cy="16.5" r="10.2" fill="url(#vFur)" ${OUTLINE2}/><ellipse cx="24" cy="21.2" rx="3.6" ry="2.6" fill="${CREAM2}"/>` + eyeOpen(20, 16.4, 2.2, 2.8) + eyeOpen(28, 16.4, 2.2, 2.8) + `<circle cx="24" cy="19.8" r=".8" fill="${EYE3}"/><path d="M22.3 21.4q.85 .9 1.7 0q.85 .9 1.7 0" stroke="${EYE3}" stroke-width=".55" fill="none" stroke-linecap="round"/>` + cheek(16.4, 21, 1.9) + cheek(31.6, 21, 1.9);
}
function backHead() {
  const ear = "M16.4 10.6C14.4 7.4 13.4 4 13.6 0.8C17.2 2.2 20 4.6 21.6 7.6Z";
  const one = `<path d="${ear}" fill="url(#vFur)" ${OUTLINE2}/>`;
  return one + `<g transform="matrix(-1 0 0 1 48 0)">${one}</g><circle cx="24" cy="16.5" r="10.2" fill="url(#vFur)" ${OUTLINE2}/>`;
}
var TROT = [
  { bob: 0, step: [1.4, 0] },
  { bob: 0.8, step: [0, 0] },
  { bob: 0, step: [0, 1.4] },
  { bob: 0.8, step: [0, 0] }
];
var TRAIL = [
  [spark(7.6, 17.6, 1.4)],
  [spark(5, 21, 1)],
  [spark(9.4, 15.4, 1.1), spark(4.6, 19, 0.8)],
  [spark(6.4, 16.2, 1.5)]
];
function front5(step) {
  const { bob, step: lift } = TROT[step];
  const arm2 = "M16.4 29q-2.8 1.2 -3 3.8q1.4 .6 2.6 -.8z";
  const body2 = (
    // The tail peeks out behind her on one side.
    `<path d="M30 36C35 36 38.6 31 38 25C37.6 21.6 35.6 20 34 21C35 24 34.6 29 30.6 32Z" fill="url(#vTail)" ${OUTLINE2}/><ellipse cx="24" cy="32.5" rx="8.6" ry="8.8" fill="url(#vFur)" ${OUTLINE2}/><ellipse cx="24" cy="34.2" rx="5.2" ry="5.8" fill="${CREAM2}"/><path d="${arm2}" fill="url(#vFur)" ${OUTLINE2}/><g transform="matrix(-1 0 0 1 48 0)"><path d="${arm2}" fill="url(#vFur)" ${OUTLINE2}/></g>` + frontHead()
  );
  return DEFS3 + shadow(11) + `<ellipse cx="20" cy="${41.6 - lift[0]}" rx="2.8" ry="1.5" fill="url(#vFur)" ${OUTLINE2}/><ellipse cx="28" cy="${41.6 - lift[1]}" rx="2.8" ry="1.5" fill="url(#vFur)" ${OUTLINE2}/>` + at2(bob ? `translate(0 ${-bob})` : "", body2);
}
function behind5(step) {
  const { bob, step: lift } = TROT[step];
  const sway = [0, 4, 0, -4][step];
  const plume = "M24 39C19.4 37.6 17.4 32 18.6 26.4C19.6 21.8 22.4 19.4 24 19C25.6 19.4 28.4 21.8 29.4 26.4C30.6 32 28.6 37.6 24 39Z";
  const body2 = backHead() + `<ellipse cx="24" cy="32.5" rx="8.6" ry="8.8" fill="url(#vFur)" ${OUTLINE2}/>` + at2(
    `rotate(${sway} 24 39)`,
    `<path d="${plume}" fill="url(#vTail)" ${OUTLINE2}/>` + spark(24, 20.4, 1.3)
  );
  return DEFS3 + shadow(11) + `<ellipse cx="20" cy="${41.8 - lift[0]}" rx="2.6" ry="1.3" fill="url(#vFur)" ${OUTLINE2}/><ellipse cx="28" cy="${41.8 - lift[1]}" rx="2.6" ry="1.3" fill="url(#vFur)" ${OUTLINE2}/>` + at2(bob ? `translate(0 ${-bob})` : "", body2);
}
var CRACKLE = [
  bolt(6, 12, 1, -18) + bolt(42.4, 30, 0.85, 20) + arc([
    [36, 6],
    [38.6, 8.4],
    [37.2, 10],
    [40.4, 12.6]
  ]) + spark(10, 34, 1.3),
  bolt(42, 9, 1.05, 16) + bolt(5.6, 30, 0.9, -24) + arc([
    [9, 20],
    [6.6, 22],
    [8.4, 23.4],
    [5.6, 26]
  ]) + spark(39.6, 37, 1.2),
  bolt(7.6, 21, 0.95, -8) + bolt(41.4, 20, 1, 12) + arc([
    [20, 3.4],
    [22.4, 1.6],
    [24, 3.6],
    [26.6, 1.8]
  ]) + spark(5, 8, 1.1) + spark(43, 38, 1)
];
var volta = {
  id: "volta",
  label: "setting-character-volta",
  name: "Volta",
  speed: 44,
  bubbles: { play: "bubble-zap" },
  // No `sounds`: she stays quiet whatever the Bark setting says.
  poses: () => ({
    idle: still(standing4({ charge: spark(7.2, 17.4, 1.1) })),
    blink: still(standing4({ eyes: "blink", charge: spark(7.2, 17.4, 1.1) })),
    sit: still(sitting3()),
    walk: sprite(
      4,
      8,
      (i) => standing4({ ...TROT[i], sway: [0, 5, 0, -5][i], charge: TRAIL[i].join("") })
    ),
    walkDown: sprite(4, 8, front5),
    walkUp: sprite(4, 8, behind5),
    happy: sprite(
      3,
      10,
      (i) => standing4({
        eyes: "happy",
        open: true,
        armsUp: true,
        bob: i === 1 ? 1.2 : 0,
        sway: [-6, 6, 0][i],
        charge: CRACKLE[i]
      })
    ),
    sleep: still(sleeping3())
  })
};

// src/characters/index.js
var CHARACTERS = [tessa, poodle, terrier, penguin, volta, trex];
var DEFAULT_CHARACTER = tessa.id;
var drawn = /* @__PURE__ */ new Map();
function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) ?? tessa;
}
function posesOf(character) {
  if (!drawn.has(character.id)) drawn.set(character.id, character.poses());
  return drawn.get(character.id);
}

// src/pet.js
function runPet(tf) {
  const pet = { x: 0, y: 0, flip: false, state: "off", asleep: false, pane: null };
  let move = null;
  let layout = null;
  let timer = null;
  let bubbleTimer = null;
  let blurTimer = null;
  let paused = false;
  let idleMinutes = 0;
  const rand = (min, max) => min + Math.random() * (max - min);
  const character = () => characterById(tf.settings.get("character"));
  const size = () => {
    const n = Math.round(Number(tf.settings.get("size")));
    return Number.isFinite(n) ? Math.min(96, Math.max(24, n)) : 48;
  };
  const name = () => String(tf.settings.get("name") || "").trim().slice(0, 24) || character().name;
  const chatty = () => tf.settings.get("speech") !== false;
  const roams = () => tf.settings.get("roam") !== "floor";
  const bubble = (moment, key) => character().bubbles[moment] ?? key;
  const homePane = () => layout && (layout.panes.find((p) => p.focused) || layout.panes[0]) || null;
  const floorOf = (pane) => {
    const sz = size();
    if (!pane) {
      const w = layout ? layout.content.w : 800;
      const h = layout ? layout.content.h : 600;
      return { y: h - sz - 30, min: 8, max: Math.max(8, w - sz - 8) };
    }
    const bottom = pane.composer ? pane.composer.y : pane.y + pane.h;
    return {
      y: bottom - sz - 2,
      min: pane.x + 8,
      max: Math.max(pane.x + 8, pane.x + pane.w - sz - 8)
    };
  };
  const currentPane = () => roams() && layout && layout.panes.find((p) => p.id === pet.pane) || homePane();
  const areaOf = (pane) => {
    const f = floorOf(pane);
    const top = roams() ? pane ? pane.y + 8 : 8 : f.y;
    return { minX: f.min, maxX: f.max, minY: Math.min(top, f.y), maxY: f.y };
  };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const settle = () => {
    if (!move) return;
    const t = move.ms > 0 ? clamp((Date.now() - move.start) / move.ms, 0, 1) : 1;
    pet.x = move.fromX + (pet.x - move.fromX) * t;
    pet.y = move.fromY + (pet.y - move.fromY) * t;
    move = null;
  };
  const paneAt = (x, y) => layout && layout.panes.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) || null;
  const draw = (pose, extra = {}) => {
    const sz = size();
    const poses = posesOf(character());
    const art = poses[pose] ?? poses.idle;
    const item = {
      id: "pet",
      image: art.image,
      sheet: art.sheet,
      x: Math.round(pet.x),
      y: Math.round(pet.y),
      w: sz,
      h: sz,
      flip: pet.flip,
      anim: pose === "sleep" || pose === "idle" ? "breathe" : "none",
      moveMs: 0,
      hit: true,
      cursor: "grab",
      label: name(),
      ...extra
    };
    return tf.overlay.update({ items: [item] }).catch(() => {
    });
  };
  const say = (key, args = {}) => {
    if (!chatty()) return Promise.resolve();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(
      () => void tf.overlay.update({ items: [{ id: "pet", bubble: null }] }).catch(() => {
      }),
      4e3
    );
    return tf.overlay.update({ items: [{ id: "pet", bubble: tf.t(key, { name: name(), ...args }) }] }).catch(() => {
    });
  };
  const later = (ms, next) => {
    clearTimeout(timer);
    timer = paused ? null : setTimeout(() => void next(), ms);
  };
  let revived = false;
  const revive = async () => {
    if (revived || pet.state !== "off") return;
    revived = true;
    if (await tf.store.get("visible") !== false) await appear();
  };
  const background = (fn) => (e) => {
    void (async () => {
      await revive();
      await fn(e);
    })().catch((err) => void tf.log.error(String(err && err.message || err)).catch(() => {
    }));
  };
  const idle = async () => {
    pet.state = "idle";
    await draw("idle");
    later(rand(4e3, 12e3), choose);
  };
  const walk = async (toX, toY, pane = currentPane()) => {
    settle();
    const a = areaOf(pane);
    const x = Math.round(clamp(toX ?? rand(a.minX, a.maxX), a.minX, a.maxX));
    const y = Math.round(clamp(toY ?? rand(a.minY, a.maxY), a.minY, a.maxY));
    const dx = x - pet.x;
    const dy = y - pet.y;
    const pace = character().speed * size() / 48;
    const ms = Math.min(2e4, Math.max(400, Math.hypot(dx, dy) / pace * 1e3));
    const poses = posesOf(character());
    let pose = "walk";
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0 && poses.walkUp) pose = "walkUp";
      if (dy > 0 && poses.walkDown) pose = "walkDown";
    }
    if (pose === "walk" && Math.abs(dx) >= 1) pet.flip = dx < 0;
    pet.state = "walk";
    move = { fromX: pet.x, fromY: pet.y, start: Date.now(), ms };
    pet.x = x;
    pet.y = y;
    pet.pane = pane ? pane.id : null;
    await draw(pose, { moveMs: ms });
    later(ms, idle);
  };
  const wander = () => {
    const others = layout ? layout.panes.filter((p) => p.id !== pet.pane) : [];
    if (!roams() || !others.length || Math.random() >= 0.2) return walk();
    return walk(void 0, void 0, others[Math.floor(Math.random() * others.length)]);
  };
  const sit = async () => {
    pet.state = "sit";
    if (posesOf(character()).sit) {
      await draw("sit", { anim: "breathe" });
    } else {
      await draw("blink");
      setTimeout(() => {
        if (pet.state === "sit") void draw("idle");
      }, 300);
    }
    later(rand(6e3, 2e4), choose);
  };
  const choose = () => {
    if (pet.asleep) return nap();
    const r = Math.random();
    if (r < 0.5) return wander();
    if (r < 0.8) return sit();
    return idle();
  };
  const nap = async () => {
    clearTimeout(timer);
    settle();
    pet.asleep = true;
    pet.state = "sleep";
    await draw("sleep");
  };
  const wake = async (greet) => {
    pet.asleep = false;
    await draw("happy", { anim: "bob" });
    if (greet) {
      bark2(2);
      await say("bubble-welcome");
    }
    later(1500, idle);
  };
  const place = () => {
    const pane = currentPane();
    const a = areaOf(pane);
    if (!(roams() && pet.y >= a.minY && pet.y <= a.maxY)) pet.y = a.maxY;
    pet.x = clamp(pet.x || rand(a.minX, a.maxX), a.minX, a.maxX);
    pet.pane = pane ? pane.id : null;
  };
  const barkClips = /* @__PURE__ */ new Map();
  const bark2 = (count) => {
    const c = character();
    if (tf.settings.get("bark") === false || !c.sounds || !c.sounds.bark) return;
    const key = `${c.id}:${count}`;
    if (!barkClips.has(key)) barkClips.set(key, c.sounds.bark(count));
    void tf.sound.play({ src: barkClips.get(key), volume: 0.5 }).catch(() => {
    });
  };
  const appear = async () => {
    layout = await tf.overlay.layout();
    place();
    const shown = await tf.overlay.show({ items: [] });
    pet.state = "idle";
    await draw("idle");
    await tf.store.set("visible", true);
    if (shown) later(1500, choose);
  };
  const vanish = async () => {
    clearTimeout(timer);
    settle();
    pet.state = "off";
    await tf.overlay.hide();
    await tf.store.set("visible", false);
  };
  tf.command(tf.t("cmd-toggle"), async () => pet.state === "off" ? appear() : vanish(), {
    id: "toggle"
  });
  tf.command(
    tf.t("cmd-call"),
    async () => {
      if (pet.state === "off") await appear();
      if (pet.asleep) await wake(false);
      const pane = homePane();
      const f = floorOf(pane);
      await walk(pane ? pane.x + pane.w / 2 - size() / 2 : (f.min + f.max) / 2, f.y, pane);
    },
    { id: "call" }
  );
  tf.command(
    tf.t("cmd-nap"),
    async () => {
      if (pet.state === "off") await appear();
      return pet.asleep ? wake(false) : nap();
    },
    { id: "nap" }
  );
  tf.on(
    "app.ready",
    background(async () => {
    })
  );
  tf.on(
    "setting.changed",
    background(async (e) => {
      const key = e && e.key;
      if (key === "character") await tf.audit("character", { character: character().id });
      if (pet.state === "off" || pet.state === "held") return;
      if (!["character", "size", "name", "roam"].includes(key)) return;
      settle();
      place();
      if (pet.asleep) return void await draw("sleep");
      pet.state = "idle";
      await draw("idle");
      later(1500, choose);
    })
  );
  tf.on(
    "overlay.layout",
    background((next) => {
      layout = next;
      if (pet.state === "off" || pet.state === "held") return void 0;
      const a = areaOf(currentPane());
      const inside = pet.x >= a.minX && pet.x <= a.maxX && pet.y >= a.minY && pet.y <= a.maxY;
      if (inside && (roams() || Math.abs(pet.y - a.maxY) < 1)) return void 0;
      settle();
      place();
      return draw(pet.asleep ? "sleep" : "idle");
    })
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.item !== "pet" || pet.state === "off") return;
      const sz = size();
      if (e.type !== "drag" && e.type !== "drop") settle();
      if (e.type === "click") {
        if (pet.asleep) return wake(true);
        pet.state = "happy";
        bark2(1);
        await draw("happy", { anim: "bob" });
        await say(bubble("pat", "bubble-pat"));
        await tf.audit("pat", {});
        later(1500, idle);
      } else if (e.type === "dblclick") {
        pet.asleep = false;
        pet.state = "play";
        bark2(2);
        await draw("happy", { anim: "bounce" });
        await say(bubble("play", "bubble-play"));
        await tf.audit("play", {});
        later(2500, idle);
      } else if (e.type === "dragstart") {
        clearTimeout(timer);
        pet.state = "held";
        pet.asleep = false;
        await draw("happy", { anim: "shake" });
        await say(bubble("held", "bubble-held"));
      } else if (e.type === "drag" && pet.state === "held") {
        pet.x = e.x - sz / 2;
        pet.y = e.y - sz / 2;
        await draw("happy", { anim: "shake" });
      } else if (e.type === "drop" && pet.state === "held") {
        const pane = paneAt(e.x, e.y) || homePane();
        const a = areaOf(pane);
        pet.x = clamp(e.x - sz / 2, a.minX, a.maxX);
        pet.y = roams() ? clamp(e.y - sz / 2, a.minY, a.maxY) : a.maxY;
        pet.pane = pane ? pane.id : null;
        pet.state = "idle";
        await draw("idle", { moveMs: 300 });
        later(1500, choose);
      }
    })
  );
  tf.on(
    "overlay.hidden",
    background(() => {
      clearTimeout(timer);
    })
  );
  tf.on(
    "user.idle",
    background(async (e) => {
      idleMinutes = e && Number(e.minutes) ? Number(e.minutes) : idleMinutes;
      const after = Math.round(Number(tf.settings.get("sleepAfterIdle")));
      if (pet.state === "off" || pet.asleep) return;
      if (idleMinutes >= (Number.isFinite(after) && after >= 1 ? after : 5)) await nap();
    })
  );
  tf.on(
    "user.active",
    background(async () => {
      const away = idleMinutes;
      idleMinutes = 0;
      if (pet.state !== "off" && pet.asleep) await wake(away >= 30);
    })
  );
  tf.on(
    "window.blurred",
    background(() => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        paused = true;
        clearTimeout(timer);
      }, 6e4);
    })
  );
  tf.on(
    "window.focused",
    background(() => {
      clearTimeout(blurTimer);
      if (!paused) return void 0;
      paused = false;
      if (pet.state === "off" || pet.asleep || pet.state === "held") return void 0;
      return idle();
    })
  );
}

// src/main.js
var main_default = (tf) => {
  tf.setting("character", DEFAULT_CHARACTER, tf.t("setting-character"), {
    choices: CHARACTERS.map((c) => ({ value: c.id, label: tf.t(c.label) }))
  });
  tf.setting("roam", "pane", tf.t("setting-roam"), {
    choices: [
      { value: "pane", label: tf.t("setting-roam-pane") },
      { value: "floor", label: tf.t("setting-roam-floor") }
    ]
  });
  tf.setting("name", "", tf.t("setting-name"));
  tf.setting("size", 48, tf.t("setting-size"));
  tf.setting("speech", true, tf.t("setting-speech"));
  tf.setting("bark", true, tf.t("setting-bark"));
  tf.setting("sleepAfterIdle", 5, tf.t("setting-sleep-after"));
  runPet(tf);
};
export default main_default;
