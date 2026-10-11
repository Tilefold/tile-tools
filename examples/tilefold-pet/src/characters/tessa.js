/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Tilefold Pet — Tessa
 *
 * Tessa, a small creature made of four rounded tiles in Tilefold's colours.
 * She stands, blinks, walks on two little feet (a two-frame sprite sheet;
 * walking away up the pane she shows the plain backs of her tiles),
 * squints with rosy cheeks when happy, and curls into one closed cube to
 * sleep. Drawn as SVG in code; a placeholder until commissioned sprites
 * exist.
 */
import { shadow, snore, sprite, still } from "../art.js";

const COLORS = ["#5eead4", "#a78bfa", "#fbbf24", "#fb7185"];
const INK = "#1f2937";

/**
 * Her four tiles, eyes and feet in one pose.
 *
 * @param {"idle" | "blink" | "walk" | "back" | "happy" | "sleep"} pose
 *   ("back" is her walking away: no face, feet stepping)
 * @param {number} [step] Which walking frame (0 or 1).
 * @returns {string} SVG elements.
 */
function body(pose, step = 0) {
  const sleep = pose === "sleep";
  const gap = sleep ? 0 : 2;
  const top = sleep ? 16 : 9;
  const s = 15;
  const at = [
    [24 - s - gap / 2, top],
    [24 + gap / 2, top],
    [24 - s - gap / 2, top + s + gap],
    [24 + gap / 2, top + s + gap],
  ];
  const tiles = at
    .map(
      ([x, y], i) =>
        `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="4" fill="${COLORS[i]}"/>`,
    )
    .join("");
  const eyeY = top + 8;
  const ex = [24 - 8.5, 24 + 8.5];
  let eyes;
  if (pose === "back") {
    eyes = "";
  } else if (sleep || pose === "blink") {
    eyes = ex
      .map(
        (x) =>
          `<path d="M${x - 2.5} ${eyeY}h5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
      )
      .join("");
  } else if (pose === "happy") {
    eyes = ex
      .map(
        (x) =>
          `<path d="M${x - 2.5} ${eyeY + 1}q2.5 -3.5 5 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
      )
      .join("");
    eyes += ex
      .map((x) => `<circle cx="${x}" cy="${eyeY + 5}" r="1.8" fill="#f9a8d4" opacity=".8"/>`)
      .join("");
  } else {
    eyes = ex.map((x) => `<circle cx="${x}" cy="${eyeY}" r="2.3" fill="${INK}"/>`).join("");
  }
  const footY = top + 2 * s + gap;
  const stepping = pose === "walk" || pose === "back";
  const lift = stepping ? (step ? [0, 2] : [2, 0]) : [0, 0];
  const feet = sleep
    ? ""
    : [15, 29]
        .map(
          (x, i) =>
            `<rect x="${x}" y="${footY - lift[i]}" width="5" height="4" rx="2" fill="${INK}" opacity=".75"/>`,
        )
        .join("");
  return shadow(sleep ? 15 : 13) + tiles + eyes + feet + (sleep ? snore(38, 12) : "");
}

/** Tessa, as Tilefold Pet's character list describes a character. */
export const tessa = {
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
    sleep: still(body("sleep")),
  }),
};
