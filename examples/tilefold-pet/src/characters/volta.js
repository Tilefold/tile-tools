/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — Volta, the spark fox
 *
 * An original electric creature in a chibi anime style: a pale sky-blue fox
 * kit with a big round head, tall pointed ears lined in deep blue, large
 * glossy eyes with two highlights each, a cream muzzle and tummy, softly
 * glowing cyan cheeks that store her charge, and a fluffy plume of a tail
 * whose white tip sparks. Everything carries a thin navy outline, the way
 * anime creatures are drawn, which also keeps her clear on light and dark
 * themes.
 *
 * Her electricity is the point: sparks flicker at her tail as she trots,
 * lightning bolts crackle around her when she is happy, and a little static
 * twinkles over her while she sleeps curled in her tail. Seen from the side
 * she faces right, turned a little toward you so both eyes show (the overlay
 * flips her to walk left). She makes no sound. Drawn as SVG in code.
 */
import { shadow, snore, sprite, still } from "../art.js";

const LINE = "#34507f";
const INNER_EAR = "#3b82f6";
const CREAM = "#fff7e8";
const EYE = "#1e1b4b";
const EYE_LIGHT = "#ffffff";
const CHEEK = "#5ef0ff";
const MOUTH = "#f472b6";
const BOLT = "#fde047";
const ARC = "#22d3ee";
/** Edges that keep the yellow bolts and white sparks visible on a light theme. */
const BOLT_EDGE = "#b45309";
const SPARK_EDGE = "#0ea5e9";

/**
 * Gradients and the glow filter. Each pose is its own SVG image; in a sprite
 * sheet every frame repeats these identical definitions, which is harmless.
 */
const DEFS =
  "<defs>" +
  // Fur lit from the upper left: nearly white there, deeper blue at the far edge.
  '<radialGradient id="vFur" cx=".36" cy=".3" r=".85">' +
  '<stop offset="0" stop-color="#e6f2ff"/><stop offset=".6" stop-color="#b4d6fb"/>' +
  '<stop offset="1" stop-color="#7fb0ea"/></radialGradient>' +
  // The tail: deep blue at the base, fading to a white tip.
  '<linearGradient id="vTail" x1="1" y1="1" x2="0" y2="0">' +
  '<stop offset="0" stop-color="#7fb0ea"/><stop offset=".65" stop-color="#cfe6ff"/>' +
  '<stop offset="1" stop-color="#ffffff"/></linearGradient>' +
  // A soft halo for anything electric: the shape blurred, with the sharp shape on top.
  '<filter id="vGlow" x="-60%" y="-60%" width="220%" height="220%">' +
  '<feGaussianBlur stdDeviation=".9" result="b"/>' +
  '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
  "</filter>" +
  "</defs>";

/** Outline attributes shared by every furry shape. */
const OUTLINE = `stroke="${LINE}" stroke-width=".8" stroke-linejoin="round"`;

/** Wraps SVG in a transform; no wrapper when there is nothing to do. */
const at = (transform, inner) => (transform ? `<g transform="${transform}">${inner}</g>` : inner);

// ------------------------------------------------------------- electricity

/**
 * A lightning bolt about 9 units tall, centred on (x, y).
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [scale]
 * @param {number} [angle] Degrees, clockwise.
 */
const bolt = (x, y, scale = 1, angle = 0) =>
  at(
    `translate(${x} ${y}) rotate(${angle}) scale(${scale})`,
    `<path d="M1.8 -4.6L-2.4 0.6H-0.2L-1.8 4.6L2.6 -1H0.4Z" fill="${BOLT}" stroke="${BOLT_EDGE}" stroke-width=".55" stroke-linejoin="round" filter="url(#vGlow)"/>`,
  );

/** A four-pointed spark centred on (x, y), `r` units to each point. */
const spark = (x, y, r = 1.6) => {
  const k = r * 0.28;
  return (
    `<path d="M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}` +
    `L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z" fill="${EYE_LIGHT}" stroke="${SPARK_EDGE}" stroke-width=".3" filter="url(#vGlow)"/>`
  );
};

/** A crackling arc: a jagged line through the given points. */
const arc = (points) => {
  const pts = points.map((p) => p.join(",")).join(" ");
  // A cyan stroke with a thin white core, like a real electric arc.
  return (
    `<polyline points="${pts}" fill="none" stroke="${ARC}" stroke-width="1" stroke-linejoin="bevel" filter="url(#vGlow)"/>` +
    `<polyline points="${pts}" fill="none" stroke="${EYE_LIGHT}" stroke-width=".35" stroke-linejoin="bevel"/>`
  );
};

/** A glowing cheek, where she keeps her charge. */
const cheek = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${CHEEK}" opacity=".85" filter="url(#vGlow)"/>`;

// ---------------------------------------------------------------- the head

/** One big glossy anime eye: dark, with a large and a small highlight. */
const eyeOpen = (x, y, rx, ry) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${EYE}"/>` +
  `<circle cx="${x + rx * 0.3}" cy="${y - ry * 0.38}" r="${rx * 0.42}" fill="${EYE_LIGHT}"/>` +
  `<circle cx="${x - rx * 0.32}" cy="${y + ry * 0.4}" r="${rx * 0.2}" fill="${EYE_LIGHT}"/>`;

/**
 * An eye in a given state.
 *
 * @param {"open" | "blink" | "closed" | "happy"} state
 */
function eye(state, x, y, rx, ry) {
  if (state === "open") return eyeOpen(x, y, rx, ry);
  const w = rx * 1.1;
  // Happy eyes are upturned arcs (^ ^); closed ones hang down; a blink is nearly flat.
  const bend = { happy: -ry * 0.9, closed: ry * 0.7, blink: ry * 0.25 }[state];
  return `<path d="M${x - w} ${y}q${w} ${bend} ${2 * w} 0" stroke="${EYE}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
}

/**
 * The head in three-quarter view facing right, centred at (27, 16.5) with a
 * radius of 10.2; place it elsewhere with a transform.
 *
 * @param {object} [o]
 * @param {"open" | "blink" | "closed" | "happy"} [o.eyes]
 * @param {boolean} [o.open] An open, smiling mouth.
 * @param {number} [o.ears] Degrees the ears fold back (for sleeping).
 */
function sideHead({ eyes = "open", open = false, ears = 0 } = {}) {
  const backEar = "M19.6 11.4C17.2 7.6 15.8 4 15.6 0.9C19.6 2.4 22.6 5.2 24.4 8.2Z";
  const backInner = "M19.8 9.4C18.6 7 17.8 5 17.6 3.2C19.8 4.4 21.4 6 22.4 7.8Z";
  const frontEar = "M28.2 7C30.4 4.4 33.2 2 36.4 1C36.6 4.4 35.8 8 34.2 10.6Z";
  const frontInner = "M30 6.6C31.6 4.8 33.2 3.6 35 3C35 5 34.6 7 33.6 8.6Z";
  const mouth = open
    ? `<path d="M32.8 21.6q1.7 3 3.4 0z" fill="${MOUTH}" stroke="${EYE}" stroke-width=".55" stroke-linejoin="round"/>`
    : `<path d="M32.8 21.8q.85 .9 1.7 0q.85 .9 1.7 0" stroke="${EYE}" stroke-width=".55" fill="none" stroke-linecap="round"/>`;
  return (
    at(
      ears ? `rotate(${-ears} 22 9)` : "",
      `<path d="${backEar}" fill="url(#vFur)" ${OUTLINE}/>` +
        `<path d="${backInner}" fill="${INNER_EAR}"/>`,
    ) +
    `<circle cx="27" cy="16.5" r="10.2" fill="url(#vFur)" ${OUTLINE}/>` +
    at(
      ears ? `rotate(${ears} 31 9)` : "",
      `<path d="${frontEar}" fill="url(#vFur)" ${OUTLINE}/>` +
        `<path d="${frontInner}" fill="${INNER_EAR}"/>`,
    ) +
    `<ellipse cx="33.8" cy="20.8" rx="3.4" ry="2.5" fill="${CREAM}"/>` +
    eye(eyes, 28.8, 16.2, 2.3, 2.9) +
    eye(eyes, 34.4, 16.4, 1.7, 2.6) +
    `<circle cx="36.9" cy="19.6" r=".8" fill="${EYE}"/>` +
    mouth +
    cheek(24.8, 21, 2)
  );
}

/** Moves and scales the side-view head so its centre lands on (x, y). */
const headAt = (x, y, scale, inner) =>
  at(`translate(${x} ${y}) scale(${scale}) translate(-27 -16.5)`, inner);

// --------------------------------------------------------------- side view

/** The fluffy tail, rising behind her from (17.5, 35); `sway` swings it. */
function tail(sway = 0) {
  const d =
    "M17.5 35C11 36 5.5 31 6 24C6.4 18.5 10.5 15.5 13.5 17" +
    "C11.5 20 12 25 15.5 28.5C17 30 18.5 31.6 19 33.4Z";
  return at(
    sway ? `rotate(${sway} 17.5 35)` : "",
    `<path d="${d}" fill="url(#vTail)" ${OUTLINE}/>`,
  );
}

/**
 * Standing, seen from the side.
 *
 * @param {object} [o]
 * @param {number} [o.bob] How far the whole body rises.
 * @param {[number, number]} [o.step] How far the back and front foot lift.
 * @param {number} [o.sway] Degrees the tail swings.
 * @param {boolean} [o.armsUp] Paws raised in joy.
 * @param {"open" | "blink" | "closed" | "happy"} [o.eyes]
 * @param {boolean} [o.open] Open, smiling mouth.
 * @param {string} [o.charge] Extra electricity drawn on top.
 */
function standing({
  bob = 0,
  step = [0, 0],
  sway = 0,
  armsUp = false,
  eyes = "open",
  open = false,
  charge = "",
} = {}) {
  const arm = "M29.4 28.4q3 1 3.6 3.6q-1.2 .8 -2.6 -.4z";
  const body =
    tail(sway) +
    `<ellipse cx="24.5" cy="32.5" rx="8.6" ry="8.8" fill="url(#vFur)" ${OUTLINE}/>` +
    `<ellipse cx="27.2" cy="34" rx="4.8" ry="5.8" fill="${CREAM}"/>` +
    // A paw at her side sits in front of her tummy; raised, it waves in
    // front of her chin, so it is drawn after the head.
    (armsUp ? "" : `<path d="${arm}" fill="url(#vFur)" ${OUTLINE}/>`) +
    sideHead({ eyes, open }) +
    (armsUp ? at("rotate(-75 29.8 28.8)", `<path d="${arm}" fill="url(#vFur)" ${OUTLINE}/>`) : "");
  const feet =
    `<ellipse cx="20.5" cy="${41.6 - step[0]}" rx="3" ry="1.5" fill="url(#vFur)" ${OUTLINE}/>` +
    `<ellipse cx="29.4" cy="${41.6 - step[1]}" rx="3.2" ry="1.5" fill="url(#vFur)" ${OUTLINE}/>`;
  return DEFS + shadow(12) + feet + at(bob ? `translate(0 ${-bob})` : "", body) + charge;
}

/** Sitting with her tail curled round her feet, a spark on its tip. */
function sitting() {
  const wrap =
    "M17 38.4C10.6 38.6 8 42.6 13 43.2C19 43.8 30 43.6 35.6 42.4" +
    "C37.4 42 37.2 40.4 35.2 40.4C30 41 23 40.4 17 38.4Z";
  return (
    DEFS +
    shadow(13) +
    `<ellipse cx="23.6" cy="35" rx="9" ry="7" fill="url(#vFur)" ${OUTLINE}/>` +
    `<ellipse cx="26.6" cy="36" rx="4.8" ry="5" fill="${CREAM}"/>` +
    `<path d="M28.6 31.6q2.6 2 2.6 5.4q-1.4 .6 -2.4 -.8z" fill="url(#vFur)" ${OUTLINE}/>` +
    `<path d="${wrap}" fill="url(#vTail)" ${OUTLINE}/>` +
    headAt(27, 19.6, 1, sideHead()) +
    spark(36.6, 40.6, 1.5)
  );
}

/** Curled up asleep inside her tail, ears folded, a little static twinkling. */
function sleeping() {
  const curl =
    "M10 40C7.6 34 11 28.6 16.6 28C14 31.6 14.4 36.4 18.4 39.6" +
    "C24 43.4 33 42.6 38.6 40.4C37.8 43 33 44.2 24 44.2C16 44.2 11.4 43 10 40Z";
  return (
    DEFS +
    shadow(16) +
    `<ellipse cx="24" cy="36.4" rx="11.4" ry="6.6" fill="url(#vFur)" ${OUTLINE}/>` +
    headAt(31, 32.4, 0.78, sideHead({ eyes: "closed", ears: 28 })) +
    `<path d="${curl}" fill="url(#vTail)" ${OUTLINE}/>` +
    spark(13, 26, 1.2) +
    snore(37, 16)
  );
}

// ------------------------------------------------------ front and back views

/** Head seen from the front, centred at (24, 16). */
function frontHead() {
  const ear = "M16.4 10.6C14.4 7.4 13.4 4 13.6 0.8C17.2 2.2 20 4.6 21.6 7.6Z";
  const inner = "M16.8 8.6C15.8 6.6 15.4 4.8 15.4 3.2C17.4 4.2 19 5.6 20 7.2Z";
  const mirror = (s) => `<g transform="matrix(-1 0 0 1 48 0)">${s}</g>`;
  const one = `<path d="${ear}" fill="url(#vFur)" ${OUTLINE}/><path d="${inner}" fill="${INNER_EAR}"/>`;
  return (
    one +
    mirror(one) +
    `<circle cx="24" cy="16.5" r="10.2" fill="url(#vFur)" ${OUTLINE}/>` +
    `<ellipse cx="24" cy="21.2" rx="3.6" ry="2.6" fill="${CREAM}"/>` +
    eyeOpen(20, 16.4, 2.2, 2.8) +
    eyeOpen(28, 16.4, 2.2, 2.8) +
    `<circle cx="24" cy="19.8" r=".8" fill="${EYE}"/>` +
    `<path d="M22.3 21.4q.85 .9 1.7 0q.85 .9 1.7 0" stroke="${EYE}" stroke-width=".55" fill="none" stroke-linecap="round"/>` +
    cheek(16.4, 21, 1.9) +
    cheek(31.6, 21, 1.9)
  );
}

/** Head seen from behind: fur and the backs of the ears. */
function backHead() {
  const ear = "M16.4 10.6C14.4 7.4 13.4 4 13.6 0.8C17.2 2.2 20 4.6 21.6 7.6Z";
  const one = `<path d="${ear}" fill="url(#vFur)" ${OUTLINE}/>`;
  return (
    one +
    `<g transform="matrix(-1 0 0 1 48 0)">${one}</g>` +
    `<circle cx="24" cy="16.5" r="10.2" fill="url(#vFur)" ${OUTLINE}/>`
  );
}

/** Steps of the trot: how far she bobs and which foot is up. */
const TROT = [
  { bob: 0, step: [1.4, 0] },
  { bob: 0.8, step: [0, 0] },
  { bob: 0, step: [0, 1.4] },
  { bob: 0.8, step: [0, 0] },
];

/** Sparks that flicker at the tail tip as she trots, one set per frame. */
const TRAIL = [
  [spark(7.6, 17.6, 1.4)],
  [spark(5, 21, 1)],
  [spark(9.4, 15.4, 1.1), spark(4.6, 19, 0.8)],
  [spark(6.4, 16.2, 1.5)],
];

/** Facing you (walking down the pane). */
function front(step) {
  const { bob, step: lift } = TROT[step];
  const arm = "M16.4 29q-2.8 1.2 -3 3.8q1.4 .6 2.6 -.8z";
  const body =
    // The tail peeks out behind her on one side.
    `<path d="M30 36C35 36 38.6 31 38 25C37.6 21.6 35.6 20 34 21C35 24 34.6 29 30.6 32Z" fill="url(#vTail)" ${OUTLINE}/>` +
    `<ellipse cx="24" cy="32.5" rx="8.6" ry="8.8" fill="url(#vFur)" ${OUTLINE}/>` +
    `<ellipse cx="24" cy="34.2" rx="5.2" ry="5.8" fill="${CREAM}"/>` +
    `<path d="${arm}" fill="url(#vFur)" ${OUTLINE}/>` +
    `<g transform="matrix(-1 0 0 1 48 0)"><path d="${arm}" fill="url(#vFur)" ${OUTLINE}/></g>` +
    frontHead();
  return (
    DEFS +
    shadow(11) +
    `<ellipse cx="20" cy="${41.6 - lift[0]}" rx="2.8" ry="1.5" fill="url(#vFur)" ${OUTLINE}/>` +
    `<ellipse cx="28" cy="${41.6 - lift[1]}" rx="2.8" ry="1.5" fill="url(#vFur)" ${OUTLINE}/>` +
    at(bob ? `translate(0 ${-bob})` : "", body)
  );
}

/** From behind (walking up the pane): her tail rises in front of her back. */
function behind(step) {
  const { bob, step: lift } = TROT[step];
  const sway = [0, 4, 0, -4][step];
  const plume =
    "M24 39C19.4 37.6 17.4 32 18.6 26.4C19.6 21.8 22.4 19.4 24 19" +
    "C25.6 19.4 28.4 21.8 29.4 26.4C30.6 32 28.6 37.6 24 39Z";
  const body =
    backHead() +
    `<ellipse cx="24" cy="32.5" rx="8.6" ry="8.8" fill="url(#vFur)" ${OUTLINE}/>` +
    at(
      `rotate(${sway} 24 39)`,
      `<path d="${plume}" fill="url(#vTail)" ${OUTLINE}/>` + spark(24, 20.4, 1.3),
    );
  return (
    DEFS +
    shadow(11) +
    `<ellipse cx="20" cy="${41.8 - lift[0]}" rx="2.6" ry="1.3" fill="url(#vFur)" ${OUTLINE}/>` +
    `<ellipse cx="28" cy="${41.8 - lift[1]}" rx="2.6" ry="1.3" fill="url(#vFur)" ${OUTLINE}/>` +
    at(bob ? `translate(0 ${-bob})` : "", body)
  );
}

// ---------------------------------------------------------------- happy

/**
 * Lightning crackling around her when she is happy, a different burst each
 * frame so the bolts seem to flicker on and off.
 */
const CRACKLE = [
  bolt(6, 12, 1, -18) +
    bolt(42.4, 30, 0.85, 20) +
    arc([
      [36, 6],
      [38.6, 8.4],
      [37.2, 10],
      [40.4, 12.6],
    ]) +
    spark(10, 34, 1.3),
  bolt(42, 9, 1.05, 16) +
    bolt(5.6, 30, 0.9, -24) +
    arc([
      [9, 20],
      [6.6, 22],
      [8.4, 23.4],
      [5.6, 26],
    ]) +
    spark(39.6, 37, 1.2),
  bolt(7.6, 21, 0.95, -8) +
    bolt(41.4, 20, 1, 12) +
    arc([
      [20, 3.4],
      [22.4, 1.6],
      [24, 3.6],
      [26.6, 1.8],
    ]) +
    spark(5, 8, 1.1) +
    spark(43, 38, 1),
];

/** Volta, as Tilefold Pet's character list describes a character. */
export const volta = {
  id: "volta",
  label: "setting-character-volta",
  name: "Volta",
  speed: 44,
  bubbles: { play: "bubble-zap" },
  // No `sounds`: she stays quiet whatever the Bark setting says.
  poses: () => ({
    idle: still(standing({ charge: spark(7.2, 17.4, 1.1) })),
    blink: still(standing({ eyes: "blink", charge: spark(7.2, 17.4, 1.1) })),
    sit: still(sitting()),
    walk: sprite(4, 8, (i) =>
      standing({ ...TROT[i], sway: [0, 5, 0, -5][i], charge: TRAIL[i].join("") }),
    ),
    walkDown: sprite(4, 8, front),
    walkUp: sprite(4, 8, behind),
    happy: sprite(3, 10, (i) =>
      standing({
        eyes: "happy",
        open: true,
        armsUp: true,
        bob: i === 1 ? 1.2 : 0,
        sway: [-6, 6, 0][i],
        charge: CRACKLE[i],
      }),
    ),
    sleep: still(sleeping()),
  }),
};
