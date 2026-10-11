/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — Biscuit, the scruffy terrier
 *
 * A small cream terrier mix with big upright ears (pink inside), wiry fur,
 * a white chest and muzzle with a little beard, slender legs and a bushy
 * tail that curls up. Seen from the side facing right (the overlay flips
 * it to walk left), from the front (one ear flopped over) and from behind.
 * It trots with four frames, sits, wags its tail when happy and lies down
 * to sleep, and barks a little lower than Coco. Drawn as SVG in code, with
 * one warm-brown outline around the whole silhouette.
 */
import { shadow, snore, sprite, still } from "../art.js";
import { barks } from "./bark.js";

const CREAM = "#f3e6c9";
const LIGHT = "#fcf8ee";
const SHADE = "#dfcca6";
const LINE = "#8a6e58";
const PINK = "#eba5a9";
const INK = "#2b211c";
const TONGUE = "#f47d8c";

/**
 * Shapes, each one of { e: [cx, cy, rx, ry] }, { p: "path d" } or
 * { l: [x1, y1, x2, y2, width] } (a round-ended stroke, for legs and tail).
 */
function shape(s, fill, outline) {
  const edge = outline ? ` stroke="${LINE}" stroke-width="1.7" stroke-linejoin="round"` : "";
  if (s.e) {
    const [cx, cy, rx, ry] = s.e;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${edge}/>`;
  }
  if (s.p) return `<path d="${s.p}" fill="${fill}"${edge}/>`;
  const [x1, y1, x2, y2, w] = s.l;
  const width = outline ? w + 1.7 : w;
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${outline ? LINE : fill}" stroke-width="${width}" stroke-linecap="round"/>`;
}

/** Shapes drawn as one silhouette: outlined together, so only the outer edge shows a line. */
function silhouette(shapes, fill) {
  return (
    shapes.map((s) => shape(s, fill, true)).join("") +
    shapes.map((s) => shape(s, fill, false)).join("")
  );
}

/** A jagged tuft of fur pointing from (x, y) by (dx, dy): a thin triangle. */
const tuft = (x, y, dx, dy, w = 1.6) => ({
  p: `M${x - w} ${y}L${x + dx} ${y + dy}L${x + w} ${y}Z`,
});

/** A small paw at the end of a leg. */
const paw = (x, y) => ({ e: [x + 0.8, y + 0.6, 2.4, 1.5] });

/**
 * The tail from the rump at `base`, turned by `wag` degrees: a bushy curl
 * up and back, ending in a tuft.
 */
function tail(wag = 0, base = [11.5, 24]) {
  const a = (wag * Math.PI) / 180;
  const [bx, by] = base;
  // Points relative to the base, before turning.
  const at = (dx, dy) =>
    `${+(bx + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(1)} ${+(by + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(1)}`;
  return [
    {
      p: `M${at(0, -1.6)}Q${at(-7.6, -3)} ${at(-5.6, -11.4)}Q${at(-3, -10.6)} ${at(-2.4, -8.2)}Q${at(-3.2, -3.6)} ${at(2, 2)}Z`,
    },
    { p: `M${at(-5.6, -11.4)}L${at(-6.4, -14.6)}L${at(-3.4, -10.4)}Z` },
    { p: `M${at(-6.6, -5.4)}L${at(-9.4, -5.6)}L${at(-6.4, -3.4)}Z` },
  ];
}

/**
 * The profile head, neck and chest, raised by `y`: shapes for the far side,
 * the coat and the white bib and muzzle, plus the face drawn on top.
 */
function profileHead(y, { eye = "open", tongue = false } = {}) {
  const coat = [
    {
      p: `M27 ${22.4 + y}Q31 ${18 + y} 34 ${15.6 + y}L40 ${19.4 + y}Q38.6 ${27 + y} 34 ${30.4 + y}L27 ${30 + y}Z`,
    },
    { e: [37.6, 17.6 + y, 5.3, 4.8] },
    // Big upright ear, slightly back.
    { p: `M34.2 ${15.2 + y}L35.4 ${3.6 + y}L40.2 ${14 + y}Z` },
  ];
  const far = [{ p: `M32.2 ${15.6 + y}L32 ${6.2 + y}L35.6 ${13.8 + y}Z` }];
  // The white bib down the front of the chest, and the bearded muzzle.
  const light = [
    {
      p: `M35.2 ${21.6 + y}Q39.2 ${23.4 + y} 37.6 ${27.6 + y}Q36 ${31.4 + y} 32.2 ${31 + y}Q34.4 ${26.4 + y} 35.2 ${21.6 + y}Z`,
    },
    tuft(33.6, 30.6 + y, -0.2, 2.6, 1.2),
    tuft(36, 29.6 + y, 0.4, 2.2, 1),
  ];
  const muzzle = [{ e: [42, 20 + y, 3.8, 2.6] }, tuft(41.4, 22.4 + y, -0.6, 2.4, 1.2)];
  let eyes = `<circle cx="39.4" cy="${16.8 + y}" r="1.15" fill="${INK}"/>`;
  if (eye === "blink") {
    eyes = `<path d="M38.3 ${16.9 + y}h2.3" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>`;
  }
  if (eye === "happy") {
    eyes = `<path d="M38.3 ${17.2 + y}q1.15 -1.4 2.3 0" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }
  const mouth = tongue
    ? `<path d="M42 ${21.6 + y}q1 3.4 2.2 0z" fill="${TONGUE}" stroke="${LINE}" stroke-width=".5"/>`
    : "";
  const top =
    `<path d="M35.5 ${6.4 + y}L36.4 ${13.4 + y}L38.8 ${13.2 + y}Z" fill="${PINK}"/>` +
    silhouette(light, LIGHT) +
    silhouette(muzzle, LIGHT) +
    eyes +
    `<path d="M38.2 ${15 + y}l2.2 -.4" stroke="${LINE}" stroke-width=".7" stroke-linecap="round"/>` +
    `<ellipse cx="45.4" cy="${19.3 + y}" rx="1.35" ry="1.15" fill="${INK}"/>` +
    mouth;
  return { coat, far, top };
}

/** Side view: legs by `swing`, body raised by `lift`, tail at `wag`, face by `eye`/`tongue`. */
function side({ swing = 0, lift = 0, wag = 0, eye = "open", tongue = false } = {}) {
  const y = -lift;
  const head = profileHead(y, { eye, tongue });
  const far = [
    ...head.far,
    { l: [16, 30 + y, 16 - swing, 41.5, 3] },
    { l: [32, 30 + y, 32 + swing, 41.5, 3] },
    paw(16 - swing, 41.5),
    paw(32 + swing, 41.5),
  ];
  const coat = [
    ...tail(wag, [11.5, 24 + y]),
    { e: [22, 26.5 + y, 11, 5.8] },
    tuft(16, 31.5 + y, 0.6, 3),
    tuft(21, 32 + y, 0.4, 3.2),
    tuft(26, 31.6 + y, -0.2, 3),
    ...head.coat,
    { l: [19.5, 30 + y, 19.5 + swing, 41.5, 3.2] },
    { l: [35, 30 + y, 35 - swing, 41.5, 3.2] },
    paw(19.5 + swing, 41.5),
    paw(35 - swing, 41.5),
  ];
  return shadow(15) + silhouette(far, SHADE) + silhouette(coat, CREAM) + head.top;
}

/** Sitting in profile: haunches on the ground, front legs straight, head up. */
function sitting() {
  const head = profileHead(-1.6);
  const coat = [
    ...tail(-35, [14, 39.6]),
    { e: [21, 35.4, 7.6, 6.6] },
    { e: [19.6, 41.4, 5, 1.9] },
    // The back, sloping from the haunch up to the chest.
    { p: "M14.6 33.4Q19.4 24.6 28.4 20.6L34.4 29.6Q30.4 38.8 22 41.2Z" },
    ...head.coat,
    { l: [31, 29, 31, 41.5, 3.2] },
    { l: [34.8, 29, 34.8, 41.5, 3.2] },
    paw(31, 41.5),
    paw(34.8, 41.5),
  ];
  return shadow(14) + silhouette(head.far, SHADE) + silhouette(coat, CREAM) + head.top;
}

/** Facing you (walking down): `step` 0–3 lifts the feet in turn. */
function front(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0],
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
    paw(26.6, 41.4 - lift[1]),
  ];
  const bib = [{ e: [24, y(29.6), 4.6, 5.6] }, tuft(24, y(34.6), 0, 3, 1.6)];
  const muzzle = [
    { e: [24, y(21.2), 4.2, 3.2] },
    tuft(22.4, y(23.6), -0.4, 2.2, 1.1),
    tuft(25.6, y(23.6), 0.4, 2.2, 1.1),
  ];
  return (
    shadow(12) +
    silhouette([...back, paw(16.2, 41), paw(30.2, 41)], SHADE) +
    silhouette(coat, CREAM) +
    `<path d="M29.2 ${y(12)}L32.8 ${y(4)}L31.6 ${y(12.8)}Z" fill="${PINK}"/>` +
    `<path d="M19.4 ${y(12.6)}L13.6 ${y(8)}L13 ${y(10.6)}Z" fill="${PINK}"/>` +
    silhouette(bib, LIGHT) +
    silhouette(muzzle, LIGHT) +
    `<circle cx="20.8" cy="${y(16.4)}" r="1.2" fill="${INK}"/><circle cx="27.2" cy="${y(16.4)}" r="1.2" fill="${INK}"/>` +
    `<path d="M19.8 ${y(14.2)}l2 .2M28.2 ${y(14.2)}l-2 .2" stroke="${LINE}" stroke-width=".7" stroke-linecap="round"/>` +
    `<ellipse cx="24" cy="${y(20.2)}" rx="1.6" ry="1.2" fill="${INK}"/>`
  );
}

/** From behind (walking up): ears and the curled tail over the rump. */
function behind(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0],
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
    paw(26.8, 41.4 - lift[1]),
  ];
  const tailUp = [
    {
      p: `M23 ${y(31)}Q${21 + wag} ${y(24)} ${25 + wag} ${y(20)}L${26.6 + wag} ${y(22.4)}Q${24 + wag} ${y(25.6)} 25.4 ${y(31)}Z`,
    },
    tuft(25.8 + wag, y(20.6), 1.6, -2.6, 1.2),
  ];
  return (
    shadow(12) +
    silhouette([...far, paw(17.2, 41), paw(29.2, 41)], SHADE) +
    silhouette(coat, CREAM) +
    silhouette(tailUp, CREAM)
  );
}

/** Lying down, chin on paws, ears relaxed, eyes closed. */
function sleeping() {
  const coat = [
    ...tail(-15, [12, 37.6]),
    { e: [21, 39.4, 12, 5.4] },
    tuft(14, 44.4, 0.2, 1.6, 1.4),
    { e: [36, 37.2, 5.4, 4.8] },
    { p: "M32 34.4L28.6 27.6L35.4 32.6Z" },
    { e: [39.4, 43.2, 4.6, 1.8] },
  ];
  return (
    shadow(19) +
    silhouette(coat, CREAM) +
    silhouette([{ e: [40.8, 39.6, 3.6, 2.5] }, tuft(40.4, 41.8, -0.4, 1.8, 1)], LIGHT) +
    `<path d="M36.4 36.6q1.2 1 2.4 0" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="44.2" cy="38.8" rx="1.3" ry="1.1" fill="${INK}"/>` +
    snore(40, 22)
  );
}

/** Biscuit, as Tilefold Pet's character list describes a character. */
export const terrier = {
  id: "terrier",
  label: "setting-character-terrier",
  name: "Biscuit",
  speed: 52,
  bubbles: { play: "bubble-woof" },
  sounds: { bark: (count) => barks(count, 660) },
  poses: () => ({
    idle: still(side()),
    blink: still(side({ eye: "blink" })),
    sit: still(sitting()),
    walk: sprite(4, 8, (i) =>
      side({ swing: [2.6, 0, -2.6, 0][i], lift: [0, 0.8, 0, 0.8][i], wag: [0, 8, 0, -8][i] }),
    ),
    walkDown: sprite(4, 8, front),
    walkUp: sprite(4, 8, behind),
    happy: sprite(2, 8, (i) => side({ eye: "happy", tongue: true, wag: i ? -22 : 14 })),
    sleep: still(sleeping()),
  }),
};
