/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — Pebble, the emperor penguin
 *
 * A small emperor penguin drawn to look like the real bird rather than a
 * cartoon: a slate-grey back shading darker toward the ground, a black head,
 * the golden ear patches that fade into a pale-yellow chest, a long slender
 * bill with the orange stripe along its lower half, dark flippers and feet,
 * and a short stiff tail. Seen from the side she faces right (the overlay
 * flips her to walk left). She waddles, rocking from foot to foot with her
 * flippers held out a little for balance; lies on her belly to rest; flaps
 * with her bill raised when happy; and sleeps standing up with her head
 * tucked down, the way emperors do on the ice. She makes no sound. Drawn as
 * SVG in code.
 */
import { shadow, snore, sprite, still } from "../art.js";

const HEAD = "#141922";
const RIM = "#8b96a8";
const FLIPPER = "#262f3e";
const FLIPPER_EDGE = "#5b6779";
const FOOT = "#2a303b";
const FAR = "#1a1f28";
const BILL = "#0f141c";
const MANDIBLE = "#ef8354";
const EYE = "#05070b";
const EYE_RING = "#3f4756";
const GLINT = "#ffffff";

/**
 * The gradients every pose uses. Each pose is its own SVG image, so the ids
 * can't clash with another character's; in a sprite sheet each frame repeats
 * the same definitions, which is harmless because they are identical.
 */
const DEFS =
  "<defs>" +
  // The back: slate grey with a bluish sheen near the shoulders, darker below.
  '<linearGradient id="pgBack" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#3a4558"/><stop offset="1" stop-color="#1b212c"/></linearGradient>' +
  // The front: a pale-yellow wash on the upper chest fading to white, and a
  // little grey toward the feet where the belly curves away from the light.
  '<linearGradient id="pgBelly" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#fbe2a0"/><stop offset=".22" stop-color="#fff8e8"/>' +
  '<stop offset=".65" stop-color="#ffffff"/><stop offset="1" stop-color="#d6dce5"/></linearGradient>' +
  // The ear patch: deep gold at the top, paler where it meets the chest.
  '<linearGradient id="pgPatch" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#fde68a"/></linearGradient>' +
  "</defs>";

/** A circle as a path, so it can share the rim-then-fill drawing below. */
const circle = (cx, cy, r) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/**
 * A soft light rim around the dark silhouette. A penguin is mostly dark, so
 * without it she would vanish on a dark theme. The rim is drawn first and the
 * fills on top cover its inner half, so only the outer edge shows.
 */
const rim = (d) =>
  `<path d="${d}" fill="none" stroke="${RIM}" stroke-width="1.4" stroke-linejoin="round"/>`;

/** A filled shape. */
const fill = (d, color) => `<path d="${d}" fill="${color}"/>`;

/** Wraps SVG in a rotation about (x, y); no wrapper when the angle is 0. */
const turn = (deg, x, y, inner) =>
  deg ? `<g transform="rotate(${deg} ${x} ${y})">${inner}</g>` : inner;

// ---------------------------------------------------------------- side view

/** Side-view body from the nape down, without the head. */
const BODY =
  "M23 13.6C26 12.6 30.5 13 32.2 16.6C34.4 22 35.2 29.5 34 35" +
  "C33 39.8 29 42.4 24 42.4C18.6 42.4 14.6 39.4 14 34.4C13.4 27.6 17.4 19.6 23 13.6Z";

/** The white front, from the throat down. */
const BELLY =
  "M31.6 16.6C33.8 22 34.6 29 33.6 34.8C32.6 39.6 29 41.8 25 41.8" +
  "C22 41.6 20.6 38 21 32C21.5 25 25 19.6 29.6 16.4Z";

/** The short stiff tail feathers, touching the ground behind her. */
const TAIL = "M15.6 37.4L11 42.4L17.4 41.2Z";

/** Where the head turns on the neck. */
const NECK = [27, 15];

/**
 * The head and its details at an offset: black crown, gold ear patch running
 * down onto the neck, eye, and the bill with its orange lower stripe.
 *
 * @param {number} dx
 * @param {number} dy
 * @param {"open" | "blink" | "closed" | "happy"} eye
 */
function headParts(dx, dy, eye) {
  const p = (x, y) => `${x + dx} ${y + dy}`;
  const skull = circle(28.2 + dx, 10.4 + dy, 5.9);
  // The ear patch starts broad behind the eye and narrows as it runs down
  // the side of the neck toward the throat, where the chest's yellow takes over.
  const patch =
    `M${p(25.4, 11.2)}C${p(27.4, 11.2)} ${p(29, 12.6)} ${p(30.2, 14.4)}` +
    `C${p(31.4, 16.2)} ${p(31.8, 18.2)} ${p(31, 19.8)}C${p(30.2, 18.8)} ${p(29, 17.8)} ${p(27.6, 16.8)}` +
    `C${p(26, 15.6)} ${p(25, 14)} ${p(25, 12.4)}C${p(25, 11.8)} ${p(25.1, 11.4)} ${p(25.4, 11.2)}Z`;
  const upperBill =
    `M${p(33.6, 9.8)}C${p(36.8, 10.4)} ${p(39.8, 11.6)} ${p(42.2, 13.2)}` +
    `C${p(39.8, 13)} ${p(36.8, 12.8)} ${p(33.8, 12.8)}Z`;
  const lowerBill =
    `M${p(34, 12.8)}C${p(36.8, 13)} ${p(39.4, 13.3)} ${p(41.4, 13.6)}` +
    `C${p(39.2, 14.3)} ${p(36.4, 14.4)} ${p(34.2, 14)}Z`;
  const [ex, ey] = [30.4 + dx, 9.4 + dy];
  let eyes;
  if (eye === "closed" || eye === "blink") {
    eyes = `<path d="M${ex - 1.2} ${ey}q1.2 ${eye === "closed" ? 0.9 : 0.3} 2.4 0" stroke="${RIM}" stroke-width=".7" fill="none" stroke-linecap="round"/>`;
  } else if (eye === "happy") {
    eyes = `<path d="M${ex - 1.2} ${ey + 0.3}q1.2 -1.3 2.4 0" stroke="${RIM}" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
  } else {
    // A dark eye on a black head: a faint grey ring and a glint make it read.
    eyes =
      `<circle cx="${ex}" cy="${ey}" r="1.35" fill="${EYE_RING}"/>` +
      `<circle cx="${ex}" cy="${ey}" r="1" fill="${EYE}"/>` +
      `<circle cx="${ex + 0.38}" cy="${ey - 0.38}" r=".36" fill="${GLINT}"/>`;
  }
  return {
    skull,
    details:
      fill(patch, "url(#pgPatch)") + fill(upperBill, BILL) + fill(lowerBill, MANDIBLE) + eyes,
  };
}

/**
 * A flipper hanging from the shoulder; `flap` swings it back and up
 * (clockwise) about the shoulder.
 */
function flipper(flap) {
  const d =
    "M22.8 18.2C20.4 21.8 18.6 26.8 18 32.2C17.8 33.8 18.8 34.2 19.6 33" +
    "C21.6 29 23.8 24.4 24.8 19.6Z";
  return turn(
    flap,
    23.6,
    19,
    `<path d="${d}" fill="${FLIPPER}" stroke="${FLIPPER_EDGE}" stroke-width=".5" stroke-linejoin="round"/>`,
  );
}

/** A foot with its toes pointing forward; `lift` raises it off the ground. */
const foot = (x, lift, color) =>
  `<path d="M${x} ${41.4 - lift}c2.4 -.5 5.2 -.2 6.6 .9c-1.8 .7 -5 .8 -6.8 .3z" fill="${color}"/>`;

/**
 * Standing, seen from the side.
 *
 * @param {object} [o]
 * @param {number} [o.tilt] Degrees the whole bird rocks about her feet.
 * @param {[number, number]} [o.lift] How far the near and far foot are raised.
 * @param {number} [o.head] Degrees the head turns: negative raises the bill,
 *   positive tucks it down.
 * @param {number} [o.flap] Degrees the flipper swings out.
 * @param {"open" | "blink" | "closed" | "happy"} [o.eye]
 */
function standing({ tilt = 0, lift = [0, 0], head = 0, flap = 0, eye = "open" } = {}) {
  const h = headParts(0, 0, eye);
  const [nx, ny] = NECK;
  const bird =
    foot(20.6, lift[1], FAR) +
    fill(TAIL, FAR) +
    rim(BODY) +
    turn(head, nx, ny, rim(h.skull)) +
    fill(BODY, "url(#pgBack)") +
    turn(head, nx, ny, fill(h.skull, HEAD)) +
    fill(BELLY, "url(#pgBelly)") +
    turn(head, nx, ny, h.details) +
    flipper(flap) +
    foot(23.4, lift[0], FOOT);
  return DEFS + shadow(12) + turn(tilt, 24, 42, bird);
}

/** Resting on her belly with her head up, flippers along her sides. */
function lying() {
  const body =
    "M8.6 40.8C9 35.6 15 32.6 22.6 32.2C28.6 31.8 33 32.6 34.6 35.6" +
    "C35.8 38.6 34.4 42.2 30 42.4L14 42.4C10.6 42.4 8.4 42 8.6 40.8Z";
  const belly = "M12 42.4C18.4 40.8 27.6 40 34.8 38.4C34.4 41 32.6 42.3 30 42.4Z";
  const side = "M18 35C14 36.4 10.6 38.4 9.4 40C13 39.6 16.6 38.4 19.6 36.6Z";
  const feet = "M9 41.2c-1.6 -.2 -3.2 .1 -4.2 .8c1.4 .5 3 .5 4.4 .2z";
  // The head sits forward of the body, so the bill must still fit the 48 box.
  const h = headParts(4.6, 19.4, "open");
  return (
    DEFS +
    shadow(14) +
    fill(feet, FAR) +
    rim(body) +
    rim(h.skull) +
    fill(body, "url(#pgBack)") +
    fill(h.skull, HEAD) +
    fill(belly, "url(#pgBelly)") +
    h.details +
    `<path d="${side}" fill="${FLIPPER}" stroke="${FLIPPER_EDGE}" stroke-width=".5" stroke-linejoin="round"/>`
  );
}

// ------------------------------------------------------ front and back views

/** Body seen from the front or back, shared by both views. */
const ROUND =
  "M24 15C31 15 34.5 24 34 32C33.6 38.5 29.5 42.2 24 42.2" +
  "C18.5 42.2 14.4 38.5 14 32C13.5 24 17 15 24 15Z";

const SKULL = circle(24, 10.6, 6.2);

/** The left flipper in the front and back views; the right one mirrors it. */
const SIDE_FLIPPER =
  "M15.6 18.8C12.8 22.8 11.4 27.8 11.6 32C12.6 32.6 13.4 32 14 30.6" +
  "C14.4 26.6 15.2 22.6 16.8 19.8Z";

/** Mirrors SVG left to right across the middle of the 48 box. */
const mirror = (inner) => `<g transform="matrix(-1 0 0 1 48 0)">${inner}</g>`;

/** Both flippers, each with its edge. */
const flippers = () => {
  const one = `<path d="${SIDE_FLIPPER}" fill="${FLIPPER}" stroke="${FLIPPER_EDGE}" stroke-width=".5" stroke-linejoin="round"/>`;
  return one + mirror(one);
};

/** Steps of the waddle: how far she rocks and which foot is up. */
const WADDLE = [
  { tilt: -5, lift: [1.6, 0] },
  { tilt: 0, lift: [0, 0] },
  { tilt: 5, lift: [0, 1.6] },
  { tilt: 0, lift: [0, 0] },
];

/** Facing you (walking down the pane): white front, both ear patches, bill pointing at you. */
function front(step) {
  const { tilt, lift } = WADDLE[step];
  const belly =
    "M24 17C29.5 17.5 31.6 25 31.2 32C30.8 38 28 41.4 24 41.4" +
    "C20 41.4 17.2 38 16.8 32C16.4 25 18.5 17.5 24 17Z";
  // Seen head-on the ear patches are narrow bands down the sides of the
  // neck that meet in a V over a pale-yellow bib; drawn as thin separate
  // hooks they read as tusks.
  const patch =
    "M18.2 11C17.6 13.6 17.8 16.4 19.2 18.6C20.4 20.2 22.2 21 24 21" +
    "C22.6 19.6 21.4 17.6 20.8 15.4C20.4 13.8 20.2 12.4 19.6 11.2Z";
  const eye = (x) =>
    `<circle cx="${x}" cy="10" r="1.25" fill="${EYE_RING}"/>` +
    `<circle cx="${x}" cy="10" r=".9" fill="${EYE}"/>` +
    `<circle cx="${x + 0.32}" cy="9.65" r=".32" fill="${GLINT}"/>`;
  const bird =
    `<ellipse cx="20.4" cy="${42 - lift[0]}" rx="2.6" ry="1.1" fill="${FOOT}"/>` +
    `<ellipse cx="27.6" cy="${42 - lift[1]}" rx="2.6" ry="1.1" fill="${FOOT}"/>` +
    rim(ROUND) +
    rim(SKULL) +
    fill(ROUND, "url(#pgBack)") +
    fill(SKULL, HEAD) +
    fill(belly, "url(#pgBelly)") +
    `<ellipse cx="24" cy="20.4" rx="6.8" ry="3.4" fill="#fde68a" opacity=".6"/>` +
    fill(patch, "url(#pgPatch)") +
    mirror(fill(patch, "url(#pgPatch)")) +
    eye(21.3) +
    eye(26.7) +
    // Seen head-on the bill is a narrow wedge, its orange stripe down the middle.
    fill("M22.7 11.8L25.3 11.8L24 16.6Z", BILL) +
    fill("M23.5 13L24.5 13L24 15.6Z", MANDIBLE) +
    flippers();
  return DEFS + shadow(12) + turn(tilt, 24, 42, bird);
}

/** From behind (walking up the pane): all slate back, tail, slivers of gold at the cheeks. */
function behind(step) {
  const { tilt, lift } = WADDLE[step];
  const sliver = "M18 12.4C17.6 14.4 17.9 16.4 19 18.2C19.2 16.4 18.9 14.2 18 12.4Z";
  const bird =
    rim(ROUND) +
    rim(SKULL) +
    fill(ROUND, "url(#pgBack)") +
    fill(SKULL, HEAD) +
    fill(sliver, "url(#pgPatch)") +
    mirror(fill(sliver, "url(#pgPatch)")) +
    flippers() +
    fill("M21.6 38.6L24 43.2L26.4 38.6Z", FAR) +
    // Only the heels show from behind.
    `<ellipse cx="20.4" cy="${42.2 - lift[0]}" rx="2" ry=".9" fill="${FOOT}"/>` +
    `<ellipse cx="27.6" cy="${42.2 - lift[1]}" rx="2" ry=".9" fill="${FOOT}"/>`;
  return DEFS + shadow(12) + turn(tilt, 24, 42, bird);
}

/** Pebble, as Tilefold Pet's character list describes a character. */
export const penguin = {
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
    sleep: still(standing({ head: 38, eye: "closed" }) + snore(37, 8)),
  }),
};
