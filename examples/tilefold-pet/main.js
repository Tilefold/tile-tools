/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet (example tile)
 *
 * A pet lives on top of your panes: Tessa, a small creature made of four
 * rounded tiles, Coco, a white poodle, or Biscuit, a scruffy terrier
 * (Settings → Tiles → Tilefold Pet → Character). It roams around your panes (or keeps to the bottom), naps
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
  const text = (at, s) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
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
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length + gap;
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
var puff = ([x, y, r], fill, grow = 0) => `<circle cx="${x}" cy="${y}" r="${r + grow}" fill="${fill}"/>`;
var leg = ([hx, hy, fx, fy], color, grow = 0) => `<path d="M${hx} ${hy}L${fx} ${fy}" stroke="${color}" stroke-width="${3 + grow * 2}" stroke-linecap="round"/><circle cx="${fx}" cy="${fy + 1.4}" r="${2.5 + grow}" fill="${color}"/>`;
function fluff(puffs, legs, fill) {
  const outline = puffs.map((p) => puff(p, LINE, 0.9)).join("") + legs.map((l) => leg(l, LINE, 0.9)).join("");
  const inside = legs.map((l) => leg(l, fill)).join("") + puffs.map((p) => puff(p, fill)).join("");
  return outline + inside;
}
function tail([bx, by], angle, length = 5.5) {
  const a = angle * Math.PI / 180;
  const tx = +(bx - Math.sin(a) * length).toFixed(1);
  const ty = +(by - Math.cos(a) * length).toFixed(1);
  const stalk = (color, width) => `<path d="M${bx} ${by}L${tx} ${ty}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  return stalk(LINE, 4.2) + puff([tx, ty - 1.2, 3.8], LINE, 0.9) + stalk(FUR, 2.4) + puff([tx, ty - 1.2, 3.8], FUR);
}
function face(dx, dy, { eye = "open", tongue = false, collar = true } = {}) {
  const at = (x, y) => `${x + dx} ${y + dy}`;
  const ear = fluff(
    [
      [33.8 + dx, 16.6 + dy, 2.9],
      [33.2 + dx, 19.8 + dy, 3.2],
      [33.7 + dx, 22.8 + dy, 2.6]
    ],
    [],
    SHADE
  );
  const band = collar ? `<path d="M${at(32.2, 21.6)}Q${at(35.6, 24.4)} ${at(39.4, 21.4)}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="${35.8 + dx}" cy="${24.6 + dy}" r="1.2" fill="${TAG}"/>` : "";
  let eyes;
  if (eye === "closed") {
    eyes = `<path d="M${at(37.6, 14.2)}q1.4 1.2 2.8 0" stroke="${INK}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  } else if (eye === "happy") {
    eyes = `<path d="M${at(37.6, 14.6)}q1.4 -1.6 2.8 0" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else if (eye === "blink") {
    eyes = `<path d="M${at(37.7, 14)}h2.6" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
  } else {
    eyes = `<circle cx="${39 + dx}" cy="${14 + dy}" r="1.35" fill="${INK}"/><circle cx="${39.45 + dx}" cy="${13.5 + dy}" r=".45" fill="${FUR}"/>`;
  }
  const nose = `<ellipse cx="${46 + dx}" cy="${16.6 + dy}" rx="1.4" ry="1.2" fill="${INK}"/>`;
  const mouth = tongue ? `<path d="M${at(42.4, 19.4)}q1 3.6 2.4 0z" fill="${TONGUE}" stroke="${INK}" stroke-width=".5"/>` : `<path d="M${at(42.6, 19.2)}q1.2 .8 2.4 0" stroke="${LINE}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
  return ear + band + eyes + nose + mouth;
}
var headPuffs = (dx, dy) => [
  [37 + dx, 15 + dy, 5.8],
  [35.8 + dx, 8.6 + dy, 4.4],
  [39.4 + dx, 9.6 + dy, 3.2],
  [42.6 + dx, 17.4 + dy, 3.3],
  [44.6 + dx, 16.8 + dy, 2.4]
];
function standing({ swing = 0, lift = 0, wag = 0, eye = "open", tongue = false } = {}) {
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
  return shadow(15) + fluff([], far, SHADE) + tail([11.4, 22.4 + y], 25 + wag) + fluff([...body2, ...headPuffs(0, y)], near, FUR) + face(0, y, { eye, tongue });
}
function sitting() {
  const body2 = [
    [14.6, 37.4, 5.6],
    [19.6, 34.4, 6.6],
    [26, 29.6, 6],
    [31.2, 24.4, 5.6]
  ];
  const front3 = [
    [29.6, 31, 29.6, 41],
    [33.6, 30, 33.6, 41]
  ];
  return shadow(14) + tail([10.6, 35], 20) + fluff([...body2, [20.6, 41.4, 3.4], ...headPuffs(0, 1)], front3, FUR) + face(0, 1);
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
function front(step) {
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
  const head = [
    [24, 17 + bob, 6.8],
    [24, 9.4 + bob, 4.8],
    [20.4, 10.8 + bob, 3.4],
    [27.6, 10.8 + bob, 3.4]
  ];
  const y = (v) => v + bob;
  return shadow(13) + fluff([], back, SHADE) + fluff([...body2, ...head], fore, FUR) + sideEar(16.6, y(15.4)) + sideEar(31.4, y(15.4)) + `<path d="M18.4 ${y(23.6)}Q24 ${y(27.6)} 29.6 ${y(23.6)}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="24" cy="${y(26.6)}" r="1.2" fill="${TAG}"/>` + puff([24, y(21.4), 3.4], LINE, 0.9) + puff([24, y(21.4), 3.4], FUR) + `<circle cx="20.9" cy="${y(16.4)}" r="1.35" fill="${INK}"/><circle cx="27.1" cy="${y(16.4)}" r="1.35" fill="${INK}"/><circle cx="21.3" cy="${y(15.9)}" r=".45" fill="${FUR}"/><circle cx="27.5" cy="${y(15.9)}" r=".45" fill="${FUR}"/><ellipse cx="24" cy="${y(20.2)}" rx="1.6" ry="1.2" fill="${INK}"/><path d="M22.6 ${y(22.6)}q1.4 1 2.8 0" stroke="${LINE}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
}
function behind(step) {
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
  const head = [
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
  return shadow(13) + fluff(head, [], FUR) + sideEar(17, 12.8 + bob) + sideEar(31, 12.8 + bob) + `<path d="M19.2 ${18.8 + bob}Q24 ${21.2 + bob} 28.8 ${18.8 + bob}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/>` + fluff([], far, SHADE) + // The tail's stalk goes behind the rump; only the pom shows above it.
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
    idle: still(standing()),
    blink: still(standing({ eye: "blink" })),
    sit: still(sitting()),
    walk: sprite(
      4,
      8,
      (i) => standing({ swing: [2.4, 0, -2.4, 0][i], lift: [0, 0.8, 0, 0.8][i], wag: [0, 6, 0, -6][i] })
    ),
    walkDown: sprite(4, 8, front),
    walkUp: sprite(4, 8, behind),
    happy: sprite(2, 8, (i) => standing({ eye: "happy", tongue: true, wag: i ? -18 : 18 })),
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
function shape(s, fill, outline) {
  const edge = outline ? ` stroke="${LINE2}" stroke-width="1.7" stroke-linejoin="round"` : "";
  if (s.e) {
    const [cx, cy, rx, ry] = s.e;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${edge}/>`;
  }
  if (s.p) return `<path d="${s.p}" fill="${fill}"${edge}/>`;
  const [x1, y1, x2, y2, w] = s.l;
  const width = outline ? w + 1.7 : w;
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${outline ? LINE2 : fill}" stroke-width="${width}" stroke-linecap="round"/>`;
}
function silhouette(shapes, fill) {
  return shapes.map((s) => shape(s, fill, true)).join("") + shapes.map((s) => shape(s, fill, false)).join("");
}
var tuft = (x, y, dx, dy, w = 1.6) => ({
  p: `M${x - w} ${y}L${x + dx} ${y + dy}L${x + w} ${y}Z`
});
var paw = (x, y) => ({ e: [x + 0.8, y + 0.6, 2.4, 1.5] });
function tail2(wag = 0, base = [11.5, 24]) {
  const a = wag * Math.PI / 180;
  const [bx, by] = base;
  const at = (dx, dy) => `${+(bx + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(1)} ${+(by + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(1)}`;
  return [
    {
      p: `M${at(0, -1.6)}Q${at(-7.6, -3)} ${at(-5.6, -11.4)}Q${at(-3, -10.6)} ${at(-2.4, -8.2)}Q${at(-3.2, -3.6)} ${at(2, 2)}Z`
    },
    { p: `M${at(-5.6, -11.4)}L${at(-6.4, -14.6)}L${at(-3.4, -10.4)}Z` },
    { p: `M${at(-6.6, -5.4)}L${at(-9.4, -5.6)}L${at(-6.4, -3.4)}Z` }
  ];
}
function profileHead(y, { eye = "open", tongue = false } = {}) {
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
  if (eye === "blink") {
    eyes = `<path d="M38.3 ${16.9 + y}h2.3" stroke="${INK2}" stroke-width="1" stroke-linecap="round"/>`;
  }
  if (eye === "happy") {
    eyes = `<path d="M38.3 ${17.2 + y}q1.15 -1.4 2.3 0" stroke="${INK2}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }
  const mouth = tongue ? `<path d="M42 ${21.6 + y}q1 3.4 2.2 0z" fill="${TONGUE2}" stroke="${LINE2}" stroke-width=".5"/>` : "";
  const top = `<path d="M35.5 ${6.4 + y}L36.4 ${13.4 + y}L38.8 ${13.2 + y}Z" fill="${PINK}"/>` + silhouette(light, LIGHT) + silhouette(muzzle, LIGHT) + eyes + `<path d="M38.2 ${15 + y}l2.2 -.4" stroke="${LINE2}" stroke-width=".7" stroke-linecap="round"/><ellipse cx="45.4" cy="${19.3 + y}" rx="1.35" ry="1.15" fill="${INK2}"/>` + mouth;
  return { coat, far, top };
}
function side({ swing = 0, lift = 0, wag = 0, eye = "open", tongue = false } = {}) {
  const y = -lift;
  const head = profileHead(y, { eye, tongue });
  const far = [
    ...head.far,
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
    ...head.coat,
    { l: [19.5, 30 + y, 19.5 + swing, 41.5, 3.2] },
    { l: [35, 30 + y, 35 - swing, 41.5, 3.2] },
    paw(19.5 + swing, 41.5),
    paw(35 - swing, 41.5)
  ];
  return shadow(15) + silhouette(far, SHADE2) + silhouette(coat, CREAM) + head.top;
}
function sitting2() {
  const head = profileHead(-1.6);
  const coat = [
    ...tail2(-35, [14, 39.6]),
    { e: [21, 35.4, 7.6, 6.6] },
    { e: [19.6, 41.4, 5, 1.9] },
    // The back, sloping from the haunch up to the chest.
    { p: "M14.6 33.4Q19.4 24.6 28.4 20.6L34.4 29.6Q30.4 38.8 22 41.2Z" },
    ...head.coat,
    { l: [31, 29, 31, 41.5, 3.2] },
    { l: [34.8, 29, 34.8, 41.5, 3.2] },
    paw(31, 41.5),
    paw(34.8, 41.5)
  ];
  return shadow(14) + silhouette(head.far, SHADE2) + silhouette(coat, CREAM) + head.top;
}
function front2(step) {
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
function behind2(step) {
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
    walkDown: sprite(4, 8, front2),
    walkUp: sprite(4, 8, behind2),
    happy: sprite(2, 8, (i) => side({ eye: "happy", tongue: true, wag: i ? -22 : 14 })),
    sleep: still(sleeping2())
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
  const at = [
    [24 - s - gap / 2, top],
    [24 + gap / 2, top],
    [24 - s - gap / 2, top + s + gap],
    [24 + gap / 2, top + s + gap]
  ];
  const tiles = at.map(
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

// src/characters/index.js
var CHARACTERS = [tessa, poodle, terrier];
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
      place();
      return draw(pet.asleep ? "sleep" : "idle");
    })
  );
  tf.on(
    "overlay.pointer",
    background(async (e) => {
      if (!e || e.item !== "pet" || pet.state === "off") return;
      const sz = size();
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
