/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — Rumble, the T. rex
 *
 * A young Tyrannosaurus rex drawn the way palaeontologists reconstruct the
 * animal today rather than as an upright movie monster: body held level
 * over two massive legs, the long tail stretched out behind as a
 * counterweight, a deep heavy skull with a bony brow over a forward-facing
 * amber eye, a row of teeth showing along the upper jaw even with the mouth
 * shut, and the famously tiny two-fingered arms. Olive skin, darker on the
 * back with faint stripes, shades to a sandy belly and throat, as many
 * large animals are countershaded.
 *
 * Seen from the side he faces right (the overlay flips him to walk left).
 * He stomps with a heavy bob, lies down to rest with his head up, sleeps
 * with his chin on the ground, and when happy throws his head back and
 * roars with his jaws wide and his little arms waving. He makes no sound;
 * the roar is a speech bubble. Drawn as SVG in code.
 */
import { shadow, snore, sprite, still } from "../art.js";

const LINE = "#1c2e14";
const BELLY = "#d8c98f";
const STRIPE = "#2a4a1c";
const FAR_SKIN = "#34561f";
const EYE = "#f59e0b";
const PUPIL = "#111827";
const TOOTH = "#fffbea";
const MOUTH = "#9f1239";
const CLAW = "#e7e2d0";

/**
 * The skin gradient: darker along the back, lighter toward the belly. Each
 * pose is its own SVG image; frames of a sprite sheet repeat these
 * identical definitions, which is harmless.
 */
const DEFS =
  "<defs>" +
  '<linearGradient id="trSkin" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0" stop-color="#3f6a2a"/><stop offset="1" stop-color="#7aa556"/></linearGradient>' +
  "</defs>";

const SKIN = "url(#trSkin)";
const OUTLINE = `stroke="${LINE}" stroke-width=".7" stroke-linejoin="round"`;

/** Wraps SVG in a transform; no wrapper when there is nothing to do. */
const at = (transform, inner) => (transform ? `<g transform="${transform}">${inner}</g>` : inner);

// ---------------------------------------------------------------- the head

/** Where the lower jaw hinges, and where the head turns on the neck. */
const HINGE = [33.6, 19.6];
const NECK = [31, 18];

/**
 * The head facing right.
 *
 * @param {object} [o]
 * @param {number} [o.jaw] Degrees the lower jaw drops (0 = shut).
 * @param {"open" | "closed"} [o.eye]
 */
function head({ jaw = 0, eye = "open" } = {}) {
  const skull =
    "M30.6 14.2C33 10.4 39 9 43.6 10.2C45.8 10.8 46.8 12.6 46.4 14.8L46 17.4" +
    "C42 18.2 37 18.6 33.6 19.6C32 20 30.6 19 30.2 17.4Z";
  const lower =
    "M33.4 19.4C37.6 18.8 41.8 18.4 45.6 17.8C45.4 19.8 43 21.4 39 21.8" +
    "C36.4 22 34.4 21.6 32.8 20.8Z";
  // Teeth hang from the upper jaw; a T. rex's show even with its mouth closed.
  const teeth = [36, 38.4, 40.8, 43.2]
    .map((x, i) => {
      const y = 18.5 - i * 0.22;
      return `<path d="M${x} ${y}l.55 1.2l.55 -1.25z" fill="${TOOTH}" stroke="${LINE}" stroke-width=".2"/>`;
    })
    .join("");
  const [hx, hy] = HINGE;
  // With the jaw dropped, the inside of the mouth shows between the jaws.
  const mouth = jaw
    ? `<path d="M33.6 19.4L46 17.4L${hx + 12.2 * Math.cos((jaw * Math.PI) / 180)} ${hy + 12.2 * Math.sin((jaw * Math.PI) / 180)}Z" fill="${MOUTH}"/>`
    : "";
  const eyes =
    eye === "closed"
      ? `<path d="M37.8 13.6q1 .8 2 0" stroke="${LINE}" stroke-width=".7" fill="none" stroke-linecap="round"/>`
      : `<circle cx="38.8" cy="13.4" r="1.15" fill="${EYE}" stroke="${LINE}" stroke-width=".3"/>` +
        `<ellipse cx="38.9" cy="13.4" rx=".32" ry=".95" fill="${PUPIL}"/>` +
        `<circle cx="39.3" cy="12.9" r=".25" fill="#fff"/>`;
  return (
    mouth +
    at(jaw ? `rotate(${jaw} ${hx} ${hy})` : "", `<path d="${lower}" fill="${BELLY}" ${OUTLINE}/>`) +
    `<path d="${skull}" fill="${SKIN}" ${OUTLINE}/>` +
    teeth +
    // The bony brow ridge that shades his eye.
    `<path d="M36.6 12.2q2.2 -1.4 4.4 -.4" stroke="${LINE}" stroke-width=".8" fill="none" stroke-linecap="round"/>` +
    eyes +
    `<ellipse cx="45" cy="12.6" rx=".5" ry=".35" fill="${LINE}"/>`
  );
}

// --------------------------------------------------------------- side view

/** Body, neck and tail as one silhouette, from the tail tip at the left. */
const BODY =
  "M2 22C8 19 14 15.6 21 15C26 14.4 30 15.2 32.4 16.4L34.6 20.6" +
  "C34 25 30 29.6 23.6 30.6C17 31.4 12 27.6 8 25.2C5.6 24 3.4 23.2 2 22Z";

/** The paler underside: throat, chest, belly and under the tail. */
const UNDER =
  "M8 25C12 27.4 17 30.2 22.6 30.4C28.4 30.6 32.6 27.4 34.4 22.4" +
  "C30 26 25 27.6 20 27C15.6 26.4 11.6 25.6 8 25Z";

/** Faint stripes across the back, following its curve. */
const STRIPES = [
  [9.6, 18.8],
  [14.6, 16.6],
  [19.6, 15.4],
  [25.4, 15],
]
  .map(
    ([x, y]) =>
      `<path d="M${x} ${y}q1 2.4 .2 4.6" stroke="${STRIPE}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".7"/>`,
  )
  .join("");

/**
 * A leg from the hip: a heavy thigh, a slim shin and a three-toed foot.
 * `swing` turns it about the hip (positive swings the foot forward).
 */
function leg(swing, fill) {
  const thigh = "M16.6 24C16 29.4 19 32.6 23.4 32.4C26.4 32.2 27.4 29 26.4 25.4Z";
  // Only the thigh's lower curve is outlined: its top blends into the body,
  // and a line across there would make it look like a pocket.
  const thighEdge = "M16.6 24C16 29.4 19 32.6 23.4 32.4C26.4 32.2 27.4 29 26.4 25.4";
  const shin = "M20.6 30.6L23.8 30.4L26.4 39.8L23.4 40.4Z";
  const foot = "M22.6 39.4L29.6 39.8L30.6 42L22 42.2Z";
  const claws = `<path d="M29.4 40l1.6 .8l-1 1.2" stroke="${CLAW}" stroke-width=".45" fill="none" stroke-linecap="round"/>`;
  return at(
    swing ? `rotate(${-swing} 21.6 26)` : "",
    `<path d="${shin}" fill="${fill}" ${OUTLINE}/>` +
      `<path d="${foot}" fill="${fill}" ${OUTLINE}/>` +
      claws +
      `<path d="${thigh}" fill="${fill}"/>` +
      `<path d="${thighEdge}" fill="none" ${OUTLINE}/>`,
  );
}

/** The tiny arm, two clawed fingers; `wave` turns it at the shoulder. */
const arm = (wave = 0) =>
  at(
    wave ? `rotate(${wave} 31 24.6)` : "",
    `<path d="M31 24.6q2 1.2 2.4 3" stroke="${LINE}" stroke-width="1.9" fill="none" stroke-linecap="round"/>` +
      `<path d="M31 24.6q2 1.2 2.4 3" stroke="#6b9a48" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
      `<path d="M33.4 27.6l.9 .3M33.3 27.7l.5 .8" stroke="${CLAW}" stroke-width=".4" stroke-linecap="round"/>`,
  );

/**
 * Standing or walking, seen from the side.
 *
 * @param {object} [o]
 * @param {number} [o.near] Degrees the near leg swings forward.
 * @param {number} [o.far] Degrees the far leg swings forward.
 * @param {number} [o.bob] How far the body rises.
 * @param {number} [o.tilt] Degrees the head turns (negative raises it).
 * @param {number} [o.jaw] Degrees the jaw drops.
 * @param {number} [o.wave] Degrees the arm turns.
 * @param {"open" | "closed"} [o.eye]
 * @param {number} [o.shift] How far he moves left, so a raised head stays inside the box.
 */
function standing({
  near = 0,
  far = 0,
  bob = 0,
  tilt = 0,
  jaw = 0,
  wave = 0,
  eye = "open",
  shift = 0,
} = {}) {
  const [nx, ny] = NECK;
  const upper =
    at("translate(-2.4 0)", leg(far, FAR_SKIN)) +
    `<path d="${BODY}" fill="${SKIN}" ${OUTLINE}/>` +
    `<path d="${UNDER}" fill="${BELLY}"/>` +
    STRIPES +
    at(tilt ? `rotate(${tilt} ${nx} ${ny})` : "", head({ jaw, eye })) +
    arm(wave) +
    leg(near, SKIN);
  return DEFS + shadow(17) + at(bob || shift ? `translate(${-shift} ${-bob})` : "", upper);
}

/**
 * Lying down, legs folded under him: the standing body lowered to the
 * ground with the head either up and alert or resting on the ground.
 */
function lying({ asleep = false } = {}) {
  const drop = 10.6;
  const thigh = `<path d="M15.6 34C15 38.4 18 41.6 23 41.6C27 41.6 28.2 38.6 27 35.4Z" fill="${SKIN}" ${OUTLINE}/>`;
  const foot = `<path d="M24 40.2L32.6 40.6L33.4 42.4L23.4 42.4Z" fill="${SKIN}" ${OUTLINE}/>`;
  // Awake his head stays up; asleep it comes down until his chin touches the ground.
  const headAt = asleep ? "translate(-1.6 20.2)" : `translate(0 ${drop})`;
  return (
    DEFS +
    shadow(19) +
    at(
      `translate(0 ${drop})`,
      `<path d="${BODY}" fill="${SKIN}" ${OUTLINE}/>` +
        `<path d="${UNDER}" fill="${BELLY}"/>` +
        STRIPES,
    ) +
    at(headAt, head({ eye: asleep ? "closed" : "open" })) +
    foot +
    thigh +
    (asleep ? snore(40, 20) : "")
  );
}

// ------------------------------------------------------ front and back views

/** Steps of the stomp: how far each foot lifts and how far the body rises. */
const STOMP = [
  { lift: [2, 0], bob: 0 },
  { lift: [0, 0], bob: 0.8 },
  { lift: [0, 2], bob: 0 },
  { lift: [0, 0], bob: 0.8 },
];

/** A leg seen from the front or back: thigh, shin and foot, at `x`. */
const columnLeg = (x, lift) =>
  `<ellipse cx="${x}" cy="31" rx="4.2" ry="5.2" fill="${SKIN}" ${OUTLINE}/>` +
  `<path d="M${x - 1.6} 34.6L${x + 1.6} 34.6L${x + 1.4} ${40.6 - lift}L${x - 1.4} ${40.6 - lift}Z" fill="${SKIN}" ${OUTLINE}/>` +
  `<ellipse cx="${x}" cy="${41.4 - lift}" rx="3.2" ry="1.2" fill="${SKIN}" ${OUTLINE}/>`;

/** Facing you (walking down the pane): broad skull, both eyes, teeth, tiny arms. */
function front(step) {
  const { lift, bob } = STOMP[step];
  const teeth = [20.4, 22.4, 24.4, 26.4]
    .map(
      (x) =>
        `<path d="M${x} 18.6l.6 1.1l.6 -1.1z" fill="${TOOTH}" stroke="${LINE}" stroke-width=".2"/>`,
    )
    .join("");
  const eye = (x) =>
    `<circle cx="${x}" cy="11.8" r="1.1" fill="${EYE}" stroke="${LINE}" stroke-width=".3"/>` +
    `<ellipse cx="${x}" cy="11.8" rx=".3" ry=".9" fill="${PUPIL}"/>`;
  const tinyArm = (x, dir) =>
    `<path d="M${x} 25q${dir * 1.6} 1.4 ${dir * 1.2} 3" stroke="${LINE}" stroke-width="1.9" fill="none" stroke-linecap="round"/>` +
    `<path d="M${x} 25q${dir * 1.6} 1.4 ${dir * 1.2} 3" stroke="#6b9a48" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  const body =
    `<ellipse cx="24" cy="26" rx="8.4" ry="7.4" fill="${SKIN}" ${OUTLINE}/>` +
    `<ellipse cx="24" cy="27.6" rx="5" ry="5" fill="${BELLY}"/>` +
    `<ellipse cx="24" cy="13" rx="7.6" ry="6.2" fill="${SKIN}" ${OUTLINE}/>` +
    // The snout, coming toward you, with the jaw line and teeth below it.
    `<ellipse cx="24" cy="16.6" rx="5" ry="3.4" fill="${SKIN}" ${OUTLINE}/>` +
    `<path d="M19.6 18.6q4.4 1.6 8.8 0" stroke="${LINE}" stroke-width=".6" fill="none"/>` +
    teeth +
    `<path d="M19.4 19.2q4.6 2.8 9.2 0q-1 2.4 -4.6 2.6q-3.6 -.2 -4.6 -2.6z" fill="${BELLY}" ${OUTLINE}/>` +
    `<path d="M16.6 10.4q2 -1.4 3.6 -.2M27.8 10.2q1.6 -1.2 3.6 .2" stroke="${LINE}" stroke-width=".7" fill="none" stroke-linecap="round"/>` +
    eye(18.2) +
    eye(29.8) +
    `<ellipse cx="22.6" cy="15.4" rx=".45" ry=".35" fill="${LINE}"/><ellipse cx="25.4" cy="15.4" rx=".45" ry=".35" fill="${LINE}"/>` +
    tinyArm(19.4, -1) +
    tinyArm(28.6, 1);
  return (
    DEFS +
    shadow(13) +
    columnLeg(18.4, lift[0]) +
    columnLeg(29.6, lift[1]) +
    at(bob ? `translate(0 ${-bob})` : "", body)
  );
}

/** From behind (walking up the pane): striped back and the tail coming toward you. */
function behind(step) {
  const { lift, bob } = STOMP[step];
  const sway = [0, 2.4, 0, -2.4][step];
  const tail = `M19 27C20 33 22.6 39 ${24 + sway} 43.4C25.4 39 28 33 29 27Z`;
  const stripes = [20, 24, 28]
    .map(
      (y) =>
        `<path d="M18.6 ${y}q5.4 -2 10.8 0" stroke="${STRIPE}" stroke-width="1" fill="none" opacity=".7"/>`,
    )
    .join("");
  const body =
    `<ellipse cx="24" cy="13.6" rx="7" ry="5.8" fill="${SKIN}" ${OUTLINE}/>` +
    `<ellipse cx="24" cy="25" rx="8.4" ry="7.6" fill="${SKIN}" ${OUTLINE}/>` +
    stripes;
  return (
    DEFS +
    shadow(13) +
    columnLeg(18.4, lift[0]) +
    columnLeg(29.6, lift[1]) +
    at(bob ? `translate(0 ${-bob})` : "", body) +
    `<path d="${tail}" fill="${SKIN}" ${OUTLINE}/>`
  );
}

/** Rumble, as Tilefold Pet's character list describes a character. */
export const trex = {
  id: "trex",
  label: "setting-character-trex",
  name: "Rumble",
  // A heavy, deliberate walker: a little slower than the dogs.
  speed: 36,
  bubbles: { play: "bubble-roar" },
  // No `sounds`: the roar is only a bubble, whatever the Bark setting says.
  poses: () => ({
    idle: still(standing()),
    blink: still(standing({ eye: "closed" })),
    sit: still(lying()),
    walk: sprite(4, 6, (i) =>
      standing({
        near: [14, 0, -14, 0][i],
        far: [-14, 0, 14, 0][i],
        bob: [0, 0.9, 0, 0.9][i],
        tilt: [0, 1.5, 0, 1.5][i],
      }),
    ),
    walkDown: sprite(4, 6, front),
    walkUp: sprite(4, 6, behind),
    happy: sprite(2, 6, (i) =>
      standing({ tilt: -12, jaw: i ? 32 : 20, wave: i ? -40 : 20, shift: 1.6 }),
    ),
    sleep: still(lying({ asleep: true })),
  }),
};
