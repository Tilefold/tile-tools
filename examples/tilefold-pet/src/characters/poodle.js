/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — Coco, the white poodle
 *
 * A small white poodle seen from the side, facing right (the overlay flips
 * her to walk left): fluffy puffs with a soft grey outline around the whole
 * silhouette, a topknot, a pom-pom tail, pom "bracelets" at her ankles, and
 * a teal collar with a gold tag. She trots with four frames, sits on her
 * haunches, wags her tail with her tongue out when happy, and lies down
 * curled up to sleep. Drawn as SVG in code.
 */
import { shadow, snore, sprite, still } from "../art.js";
import { barks } from "./bark.js";

const FUR = "#ffffff";
const SHADE = "#e6e8ef";
const LINE = "#aeb3c2";
const INK = "#1f2937";
const TONGUE = "#fb7185";
const COLLAR = "#2dd4bf";
const TAG = "#fbbf24";

/** A round puff of fur: [cx, cy, r]. */
const puff = ([x, y, r], fill, grow = 0) =>
  `<circle cx="${x}" cy="${y}" r="${r + grow}" fill="${fill}"/>`;

/** A leg: a line from hip to ankle, ending in a pom. */
const leg = ([hx, hy, fx, fy], color, grow = 0) =>
  `<path d="M${hx} ${hy}L${fx} ${fy}" stroke="${color}" stroke-width="${3 + grow * 2}" stroke-linecap="round"/>` +
  `<circle cx="${fx}" cy="${fy + 1.4}" r="${2.5 + grow}" fill="${color}"/>`;

/**
 * Shapes drawn as one silhouette: every shape first a little larger in the
 * outline colour, then all of them again in the fill, so only the outer
 * edge shows a line.
 */
function fluff(puffs, legs, fill) {
  const outline =
    puffs.map((p) => puff(p, LINE, 0.9)).join("") + legs.map((l) => leg(l, LINE, 0.9)).join("");
  const inside = legs.map((l) => leg(l, fill)).join("") + puffs.map((p) => puff(p, fill)).join("");
  return outline + inside;
}

/** The tail: a short stalk from `base` at `angle` degrees off upright, ending in a pom. */
function tail([bx, by], angle, length = 5.5) {
  const a = (angle * Math.PI) / 180;
  const tx = +(bx - Math.sin(a) * length).toFixed(1);
  const ty = +(by - Math.cos(a) * length).toFixed(1);
  const stalk = (color, width) =>
    `<path d="M${bx} ${by}L${tx} ${ty}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  return (
    stalk(LINE, 4.2) +
    puff([tx, ty - 1.2, 3.8], LINE, 0.9) +
    stalk(FUR, 2.4) +
    puff([tx, ty - 1.2, 3.8], FUR)
  );
}

/** Head details at an offset: ear, collar, eye, nose, and an open or closed mouth. */
function face(dx, dy, { eye = "open", tongue = false, collar = true } = {}) {
  const at = (x, y) => `${x + dx} ${y + dy}`;
  const ear = fluff(
    [
      [33.8 + dx, 16.6 + dy, 2.9],
      [33.2 + dx, 19.8 + dy, 3.2],
      [33.7 + dx, 22.8 + dy, 2.6],
    ],
    [],
    SHADE,
  );
  const band = collar
    ? `<path d="M${at(32.2, 21.6)}Q${at(35.6, 24.4)} ${at(39.4, 21.4)}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<circle cx="${35.8 + dx}" cy="${24.6 + dy}" r="1.2" fill="${TAG}"/>`
    : "";
  let eyes;
  if (eye === "closed") {
    eyes = `<path d="M${at(37.6, 14.2)}q1.4 1.2 2.8 0" stroke="${INK}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  } else if (eye === "happy") {
    eyes = `<path d="M${at(37.6, 14.6)}q1.4 -1.6 2.8 0" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  } else if (eye === "blink") {
    eyes = `<path d="M${at(37.7, 14)}h2.6" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
  } else {
    eyes =
      `<circle cx="${39 + dx}" cy="${14 + dy}" r="1.35" fill="${INK}"/>` +
      `<circle cx="${39.45 + dx}" cy="${13.5 + dy}" r=".45" fill="${FUR}"/>`;
  }
  const nose = `<ellipse cx="${46 + dx}" cy="${16.6 + dy}" rx="1.4" ry="1.2" fill="${INK}"/>`;
  const mouth = tongue
    ? `<path d="M${at(42.4, 19.4)}q1 3.6 2.4 0z" fill="${TONGUE}" stroke="${INK}" stroke-width=".5"/>`
    : `<path d="M${at(42.6, 19.2)}q1.2 .8 2.4 0" stroke="${LINE}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
  return ear + band + eyes + nose + mouth;
}

/** Head, topknot and muzzle puffs at an offset. */
const headPuffs = (dx, dy) => [
  [37 + dx, 15 + dy, 5.8],
  [35.8 + dx, 8.6 + dy, 4.4],
  [39.4 + dx, 9.6 + dy, 3.2],
  [42.6 + dx, 17.4 + dy, 3.3],
  [44.6 + dx, 16.8 + dy, 2.4],
];

/**
 * Standing (and walking): `swing` moves one pair of legs forward and the
 * other back; `lift` raises the body a little; `wag` turns the tail.
 */
function standing({ swing = 0, lift = 0, wag = 0, eye = "open", tongue = false } = {}) {
  const y = -lift;
  const body = [
    [12.6, 25 + y, 4.8],
    [17, 27 + y, 6],
    [23, 26 + y, 6.4],
    [28.6, 26.2 + y, 5.8],
    [33, 22.8 + y, 5.4],
  ];
  const far = [
    [18, 30 + y, 18 - swing, 41],
    [31, 30 + y, 31 + swing, 41],
  ];
  const near = [
    [21, 30 + y, 21 + swing, 41],
    [34, 29 + y, 34 - swing, 41],
  ];
  return (
    shadow(15) +
    fluff([], far, SHADE) +
    tail([11.4, 22.4 + y], 25 + wag) +
    fluff([...body, ...headPuffs(0, y)], near, FUR) +
    face(0, y, { eye, tongue })
  );
}

/** Sitting on her haunches, front legs straight. */
function sitting() {
  const body = [
    [14.6, 37.4, 5.6],
    [19.6, 34.4, 6.6],
    [26, 29.6, 6],
    [31.2, 24.4, 5.6],
  ];
  const front = [
    [29.6, 31, 29.6, 41],
    [33.6, 30, 33.6, 41],
  ];
  return (
    shadow(14) +
    tail([10.6, 35], 20) +
    fluff([...body, [20.6, 41.4, 3.4], ...headPuffs(0, 1)], front, FUR) +
    face(0, 1)
  );
}

/** Lying down, curled up, eyes closed. */
function sleeping() {
  const body = [
    [14.2, 39.4, 5.4],
    [20.4, 38.2, 6.4],
    [27, 38.4, 6],
    [32.6, 39.2, 5.2],
    [42.6, 43.2, 2.8],
    [9.4, 42, 3.4],
  ];
  return (
    shadow(18) +
    fluff([...body, ...headPuffs(-1.4, 22.4)], [], FUR) +
    face(-1.4, 22.4, { eye: "closed", collar: false }) +
    snore(40, 15)
  );
}

/** Fluffy ear hanging beside the head in the front and back views. */
const sideEar = (x, y) =>
  fluff(
    [
      [x, y, 2.8],
      [x - 0.2, y + 3.4, 3.1],
      [x + 0.1, y + 6.4, 2.6],
    ],
    [],
    SHADE,
  );

/**
 * Facing you (walking down the pane): `step` 0–3 lifts the left or the
 * right pair of feet in turn.
 */
function front(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0],
  ][step];
  const bob = step % 2 ? -0.8 : 0;
  const back = [
    [16, 31 + bob, 16, 40.5],
    [32, 31 + bob, 32, 40.5],
  ];
  const fore = [
    [20, 32 + bob, 20, 41 - lift[0]],
    [28, 32 + bob, 28, 41 - lift[1]],
  ];
  const body = [
    [17.6, 29 + bob, 5.4],
    [30.4, 29 + bob, 5.4],
    [24, 30.4 + bob, 7.6],
  ];
  const head = [
    [24, 17 + bob, 6.8],
    [24, 9.4 + bob, 4.8],
    [20.4, 10.8 + bob, 3.4],
    [27.6, 10.8 + bob, 3.4],
  ];
  const y = (v) => v + bob;
  return (
    shadow(13) +
    fluff([], back, SHADE) +
    fluff([...body, ...head], fore, FUR) +
    sideEar(16.6, y(15.4)) +
    sideEar(31.4, y(15.4)) +
    `<path d="M18.4 ${y(23.6)}Q24 ${y(27.6)} 29.6 ${y(23.6)}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="24" cy="${y(26.6)}" r="1.2" fill="${TAG}"/>` +
    puff([24, y(21.4), 3.4], LINE, 0.9) +
    puff([24, y(21.4), 3.4], FUR) +
    `<circle cx="20.9" cy="${y(16.4)}" r="1.35" fill="${INK}"/><circle cx="27.1" cy="${y(16.4)}" r="1.35" fill="${INK}"/>` +
    `<circle cx="21.3" cy="${y(15.9)}" r=".45" fill="${FUR}"/><circle cx="27.5" cy="${y(15.9)}" r=".45" fill="${FUR}"/>` +
    `<ellipse cx="24" cy="${y(20.2)}" rx="1.6" ry="1.2" fill="${INK}"/>` +
    `<path d="M22.6 ${y(22.6)}q1.4 1 2.8 0" stroke="${LINE}" stroke-width=".8" fill="none" stroke-linecap="round"/>`
  );
}

/**
 * From behind (walking up the pane): rump and pom-pom tail in front of the
 * head; `step` 0–3 lifts the feet in turn.
 */
function behind(step) {
  const lift = [
    [2, 0],
    [0, 0],
    [0, 2],
    [0, 0],
  ][step];
  const bob = step % 2 ? -0.8 : 0;
  const far = [
    [17, 30 + bob, 17, 40.5],
    [31, 30 + bob, 31, 40.5],
  ];
  const near = [
    [20, 32 + bob, 20, 41 - lift[0]],
    [28, 32 + bob, 28, 41 - lift[1]],
  ];
  const head = [
    [24, 13.6 + bob, 6.4],
    [24, 7 + bob, 4.6],
    [20.6, 8.4 + bob, 3.3],
    [27.4, 8.4 + bob, 3.3],
  ];
  const body = [
    [18, 29 + bob, 5.2],
    [30, 29 + bob, 5.2],
    [24, 31.6 + bob, 7.4],
  ];
  const wag = [0, 1.2, 0, -1.2][step];
  return (
    shadow(13) +
    fluff(head, [], FUR) +
    sideEar(17, 12.8 + bob) +
    sideEar(31, 12.8 + bob) +
    `<path d="M19.2 ${18.8 + bob}Q24 ${21.2 + bob} 28.8 ${18.8 + bob}" stroke="${COLLAR}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    fluff([], far, SHADE) +
    // The tail's stalk goes behind the rump; only the pom shows above it.
    `<path d="M24 ${28 + bob}L${24 + wag} ${22.4 + bob}" stroke="${LINE}" stroke-width="3.6" stroke-linecap="round"/>` +
    `<path d="M24 ${28 + bob}L${24 + wag} ${22.4 + bob}" stroke="${FUR}" stroke-width="1.8" stroke-linecap="round"/>` +
    fluff(body, near, FUR) +
    puff([24 + wag, 21.2 + bob, 3.2], LINE, 0.9) +
    puff([24 + wag, 21.2 + bob, 3.2], FUR)
  );
}

/** Coco, as Tilefold Pet's character list describes a character. */
export const poodle = {
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
    walk: sprite(4, 8, (i) =>
      standing({ swing: [2.4, 0, -2.4, 0][i], lift: [0, 0.8, 0, 0.8][i], wag: [0, 6, 0, -6][i] }),
    ),
    walkDown: sprite(4, 8, front),
    walkUp: sprite(4, 8, behind),
    happy: sprite(2, 8, (i) => standing({ eye: "happy", tongue: true, wag: i ? -18 : 18 })),
    sleep: still(sleeping()),
  }),
};
