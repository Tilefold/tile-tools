/**
 * Copyright (c) 2026 Tilefold
 * Author: Tilefold
 * Released under the MIT License.
 *
 * Screensaver Themes
 *
 * Two themes for Tilefold's screensaver: Matrix (columns of falling green
 * glyphs) and Starfield (flying through stars). Pick one in Settings →
 * Screensaver → Theme; this tile's settings choose the color and speed.
 *
 * It shows what a screensaver theme tile is (Tilefold 0.1.12): it asks for
 * `screensaver.theme` and nothing else, and adds themes with
 * `tf.screensaver.theme(id, name, draw)`. Tilefold calls `draw` once per
 * frame, at most 30 times a second, with a Canvas 2D context covering the
 * window; the theme gets no input and nothing from the screen. Each start
 * draws afresh (frame 0), with new random columns and stars.
 *
 * Built into main.js with `npx @tilefold/tile-tools build`.
 */
import { createMatrixRain } from "./matrix.js";
import { colorFor, speedFor } from "./palette.js";
import { seededRandom } from "./random.js";
import { createStarfield } from "./starfield.js";

export default (tf) => {
  // Message keys written out in full, so a search finds every string the tile uses.
  tf.setting("color", "green", tf.t("setting-color"), {
    choices: [
      { value: "green", label: tf.t("color-green") },
      { value: "amber", label: tf.t("color-amber") },
      { value: "blue", label: tf.t("color-blue") },
      { value: "theme", label: tf.t("color-theme") },
    ],
  });
  tf.setting("speed", "normal", tf.t("setting-speed"), {
    choices: [
      { value: "slow", label: tf.t("speed-slow") },
      { value: "normal", label: tf.t("speed-normal") },
      { value: "fast", label: tf.t("speed-fast") },
    ],
  });

  // Before Tilefold 0.1.12 there is no screensaver to draw on.
  if (!tf.screensaver) return;

  /** The color and speed the settings ask for, read each frame so changes show at once. */
  const look = (colors) => ({
    color: colorFor(tf.settings.get("color"), colors),
    speed: speedFor(tf.settings.get("speed")),
  });

  /** A theme that starts afresh on every screensaver start (frame 0). */
  const theme = (create) => {
    let current = null;
    return (f) => {
      if (f.frame === 0 || !current) current = create(seededRandom(Date.now()));
      current.draw(f, look(f.colors));
    };
  };

  tf.screensaver.theme("matrix", tf.t("theme-matrix"), theme(createMatrixRain));
  tf.screensaver.theme("starfield", tf.t("theme-starfield"), theme(createStarfield));
};
